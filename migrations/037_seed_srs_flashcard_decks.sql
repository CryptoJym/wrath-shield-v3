-- ============================================================================
-- HYRO FORGE: Seed SRS Flashcard Decks and Cards
-- Migration 037: Create initial flashcard content for 6th grade subjects
-- Created: 2025-12-04
--
-- Creates decks for:
-- - Math fundamentals (fractions, decimals, percents)
-- - Science vocabulary
-- - Reading/vocabulary
-- - Study skills/memory techniques
-- ============================================================================

-- ============================================================================
-- DECKS
-- ============================================================================
INSERT INTO hyro_srs_decks (id, title, description, subject, icon, card_count, student_id)
VALUES
  ('deck_math_fractions', 'Fractions & Decimals', 'Master converting between fractions, decimals, and percents', 'math', '🔢', 15, 'hyro'),
  ('deck_math_geometry', 'Geometry Basics', 'Shapes, angles, area, and perimeter formulas', 'math', '📐', 12, 'hyro'),
  ('deck_science_vocab', 'Science Vocabulary', 'Key terms from biology, chemistry, and physics', 'science', '🔬', 15, 'hyro'),
  ('deck_reading_roots', 'Word Roots & Prefixes', 'Greek and Latin roots to decode new words', 'reading', '📖', 12, 'hyro'),
  ('deck_study_memory', 'Memory Techniques', 'Proven strategies for better retention', 'study_skills', '🧠', 10, 'hyro'),
  ('deck_coding_python', 'Python Basics', 'Core Python syntax and concepts', 'coding', '🐍', 12, 'hyro');

-- ============================================================================
-- MATH: FRACTIONS & DECIMALS CARDS
-- ============================================================================
INSERT INTO hyro_srs_cards (id, deck_id, front, back, student_id)
VALUES
  ('card_math_01', 'deck_math_fractions', 'How do you convert 1/4 to a decimal?', 'Divide 1 ÷ 4 = 0.25', 'hyro'),
  ('card_math_02', 'deck_math_fractions', 'What is 3/4 as a percent?', '75% (3 ÷ 4 = 0.75, then multiply by 100)', 'hyro'),
  ('card_math_03', 'deck_math_fractions', 'How do you convert 0.6 to a fraction?', '6/10 = 3/5 (simplify by dividing by 2)', 'hyro'),
  ('card_math_04', 'deck_math_fractions', 'What is 25% as a fraction in simplest form?', '1/4 (25/100 = 1/4)', 'hyro'),
  ('card_math_05', 'deck_math_fractions', 'How do you add 1/3 + 1/4?', 'Find common denominator 12: 4/12 + 3/12 = 7/12', 'hyro'),
  ('card_math_06', 'deck_math_fractions', 'What does "simplify a fraction" mean?', 'Divide both numerator and denominator by their GCD (greatest common divisor)', 'hyro'),
  ('card_math_07', 'deck_math_fractions', 'What is 0.125 as a fraction?', '1/8 (0.125 = 125/1000 = 1/8)', 'hyro'),
  ('card_math_08', 'deck_math_fractions', 'How do you multiply fractions? (2/3 × 3/4)', 'Multiply numerators and denominators: 6/12 = 1/2', 'hyro'),
  ('card_math_09', 'deck_math_fractions', 'What is a "reciprocal"?', 'A fraction flipped upside down (reciprocal of 3/4 is 4/3)', 'hyro'),
  ('card_math_10', 'deck_math_fractions', 'How do you divide fractions?', 'Keep the first fraction, flip the second, then multiply', 'hyro'),
  ('card_math_11', 'deck_math_fractions', 'What is 150% as a decimal?', '1.5 (divide by 100)', 'hyro'),
  ('card_math_12', 'deck_math_fractions', 'What is a "mixed number"?', 'A whole number combined with a fraction (like 2½)', 'hyro'),
  ('card_math_13', 'deck_math_fractions', 'Convert 7/4 to a mixed number', '1¾ (7 ÷ 4 = 1 remainder 3)', 'hyro'),
  ('card_math_14', 'deck_math_fractions', 'What is 0.333... as a fraction?', '1/3 (the 3 repeats forever)', 'hyro'),
  ('card_math_15', 'deck_math_fractions', 'What is an "improper fraction"?', 'A fraction where the numerator is larger than the denominator (like 7/4)', 'hyro');

