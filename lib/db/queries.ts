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
} from './types';

// Ensure this module is only used server-side
ensureServerOnly('lib/db/queries');

/**
 * WHOOP Cycles - Batch Upsert
 */
export function insertCycles(cycles: CycleInput[]): void {
  if (cycles.length === 0) return;

  const db = getDatabase();

  const upsert = db.prepare(`
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
      upsert.run(
        cycle.id,
        cycle.date,
        cycle.strain,
        cycle.kilojoules,
        cycle.avg_hr,
        cycle.max_hr
      );
    }
  });
}

/**
 * WHOOP Recoveries - Batch Upsert
 */
export function insertRecoveries(recoveries: RecoveryInput[]): void {
  if (recoveries.length === 0) return;

  const db = getDatabase();

  const upsert = db.prepare(`
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
  });
}

/**
 * WHOOP Sleeps - Batch Upsert
 */
export function insertSleeps(sleeps: SleepInput[]): void {
  if (sleeps.length === 0) return;

  const db = getDatabase();

  const upsert = db.prepare(`
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
  });
}

/**
 * Limitless Lifelogs - Batch Upsert
 */
export function insertLifelogs(lifelogs: LifelogInput[]): void {
  if (lifelogs.length === 0) return;

  const db = getDatabase();

  const upsert = db.prepare(`
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
      upsert.run(
        lifelog.id,
        lifelog.date,
        lifelog.title,
        lifelog.manipulation_count,
        lifelog.wrath_deployed,
        lifelog.raw_json
      );
    }
  });
}

/**
 * OAuth Tokens - Batch Upsert
 */
