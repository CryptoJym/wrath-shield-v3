/**
 * Wrath Shield v3 - Database Query Helpers
 *
 * Typed query functions and batch upsert helpers for all tables.
 * Uses INSERT ... ON CONFLICT DO UPDATE for idempotent upserts.
 */

import { getDatabase } from './Database';
import { ensureServerOnly } from '../server-only-guard';
import type {
  Cycle,
  CycleInput,
  Recovery,
  RecoveryInput,
  Sleep,
  SleepInput,
  Lifelog,
  LifelogInput,
  Token,
  TokenInput,
  Score,
  ScoreInput,
  Setting,
  SettingInput,
  Flag,
  FlagInput,
  Tweak,
  TweakInput,
  DailyMetrics,
  User,
  UserInput,
  PsychSignal,
  AgenticAction,
  AgenticActionInput,
  UnifiedTask,
  UnifiedTaskInput,
  SynthesisPattern,
  SynthesisPatternInput,
  WorkingMemoryEvent,
  WorkingMemoryEventInput,
} from './types';

// Ensure this module is only used server-side
ensureServerOnly('lib/db/queries');

function hasUserIdColumn(table: string): boolean {
  try {
    const db = getDatabase().getRawDb() as any;
    const rows = db.prepare(`PRAGMA table_info(${table})`).all();
    return Array.isArray(rows) && rows.some((r: any) => r.name === 'user_id');
  } catch {
    return false;
  }
}

// Resolve effective user id from parameter, settings.default_user_id, or 'default'
function resolveUserId(userId?: string): string {
  if (userId && userId.trim() !== '') return userId.trim();
  try {
    const db = getDatabase().getRawDb() as any;
    // Direct read; value may be plain UUID (not encrypted)
    const row = db
      .prepare(`SELECT value_enc FROM settings WHERE key = 'default_user_id' LIMIT 1`)
      .get() as { value_enc: string } | undefined;
    const vid = row?.value_enc?.trim();
    if (vid && /^[0-9a-fA-F-]{36}$/.test(vid)) return vid; // UUID pattern
  } catch { }
  return 'default';
}

/**
 * WHOOP Cycles - Batch Upsert
 */
export function insertCycles(cycles: CycleInput[]): void {
  if (cycles.length === 0) return;

  const db = getDatabase().getRawDb() as any;

  const scoped = hasUserIdColumn('cycles');
  const upsert = scoped
    ? db.prepare(`
      INSERT INTO cycles (id, date, strain, kilojoules, avg_hr, max_hr, user_id)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 'default'))
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        strain = excluded.strain,
        kilojoules = excluded.kilojoules,
        avg_hr = excluded.avg_hr,
        max_hr = excluded.max_hr,
        user_id = COALESCE(excluded.user_id, user_id),
        updated_at = strftime('%s', 'now')
    `)
    : db.prepare(`
      INSERT INTO cycles (id, date, strain, kilojoules, avg_hr, max_hr)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        strain = excluded.strain,
        kilojoules = excluded.kilojoules,
        avg_hr = excluded.avg_hr,
        max_hr = excluded.max_hr,
        updated_at = strftime('%s', 'now')
    `);

  db.transaction(() => {
    for (const cycle of cycles) {
      if (scoped) {
        upsert.run(
          cycle.id,
          cycle.date,
          cycle.strain,
          cycle.kilojoules,
          cycle.avg_hr,
          cycle.max_hr,
          null
        );
      } else {
        upsert.run(
          cycle.id,
          cycle.date,
          cycle.strain,
          cycle.kilojoules,
          cycle.avg_hr,
          cycle.max_hr
        );
      }
    }
  })();
}

/**
 * WHOOP Recoveries - Batch Upsert
 */
export function insertRecoveries(recoveries: RecoveryInput[]): void {
  if (recoveries.length === 0) return;

  const db = getDatabase().getRawDb() as any;

  const scoped = hasUserIdColumn('recoveries');
  const upsert = scoped
    ? db.prepare(`
      INSERT INTO recoveries (id, date, score, hrv, rhr, spo2, skin_temp, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'default'))
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        score = excluded.score,
        hrv = excluded.hrv,
        rhr = excluded.rhr,
        spo2 = excluded.spo2,
        skin_temp = excluded.skin_temp,
        user_id = COALESCE(excluded.user_id, user_id),
        updated_at = strftime('%s', 'now')
    `)
    : db.prepare(`
      INSERT INTO recoveries (id, date, score, hrv, rhr, spo2, skin_temp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        score = excluded.score,
        hrv = excluded.hrv,
        rhr = excluded.rhr,
        spo2 = excluded.spo2,
        skin_temp = excluded.skin_temp,
        updated_at = strftime('%s', 'now')
    `);

  db.transaction(() => {
    for (const recovery of recoveries) {
      if (scoped) {
        upsert.run(
          recovery.id,
          recovery.date,
          recovery.score,
          recovery.hrv,
          recovery.rhr,
          recovery.spo2,
          recovery.skin_temp,
          null
        );
      } else {
        upsert.run(
          recovery.id,
          recovery.date,
          recovery.score,
          recovery.hrv,
          recovery.rhr,
          recovery.spo2,
          recovery.skin_temp
        );
      }
    }
  })();
}

/**
 * WHOOP Sleeps - Batch Upsert
 */
