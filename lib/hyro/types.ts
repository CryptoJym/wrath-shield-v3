/**
 * Hyro Education Agent - Type Definitions
 *
 * Tracks educational content and generates daily learning recommendations
 */

// Learning sources that Hyro can crawl
export type LearningSource =
  | 'arxiv'           // Academic papers
  | 'youtube'         // Educational videos
  | 'coursera'        // Online courses
  | 'github'          // Code repositories
  | 'medium'          // Technical articles
  | 'podcast'         // Educational podcasts
  | 'book'            // Books/ebooks
  | 'newsletter'      // Email newsletters
  | 'rss'             // RSS feeds
  | 'custom';         // User-defined sources

// Learning item difficulty/complexity
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// Topic categories
export type TopicCategory =
  | 'ai_ml'
  | 'programming'
  | 'business'
  | 'health'
  | 'productivity'
  | 'science'
  | 'engineering'
  | 'philosophy'
  | 'other';

// Status of learning items
export type LearningStatus =
  | 'pending'         // Not started
  | 'in_progress'     // Currently learning
  | 'completed'       // Finished
  | 'archived'        // Archived (not interested)
  | 'scheduled';      // Scheduled for future

export interface LearningItem {
  id: string;
  user_id: string;
  created_at: number;        // Unix timestamp
  updated_at: number;

  // Content metadata
  source: LearningSource;
  source_url?: string;
  title: string;
  description?: string;
  author?: string;
  published_at?: number;     // Unix timestamp

  // Classification
  topics: TopicCategory[];
  difficulty: DifficultyLevel;
  estimated_time_minutes?: number;  // Time to complete

  // Learning tracking
  status: LearningStatus;
  progress_percent: number;   // 0-100
  started_at?: number;        // When user started
  completed_at?: number;      // When user completed
  notes?: string;             // User notes

  // Metadata
  tags: string[];
  priority_score: number;     // 0-100, calculated by recommender
  confidence: number;         // 0-1, how confident we are in classification

  // Scheduling
  scheduled_for?: number;     // Unix timestamp for when to recommend
}

export interface DailyRecommendation {
  id: string;
  user_id: string;
  date: string;              // YYYY-MM-DD
  created_at: number;

  // Recommendations for the day
  items: {
    item_id: string;
    item_title: string;
    item_source: LearningSource;
    rationale: string;       // Why this is recommended today
    priority: number;        // 1-10
    time_slot?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  }[];

  // Daily focus
  focus_topic?: TopicCategory;
  focus_description?: string;

  // Status
  accepted_count: number;    // How many items user accepted
  completed_count: number;   // How many items user completed
  total_time_minutes: number; // Total estimated time for all items
}

export interface LearningProgress {
  user_id: string;

  // Overall stats
  total_items: number;
  completed_items: number;
  in_progress_items: number;

  // Time tracking
  total_learning_hours: number;
  current_streak_days: number;
  longest_streak_days: number;

  // By category
  by_category: Record<TopicCategory, {
    total: number;
    completed: number;
    avg_difficulty: number;
  }>;

  // Recent activity
  last_activity_at?: number;
  items_completed_this_week: number;
  items_completed_this_month: number;
}

export interface HyroAgentStatus {
  ok: boolean;
  agent: 'hyro';
  status: 'green' | 'yellow' | 'red';
  health_score: number;

  // Current state
  pending_items: number;
  recommendations_today: number;
  items_completed_today: number;

  // Last activity
  last_sync: string;         // ISO timestamp
  last_recommendation: string; // ISO timestamp

  // Stats
  total_sources: number;
  active_sources: number;
  total_learning_items: number;

  // Recent activity
  recent_items: Array<{
    id: string;
    title: string;
    status: LearningStatus;
    updated_at: number;
  }>;
}

export interface CrawlerConfig {
  source: LearningSource;
  enabled: boolean;

  // Source-specific config
  config: {
    url?: string;            // For RSS, custom sources
    api_key?: string;        // If API access needed
    keywords?: string[];     // Topics to search for
    max_items?: number;      // Max items to fetch per sync
    sync_interval_hours?: number; // How often to sync
  };

  // State
  last_sync_at?: number;
  last_success_at?: number;
  error_count: number;
  last_error?: string;
}

// Sync result from crawler
export interface SyncResult {
  source: LearningSource;
  success: boolean;
  items_found: number;
  items_new: number;
  items_updated: number;
  error?: string;
  synced_at: number;
}
