-- ============================================================================
-- HYRO FORGE: Comprehensive Content Gap Fix
-- Migration 040: Addresses all identified gaps in content pools
-- Created: 2025-12-04
--
-- This migration:
-- 1. Adds missing SRS decks for critical_thinking, technology, problem_solving
-- 2. Balances diagnostic questions across all 8 stats
-- 3. Adds grade_level column to content pools
-- 4. Adds missing intel content for underserved subjects
-- 5. Balances quest pool across all stats
-- ============================================================================

-- ============================================================================
-- SCHEMA UPDATES
-- ============================================================================

-- Add grade_level to intel content pool if not exists
ALTER TABLE hyro_intel_content_pool ADD COLUMN grade_level INTEGER DEFAULT 6;

-- Add grade_level to quest pool if not exists
ALTER TABLE hyro_quest_pool ADD COLUMN grade_level INTEGER DEFAULT 6;

-- ============================================================================
-- MISSING SRS DECKS - Critical Thinking
-- ============================================================================
INSERT OR IGNORE INTO hyro_srs_decks (id, title, description, subject, icon, card_count, student_id)
VALUES ('deck_critical_thinking', 'Critical Thinking Skills', 'Logic, reasoning, and analysis techniques', 'critical_thinking', '🧠', 0, 'hyro');

INSERT INTO hyro_srs_cards (id, deck_id, front, back, card_type, student_id) VALUES
  ('ct_card_01', 'deck_critical_thinking', 'What is a logical fallacy?', 'An error in reasoning that makes an argument invalid. Common examples include ad hominem, strawman, and false dichotomy.', 'basic', 'hyro'),
  ('ct_card_02', 'deck_critical_thinking', 'What does "correlation does not imply causation" mean?', 'Just because two things happen together doesnt mean one causes the other. Example: Ice cream sales and drownings both increase in summer, but ice cream doesnt cause drowning.', 'basic', 'hyro'),
  ('ct_card_03', 'deck_critical_thinking', 'What is confirmation bias?', 'The tendency to search for, interpret, and remember information that confirms our existing beliefs while ignoring contradicting evidence.', 'basic', 'hyro'),
  ('ct_card_04', 'deck_critical_thinking', 'What is the difference between a fact and an opinion?', 'A fact can be proven true or false with evidence. An opinion is a personal belief or judgment that cannot be objectively proven.', 'basic', 'hyro'),
  ('ct_card_05', 'deck_critical_thinking', 'What is a primary source vs secondary source?', 'Primary source: Original, firsthand evidence (diaries, photographs, interviews). Secondary source: Analysis or interpretation of primary sources (textbooks, documentaries).', 'basic', 'hyro'),
  ('ct_card_06', 'deck_critical_thinking', 'What is the Strawman fallacy?', 'Misrepresenting someones argument to make it easier to attack. You argue against a distorted version of what they actually said.', 'basic', 'hyro'),
  ('ct_card_07', 'deck_critical_thinking', 'What is deductive reasoning?', 'Starting with a general rule and applying it to a specific case. If all mammals are warm-blooded (rule), and dogs are mammals, then dogs are warm-blooded (conclusion).', 'basic', 'hyro'),
  ('ct_card_08', 'deck_critical_thinking', 'What is inductive reasoning?', 'Making broad generalizations from specific observations. Observing many white swans and concluding "all swans are white" (which can be wrong!).', 'basic', 'hyro'),
  ('ct_card_09', 'deck_critical_thinking', 'What is the Ad Hominem fallacy?', 'Attacking the person making the argument rather than the argument itself. "You cant trust his climate research because hes not a real scientist."', 'basic', 'hyro'),
  ('ct_card_10', 'deck_critical_thinking', 'What are the 5 Ws of critical analysis?', 'Who, What, When, Where, Why (and How). These questions help analyze any source or claim thoroughly.', 'basic', 'hyro'),
  ('ct_card_11', 'deck_critical_thinking', 'What is a false dichotomy?', 'Presenting only two options when more exist. "Youre either with us or against us" ignores neutral positions.', 'basic', 'hyro'),
  ('ct_card_12', 'deck_critical_thinking', 'What is the bandwagon fallacy?', 'Arguing something is true or good because many people believe it. "Everyone is buying this product, so it must be great."', 'basic', 'hyro');

