/**
 * HYRO FORGE: ULTRA-EDGE - Type Definitions
 * RPG-style education system types
 */

// ============================================================================
// STAT SYSTEM
// ============================================================================

export type StatName =
  | 'math'
  | 'reading'
  | 'science'
  | 'coding'
  | 'study_skills'
  | 'critical_thinking'
  | 'technology'
  | 'problem_solving';

// Array of all stat names for iteration
export const STAT_NAMES: StatName[] = [
  'math',
  'reading',
  'science',
  'coding',
  'study_skills',
  'critical_thinking',
  'technology',
  'problem_solving',
];

export interface Stat {
  id: string;
  stat_name: StatName;
  display_name: string;
  description: string;
  base_value: number;
  current_value: number;
  modifier: number;
  last_assessed: number | null;
  assessment_confidence: number;
}

export interface StatWithTrend extends Stat {
  trend: 'up' | 'down' | 'stable';
  change_7d: number;
  benchmark: number; // 6th grade average for comparison
}

// ============================================================================
// CHARACTER SYSTEM
// ============================================================================

export interface Character {
  id: string;
  display_name: string;
  title: string;
  level: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_session_at: number | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface CharacterSheet extends Character {
  stats: StatWithTrend[];
  xp_to_next_level: number;
  xp_progress_percent: number;
  recent_achievements: Achievement[];
  active_quests: Quest[];
}

// Title progression by level
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Apprentice Forger',
  5: 'Journeyman Scholar',
  10: 'Adept Thinker',
  15: 'Master Learner',
  20: 'Sage of Knowledge',
  25: 'Grandmaster',
  30: 'Legendary Forger',
};

// ============================================================================
// XP SYSTEM
// ============================================================================

export type XPSource =
  | 'quest'
  | 'daily'
  | 'streak'
  | 'achievement'
  | 'srs'
  | 'srs_review'
  | 'intel'
  | 'intel_completed'
  | 'reflection'
  | 'reflection_completed'
  | 'bonus'
  // Phase 3: Reading System
  | 'reading_session'
  | 'chapter_completed'
  | 'book_completed'
  // Phase 3: Comprehension System
  | 'comprehension_response'
  | 'discussion_exchange'
  | 'discussion_completed';

export interface XPTransaction {
  id: string;
  amount: number;
  source: XPSource;
  source_id: string | null;
  multiplier: number;
  notes: string | null;
  created_at: number;
}

export interface XPSummary {
  today: number;
  this_week: number;
  this_month: number;
  total: number;
  by_source: Record<XPSource, number>;
}

// ============================================================================
// QUEST SYSTEM
// ============================================================================

export type QuestType = 'daily' | 'weekly' | 'epic' | 'side' | 'challenge';
export type QuestDifficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'legendary';
export type QuestStatus = 'available' | 'active' | 'completed' | 'failed' | 'expired';

export interface Quest {
  id: string;
  quest_type: QuestType;
  title: string;
  description: string | null;
  required_stat: StatName | null;
  difficulty: QuestDifficulty;
  xp_reward: number;
  stat_boost: Record<StatName, number> | null;
  achievement_unlock: string | null;
  status: QuestStatus;
  started_at: number | null;
  completed_at: number | null;
  due_at: number | null;
  platform: string | null;
  external_id: string | null;
  external_url: string | null;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  created_at: number;
}

export interface QuestWithProgress extends Quest {
  time_remaining: string | null;
  is_overdue: boolean;
  submissions_count: number;
}

// ============================================================================
// SUBMISSION SYSTEM
// ============================================================================

export type SubmissionType = 'text' | 'voice' | 'image' | 'url' | 'code';
export type AIReviewStatus = 'pending' | 'reviewed' | 'needs_revision';

export interface Submission {
  id: string;
  quest_id: string | null;
  submission_type: SubmissionType;
  content: string | null;
  file_path: string | null;
  url: string | null;
  ai_review_status: AIReviewStatus;
  ai_feedback: string | null;
  ai_score: number | null;
  ai_reviewed_at: number | null;
  stats_awarded: Record<StatName, number> | null;
  xp_awarded: number;
  created_at: number;
}

// ============================================================================
// SPACED REPETITION SYSTEM (SM-2)
// ============================================================================

export interface SRSTopic {
  id: string;
  topic: string;
  domain: StatName;
  difficulty: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  last_reviewed: number | null;
  next_review: number | null;
  last_quality: number | null;
  source: string | null;
  external_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: number;
}

export interface SRSReview {
  id: string;
  topic_id: string;
  quality: number; // 0-5
  response_time_ms: number | null;
  confidence_before: number | null;
  confidence_after: number | null;
  notes: string | null;
  created_at: number;
}

export interface SRSDueTopics {
  due_now: SRSTopic[];
  due_today: SRSTopic[];
  upcoming: SRSTopic[];
  overdue_count: number;
}

// ============================================================================
// DAILY INTEL
// ============================================================================

export interface IntelItem {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  source_name: string;
  discussion_prompt: string;
  future_implications: string;
  read: boolean;
}

export interface DailyIntel {
  id: string;
  date: string;
  tech_items: IntelItem[];
  science_items: IntelItem[];
  ai_update: IntelItem | null;
  items_read: number;
  discussion_completed: boolean;
  deep_dive_topic: string | null;
  deep_dive_url: string | null;
  xp_earned: number;
}

// ============================================================================
// REFLECTION & METACOGNITION
// ============================================================================

export interface Reflection {
  id: string;
  session_id: string | null;
  session_date: string;
  what_learned: string | null;
  what_surprised: string | null;
  what_was_hard: string | null;
  what_connects: string | null;
  confidence_rating: number | null;
  actual_performance: number | null;
  calibration_score: number | null;
  energy_level: number | null;
  engagement_level: number | null;
  focus_level: number | null;
  session_duration_minutes: number | null;
  created_at: number;
}

export interface CalibrationMetrics {
  average_calibration: number;
  overconfidence_rate: number;
  underconfidence_rate: number;
  trend: 'improving' | 'declining' | 'stable';
}

// ============================================================================
// ACHIEVEMENTS
// ============================================================================

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: 'streak' | 'mastery' | 'exploration' | 'epic';
  xp_bonus: number;
  requirement_type: string;
  requirement_value: number;
  requirement_stat: StatName | null;
  is_secret: boolean;
  earned_at?: number;
}

// ============================================================================
// SPIDER GRAPH DATA
// ============================================================================

export interface SpiderGraphData {
  stats: Array<{
    name: string;
    displayName: string;
    value: number;
    benchmark: number;
    fullMark: number;
  }>;
  meta: {
    level: number;
    total_xp: number;
    assessment_date: string | null;
  };
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ForgeAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface XPAwardResult {
  previous_xp: number;
  awarded_xp: number;
  new_total: number;
  level_up: boolean;
  previous_level: number;
  new_level: number;
  new_title: string | null;
  achievements_unlocked: Achievement[];
}

export interface StatUpdateResult {
  stat_name: StatName;
  previous_value: number;
  new_value: number;
  change: number;
  achievements_unlocked: Achievement[];
}
