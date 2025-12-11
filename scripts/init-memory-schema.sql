-- HYRO FORGE: Memory Architecture Schema
-- Student learning profiles and continuity system

-- =============================================================================
-- CORE MEMORY TABLES
-- =============================================================================

-- Main student memory profile (stores full JSON learning profile)
CREATE TABLE IF NOT EXISTS hyro_student_memory (
    student_id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,  -- Full StudentLearningProfile as JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_student_memory_updated
    ON hyro_student_memory(updated_at);

-- =============================================================================
-- STRAND-LEVEL HISTORY (For detailed progression tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS hyro_strand_history (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    stat_name TEXT NOT NULL,
    strand TEXT NOT NULL,
    theta REAL NOT NULL,
    se REAL NOT NULL,
    items_count INTEGER NOT NULL,
    session_id TEXT,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES hyro_student_memory(student_id)
);

CREATE INDEX IF NOT EXISTS idx_strand_history_student
    ON hyro_strand_history(student_id, stat_name, strand);

CREATE INDEX IF NOT EXISTS idx_strand_history_date
    ON hyro_strand_history(recorded_at);

-- =============================================================================
-- MISCONCEPTION TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS hyro_misconception_log (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    stat_name TEXT NOT NULL,
    strand TEXT NOT NULL,
    misconception TEXT NOT NULL,
    detection_count INTEGER NOT NULL DEFAULT 1,
    first_detected TEXT NOT NULL,
    last_detected TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT,
    related_items TEXT,  -- JSON array of item IDs
    notes TEXT,
    FOREIGN KEY (student_id) REFERENCES hyro_student_memory(student_id)
);

CREATE INDEX IF NOT EXISTS idx_misconception_student
    ON hyro_misconception_log(student_id, resolved);

CREATE INDEX IF NOT EXISTS idx_misconception_stat
    ON hyro_misconception_log(stat_name, strand);

CREATE INDEX IF NOT EXISTS idx_misconception_active
    ON hyro_misconception_log(student_id, stat_name, resolved)
    WHERE resolved = 0;

-- =============================================================================
-- LEARNING EVENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS hyro_learning_events (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    event_type TEXT NOT NULL,  -- breakthrough, plateau_detected, mastery_achieved, etc.
    stat_name TEXT,
    strand TEXT,
    data_json TEXT,  -- Event-specific data
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    session_id TEXT,
    FOREIGN KEY (student_id) REFERENCES hyro_student_memory(student_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_events_student
    ON hyro_learning_events(student_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_learning_events_type
    ON hyro_learning_events(event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_learning_events_session
    ON hyro_learning_events(session_id);

-- =============================================================================
-- SESSION STATE (Real-time session tracking for adaptive assessment)
-- =============================================================================

CREATE TABLE IF NOT EXISTS hyro_session_state (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    stat_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',  -- active, completed, abandoned

    -- Ability tracking within session
    initial_theta REAL NOT NULL DEFAULT 0,
    current_theta REAL NOT NULL DEFAULT 0,
    standard_error REAL NOT NULL DEFAULT 1.5,

    -- Items administered (JSON array of SessionItem)
    items_administered TEXT NOT NULL DEFAULT '[]',

    -- Time tracking
    started_at INTEGER NOT NULL,
    last_activity_at INTEGER NOT NULL,
    total_time_seconds INTEGER NOT NULL DEFAULT 0,

    -- Engagement metrics
    avg_response_time_ms REAL NOT NULL DEFAULT 0,
    hesitation_count INTEGER NOT NULL DEFAULT 0,     -- Long pauses (>30s)
    quick_response_count INTEGER NOT NULL DEFAULT 0, -- Fast responses (<3s)

    -- Performance patterns
    current_streak INTEGER NOT NULL DEFAULT 0,       -- Positive for correct, negative for incorrect
    longest_correct_streak INTEGER NOT NULL DEFAULT 0,
    difficulty_trend TEXT NOT NULL DEFAULT 'stable', -- increasing, stable, decreasing

    FOREIGN KEY (student_id) REFERENCES hyro_student_memory(student_id)
);

CREATE INDEX IF NOT EXISTS idx_session_state_student
    ON hyro_session_state(student_id, status);

CREATE INDEX IF NOT EXISTS idx_session_state_active
    ON hyro_session_state(student_id, stat_name, status)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_session_state_started
    ON hyro_session_state(started_at DESC);

-- =============================================================================
-- SESSION SUMMARIES (Aggregated per-session data)
-- =============================================================================

CREATE TABLE IF NOT EXISTS hyro_session_summaries (
    session_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    stat_name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    items_count INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    avg_difficulty REAL,
    starting_theta REAL,
    ending_theta REAL,
    theta_change REAL,
    strands_tested TEXT,  -- JSON array
    misconceptions_detected TEXT,  -- JSON array
    breakthroughs TEXT,  -- JSON array
    session_quality REAL,  -- 0-1 score
    FOREIGN KEY (student_id) REFERENCES hyro_student_memory(student_id)
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_student
    ON hyro_session_summaries(student_id, started_at DESC);

-- =============================================================================
-- OPTIMAL PARAMETERS (Learned student preferences)
-- =============================================================================

CREATE TABLE IF NOT EXISTS hyro_student_preferences (
    student_id TEXT PRIMARY KEY,
    optimal_session_length INTEGER DEFAULT 15,
    optimal_difficulty_min REAL DEFAULT 0.3,
    optimal_difficulty_max REAL DEFAULT 0.7,
    preferred_format TEXT DEFAULT 'multiple_choice',
    best_performance_hour INTEGER,  -- 0-23
    fatigue_threshold INTEGER DEFAULT 20,
    break_frequency INTEGER DEFAULT 10,  -- Items between breaks
    feedback_preference TEXT DEFAULT 'detailed',  -- detailed, brief, none
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES hyro_student_memory(student_id)
);

-- =============================================================================
-- PERFORMANCE ANALYTICS (Daily aggregates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS hyro_daily_performance (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    date TEXT NOT NULL,  -- YYYY-MM-DD
    stat_name TEXT NOT NULL,
    items_attempted INTEGER NOT NULL DEFAULT 0,
    items_correct INTEGER NOT NULL DEFAULT 0,
    avg_difficulty REAL,
    time_spent_seconds INTEGER,
    theta_start REAL,
    theta_end REAL,
    sessions_count INTEGER DEFAULT 1,
    UNIQUE (student_id, date, stat_name),
    FOREIGN KEY (student_id) REFERENCES hyro_student_memory(student_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_performance_student
    ON hyro_daily_performance(student_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_performance_stat
    ON hyro_daily_performance(stat_name, date DESC);

-- =============================================================================
-- MASTERY MILESTONES
-- =============================================================================

CREATE TABLE IF NOT EXISTS hyro_mastery_milestones (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    stat_name TEXT NOT NULL,
    strand TEXT NOT NULL,
    milestone_type TEXT NOT NULL,  -- started, developing, proficient, mastered
    theta_at_milestone REAL NOT NULL,
    items_to_milestone INTEGER NOT NULL,
    achieved_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES hyro_student_memory(student_id)
);

CREATE INDEX IF NOT EXISTS idx_mastery_milestones_student
    ON hyro_mastery_milestones(student_id, achieved_at DESC);

-- =============================================================================
-- DIFFICULTY CALIBRATION (For improving item generation)
-- =============================================================================

CREATE TABLE IF NOT EXISTS hyro_difficulty_calibration (
    id TEXT PRIMARY KEY,
    stat_name TEXT NOT NULL,
    strand TEXT NOT NULL,
    tier TEXT NOT NULL,
    target_difficulty REAL NOT NULL,
    actual_p_correct REAL NOT NULL,  -- Observed probability of correct
    sample_size INTEGER NOT NULL,
    calibration_error REAL,  -- Difference from expected
    last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_difficulty_calibration_unique
    ON hyro_difficulty_calibration(stat_name, strand, tier, target_difficulty);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Active misconceptions by student
CREATE VIEW IF NOT EXISTS v_active_misconceptions AS
SELECT
    m.*,
    COUNT(DISTINCT e.session_id) as sessions_with_misconception
FROM hyro_misconception_log m
LEFT JOIN hyro_learning_events e
    ON e.student_id = m.student_id
    AND e.stat_name = m.stat_name
    AND e.strand = m.strand
    AND e.event_type = 'misconception_resolved'
WHERE m.resolved = 0
GROUP BY m.id;

-- Student performance summary
CREATE VIEW IF NOT EXISTS v_student_performance_summary AS
SELECT
    dp.student_id,
    dp.stat_name,
    SUM(dp.items_attempted) as total_items,
    SUM(dp.items_correct) as total_correct,
    ROUND(SUM(dp.items_correct) * 1.0 / SUM(dp.items_attempted), 3) as accuracy,
    AVG(dp.avg_difficulty) as avg_difficulty,
    MIN(dp.date) as first_activity,
    MAX(dp.date) as last_activity,
    COUNT(DISTINCT dp.date) as active_days
FROM hyro_daily_performance dp
GROUP BY dp.student_id, dp.stat_name;

-- Recent learning events (last 7 days)
CREATE VIEW IF NOT EXISTS v_recent_learning_events AS
SELECT
    le.*,
    sm.data_json as student_profile
FROM hyro_learning_events le
JOIN hyro_student_memory sm ON le.student_id = sm.student_id
WHERE le.timestamp > datetime('now', '-7 days')
ORDER BY le.timestamp DESC;
