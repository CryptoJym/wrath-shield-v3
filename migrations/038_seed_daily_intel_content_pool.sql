-- ============================================================================
-- HYRO FORGE: Seed Daily Intel Content Pool
-- Migration 038: Create a larger pool of educational content for daily rotation
-- Created: 2025-12-04
--
-- Creates a content pool table with 50+ items that can be selected daily
-- The generateDailyIntel function will pick 5-7 items per day based on:
-- - Subject variety
-- - Difficulty mix
-- - Previously viewed content
-- ============================================================================

-- Create content pool table for intel generation
CREATE TABLE IF NOT EXISTS hyro_intel_content_pool (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  content_type TEXT NOT NULL,  -- video, article, quiz, fact, challenge
  subject TEXT,
  difficulty TEXT DEFAULT 'medium',
  source_url TEXT,
  source_name TEXT,
  thumbnail_url TEXT,
  estimated_time_minutes INTEGER,
  xp_reward INTEGER DEFAULT 10,
  tags TEXT,  -- JSON array of tags
  age_appropriate INTEGER DEFAULT 1,  -- 1 = true, 0 = false
  times_used INTEGER DEFAULT 0,
  last_used_date TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_intel_pool_subject ON hyro_intel_content_pool(subject);
CREATE INDEX IF NOT EXISTS idx_intel_pool_type ON hyro_intel_content_pool(content_type);

-- ============================================================================
-- MATH CONTENT
-- ============================================================================
INSERT INTO hyro_intel_content_pool (id, title, summary, content_type, subject, difficulty, estimated_time_minutes, xp_reward, source_name, tags)
VALUES
  ('pool_math_01', 'Math Mystery: The Fibonacci Sequence in Nature', 'Discover how this famous number pattern appears in sunflowers, pinecones, and galaxies!', 'video', 'math', 'medium', 8, 15, 'Numberphile', '["patterns","nature","sequences"]'),
  ('pool_math_02', 'Why is Pi Infinite?', 'Explore the mystery of pi and why mathematicians have calculated trillions of digits', 'video', 'math', 'medium', 7, 12, 'Veritasium', '["pi","circles","infinity"]'),
  ('pool_math_03', 'Quick Quiz: Fraction Fundamentals', '10 questions to test your fraction skills - adding, subtracting, and simplifying', 'quiz', 'math', 'easy', 5, 15, 'Forge', '["fractions","quiz"]'),
  ('pool_math_04', 'The Magic of Prime Numbers', 'Why prime numbers are the building blocks of all numbers', 'article', 'math', 'medium', 10, 12, 'Math is Fun', '["primes","number-theory"]'),
  ('pool_math_05', 'Geometry Challenge: Calculate the Mystery Shape', 'Use area and perimeter clues to identify the hidden shape', 'challenge', 'math', 'hard', 15, 25, 'Forge', '["geometry","problem-solving"]'),
  ('pool_math_06', 'Fun Fact: Zero Was Invented Twice!', 'The fascinating history of zero and why ancient civilizations had trouble with "nothing"', 'fact', 'math', 'easy', 3, 5, 'History of Math', '["history","zero","fun-fact"]'),
  ('pool_math_07', 'Decimals Decoded: Understanding Place Value', 'Master the relationship between fractions and decimals', 'video', 'math', 'easy', 6, 10, 'Khan Academy', '["decimals","place-value"]'),
  ('pool_math_08', 'Quick Quiz: Percent Problems', 'Calculate discounts, tips, and more in this real-world percent quiz', 'quiz', 'math', 'medium', 6, 15, 'Forge', '["percents","real-world"]');

-- ============================================================================
-- SCIENCE CONTENT
-- ============================================================================
INSERT INTO hyro_intel_content_pool (id, title, summary, content_type, subject, difficulty, estimated_time_minutes, xp_reward, source_name, tags)
VALUES
  ('pool_sci_01', 'Fun Fact: Octopuses Have 3 Hearts!', 'Learn about the amazing biology of one of the ocean''s smartest creatures', 'fact', 'science', 'easy', 2, 5, 'National Geographic', '["animals","biology","fun-fact"]'),
  ('pool_sci_02', 'How Do Rockets Work?', 'Understand Newton''s Third Law through rocket propulsion', 'video', 'science', 'medium', 10, 15, 'NASA', '["physics","space","rockets"]'),
  ('pool_sci_03', 'The Water Cycle Adventure', 'Follow a water droplet on its journey through evaporation, condensation, and precipitation', 'video', 'science', 'easy', 8, 12, 'PBS', '["earth-science","weather"]'),
  ('pool_sci_04', 'Quick Quiz: Test Your Geography Knowledge', '10 questions about countries, capitals, and continents', 'quiz', 'science', 'medium', 5, 15, 'Forge', '["geography","quiz"]'),
  ('pool_sci_05', 'Fun Fact: Honey Never Spoils', 'Archaeologists found 3000-year-old honey in Egyptian tombs that was still edible!', 'fact', 'science', 'easy', 2, 5, 'Science Daily', '["chemistry","food","fun-fact"]'),
  ('pool_sci_06', 'Inside a Cell: The Mitochondria Story', 'Why mitochondria are called the powerhouse of the cell', 'video', 'science', 'medium', 9, 12, 'Amoeba Sisters', '["biology","cells"]'),
  ('pool_sci_07', 'Volcano Challenge: Predict the Eruption', 'Analyze earthquake data and gas emissions to predict when a volcano will erupt', 'challenge', 'science', 'hard', 12, 20, 'Forge', '["earth-science","geology"]'),
  ('pool_sci_08', 'Fun Fact: Lightning Is Hotter Than the Sun!', 'A lightning bolt can reach 30,000 Kelvin - five times hotter than the sun''s surface', 'fact', 'science', 'easy', 2, 5, 'Weather Channel', '["weather","physics","fun-fact"]'),
  ('pool_sci_09', 'The Periodic Table Explained', 'How scientists organized all the elements and what the patterns mean', 'article', 'science', 'medium', 12, 15, 'Chemistry.com', '["chemistry","elements"]'),
  ('pool_sci_10', 'Quick Quiz: Solar System Challenge', 'How well do you know our cosmic neighborhood?', 'quiz', 'science', 'medium', 7, 15, 'Forge', '["space","astronomy"]');

-- ============================================================================
-- READING/LANGUAGE ARTS CONTENT
-- ============================================================================
INSERT INTO hyro_intel_content_pool (id, title, summary, content_type, subject, difficulty, estimated_time_minutes, xp_reward, source_name, tags)
VALUES
  ('pool_read_01', 'Reading Adventure: The History of Comic Books', 'From Superman to Spider-Man, explore how your favorite heroes came to be!', 'article', 'reading', 'easy', 10, 10, 'Smithsonian', '["history","comics","pop-culture"]'),
  ('pool_read_02', 'Word Roots Challenge: Decode the Mystery Word', 'Use Greek and Latin roots to figure out the meaning of unfamiliar words', 'challenge', 'reading', 'medium', 10, 20, 'Forge', '["vocabulary","roots"]'),
  ('pool_read_03', 'Fun Fact: Shakespeare Invented 1700+ Words', 'Words like "eyeball," "bedroom," and "lonely" were all created by the Bard!', 'fact', 'reading', 'easy', 2, 5, 'Oxford Dictionary', '["vocabulary","history","fun-fact"]'),
  ('pool_read_04', 'Quick Quiz: Vocabulary Builder', 'Match words to their definitions and expand your word power', 'quiz', 'reading', 'medium', 6, 15, 'Forge', '["vocabulary","quiz"]'),
  ('pool_read_05', 'How Stories Spread: From Oral Tales to TikTok', 'The evolution of storytelling from cave paintings to social media', 'video', 'reading', 'medium', 8, 12, 'Ted-Ed', '["storytelling","history"]'),
  ('pool_read_06', 'Poetry Power: Understanding Metaphors', 'Learn how poets use comparison to create vivid images', 'article', 'reading', 'medium', 8, 10, 'Poetry Foundation', '["poetry","figurative-language"]'),
  ('pool_read_07', 'Fun Fact: The World''s Longest Book Has 10+ Million Words', 'Meet the writers who created literary marathons', 'fact', 'reading', 'easy', 2, 5, 'Guinness Records', '["books","fun-fact"]');

-- ============================================================================
-- CODING/TECHNOLOGY CONTENT
-- ============================================================================
INSERT INTO hyro_intel_content_pool (id, title, summary, content_type, subject, difficulty, estimated_time_minutes, xp_reward, source_name, tags)
VALUES
  ('pool_code_01', 'Code Challenge: Build a Simple Calculator', 'Use what you know about variables and functions to create a working calculator!', 'challenge', 'coding', 'medium', 20, 25, 'Forge', '["python","functions","math"]'),
  ('pool_code_02', 'How Video Games Are Made', 'From concept art to code: the journey of creating a game', 'video', 'coding', 'easy', 12, 15, 'Extra Credits', '["game-dev","careers"]'),
  ('pool_code_03', 'Fun Fact: The First Programmer Was a Woman', 'Ada Lovelace wrote the first algorithm in the 1840s!', 'fact', 'technology', 'easy', 3, 5, 'Computer History', '["history","pioneers","fun-fact"]'),
  ('pool_code_04', 'Debug Detective: Find the Bug', 'Can you spot the error in this code before it crashes?', 'challenge', 'coding', 'medium', 8, 15, 'Forge', '["debugging","problem-solving"]'),
  ('pool_code_05', 'Quick Quiz: Python Basics', 'Test your knowledge of variables, loops, and conditionals', 'quiz', 'coding', 'easy', 5, 15, 'Forge', '["python","quiz"]'),
  ('pool_code_06', 'AI Explained: How ChatGPT Works', 'Understand the basics of how AI learns to talk like humans', 'video', 'technology', 'medium', 10, 15, 'Crash Course', '["ai","machine-learning"]'),
  ('pool_code_07', 'The Internet: How Data Travels the World', 'From your click to the server and back in milliseconds', 'video', 'technology', 'medium', 8, 12, 'Vox', '["internet","networking"]'),
  ('pool_code_08', 'Fun Fact: The First Computer Bug Was an Actual Bug', 'A moth caused a computer malfunction in 1947!', 'fact', 'technology', 'easy', 2, 5, 'Computer History', '["history","fun-fact"]');

-- ============================================================================
-- STUDY SKILLS & CRITICAL THINKING CONTENT
-- ============================================================================
INSERT INTO hyro_intel_content_pool (id, title, summary, content_type, subject, difficulty, estimated_time_minutes, xp_reward, source_name, tags)
VALUES
  ('pool_study_01', 'Memory Master: The Pomodoro Technique', 'Learn the famous 25-minute focus method used by top students', 'video', 'study_skills', 'easy', 5, 10, 'Study Tips', '["time-management","focus"]'),
  ('pool_study_02', 'Quick Quiz: How to Study Smart', 'Test your knowledge of effective study techniques', 'quiz', 'study_skills', 'easy', 5, 12, 'Forge', '["study-tips","quiz"]'),
  ('pool_study_03', 'Brain Boost: How Sleep Affects Learning', 'Why getting enough sleep is your secret study weapon', 'article', 'study_skills', 'medium', 8, 10, 'Brain Facts', '["sleep","memory"]'),
  ('pool_study_04', 'Logic Puzzle: The Farmer''s Riddle', 'How does the farmer get the fox, chicken, and grain across the river?', 'challenge', 'critical_thinking', 'medium', 10, 20, 'Forge', '["logic","puzzle"]'),
  ('pool_study_05', 'Fun Fact: Doodling Helps You Remember', 'Studies show that drawing while listening can improve memory by 29%!', 'fact', 'study_skills', 'easy', 2, 5, 'Science Journal', '["memory","fun-fact"]'),
  ('pool_study_06', 'Critical Thinking: Spot the Fake News', 'Learn to identify misleading headlines and biased sources', 'video', 'critical_thinking', 'medium', 10, 15, 'News Literacy Project', '["media-literacy","analysis"]'),
  ('pool_study_07', 'Logic Challenge: Pattern Detective', 'Can you figure out what comes next in these tricky sequences?', 'challenge', 'critical_thinking', 'hard', 12, 25, 'Forge', '["patterns","logic"]');

-- ============================================================================
-- PROBLEM SOLVING CONTENT
-- ============================================================================
INSERT INTO hyro_intel_content_pool (id, title, summary, content_type, subject, difficulty, estimated_time_minutes, xp_reward, source_name, tags)
VALUES
  ('pool_solve_01', 'Escape Room Challenge: The Locked Lab', 'Solve puzzles to escape the mad scientist''s laboratory!', 'challenge', 'problem_solving', 'hard', 15, 30, 'Forge', '["puzzles","escape-room"]'),
  ('pool_solve_02', 'Quick Quiz: Brain Teasers', '10 tricky riddles to test your problem-solving skills', 'quiz', 'problem_solving', 'medium', 8, 15, 'Forge', '["riddles","quiz"]'),
  ('pool_solve_03', 'How Engineers Solve Impossible Problems', 'Learn the design thinking process used by real engineers', 'video', 'problem_solving', 'medium', 10, 12, 'Engineering Explained', '["engineering","design-thinking"]'),
  ('pool_solve_04', 'Fun Fact: The Rubik''s Cube Can Be Solved in 20 Moves or Less', 'No matter how scrambled, there''s always a short solution!', 'fact', 'problem_solving', 'easy', 2, 5, 'Rubik''s Official', '["puzzles","fun-fact"]');

-- Record migration
INSERT INTO migrations (name) VALUES ('038_seed_daily_intel_content_pool');
