-- Schema for Generative Assessment Engine
-- HYRO FORGE v3

-- Sessions table for tracking generative assessment sessions
CREATE TABLE IF NOT EXISTS hyro_generative_sessions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    stat_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',  -- active, completed, abandoned
    ability_theta REAL DEFAULT 0,
    ability_se REAL DEFAULT 1.5,
    items_count INTEGER DEFAULT 0,
    data_json TEXT,  -- Full session data for recovery
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gen_sessions_student ON hyro_generative_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_gen_sessions_status ON hyro_generative_sessions(status);

-- Results table for completed generative diagnostics (v3)
CREATE TABLE IF NOT EXISTS hyro_generative_results (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    stat_name TEXT NOT NULL,
    session_id TEXT,
    estimated_level INTEGER,
    theta REAL,
    standard_error REAL,
    items_count INTEGER,
    results_json TEXT,  -- Full results including strand breakdown
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES hyro_generative_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_gen_results_student ON hyro_generative_results(student_id);
CREATE INDEX IF NOT EXISTS idx_gen_results_stat ON hyro_generative_results(stat_name);

-- Student stats table (current ability levels)
CREATE TABLE IF NOT EXISTS hyro_student_stats (
    student_id TEXT NOT NULL,
    stat_name TEXT NOT NULL,
    level INTEGER DEFAULT 50,
    theta REAL DEFAULT 0,
    last_assessed_at TEXT,
    PRIMARY KEY (student_id, stat_name)
);

-- Generated items log (for auditing and analysis)
CREATE TABLE IF NOT EXISTS hyro_generated_items_log (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    stat_name TEXT NOT NULL,
    strand TEXT NOT NULL,
    tier TEXT NOT NULL,
    difficulty REAL,
    prompt TEXT,
    correct_answer TEXT,
    student_response TEXT,
    is_correct INTEGER,
    score REAL,
    evaluation_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES hyro_generative_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_gen_items_session ON hyro_generated_items_log(session_id);
CREATE INDEX IF NOT EXISTS idx_gen_items_strand ON hyro_generated_items_log(strand);
