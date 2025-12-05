-- ============================================================================
-- HYRO FORGE: Fix Library Schema and Seed Sample Books
-- Migration 035: Add student_id to hyro_library and seed sample books
-- Created: 2025-12-04
--
-- PROBLEMS:
-- 1. hyro_library table has no student_id column, but getLibrary() queries by it
-- 2. No sample books exist in the library
--
-- SOLUTION:
-- 1. Add student_id column to hyro_library (NULL = shared books)
-- 2. Seed sample 6th grade appropriate books
-- ============================================================================

-- Step 1: Add student_id column to hyro_library
ALTER TABLE hyro_library ADD COLUMN student_id TEXT DEFAULT NULL;

-- Step 2: Create index on student_id for query performance
CREATE INDEX IF NOT EXISTS idx_hyro_library_student ON hyro_library(student_id);

-- Step 3: Seed sample books (shared library, student_id = NULL)
-- These are 6th-grade appropriate classics and popular books

INSERT INTO hyro_library (id, title, author, genre, difficulty_level, page_count, chapter_count, estimated_hours, description, themes, stat_primary, stat_secondary, is_active)
VALUES
  -- Fiction / Literature
  ('book_hatchet', 'Hatchet', 'Gary Paulsen', 'Adventure Fiction', 'grade_6', 195, 19, 4, 'After a plane crash, 13-year-old Brian must survive alone in the Canadian wilderness with only a hatchet.', '["survival", "nature", "self-reliance", "resilience"]', 'reading', 'critical_thinking', 1),

  ('book_holes', 'Holes', 'Louis Sachar', 'Fiction', 'grade_5', 233, 50, 5, 'Stanley Yelnats is sent to Camp Green Lake where boys dig holes to build character. But there is more to the camp than meets the eye.', '["justice", "friendship", "perseverance", "family legacy"]', 'reading', 'problem_solving', 1),

  ('book_wrinkle', 'A Wrinkle in Time', 'Madeleine L''Engle', 'Science Fiction', 'grade_6', 211, 12, 5, 'Meg Murry and her friends travel through space and time to rescue her father from an evil force.', '["family", "courage", "good vs evil", "individuality"]', 'reading', 'science', 1),

  ('book_giver', 'The Giver', 'Lois Lowry', 'Dystopian Fiction', 'grade_6', 180, 23, 4, 'In a seemingly perfect society, Jonas is selected to inherit the position of Receiver of Memory and learns the dark truth about his utopian world.', '["freedom", "memory", "choices", "conformity"]', 'reading', 'critical_thinking', 1),

  ('book_outsiders', 'The Outsiders', 'S.E. Hinton', 'Realistic Fiction', 'grade_7', 192, 12, 4, 'Ponyboy Curtis struggles with the social divide between the rich Socs and the poor Greasers in 1960s Oklahoma.', '["identity", "social class", "loyalty", "growing up"]', 'reading', 'study_skills', 1),

  ('book_wonder', 'Wonder', 'R.J. Palacio', 'Realistic Fiction', 'grade_5', 315, 88, 6, 'August Pullman, born with facial differences, starts fifth grade at a mainstream school and teaches everyone about kindness.', '["kindness", "acceptance", "courage", "empathy"]', 'reading', 'critical_thinking', 1),

  -- Science & STEM
  ('book_mars_rover', 'The Mars Rover: A Race to the Red Planet', 'Steve Kortenkamp', 'Non-Fiction Science', 'grade_6', 48, 8, 2, 'Learn about NASA''s Mars rovers and the incredible engineering behind exploring the red planet.', '["space exploration", "engineering", "science", "teamwork"]', 'science', 'technology', 1),

  ('book_hidden_figures', 'Hidden Figures (Young Readers Edition)', 'Margot Lee Shetterly', 'Non-Fiction', 'grade_6', 240, 24, 5, 'The true story of four African-American women mathematicians who helped win the space race.', '["perseverance", "equality", "STEM", "history"]', 'math', 'science', 1),

  ('book_code_name', 'Code Name Cassandra', 'Meg Cabot', 'Mystery/Thriller', 'grade_6', 304, 22, 6, 'A thrilling adventure that combines mystery with elements of psychic abilities.', '["mystery", "friendship", "adventure", "problem-solving"]', 'reading', 'problem_solving', 1),

  -- Coding / Technology Focus
  ('book_hello_world', 'Hello World! Computer Programming for Kids', 'Warren Sande', 'Non-Fiction Technology', 'grade_6', 435, 20, 10, 'A fun introduction to computer programming using Python, with games and activities.', '["programming", "problem-solving", "creativity", "technology"]', 'coding', 'problem_solving', 1),

  -- Math Focus
  ('book_math_curse', 'Math Curse', 'Jon Scieszka', 'Fiction/Math', 'grade_5', 32, 1, 0.5, 'When a teacher says you can think of almost everything as a math problem, one student takes it literally.', '["math anxiety", "problem-solving", "humor", "everyday math"]', 'math', 'critical_thinking', 1),

  ('book_phantom_tollbooth', 'The Phantom Tollbooth', 'Norton Juster', 'Fantasy', 'grade_6', 256, 20, 5, 'Milo journeys through a magical land where he learns to appreciate learning, numbers, and words.', '["learning", "imagination", "wordplay", "math concepts"]', 'reading', 'math', 1);

-- Step 4: Record migration
INSERT INTO migrations (name) VALUES ('035_fix_library_and_seed_books');
