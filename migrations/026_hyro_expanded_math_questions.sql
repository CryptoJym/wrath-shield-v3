-- HYRO FORGE: Expanded Mathematics Question Bank
-- Migration 026: 80+ Additional Math Questions for Robust Diagnostic Assessment
--
-- Goal: 100+ questions per domain for meaningful proficiency testing
-- Focus: Multiple questions per topic at varying difficulty levels
-- Philosophy: Test understanding, not memorization. Focus on why, not just what.

INSERT INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES

-- =============================================================================
-- RATIOS AND PROPORTIONAL RELATIONSHIPS (6.RP)
-- =============================================================================

-- Basic Ratios
('q_math_rp_101', 'mathematics', 'std_6rp_a1', 'topic_ratios_intro', 'multiple_choice', 'In a class of 30 students, 18 are girls. What is the ratio of boys to girls?', '["12:18", "18:12", "2:3", "3:2"]', '2:3', 'There are 30-18=12 boys. The ratio of boys to girls is 12:18, which simplifies to 2:3.', 35, 2, 'apply', 2, '["First find the number of boys", "Simplify by finding common factors"]'),

('q_math_rp_102', 'mathematics', 'std_6rp_a1', 'topic_ratios_intro', 'multiple_choice', 'A recipe uses 3 cups of flour for every 2 cups of sugar. If you use 9 cups of flour, how many cups of sugar do you need?', '["4", "5", "6", "8"]', '6', 'The ratio is 3:2. If flour triples (3->9), sugar must also triple (2->6).', 40, 2, 'apply', 2, '["What operation was done to 3 to get 9?", "Apply the same to 2"]'),

('q_math_rp_103', 'mathematics', 'std_6rp_a1', 'topic_ratios_intro', 'multiple_choice', 'Which ratio is NOT equivalent to 4:6?', '["2:3", "8:12", "12:18", "6:8"]', '6:8', 'Simplify 4:6 = 2:3. Check each: 8:12=2:3, 12:18=2:3, but 6:8=3:4, not equivalent.', 45, 2, 'analyze', 3, '["Simplify 4:6 first", "Simplify each option"]'),

('q_math_rp_104', 'mathematics', 'std_6rp_a2', 'topic_unit_rates', 'multiple_choice', 'A car travels 240 miles using 8 gallons of gas. What is the unit rate in miles per gallon?', '["24 mpg", "28 mpg", "30 mpg", "32 mpg"]', '30 mpg', 'Unit rate = total/quantity = 240/8 = 30 miles per gallon.', 30, 1, 'apply', 2, '["Divide miles by gallons"]'),

('q_math_rp_105', 'mathematics', 'std_6rp_a2', 'topic_unit_rates', 'multiple_choice', 'Store A sells 5 apples for $2.50. Store B sells 8 apples for $3.60. Which is the better deal?', '["Store A", "Store B", "Same price", "Cannot determine"]', 'Store B', 'Store A: $2.50/5 = $0.50 per apple. Store B: $3.60/8 = $0.45 per apple. Store B is cheaper.', 45, 2, 'analyze', 3, '["Find the price per apple for each store", "Lower price = better deal"]'),

('q_math_rp_106', 'mathematics', 'std_6rp_a3', 'topic_percent_problems', 'multiple_choice', 'A shirt costs $40 and is on sale for 25% off. What is the sale price?', '["$10", "$15", "$30", "$35"]', '$30', '25% of $40 = 0.25 × 40 = $10 discount. Sale price = $40 - $10 = $30.', 40, 2, 'apply', 2, '["Find 25% of 40", "Subtract from original"]'),

('q_math_rp_107', 'mathematics', 'std_6rp_a3', 'topic_percent_problems', 'multiple_choice', 'You scored 45 out of 60 on a test. What percent is that?', '["65%", "70%", "75%", "80%"]', '75%', 'Percent = (part/whole) × 100 = (45/60) × 100 = 0.75 × 100 = 75%.', 35, 2, 'apply', 2, '["Divide 45 by 60", "Multiply by 100"]'),

('q_math_rp_108', 'mathematics', 'std_6rp_a3', 'topic_percent_problems', 'multiple_choice', 'A population grows from 500 to 650. What is the percent increase?', '["20%", "25%", "30%", "35%"]', '30%', 'Change = 650-500 = 150. Percent increase = (150/500) × 100 = 30%.', 50, 2, 'apply', 3, '["Find the amount of change", "Divide by original, multiply by 100"]'),

