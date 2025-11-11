/**
 * Wrath Shield v3 - Database TypeScript Types
 *
 * Type definitions matching the SQLite schema for all tables.
 */

/**
 * WHOOP Cycles Table
 * Daily strain, kilojoules, and heart rate data
 */
export interface Cycle {
  id: string;
  date: string; // YYYY-MM-DD format
  strain: number | null;
  kilojoules: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  created_at?: number; // Unix timestamp
  updated_at?: number; // Unix timestamp
}

/**
 * WHOOP Recovery Table
 * Daily recovery scores and biometric data
 */
export interface Recovery {
  id: string;
  date: string; // YYYY-MM-DD format
  score: number | null; // 0-100
  hrv: number | null; // Heart rate variability (ms)
  rhr: number | null; // Resting heart rate (bpm)
  spo2: number | null; // Blood oxygen saturation (%)
  skin_temp: number | null; // Skin temperature (°F)
  created_at?: number;
  updated_at?: number;
}

/**
 * WHOOP Sleep Table
 * Sleep performance and sleep stage data
 */
export interface Sleep {
  id: string;
  date: string; // YYYY-MM-DD format
  performance: number | null; // 0-100
  rem_min: number | null; // REM sleep minutes
  sws_min: number | null; // Slow-wave sleep minutes
  light_min: number | null; // Light sleep minutes
  respiration: number | null; // Breaths per minute
  sleep_debt_min: number | null; // Sleep debt in minutes
  created_at?: number;
  updated_at?: number;
}

/**
 * Limitless Lifelogs Table
 * Daily interaction logs with manipulation detection
 */
export interface Lifelog {
  id: string;
  date: string; // YYYY-MM-DD format
  title: string | null;
  manipulation_count: number; // Count of detected manipulative phrases
  wrath_deployed: number; // 0 = no wrath, 1 = wrath deployed
  raw_json: string | null; // Full JSON from Limitless API
  created_at?: number;
  updated_at?: number;
}

/**
 * OAuth Tokens Table
 * Encrypted access and refresh tokens for API integrations
 */
export interface Token {
  provider: 'whoop' | 'limitless';
  access_token_enc: string; // Encrypted access token (JSON string)
  refresh_token_enc: string | null; // Encrypted refresh token (JSON string)
  expires_at: number | null; // Unix timestamp
  created_at?: number;
  updated_at?: number;
}

/**
 * Daily Scores Table
 * Calculated Unbending Score and compliance metrics
 */
export interface Score {
  date: string; // YYYY-MM-DD format (PRIMARY KEY)
  unbending_score: number | null; // % of wrath deployments vs manipulations
  recovery_compliance: number | null; // % of days with recovery data
  created_at?: number;
  updated_at?: number;
}

/**
 * Settings Table
 * Encrypted application settings and user preferences
 */
export interface Setting {
  key: string; // PRIMARY KEY
  value_enc: string | null; // Encrypted value (JSON string)
  created_at?: number;
  updated_at?: number;
}

/**
 * Flags Table (Burst Forge)
 * Manipulation flags detected in conversation text
 */
export interface Flag {
  id: string; // PRIMARY KEY
  status: 'pending' | 'resolved' | 'dismissed';
  original_text: string;
  detected_at: number; // Unix timestamp
  severity: number; // 1-5 scale
  manipulation_type: string | null;
  created_at?: number;
  updated_at?: number;
}

/**
 * Tweaks Table (Burst Forge)
 * Confidence rewrites and flag resolutions
 */
export interface Tweak {
  id: string; // PRIMARY KEY
  flag_id: string; // Foreign key to flags table
  assured_text: string;
  action_type: 'rewrite' | 'dismiss' | 'escalate';
  context: string | null;
  delta_uix: number; // Change in UIX score
  user_notes: string | null;
  created_at?: number;
  updated_at?: number;
}

/**
 * Input types for batch upserts (without auto-generated fields)
 */
export type CycleInput = Omit<Cycle, 'created_at' | 'updated_at'>;
export type RecoveryInput = Omit<Recovery, 'created_at' | 'updated_at'>;
export type SleepInput = Omit<Sleep, 'created_at' | 'updated_at'>;
export type LifelogInput = Omit<Lifelog, 'created_at' | 'updated_at'>;
export type TokenInput = Omit<Token, 'created_at' | 'updated_at'>;
export type ScoreInput = Omit<Score, 'created_at' | 'updated_at'>;
export type SettingInput = Omit<Setting, 'created_at' | 'updated_at'>;
export type FlagInput = Omit<Flag, 'created_at' | 'updated_at'>;
export type TweakInput = Omit<Tweak, 'created_at' | 'updated_at'>;

/**
 * Users Table
 */
export interface User {
  id: string;
  email: string | null;
  name: string | null;
  timezone: string | null;
  created_at?: number;
  updated_at?: number;
}

export type UserInput = Omit<User, 'created_at' | 'updated_at'>;

/**
 * Metrics aggregation for dashboard queries
 */
export interface DailyMetrics {
  date: string;
  strain: number | null;
  recovery_score: number | null;
  sleep_performance: number | null;
  manipulation_count: number;
  wrath_deployed: number;
  unbending_score: number | null;
}