export function insertSleeps(sleeps: SleepInput[]): void {
  if (sleeps.length === 0) return;

  const db = getDatabase().getRawDb() as any;

  const scoped = hasUserIdColumn('sleeps');
  const upsert = scoped
    ? db.prepare(`
      INSERT INTO sleeps (id, date, performance, rem_min, sws_min, light_min, respiration, sleep_debt_min, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'default'))
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        performance = excluded.performance,
        rem_min = excluded.rem_min,
        sws_min = excluded.sws_min,
        light_min = excluded.light_min,
        respiration = excluded.respiration,
        sleep_debt_min = excluded.sleep_debt_min,
        user_id = COALESCE(excluded.user_id, user_id),
        updated_at = strftime('%s', 'now')
    `)
    : db.prepare(`
      INSERT INTO sleeps (id, date, performance, rem_min, sws_min, light_min, respiration, sleep_debt_min)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        performance = excluded.performance,
        rem_min = excluded.rem_min,
        sws_min = excluded.sws_min,
        light_min = excluded.light_min,
        respiration = excluded.respiration,
        sleep_debt_min = excluded.sleep_debt_min,
        updated_at = strftime('%s', 'now')
    `);

  db.transaction(() => {
    for (const sleep of sleeps) {
      if (scoped) {
        upsert.run(
          sleep.id,
          sleep.date,
          sleep.performance,
          sleep.rem_min,
          sleep.sws_min,
          sleep.light_min,
          sleep.respiration,
          sleep.sleep_debt_min,
          null
        );
      } else {
        upsert.run(
          sleep.id,
          sleep.date,
          sleep.performance,
          sleep.rem_min,
          sleep.sws_min,
          sleep.light_min,
          sleep.respiration,
          sleep.sleep_debt_min
        );
      }
    }
  })();
}

/**
 * Get all lifelogs for last N days
 */
export function getLifelogsLastNDays(days: number = 7, userId?: string): Lifelog[] {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('lifelogs');
  const limitDate = dateNDaysAgo(days);

  const query = scoped
    ? db.prepare(`SELECT * FROM lifelogs WHERE date >= ? AND user_id = ? ORDER BY date DESC, created_at DESC`)
    : db.prepare(`SELECT * FROM lifelogs WHERE date >= ? ORDER BY date DESC, created_at DESC`);

  return scoped ? query.all(limitDate, uid) : query.all(limitDate);
}

/**
 * Limitless Lifelogs - Batch Upsert
 */
export function insertLifelogs(lifelogs: LifelogInput[]): void {
  if (lifelogs.length === 0) return;

  const db = getDatabase().getRawDb() as any;
  const scoped = hasUserIdColumn('lifelogs');
  const upsert = scoped ? db.prepare(`
    INSERT INTO lifelogs (id, date, title, manipulation_count, wrath_deployed, raw_json, user_id)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 'default'))
    ON CONFLICT(id) DO UPDATE SET
      date = excluded.date,
      title = excluded.title,
      manipulation_count = excluded.manipulation_count,
      wrath_deployed = excluded.wrath_deployed,
      raw_json = excluded.raw_json,
      user_id = COALESCE(excluded.user_id, user_id),
      updated_at = strftime('%s', 'now')
  `) : db.prepare(`
    INSERT INTO lifelogs (id, date, title, manipulation_count, wrath_deployed, raw_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      date = excluded.date,
      title = excluded.title,
      manipulation_count = excluded.manipulation_count,
      wrath_deployed = excluded.wrath_deployed,
      raw_json = excluded.raw_json,
      updated_at = strftime('%s', 'now')
  `);

  db.transaction(() => {
    for (const lifelog of lifelogs) {
      if (scoped) {
        upsert.run(
          lifelog.id,
          lifelog.date,
          lifelog.title,
          lifelog.manipulation_count,
          lifelog.wrath_deployed,
          lifelog.raw_json,
          null
        );
      } else {
        upsert.run(
          lifelog.id,
          lifelog.date,
          lifelog.title,
          lifelog.manipulation_count,
          lifelog.wrath_deployed,
          lifelog.raw_json
        );
      }
    }
  })();
}

/** Explicit user-scoped lifelog insert */
export function insertLifelogsForUser(lifelogs: LifelogInput[], userId?: string): void {
  if (lifelogs.length === 0) return;
  const uid = resolveUserId(userId);
  const db = getDatabase().getRawDb() as any;
  const upsert = db.prepare(`
    INSERT INTO lifelogs (id, date, title, manipulation_count, wrath_deployed, raw_json, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      date = excluded.date,
      title = excluded.title,
      manipulation_count = excluded.manipulation_count,
      wrath_deployed = excluded.wrath_deployed,
      raw_json = excluded.raw_json,
      user_id = excluded.user_id,
      updated_at = strftime('%s', 'now')
  `);
  db.transaction(() => {
    for (const lifelog of lifelogs) {
      upsert.run(
        lifelog.id,
        lifelog.date,
        lifelog.title,
        lifelog.manipulation_count,
        lifelog.wrath_deployed,
        lifelog.raw_json,
        uid
      );
    }
  })();
}

/**
 * OAuth Tokens - Batch Upsert
 */
export function insertTokens(tokens: TokenInput[]): void {
  if (tokens.length === 0) return;

  const db = getDatabase().getRawDb() as any;
  const uidDefault = resolveUserId();
  const scoped = hasUserIdColumn('tokens');
  const upsert = scoped
    ? db.prepare(`
      INSERT INTO tokens (provider, access_token_enc, refresh_token_enc, expires_at, user_id)
      VALUES (?, ?, ?, ?, COALESCE(?, 'default'))
      ON CONFLICT(provider, user_id) DO UPDATE SET
        access_token_enc = excluded.access_token_enc,
        refresh_token_enc = excluded.refresh_token_enc,
        expires_at = excluded.expires_at,
        updated_at = strftime('%s', 'now')
    `)
    : db.prepare(`
      INSERT INTO tokens (provider, access_token_enc, refresh_token_enc, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        access_token_enc = excluded.access_token_enc,
        refresh_token_enc = excluded.refresh_token_enc,
        expires_at = excluded.expires_at,
        updated_at = strftime('%s', 'now')
    `);

  db.transaction(() => {
    for (const token of tokens) {
      if (scoped) {
        upsert.run(
          token.provider,
          token.access_token_enc,
          token.refresh_token_enc,
          token.expires_at,
          uidDefault
        );
      } else {
        upsert.run(
          token.provider,
          token.access_token_enc,
          token.refresh_token_enc,
          token.expires_at
        );
      }
    }
  })();
}

