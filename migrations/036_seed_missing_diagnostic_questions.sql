-- ============================================================================
-- HYRO FORGE: Seed Diagnostic Questions for Missing Stats
-- Migration 036: Add questions for science, study_skills, and technology
-- Created: 2025-12-04
--
-- PROBLEM:
-- The diagnostic system only has questions for 5 of 8 stats.
-- Missing: science, study_skills, technology
--
-- SOLUTION:
-- Seed 10 questions for each missing stat with varying difficulty levels
-- ============================================================================

-- ============================================================================
-- SCIENCE QUESTIONS (6th Grade)
-- ============================================================================
INSERT INTO hyro_diagnostic_questions (id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, source)
VALUES
  -- Easy (0.2-0.3)
  ('sci_q01', 'science', 'What is the basic unit of life?', 'multiple_choice',
   '["Atom", "Cell", "Molecule", "Organ"]', 'Cell',
   'Cells are the basic structural and functional units of all living organisms.',
   0.2, 'biology', 'system'),

  ('sci_q02', 'science', 'Which planet is known as the Red Planet?', 'multiple_choice',
   '["Venus", "Mars", "Jupiter", "Saturn"]', 'Mars',
   'Mars appears red due to iron oxide (rust) on its surface.',
   0.25, 'astronomy', 'system'),

  ('sci_q03', 'science', 'Water boils at what temperature in Celsius?', 'short_answer',
   NULL, '100',
   'At standard atmospheric pressure, water boils at 100 degrees Celsius.',
   0.3, 'physics', 'system'),

  -- Medium (0.4-0.6)
  ('sci_q04', 'science', 'What process do plants use to convert sunlight into energy?', 'multiple_choice',
   '["Respiration", "Photosynthesis", "Fermentation", "Digestion"]', 'Photosynthesis',
   'Photosynthesis converts light energy, water, and carbon dioxide into glucose and oxygen.',
   0.4, 'biology', 'system'),

  ('sci_q05', 'science', 'The atomic number represents the number of what in an atom?', 'multiple_choice',
   '["Neutrons", "Electrons", "Protons", "All particles"]', 'Protons',
   'The atomic number equals the number of protons in an atom''s nucleus, which determines the element.',
   0.5, 'chemistry', 'system'),

  ('sci_q06', 'science', 'What type of rock is formed from cooled lava or magma?', 'multiple_choice',
   '["Sedimentary", "Metamorphic", "Igneous", "Mineral"]', 'Igneous',
   'Igneous rocks form when molten rock (magma or lava) cools and solidifies.',
   0.5, 'earth_science', 'system'),

  ('sci_q07', 'science', 'In an ecosystem, what are organisms that produce their own food called?', 'multiple_choice',
   '["Consumers", "Decomposers", "Producers", "Predators"]', 'Producers',
   'Producers (like plants) make their own food through photosynthesis and form the base of food chains.',
   0.55, 'ecology', 'system'),

  -- Hard (0.7-0.85)
  ('sci_q08', 'science', 'What is the relationship between the frequency and wavelength of a wave?', 'multiple_choice',
   '["They are directly proportional", "They are inversely proportional", "They are equal", "They are unrelated"]', 'They are inversely proportional',
   'As frequency increases, wavelength decreases (and vice versa), following the equation v = fλ.',
   0.7, 'physics', 'system'),

  ('sci_q09', 'science', 'Which organelle is responsible for producing ATP (energy) in a cell?', 'multiple_choice',
   '["Nucleus", "Ribosome", "Mitochondria", "Chloroplast"]', 'Mitochondria',
   'Mitochondria are called the "powerhouse of the cell" because they produce ATP through cellular respiration.',
   0.75, 'biology', 'system'),

  ('sci_q10', 'science', 'What causes tectonic plates to move?', 'multiple_choice',
   '["Earth''s rotation", "Gravity from the Moon", "Convection currents in the mantle", "Ocean tides"]', 'Convection currents in the mantle',
   'Heat from Earth''s core creates convection currents in the semi-liquid mantle, which push and pull tectonic plates.',
   0.8, 'earth_science', 'system');