-- =============================================================================
-- THE NUMBER SYSTEM (6.NS)
-- =============================================================================

('q_math_ns_101', 'mathematics', 'std_6ns_a1', 'topic_fraction_division', 'multiple_choice', 'What is 3/4 ÷ 1/2?', '["3/8", "1/2", "3/2", "6/4"]', '3/2', 'Divide fractions by multiplying by reciprocal: 3/4 × 2/1 = 6/4 = 3/2.', 40, 2, 'apply', 2, '["Flip the second fraction", "Multiply across"]'),

('q_math_ns_102', 'mathematics', 'std_6ns_a1', 'topic_fraction_division', 'multiple_choice', 'A rope is 5/6 of a meter long. You cut it into pieces that are 1/3 meter each. How many pieces can you make?', '["1", "2", "2.5", "3"]', '2.5', '5/6 ÷ 1/3 = 5/6 × 3/1 = 15/6 = 5/2 = 2.5 pieces.', 45, 2, 'apply', 3, '["This is a division problem", "Divide 5/6 by 1/3"]'),

('q_math_ns_103', 'mathematics', 'std_6ns_b3', 'topic_decimals_operations', 'multiple_choice', 'Calculate: 4.56 × 2.3', '["9.488", "10.288", "10.388", "10.488"]', '10.488', 'Multiply as whole numbers: 456 × 23 = 10488. Place decimal 3 places from right: 10.488.', 35, 2, 'apply', 2, '["Count decimal places in factors", "Place that many in answer"]'),

('q_math_ns_104', 'mathematics', 'std_6ns_b3', 'topic_decimals_operations', 'multiple_choice', 'Divide: 15.75 ÷ 3.5', '["4.0", "4.5", "5.0", "5.5"]', '4.5', 'Move decimal in both: 157.5 ÷ 35 = 4.5. Or: 15.75/3.5 = 31.5/7 = 4.5.', 40, 2, 'apply', 2, '["Make divisor a whole number", "Move decimal same places in both"]'),

('q_math_ns_105', 'mathematics', 'std_6ns_c6', 'topic_negative_numbers', 'multiple_choice', 'Which number is greater: -8 or -3?', '["-8", "-3", "They are equal", "Cannot compare"]', '-3', 'On a number line, -3 is to the right of -8, so -3 is greater. Think: -3 is only 3 below zero, while -8 is 8 below.', 30, 1, 'understand', 2, '["Draw a number line", "Right is greater"]'),

('q_math_ns_106', 'mathematics', 'std_6ns_c6', 'topic_negative_numbers', 'multiple_choice', 'What is the opposite of -7?', '["7", "-7", "0", "-1/7"]', '7', 'The opposite of a number is the same distance from zero on the other side. Opposite of -7 is +7.', 25, 1, 'understand', 1, '["Opposite means other side of zero", "Same distance from zero"]'),

('q_math_ns_107', 'mathematics', 'std_6ns_c7', 'topic_absolute_value', 'multiple_choice', 'What is |-15| + |8|?', '["7", "15", "23", "-7"]', '23', 'Absolute value is distance from zero: |-15| = 15, |8| = 8. Sum = 15 + 8 = 23.', 35, 2, 'apply', 2, '["Absolute value is always positive", "Add the distances"]'),

('q_math_ns_108', 'mathematics', 'std_6ns_c7', 'topic_absolute_value', 'multiple_choice', 'Which statement is true?', '["|-5| = -5", "|-5| < |3|", "|-5| = |5|", "|-5| > |5|"]', '|-5| = |5|', 'Both -5 and 5 are the same distance from zero (5 units), so their absolute values are equal.', 40, 2, 'analyze', 3, '["Absolute value = distance from zero", "Compare distances, not signs"]'),

-- =============================================================================
-- EXPRESSIONS AND EQUATIONS (6.EE)
-- =============================================================================

('q_math_ee_101', 'mathematics', 'std_6ee_a1', 'topic_exponents', 'multiple_choice', 'Simplify: 2^4', '["6", "8", "16", "32"]', '16', '2^4 means 2×2×2×2 = 4×4 = 16.', 25, 1, 'apply', 1, '["Multiply 2 by itself 4 times"]'),