export function insertTokensForUser(tokens: TokenInput[], userId?: string): void {
  if (tokens.length === 0) return;
  const uid = resolveUserId(userId);
  const db = getDatabase().getRawDb() as any;
  const upsert = db.prepare(`
    INSERT INTO tokens (provider, access_token_enc, refresh_token_enc, expires_at, user_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(provider, user_id) DO UPDATE SET
      access_token_enc = excluded.access_token_enc,
      refresh_token_enc = excluded.refresh_token_enc,
      expires_at = excluded.expires_at,
      updated_at = strftime('%s', 'now')
  `);
  db.transaction(() => {
    for (const token of tokens) {
      upsert.run(
        token.provider,
        token.access_token_enc,
        token.refresh_token_enc,
        token.expires_at,
        uid
      );
    }
  })();
}

/**
 * Daily Scores - Batch Upsert
 */
export function insertScores(scores: ScoreInput[]): void {
  if (scores.length === 0) return;

  const db = getDatabase().getRawDb() as any;
  const scoped = hasUserIdColumn('scores');
  const upsert = scoped
    ? db.prepare(`
      INSERT INTO scores (date, unbending_score, recovery_compliance, user_id)
      VALUES (?, ?, ?, COALESCE(?, 'default'))
      ON CONFLICT(date) DO UPDATE SET
        unbending_score = excluded.unbending_score,
        recovery_compliance = excluded.recovery_compliance,
        user_id = COALESCE(excluded.user_id, user_id),
        updated_at = strftime('%s', 'now')
    `)
    : db.prepare(`
      INSERT INTO scores (date, unbending_score, recovery_compliance)
      VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        unbending_score = excluded.unbending_score,
        recovery_compliance = excluded.recovery_compliance,
        updated_at = strftime('%s', 'now')
    `);

  db.transaction(() => {
    for (const score of scores) {
      if (scoped) {
        upsert.run(score.date, score.unbending_score, score.recovery_compliance, null);
      } else {
        upsert.run(score.date, score.unbending_score, score.recovery_compliance);
      }
    }
  })();
}

export function insertScoresForUser(scores: ScoreInput[], userId?: string): void {
  if (scores.length === 0) return;
  const uid = resolveUserId(userId);
  const db = getDatabase().getRawDb() as any;
  const upsert = db.prepare(`
    INSERT INTO scores (date, unbending_score, recovery_compliance, user_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      unbending_score = excluded.unbending_score,
      recovery_compliance = excluded.recovery_compliance,
      user_id = excluded.user_id,
      updated_at = strftime('%s', 'now')
  `);
  db.transaction(() => {
    for (const score of scores) {
      upsert.run(score.date, score.unbending_score, score.recovery_compliance, uid);
    }
  })();
}

/**
 * Settings - Batch Upsert
 */
export function insertSettings(settings: SettingInput[]): void {
  if (settings.length === 0) return;

  const db = getDatabase().getRawDb() as any;
  const uidDefault = resolveUserId();
  const scoped = hasUserIdColumn('settings');
  const upsert = scoped
    ? db.prepare(`
      INSERT INTO settings (key, value_enc, user_id)
      VALUES (?, ?, COALESCE(?, 'default'))
      ON CONFLICT(key, user_id) DO UPDATE SET
        value_enc = excluded.value_enc,
        updated_at = strftime('%s', 'now')
    `)
    : db.prepare(`
      INSERT INTO settings (key, value_enc)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_enc = excluded.value_enc,
        updated_at = strftime('%s', 'now')
    `);

  db.transaction(() => {
    for (const setting of settings) {
      if (scoped) {
        upsert.run(setting.key, setting.value_enc, uidDefault);
      } else {
        upsert.run(setting.key, setting.value_enc);
      }
    }
  })();
}

export function insertSettingsForUser(settings: SettingInput[], userId?: string): void {
  if (settings.length === 0) return;
  const uid = resolveUserId(userId);
  const db = getDatabase().getRawDb() as any;
  const upsert = db.prepare(`
    INSERT INTO settings (key, value_enc, user_id)
    VALUES (?, ?, ?)
    ON CONFLICT(key, user_id) DO UPDATE SET
      value_enc = excluded.value_enc,
      updated_at = strftime('%s', 'now')
  `);
  db.transaction(() => {
    for (const setting of settings) {
      upsert.run(setting.key, setting.value_enc, uid);
    }
  })();
}

/**
 * Flags (Burst Forge) - Batch Upsert
 */
export function insertFlags(flags: FlagInput[]): void {
  if (flags.length === 0) return;

  const db = getDatabase().getRawDb() as any;

  const upsert = db.prepare(`
    INSERT INTO flags (id, status, original_text, detected_at, severity, manipulation_type)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      original_text = excluded.original_text,
      detected_at = excluded.detected_at,
      severity = excluded.severity,
      manipulation_type = excluded.manipulation_type,
      updated_at = strftime('%s', 'now')
  `);

  db.transaction(() => {
    for (const flag of flags) {
      upsert.run(
        flag.id,
        flag.status,
        flag.original_text,
        flag.detected_at,
        flag.severity,
        flag.manipulation_type
      );
    }
  })();
}

/**
 * Tweaks (Burst Forge) - Batch Upsert
 */