-- ============================================================================
-- MATH: GEOMETRY BASICS CARDS
-- ============================================================================
INSERT INTO hyro_srs_cards (id, deck_id, front, back, student_id)
VALUES
  ('card_geo_01', 'deck_math_geometry', 'How do you find the area of a rectangle?', 'Area = length × width', 'hyro'),
  ('card_geo_02', 'deck_math_geometry', 'How do you find the area of a triangle?', 'Area = (base × height) ÷ 2', 'hyro'),
  ('card_geo_03', 'deck_math_geometry', 'What is the formula for the circumference of a circle?', 'C = 2πr (or C = πd)', 'hyro'),
  ('card_geo_04', 'deck_math_geometry', 'What is the formula for the area of a circle?', 'A = πr² (pi times radius squared)', 'hyro'),
  ('card_geo_05', 'deck_math_geometry', 'How many degrees are in a triangle?', '180 degrees (all angles add up to 180)', 'hyro'),
  ('card_geo_06', 'deck_math_geometry', 'What is a "right angle"?', 'An angle that measures exactly 90 degrees', 'hyro'),
  ('card_geo_07', 'deck_math_geometry', 'What is the Pythagorean theorem?', 'a² + b² = c² (for right triangles)', 'hyro'),
  ('card_geo_08', 'deck_math_geometry', 'What is "perimeter"?', 'The total distance around a shape', 'hyro'),
  ('card_geo_09', 'deck_math_geometry', 'What are "complementary angles"?', 'Two angles that add up to 90 degrees', 'hyro'),
  ('card_geo_10', 'deck_math_geometry', 'What are "supplementary angles"?', 'Two angles that add up to 180 degrees', 'hyro'),
  ('card_geo_11', 'deck_math_geometry', 'What is an "isosceles triangle"?', 'A triangle with exactly two equal sides', 'hyro'),
  ('card_geo_12', 'deck_math_geometry', 'What is the value of π (pi)?', 'Approximately 3.14159... (ratio of circumference to diameter)', 'hyro');

-- ============================================================================
-- SCIENCE VOCABULARY CARDS
-- ============================================================================
INSERT INTO hyro_srs_cards (id, deck_id, front, back, student_id)
VALUES
  ('card_sci_01', 'deck_science_vocab', 'What is "photosynthesis"?', 'The process plants use to convert sunlight, water, and CO₂ into glucose and oxygen', 'hyro'),
  ('card_sci_02', 'deck_science_vocab', 'What is "cellular respiration"?', 'The process cells use to convert glucose and oxygen into energy (ATP)', 'hyro'),
  ('card_sci_03', 'deck_science_vocab', 'What is the difference between "mitosis" and "meiosis"?', 'Mitosis = cell division (2 identical cells). Meiosis = reproductive division (4 different cells)', 'hyro'),
  ('card_sci_04', 'deck_science_vocab', 'What is the "nucleus"?', 'The control center of a cell containing DNA', 'hyro'),
  ('card_sci_05', 'deck_science_vocab', 'What are "producers" in an ecosystem?', 'Organisms that make their own food (plants, algae)', 'hyro'),
  ('card_sci_06', 'deck_science_vocab', 'What are "consumers" in an ecosystem?', 'Organisms that eat other organisms for energy', 'hyro'),
  ('card_sci_07', 'deck_science_vocab', 'What is the "water cycle"?', 'Evaporation → Condensation → Precipitation → Collection (repeat)', 'hyro'),
  ('card_sci_08', 'deck_science_vocab', 'What is an "atom"?', 'The smallest unit of an element that retains its properties', 'hyro'),
  ('card_sci_09', 'deck_science_vocab', 'What are "protons, neutrons, and electrons"?', 'Protons (+) and neutrons (0) in nucleus; electrons (-) orbit around', 'hyro'),
  ('card_sci_10', 'deck_science_vocab', 'What is "density"?', 'Mass divided by volume (how much stuff is packed into a space)', 'hyro'),
  ('card_sci_11', 'deck_science_vocab', 'What is "gravity"?', 'The force of attraction between objects with mass', 'hyro'),
  ('card_sci_12', 'deck_science_vocab', 'What is the difference between "speed" and "velocity"?', 'Speed = how fast. Velocity = speed + direction', 'hyro'),
  ('card_sci_13', 'deck_science_vocab', 'What is an "ecosystem"?', 'A community of living organisms interacting with their environment', 'hyro'),
  ('card_sci_14', 'deck_science_vocab', 'What is "adaptation"?', 'A trait that helps an organism survive in its environment', 'hyro'),
  ('card_sci_15', 'deck_science_vocab', 'What is the "periodic table"?', 'A chart organizing all known elements by atomic number and properties', 'hyro');