UPDATE hyro_srs_decks SET card_count = 12 WHERE id = 'deck_critical_thinking';

-- ============================================================================
-- MISSING SRS DECKS - Technology
-- ============================================================================
INSERT OR IGNORE INTO hyro_srs_decks (id, title, description, subject, icon, card_count, student_id)
VALUES ('deck_technology', 'Digital Literacy & Technology', 'Internet safety, digital citizenship, and tech concepts', 'technology', '💻', 0, 'hyro');

INSERT INTO hyro_srs_cards (id, deck_id, front, back, card_type, student_id) VALUES
  ('tech_card_01', 'deck_technology', 'What is a strong password?', 'At least 12 characters, mix of uppercase, lowercase, numbers, and symbols. Avoid personal info like birthdays or pet names.', 'basic', 'hyro'),
  ('tech_card_02', 'deck_technology', 'What is phishing?', 'A scam where attackers send fake emails or messages pretending to be trusted sources to steal personal information or passwords.', 'basic', 'hyro'),
  ('tech_card_03', 'deck_technology', 'What is two-factor authentication (2FA)?', 'An extra security layer requiring two forms of verification: something you know (password) AND something you have (phone code).', 'basic', 'hyro'),
  ('tech_card_04', 'deck_technology', 'What is your digital footprint?', 'The trail of data you leave online: posts, comments, photos, searches, and purchases. Its permanent and can affect future opportunities.', 'basic', 'hyro'),
  ('tech_card_05', 'deck_technology', 'What is an IP address?', 'Internet Protocol address - a unique number assigned to every device on the internet, like a home address for your computer.', 'basic', 'hyro'),
  ('tech_card_06', 'deck_technology', 'What is the difference between http and https?', 'HTTPS is secure (encrypted). The "s" stands for secure. Always look for https:// especially when entering passwords or payment info.', 'basic', 'hyro'),
  ('tech_card_07', 'deck_technology', 'What is cloud storage?', 'Storing files on remote servers accessed via internet instead of your local device. Examples: Google Drive, iCloud, Dropbox.', 'basic', 'hyro'),
  ('tech_card_08', 'deck_technology', 'What is malware?', 'Malicious software designed to damage or gain unauthorized access. Types include viruses, trojans, ransomware, and spyware.', 'basic', 'hyro'),
  ('tech_card_09', 'deck_technology', 'What is a browser cookie?', 'Small data files websites store on your device to remember preferences, login status, or track your activity.', 'basic', 'hyro'),
  ('tech_card_10', 'deck_technology', 'What is cyberbullying?', 'Using technology to harass, threaten, or embarrass someone. It can happen through texts, social media, games, or apps.', 'basic', 'hyro'),
  ('tech_card_11', 'deck_technology', 'What does "Terms of Service" mean?', 'Legal agreement between you and a service. It explains what you can/cant do and what the company can do with your data.', 'basic', 'hyro'),
  ('tech_card_12', 'deck_technology', 'What is an algorithm?', 'A set of step-by-step instructions for a computer to follow. Social media uses algorithms to decide what content you see.', 'basic', 'hyro');

UPDATE hyro_srs_decks SET card_count = 12 WHERE id = 'deck_technology';

-- ============================================================================
-- MISSING SRS DECKS - Problem Solving
-- ============================================================================
INSERT OR IGNORE INTO hyro_srs_decks (id, title, description, subject, icon, card_count, student_id)
VALUES ('deck_problem_solving', 'Problem Solving Strategies', 'Methods and approaches for tackling complex problems', 'problem_solving', '🔧', 0, 'hyro');