export function insertTweaks(tweaks: TweakInput[]): void {
  if (tweaks.length === 0) return;

  const db = getDatabase().getRawDb() as any;

  const upsert = db.prepare(`
    INSERT INTO tweaks (id, flag_id, assured_text, action_type, context, delta_uix, user_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      flag_id = excluded.flag_id,
      assured_text = excluded.assured_text,
      action_type = excluded.action_type,
      context = excluded.context,
      delta_uix = excluded.delta_uix,
      user_notes = excluded.user_notes,
      updated_at = strftime('%s', 'now')
  `);

  db.transaction(() => {
    for (const tweak of tweaks) {
      upsert.run(
        tweak.id,
        tweak.flag_id,
        tweak.assured_text,
        tweak.action_type,
        tweak.context,
        tweak.delta_uix,
        tweak.user_notes
      );
    }
  })();
}

/**
 * Get metrics for last N days (defaults to 7)
 */
export function getMetricsLastNDays(days: number = 7, userId?: string): DailyMetrics[] {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);

  const scoped = hasUserIdColumn('cycles');
  const query = db.prepare(`
    SELECT
      COALESCE(c.date, r.date, s.date, l.date, sc.date) as date,
      c.strain,
      r.score as recovery_score,
      s.performance as sleep_performance,
      COALESCE(l.manipulation_count, 0) as manipulation_count,
      COALESCE(l.wrath_deployed, 0) as wrath_deployed,
      sc.unbending_score
    FROM (
      SELECT DISTINCT date FROM (
        SELECT date FROM cycles
        UNION SELECT date FROM recoveries
        UNION SELECT date FROM sleeps
        UNION SELECT date FROM lifelogs
        UNION SELECT date FROM scores
      ) ORDER BY date DESC LIMIT ?
    ) dates
    LEFT JOIN cycles c ON dates.date = c.date ${scoped ? 'AND c.user_id = ?' : ''}
    LEFT JOIN recoveries r ON dates.date = r.date ${scoped ? 'AND r.user_id = ?' : ''}
    LEFT JOIN sleeps s ON dates.date = s.date ${scoped ? 'AND s.user_id = ?' : ''}
    LEFT JOIN lifelogs l ON dates.date = l.date ${scoped ? 'AND l.user_id = ?' : ''}
    LEFT JOIN scores sc ON dates.date = sc.date ${scoped ? 'AND sc.user_id = ?' : ''}
    ORDER BY date DESC
  `);

  return (scoped ? query.all(days, uid, uid, uid, uid, uid) : query.all(days)) as DailyMetrics[];
}

/**
 * Get latest recovery data
 */
export function getLatestRecovery(userId?: string): Recovery | null {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('recoveries');
  const query = scoped
    ? db.prepare(`SELECT * FROM recoveries WHERE user_id = ? ORDER BY date DESC LIMIT 1`)
    : db.prepare(`SELECT * FROM recoveries ORDER BY date DESC LIMIT 1`);
  return scoped ? (query.get(uid) || null) : (query.get() || null);
}

/**
 * Get latest cycle data
 */
export function getLatestCycle(userId?: string): Cycle | null {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('cycles');
  const query = scoped
    ? db.prepare(`SELECT * FROM cycles WHERE user_id = ? ORDER BY date DESC LIMIT 1`)
    : db.prepare(`SELECT * FROM cycles ORDER BY date DESC LIMIT 1`);
  return scoped ? (query.get(uid) || null) : (query.get() || null);
}

/**
 * Get latest sleep data
 */
export function getLatestSleep(userId?: string): Sleep | null {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('sleeps');
  const query = scoped
    ? db.prepare(`SELECT * FROM sleeps WHERE user_id = ? ORDER BY date DESC LIMIT 1`)
    : db.prepare(`SELECT * FROM sleeps ORDER BY date DESC LIMIT 1`);
  return scoped ? (query.get(uid) || null) : (query.get() || null);
}

/**
 * Get recovery scores for last N days (descending)
 */
export function getRecoveriesLastNDays(days: number = 14, userId?: string): Recovery[] {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('recoveries');
  const query = scoped
    ? db.prepare(`SELECT * FROM recoveries WHERE user_id = ? ORDER BY date DESC LIMIT ?`)
    : db.prepare(`SELECT * FROM recoveries ORDER BY date DESC LIMIT ?`);
  return scoped ? query.all(uid, days) : query.all(days);
}

function dateNDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

export function getBaselines(days: number = 30, userId?: string) {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const start = dateNDaysAgo(days);
  const end = new Date().toISOString().slice(0, 10);
  const scopedRec = hasUserIdColumn('recoveries');
  const scopedSleep = hasUserIdColumn('sleeps');

  const recRow = scopedRec
    ? db.prepare(
      `SELECT AVG(hrv) as avg_hrv, AVG(rhr) as avg_rhr, AVG(score) as avg_score, COUNT(*) as n FROM recoveries WHERE date >= ? AND date <= ? AND user_id = ?`
    ).get(start, end, uid)
    : db.prepare(
      `SELECT AVG(hrv) as avg_hrv, AVG(rhr) as avg_rhr, AVG(score) as avg_score, COUNT(*) as n FROM recoveries WHERE date >= ? AND date <= ?`
    ).get(start, end);

  const slpRow = scopedSleep
    ? db.prepare(
      `SELECT AVG(performance) as avg_perf, COUNT(*) as n FROM sleeps WHERE date >= ? AND date <= ? AND user_id = ?`
    ).get(start, end, uid)
    : db.prepare(
      `SELECT AVG(performance) as avg_perf, COUNT(*) as n FROM sleeps WHERE date >= ? AND date <= ?`
    ).get(start, end);

  const distRow = scopedRec
    ? db.prepare(
      `SELECT 
            SUM(CASE WHEN score >= 70 THEN 1 ELSE 0 END) as high,
            SUM(CASE WHEN score >= 40 AND score < 70 THEN 1 ELSE 0 END) as med,
            SUM(CASE WHEN score < 40 THEN 1 ELSE 0 END) as low
         FROM recoveries WHERE date >= ? AND date <= ? AND user_id = ?`
    ).get(start, end, uid)
    : db.prepare(
      `SELECT 
            SUM(CASE WHEN score >= 70 THEN 1 ELSE 0 END) as high,
            SUM(CASE WHEN score >= 40 AND score < 70 THEN 1 ELSE 0 END) as med,
            SUM(CASE WHEN score < 40 THEN 1 ELSE 0 END) as low
         FROM recoveries WHERE date >= ? AND date <= ?`
    ).get(start, end);

  return {
    window_days: days,
    avg_hrv: recRow?.avg_hrv ?? null,
    avg_rhr: recRow?.avg_rhr ?? null,
    avg_recovery: recRow?.avg_score ?? null,
    avg_sleep_performance: slpRow?.avg_perf ?? null,
    n_recoveries: recRow?.n ?? 0,
    n_sleeps: slpRow?.n ?? 0,
    recovery_distribution: { high: distRow?.high ?? 0, medium: distRow?.med ?? 0, low: distRow?.low ?? 0 },
  };
}