('q_math_ee_102', 'mathematics', 'std_6ee_a1', 'topic_exponents', 'multiple_choice', 'What is 3^0?', '["0", "1", "3", "Undefined"]', '1', 'Any non-zero number raised to the power of 0 equals 1. This is a rule of exponents.', 35, 2, 'remember', 2, '["This is a special exponent rule", "Try: 3^2/3^2 = 3^0"]'),

('q_math_ee_103', 'mathematics', 'std_6ee_a2', 'topic_expressions_variables', 'multiple_choice', 'Write an expression for: "5 more than three times a number n"', '["5 + 3n", "5n + 3", "3(n + 5)", "5(3 + n)"]', '5 + 3n', '"Three times n" is 3n. "5 more than" means add 5: 5 + 3n or equivalently 3n + 5.', 30, 2, 'apply', 2, '["Translate each phrase", "More than = addition"]'),

('q_math_ee_104', 'mathematics', 'std_6ee_a2', 'topic_expressions_variables', 'multiple_choice', 'Evaluate 4x - 7 when x = 5', '["8", "13", "17", "27"]', '13', 'Substitute x = 5: 4(5) - 7 = 20 - 7 = 13.', 30, 2, 'apply', 2, '["Replace x with 5", "Follow order of operations"]'),

('q_math_ee_105', 'mathematics', 'std_6ee_a3', 'topic_equivalent_expressions', 'multiple_choice', 'Which expression is equivalent to 3(x + 4)?', '["3x + 4", "3x + 12", "x + 12", "3x + 7"]', '3x + 12', 'Distribute 3: 3(x) + 3(4) = 3x + 12.', 35, 2, 'apply', 2, '["Distribute means multiply each term inside", "3 times x, 3 times 4"]'),

('q_math_ee_106', 'mathematics', 'std_6ee_a3', 'topic_equivalent_expressions', 'multiple_choice', 'Simplify: 5x + 3 + 2x - 1', '["7x + 2", "7x + 4", "10x + 2", "7x - 2"]', '7x + 2', 'Combine like terms: (5x + 2x) + (3 - 1) = 7x + 2.', 35, 2, 'apply', 2, '["Group the x terms together", "Group the numbers together"]'),

('q_math_ee_107', 'mathematics', 'std_6ee_b5', 'topic_equations_one_step', 'multiple_choice', 'Solve for x: x + 8 = 15', '["x = 5", "x = 7", "x = 23", "x = -7"]', 'x = 7', 'Subtract 8 from both sides: x + 8 - 8 = 15 - 8, so x = 7.', 25, 1, 'apply', 2, '["Undo adding 8 by subtracting 8", "Do same to both sides"]'),

('q_math_ee_108', 'mathematics', 'std_6ee_b5', 'topic_equations_one_step', 'multiple_choice', 'Solve for y: 4y = 28', '["y = 7", "y = 24", "y = 32", "y = 112"]', 'y = 7', 'Divide both sides by 4: 4y/4 = 28/4, so y = 7.', 25, 1, 'apply', 2, '["Undo multiplying by 4", "Divide both sides by 4"]'),

('q_math_ee_109', 'mathematics', 'std_6ee_b6', 'topic_equations_one_step', 'multiple_choice', 'Solve for n: n/5 = 12', '["n = 7", "n = 17", "n = 60", "n = 2.4"]', 'n = 60', 'Multiply both sides by 5: 5 × (n/5) = 5 × 12, so n = 60.', 30, 2, 'apply', 2, '["Undo dividing by 5", "Multiply both sides by 5"]'),

('q_math_ee_110', 'mathematics', 'std_6ee_b7', 'topic_inequalities', 'multiple_choice', 'Which value of x makes x > 4 true?', '["3", "4", "5", "All of these"]', '5', 'x > 4 means x must be greater than 4. Only 5 is greater than 4.', 25, 1, 'apply', 1, '["Greater than 4 means to the right of 4", "Check each value"]'),

('q_math_ee_111', 'mathematics', 'std_6ee_b7', 'topic_inequalities', 'multiple_choice', 'If 3x < 18, which values could x be?', '["x = 6", "x = 5", "x = 7", "x = 6.5"]', 'x = 5', 'Solve: x < 18/3 = 6. So x must be less than 6. Only 5 < 6.', 35, 2, 'apply', 2, '["Divide both sides by 3", "Find which answer is less than 6"]'),

