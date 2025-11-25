/**
 * Action Executors
 * ----------------
 * Converts high-confidence agentic_actions into side effects across providers.
 *
 * Currently wired targets:
 * - todoist (creates tasks via TodoistClient)
 * - calendar_event (queues local .ics draft; marks status queued)
 * - email_draft / text_message (marks queued with payload for downstream senders)
 *
 * Any action that cannot be executed safely is queued for manual review.
 */

import fs from 'fs';
import path from 'path';
import { listAgenticActions, updateAgenticActionStatusWithMeta } from './db/queries';
import { getTodoistClient } from './TodoistClient';
import { getMotionClient, hasMotionConfig } from './MotionClient';
import { sendEmail } from './emailSender';
import { sendIMessage } from './imessageSender';
import { sendSms, hasTwilioConfig } from './twilioSender';

function parseBool(v: string): boolean {
  return ['1', 'true', 'yes', 'y', 'on'].includes(v.toLowerCase());
}

const EXECUTE_THRESHOLD = parseFloat(process.env.EXECUTE_THRESHOLD ?? '0.85');
const DEFAULT_PROJECT = process.env.TODOIST_EXEC_PROJECT || 'EA Inbox';
const LIVE = {
  todoist: parseBool(process.env.EXECUTE_TODOIST_LIVE ?? 'false'),
  motion: parseBool(process.env.EXECUTE_MOTION_LIVE ?? 'false'),
  email: parseBool(process.env.EXECUTE_EMAIL_LIVE ?? 'false'),
  imessage: parseBool(process.env.EXECUTE_IMESSAGE_LIVE ?? 'true'), // safe local delivery
  sms: parseBool(process.env.EXECUTE_SMS_LIVE ?? 'false'),
};
const REQUIRE_APPROVAL = parseBool(process.env.EXECUTE_REQUIRE_APPROVAL ?? 'false');
const DRY_RUN = parseBool(process.env.EXECUTE_DRY_RUN ?? 'false');
const LOG_DIR = process.env.EXECUTOR_LOG_DIR || path.resolve(process.cwd(), '.data', 'executor-logs');

const RATE_LIMITS = {
  todoist: parseInt(process.env.EXECUTE_RATE_MAX_TODOIST_PER_RUN ?? '10', 10),
  motion: parseInt(process.env.EXECUTE_RATE_MAX_MOTION_PER_RUN ?? '10', 10),
  email: parseInt(process.env.EXECUTE_RATE_MAX_EMAIL_PER_RUN ?? '20', 10),
  imessage: parseInt(process.env.EXECUTE_RATE_MAX_IMESSAGE_PER_RUN ?? '30', 10),
  sms: parseInt(process.env.EXECUTE_RATE_MAX_SMS_PER_RUN ?? '10', 10),
};

const counters: Record<string, number> = { todoist: 0, motion: 0, email: 0, imessage: 0, sms: 0 };

function logAction(status: string, action: any, extra: Record<string, any> = {}) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const file = path.join(LOG_DIR, `${status}.log`);
    const line = JSON.stringify({
      at: new Date().toISOString(),
      id: action.id,
      type: action.type,
      target: action.target,
      confidence: action.confidence,
      ...extra,
    });
    fs.appendFileSync(file, line + '\n');
  } catch {
    /* ignore logging errors */
  }
}

type ExecutionResult = {
  executed: number;
  queued: number;
  failed: number;
};

export async function runActionExecutors(): Promise<ExecutionResult> {
  const actions = listAgenticActions({ status: 'proposed', limit: 100 });
  let executed = 0;
  let queued = 0;
  let failed = 0;

  for (const action of actions) {
    const conf = action.confidence ?? 0;
    if (conf < EXECUTE_THRESHOLD) {
      // Queue for human review
      updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'below_threshold', confidence: conf });
      queued++;
      continue;
    }

    const result = await executeActionInternal(action, { executed, queued, failed });
    if (result === 'executed') executed++;
    else if (result === 'queued') queued++;
    else failed++;
  }

  return { executed, queued, failed };
}