INSERT INTO hyro_srs_cards (id, deck_id, front, back, card_type, student_id) VALUES
  ('ps_card_01', 'deck_problem_solving', 'What are the 4 steps of Polyas problem solving?', '1. Understand the problem, 2. Make a plan, 3. Carry out the plan, 4. Look back and reflect on the solution.', 'basic', 'hyro'),
  ('ps_card_02', 'deck_problem_solving', 'What is "working backwards"?', 'Starting from the desired end result and working step-by-step to find what you need to begin with. Useful for many puzzles!', 'basic', 'hyro'),
  ('ps_card_03', 'deck_problem_solving', 'What is the "divide and conquer" strategy?', 'Breaking a large problem into smaller, more manageable parts. Solve each part, then combine the solutions.', 'basic', 'hyro'),
  ('ps_card_04', 'deck_problem_solving', 'What is "guess and check"?', 'Make an educated guess, test it, learn from the result, and refine your guess. Also called trial and error.', 'basic', 'hyro'),
  ('ps_card_05', 'deck_problem_solving', 'What is looking for patterns?', 'Finding regularities or repetitions in a problem that can help predict the next step or find the rule.', 'basic', 'hyro'),
  ('ps_card_06', 'deck_problem_solving', 'What is drawing a diagram/model?', 'Creating a visual representation of a problem. Pictures, charts, and models help see relationships clearly.', 'basic', 'hyro'),
  ('ps_card_07', 'deck_problem_solving', 'What is making a table or list?', 'Organizing information systematically to find patterns or ensure you consider all possibilities.', 'basic', 'hyro'),
  ('ps_card_08', 'deck_problem_solving', 'What is solving a simpler problem first?', 'If a problem is too complex, try a simpler version. The approach you discover often applies to the harder version.', 'basic', 'hyro'),
  ('ps_card_09', 'deck_problem_solving', 'What is process of elimination?', 'Systematically ruling out impossible or unlikely options until you find the answer.', 'basic', 'hyro'),
  ('ps_card_10', 'deck_problem_solving', 'What is brainstorming?', 'Generating many ideas quickly without judging them. Quantity over quality first, then evaluate the best options.', 'basic', 'hyro'),
  ('ps_card_11', 'deck_problem_solving', 'What is "act it out"?', 'Physically modeling a problem situation. Especially useful for problems involving movement or spatial relationships.', 'basic', 'hyro'),
  ('ps_card_12', 'deck_problem_solving', 'What is using logical reasoning?', 'Making if-then statements and following them to conclusions. "If A is true, then B must be true..."', 'basic', 'hyro');

UPDATE hyro_srs_decks SET card_count = 12 WHERE id = 'deck_problem_solving';

-- ============================================================================
-- ADDITIONAL DIAGNOSTIC QUESTIONS - Balancing Underserved Stats
-- ============================================================================

-- Reading: Currently 6, adding 4 more to reach 10
INSERT INTO hyro_diagnostic_questions (id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, is_active) VALUES
  ('diag_read_07', 'reading', 'What is the main idea of a passage?', 'multiple_choice', '["The first sentence", "The central point the author wants to convey", "The last paragraph", "Every detail mentioned"]', 'The central point the author wants to convey', 'The main idea is the key message or most important thought the author wants readers to understand.', 0.3, 'comprehension', 1),
  ('diag_read_08', 'reading', 'What is an inference?', 'multiple_choice', '["A direct quote from the text", "A conclusion based on evidence and reasoning", "The authors biography", "The title of the book"]', 'A conclusion based on evidence and reasoning', 'An inference is reading between the lines - using clues in the text plus your own knowledge to understand unstated information.', 0.5, 'comprehension', 1),
  ('diag_read_09', 'reading', 'The prefix "un-" typically means:', 'multiple_choice', '["Again", "Not or opposite", "Before", "After"]', 'Not or opposite', 'The prefix un- reverses or negates the meaning. Happy becomes unhappy, fair becomes unfair.', 0.3, 'vocabulary', 1),
  ('diag_read_10', 'reading', 'What is the purpose of a thesis statement?', 'multiple_choice', '["To summarize the conclusion", "To present the main argument or claim of an essay", "To list all sources", "To introduce the author"]', 'To present the main argument or claim of an essay', 'A thesis statement clearly states the central argument or claim that the essay will prove or explore.', 0.5, 'writing', 1);