-- ============================================================================
-- STUDY SKILLS QUESTIONS
-- ============================================================================
INSERT INTO hyro_diagnostic_questions (id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, source)
VALUES
  -- Easy (0.2-0.3)
  ('study_q01', 'study_skills', 'What is the best time to review notes from a class?', 'multiple_choice',
   '["Right before the test", "Within 24 hours of class", "A week later", "Never, once is enough"]', 'Within 24 hours of class',
   'Reviewing within 24 hours helps transfer information from short-term to long-term memory.',
   0.2, 'memory_techniques', 'system'),

  ('study_q02', 'study_skills', 'Breaking large tasks into smaller steps is called:', 'multiple_choice',
   '["Multitasking", "Chunking", "Cramming", "Procrastinating"]', 'Chunking',
   'Chunking makes large tasks feel more manageable and helps maintain motivation.',
   0.25, 'organization', 'system'),

  ('study_q03', 'study_skills', 'Where should you study for best focus?', 'multiple_choice',
   '["In bed with TV on", "A quiet, dedicated study space", "Wherever is convenient", "In a moving car"]', 'A quiet, dedicated study space',
   'A consistent, distraction-free environment helps your brain associate the space with focused work.',
   0.3, 'environment', 'system'),

  -- Medium (0.4-0.6)
  ('study_q04', 'study_skills', 'What technique involves explaining concepts out loud as if teaching someone else?', 'multiple_choice',
   '["The Feynman Technique", "The Pomodoro Technique", "Mind Mapping", "Speed Reading"]', 'The Feynman Technique',
   'Teaching concepts to others (or pretending to) reveals gaps in understanding and strengthens memory.',
   0.4, 'learning_techniques', 'system'),

  ('study_q05', 'study_skills', 'How long is an ideal focused study session before taking a break?', 'multiple_choice',
   '["10 minutes", "25-50 minutes", "2-3 hours", "As long as possible"]', '25-50 minutes',
   'Research shows attention peaks around 25-50 minutes. The Pomodoro Technique uses 25-minute sessions.',
   0.45, 'time_management', 'system'),

  ('study_q06', 'study_skills', 'Spaced repetition means:', 'multiple_choice',
   '["Studying in different spaces", "Reviewing material at increasing intervals", "Repeating the same thing many times in a row", "Taking many breaks"]', 'Reviewing material at increasing intervals',
   'Spaced repetition (e.g., Day 1, Day 3, Day 7, Day 14) optimizes long-term memory retention.',
   0.5, 'memory_techniques', 'system'),

  ('study_q07', 'study_skills', 'Active recall means:', 'multiple_choice',
   '["Reading your notes repeatedly", "Testing yourself without looking at notes", "Highlighting important text", "Listening to audio recordings"]', 'Testing yourself without looking at notes',
   'Active recall (self-testing) is one of the most effective study techniques for learning.',
   0.55, 'learning_techniques', 'system'),

  -- Hard (0.7-0.85)
  ('study_q08', 'study_skills', 'According to research, which study method is LEAST effective for long-term learning?', 'multiple_choice',
   '["Practice testing", "Distributed practice", "Re-reading and highlighting", "Elaborative interrogation"]', 'Re-reading and highlighting',
   'Re-reading feels productive but research shows it''s much less effective than active techniques like testing.',
   0.7, 'learning_techniques', 'system'),

  ('study_q09', 'study_skills', 'Interleaving involves:', 'multiple_choice',
   '["Studying one subject exhaustively before moving to another", "Mixing different topics or problem types during study", "Taking frequent breaks", "Studying late at night"]', 'Mixing different topics or problem types during study',
   'Interleaving, though harder, leads to better discrimination between concepts and stronger long-term retention.',
   0.75, 'learning_techniques', 'system'),

  ('study_q10', 'study_skills', 'The forgetting curve shows that without review, we forget approximately what percentage of new information within 24 hours?', 'multiple_choice',
   '["10-20%", "30-40%", "50-70%", "90-100%"]', '50-70%',
   'Ebbinghaus''s forgetting curve shows rapid initial forgetting, which is why early review is critical.',
   0.8, 'memory_techniques', 'system');