export function getTodaySnapshot(userId?: string) {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const today = new Date().toISOString().slice(0, 10);
  const scopedRec = hasUserIdColumn('recoveries');
  const scopedSleep = hasUserIdColumn('sleeps');
  const rec = scopedRec
    ? db.prepare(`SELECT * FROM recoveries WHERE date = ? AND user_id = ? LIMIT 1`).get(today, uid)
    : db.prepare(`SELECT * FROM recoveries WHERE date = ? LIMIT 1`).get(today);
  const slp = scopedSleep
    ? db.prepare(`SELECT * FROM sleeps WHERE date = ? AND user_id = ? LIMIT 1`).get(today, uid)
    : db.prepare(`SELECT * FROM sleeps WHERE date = ? LIMIT 1`).get(today);
  return { today, recovery: rec || null, sleep: slp || null };
}

/**
 * Get OAuth token for a provider
 */
export function getToken(provider: 'whoop' | 'limitless', userId?: string): Token | null {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('tokens');
  if (scoped) {
    const q = db.prepare(`SELECT * FROM tokens WHERE provider = ? AND user_id = ?`);
    const row = q.get(provider, uid) as Token | undefined;
    if (row) return row;
    // Fallback to 'default' user scope if specific not found
    if (uid !== 'default') {
      const r2 = q.get(provider, 'default') as Token | undefined;
      if (r2) return r2;
    }
    return null;
  } else {
    const q = db.prepare(`SELECT * FROM tokens WHERE provider = ?`);
    return (q.get(provider) as Token | undefined) || null;
  }
}

/**
 * Get setting by key
 */
export function getSetting(key: string, userId?: string): Setting | null {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('settings');
  const query = scoped
    ? db.prepare(`SELECT * FROM settings WHERE key = ? AND user_id = ?`)
    : db.prepare(`SELECT * FROM settings WHERE key = ?`);
  return scoped ? (query.get(key, uid) || null) : (query.get(key) || null);
}

/**
 * Get all lifelogs for a specific date
 */
export function getLifelogsForDate(date: string, userId?: string): Lifelog[] {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('lifelogs');
  const query = scoped
    ? db.prepare(`SELECT * FROM lifelogs WHERE date = ? AND user_id = ? ORDER BY created_at DESC`)
    : db.prepare(`SELECT * FROM lifelogs WHERE date = ? ORDER BY created_at DESC`);
  return scoped ? query.all(date, uid) : query.all(date);
}

/**
 * Get unbending score for a date range
 */
export function getUnbendingScores(startDate: string, endDate: string, userId?: string): Score[] {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('scores');
  const query = scoped
    ? db.prepare(`SELECT * FROM scores WHERE date >= ? AND date <= ? AND user_id = ? ORDER BY date DESC`)
    : db.prepare(`SELECT * FROM scores WHERE date >= ? AND date <= ? ORDER BY date DESC`);
  return scoped ? query.all(startDate, endDate, uid) : query.all(startDate, endDate);
}

/**
 * Calculate and insert unbending score for a specific date
 */
export function calculateUnbendingScore(date: string, userId?: string): number | null {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('lifelogs');

  const stmt = db.prepare(
    `SELECT SUM(manipulation_count) as manipulation_count, SUM(wrath_deployed) as wrath_deployed FROM lifelogs WHERE date = ? ${scoped ? 'AND user_id = ?' : ''}`
  );
  const stats = scoped
    ? stmt.get(date, uid) as { manipulation_count: number; wrath_deployed: number }
    : stmt.get(date) as { manipulation_count: number; wrath_deployed: number };

  if (!stats || stats.manipulation_count === 0) {
    if (hasUserIdColumn('scores')) {
      insertScoresForUser([{ date, unbending_score: null, recovery_compliance: null }], uid);
    } else {
      insertScores([{ date, unbending_score: null, recovery_compliance: null }]);
    }
    return null;
  }

  const unbendingScore = (stats.wrath_deployed / stats.manipulation_count) * 100;
  if (hasUserIdColumn('scores')) {
    insertScoresForUser([{ date, unbending_score: unbendingScore, recovery_compliance: null }], uid);
  } else {
    insertScores([{ date, unbending_score: unbendingScore, recovery_compliance: null }]);
  }
  return unbendingScore;
}

/**
 * Get flag by ID (Burst Forge)
 */
export function getFlag(id: string): Flag | null {
  const db = getDatabase().getRawDb() as any;
  const query = db.prepare(`
    SELECT * FROM flags WHERE id = ?
  `);
  return query.get(id) || null;
}