-- Coding: Currently 5, adding 5 more to reach 10
INSERT INTO hyro_diagnostic_questions (id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, is_active) VALUES
  ('diag_code_06', 'coding', 'What is a variable?', 'multiple_choice', '["A type of loop", "A container that stores data", "A function name", "An error message"]', 'A container that stores data', 'A variable is like a labeled box that holds a value. You can put data in, change it, and use it later.', 0.2, 'basics', 1),
  ('diag_code_07', 'coding', 'What does a for loop do?', 'multiple_choice', '["Runs code once", "Repeats code a specific number of times", "Stops the program", "Deletes variables"]', 'Repeats code a specific number of times', 'A for loop executes a block of code repeatedly for a known number of iterations.', 0.4, 'loops', 1),
  ('diag_code_08', 'coding', 'What is debugging?', 'multiple_choice', '["Adding new features", "Finding and fixing errors in code", "Making code run faster", "Writing documentation"]', 'Finding and fixing errors in code', 'Debugging is the process of identifying, analyzing, and removing bugs (errors) from your program.', 0.3, 'debugging', 1),
  ('diag_code_09', 'coding', 'What does the == operator typically check?', 'multiple_choice', '["If two values are equal", "If a value is greater", "To assign a value", "To subtract values"]', 'If two values are equal', 'The == operator compares two values and returns true if they are equal, false otherwise.', 0.4, 'operators', 1),
  ('diag_code_10', 'coding', 'What is an array?', 'multiple_choice', '["A single value", "A collection of items stored together", "A type of function", "A programming language"]', 'A collection of items stored together', 'An array stores multiple values in a single variable, accessible by index number.', 0.5, 'data_structures', 1);

-- Critical Thinking: Currently 4, adding 6 more to reach 10
INSERT INTO hyro_diagnostic_questions (id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, is_active) VALUES
  ('diag_crit_05', 'critical_thinking', 'What is the main purpose of citing sources?', 'multiple_choice', '["To make your paper longer", "To give credit and allow verification", "To impress your teacher", "Sources are optional"]', 'To give credit and allow verification', 'Citing sources gives proper credit to original authors and lets readers verify your information.', 0.4, 'research_skills', 1),
  ('diag_crit_06', 'critical_thinking', 'Which question best evaluates a news source?', 'multiple_choice', '["Is it interesting?", "Who wrote it and what are their credentials?", "Is it long?", "Does it have pictures?"]', 'Who wrote it and what are their credentials?', 'Evaluating the author and their qualifications helps determine if a source is credible and reliable.', 0.5, 'media_literacy', 1),
  ('diag_crit_07', 'critical_thinking', 'What is bias in information?', 'multiple_choice', '["Spelling errors", "Favoring one perspective over others", "Using big words", "Writing too much"]', 'Favoring one perspective over others', 'Bias is when information unfairly leans toward or against something without considering all sides.', 0.5, 'media_literacy', 1),
  ('diag_crit_08', 'critical_thinking', 'An anecdote (personal story) as evidence is:', 'multiple_choice', '["Always reliable", "Can be misleading if used to prove general claims", "Better than statistics", "Scientific proof"]', 'Can be misleading if used to prove general claims', 'Personal stories are individual experiences that may not represent broader patterns or truths.', 0.6, 'evidence_evaluation', 1),
  ('diag_crit_09', 'critical_thinking', 'What makes an argument valid?', 'multiple_choice', '["Its popular", "The conclusion logically follows from the premises", "Its said loudly", "The person is famous"]', 'The conclusion logically follows from the premises', 'A valid argument has a logical structure where if the premises are true, the conclusion must be true.', 0.6, 'logic', 1),
  ('diag_crit_10', 'critical_thinking', 'What is the purpose of considering counterarguments?', 'multiple_choice', '["To prove yourself wrong", "To strengthen your argument by addressing opposing views", "To confuse readers", "Counterarguments are unnecessary"]', 'To strengthen your argument by addressing opposing views', 'Acknowledging and responding to counterarguments shows thorough thinking and makes your position stronger.', 0.5, 'argumentation', 1);