-- =============================================================================
-- GEOMETRY (6.G)
-- =============================================================================

('q_math_g_101', 'mathematics', 'std_6g_a1', 'topic_area_shapes', 'multiple_choice', 'What is the area of a triangle with base 10 cm and height 6 cm?', '["16 cm²", "30 cm²", "60 cm²", "80 cm²"]', '30 cm²', 'Area of triangle = (1/2) × base × height = (1/2) × 10 × 6 = 30 cm².', 30, 2, 'apply', 2, '["Triangle area = half of rectangle", "A = (1/2)bh"]'),

('q_math_g_102', 'mathematics', 'std_6g_a1', 'topic_area_shapes', 'multiple_choice', 'A parallelogram has base 8 m and height 5 m. What is its area?', '["13 m²", "26 m²", "40 m²", "80 m²"]', '40 m²', 'Area of parallelogram = base × height = 8 × 5 = 40 m².', 25, 1, 'apply', 2, '["Like a rectangle with same base and height", "A = bh"]'),

('q_math_g_103', 'mathematics', 'std_6g_a2', 'topic_volume_prisms', 'multiple_choice', 'What is the volume of a rectangular prism with length 4, width 3, and height 5?', '["12", "20", "35", "60"]', '60', 'Volume = length × width × height = 4 × 3 × 5 = 60 cubic units.', 30, 2, 'apply', 2, '["V = l × w × h", "Multiply all three dimensions"]'),

('q_math_g_104', 'mathematics', 'std_6g_a2', 'topic_volume_prisms', 'multiple_choice', 'A box has volume 120 cubic inches. Its base area is 24 square inches. What is its height?', '["4 in", "5 in", "6 in", "10 in"]', '5 in', 'Volume = base area × height. So height = Volume/base area = 120/24 = 5 inches.', 40, 2, 'apply', 3, '["V = B × h", "Rearrange to find h"]'),

('q_math_g_105', 'mathematics', 'std_6g_a3', 'topic_coordinate_geometry', 'multiple_choice', 'Which point is in Quadrant II?', '["(3, 4)", "(-3, 4)", "(3, -4)", "(-3, -4)"]', '(-3, 4)', 'Quadrant II has negative x and positive y coordinates. (-3, 4) fits this.', 35, 2, 'understand', 2, '["Remember QUAD order: I(+,+), II(-,+), III(-,-), IV(+,-)", "Look for (-, +)"]'),

('q_math_g_106', 'mathematics', 'std_6g_a3', 'topic_coordinate_geometry', 'multiple_choice', 'What is the distance between (-2, 0) and (4, 0) on a number line?', '["2", "4", "6", "8"]', '6', 'Both points are on the x-axis. Distance = |4 - (-2)| = |4 + 2| = 6 units.', 35, 2, 'apply', 2, '["Points on same axis - just count", "Subtract coordinates, take absolute value"]'),

-- =============================================================================
-- STATISTICS AND PROBABILITY (6.SP)
-- =============================================================================

('q_math_sp_101', 'mathematics', 'std_6sp_a1', 'topic_stat_questions', 'multiple_choice', 'Which question is a statistical question?', '["How old is your teacher?", "How many days are in June?", "How many hours do students in your class sleep per night?", "What is 8 × 7?"]', 'How many hours do students in your class sleep per night?', 'A statistical question anticipates variability in answers. Different students sleep different amounts.', 40, 2, 'analyze', 3, '["Statistical questions have multiple possible answers", "Look for variation in the data"]'),

('q_math_sp_102', 'mathematics', 'std_6sp_b4', 'topic_stat_measures', 'multiple_choice', 'Find the median of: 3, 7, 9, 15, 21', '["9", "11", "15", "7"]', '9', 'Median is the middle value when ordered. Already ordered: 3, 7, 9, 15, 21. Middle is 9.', 30, 2, 'apply', 2, '["Put in order first", "Find the middle value"]'),

('q_math_sp_103', 'mathematics', 'std_6sp_b4', 'topic_stat_measures', 'multiple_choice', 'Find the mean of: 4, 6, 8, 10, 12', '["6", "8", "10", "40"]', '8', 'Mean = sum/count = (4+6+8+10+12)/5 = 40/5 = 8.', 30, 2, 'apply', 2, '["Add all values", "Divide by how many values"]'),