/**
 * Get all tweaks for a specific flag (Burst Forge)
 */
export function getTweaksByFlagId(flagId: string): Tweak[] {
  const db = getDatabase().getRawDb() as any;
  const query = db.prepare(`
    SELECT * FROM tweaks WHERE flag_id = ? ORDER BY created_at DESC
  `);
  return query.all(flagId);
}

/**
 * Update flag status (Burst Forge)
 */
export function updateFlagStatus(id: string, status: 'pending' | 'resolved' | 'dismissed'): void {
  const db = getDatabase().getRawDb() as any;
  const update = db.prepare(`
    UPDATE flags
    SET status = ?, updated_at = strftime('%s', 'now')
    WHERE id = ?
  `);
  update.run(status, id);
}

/**
 * Get all pending flags (Burst Forge)
 */
export function getPendingFlags(): Flag[] {
  const db = getDatabase().getRawDb() as any;
  const query = db.prepare(`
    SELECT * FROM flags WHERE status = 'pending' ORDER BY detected_at DESC
  `);
  return query.all();
}

/**
 * Get resolved flags (for FlagRadar visualization)
 */
export function getResolvedFlags(): Flag[] {
  const db = getDatabase().getRawDb() as any;
  const query = db.prepare(`
    SELECT * FROM flags WHERE status = 'resolved' ORDER BY detected_at DESC
  `);
  return query.all();
}

/**
 * Users - Create new user profile
 */
export function createUser(input: Omit<UserInput, 'id'> & { id: string }): void {
  const db = getDatabase().getRawDb() as any;
  const insert = db.prepare(`
    INSERT INTO users (id, email, name, timezone)
    VALUES (?, ?, ?, ?)
  `);
  insert.run(input.id, input.email ?? null, input.name ?? null, input.timezone ?? null);
}

/**
 * Users - Update existing user profile
 */
export function updateUser(id: string, updates: Partial<Omit<UserInput, 'id'>>): void {
  const db = getDatabase().getRawDb() as any;
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.timezone !== undefined) { fields.push('timezone = ?'); values.push(updates.timezone); }
  if (fields.length === 0) return;
  const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = strftime('%s', 'now') WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values, id);
}

/**
 * Users - Get a user by id
 */
export function getUser(id: string): User | null {
  const db = getDatabase().getRawDb() as any;
  const query = db.prepare(`SELECT * FROM users WHERE id = ?`);
  return query.get(id) || null;
}

/**
 * Users - List users
 */
export function listUsers(limit: number = 50, offset: number = 0): User[] {
  const db = getDatabase().getRawDb() as any;
  const query = db.prepare(`SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`);
  return query.all(limit, offset);
}

/**
 * Get total UIX score (sum of all delta_uix values from tweaks)
 */
export function getTotalUIXScore(): number {
  const db = getDatabase().getRawDb() as any;
  const query = db.prepare(`
    SELECT SUM(delta_uix) as total FROM tweaks
  `);
  const result = query.get();
  return result?.total ?? 0;
}

/**
 * Get all tweaks from the last N hours (for metrics calculation)
 */
export function getTweaksLastNHours(hours: number = 72): Tweak[] {
  const db = getDatabase().getRawDb() as any;
  const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;

  const query = db.prepare(`
    SELECT * FROM tweaks
    WHERE created_at >= ?
    ORDER BY created_at DESC
  `);
  return query.all(cutoff);
}

/**
 * Get all flags (not just pending)
 */
export function getAllFlags(): Flag[] {
  const db = getDatabase().getRawDb() as any;
  const query = db.prepare(`
    SELECT * FROM flags ORDER BY detected_at DESC
  `);
  return query.all();
}

/** Psych Signals - Get latest summary */
export function getLatestPsychSignal(userId?: string): PsychSignal | null {
  const db = getDatabase().getRawDb() as any;
  const uid = resolveUserId(userId);
  // Check if table exists
  try {
    const chk = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='psych_signals'`).get();
    if (!chk) return null;
  } catch {
    return null;
  }
  const scoped = hasUserIdColumn('psych_signals');
  const query = scoped
    ? db.prepare(`SELECT * FROM psych_signals WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 1`)
    : db.prepare(`SELECT * FROM psych_signals ORDER BY date DESC, created_at DESC LIMIT 1`);
  return scoped ? (query.get(uid) || null) : (query.get() || null);
}

/** Psych Signals - Last N days (descending) */
export function getPsychSignalsLastNDays(days: number = 14, userId?: string): PsychSignal[] {
  const db = getDatabase().getRawDb() as any;
  // Table existence check
  try {
    const chk = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='psych_signals'`).get();
    if (!chk) return [];
  } catch {
    return [];
  }
  const uid = resolveUserId(userId);
  const scoped = hasUserIdColumn('psych_signals');
  const query = scoped
    ? db.prepare(
      `SELECT * FROM psych_signals WHERE user_id = ? ORDER BY date DESC LIMIT ?`
    )
    : db.prepare(
      `SELECT * FROM psych_signals ORDER BY date DESC LIMIT ?`
    );
  return scoped ? query.all(uid, days) : query.all(days);
}

// ---------------------------------------------------------------------------
// Agentic Actions (EA automation outputs)
// ---------------------------------------------------------------------------

