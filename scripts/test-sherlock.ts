/**
 * Script: Test Sherlock (Dry Run)
 *
 * Usage: npm run script scripts/test-sherlock.ts
 *
 * Runs the Task Extractor on the last 3 days of lifelogs and prints
 * the results to the console. Does NOT contact Todoist.
 */

process.env.NODE_ENV = 'development';

// Load environment variables from .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDatabase } from '../lib/db/Database';
import { getTaskExtractor } from '../lib/TaskExtractor';
import type { Lifelog } from '../lib/db/types';

async function main() {
  console.log('🕵️ Sherlock Task Analysis - Dry Run');
  console.log('====================================');

  try {
    const db = getDatabase();
    const extractor = getTaskExtractor();

    // Fetch Context (Last 30 Days)
    const days = 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const dateStr = since.toISOString().split('T')[0];

    console.log(`\n📖 Loading context since ${dateStr}...`);
    const logs = db.prepare(`
      SELECT * FROM lifelogs 
      WHERE date >= ? 
      ORDER BY date DESC
    `).all(dateStr) as Lifelog[];

    console.log(`   Found ${logs.length} logs for analysis.`);

    const logSelection = selectLogsForSherlock(logs);
    if (logSelection.filteredOut > 0) {
      console.log(`   Filtered ${logSelection.filteredOut} telemetry/system logs.`);
    }
    const capLabel = Number.isFinite(logSelection.maxLogs) ? logSelection.maxLogs : '∞';
    console.log(
      `   Sending ${logSelection.selected.length} ${logSelection.label} (cap ${capLabel}) to Sherlock...`
    );

    if (logs.length === 0) {
      console.log('   No logs to analyze. Exiting.');
      process.exit(0);
    }

    // Analyze & Extract
    console.log('\n🧠 Analyzing with Grok/Sherlock...');
    const projects = await extractor.extractFromLogs(logSelection.selected);
    
    console.log('\n====================================');
    console.log('         SHERLOCK RESULTS           ');
    console.log('====================================\n');

    if (projects.length === 0) {
        console.log("No actionable projects identified.");
    }

    for (const proj of projects) {
      console.log(`📂 Project: ${proj.name}`);
      console.log(`   Context: ${proj.description}`);
      
      for (const task of proj.tasks) {
        const due = task.due_string ? `(Due: ${task.due_string})` : '';
        const priority = '🚨'.repeat(task.priority - 1) || '⚪';
        console.log(`   - [${priority}] ${task.content} ${due}`);
        if (task.description) {
            console.log(`     Note: ${task.description}`);
        }
      }
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    process.exit(1);
  }
}

function selectLogsForSherlock(logs: Lifelog[]): {
  selected: Lifelog[];
  label: string;
  maxLogs: number;
  filteredOut: number;
} {
  const maxLogs = resolveLogLimit();
  const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const meaningfulLogs = filterMeaningfulLogs(logs);
  const usingFiltered = meaningfulLogs.length > 0;
  const pool = usingFiltered ? meaningfulLogs : logs;
  const filteredOut = usingFiltered ? logs.length - meaningfulLogs.length : 0;

  const lastDay = pool.filter((log) => {
    const ts = getLifelogTimestamp(log);
    return ts ? ts >= cutoffIso : false;
  });

  let selectedLogs: Lifelog[];
  let label: string;

  if (lastDay.length > 0) {
    if (lastDay.length >= maxLogs) {
      selectedLogs = lastDay;
      label = `last 24h ${usingFiltered ? 'lifelogs' : 'logs'}`;
    } else {
      const remaining = maxLogs - lastDay.length;
      const extras = pool.filter((log) => !lastDay.includes(log)).slice(0, remaining);
      selectedLogs = [...lastDay, ...extras];
      label = `last 24h ${usingFiltered ? 'lifelogs' : 'logs'} + recent backfill`;
    }
  } else {
    selectedLogs = pool;
    label = usingFiltered ? 'most recent lifelogs' : 'most recent logs';
  }

  return {
    selected: selectedLogs.slice(0, maxLogs),
    label,
    maxLogs,
    filteredOut,
  };
}

function resolveLogLimit(): number {
  const raw = (process.env.SHERLOCK_LOG_LIMIT || '').trim().toLowerCase();
  if (!raw || raw === 'all' || raw === 'infinite' || raw === 'infinity') {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return Number.POSITIVE_INFINITY;
}

function filterMeaningfulLogs(logs: Lifelog[]): Lifelog[] {
  return logs.filter((log) => !isTelemetryLog(log));
}

function isTelemetryLog(log: Lifelog): boolean {
  const parsed = parseRawJson(log);
  const source = (parsed?.source || '').toLowerCase();
  if (source.startsWith('aavm:logs')) {
    return true;
  }

  const text = (parsed?.text ?? log.title ?? '').trim().toLowerCase();
  const metadata = parsed?.metadata ?? {};
  const hasHttpMeta = metadata.method || metadata.path || metadata.reqId;
  if (text === 'request' && hasHttpMeta) {
    return true;
  }

  return false;
}

function parseRawJson(log: Lifelog): any | null {
  if (!log.raw_json) return null;
  try {
    return JSON.parse(log.raw_json);
  } catch {
    return null;
  }
}

function getLifelogTimestamp(log: Lifelog): string | null {
  if (!log) return null;
  const fallback = log.date ? `${log.date}T00:00:00Z` : null;
  if (!log.raw_json) return fallback;
  try {
    const raw = JSON.parse(log.raw_json);
    return (
      raw?.startTime ||
      raw?.start_time ||
      raw?.timestamp ||
      raw?.created_at ||
      fallback
    );
  } catch {
    return fallback;
  }
}

main();
