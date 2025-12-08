/**
 * Unified Action Lane API
 *
 * GET /api/pm/unified - Fetch unified action items from all sources
 * POST /api/pm/unified - Execute action on an item (approve, edit, cancel, delay, delegate)
 *
 * Pulls data from:
 * - Events table (emails, iMessages, lifelogs)
 * - Local tasks
 * - PM queue
 * - Contacts (enrichment)
 */

import { NextRequest, NextResponse } from 'next/server';
import { listRecentEvents, snoozeEvent, dismissEvent, type EventRow } from '@/lib/events';
import { getLocalTasks, updateLocalTask, type LocalTask } from '@/lib/pm/local-task-store';
import { resolveContact, getContactById, type ContactMatch } from '@/lib/contacts/resolver';
import { type ContactRow } from '@/lib/relationshipDb';

export const dynamic = 'force-dynamic';

// Action item structure for the unified lane
interface ActionItem {
  id: string;
  source: 'email' | 'imessage' | 'lifelog' | 'llm_chat' | 'contact' | 'task';
  title: string;
  preview: string;
  contact?: string;
  contactEmail?: string;
  contactId?: string;
  contactDisplayName?: string;
  contactHandle?: string;
  timestamp: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done' | 'dismissed' | 'snoozed' | 'delegated';
  suggestedAction?: {
    type: string;
    description: string;
    confidence: number;
  };
  project?: string;
  metadata?: Record<string, unknown>;
}

// Cache for contact lookups to avoid repeated DB queries
const contactCache = new Map<string, ContactMatch | null>();

/**
 * Resolve and cache contact information
 */
function resolveContactCached(handle: string | null | undefined): ContactMatch | null {
  if (!handle) return null;

  // Check cache first
  if (contactCache.has(handle)) {
    return contactCache.get(handle) || null;
  }

  // Resolve contact (don't auto-create for now to avoid creating many contacts)
  const match = resolveContact(handle, undefined, { autoCreate: false, minConfidence: 0.7 });
  contactCache.set(handle, match);

  return match;
}

/**
 * Convert an EventRow to an ActionItem
 */
function eventToActionItem(event: EventRow): ActionItem | null {
  // Skip dismissed events
  if (event.dismissed_at) return null;

  // Skip snoozed events that haven't reached their snooze time
  if (event.snoozed_until && event.snoozed_until > Math.floor(Date.now() / 1000)) return null;

  // Map source/channel to unified source type
  let source: ActionItem['source'];
  if (event.source === 'gmail' || event.source === 'outlook' || event.channel === 'email') {
    source = 'email';
  } else if (event.source === 'imessage' || event.channel === 'imessage') {
    source = 'imessage';
  } else if (event.source === 'limitless' || event.channel === 'lifelog') {
    source = 'lifelog';
  } else {
    // Unknown source, skip
    return null;
  }

  // Determine urgency based on classification or defaults
  let urgency: ActionItem['urgency'] = 'medium';
  if (event.flagged) urgency = 'high';
  if (event.classification === 'urgent' || event.classification === 'critical') urgency = 'critical';
  if (event.classification === 'low') urgency = 'low';

  // Build suggested action if available
  let suggestedAction: ActionItem['suggestedAction'] | undefined;
  if (event.routed_target) {
    suggestedAction = {
      type: 'route',
      description: `Route to ${event.routed_target}`,
      confidence: event.confidence ?? 0.8,
    };
  }

  // Enrich with contact information
  let contactId: string | undefined;
  let contactDisplayName: string | undefined;
  let contactHandle: string | undefined;

  // First check if event already has contact_id
  if (event.contact_id) {
    const existingContact = getContactById(event.contact_id);
    if (existingContact) {
      contactId = existingContact.id;
      contactDisplayName = existingContact.display_name || undefined;
      contactHandle = existingContact.handle;
    }
  }

  // If no contact_id, try to resolve from contact field
  if (!contactId && event.contact) {
    const match = resolveContactCached(event.contact);
    if (match) {
      contactId = match.contact_id;
      contactDisplayName = match.display_name || undefined;
      contactHandle = match.handle;
    }
  }

  return {
    id: event.id,
    source,
    title: event.subject || (contactDisplayName ? `Message from ${contactDisplayName}` : event.contact ? `Message from ${event.contact}` : 'New message'),
    preview: event.preview || '',
    contact: event.contact || undefined,
    contactEmail: event.contact?.includes('@') ? event.contact : undefined,
    contactId,
    contactDisplayName,
    contactHandle,
    timestamp: event.ts,
    urgency,
    status: event.snoozed_until ? 'snoozed' : 'pending',
    suggestedAction,
    metadata: event.metadata || undefined,
  };
}