('q_math_sp_104', 'mathematics', 'std_6sp_b5', 'topic_stat_variability', 'multiple_choice', 'What is the range of: 12, 18, 23, 15, 30?', '["12", "18", "15", "18"]', '18', 'Range = maximum - minimum = 30 - 12 = 18.', 25, 1, 'apply', 2, '["Find largest and smallest", "Subtract"]'),

('q_math_sp_105', 'mathematics', 'std_6sp_b5', 'topic_stat_variability', 'multiple_choice', 'Two classes have the same mean test score of 80. Class A has range 20, Class B has range 50. What can you conclude?', '["Class A did better", "Class B did better", "Class B scores varied more", "Cannot compare"]', 'Class B scores varied more', 'A larger range indicates more spread/variability. Both have same mean, but B has more variation.', 45, 3, 'analyze', 3, '["Range measures spread", "Same mean, different spread"]'),

-- =============================================================================
-- 7TH GRADE EXTENSIONS (7.RP, 7.NS, 7.EE, 7.G)
-- =============================================================================

('q_math_7rp_101', 'mathematics', 'std_7rp_a1', 'topic_proportional_graphs', 'multiple_choice', 'Which shows a proportional relationship?', '["y = 2x + 1", "y = 3x", "y = x²", "y = x + 5"]', 'y = 3x', 'Proportional relationships have form y = kx, passing through origin. Only y = 3x fits.', 40, 2, 'analyze', 2, '["Proportional means y = kx (no added constant)", "Must pass through (0,0)"]'),

('q_math_7rp_102', 'mathematics', 'std_7rp_a2', 'topic_constant_proportionality', 'multiple_choice', 'In y = 0.5x, what is the constant of proportionality?', '["0", "0.5", "x", "y"]', '0.5', 'In y = kx, k is the constant of proportionality. Here k = 0.5.', 30, 2, 'understand', 2, '["Compare to y = kx", "What multiplies x?"]'),

('q_math_7ns_101', 'mathematics', 'std_7ns_a1', 'topic_integer_operations', 'multiple_choice', 'Calculate: -5 + (-3)', '["8", "2", "-2", "-8"]', '-8', 'Adding two negatives: combine and keep negative. |-5| + |-3| = 8, so answer is -8.', 30, 2, 'apply', 2, '["Two negatives: add and keep negative", "5 + 3 = 8, so -5 + (-3) = -8"]'),

('q_math_7ns_102', 'mathematics', 'std_7ns_a1', 'topic_integer_operations', 'multiple_choice', 'Calculate: -12 - (-5)', '["17", "7", "-7", "-17"]', '-7', 'Subtracting a negative = adding: -12 - (-5) = -12 + 5 = -7.', 35, 2, 'apply', 2, '["Subtracting negative = adding", "-12 + 5 = ?"]'),

('q_math_7ns_103', 'mathematics', 'std_7ns_a2', 'topic_integer_operations', 'multiple_choice', 'Calculate: (-4) × (-6)', '["24", "-24", "10", "-10"]', '24', 'Negative times negative equals positive. 4 × 6 = 24, so (-4) × (-6) = +24.', 30, 2, 'apply', 2, '["Negative × Negative = Positive", "Multiply the absolute values"]'),

('q_math_7ns_104', 'mathematics', 'std_7ns_a2', 'topic_rational_operations', 'multiple_choice', 'Calculate: -3/4 + 1/2', '["1/4", "-1/4", "5/4", "-5/4"]', '-1/4', 'Common denominator: -3/4 + 2/4 = -1/4.', 40, 2, 'apply', 2, '["Find common denominator", "Add numerators keeping denominator"]'),

('q_math_7ee_101', 'mathematics', 'std_7ee_a1', 'topic_expressions_linear', 'multiple_choice', 'Expand and simplify: 2(3x - 4) + 5x', '["11x - 8", "11x - 4", "6x - 8", "6x - 4"]', '11x - 8', 'Distribute: 6x - 8 + 5x. Combine: 11x - 8.', 40, 2, 'apply', 2, '["First distribute the 2", "Then combine like terms"]'),

('q_math_7ee_102', 'mathematics', 'std_7ee_b3', 'topic_equations_two_step', 'multiple_choice', 'Solve: 3x + 7 = 22', '["x = 3", "x = 5", "x = 7", "x = 29"]', 'x = 5', 'Subtract 7: 3x = 15. Divide by 3: x = 5.', 35, 2, 'apply', 2, '["Undo +7 first", "Then undo ×3"]'),