-- Problem Solving: Currently 3, adding 7 more to reach 10
INSERT INTO hyro_diagnostic_questions (id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, is_active) VALUES
  ('diag_prob_04', 'problem_solving', 'What should you do first when facing a complex problem?', 'multiple_choice', '["Guess the answer", "Understand what the problem is asking", "Give up", "Ask someone else"]', 'Understand what the problem is asking', 'Understanding the problem fully is the essential first step. You cant solve what you dont understand.', 0.3, 'strategy', 1),
  ('diag_prob_05', 'problem_solving', 'When stuck on a problem, which strategy often helps?', 'multiple_choice', '["Stare at it longer", "Try a simpler version of the problem first", "Skip it entirely", "Repeat the same approach"]', 'Try a simpler version of the problem first', 'Solving a simpler version can reveal patterns and strategies that apply to the harder problem.', 0.5, 'strategy', 1),
  ('diag_prob_06', 'problem_solving', 'Why is checking your answer important?', 'multiple_choice', '["Its not important", "To catch mistakes and verify the solution makes sense", "To waste time", "Teachers require it"]', 'To catch mistakes and verify the solution makes sense', 'Checking catches errors and ensures your answer actually solves the original problem.', 0.3, 'verification', 1),
  ('diag_prob_07', 'problem_solving', 'What is the benefit of drawing a diagram?', 'multiple_choice', '["It looks nice", "It helps visualize relationships and patterns", "Its faster than thinking", "Diagrams are never useful"]', 'It helps visualize relationships and patterns', 'Visual representations often reveal patterns and relationships that are hard to see in words alone.', 0.4, 'visualization', 1),
  ('diag_prob_08', 'problem_solving', 'If pattern recognition shows: 2, 4, 8, 16, ___ what comes next?', 'multiple_choice', '["18", "20", "32", "24"]', '32', 'The pattern is doubling: 2×2=4, 4×2=8, 8×2=16, 16×2=32', 0.4, 'patterns', 1),
  ('diag_prob_09', 'problem_solving', 'What is working backwards?', 'multiple_choice', '["Doing things in reverse order", "Starting from the desired result and tracing steps to find the start", "Going back in time", "Undoing your work"]', 'Starting from the desired result and tracing steps to find the start', 'Working backwards means starting from where you want to end up and figuring out how to get there.', 0.5, 'strategy', 1),
  ('diag_prob_10', 'problem_solving', 'When should you use process of elimination?', 'multiple_choice', '["Never", "When you can identify and remove impossible options", "Only in multiple choice", "When you know the answer"]', 'When you can identify and remove impossible options', 'Elimination works well when you can logically rule out wrong answers to narrow down possibilities.', 0.4, 'strategy', 1);

-- ============================================================================
-- ADDITIONAL INTEL CONTENT - Study Skills (Currently only 3)
-- ============================================================================
INSERT INTO hyro_intel_content_pool (id, title, summary, content_type, subject, difficulty, xp_reward, estimated_time_minutes, tags, age_appropriate) VALUES
  ('intel_study_04', 'The Pomodoro Technique', 'Learn the popular 25-minute focus technique used by students worldwide. Work in bursts, take breaks, stay productive!', 'video', 'study_skills', 'easy', 12, 8, '["productivity", "focus", "time-management"]', 1),
  ('intel_study_05', 'Fun Fact: Sleep and Memory', 'Your brain literally replays lessons while you sleep! Thats why a good nights rest before a test is crucial.', 'fact', 'study_skills', 'easy', 5, 2, '["sleep", "memory", "brain"]', 1),
  ('intel_study_06', 'Note-Taking Methods Compared', 'Cornell, mind maps, bullet points - which note-taking style works best? Learn the pros and cons of each!', 'article', 'study_skills', 'medium', 15, 10, '["notes", "organization", "methods"]', 1),
  ('intel_study_07', 'Test Your Study Habits', 'Are you a visual, auditory, or kinesthetic learner? Take this quiz to discover your learning style!', 'quiz', 'study_skills', 'easy', 12, 5, '["learning-styles", "self-discovery"]', 1),
  ('intel_study_08', 'The Growth Mindset', 'Your brain can grow and change! Learn how believing in your ability to improve actually makes you smarter.', 'video', 'study_skills', 'medium', 15, 12, '["mindset", "motivation", "psychology"]', 1);

