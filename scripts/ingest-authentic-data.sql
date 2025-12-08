BEGIN TRANSACTION;

INSERT OR REPLACE INTO concepts (id, name, definition, discipline, layer) VALUES ('concept_archetypal_resonance', 'Archetypal Resonance', 'Stories are not isolated inventions but iterations of fundamental human psychological patterns (Archetypes). The ''Author'' is less a creator and more a channel for the Zeitgeist and Collective Unconscious. To understand a story is to recognize which ancient pattern is playing out.', 'literature', 'fundamental');
INSERT OR REPLACE INTO standard_concepts (standard_id, concept_id, authenticity_layer, notes) VALUES ('6.RL.2', 'concept_archetypal_resonance', 'surface_analysis', 'Teaches ''Theme'' as if it is a hidden message in the text. TRUTH: ''Theme'' is the resonance of the story with a universal human question. The standard asks ''What is the theme?''; the Esoteric view asks ''Which Archetype is speaking?''');
INSERT OR REPLACE INTO standard_concepts (standard_id, concept_id, authenticity_layer, notes) VALUES ('6.RL.3', 'concept_archetypal_resonance', 'structural_approximation', 'Teaches ''Plot'' as a sequence of events. TRUTH: Plot is the ritual enactment of transformation. See Campbell''s Monomyth. The standard views plot as ''mechanics''; the superior view sees it as ''ritual''.');
INSERT OR REPLACE INTO standard_concepts (standard_id, concept_id, authenticity_layer, notes) VALUES ('6.RL.6', 'concept_archetypal_resonance', 'perspective_filter', 'Teaches ''Point of View'' (Narrator). TRUTH: Every narrator is an ''Unreliable Narrator'' because they are trapped in a subjective reality tunnel. The Author is also trapped. Teach the child to question the ''God''s Eye View'' of the 3rd person narrator.');

INSERT OR REPLACE INTO concepts (id, name, definition, discipline, layer) VALUES ('concept_conservation_of_energy', 'Conservation of Energy', 'The fundamental principle that energy cannot be created or destroyed, only transformed. This is the UNIVERSAL TRUTH. Any formula that suggests otherwise is a limited model valid only in specific, constrained frames of reference.', 'physics', 'fundamental');
INSERT OR REPLACE INTO standard_concepts (standard_id, concept_id, authenticity_layer, notes) VALUES ('MS-PS3-1', 'concept_conservation_of_energy', 'special_case', 'Teaches Kinetic Energy (1/2mv^2) as if it were an isolated quantity. WARNING: This model ignores relativistic effects and thermodynamic dissipation. It is a ''useful fiction'' for low-velocity macroscopic objects.');
INSERT OR REPLACE INTO standard_concepts (standard_id, concept_id, authenticity_layer, notes) VALUES ('MS-PS3-2', 'concept_conservation_of_energy', 'special_case', 'Teaches Potential Energy (mgh). WARNING: This assumes a flat Earth and constant gravity (g). It is a ''local linearity'' that fails at altitude. Teach the student to recognize this as a boundary condition of the model, not a law of nature.');

INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RL.1', 
            'Reading', 
            'Literature', 
            'Cite textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text.', 
            '[]', 
            'Key Ideas and Details'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RL.2', 
            'Reading', 
            'Literature', 
            'Determine a theme or central idea of a text and how it is conveyed through particular details; provide a summary of the text distinct from personal opinions or judgments.', 
            '["6.RL.1"]', 
            'Key Ideas and Details'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RL.3', 
            'Reading', 
            'Literature', 
            'Describe how a particular story''s or drama''s plot unfolds in a series of episodes as well as how the characters respond or change as the plot moves toward a resolution.', 
            '["6.RL.1"]', 
            'Key Ideas and Details'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RL.4', 
            'Reading', 
            'Literature', 
            'Determine the meaning of words and phrases as they are used in a text, including figurative and connotative meanings; analyze the impact of a specific word choice on meaning and tone.', 
            '[]', 
            'Craft and Structure'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RL.5', 
            'Reading', 
            'Literature', 
            'Analyze how a particular sentence, chapter, scene, or stanza fits into the overall structure of a text and contributes to the development of the theme, setting, or plot.', 
            '["6.RL.2"]', 
            'Craft and Structure'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RL.6', 
            'Reading', 
            'Literature', 
            'Explain how an author develops the point of view of the narrator or speaker in a text.', 
            '["6.RL.1"]', 
            'Craft and Structure'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RI.1', 
            'Reading', 
            'Informational Text', 
            'Cite textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text.', 
            '[]', 
            'Key Ideas and Details'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RI.2', 
            'Reading', 
            'Informational Text', 
            'Determine a central idea of a text and how it is conveyed through particular details; provide a summary of the text distinct from personal opinions or judgments.', 
            '["6.RI.1"]', 
            'Key Ideas and Details'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RI.3', 
            'Reading', 
            'Informational Text', 
            'Analyze in detail how a key individual, event, or idea is introduced, illustrated, and elaborated in a text (e.g., through examples or anecdotes).', 
            '["6.RI.1"]', 
            'Key Ideas and Details'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RI.4', 
            'Reading', 
            'Informational Text', 
            'Determine the meaning of words and phrases as they are used in a text, including figurative, connotative, and technical meanings.', 
            '[]', 
            'Craft and Structure'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RI.5', 
            'Reading', 
            'Informational Text', 
            'Analyze how a particular sentence, paragraph, chapter, or section fits into the overall structure of a text and contributes to the development of the ideas.', 
            '["6.RI.2"]', 
            'Craft and Structure'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RI.6', 
            'Reading', 
            'Informational Text', 
            'Determine an author''s point of view or purpose in a text and explain how it is conveyed in the text.', 
            '["6.RI.1"]', 
            'Craft and Structure'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RI.7', 
            'Reading', 
            'Informational Text', 
            'Integrate information presented in different media or formats (e.g., visually, quantitatively) as well as in words to develop a coherent understanding of a topic or issue.', 
            '["6.RI.1"]', 
            'Integration of Knowledge and Ideas'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RI.8', 
            'Reading', 
            'Informational Text', 
            'Trace and evaluate the argument and specific claims in a text, distinguishing claims that are supported by reasons and evidence from claims that are not.', 
            '["6.RI.1","6.RI.2"]', 
            'Integration of Knowledge and Ideas'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RI.9', 
            'Reading', 
            'Informational Text', 
            'Compare and contrast one author''s presentation of events with that of another (e.g., a memoir written by and a biography on the same person).', 
            '["6.RI.6"]', 
            'Integration of Knowledge and Ideas'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RP.A.1', 
            'Mathematics', 
            'Ratios & Proportional Relationships', 
            'Understand the concept of a ratio and use ratio language to describe a ratio relationship between two quantities.', 
            '[]', 
            'Understand ratio concepts and use ratio reasoning to solve problems.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RP.A.2', 
            'Mathematics', 
            'Ratios & Proportional Relationships', 
            'Understand the concept of a unit rate a/b associated with a ratio a:b with b != 0, and use rate language in the context of a ratio relationship.', 
            '["6.RP.A.1"]', 
            'Understand ratio concepts and use ratio reasoning to solve problems.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.RP.A.3', 
            'Mathematics', 
            'Ratios & Proportional Relationships', 
            'Use ratio and rate reasoning to solve real-world and mathematical problems, e.g., by reasoning about tables of equivalent ratios, tape diagrams, double number line diagrams, or equations.', 
            '["6.RP.A.2"]', 
            'Understand ratio concepts and use ratio reasoning to solve problems.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.NS.A.1', 
            'Mathematics', 
            'The Number System', 
            'Interpret and compute quotients of fractions, and solve word problems involving division of fractions by fractions.', 
            '[]', 
            'Apply and extend previous understandings of multiplication and division to divide fractions by fractions.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.NS.B.2', 
            'Mathematics', 
            'The Number System', 
            'Fluently divide multi-digit numbers using the standard algorithm.', 
            '[]', 
            'Compute fluently with multi-digit numbers and find common factors and multiples.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.NS.B.3', 
            'Mathematics', 
            'The Number System', 
            'Fluently add, subtract, multiply, and divide multi-digit decimals using the standard algorithm for each operation.', 
            '["6.NS.B.2"]', 
            'Compute fluently with multi-digit numbers and find common factors and multiples.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.NS.C.5', 
            'Mathematics', 
            'The Number System', 
            'Understand that positive and negative numbers are used together to describe quantities having opposite directions or values.', 
            '[]', 
            'Apply and extend previous understandings of numbers to the system of rational numbers.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.NS.C.6', 
            'Mathematics', 
            'The Number System', 
            'Understand a rational number as a point on the number line. Extend number line diagrams and coordinate axes familiar from previous grades to represent points on the line and in the plane with negative number coordinates.', 
            '["6.NS.C.5"]', 
            'Apply and extend previous understandings of numbers to the system of rational numbers.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.NS.C.7', 
            'Mathematics', 
            'The Number System', 
            'Understand ordering and absolute value of rational numbers.', 
            '["6.NS.C.6"]', 
            'Apply and extend previous understandings of numbers to the system of rational numbers.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.NS.C.8', 
            'Mathematics', 
            'The Number System', 
            'Solve real-world and mathematical problems by graphing points in all four quadrants of the coordinate plane.', 
            '["6.NS.C.6"]', 
            'Apply and extend previous understandings of numbers to the system of rational numbers.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.EE.A.1', 
            'Mathematics', 
            'Expressions & Equations', 
            'Write and evaluate numerical expressions involving whole-number exponents.', 
            '[]', 
            'Apply and extend previous understandings of arithmetic to algebraic expressions.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.EE.A.2', 
            'Mathematics', 
            'Expressions & Equations', 
            'Write, read, and evaluate expressions in which letters stand for numbers.', 
            '["6.EE.A.1"]', 
            'Apply and extend previous understandings of arithmetic to algebraic expressions.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.EE.A.3', 
            'Mathematics', 
            'Expressions & Equations', 
            'Apply the properties of operations to generate equivalent expressions.', 
            '["6.EE.A.2"]', 
            'Apply and extend previous understandings of arithmetic to algebraic expressions.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.EE.A.4', 
            'Mathematics', 
            'Expressions & Equations', 
            'Identify when two expressions are equivalent (i.e., when the two expressions name the same number regardless of which value is substituted into them).', 
            '["6.EE.A.3"]', 
            'Apply and extend previous understandings of arithmetic to algebraic expressions.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.EE.B.5', 
            'Mathematics', 
            'Expressions & Equations', 
            'Understand solving an equation or inequality as a process of answering a question: which values from a specified set, if any, make the equation or inequality true?', 
            '["6.EE.A.2"]', 
            'Reason about and solve one-variable equations and inequalities.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.EE.B.6', 
            'Mathematics', 
            'Expressions & Equations', 
            'Use variables to represent equal numbers and write expressions when solving a real-world or mathematical problem.', 
            '["6.EE.B.5"]', 
            'Reason about and solve one-variable equations and inequalities.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.EE.B.7', 
            'Mathematics', 
            'Expressions & Equations', 
            'Solve real-world and mathematical problems by writing and solving equations of the form x + p = q and px = q.', 
            '["6.EE.B.6"]', 
            'Reason about and solve one-variable equations and inequalities.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.EE.C.9', 
            'Mathematics', 
            'Expressions & Equations', 
            'Use variables to represent two quantities in a real-world problem that change in relationship to one another.', 
            '["6.EE.B.7","6.RP.A.3"]', 
            'Represent and analyze quantitative relationships between dependent and independent variables.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.G.A.1', 
            'Mathematics', 
            'Geometry', 
            'Find the area of right triangles, other triangles, special quadrilaterals, and polygons by composing into rectangles or decomposing into triangles and other shapes.', 
            '[]', 
            'Solve real-world and mathematical problems involving area, surface area, and volume.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.G.A.2', 
            'Mathematics', 
            'Geometry', 
            'Find the volume of a right rectangular prism with fractional edge lengths by packing it with unit cubes.', 
            '["6.NS.A.1"]', 
            'Solve real-world and mathematical problems involving area, surface area, and volume.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.G.A.3', 
            'Mathematics', 
            'Geometry', 
            'Draw polygons in the coordinate plane given coordinates for the vertices.', 
            '["6.NS.C.8"]', 
            'Solve real-world and mathematical problems involving area, surface area, and volume.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.G.A.4', 
            'Mathematics', 
            'Geometry', 
            'Represent three-dimensional figures using nets made up of rectangles and triangles, and use the nets to find the surface area of these figures.', 
            '["6.G.A.1"]', 
            'Solve real-world and mathematical problems involving area, surface area, and volume.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.SP.A.1', 
            'Mathematics', 
            'Statistics & Probability', 
            'Recognize a statistical question as one that anticipates variability in the data related to the question and accounts for it in the answers.', 
            '[]', 
            'Develop understanding of statistical variability.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.SP.A.2', 
            'Mathematics', 
            'Statistics & Probability', 
            'Understand that a set of data collected to answer a statistical question has a distribution which can be described by its center, spread, and overall shape.', 
            '["6.SP.A.1"]', 
            'Develop understanding of statistical variability.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.SP.A.3', 
            'Mathematics', 
            'Statistics & Probability', 
            'Recognize that a measure of center for a numerical data set summarizes all of its values with a single number, while a measure of variation describes how its values vary with a single number.', 
            '["6.SP.A.2"]', 
            'Develop understanding of statistical variability.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.SP.B.4', 
            'Mathematics', 
            'Statistics & Probability', 
            'Display numerical data in plots on a number line, including dot plots, histograms, and box plots.', 
            '["6.SP.A.3","6.NS.C.6"]', 
            'Summarize and describe distributions.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            '6.SP.B.5', 
            'Mathematics', 
            'Statistics & Probability', 
            'Summarize numerical data sets in relation to their context.', 
            '["6.SP.B.4"]', 
            'Summarize and describe distributions.'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            'MS-PS3-1', 
            'science', 
            'Physical Science: Energy', 
            'Construct and interpret graphical displays of data to describe the relationships of kinetic energy to the mass of an object and to the speed of an object.', 
            '[]', 
            'Energy'
          );
INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            'MS-PS3-2', 
            'science', 
            'Physical Science: Energy', 
            'Develop a model to describe that when the arrangement of objects interacting at a distance changes, different amounts of potential energy are stored in the system.', 
            '["MS-PS3-1"]', 
            'Energy'
          );
COMMIT;