('q_math_7ee_103', 'mathematics', 'std_7ee_b4', 'topic_equations_two_step', 'multiple_choice', 'Solve: 2x - 5 = 3x + 2', '["x = -7", "x = 7", "x = -3", "x = 3"]', 'x = -7', 'Subtract 2x: -5 = x + 2. Subtract 2: -7 = x.', 45, 2, 'apply', 3, '["Get all x terms on one side", "Get all numbers on the other"]'),

('q_math_7g_101', 'mathematics', 'std_7g_a1', 'topic_scale_drawings', 'multiple_choice', 'A map scale is 1 inch = 50 miles. Two cities are 4 inches apart on the map. What is the actual distance?', '["100 miles", "150 miles", "200 miles", "250 miles"]', '200 miles', 'Multiply: 4 inches × 50 miles/inch = 200 miles.', 35, 2, 'apply', 2, '["Multiply map distance by scale", "4 × 50 = ?"]'),

('q_math_7g_102', 'mathematics', 'std_7g_b4', 'topic_circles', 'multiple_choice', 'What is the area of a circle with radius 5? (Use π ≈ 3.14)', '["15.7", "31.4", "78.5", "157"]', '78.5', 'Area = πr² = 3.14 × 5² = 3.14 × 25 = 78.5.', 40, 2, 'apply', 2, '["Area formula: A = πr²", "Square the radius first"]'),

('q_math_7g_103', 'mathematics', 'std_7g_b4', 'topic_circles', 'multiple_choice', 'What is the circumference of a circle with diameter 10? (Use π ≈ 3.14)', '["15.7", "31.4", "78.5", "314"]', '31.4', 'Circumference = πd = 3.14 × 10 = 31.4.', 35, 2, 'apply', 2, '["Circumference formula: C = πd", "Multiply π by diameter"]'),

-- =============================================================================
-- 8TH GRADE EXTENSIONS (8.NS, 8.EE, 8.F, 8.G)
-- =============================================================================

('q_math_8ns_101', 'mathematics', 'std_8ns_a1', 'topic_irrational_numbers', 'multiple_choice', 'Which number is irrational?', '["0.333...", "√9", "√2", "7/8"]', '√2', '√2 cannot be expressed as a fraction. It has a non-repeating, non-terminating decimal.', 40, 2, 'understand', 2, '["Irrational = cant write as fraction", "√9 = 3, which is rational"]'),

('q_math_8ns_102', 'mathematics', 'std_8ns_a2', 'topic_irrational_numbers', 'multiple_choice', 'Between which two integers does √50 lie?', '["5 and 6", "6 and 7", "7 and 8", "8 and 9"]', '7 and 8', '49 < 50 < 64, so √49 < √50 < √64, meaning 7 < √50 < 8.', 40, 2, 'analyze', 3, '["Find perfect squares near 50", "√49 = 7, √64 = 8"]'),

('q_math_8ee_101', 'mathematics', 'std_8ee_a1', 'topic_exponent_rules', 'multiple_choice', 'Simplify: x³ · x⁴', '["x⁷", "x¹²", "x¹", "2x⁷"]', 'x⁷', 'When multiplying same bases, add exponents: x³ · x⁴ = x^(3+4) = x⁷.', 35, 2, 'apply', 2, '["Same base: add exponents", "3 + 4 = 7"]'),

('q_math_8ee_102', 'mathematics', 'std_8ee_a1', 'topic_exponent_rules', 'multiple_choice', 'Simplify: (x²)³', '["x⁵", "x⁶", "x⁸", "3x²"]', 'x⁶', 'Power of a power: multiply exponents. (x²)³ = x^(2×3) = x⁶.', 35, 2, 'apply', 2, '["Power to a power: multiply exponents", "2 × 3 = 6"]'),

('q_math_8ee_103', 'mathematics', 'std_8ee_a2', 'topic_scientific_notation', 'multiple_choice', 'Write 45,000 in scientific notation.', '["4.5 × 10³", "4.5 × 10⁴", "45 × 10³", "0.45 × 10⁵"]', '4.5 × 10⁴', 'Move decimal 4 places left: 45000 = 4.5 × 10⁴.', 35, 2, 'apply', 2, '["Count places to move decimal", "Coefficient should be 1-10"]'),