-- ============================================================================
-- READING: WORD ROOTS & PREFIXES CARDS
-- ============================================================================
INSERT INTO hyro_srs_cards (id, deck_id, front, back, student_id)
VALUES
  ('card_read_01', 'deck_reading_roots', 'What does the prefix "un-" mean?', 'Not (unhappy = not happy)', 'hyro'),
  ('card_read_02', 'deck_reading_roots', 'What does the prefix "re-" mean?', 'Again (redo = do again)', 'hyro'),
  ('card_read_03', 'deck_reading_roots', 'What does the root "bio" mean?', 'Life (biology = study of life)', 'hyro'),
  ('card_read_04', 'deck_reading_roots', 'What does the root "graph" mean?', 'Write or draw (autograph = self-written signature)', 'hyro'),
  ('card_read_05', 'deck_reading_roots', 'What does the suffix "-ology" mean?', 'Study of (psychology = study of the mind)', 'hyro'),
  ('card_read_06', 'deck_reading_roots', 'What does the prefix "pre-" mean?', 'Before (preview = view before)', 'hyro'),
  ('card_read_07', 'deck_reading_roots', 'What does the prefix "anti-" mean?', 'Against (antibiotic = against bacteria)', 'hyro'),
  ('card_read_08', 'deck_reading_roots', 'What does the root "port" mean?', 'Carry (transport = carry across)', 'hyro'),
  ('card_read_09', 'deck_reading_roots', 'What does the root "dict" mean?', 'Say or speak (dictionary = book of spoken words)', 'hyro'),
  ('card_read_10', 'deck_reading_roots', 'What does the suffix "-able/-ible" mean?', 'Can be done (readable = can be read)', 'hyro'),
  ('card_read_11', 'deck_reading_roots', 'What does the root "tele" mean?', 'Far or distance (telephone = sound from far)', 'hyro'),
  ('card_read_12', 'deck_reading_roots', 'What does the prefix "mis-" mean?', 'Wrong or badly (misunderstand = understand wrongly)', 'hyro');

-- ============================================================================
-- STUDY SKILLS: MEMORY TECHNIQUES CARDS
-- ============================================================================
INSERT INTO hyro_srs_cards (id, deck_id, front, back, student_id)
VALUES
  ('card_study_01', 'deck_study_memory', 'What is "spaced repetition"?', 'Reviewing material at increasing intervals (1 day, 3 days, 1 week, etc.)', 'hyro'),
  ('card_study_02', 'deck_study_memory', 'What is "active recall"?', 'Testing yourself without looking at answers (more effective than re-reading)', 'hyro'),
  ('card_study_03', 'deck_study_memory', 'What is the "Pomodoro Technique"?', '25 minutes of focused work, then 5 minute break. Repeat 4x, then longer break.', 'hyro'),
  ('card_study_04', 'deck_study_memory', 'What is "chunking"?', 'Breaking large information into smaller, manageable pieces', 'hyro'),
  ('card_study_05', 'deck_study_memory', 'What is a "mnemonic device"?', 'A memory aid like acronyms (ROY G BIV = colors of rainbow)', 'hyro'),
  ('card_study_06', 'deck_study_memory', 'What is the "Feynman Technique"?', 'Explain a concept in simple terms as if teaching it to someone else', 'hyro'),
  ('card_study_07', 'deck_study_memory', 'What is "interleaving"?', 'Mixing different topics while studying (harder but more effective)', 'hyro'),
  ('card_study_08', 'deck_study_memory', 'What is the "forgetting curve"?', 'We forget 50-70% within 24 hours without review', 'hyro'),
  ('card_study_09', 'deck_study_memory', 'What is "elaborative interrogation"?', 'Asking "why" and "how" questions to deepen understanding', 'hyro'),
  ('card_study_10', 'deck_study_memory', 'What is the "testing effect"?', 'Taking practice tests improves retention more than just reviewing', 'hyro');

-- ============================================================================
-- CODING: PYTHON BASICS CARDS
-- ============================================================================
INSERT INTO hyro_srs_cards (id, deck_id, front, back, student_id)
VALUES
  ('card_py_01', 'deck_coding_python', 'How do you print "Hello World" in Python?', 'print("Hello World")', 'hyro'),
  ('card_py_02', 'deck_coding_python', 'How do you create a variable in Python?', 'name = "value" (no special keyword needed)', 'hyro'),
  ('card_py_03', 'deck_coding_python', 'What is the difference between = and ==?', '= assigns a value, == compares if equal', 'hyro'),
  ('card_py_04', 'deck_coding_python', 'How do you write an if statement in Python?', 'if condition:\n    do_something', 'hyro'),
  ('card_py_05', 'deck_coding_python', 'What is a "list" in Python?', 'An ordered collection: [1, 2, 3] or ["a", "b", "c"]', 'hyro'),
  ('card_py_06', 'deck_coding_python', 'How do you write a for loop in Python?', 'for item in list:\n    do_something', 'hyro'),
  ('card_py_07', 'deck_coding_python', 'What does len() do?', 'Returns the length of a string or list', 'hyro'),
  ('card_py_08', 'deck_coding_python', 'How do you define a function in Python?', 'def function_name(parameters):\n    code', 'hyro'),
  ('card_py_09', 'deck_coding_python', 'What is a "string" in Python?', 'Text wrapped in quotes: "hello" or ''hello''', 'hyro'),
  ('card_py_10', 'deck_coding_python', 'What does input() do?', 'Gets text input from the user', 'hyro'),
  ('card_py_11', 'deck_coding_python', 'What is a "comment" in Python?', 'Text after # that Python ignores (for notes)', 'hyro'),
  ('card_py_12', 'deck_coding_python', 'What is the difference between int and float?', 'int = whole number (5), float = decimal (5.0)', 'hyro');

-- Record migration
INSERT INTO migrations (name) VALUES ('037_seed_srs_flashcard_decks');
