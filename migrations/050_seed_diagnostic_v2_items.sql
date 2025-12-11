-- ============================================================================
-- SEED DIAGNOSTIC ITEMS V2
-- Migration 050: Populate initial diagnostic items for v2 system
-- ============================================================================

-- Mathematics Items
INSERT OR IGNORE INTO hyro_diagnostic_items_v2 (
  id, stat_name, item_type, modality, difficulty, constructs_measured,
  prompt, options, correct_answer, scoring_rubric
) VALUES
(
  'math_alg_01', 'Mathematics', 'mcq', 'text', 0.4,
  '["algebra", "linear_equations"]',
  'Solve for x: 3x + 7 = 22',
  '{"a": "x = 3", "b": "x = 5", "c": "x = 7", "d": "x = 15"}',
  'b',
  NULL
),
(
  'math_geo_01', 'Mathematics', 'extended_response', 'text', 0.6,
  '["geometry", "spatial_reasoning", "proof"]',
  'Explain why the sum of angles in a triangle is always 180 degrees. You can use a diagram description in your explanation.',
  NULL,
  NULL,
  '{"criteria": ["Mentions parallel lines", "Uses alternate interior angles", "Logical flow"]}'
),
(
  'math_calc_01', 'Mathematics', 'short_answer', 'text', 0.8,
  '["calculus", "derivatives", "conceptual_understanding"]',
  'What is the derivative of f(x) = x^2 at x = 3? Explain what this value represents geometrically.',
  NULL,
  '6',
  '{"criteria": ["Correct value 6", "Mentions slope of tangent line"]}'
);

-- Reading Items
INSERT OR IGNORE INTO hyro_diagnostic_items_v2 (
  id, stat_name, item_type, modality, difficulty, constructs_measured,
  prompt, options, correct_answer, scoring_rubric
) VALUES
(
  'read_comp_01', 'Reading', 'mcq', 'text', 0.5,
  '["comprehension", "inference"]',
  'Read the following sentence: "The old house groaned under the weight of the snow, its windows like tired eyes staring into the storm." What literary device is primarily used here?',
  '{"a": "Metaphor", "b": "Simile", "c": "Personification", "d": "Alliteration"}',
  'c',
  NULL
),
(
  'read_anal_01', 'Reading', 'extended_response', 'text', 0.7,
  '["analysis", "theme", "evidence"]',
  'Analyze the theme of "isolation" in the provided text snippet. How does the author use setting to reinforce this theme?',
  NULL,
  NULL,
  '{"criteria": ["Identifies theme correctly", "Cites specific evidence", "Connects setting to theme"]}'
);

-- Critical Thinking Items
INSERT OR IGNORE INTO hyro_diagnostic_items_v2 (
  id, stat_name, item_type, modality, difficulty, constructs_measured,
  prompt, options, correct_answer, scoring_rubric
) VALUES
(
  'crit_logic_01', 'Critical Thinking', 'mcq', 'text', 0.6,
  '["logic", "fallacies"]',
  'If all A are B, and some B are C, which of the following MUST be true?',
  '{"a": "All A are C", "b": "Some A are C", "c": "Some C are B", "d": "None of the above"}',
  'c',
  NULL
),
(
  'crit_bias_01', 'Critical Thinking', 'extended_response', 'text', 0.75,
  '["bias_detection", "argument_analysis"]',
  'Identify the logical fallacy in this argument: "We should not listen to the senator''s proposal on education because he has never been a teacher."',
  NULL,
  NULL,
  '{"criteria": ["Identifies ad hominem", "Explains why it is a fallacy"]}'
);