('q_math_8ee_104', 'mathematics', 'std_8ee_a3', 'topic_scientific_notation', 'multiple_choice', 'Calculate: (3 × 10⁴) × (2 × 10³)', '["5 × 10⁷", "6 × 10⁷", "6 × 10¹²", "5 × 10¹²"]', '6 × 10⁷', 'Multiply coefficients (3×2=6), add exponents (4+3=7): 6 × 10⁷.', 40, 2, 'apply', 2, '["Multiply the numbers", "Add the exponents"]'),

('q_math_8ee_105', 'mathematics', 'std_8ee_c7', 'topic_linear_equations', 'multiple_choice', 'Solve: 2(x - 3) = 4x + 2', '["x = -4", "x = -2", "x = 2", "x = 4"]', 'x = -4', 'Distribute: 2x - 6 = 4x + 2. Subtract 2x: -6 = 2x + 2. Subtract 2: -8 = 2x. Divide: x = -4.', 45, 2, 'apply', 3, '["Distribute first", "Get x terms on one side"]'),

('q_math_8f_101', 'mathematics', 'std_8f_a1', 'topic_functions_intro', 'multiple_choice', 'Is this relation a function? {(1,2), (2,4), (3,6), (1,5)}', '["Yes", "No", "Cannot determine", "Only if graphed"]', 'No', 'Input 1 maps to both 2 and 5. A function cant have one input with multiple outputs.', 40, 2, 'analyze', 3, '["Each input can have only one output", "Check if any x repeats"]'),

('q_math_8f_102', 'mathematics', 'std_8f_a3', 'topic_linear_functions', 'multiple_choice', 'What is the slope of y = 3x - 5?', '["3", "-5", "5", "-3"]', '3', 'In y = mx + b form, m is the slope. Here m = 3.', 30, 2, 'understand', 2, '["Compare to y = mx + b", "m is the slope"]'),

('q_math_8f_103', 'mathematics', 'std_8f_a3', 'topic_linear_functions', 'multiple_choice', 'What is the y-intercept of y = 3x - 5?', '["3", "-5", "(0, -5)", "(0, 3)"]', '(0, -5)', 'In y = mx + b, b is the y-intercept. When x=0, y=-5. Point is (0, -5).', 35, 2, 'understand', 2, '["Set x = 0 to find y-intercept", "b is the y-intercept value"]'),

('q_math_8f_104', 'mathematics', 'std_8f_b4', 'topic_linear_functions', 'multiple_choice', 'Find the slope between points (2, 3) and (6, 11).', '["1/2", "2", "4", "8"]', '2', 'Slope = (y₂-y₁)/(x₂-x₁) = (11-3)/(6-2) = 8/4 = 2.', 40, 2, 'apply', 2, '["Rise over run", "Change in y divided by change in x"]'),

('q_math_8g_101', 'mathematics', 'std_8g_b7', 'topic_pythagorean', 'multiple_choice', 'A right triangle has legs 3 and 4. What is the hypotenuse?', '["5", "6", "7", "25"]', '5', 'Pythagorean theorem: a² + b² = c². 3² + 4² = 9 + 16 = 25. c = √25 = 5.', 35, 2, 'apply', 2, '["a² + b² = c²", "Find √(9+16)"]'),

('q_math_8g_102', 'mathematics', 'std_8g_b7', 'topic_pythagorean', 'multiple_choice', 'A ladder reaches 12 feet up a wall and is placed 5 feet from the base. How long is the ladder?', '["13 feet", "15 feet", "17 feet", "7 feet"]', '13 feet', 'This is a right triangle. Ladder² = 12² + 5² = 144 + 25 = 169. Ladder = √169 = 13 feet.', 40, 2, 'apply', 3, '["The ladder is the hypotenuse", "Use Pythagorean theorem"]'),

('q_math_8g_103', 'mathematics', 'std_8g_c9', 'topic_volume_cones_spheres', 'multiple_choice', 'What is the volume of a sphere with radius 3? (Use V = 4/3πr³, π ≈ 3)', '["36", "108", "113", "324"]', '108', 'V = (4/3)πr³ = (4/3)(3)(27) = 4 × 27 = 108.', 50, 3, 'apply', 2, '["Use V = (4/3)πr³", "r³ = 27 when r = 3"]');