async function executeActionInternal(
  action: any,
  counters: { executed: number; queued: number; failed: number }
): Promise<'executed' | 'queued' | 'failed'> {
  try {
    if (REQUIRE_APPROVAL) {
      let meta: any = {};
      try {
        meta = typeof action.metadata === 'string' ? JSON.parse(action.metadata) : action.metadata || {};
      } catch {
        meta = {};
      }
      const approved = meta.approved === true;
      if (!approved) {
        updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'awaiting_approval' });
        logAction('queued', action, { reason: 'awaiting_approval' });
        return 'queued';
      }
    }

    switch (normalizeTarget(action.target)) {
      case 'todoist':
      case 'task': {
        if (isRateLimited('todoist', action)) return 'queued';
        if (DRY_RUN) return queueDryRun(action, 'todoist');
        if (!LIVE.todoist) {
          updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'live_disabled', target: 'todoist' });
          return 'queued';
        }
        await handleTodoist(action);
        bumpCounter('todoist');
        updateAgenticActionStatusWithMeta(action.id, 'executed', { target: 'todoist' });
        return 'executed';
      }
      case 'motion': {
        if (isRateLimited('motion', action)) return 'queued';
        if (DRY_RUN) return queueDryRun(action, 'motion');
        if (!LIVE.motion) {
          updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'live_disabled', target: 'motion' });
          return 'queued';
        }
        const handled = await handleMotion(action);
        if (handled) {
          bumpCounter('motion');
          updateAgenticActionStatusWithMeta(action.id, 'executed', { target: 'motion' });
          return 'executed';
        } else {
          updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'motion_unavailable' });
          return 'queued';
        }
      }
      case 'calendar_event': {
        const file = writeIcsDraft(action);
        updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'ics_draft', file });
        return 'queued';
      }
      case 'email_draft': {
        if (isRateLimited('email', action)) return 'queued';
        if (DRY_RUN) return queueDryRun(action, 'email');
        if (!LIVE.email) {
          updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'live_disabled', target: 'email' });
          return 'queued';
        }
        const handled = await maybeSendEmail(action);
        if (handled) {
          bumpCounter('email');
          updateAgenticActionStatusWithMeta(action.id, 'executed', { target: 'email' });
          return 'executed';
        } else {
          updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'awaiting_sender', target: action.target });
          return 'queued';
        }
      }
      case 'text_message': {
        if (isRateLimited('imessage', action) && isRateLimited('sms', action)) {
          updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'rate_limited', target: 'text_message' });
          logAction('queued', action, { reason: 'rate_limited' });
          return 'queued';
        }
        if (DRY_RUN) return queueDryRun(action, 'text_message');
        const order = (process.env.TEXT_SEND_ORDER || 'imessage-first').toLowerCase();
        const firstImessage = order === 'imessage-first';
        const firstSms = order === 'sms-first' || order === 'twilio-first';

        if (firstImessage) {
          const imHandled = LIVE.imessage ? await maybeSendIMessage(action) : false;
          if (imHandled) {
            bumpCounter('imessage');
            updateAgenticActionStatusWithMeta(action.id, 'executed', { target: 'imessage' });
            return 'executed';
          }
        }

        if (firstSms || !firstImessage) {
          const smsHandled = LIVE.sms ? await maybeSendSms(action) : false;
          if (smsHandled) {
            bumpCounter('sms');
            updateAgenticActionStatusWithMeta(action.id, 'executed', { target: 'sms' });
            return 'executed';
          }
        }

        if (!firstImessage) {
          const imHandled = LIVE.imessage ? await maybeSendIMessage(action) : false;
          if (imHandled) {
            bumpCounter('imessage');
            updateAgenticActionStatusWithMeta(action.id, 'executed', { target: 'imessage' });
            return 'executed';
          }
        }

        updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'awaiting_sms_or_imessage', target: action.target });
        return 'queued';
      }
      default: {
        updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'unknown_target', target: action.target });
        return 'queued';
      }
    }
  } catch (e: any) {
    updateAgenticActionStatusWithMeta(action.id, 'failed', { error: String(e) });
    return 'failed';
  }
}

export async function executeSingleAction(id: string): Promise<{ status: 'executed' | 'queued' | 'failed'; target?: string; reason?: string }> {
  const actions = listAgenticActions({ status: 'proposed', limit: 200 }).filter((a) => a.id === id);
  if (!actions.length) {
    // Try queued as well for manual execute
    const queued = listAgenticActions({ status: 'queued', limit: 200 }).filter((a) => a.id === id);
    actions.push(...queued);
  }
  if (!actions.length) return { status: 'failed', reason: 'not_found' };
  const action = actions[0];
  const res = { executed: 0, queued: 0, failed: 0 };
  const result = await executeActionInternal(action, res);
  if (result === 'executed') return { status: 'executed', target: action.target || undefined };
  if (result === 'queued') return { status: 'queued', target: action.target || undefined };
  return { status: 'failed', target: action.target || undefined };
}

function queueDryRun(action: any, target: string): 'queued' {
  updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'dry_run', target });
  logAction('queued', action, { reason: 'dry_run', target });
  return 'queued';
}

function isRateLimited(channel: keyof typeof RATE_LIMITS, action: any): boolean {
  const max = RATE_LIMITS[channel];
  if (!max || max <= 0) return false;
  if ((counters[channel] ?? 0) >= max) {
    updateAgenticActionStatusWithMeta(action.id, 'queued', { reason: 'rate_limited', target: channel });
    logAction('queued', action, { reason: 'rate_limited', target: channel });
    return true;
  }
  return false;
}

function bumpCounter(channel: keyof typeof RATE_LIMITS) {
  counters[channel] = (counters[channel] ?? 0) + 1;
}