-- ============================================================================
-- ADDITIONAL INTEL CONTENT - Technology (Currently only 4)
-- ============================================================================
INSERT INTO hyro_intel_content_pool (id, title, summary, content_type, subject, difficulty, xp_reward, estimated_time_minutes, tags, age_appropriate) VALUES
  ('intel_tech_05', 'How Does Wi-Fi Work?', 'Radio waves, routers, and the invisible internet! Discover the amazing technology connecting your devices.', 'video', 'technology', 'medium', 15, 10, '["networking", "wireless", "internet"]', 1),
  ('intel_tech_06', 'Staying Safe Online: Top 5 Tips', 'Simple habits that protect you from hackers, scammers, and privacy invaders. Essential knowledge for every internet user!', 'article', 'technology', 'easy', 12, 8, '["safety", "security", "privacy"]', 1),
  ('intel_tech_07', 'What is AI? A Kids Guide', 'Artificial intelligence is everywhere - from your phone to video games. Learn how computers are learning to think!', 'video', 'technology', 'medium', 15, 12, '["ai", "machine-learning", "future"]', 1),
  ('intel_tech_08', 'Digital Citizenship Quiz', 'Are you a responsible digital citizen? Test your knowledge of online etiquette and safety!', 'quiz', 'technology', 'medium', 15, 8, '["citizenship", "ethics", "responsibility"]', 1),
  ('intel_tech_09', 'Fun Fact: The First Computer', 'The first computer weighed 27 tons and filled an entire room! It could do less than your smartphone.', 'fact', 'technology', 'easy', 5, 2, '["history", "computers", "innovation"]', 1),
  ('intel_tech_10', 'Create Your First Website', 'A beginner-friendly challenge to build a simple webpage using HTML. Its easier than you think!', 'challenge', 'technology', 'medium', 25, 20, '["web", "html", "coding"]', 1);

-- ============================================================================
-- ADDITIONAL QUEST POOL - Technology (Currently only 2)
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags) VALUES
  ('quest_tech_daily_02', 'daily', 'Digital Safety Check', 'Review 10 digital literacy flashcards about online safety', 'technology', 'easy', 15, 10, 'srs_review', '{"deck_id": "deck_technology", "min_cards": 10}', '["flashcards", "safety"]'),
  ('quest_tech_daily_03', 'daily', 'Tech Terms Mastery', 'Learn 8 technology vocabulary terms', 'technology', 'easy', 12, 8, 'srs_review', '{"deck_id": "deck_technology", "min_cards": 8}', '["flashcards", "vocabulary"]'),
  ('quest_tech_weekly_02', 'weekly', 'Digital Citizen Badge', 'Complete all technology flashcards with 80% accuracy', 'technology', 'medium', 35, 25, 'srs_review', '{"deck_id": "deck_technology", "min_cards": 12, "min_accuracy": 0.8}', '["flashcards", "weekly", "accuracy"]'),
  ('quest_tech_challenge_01', 'challenge', 'Cyber Security Expert', 'Score 90%+ on 10 digital safety flashcards', 'technology', 'hard', 50, 15, 'srs_challenge', '{"deck_id": "deck_technology", "min_cards": 10, "min_accuracy": 0.9}', '["flashcards", "challenge"]');

-- ============================================================================
-- ADDITIONAL QUEST POOL - Critical Thinking (Currently only 2)
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags) VALUES
  ('quest_think_daily_02', 'daily', 'Logic Practice', 'Review 10 critical thinking flashcards', 'critical_thinking', 'medium', 15, 10, 'srs_review', '{"deck_id": "deck_critical_thinking", "min_cards": 10}', '["flashcards", "logic"]'),
  ('quest_think_daily_03', 'daily', 'Fallacy Finder', 'Learn to identify 8 common logical fallacies', 'critical_thinking', 'medium', 15, 12, 'srs_review', '{"deck_id": "deck_critical_thinking", "min_cards": 8}', '["flashcards", "fallacies"]'),
  ('quest_think_weekly_02', 'weekly', 'Master Reasoner', 'Complete all critical thinking cards with 85% accuracy', 'critical_thinking', 'hard', 40, 30, 'srs_review', '{"deck_id": "deck_critical_thinking", "min_cards": 12, "min_accuracy": 0.85}', '["flashcards", "weekly"]'),
  ('quest_think_challenge_01', 'challenge', 'Logic Champion', 'Score 90%+ on 10 logic flashcards', 'critical_thinking', 'hard', 50, 15, 'srs_challenge', '{"deck_id": "deck_critical_thinking", "min_cards": 10, "min_accuracy": 0.9}', '["flashcards", "challenge"]');

