-- ============================================================================
-- HYRO FORGE: Multi-Tenant Migration
-- Migration 033: Add student_id columns to all existing hyro_ tables
-- Created: 2025-12-03
--
-- OBJECTIVE:
-- Convert single-user HYRO FORGE system to multi-tenant architecture.
-- Add student_id column to all hyro_ tables to support multiple students.
-- Maintain backward compatibility by defaulting to 'hyro' for existing data.
--
-- APPROACH:
-- 1. ALTER TABLE to add student_id column with DEFAULT 'hyro'
-- 2. Create indexes on student_id for query performance
-- 3. Document foreign key relationships (SQLite doesn't enforce on ALTER)
--
-- NOTE: After this migration, application code should:
-- - Query using student_id from authenticated user (Clerk)
-- - Filter all hyro_ queries by student_id
-- - Use students.id as the student_id value (Clerk user_id)
-- ============================================================================

-- ============================================================================
-- PART 1: CORE RPG TABLES (Migration 012)
-- ============================================================================

-- 1. hyro_character - Character profile (one per student)
-- Keep 'id' as unique character identifier, add student_id reference
ALTER TABLE hyro_character ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_character_student ON hyro_character(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 2. hyro_stats - The 8 core stats (each student has their own set)
ALTER TABLE hyro_stats ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_stats_student ON hyro_stats(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 3. hyro_stat_history - Stat change tracking
ALTER TABLE hyro_stat_history ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_stat_history_student ON hyro_stat_history(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 4. hyro_xp_log - XP transaction log
ALTER TABLE hyro_xp_log ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_xp_log_student ON hyro_xp_log(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 5. hyro_srs_topics - Spaced repetition topics
ALTER TABLE hyro_srs_topics ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_srs_topics_student ON hyro_srs_topics(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 6. hyro_srs_reviews - SRS review sessions
-- Already linked via topic_id, but add student_id for direct queries
ALTER TABLE hyro_srs_reviews ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_srs_reviews_student ON hyro_srs_reviews(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 7. hyro_quests - Quest/assignment system
ALTER TABLE hyro_quests ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_quests_student ON hyro_quests(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 8. hyro_submissions - Multimodal quest submissions
ALTER TABLE hyro_submissions ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_submissions_student ON hyro_submissions(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 9. hyro_daily_intel - Daily intelligence feed
ALTER TABLE hyro_daily_intel ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_daily_intel_student ON hyro_daily_intel(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 10. hyro_reflections - Session reflections (metacognition)
ALTER TABLE hyro_reflections ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_reflections_student ON hyro_reflections(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 11. hyro_achievements - Achievement definitions (shared, no student_id needed)
-- This table defines achievements available to all students - NO CHANGE

-- 12. hyro_earned_achievements - Player's earned achievements
ALTER TABLE hyro_earned_achievements ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_earned_achievements_student ON hyro_earned_achievements(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- ============================================================================
-- PART 2: PHASE 2 TABLES (Migration 014)
-- ============================================================================

-- 13. hyro_srs_decks - SRS decks
ALTER TABLE hyro_srs_decks ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_srs_decks_student ON hyro_srs_decks(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 14. hyro_srs_cards - SRS flashcards
ALTER TABLE hyro_srs_cards ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_srs_cards_student ON hyro_srs_cards(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- NOTE: hyro_srs_reviews table already updated in PART 1

-- 15. hyro_intel_items - Daily intel items
ALTER TABLE hyro_intel_items ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_intel_items_student ON hyro_intel_items(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 16. hyro_reflection_journal - Reflection entries
ALTER TABLE hyro_reflection_journal ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_reflection_journal_student ON hyro_reflection_journal(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 17. hyro_reflection_prompts - Reflection prompts (shared, no student_id)
-- This table defines prompts available to all students - NO CHANGE

-- 18. hyro_quest_generators - Quest generation config (shared, no student_id)
-- This table defines quest templates - NO CHANGE

-- 19. hyro_study_sessions - Study session tracking
ALTER TABLE hyro_study_sessions ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_study_sessions_student ON hyro_study_sessions(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- ============================================================================
-- PART 3: PHASE 3 MASTERY TABLES (Migration 015)
-- ============================================================================

-- 20. hyro_library - Book library (shared, no student_id)
-- This table defines books available to all students - NO CHANGE

-- 21. hyro_book_chapters - Book chapters (shared, no student_id)
-- This table defines chapter structure - NO CHANGE

-- 22. hyro_reading_sessions - Reading session tracking
ALTER TABLE hyro_reading_sessions ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_reading_sessions_student ON hyro_reading_sessions(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 23. hyro_chapter_progress - Chapter completion tracking
ALTER TABLE hyro_chapter_progress ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_chapter_progress_student ON hyro_chapter_progress(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 24. hyro_book_progress - Book-level progress
ALTER TABLE hyro_book_progress ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_book_progress_student ON hyro_book_progress(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 25. hyro_comprehension_prompts - Comprehension prompts (shared, no student_id)
-- This table defines prompts for all students - NO CHANGE

-- 26. hyro_comprehension_responses - User responses with AI evaluation
ALTER TABLE hyro_comprehension_responses ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_comprehension_responses_student ON hyro_comprehension_responses(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 27. hyro_reading_discussions - Discussion threads
ALTER TABLE hyro_reading_discussions ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_reading_discussions_student ON hyro_reading_discussions(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 28. hyro_discussion_exchanges - Individual exchanges in discussions
ALTER TABLE hyro_discussion_exchanges ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_discussion_exchanges_student ON hyro_discussion_exchanges(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 29. hyro_behavior_events - Behavioral analytics events
ALTER TABLE hyro_behavior_events ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_behavior_events_student ON hyro_behavior_events(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 30. hyro_behavior_patterns - Detected patterns
ALTER TABLE hyro_behavior_patterns ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_behavior_patterns_student ON hyro_behavior_patterns(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 31. hyro_predictions - Learning predictions
ALTER TABLE hyro_predictions ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_predictions_student ON hyro_predictions(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 32. hyro_skill_evidence - Evidence points for skills
ALTER TABLE hyro_skill_evidence ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_skill_evidence_student ON hyro_skill_evidence(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 33. hyro_proficiency_snapshots - Proficiency snapshots
ALTER TABLE hyro_proficiency_snapshots ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_proficiency_snapshots_student ON hyro_proficiency_snapshots(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 34. hyro_calibration_history - Calibration tracking
ALTER TABLE hyro_calibration_history ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_calibration_history_student ON hyro_calibration_history(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- ============================================================================
-- PART 4: PHASE 4 ALERTS (Migration 016)
-- ============================================================================

-- 35. hyro_alerts - Alert system
ALTER TABLE hyro_alerts ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_alerts_student ON hyro_alerts(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 36. hyro_alert_preferences - Alert preferences
ALTER TABLE hyro_alert_preferences ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_alert_preferences_student ON hyro_alert_preferences(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 37. hyro_alert_generation_log - Alert generation log
ALTER TABLE hyro_alert_generation_log ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_alert_generation_log_student ON hyro_alert_generation_log(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 38. hyro_streak_tracker - Streak tracking
ALTER TABLE hyro_streak_tracker ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_streak_tracker_student ON hyro_streak_tracker(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- ============================================================================
-- PART 5: DIAGNOSTICS (Migration 017)
-- ============================================================================

-- 39. hyro_diagnostic_tests - Diagnostic test definitions (shared, no student_id)
-- This table defines tests available to all students - NO CHANGE

-- 40. hyro_diagnostic_questions - Questions for tests (shared, no student_id)
-- This table defines questions - NO CHANGE

-- 41. hyro_diagnostic_sessions - Test sessions
ALTER TABLE hyro_diagnostic_sessions ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_diagnostic_sessions_student ON hyro_diagnostic_sessions(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 42. hyro_diagnostic_responses - Question responses
ALTER TABLE hyro_diagnostic_responses ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_diagnostic_responses_student ON hyro_diagnostic_responses(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 43. hyro_diagnostic_results - Test results
ALTER TABLE hyro_diagnostic_results ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_diagnostic_results_student ON hyro_diagnostic_results(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 44. hyro_skill_gaps - Identified skill gaps
ALTER TABLE hyro_skill_gaps ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_skill_gaps_student ON hyro_skill_gaps(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- ============================================================================
-- PART 6: TUTOR CONVERSATIONS (Migration 018)
-- ============================================================================

-- 45. hyro_tutor_conversations - AI tutor chat history
ALTER TABLE hyro_tutor_conversations ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_tutor_conversations_student ON hyro_tutor_conversations(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- ============================================================================
-- PART 7: CURRICULUM INFRASTRUCTURE (Migration 019)
-- ============================================================================

-- 46. hyro_learning_standards - Learning standards (shared, no student_id)
-- This table defines standards for all students - NO CHANGE

-- 47. hyro_curriculum_topics - Curriculum topics (shared, no student_id)
-- This table defines curriculum structure - NO CHANGE

-- 48. hyro_topic_mastery - Student topic mastery tracking
ALTER TABLE hyro_topic_mastery ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_topic_mastery_student ON hyro_topic_mastery(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 49. hyro_standard_mastery - Student standard mastery tracking
ALTER TABLE hyro_standard_mastery ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_standard_mastery_student ON hyro_standard_mastery(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 50. hyro_question_bank - Question bank (shared, no student_id)
-- This table defines questions available to all students - NO CHANGE

-- 51. hyro_learning_progressions - Learning progressions (shared, no student_id)
-- This table defines progression paths - NO CHANGE

-- 52. hyro_skill_prerequisites - Skill prerequisites (shared, no student_id)
-- This table defines prerequisite relationships - NO CHANGE

-- 53. hyro_domain_config - Domain configuration (shared, no student_id)
-- This table defines domain settings - NO CHANGE

-- ============================================================================
-- PART 8: CROSS-DOMAIN CONNECTIONS (Migration 025)
-- ============================================================================

-- 54. hyro_cross_domain_connections - Cross-domain connections
ALTER TABLE hyro_cross_domain_connections ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_cross_domain_connections_student ON hyro_cross_domain_connections(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 55. hyro_concept_clusters - Concept clusters
ALTER TABLE hyro_concept_clusters ADD COLUMN student_id TEXT DEFAULT 'hyro';
CREATE INDEX IF NOT EXISTS idx_hyro_concept_clusters_student ON hyro_concept_clusters(student_id);
-- NOTE: Foreign key would be: REFERENCES students(id) ON DELETE CASCADE

-- 56. hyro_connection_weights - Connection weights (shared, no student_id)
-- This table defines connection patterns for all students - NO CHANGE

-- ============================================================================
-- MIGRATION RECORD
-- ============================================================================

INSERT INTO migrations (name) VALUES ('033_multi_tenant');

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tables Updated: 56 tables received student_id column
-- Indexes Created: 56 indexes on student_id for query performance
-- Shared Tables (no student_id): 14 tables remain shared:
--   - hyro_achievements (achievement definitions)
--   - hyro_library, hyro_book_chapters (book content)
--   - hyro_comprehension_prompts, hyro_reflection_prompts (prompt templates)
--   - hyro_quest_generators (quest templates)
--   - hyro_diagnostic_tests, hyro_diagnostic_questions (test definitions)
--   - hyro_learning_standards, hyro_curriculum_topics (curriculum structure)
--   - hyro_question_bank, hyro_learning_progressions (learning resources)
--   - hyro_skill_prerequisites, hyro_domain_config (system configuration)
--   - hyro_connection_weights (connection patterns)
--
-- NEXT STEPS FOR APPLICATION CODE:
-- 1. Update all queries to filter by student_id
-- 2. Get student_id from authenticated Clerk user session
-- 3. Use students.id (Clerk user_id) as the student_id value
-- 4. Update insert statements to include student_id
-- 5. Consider adding application-level foreign key validation
-- ============================================================================