function normalizeTarget(t?: string | null): string {
  if (!t) return 'task';
  const s = t.toLowerCase();
  if (['todoist', 'task', 'tasks'].includes(s)) return 'todoist';
  if (['motion'].includes(s)) return 'motion';
  if (['calendar', 'calendar_event', 'event'].includes(s)) return 'calendar_event';
  if (['email', 'email_draft', 'gmail', 'outlook'].includes(s)) return 'email_draft';
  if (['sms', 'text', 'text_message'].includes(s)) return 'text_message';
  return s;
}

async function handleTodoist(action: any) {
  const client = getTodoistClient();
  const project = await client.ensureProject(DEFAULT_PROJECT);
  const due_string = extractDueFromContent(action.content);
  await client.createTask(project.id, action.content, action.title ?? undefined, due_string, 3);
}

function extractDueFromContent(content: string): string | undefined {
  const match = content.match(/Due:\s*(.+)/i);
  return match ? match[1].trim() : undefined;
}

async function handleMotion(action: any): Promise<boolean> {
  if (!hasMotionConfig()) return false;
  const client = getMotionClient();
  let meta: any = {};
  try {
    meta = typeof action.metadata === 'string' ? JSON.parse(action.metadata) : action.metadata || {};
  } catch {
    /* ignore */
  }
  const workspaceId = selectMotionWorkspace(meta);
  if (!workspaceId) {
    console.warn('[executor] motion workspace missing; queueing');
    return false;
  }
  try {
    await client.createTask({
      title: action.title || 'EA Task',
      description: action.content || '',
      due_iso: extractDueFromContent(action.content),
      duration_minutes: 30,
      priority: (meta.priority || 'MEDIUM').toString().toUpperCase() as any,
      project: meta.project,
      workspaceId,
    });
    return true;
  } catch (e) {
    console.warn('[executor] motion createTask failed', e);
    return false;
  }
}

function selectMotionWorkspace(meta: any): string | null {
  // 1) explicit on action metadata
  if (meta?.workspaceId) return meta.workspaceId;
  // 2) map by project name via MOTION_WORKSPACE_MAP (JSON { "utlyze": "<id>", ... , "default": "<id>" })
  const mapJson = process.env.MOTION_WORKSPACE_MAP;
  if (mapJson) {
    try {
      const map = JSON.parse(mapJson);
      const projectKey = (meta?.project || meta?.projectName || '').toLowerCase();
      if (projectKey && map[projectKey]) return map[projectKey];
      if (map.default) return map.default;
    } catch (e) {
      console.warn('[executor] invalid MOTION_WORKSPACE_MAP JSON', e);
    }
  }
  // 3) default env variable
  return process.env.MOTION_WORKSPACE_ID || null;
}

function writeIcsDraft(action: any): string {
  const dir = path.resolve(process.cwd(), '.data', 'ics');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${action.id}.ics`);
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const summary = action.title || 'EA Event';
  const description = action.content || '';
  const dtstamp = now;
  const dtstart = now;
  const dtend = now;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WrathShield//EA//EN',
    'BEGIN:VEVENT',
    `UID:${action.id}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  fs.writeFileSync(file, ics, 'utf8');
  return file;
}

async function maybeSendEmail(action: any): Promise<boolean> {
  const recipients = extractRecipients(action.metadata);
  if (!recipients.length) return false;
  const subject = action.title || 'EA Email';
  const text = action.content || '';
  try {
    await sendEmail({ to: recipients.join(','), subject, text, preferredProfile: extractSmtpProfile(action.metadata) });
    return true;
  } catch (e) {
    console.warn('[executor] sendEmail failed', e);
    return false;
  }
}

function extractRecipients(meta: any): string[] {
  if (!meta) return [];
  try {
    const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
    const arr = [] as string[];
    if (parsed?.to) arr.push(parsed.to);
    if (Array.isArray(parsed?.recipients)) arr.push(...parsed.recipients);
    const allowDomain = process.env.SMTP_ALLOW_DOMAIN;
    return arr
      .map(String)
      .filter(Boolean)
      .filter((addr) => (!allowDomain ? true : addr.toLowerCase().endsWith(allowDomain.toLowerCase())));
  } catch {
    return [];
  }
}

function extractSmtpProfile(meta: any): string | undefined {
  try {
    const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
    if (parsed?.smtp_profile) return parsed.smtp_profile;
  } catch {
    /* ignore */
  }
  return undefined;
}

async function maybeSendIMessage(action: any): Promise<boolean> {
  const recipients = extractRecipients(action.metadata);
  if (!recipients.length) return false;
  const text = action.content || '';
  try {
    for (const to of recipients) {
      await sendIMessage(to, text);
    }
    return true;
  } catch (e) {
    console.warn('[executor] sendIMessage failed', e);
    return false;
  }
}

async function maybeSendSms(action: any): Promise<boolean> {
  if (!hasTwilioConfig()) return false;
  const recipients = extractRecipients(action.metadata);
  if (!recipients.length) return false;
  const text = action.content || '';
  try {
    for (const to of recipients) {
      await sendSms({ to, body: text });
    }
    return true;
  } catch (e) {
    console.warn('[executor] sendSms failed', e);
    return false;
  }
}
