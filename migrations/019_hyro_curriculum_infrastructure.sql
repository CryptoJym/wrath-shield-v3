-- HYRO FORGE: Comprehensive Curriculum Infrastructure
-- Migration 019: Core tables for learning standards, topics, and mastery tracking
-- Design: Common Core as FLOOR, not ceiling. Goal: "valuable, not common"

-- ============================================================================
-- DOMAIN RESTRUCTURE
-- ============================================================================
-- New domain taxonomy:
--   1. mathematics        - Common Core Math + extensions
--   2. language_arts      - Reading + Writing + Grammar + Vocabulary (combined)
--   3. science            - Life, Earth, Physical Science + Scientific Method
--   4. social_studies     - History, Geography, Civics, Economics
--   5. critical_thinking  - Logic, Analysis, Evaluation, Argumentation
--   6. llm_communications - Vision Articulation, Prompt Engineering, Co-Development (NOVEL)
--   7. study_skills       - Learning strategies, metacognition, organization

-- ============================================================================
-- LEARNING STANDARDS TABLE
-- Maps to Common Core and custom extensions
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_learning_standards (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,                    -- mathematics, language_arts, etc.
  standard_set TEXT NOT NULL DEFAULT 'common_core', -- common_core, utah_core, hyro_advanced
  standard_code TEXT,                      -- e.g., 6.NS.A.1, RL.6.1
  title TEXT NOT NULL,
  description TEXT,
  grade_level INTEGER,                     -- 6, 7, 8, etc. (NULL for multi-grade)
  grade_band TEXT,                         -- 'elementary', 'middle', 'high', 'advanced'
  strand TEXT,                             -- Major category within domain
  cluster TEXT,                            -- Sub-category
  prerequisite_ids TEXT DEFAULT '[]',      -- JSON array of standard IDs
  is_assessed INTEGER DEFAULT 1,           -- Whether this appears in state tests
  is_extension INTEGER DEFAULT 0,          -- Beyond Common Core
  sequence_order INTEGER DEFAULT 0,        -- Order within grade/domain
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_standards_domain ON hyro_learning_standards(domain);
CREATE INDEX IF NOT EXISTS idx_standards_grade ON hyro_learning_standards(grade_level);
CREATE INDEX IF NOT EXISTS idx_standards_code ON hyro_learning_standards(standard_code);

-- ============================================================================
-- CURRICULUM TOPICS TABLE
-- Fine-grained topics within each standard
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_curriculum_topics (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  standard_id TEXT REFERENCES hyro_learning_standards(id),
  topic TEXT NOT NULL,                     -- Short name
  description TEXT,                        -- Detailed description
  learning_objectives TEXT,                -- JSON array of objectives
  difficulty_tier INTEGER DEFAULT 2,       -- 1=foundational, 2=core, 3=advanced, 4=extension
  estimated_minutes INTEGER DEFAULT 30,    -- Time to learn
  prerequisite_topic_ids TEXT DEFAULT '[]', -- JSON array
  related_topic_ids TEXT DEFAULT '[]',     -- JSON array for cross-domain connections
  keywords TEXT DEFAULT '[]',              -- JSON array for search
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_topics_domain ON hyro_curriculum_topics(domain);
CREATE INDEX IF NOT EXISTS idx_topics_standard ON hyro_curriculum_topics(standard_id);
CREATE INDEX IF NOT EXISTS idx_topics_tier ON hyro_curriculum_topics(difficulty_tier);

-- ============================================================================
-- TOPIC MASTERY TRACKING
-- Tracks learner progress through curriculum
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_topic_mastery (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'hyro',
  topic_id TEXT NOT NULL REFERENCES hyro_curriculum_topics(id),
  status TEXT DEFAULT 'not_started',       -- not_started, introduced, learning, practicing, mastered
  mastery_score REAL DEFAULT 0,            -- 0-100 mastery percentage
  confidence REAL DEFAULT 0,               -- System confidence in mastery estimate
  attempts INTEGER DEFAULT 0,              -- Total practice attempts
  successes INTEGER DEFAULT 0,             -- Successful attempts
  last_practiced INTEGER,                  -- Unix timestamp
  first_introduced INTEGER,                -- When first shown
  mastered_at INTEGER,                     -- When mastery achieved
  time_spent_minutes INTEGER DEFAULT 0,    -- Total time on topic
  notes TEXT,                              -- AI-generated learning notes
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_mastery_user ON hyro_topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_mastery_status ON hyro_topic_mastery(status);
CREATE INDEX IF NOT EXISTS idx_mastery_score ON hyro_topic_mastery(mastery_score);

-- ============================================================================
-- STANDARD MASTERY TRACKING
-- Aggregate mastery at the standard level
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_standard_mastery (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'hyro',
  standard_id TEXT NOT NULL REFERENCES hyro_learning_standards(id),
  status TEXT DEFAULT 'not_started',       -- not_started, in_progress, proficient, mastered
  mastery_score REAL DEFAULT 0,            -- Aggregate from topics
  topics_total INTEGER DEFAULT 0,
  topics_mastered INTEGER DEFAULT 0,
  last_activity INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(user_id, standard_id)
);

CREATE INDEX IF NOT EXISTS idx_std_mastery_user ON hyro_standard_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_std_mastery_status ON hyro_standard_mastery(status);

-- ============================================================================
-- QUESTION BANK TABLE (Enhanced)
-- Links questions to standards and topics
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_question_bank (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  standard_id TEXT REFERENCES hyro_learning_standards(id),
  topic_id TEXT REFERENCES hyro_curriculum_topics(id),
  question_type TEXT NOT NULL,             -- multiple_choice, short_answer, extended_response, performance_task
  question_text TEXT NOT NULL,
  answer_options TEXT,                     -- JSON array for multiple choice
  correct_answer TEXT NOT NULL,
  explanation TEXT,                        -- Why the answer is correct
  difficulty INTEGER DEFAULT 50,           -- 0-100 scale
  difficulty_tier INTEGER DEFAULT 2,       -- 1-4 matching topic tiers
  bloom_level TEXT,                        -- remember, understand, apply, analyze, evaluate, create
  dok_level INTEGER DEFAULT 2,             -- Depth of Knowledge 1-4
  time_estimate_seconds INTEGER DEFAULT 60,
  hints TEXT DEFAULT '[]',                 -- JSON array of progressive hints
  common_misconceptions TEXT DEFAULT '[]', -- JSON array
  tags TEXT DEFAULT '[]',                  -- JSON array
  source TEXT DEFAULT 'hyro_generated',    -- Source of question
  times_shown INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  discrimination_index REAL,               -- IRT parameter
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_questions_domain ON hyro_question_bank(domain);
CREATE INDEX IF NOT EXISTS idx_questions_standard ON hyro_question_bank(standard_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON hyro_question_bank(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON hyro_question_bank(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_type ON hyro_question_bank(question_type);

-- ============================================================================
-- LEARNING PROGRESSIONS TABLE
-- Defines pathways through the curriculum
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_learning_progressions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT,
  grade_span TEXT,                         -- e.g., "6-8"
  progression_type TEXT DEFAULT 'standard', -- standard, remediation, acceleration, enrichment
  topic_sequence TEXT NOT NULL,            -- JSON array of topic IDs in order
  estimated_weeks INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_progressions_domain ON hyro_learning_progressions(domain);

-- ============================================================================
-- SKILL PREREQUISITES TABLE
-- Explicit prerequisite relationships
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_skill_prerequisites (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,                  -- topic_id or standard_id
  skill_type TEXT NOT NULL,                -- 'topic' or 'standard'
  prerequisite_id TEXT NOT NULL,
  prerequisite_type TEXT NOT NULL,
  strength TEXT DEFAULT 'required',        -- required, recommended, helpful
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(skill_id, prerequisite_id)
);

CREATE INDEX IF NOT EXISTS idx_prereq_skill ON hyro_skill_prerequisites(skill_id);
CREATE INDEX IF NOT EXISTS idx_prereq_prereq ON hyro_skill_prerequisites(prerequisite_id);

-- ============================================================================
-- DOMAIN CONFIGURATION TABLE
-- Configures each learning domain
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_domain_config (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,                               -- Emoji or icon class
  color TEXT,                              -- Hex color
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  assessment_weight REAL DEFAULT 1.0,      -- Weight in overall progress
  min_mastery_for_proficient REAL DEFAULT 70,
  min_mastery_for_mastered REAL DEFAULT 90,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Seed domain configuration
INSERT OR REPLACE INTO hyro_domain_config (id, domain, display_name, description, icon, color, sort_order) VALUES
  ('dom_math', 'mathematics', 'Mathematics', 'Number sense, algebra, geometry, statistics, and mathematical reasoning', '🔢', '#3B82F6', 1),
  ('dom_ela', 'language_arts', 'Language Arts', 'Reading comprehension, writing, grammar, vocabulary, and communication', '📚', '#8B5CF6', 2),
  ('dom_sci', 'science', 'Science', 'Life science, earth science, physical science, and scientific inquiry', '🔬', '#10B981', 3),
  ('dom_ss', 'social_studies', 'Social Studies', 'History, geography, civics, economics, and cultural understanding', '🌍', '#F59E0B', 4),
  ('dom_ct', 'critical_thinking', 'Critical Thinking', 'Logic, analysis, evaluation, argumentation, and problem-solving', '🧠', '#EC4899', 5),
  ('dom_llm', 'llm_communications', 'LLM Communications', 'Vision articulation, prompt engineering, AI co-development, and perception refinement', '🤖', '#6366F1', 6),
  ('dom_study', 'study_skills', 'Study Skills', 'Learning strategies, metacognition, organization, and self-regulation', '📝', '#64748B', 7);
