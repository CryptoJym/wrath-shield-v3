-- HYRO FORGE: Rename stats from creative RPG names to standard educational terms
-- Migration 013: Stat name standardization
-- Created: 2025-12-01
--
-- Mapping:
--   math_velocity → math (Mathematics)
--   linguistic_edge → reading (Reading & Language Arts)
--   physics_grip → science (Science)
--   logic_shred → coding (Coding & Logic)
--   meta_mastery → study_skills (Study Skills)
--   systems_sight → critical_thinking (Critical Thinking)
--   ai_command → technology (Technology)
--   arsenal_wield → problem_solving (Problem Solving)

-- ============================================================================
-- PART 1: UPDATE hyro_stats TABLE
-- ============================================================================

UPDATE hyro_stats SET
  stat_name = 'math',
  display_name = 'Mathematics',
  description = 'Mathematical reasoning, problem-solving, and numeracy - measured via Zearn progress and assessments'
WHERE stat_name = 'math_velocity';

UPDATE hyro_stats SET
  stat_name = 'reading',
  display_name = 'Reading & Language Arts',
  description = 'Reading comprehension, grammar, vocabulary, and writing skills - measured via Quill/NoRedInk'
WHERE stat_name = 'linguistic_edge';

UPDATE hyro_stats SET
  stat_name = 'science',
  display_name = 'Science',
  description = 'Scientific reasoning, inquiry, and understanding of natural phenomena'
WHERE stat_name = 'physics_grip';

UPDATE hyro_stats SET
  stat_name = 'coding',
  display_name = 'Coding & Logic',
  description = 'Computational thinking, programming concepts, and algorithmic reasoning'
WHERE stat_name = 'logic_shred';

UPDATE hyro_stats SET
  stat_name = 'study_skills',
  display_name = 'Study Skills',
  description = 'Learning strategies, organization, time management, and metacognition'
WHERE stat_name = 'meta_mastery';

UPDATE hyro_stats SET
  stat_name = 'critical_thinking',
  display_name = 'Critical Thinking',
  description = 'Analysis, evaluation, pattern recognition, and cross-domain reasoning'
WHERE stat_name = 'systems_sight';

UPDATE hyro_stats SET
  stat_name = 'technology',
  display_name = 'Technology',
  description = 'Digital literacy, technology fluency, and effective use of tools'
WHERE stat_name = 'ai_command';

UPDATE hyro_stats SET
  stat_name = 'problem_solving',
  display_name = 'Problem Solving',
  description = 'Applying frameworks, strategies, and approaches to solve complex challenges'
WHERE stat_name = 'arsenal_wield';

-- ============================================================================
-- PART 2: UPDATE hyro_stat_history TABLE
-- ============================================================================

UPDATE hyro_stat_history SET stat_name = 'math' WHERE stat_name = 'math_velocity';
UPDATE hyro_stat_history SET stat_name = 'reading' WHERE stat_name = 'linguistic_edge';
UPDATE hyro_stat_history SET stat_name = 'science' WHERE stat_name = 'physics_grip';
UPDATE hyro_stat_history SET stat_name = 'coding' WHERE stat_name = 'logic_shred';
UPDATE hyro_stat_history SET stat_name = 'study_skills' WHERE stat_name = 'meta_mastery';
UPDATE hyro_stat_history SET stat_name = 'critical_thinking' WHERE stat_name = 'systems_sight';
UPDATE hyro_stat_history SET stat_name = 'technology' WHERE stat_name = 'ai_command';
UPDATE hyro_stat_history SET stat_name = 'problem_solving' WHERE stat_name = 'arsenal_wield';

-- ============================================================================
-- PART 3: UPDATE hyro_srs_topics DOMAIN FIELD
-- ============================================================================

UPDATE hyro_srs_topics SET domain = 'math' WHERE domain = 'math_velocity';
UPDATE hyro_srs_topics SET domain = 'reading' WHERE domain = 'linguistic_edge';
UPDATE hyro_srs_topics SET domain = 'science' WHERE domain = 'physics_grip';
UPDATE hyro_srs_topics SET domain = 'coding' WHERE domain = 'logic_shred';
UPDATE hyro_srs_topics SET domain = 'study_skills' WHERE domain = 'meta_mastery';
UPDATE hyro_srs_topics SET domain = 'critical_thinking' WHERE domain = 'systems_sight';
UPDATE hyro_srs_topics SET domain = 'technology' WHERE domain = 'ai_command';
UPDATE hyro_srs_topics SET domain = 'problem_solving' WHERE domain = 'arsenal_wield';

-- ============================================================================
-- PART 4: UPDATE hyro_quests REQUIRED_STAT FIELD
-- ============================================================================

UPDATE hyro_quests SET required_stat = 'math' WHERE required_stat = 'math_velocity';
UPDATE hyro_quests SET required_stat = 'reading' WHERE required_stat = 'linguistic_edge';
UPDATE hyro_quests SET required_stat = 'science' WHERE required_stat = 'physics_grip';
UPDATE hyro_quests SET required_stat = 'coding' WHERE required_stat = 'logic_shred';
UPDATE hyro_quests SET required_stat = 'study_skills' WHERE required_stat = 'meta_mastery';
UPDATE hyro_quests SET required_stat = 'critical_thinking' WHERE required_stat = 'systems_sight';
UPDATE hyro_quests SET required_stat = 'technology' WHERE required_stat = 'ai_command';
UPDATE hyro_quests SET required_stat = 'problem_solving' WHERE required_stat = 'arsenal_wield';

-- ============================================================================
-- PART 5: UPDATE hyro_achievements REQUIREMENT_STAT FIELD
-- ============================================================================

UPDATE hyro_achievements SET requirement_stat = 'math' WHERE requirement_stat = 'math_velocity';
UPDATE hyro_achievements SET requirement_stat = 'reading' WHERE requirement_stat = 'linguistic_edge';
UPDATE hyro_achievements SET requirement_stat = 'science' WHERE requirement_stat = 'physics_grip';
UPDATE hyro_achievements SET requirement_stat = 'coding' WHERE requirement_stat = 'logic_shred';
UPDATE hyro_achievements SET requirement_stat = 'study_skills' WHERE requirement_stat = 'meta_mastery';
UPDATE hyro_achievements SET requirement_stat = 'critical_thinking' WHERE requirement_stat = 'systems_sight';
UPDATE hyro_achievements SET requirement_stat = 'technology' WHERE requirement_stat = 'ai_command';
UPDATE hyro_achievements SET requirement_stat = 'problem_solving' WHERE requirement_stat = 'arsenal_wield';

-- Also update achievement names/descriptions to match new terminology
UPDATE hyro_achievements SET
  name = 'Math Novice',
  description = 'Reach Mathematics skill level 25'
WHERE id = 'ach_math_25';

UPDATE hyro_achievements SET
  name = 'Math Adept',
  description = 'Reach Mathematics skill level 50'
WHERE id = 'ach_math_50';

UPDATE hyro_achievements SET
  name = 'Bookworm',
  description = 'Reach Reading & Language Arts skill level 25'
WHERE id = 'ach_lang_25';

-- Record migration
INSERT INTO migrations (name) VALUES ('013_rename_stats_educational');