-- ============================================================================
-- TECHNOLOGY QUESTIONS
-- ============================================================================
INSERT INTO hyro_diagnostic_questions (id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, source)
VALUES
  -- Easy (0.2-0.3)
  ('tech_q01', 'technology', 'What does CPU stand for?', 'multiple_choice',
   '["Central Processing Unit", "Computer Personal Unit", "Central Power Unit", "Computer Processing Unit"]', 'Central Processing Unit',
   'The CPU is the brain of the computer that processes instructions.',
   0.2, 'hardware', 'system'),

  ('tech_q02', 'technology', 'What does WiFi stand for?', 'multiple_choice',
   '["Wireless Fidelity", "Wired Frequency", "Wide Frequency Integration", "It is not an acronym"]', 'It is not an acronym',
   'WiFi is a brand name created by the WiFi Alliance - it does not actually stand for anything.',
   0.3, 'networking', 'system'),

  ('tech_q03', 'technology', 'Which of these is a web browser?', 'multiple_choice',
   '["Windows", "Chrome", "Microsoft Office", "USB"]', 'Chrome',
   'Chrome is a web browser made by Google. Windows is an OS, Office is productivity software, USB is a connector type.',
   0.25, 'software', 'system'),

  -- Medium (0.4-0.6)
  ('tech_q04', 'technology', 'What is the purpose of RAM in a computer?', 'multiple_choice',
   '["Long-term storage", "Temporary working memory", "Display graphics", "Connect to internet"]', 'Temporary working memory',
   'RAM (Random Access Memory) stores data temporarily for quick access while programs are running.',
   0.4, 'hardware', 'system'),

  ('tech_q05', 'technology', 'What does URL stand for?', 'multiple_choice',
   '["Universal Resource Locator", "Uniform Resource Locator", "Universal Reference Link", "Uniform Reference Link"]', 'Uniform Resource Locator',
   'A URL is the address used to access resources (like websites) on the internet.',
   0.45, 'internet', 'system'),

  ('tech_q06', 'technology', 'What is the difference between hardware and software?', 'multiple_choice',
   '["Hardware is expensive, software is cheap", "Hardware is physical, software is programs", "Hardware is for gaming, software is for work", "There is no difference"]', 'Hardware is physical, software is programs',
   'Hardware refers to physical components (keyboard, monitor), while software refers to programs and applications.',
   0.5, 'fundamentals', 'system'),

  ('tech_q07', 'technology', 'What is cloud storage?', 'multiple_choice',
   '["A USB drive shaped like a cloud", "Storing files on remote servers accessed via internet", "A type of weather app", "Memory stored in the atmosphere"]', 'Storing files on remote servers accessed via internet',
   'Cloud storage allows you to save files on remote servers that you can access from any device with internet.',
   0.55, 'cloud_computing', 'system'),

  -- Hard (0.7-0.85)
  ('tech_q08', 'technology', 'What is an IP address used for?', 'multiple_choice',
   '["Identifying your computer on a network", "Measuring internet speed", "Blocking viruses", "Charging your device"]', 'Identifying your computer on a network',
   'An IP (Internet Protocol) address is a unique identifier for devices on a network, like a mailing address.',
   0.65, 'networking', 'system'),

  ('tech_q09', 'technology', 'What is encryption?', 'multiple_choice',
   '["Making files smaller", "Converting data into a secure code", "Speeding up the internet", "Deleting old files"]', 'Converting data into a secure code',
   'Encryption converts data into a coded format that can only be read with the correct key, protecting privacy.',
   0.75, 'security', 'system'),

  ('tech_q10', 'technology', 'What is the difference between uploading and downloading?', 'multiple_choice',
   '["They mean the same thing", "Uploading sends data, downloading receives data", "Uploading is faster", "Downloading is for pictures only"]', 'Uploading sends data, downloading receives data',
   'Uploading transfers data FROM your device TO the internet. Downloading transfers data FROM the internet TO your device.',
   0.4, 'internet', 'system');

-- Record migration
INSERT INTO migrations (name) VALUES ('036_seed_missing_diagnostic_questions');