function hasAgenticTable(): boolean {
  try {
    const db = getDatabase().getRawDb() as any;
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='agentic_actions'`).get();
    return !!row;
  } catch {
    return false;
  }
}

export function insertAgenticActions(actions: AgenticActionInput[]): void {
  if (actions.length === 0 || !hasAgenticTable()) return;
  const db = getDatabase().getRawDb() as any;
  const uidDefault = resolveUserId();
  const stmt = db.prepare(`
    INSERT INTO agentic_actions (id, user_id, type, target, title, content, confidence, status, source, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      type = excluded.type,
      target = excluded.target,
      title = excluded.title,
      content = excluded.content,
      confidence = excluded.confidence,
      status = excluded.status,
      source = excluded.source,
      metadata = excluded.metadata,
      updated_at = strftime('%s','now')
  `);
  db.transaction(() => {
    for (const a of actions) {
      stmt.run(
        a.id,
        a.user_id || uidDefault,
        a.type,
        a.target ?? null,
        a.title ?? null,
        a.content,
        a.confidence ?? null,
        a.status || 'proposed',
        a.source ?? null,
        a.metadata ?? null
      );
    }
  })();
}

export function listAgenticActions(opts: { status?: AgenticAction['status']; limit?: number; userId?: string; allUsers?: boolean } = {}): AgenticAction[] {
  if (!hasAgenticTable()) return [];
  const db = getDatabase().getRawDb() as any;
  const { status, limit = 50, allUsers = false } = opts;
  const uid = resolveUserId(opts.userId);
  const scoped = hasUserIdColumn('agentic_actions') && !allUsers;
  if (status) {
    const query = scoped
      ? db.prepare(`SELECT * FROM agentic_actions WHERE status = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?`)
      : db.prepare(`SELECT * FROM agentic_actions WHERE status = ? ORDER BY created_at DESC LIMIT ?`);
    return scoped ? query.all(status, uid, limit) : query.all(status, limit);
  }
  const query = scoped
    ? db.prepare(`SELECT * FROM agentic_actions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
    : db.prepare(`SELECT * FROM agentic_actions ORDER BY created_at DESC LIMIT ?`);
  return scoped ? query.all(uid, limit) : query.all(limit);
}

export function getAgenticActionById(id: string): AgenticAction | null {
  if (!hasAgenticTable()) return null;
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`SELECT * FROM agentic_actions WHERE id = ?`);
  return stmt.get(id) || null;
}

export function updateAgenticActionStatus(id: string, status: AgenticAction['status']): void {
  if (!hasAgenticTable()) return;
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`UPDATE agentic_actions SET status = ?, updated_at = strftime('%s','now') WHERE id = ?`);
  stmt.run(status, id);
}

export function updateAgenticActionStatusWithMeta(
  id: string,
  status: AgenticAction['status'],
  metadata?: Record<string, any>
): void {
  if (!hasAgenticTable()) return;
  const db = getDatabase().getRawDb() as any;
  const metaJson = metadata ? JSON.stringify(metadata) : null;
  const stmt = db.prepare(
    `UPDATE agentic_actions SET status = ?, metadata = COALESCE(?, metadata), updated_at = strftime('%s','now') WHERE id = ?`
  );
  stmt.run(status, metaJson, id);
}

// ---------------------------------------------------------------------------
// Cognitive Synthesis Engine
// ---------------------------------------------------------------------------

function hasSynthesisTable(tableName: string): boolean {
  try {
    const db = getDatabase().getRawDb() as any;
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Working Memory Events - Insert new event
 */
export function insertWorkingMemoryEvent(event: WorkingMemoryEventInput): void {
  if (!hasSynthesisTable('working_memory_events')) return;
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    INSERT INTO working_memory_events (
      id, source, timestamp, content, content_hash, embedding_json,
      initial_classification, processed_by_synthesis, synthesis_task_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      timestamp = excluded.timestamp,
      content = excluded.content,
      content_hash = excluded.content_hash,
      embedding_json = excluded.embedding_json,
      initial_classification = excluded.initial_classification,
      processed_by_synthesis = excluded.processed_by_synthesis,
      synthesis_task_id = excluded.synthesis_task_id
  `);
  stmt.run(
    event.id,
    event.source,
    event.timestamp,
    event.content,
    event.content_hash,
    event.embedding_json ?? null,
    event.initial_classification ?? null,
    event.processed_by_synthesis,
    event.synthesis_task_id ?? null
  );
}

/**
 * Working Memory Events - Batch insert
 */
export function insertWorkingMemoryEvents(events: WorkingMemoryEventInput[]): void {
  if (events.length === 0 || !hasSynthesisTable('working_memory_events')) return;
  const db = getDatabase().getRawDb() as any;
  db.transaction(() => {
    for (const event of events) {
      insertWorkingMemoryEvent(event);
    }
  })();
}

/**
 * Working Memory Events - Get unprocessed events
 */
export function getUnprocessedEvents(limit: number = 100): WorkingMemoryEvent[] {
  if (!hasSynthesisTable('working_memory_events')) return [];
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    SELECT * FROM working_memory_events
    WHERE processed_by_synthesis = 0
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

/**
 * Working Memory Events - Get events by source
 */
export function getEventsBySource(source: string, limit: number = 50): WorkingMemoryEvent[] {
  if (!hasSynthesisTable('working_memory_events')) return [];
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    SELECT * FROM working_memory_events
    WHERE source = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(source, limit);
}

/**
 * Working Memory Events - Mark as processed
 */
export function markEventProcessed(eventId: string, taskId?: string): void {
  if (!hasSynthesisTable('working_memory_events')) return;
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    UPDATE working_memory_events
    SET processed_by_synthesis = 1, synthesis_task_id = ?
    WHERE id = ?
  `);
  stmt.run(taskId ?? null, eventId);
}

/**
 * Working Memory Events - Check for duplicate by hash
 */
export function findEventByHash(contentHash: string): WorkingMemoryEvent | null {
  if (!hasSynthesisTable('working_memory_events')) return null;
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    SELECT * FROM working_memory_events
    WHERE content_hash = ?
    LIMIT 1
  `);
  return stmt.get(contentHash) || null;
}

/**
 * Unified Tasks - Insert new task
 */
export function insertUnifiedTask(task: UnifiedTaskInput): void {
  if (!hasSynthesisTable('unified_tasks')) return;
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    INSERT INTO unified_tasks (
      id, title, description, confidence, urgency, domain,
      source_events_json, proposed_action_json, status,
      last_refined_at, refinement_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      confidence = excluded.confidence,
      urgency = excluded.urgency,
      domain = excluded.domain,
      source_events_json = excluded.source_events_json,
      proposed_action_json = excluded.proposed_action_json,
      status = excluded.status,
      last_refined_at = excluded.last_refined_at,
      refinement_count = excluded.refinement_count,
      updated_at = strftime('%s', 'now')
  `);
  stmt.run(
    task.id,
    task.title,
    task.description ?? null,
    task.confidence,
    task.urgency,
    task.domain ?? null,
    task.source_events_json ?? null,
    task.proposed_action_json ?? null,
    task.status,
    task.last_refined_at ?? null,
    task.refinement_count
  );
}

/**
 * Unified Tasks - Get by status
 */
export function getUnifiedTasksByStatus(
  status: UnifiedTask['status'],
  limit: number = 50
): UnifiedTask[] {
  if (!hasSynthesisTable('unified_tasks')) return [];
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    SELECT * FROM unified_tasks
    WHERE status = ?
    ORDER BY urgency, confidence DESC, created_at DESC
    LIMIT ?
  `);
  return stmt.all(status, limit);
}

/**
 * Unified Tasks - Get by domain
 */
export function getUnifiedTasksByDomain(domain: string, limit: number = 50): UnifiedTask[] {
  if (!hasSynthesisTable('unified_tasks')) return [];
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    SELECT * FROM unified_tasks
    WHERE domain = ?
    ORDER BY status, urgency, confidence DESC
    LIMIT ?
  `);
  return stmt.all(domain, limit);
}

