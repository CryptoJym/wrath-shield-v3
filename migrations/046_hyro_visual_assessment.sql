-- ============================================================================
-- HYRO FORGE: Visual Assessment & Multi-Modal Learning
-- Database schema for visual comprehension and modality tracking
-- ============================================================================

-- Visual assessments table
CREATE TABLE IF NOT EXISTS hyro_visual_assessments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assessment_type TEXT NOT NULL,  -- diagram_interpretation, chart_reading, visual_comparison, spatial_reasoning, image_analysis
  
  -- Content
  image_url TEXT NOT NULL,
  question TEXT NOT NULL,
  student_response TEXT NOT NULL,
  response_time_seconds INTEGER,
  
  -- Evaluation
  score REAL NOT NULL,  -- 0-100
  feedback TEXT NOT NULL,
  strengths TEXT,  -- JSON array
  growth_areas TEXT,  -- JSON array
  
  -- Visual-specific scores (each 0-25)
  visual_literacy_score REAL,
  interpretation_score REAL,
  detail_attention_score REAL,
  synthesis_score REAL,
  
  -- XP and metadata
  xp_earned INTEGER DEFAULT 0,
  context_data TEXT,  -- JSON: bookId, chapterId, conceptId, etc.
  
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_visual_assessments_student ON hyro_visual_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_visual_assessments_type ON hyro_visual_assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_visual_assessments_created ON hyro_visual_assessments(created_at);

-- Multi-modal content table
CREATE TABLE IF NOT EXISTS hyro_multimodal_content (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL,  -- Links to standards or learning objectives
  modality TEXT NOT NULL,  -- text, image, diagram, video, interactive, audio
  
  -- Content references
  content_url TEXT,  -- URL to external content (video, image, etc.)
  content_text TEXT,  -- Text content for text modality
  content_data TEXT,  -- JSON for interactive content config
  
  -- Metadata
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT DEFAULT 'medium',
  stat_targeted TEXT,
  
  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  average_score REAL,
  
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_multimodal_student ON hyro_multimodal_content(student_id);
CREATE INDEX IF NOT EXISTS idx_multimodal_concept ON hyro_multimodal_content(concept_id);
CREATE INDEX IF NOT EXISTS idx_multimodal_modality ON hyro_multimodal_content(modality);

-- Modality preferences tracking
CREATE TABLE IF NOT EXISTS hyro_modality_preferences (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  modality TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  
  -- Performance data
  score REAL NOT NULL,  -- 0-100
  response_time_seconds INTEGER,
  content_id TEXT,  -- Links to hyro_multimodal_content
  
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_modality_prefs_student ON hyro_modality_preferences(student_id);
CREATE INDEX IF NOT EXISTS idx_modality_prefs_modality ON hyro_modality_preferences(modality);
CREATE INDEX IF NOT EXISTS idx_modality_prefs_concept ON hyro_modality_preferences(concept_id);

-- Diagram prompts for creation tasks
CREATE TABLE IF NOT EXISTS hyro_diagram_prompts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL,
  diagram_type TEXT NOT NULL,  -- flowchart, mind_map, comparison_table, timeline, etc.
  
  -- Prompt content
  prompt_text TEXT NOT NULL,
  guidelines TEXT,  -- JSON array of guidelines
  required_elements TEXT,  -- JSON array of required elements
  evaluation_rubric TEXT,  -- JSON object with rubric criteria
  
  -- Metadata
  difficulty TEXT DEFAULT 'medium',
  times_used INTEGER DEFAULT 0,
  average_score REAL,
  
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_diagram_prompts_student ON hyro_diagram_prompts(student_id);
CREATE INDEX IF NOT EXISTS idx_diagram_prompts_concept ON hyro_diagram_prompts(concept_id);
CREATE INDEX IF NOT EXISTS idx_diagram_prompts_type ON hyro_diagram_prompts(diagram_type);

-- Student diagram submissions
CREATE TABLE IF NOT EXISTS hyro_diagram_submissions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  prompt_id TEXT REFERENCES hyro_diagram_prompts(id),
  concept_id TEXT NOT NULL,
  diagram_type TEXT NOT NULL,
  
  -- Submission content
  diagram_url TEXT,  -- URL to uploaded diagram image
  diagram_description TEXT,  -- Student's text description of their diagram
  
  -- Evaluation
  score REAL,  -- 0-100
  feedback TEXT,
  rubric_scores TEXT,  -- JSON object with scores per rubric criterion
  strengths TEXT,  -- JSON array
  growth_areas TEXT,  -- JSON array
  
  -- Metadata
  submission_time_seconds INTEGER,
  xp_earned INTEGER DEFAULT 0,
  
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_diagram_submissions_student ON hyro_diagram_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_diagram_submissions_prompt ON hyro_diagram_submissions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_diagram_submissions_concept ON hyro_diagram_submissions(concept_id);