/**
 * Convert a LocalTask to an ActionItem
 */
function taskToActionItem(task: LocalTask): ActionItem {
  // Map task priority to urgency
  const urgencyMap: Record<string, ActionItem['urgency']> = {
    urgent: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    none: 'low',
  };

  // Map task status to action item status
  const statusMap: Record<string, ActionItem['status']> = {
    pending: 'pending',
    in_progress: 'in_progress',
    done: 'done',
    failed: 'pending',
    backlog: 'pending',
  };

  return {
    id: task.id,
    source: 'task',
    title: task.title,
    preview: task.description || '',
    timestamp: task.updated_at,
    urgency: urgencyMap[task.priority] || 'medium',
    status: statusMap[task.status] || 'pending',
    project: task.project_name || undefined,
    metadata: task.metadata,
  };
}

export async function GET() {
  try {
    const items: ActionItem[] = [];

    // Fetch events (emails, iMessages, lifelogs)
    const events = listRecentEvents(100);
    for (const event of events) {
      const item = eventToActionItem(event);
      if (item) items.push(item);
    }

    // Fetch local tasks
    const tasks = getLocalTasks({ limit: 50 });
    for (const task of tasks) {
      if (task.status !== 'done') {
        items.push(taskToActionItem(task));
      }
    }

    // Sort by timestamp descending
    items.sort((a, b) => b.timestamp - a.timestamp);

    // Priority sort: critical first, then high, etc.
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    items.sort((a, b) => {
      const aPri = priorityOrder[a.urgency];
      const bPri = priorityOrder[b.urgency];
      if (aPri !== bPri) return aPri - bPri;
      return b.timestamp - a.timestamp;
    });

    return NextResponse.json({
      ok: true,
      items: items.slice(0, 50), // Limit to 50 items
      count: items.length,
    });
  } catch (error) {
    console.error('[Unified Actions API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, itemId, params } = body;

    if (!action || !itemId) {
      return NextResponse.json(
        { ok: false, error: 'action and itemId are required' },
        { status: 400 }
      );
    }

    // Determine if this is an event or a task based on ID prefix
    const isTask = itemId.startsWith('local_');

    switch (action) {
      case 'approve': {
        // Execute suggested action
        // For now, just mark as done/dismissed
        if (isTask) {
          updateLocalTask(itemId, { status: 'done' });
        } else {
          dismissEvent(itemId);
        }
        return NextResponse.json({ ok: true, action: 'approved', itemId });
      }

      case 'cancel':
      case 'dismiss': {
        if (isTask) {
          updateLocalTask(itemId, { status: 'done' });
        } else {
          dismissEvent(itemId);
        }
        return NextResponse.json({ ok: true, action: 'dismissed', itemId });
      }

      case 'delay':
      case 'snooze': {
        const snoozeHours = params?.hours || 4;
        const snoozeUntil = Math.floor(Date.now() / 1000) + (snoozeHours * 3600);

        if (isTask) {
          // For tasks, update metadata with snooze info
          updateLocalTask(itemId, {
            metadata: { snoozed_until: snoozeUntil },
          });
        } else {
          snoozeEvent(itemId, snoozeUntil);
        }
        return NextResponse.json({ ok: true, action: 'snoozed', itemId, snoozeUntil });
      }

      case 'delegate': {
        const delegateTo = params?.to;
        if (!delegateTo) {
          return NextResponse.json(
            { ok: false, error: 'params.to is required for delegate action' },
            { status: 400 }
          );
        }

        if (isTask) {
          updateLocalTask(itemId, { assignee: delegateTo });
        } else {
          // For events, store delegation in metadata
          // This would need more sophisticated handling in production
          console.log(`[Unified Actions] Delegating ${itemId} to ${delegateTo}`);
        }
        return NextResponse.json({ ok: true, action: 'delegated', itemId, delegateTo });
      }

      case 'edit': {
        const updates = params?.updates;
        if (!updates) {
          return NextResponse.json(
            { ok: false, error: 'params.updates is required for edit action' },
            { status: 400 }
          );
        }

        if (isTask) {
          updateLocalTask(itemId, updates);
        }
        return NextResponse.json({ ok: true, action: 'edited', itemId });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Unified Actions API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
