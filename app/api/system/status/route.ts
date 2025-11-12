import { NextResponse } from 'next/server';
import { decryptData } from '@/lib/crypto';
import { getMemoryConfig } from '@/lib/MemoryWrapper';

async function getLocalDbStatus() {
  try {
    const { Database } = await import('@/lib/db/Database');
    const db = Database.getInstance().getRawDb() as any;

    const count = (table: string) => (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any).c as number;
    const sel = (sql: string, ...args: any[]) => db.prepare(sql).get(...args) as any;

    const cycles = count('cycles');
    const recoveries = count('recoveries');
    const sleeps = count('sleeps');
    const lifelogs = count('lifelogs');
    const memories = (() => { try { return count('memories'); } catch { return 0; } })();
    const psychSignals = (() => { try { return count('psych_signals'); } catch { return 0; } })();

    const whoopTok = sel(`SELECT expires_at FROM tokens WHERE provider = 'whoop' LIMIT 1`);
    const nowSec = Math.floor(Date.now() / 1000);
    const tokenExpiresAt = whoopTok?.expires_at ?? null;
    const tokenSecondsLeft = tokenExpiresAt ? (tokenExpiresAt - nowSec) : null;

    const s = sel(`SELECT value_enc FROM settings WHERE key = 'limitless_last_pull' LIMIT 1`);
    const limitlessLastPull = s?.value_enc ? decryptData(s.value_enc) : null;

    const latestPsych = (() => {
      try {
        const row = sel(`SELECT date FROM psych_signals ORDER BY date DESC, created_at DESC LIMIT 1`);
        return row?.date ?? null;
      } catch { return null; }
    })();

    const memoryCfg = getMemoryConfig?.() || null;

    return {
      ok: true,
      counts: { cycles, recoveries, sleeps, lifelogs, memories, psych_signals: psychSignals },
      whoop: {
        token: {
          expires_at: tokenExpiresAt,
          seconds_left: tokenSecondsLeft,
          days_left: tokenSecondsLeft != null ? +(tokenSecondsLeft / 86400).toFixed(2) : null,
        },
      },
      limitless: {
        last_pull_date: limitlessLastPull,
      },
      psych: {
        latest_date: latestPsych,
      },
      memory: memoryCfg,
    };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

export async function GET() {
  const base = process.env.AGENTIC_GROK_URL || 'http://localhost:8001';
  const healthUrl = `${base}/api/agentic/health`;
  const dbUrl = `${base}/api/db/status`;

  const out: any = { agentic: null, db: null };
  try {
    const r = await fetch(healthUrl, { cache: 'no-store' });
    out.agentic = await r.json();
  } catch (e: any) {
    out.agentic = { status: 'unavailable', error: String(e) };
  }

  try {
    const r2 = await fetch(dbUrl, { cache: 'no-store' });
    out.db = await r2.json();
  } catch (e: any) {
    out.db = { error: String(e) };
  }

  out.local = await getLocalDbStatus();
  return NextResponse.json(out);
}
