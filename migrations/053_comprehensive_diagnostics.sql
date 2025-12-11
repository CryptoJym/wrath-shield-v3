-- ============================================================================
-- MIGRATION 053: Comprehensive Diagnostic Coverage
-- ============================================================================

-- 1. Register Missing Diagnostic Tests
INSERT OR IGNORE INTO hyro_diagnostic_tests (id, stat_name, title, description, question_count, time_limit_minutes) VALUES
  ('diag-social', 'social_studies', 'Social Studies Assessment', 'Evaluate understanding of history, geography, and civics', 20, 20),
  ('diag-finance', 'financial_literacy', 'Financial Literacy Assessment', 'Assess knowledge of personal finance and economics', 15, 15),
  ('diag-writing', 'writing', 'Writing Skills Assessment', 'Evaluate grammar, usage, and writing structure', 15, 15),
  ('diag-coding', 'coding', 'Coding Assessment', 'Test programming logic and computational thinking', 15, 20),
  ('diag-tech', 'technology', 'Technology Assessment', 'Evaluate digital literacy and technical understanding', 12, 10),
  ('diag-study', 'study_skills', 'Study Skills Assessment', 'Assess learning strategies and productivity', 12, 10),
  ('diag-problem', 'problem_solving', 'Problem Solving Assessment', 'Test logic, puzzles, and analytical reasoning', 15, 15);

-- 2. Migrate Content from hyro_question_bank (Social Studies & Fin Lit)
-- 2. Migrate existing items from question bank if any
INSERT OR IGNORE INTO hyro_diagnostic_questions (
  id, test_id, stat_name, question_text, question_type, options, correct_answer, difficulty_level, topic, source
)
SELECT
  id,
  'diag-' || CASE
    WHEN domain = 'social_studies' THEN 'social'
    WHEN domain = 'financial_literacy' THEN 'finance'
    ELSE lower(domain)
  END,
  domain,
  question_text,
  question_type,
  answer_options as options,
  correct_answer,
  difficulty / 100.0 as difficulty_level,
  topic_id as topic,
  'question_bank_migration'
FROM hyro_question_bank
WHERE domain IN ('social_studies', 'financial_literacy');