-- ============================================================================
-- ADDITIONAL QUEST POOL - Problem Solving (Currently only 2)
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags) VALUES
  ('quest_solve_daily_02', 'daily', 'Strategy Session', 'Review 10 problem-solving strategy flashcards', 'problem_solving', 'medium', 15, 10, 'srs_review', '{"deck_id": "deck_problem_solving", "min_cards": 10}', '["flashcards", "strategy"]'),
  ('quest_solve_daily_03', 'daily', 'Problem Solver Prep', 'Practice 8 problem-solving techniques', 'problem_solving', 'medium', 12, 10, 'srs_review', '{"deck_id": "deck_problem_solving", "min_cards": 8}', '["flashcards", "techniques"]'),
  ('quest_solve_weekly_02', 'weekly', 'Strategy Master', 'Master all problem-solving flashcards with 85% accuracy', 'problem_solving', 'hard', 40, 30, 'srs_review', '{"deck_id": "deck_problem_solving", "min_cards": 12, "min_accuracy": 0.85}', '["flashcards", "weekly"]'),
  ('quest_solve_challenge_02', 'challenge', 'Problem Solving Prodigy', 'Score 90%+ on 10 strategy flashcards', 'problem_solving', 'hard', 50, 15, 'srs_challenge', '{"deck_id": "deck_problem_solving", "min_cards": 10, "min_accuracy": 0.9}', '["flashcards", "challenge"]');

-- ============================================================================
-- ADDITIONAL INTEL CONTENT - Critical Thinking
-- ============================================================================
INSERT INTO hyro_intel_content_pool (id, title, summary, content_type, subject, difficulty, xp_reward, estimated_time_minutes, tags, age_appropriate) VALUES
  ('intel_crit_03', 'Spot Fake News Challenge', 'Can you tell real news from fake? Learn the tricks to identify misleading information online.', 'challenge', 'critical_thinking', 'medium', 20, 15, '["media-literacy", "fake-news", "verification"]', 1),
  ('intel_crit_04', 'Fun Fact: Your Brain on Arguments', 'Your brain actually activates "defense mode" when your beliefs are challenged - making it hard to think clearly!', 'fact', 'critical_thinking', 'medium', 5, 2, '["psychology", "bias", "brain"]', 1),
  ('intel_crit_05', 'The Art of Asking Questions', 'Great thinkers ask great questions. Learn the questioning techniques used by scientists and detectives.', 'article', 'critical_thinking', 'medium', 15, 10, '["questioning", "inquiry", "thinking"]', 1),
  ('intel_crit_06', 'Logic Puzzle: The River Crossing', 'Classic brain teaser! Help the farmer get the fox, chicken, and grain across the river safely.', 'challenge', 'critical_thinking', 'hard', 25, 20, '["puzzle", "logic", "problem-solving"]', 1);

-- ============================================================================
-- ADDITIONAL INTEL CONTENT - Problem Solving
-- ============================================================================
INSERT INTO hyro_intel_content_pool (id, title, summary, content_type, subject, difficulty, xp_reward, estimated_time_minutes, tags, age_appropriate) VALUES
  ('intel_prob_05', 'The Tower of Hanoi', 'This ancient puzzle teaches recursive thinking - a skill used by computer scientists everywhere!', 'challenge', 'problem_solving', 'hard', 25, 20, '["puzzle", "recursion", "classic"]', 1),
  ('intel_prob_06', 'Fun Fact: Eureka Moments', 'Studies show that breaks and sleep often lead to sudden problem-solving insights. Your brain works on problems even when youre not!', 'fact', 'problem_solving', 'easy', 5, 2, '["insight", "brain", "creativity"]', 1),
  ('intel_prob_07', 'Think Like a Detective', 'How do detectives solve mysteries? The same methods work for any problem - observation, deduction, and elimination!', 'video', 'problem_solving', 'medium', 15, 12, '["detective", "deduction", "methods"]', 1),
  ('intel_prob_08', 'Pattern Recognition Quiz', 'Test your ability to spot patterns in numbers, shapes, and sequences. A key skill for math and beyond!', 'quiz', 'problem_solving', 'medium', 15, 10, '["patterns", "sequences", "analysis"]', 1);

-- Record migration
INSERT INTO migrations (name) VALUES ('040_hyro_comprehensive_content_fix');
