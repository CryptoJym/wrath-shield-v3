-- Migration: 017_hyro_diagnostics.sql
-- HYRO FORGE: Diagnostic Assessment System
-- Initial assessments, question banks, and gap identification

-- ============================================================================
-- DIAGNOSTIC TESTS (Test Templates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_diagnostic_tests (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  question_count INTEGER NOT NULL,
  time_limit_minutes INTEGER DEFAULT 15,
  difficulty_curve TEXT DEFAULT 'adaptive', -- 'adaptive', 'fixed', 'progressive'
  grade_level INTEGER DEFAULT 6,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================================
-- DIAGNOSTIC QUESTIONS (Question Bank)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_diagnostic_questions (
  id TEXT PRIMARY KEY,
  test_id TEXT,
  stat_name TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'multiple_choice', 'short_answer', 'true_false', 'fill_blank'
  options TEXT, -- JSON array for multiple choice
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  difficulty_level REAL NOT NULL, -- 0.0 to 1.0
  topic TEXT,
  subtopic TEXT,
  common_misconceptions TEXT, -- JSON array
  hints TEXT, -- JSON array of progressive hints
  time_estimate_seconds INTEGER DEFAULT 60,
  source TEXT, -- 'system', 'manual', 'ai_generated'
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (test_id) REFERENCES hyro_diagnostic_tests(id)
);

-- ============================================================================
-- DIAGNOSTIC SESSIONS (Active Tests)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_diagnostic_sessions (
  id TEXT PRIMARY KEY,
  test_id TEXT,
  stat_name TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned'
  started_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER,
  time_spent_seconds INTEGER DEFAULT 0,
  questions_total INTEGER NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  current_difficulty REAL DEFAULT 0.5, -- For adaptive tests
  adaptive_history TEXT, -- JSON: tracks difficulty adjustments
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (test_id) REFERENCES hyro_diagnostic_tests(id)
);

-- ============================================================================
-- DIAGNOSTIC RESPONSES (Individual Question Answers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_diagnostic_responses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  user_answer TEXT,
  is_correct INTEGER,
  time_spent_seconds INTEGER,
  confidence_before INTEGER, -- 1-5 self-assessment before answering
  difficulty_at_time REAL, -- Difficulty when question was presented
  hints_used INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES hyro_diagnostic_sessions(id),
  FOREIGN KEY (question_id) REFERENCES hyro_diagnostic_questions(id)
);

-- ============================================================================
-- DIAGNOSTIC RESULTS (Final Assessment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_diagnostic_results (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  stat_name TEXT NOT NULL,
  raw_score INTEGER NOT NULL, -- Questions correct
  total_questions INTEGER NOT NULL,
  percentage_score REAL NOT NULL,
  estimated_level INTEGER NOT NULL, -- 0-100 proficiency estimate
  confidence_low INTEGER, -- Lower bound of 95% CI
  confidence_high INTEGER, -- Upper bound of 95% CI
  identified_gaps TEXT, -- JSON array of skill gaps
  strong_areas TEXT, -- JSON array of strengths
  recommended_focus TEXT, -- JSON array of priority areas
  topic_breakdown TEXT, -- JSON: { topic: { correct: n, total: n, level: n } }
  calibration_data TEXT, -- JSON: self-assessment vs actual performance
  time_spent_seconds INTEGER,
  completed_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES hyro_diagnostic_sessions(id)
);

-- ============================================================================
-- SKILL GAPS (Identified Weaknesses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_skill_gaps (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  gap_severity TEXT NOT NULL, -- 'minor', 'moderate', 'significant', 'critical'
  current_level INTEGER, -- 0-100
  target_level INTEGER DEFAULT 70,
  identified_from TEXT, -- 'diagnostic', 'comprehension', 'srs', 'quest'
  source_id TEXT, -- Reference to what identified it
  status TEXT DEFAULT 'active', -- 'active', 'in_progress', 'resolved'
  evidence_count INTEGER DEFAULT 1,
  first_identified INTEGER DEFAULT (unixepoch()),
  last_confirmed INTEGER DEFAULT (unixepoch()),
  resolved_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_diag_questions_stat ON hyro_diagnostic_questions(stat_name);
CREATE INDEX IF NOT EXISTS idx_diag_questions_difficulty ON hyro_diagnostic_questions(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_diag_questions_topic ON hyro_diagnostic_questions(topic);
CREATE INDEX IF NOT EXISTS idx_diag_sessions_status ON hyro_diagnostic_sessions(status);
CREATE INDEX IF NOT EXISTS idx_diag_results_stat ON hyro_diagnostic_results(stat_name);
CREATE INDEX IF NOT EXISTS idx_skill_gaps_stat ON hyro_skill_gaps(stat_name, status);
CREATE INDEX IF NOT EXISTS idx_skill_gaps_severity ON hyro_skill_gaps(gap_severity);

-- ============================================================================
-- SEED: Initial Diagnostic Tests (One per stat)
-- ============================================================================
INSERT OR IGNORE INTO hyro_diagnostic_tests (id, stat_name, title, description, question_count, time_limit_minutes) VALUES
  ('diag-math', 'math', 'Math Assessment', 'Evaluate understanding of 6th grade mathematics concepts', 20, 20),
  ('diag-reading', 'reading', 'Reading Assessment', 'Assess reading comprehension and vocabulary skills', 15, 15),
  ('diag-science', 'science', 'Science Assessment', 'Test understanding of scientific concepts and method', 15, 15),
  ('diag-coding', 'coding', 'Coding Assessment', 'Evaluate programming logic and syntax understanding', 15, 20),
  ('diag-study', 'study_skills', 'Study Skills Assessment', 'Assess time management and study strategies', 12, 10),
  ('diag-critical', 'critical_thinking', 'Critical Thinking Assessment', 'Test logical reasoning and analysis skills', 15, 15),
  ('diag-tech', 'technology', 'Technology Assessment', 'Evaluate digital literacy and tech understanding', 12, 10),
  ('diag-problem', 'problem_solving', 'Problem Solving Assessment', 'Test multi-step problem solving abilities', 12, 15);

-- ============================================================================
-- SEED: Sample Math Questions (Multiple Difficulty Levels)
-- ============================================================================
INSERT OR IGNORE INTO hyro_diagnostic_questions (id, test_id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, subtopic, common_misconceptions) VALUES
  -- Easy (0.2)
  ('q-math-001', 'diag-math', 'math', 'What is 25 + 37?', 'multiple_choice', '["52", "62", "72", "42"]', '62', 'Add the ones place (5+7=12, carry 1), then add tens place (2+3+1=6). Answer: 62', 0.2, 'arithmetic', 'addition', '["Forgetting to carry", "Misreading numbers"]'),
  ('q-math-002', 'diag-math', 'math', 'What is 8 x 7?', 'multiple_choice', '["54", "56", "63", "48"]', '56', '8 x 7 = 56. This is part of the times tables.', 0.2, 'arithmetic', 'multiplication', '["Confusing with 8x6=48", "Confusing with 7x7=49"]'),
  ('q-math-003', 'diag-math', 'math', 'Simplify: 12/16', 'multiple_choice', '["2/4", "3/4", "4/3", "6/8"]', '3/4', 'Both 12 and 16 can be divided by 4. 12/4=3, 16/4=4. So 12/16 = 3/4', 0.25, 'fractions', 'simplifying', '["Not fully simplifying (6/8)", "Dividing wrong"]'),

  -- Medium (0.4-0.6)
  ('q-math-004', 'diag-math', 'math', 'Solve for x: 3x + 7 = 22', 'multiple_choice', '["3", "5", "7", "15"]', '5', 'Subtract 7 from both sides: 3x = 15. Divide by 3: x = 5', 0.4, 'algebra', 'linear_equations', '["Forgetting to do same to both sides", "Order of operations error"]'),
  ('q-math-005', 'diag-math', 'math', 'What is 15% of 80?', 'multiple_choice', '["8", "12", "15", "20"]', '12', '15% = 0.15. 0.15 x 80 = 12. Or: 10% of 80 = 8, 5% of 80 = 4, 8+4 = 12', 0.45, 'percentages', 'finding_percent_of', '["Confusing percent with decimal", "Calculation errors"]'),
  ('q-math-006', 'diag-math', 'math', 'The ratio of boys to girls in a class is 3:5. If there are 24 boys, how many girls are there?', 'multiple_choice', '["30", "35", "40", "45"]', '40', 'If 3 parts = 24, then 1 part = 8. Girls = 5 parts = 5 x 8 = 40', 0.5, 'ratios', 'word_problems', '["Confusing ratio order", "Not finding unit value first"]'),
  ('q-math-007', 'diag-math', 'math', 'What is the area of a triangle with base 8 cm and height 6 cm?', 'multiple_choice', '["48 cm²", "24 cm²", "14 cm²", "28 cm²"]', '24 cm²', 'Area of triangle = (1/2) x base x height = (1/2) x 8 x 6 = 24 cm²', 0.5, 'geometry', 'area', '["Forgetting to divide by 2", "Confusing with rectangle"]'),

  -- Hard (0.7-0.8)
  ('q-math-008', 'diag-math', 'math', 'Solve: -3(2x - 4) = 18', 'multiple_choice', '["-1", "1", "-5", "5"]', '-1', 'Distribute: -6x + 12 = 18. Subtract 12: -6x = 6. Divide by -6: x = -1', 0.7, 'algebra', 'distributive_property', '["Sign errors", "Forgetting to distribute negative"]'),
  ('q-math-009', 'diag-math', 'math', 'A price drops from $80 to $68. What is the percent decrease?', 'multiple_choice', '["12%", "15%", "18%", "20%"]', '15%', 'Change = 80-68 = 12. Percent change = (12/80) x 100 = 15%', 0.7, 'percentages', 'percent_change', '["Using wrong base", "Confusing with percent of"]'),
  ('q-math-010', 'diag-math', 'math', 'Evaluate: 2³ + 4² - 5', 'multiple_choice', '["19", "21", "27", "15"]', '19', '2³ = 8, 4² = 16. 8 + 16 - 5 = 19', 0.6, 'exponents', 'evaluating', '["Confusing exponent operations", "Order of operations"]'),

  -- Very Hard (0.85-0.95)
  ('q-math-011', 'diag-math', 'math', 'The sum of three consecutive integers is 72. What is the largest number?', 'multiple_choice', '["23", "24", "25", "26"]', '25', 'Let numbers be n, n+1, n+2. Sum: 3n + 3 = 72, so 3n = 69, n = 23. Largest = 25', 0.85, 'algebra', 'word_problems', '["Setting up equation wrong", "Arithmetic errors"]'),
  ('q-math-012', 'diag-math', 'math', 'If f(x) = 2x - 3, what is f(f(4))?', 'multiple_choice', '["5", "7", "9", "11"]', '7', 'f(4) = 2(4) - 3 = 5. f(f(4)) = f(5) = 2(5) - 3 = 7', 0.9, 'functions', 'composition', '["Not applying function twice", "Order confusion"]');

-- ============================================================================
-- SEED: Sample Reading Questions
-- ============================================================================
INSERT OR IGNORE INTO hyro_diagnostic_questions (id, test_id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, subtopic) VALUES
  ('q-read-001', 'diag-reading', 'reading', 'What does the word "benevolent" most likely mean?', 'multiple_choice', '["Kind and generous", "Angry and hostile", "Shy and quiet", "Fast and efficient"]', 'Kind and generous', 'Benevolent comes from Latin "bene" (well) + "volent" (wishing). It means well-wishing or kind.', 0.3, 'vocabulary', 'word_meaning'),
  ('q-read-002', 'diag-reading', 'reading', 'In the sentence "The detective scrutinized the evidence carefully," what does scrutinized mean?', 'multiple_choice', '["Glanced at quickly", "Examined closely", "Ignored completely", "Threw away"]', 'Examined closely', 'Scrutinize means to examine or inspect closely and thoroughly.', 0.35, 'vocabulary', 'context_clues'),
  ('q-read-003', 'diag-reading', 'reading', 'What is the main purpose of a topic sentence in a paragraph?', 'multiple_choice', '["To provide evidence", "To conclude the paragraph", "To introduce the main idea", "To add details"]', 'To introduce the main idea', 'A topic sentence states the main idea that the rest of the paragraph will support.', 0.4, 'comprehension', 'paragraph_structure'),
  ('q-read-004', 'diag-reading', 'reading', 'Which sentence uses the word "their" correctly?', 'multiple_choice', '["Their going to the park", "The dog wagged their tail", "The students turned in their homework", "Its their turn to play"]', 'The students turned in their homework', 'Their is a possessive pronoun for plural subjects. Students (plural) turned in their (belonging to them) homework.', 0.3, 'grammar', 'homophones'),
  ('q-read-005', 'diag-reading', 'reading', 'What is an example of a simile?', 'multiple_choice', '["The wind howled angrily", "She was as quiet as a mouse", "The flowers danced in the breeze", "Time is money"]', 'She was as quiet as a mouse', 'A simile compares two things using "like" or "as." "As quiet as a mouse" uses "as" to compare.', 0.45, 'literary_devices', 'figurative_language'),
  ('q-read-006', 'diag-reading', 'reading', 'When an author uses foreshadowing, they are:', 'multiple_choice', '["Describing a character", "Giving hints about future events", "Explaining past events", "Comparing two things"]', 'Giving hints about future events', 'Foreshadowing is a literary device where the author gives clues about what will happen later.', 0.55, 'literary_devices', 'narrative_techniques');

-- ============================================================================
-- SEED: Sample Critical Thinking Questions
-- ============================================================================
INSERT OR IGNORE INTO hyro_diagnostic_questions (id, test_id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, subtopic) VALUES
  ('q-crit-001', 'diag-critical', 'critical_thinking', 'All dogs are mammals. Fido is a dog. Therefore:', 'multiple_choice', '["Fido is not a mammal", "Fido is a mammal", "All mammals are dogs", "Fido is a cat"]', 'Fido is a mammal', 'This is deductive reasoning. If all dogs are mammals and Fido is a dog, Fido must be a mammal.', 0.3, 'logic', 'deductive_reasoning'),
  ('q-crit-002', 'diag-critical', 'critical_thinking', 'A person argues: "We should not listen to Sarah about climate change because she is not a scientist." This is an example of:', 'multiple_choice', '["Sound reasoning", "Ad hominem fallacy", "Valid conclusion", "Strong evidence"]', 'Ad hominem fallacy', 'This attacks the person rather than their argument. The validity of information does not depend solely on credentials.', 0.5, 'fallacies', 'logical_fallacies'),
  ('q-crit-003', 'diag-critical', 'critical_thinking', 'If it rains, the ground gets wet. The ground is wet. Can we conclude it rained?', 'multiple_choice', '["Yes, definitely", "No, other things could wet the ground", "Yes, that is the only possibility", "We cannot know"]', 'No, other things could wet the ground', 'This is the fallacy of affirming the consequent. Other things (sprinklers, spills) could also wet the ground.', 0.6, 'logic', 'invalid_arguments'),
  ('q-crit-004', 'diag-critical', 'critical_thinking', 'What is the best way to evaluate if a news article is reliable?', 'multiple_choice', '["If it confirms your beliefs", "If it has many views", "Check the source and look for evidence", "If friends shared it"]', 'Check the source and look for evidence', 'Reliable information comes from credible sources and is supported by verifiable evidence.', 0.4, 'information_literacy', 'source_evaluation');

-- ============================================================================
-- SEED: Sample Coding Questions
-- ============================================================================
INSERT OR IGNORE INTO hyro_diagnostic_questions (id, test_id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, subtopic) VALUES
  ('q-code-001', 'diag-coding', 'coding', 'What will this code print? x = 5; x = x + 3; print(x)', 'multiple_choice', '["5", "3", "8", "Error"]', '8', 'First x is 5. Then x is updated to 5+3=8. Finally we print x which is 8.', 0.25, 'variables', 'assignment'),
  ('q-code-002', 'diag-coding', 'coding', 'What is a variable in programming?', 'multiple_choice', '["A math equation", "A storage location for data", "A type of loop", "A programming language"]', 'A storage location for data', 'A variable is a named storage location in memory that holds a value.', 0.2, 'fundamentals', 'variables'),
  ('q-code-003', 'diag-coding', 'coding', 'How many times will this loop run? for i in range(5): print(i)', 'multiple_choice', '["4 times", "5 times", "6 times", "Forever"]', '5 times', 'range(5) produces 0,1,2,3,4 - that is 5 numbers, so the loop runs 5 times.', 0.4, 'loops', 'for_loops'),
  ('q-code-004', 'diag-coding', 'coding', 'What does this function return? def add(a, b): return a + b; add(3, 4)', 'multiple_choice', '["34", "7", "a + b", "Nothing"]', '7', 'The function adds its two arguments. add(3, 4) returns 3 + 4 = 7', 0.45, 'functions', 'return_values'),
  ('q-code-005', 'diag-coding', 'coding', 'What is the purpose of an "if" statement?', 'multiple_choice', '["To repeat code", "To make decisions", "To store data", "To define functions"]', 'To make decisions', 'If statements allow code to make decisions and execute different code based on conditions.', 0.3, 'conditionals', 'if_statements');

-- ============================================================================
-- SEED: Sample Problem Solving Questions
-- ============================================================================
INSERT OR IGNORE INTO hyro_diagnostic_questions (id, test_id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, subtopic) VALUES
  ('q-prob-001', 'diag-problem', 'problem_solving', 'A train leaves Station A at 9:00 AM traveling 60 mph. Another train leaves Station B (300 miles away) at 10:00 AM traveling 90 mph toward Station A. When do they meet?', 'multiple_choice', '["11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM"]', '12:00 PM', 'At 10 AM, Train A has gone 60 miles. Gap is 240 miles. Combined speed is 150 mph. 240/150 = 1.6 hours = 1hr 36min from 10 AM = 11:36 AM. Actually: At 12 PM, Train A: 3 hrs x 60 = 180 mi. Train B: 2 hrs x 90 = 180 mi. Total = 360, but they meet when sum = 300. Let me recalc...', 0.8, 'word_problems', 'distance_rate_time'),
  ('q-prob-002', 'diag-problem', 'problem_solving', 'What is the next number in the sequence: 2, 6, 18, 54, ?', 'multiple_choice', '["108", "162", "216", "72"]', '162', 'Each number is multiplied by 3. 2x3=6, 6x3=18, 18x3=54, 54x3=162', 0.4, 'patterns', 'sequences'),
  ('q-prob-003', 'diag-problem', 'problem_solving', 'You have 3 shirts (red, blue, green) and 2 pants (black, khaki). How many different outfits can you make?', 'multiple_choice', '["5", "6", "8", "9"]', '6', 'Multiply choices: 3 shirts x 2 pants = 6 different combinations', 0.35, 'combinatorics', 'counting_principle');

-- Record migration
INSERT INTO migrations (name) VALUES ('017_hyro_diagnostics');