/**
 * Unified Tasks - Update status
 */
export function updateUnifiedTaskStatus(id: string, status: UnifiedTask['status']): void {
  if (!hasSynthesisTable('unified_tasks')) return;
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    UPDATE unified_tasks
    SET status = ?, updated_at = strftime('%s', 'now')
    WHERE id = ?
  `);
  stmt.run(status, id);
}

/**
 * Unified Tasks - Increment refinement count
 */
export function refineUnifiedTask(id: string, newConfidence?: number): void {
  if (!hasSynthesisTable('unified_tasks')) return;
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    UPDATE unified_tasks
    SET refinement_count = refinement_count + 1,
        last_refined_at = strftime('%s', 'now'),
        confidence = COALESCE(?, confidence),
        updated_at = strftime('%s', 'now')
    WHERE id = ?
  `);
  stmt.run(newConfidence ?? null, id);
}

/**
 * Unified Tasks - Get task by ID
 */
export function getUnifiedTaskById(id: string): UnifiedTask | null {
  if (!hasSynthesisTable('unified_tasks')) return null;
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`SELECT * FROM unified_tasks WHERE id = ?`);
  return stmt.get(id) || null;
}

/**
 * Synthesis Patterns - Insert new pattern
 */
export function insertSynthesisPattern(pattern: SynthesisPatternInput): void {
  if (!hasSynthesisTable('synthesis_patterns')) return;
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    INSERT INTO synthesis_patterns (
      id, pattern_type, description, trigger_conditions,
      suggested_behavior, success_rate, usage_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      pattern_type = excluded.pattern_type,
      description = excluded.description,
      trigger_conditions = excluded.trigger_conditions,
      suggested_behavior = excluded.suggested_behavior,
      success_rate = excluded.success_rate,
      usage_count = excluded.usage_count,
      updated_at = strftime('%s', 'now')
  `);
  stmt.run(
    pattern.id,
    pattern.pattern_type,
    pattern.description,
    pattern.trigger_conditions ?? null,
    pattern.suggested_behavior ?? null,
    pattern.success_rate,
    pattern.usage_count
  );
}

/**
 * Synthesis Patterns - Get by type
 */
export function getSynthesisPatternsByType(
  patternType: SynthesisPattern['pattern_type']
): SynthesisPattern[] {
  if (!hasSynthesisTable('synthesis_patterns')) return [];
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    SELECT * FROM synthesis_patterns
    WHERE pattern_type = ?
    ORDER BY success_rate DESC, usage_count DESC
  `);
  return stmt.all(patternType);
}

/**
 * Synthesis Patterns - Increment usage and update success rate
 */
export function updatePatternMetrics(id: string, success: boolean): void {
  if (!hasSynthesisTable('synthesis_patterns')) return;
  const db = getDatabase().getRawDb() as any;

  // Get current metrics
  const current = db.prepare(`SELECT usage_count, success_rate FROM synthesis_patterns WHERE id = ?`).get(id) as { usage_count: number; success_rate: number } | undefined;

  if (!current) return;

  // Calculate new success rate using running average
  const newUsageCount = current.usage_count + 1;
  const newSuccessRate = ((current.success_rate * current.usage_count) + (success ? 1 : 0)) / newUsageCount;

  const stmt = db.prepare(`
    UPDATE synthesis_patterns
    SET usage_count = ?,
        success_rate = ?,
        updated_at = strftime('%s', 'now')
    WHERE id = ?
  `);
  stmt.run(newUsageCount, newSuccessRate, id);
}

/**
 * Synthesis Patterns - Get all patterns
 */
export function getAllSynthesisPatterns(): SynthesisPattern[] {
  if (!hasSynthesisTable('synthesis_patterns')) return [];
  const db = getDatabase().getRawDb() as any;
  const stmt = db.prepare(`
    SELECT * FROM synthesis_patterns
    ORDER BY success_rate DESC, usage_count DESC
  `);
  return stmt.all();
}