export function insertTokens(tokens: TokenInput[]): void {
  if (tokens.length === 0) return;

  const db = getDatabase();

  const upsert = db.prepare(`
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
      upsert.run(
        token.provider,
        token.access_token_enc,
        token.refresh_token_enc,
        token.expires_at
      );
    }
  });
}

/**
 * Daily Scores - Batch Upsert
 */
export function insertScores(scores: ScoreInput[]): void {
  if (scores.length === 0) return;

  const db = getDatabase();

  const upsert = db.prepare(`
    INSERT INTO scores (date, unbending_score, recovery_compliance)
    VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      unbending_score = excluded.unbending_score,
      recovery_compliance = excluded.recovery_compliance,
      updated_at = strftime('%s', 'now')
  `);

  db.transaction(() => {
    for (const score of scores) {
      upsert.run(score.date, score.unbending_score, score.recovery_compliance);
    }
  });
}

/**
 * Settings - Batch Upsert
 */
export function insertSettings(settings: SettingInput[]): void {
  if (settings.length === 0) return;

  const db = getDatabase();

  const upsert = db.prepare(`
    INSERT INTO settings (key, value_enc)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value_enc = excluded.value_enc,
      updated_at = strftime('%s', 'now')
  `);

  db.transaction(() => {
    for (const setting of settings) {
      upsert.run(setting.key, setting.value_enc);
    }
  });
}

/**
 * Flags (Burst Forge) - Batch Upsert
 */
export function insertFlags(flags: FlagInput[]): void {
  if (flags.length === 0) return;

  const db = getDatabase();

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
  });
}

/**
 * Tweaks (Burst Forge) - Batch Upsert
 */
export function insertTweaks(tweaks: TweakInput[]): void {
  if (tweaks.length === 0) return;

  const db = getDatabase();

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
  });
}

/**
 * Get metrics for last N days (defaults to 7)
 */
export function getMetricsLastNDays(days: number = 7): DailyMetrics[] {
  const db = getDatabase();

  const query = db.prepare<DailyMetrics>(`
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
    LEFT JOIN cycles c ON dates.date = c.date
    LEFT JOIN recoveries r ON dates.date = r.date
    LEFT JOIN sleeps s ON dates.date = s.date
    LEFT JOIN lifelogs l ON dates.date = l.date
    LEFT JOIN scores sc ON dates.date = sc.date
    ORDER BY date DESC
  `);

  return query.all(days);
}

/**
 * Get latest recovery data
 */
export function getLatestRecovery(): Recovery | null {
  const db = getDatabase();
  const query = db.prepare<Recovery>(`
    SELECT * FROM recoveries ORDER BY date DESC LIMIT 1
  `);
  return query.get() || null;
}

/**
 * Get latest cycle data
 */
export function getLatestCycle(): Cycle | null {
  const db = getDatabase();
  const query = db.prepare<Cycle>(`
    SELECT * FROM cycles ORDER BY date DESC LIMIT 1
  `);
  return query.get() || null;
}

/**
 * Get latest sleep data
 */
export function getLatestSleep(): Sleep | null {
  const db = getDatabase();
  const query = db.prepare<Sleep>(`
    SELECT * FROM sleeps ORDER BY date DESC LIMIT 1
  `);
  return query.get() || null;
}

/**
 * Get OAuth token for a provider
 */
export function getToken(provider: 'whoop' | 'limitless'): Token | null {
  const db = getDatabase();
  const query = db.prepare<Token>(`
    SELECT * FROM tokens WHERE provider = ?
  `);
  return query.get(provider) || null;
}

/**
 * Get setting by key
 */
export function getSetting(key: string): Setting | null {
  const db = getDatabase();
  const query = db.prepare<Setting>(`
    SELECT * FROM settings WHERE key = ?
  `);
  return query.get(key) || null;
}

/**
 * Get all lifelogs for a specific date
 */
export function getLifelogsForDate(date: string): Lifelog[] {
  const db = getDatabase();
  const query = db.prepare<Lifelog>(`
    SELECT * FROM lifelogs WHERE date = ? ORDER BY created_at DESC
  `);
  return query.all(date);
}

/**
 * Get unbending score for a date range
 */
export function getUnbendingScores(startDate: string, endDate: string): Score[] {
  const db = getDatabase();
  const query = db.prepare<Score>(`
    SELECT * FROM scores
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
  `);
  return query.all(startDate, endDate);
}

/**
 * Calculate and insert unbending score for a specific date
 */
export function calculateUnbendingScore(date: string): void {
  const db = getDatabase();

  // Get manipulation stats for the date
  const stats = db
    .prepare<{
      manipulation_count: number;
      wrath_deployed: number;
    }>(`
      SELECT
        SUM(manipulation_count) as manipulation_count,
        SUM(wrath_deployed) as wrath_deployed
      FROM lifelogs
      WHERE date = ?
    `)
    .get(date);

  if (!stats || stats.manipulation_count === 0) {
    // No data for this date, insert null score
    insertScores([{ date, unbending_score: null, recovery_compliance: null }]);
    return;
  }

  // Calculate unbending score: % of manipulations that resulted in wrath
  const unbendingScore = (stats.wrath_deployed / stats.manipulation_count) * 100;

  insertScores([{ date, unbending_score: unbendingScore, recovery_compliance: null }]);
}

/**
 * Get flag by ID (Burst Forge)
 */
export function getFlag(id: string): Flag | null {
  const db = getDatabase();
  const query = db.prepare<Flag>(`
    SELECT * FROM flags WHERE id = ?
  `);
  return query.get(id) || null;
}

/**
 * Get all tweaks for a specific flag (Burst Forge)
 */
export function getTweaksByFlagId(flagId: string): Tweak[] {
  const db = getDatabase();
  const query = db.prepare<Tweak>(`
    SELECT * FROM tweaks WHERE flag_id = ? ORDER BY created_at DESC
  `);
  return query.all(flagId);
}

/**
 * Update flag status (Burst Forge)
 */
export function updateFlagStatus(id: string, status: 'pending' | 'resolved' | 'dismissed'): void {
  const db = getDatabase();
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
  const db = getDatabase();
  const query = db.prepare<Flag>(`
    SELECT * FROM flags WHERE status = 'pending' ORDER BY detected_at DESC
  `);
  return query.all();
}

/**
 * Get resolved flags (for FlagRadar visualization)
 */
export function getResolvedFlags(): Flag[] {
  const db = getDatabase();
  const query = db.prepare<Flag>(`
    SELECT * FROM flags WHERE status = 'resolved' ORDER BY detected_at DESC
  `);
  return query.all();
}

/**
 * Get total UIX score (sum of all delta_uix values from tweaks)
 */
export function getTotalUIXScore(): number {
  const db = getDatabase();
  const query = db.prepare<{ total: number | null }>(`
    SELECT SUM(delta_uix) as total FROM tweaks
  `);
  const result = query.get();
  return result?.total ?? 0;
}

/**
 * Get all tweaks from the last N hours (for metrics calculation)
 */
export function getTweaksLastNHours(hours: number = 72): Tweak[] {
  const db = getDatabase();
  const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;

  const query = db.prepare<Tweak>(`
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
  const db = getDatabase();
  const query = db.prepare<Flag>(`
    SELECT * FROM flags ORDER BY detected_at DESC
  `);
  return query.all();
}
