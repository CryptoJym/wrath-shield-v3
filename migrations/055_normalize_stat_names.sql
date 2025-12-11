-- Migration: Normalize stat_name values to match code enums
-- "Mathematics" -> "math"
-- "Reading" -> "reading"
-- "Science" -> "science"
-- "Critical Thinking" -> "critical_thinking"

-- 1. Update hyro_diagnostic_tests
UPDATE hyro_diagnostic_tests SET stat_name = 'math' WHERE stat_name = 'Mathematics';
UPDATE hyro_diagnostic_tests SET stat_name = 'reading' WHERE stat_name = 'Reading';
UPDATE hyro_diagnostic_tests SET stat_name = 'science' WHERE stat_name = 'Science';
UPDATE hyro_diagnostic_tests SET stat_name = 'critical_thinking' WHERE stat_name = 'Critical Thinking';

-- 2. Update hyro_diagnostic_questions
UPDATE hyro_diagnostic_questions SET stat_name = 'math' WHERE stat_name = 'Mathematics';
UPDATE hyro_diagnostic_questions SET stat_name = 'reading' WHERE stat_name = 'Reading';
UPDATE hyro_diagnostic_questions SET stat_name = 'science' WHERE stat_name = 'Science';
UPDATE hyro_diagnostic_questions SET stat_name = 'critical_thinking' WHERE stat_name = 'Critical Thinking';
