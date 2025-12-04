-- HYRO FORGE: Language Arts Curriculum
-- Migration 021: Common Core ELA Grade 6 + Extensions through Grade 8
-- Covers: Reading Literature, Reading Informational Text, Writing, Language (Grammar/Vocabulary)
-- Goal: Integrated Language Arts - Reading, Writing, Speaking, Listening

-- ============================================================================
-- GRADE 6 READING LITERATURE STANDARDS (Common Core)
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  -- Key Ideas and Details
  ('ela_6rl_1', 'language_arts', 'common_core', 'RL.6.1', 'Cite Textual Evidence', 'Cite textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text.', 6, 'middle', 'Reading Literature', 'Key Ideas and Details', 1, 1),
  ('ela_6rl_2', 'language_arts', 'common_core', 'RL.6.2', 'Determine Theme', 'Determine a theme or central idea of a text and how it is conveyed through particular details; provide a summary of the text distinct from personal opinions or judgments.', 6, 'middle', 'Reading Literature', 'Key Ideas and Details', 2, 1),
  ('ela_6rl_3', 'language_arts', 'common_core', 'RL.6.3', 'Analyze Plot Development', 'Describe how a particular story''s or drama''s plot unfolds in a series of episodes as well as how the characters respond or change as the plot moves toward a resolution.', 6, 'middle', 'Reading Literature', 'Key Ideas and Details', 3, 1),

  -- Craft and Structure
  ('ela_6rl_4', 'language_arts', 'common_core', 'RL.6.4', 'Word Choice and Tone', 'Determine the meaning of words and phrases as they are used in a text, including figurative and connotative meanings; analyze the impact of a specific word choice on meaning and tone.', 6, 'middle', 'Reading Literature', 'Craft and Structure', 4, 1),
  ('ela_6rl_5', 'language_arts', 'common_core', 'RL.6.5', 'Text Structure', 'Analyze how a particular sentence, chapter, scene, or stanza fits into the overall structure of a text and contributes to the development of the theme, setting, or plot.', 6, 'middle', 'Reading Literature', 'Craft and Structure', 5, 1),
  ('ela_6rl_6', 'language_arts', 'common_core', 'RL.6.6', 'Point of View', 'Explain how an author develops the point of view of the narrator or speaker in a text.', 6, 'middle', 'Reading Literature', 'Craft and Structure', 6, 1),

  -- Integration of Knowledge and Ideas
  ('ela_6rl_7', 'language_arts', 'common_core', 'RL.6.7', 'Compare Media Versions', 'Compare and contrast the experience of reading a story, drama, or poem to listening to or viewing an audio, video, or live version of the text.', 6, 'middle', 'Reading Literature', 'Integration of Knowledge and Ideas', 7, 1),
  ('ela_6rl_9', 'language_arts', 'common_core', 'RL.6.9', 'Compare Texts', 'Compare and contrast texts in different forms or genres in terms of their approaches to similar themes and topics.', 6, 'middle', 'Reading Literature', 'Integration of Knowledge and Ideas', 8, 1),

  -- Range of Reading
  ('ela_6rl_10', 'language_arts', 'common_core', 'RL.6.10', 'Read Complex Literature', 'By the end of the year, read and comprehend literature, including stories, dramas, and poems, in the grades 6-8 text complexity band proficiently.', 6, 'middle', 'Reading Literature', 'Range of Reading', 9, 1);

-- ============================================================================
-- GRADE 6 READING INFORMATIONAL TEXT STANDARDS
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  ('ela_6ri_1', 'language_arts', 'common_core', 'RI.6.1', 'Cite Evidence in Nonfiction', 'Cite textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text.', 6, 'middle', 'Reading Informational', 'Key Ideas and Details', 20, 1),
  ('ela_6ri_2', 'language_arts', 'common_core', 'RI.6.2', 'Central Idea and Summary', 'Determine a central idea of a text and how it is conveyed through particular details; provide a summary of the text distinct from personal opinions or judgments.', 6, 'middle', 'Reading Informational', 'Key Ideas and Details', 21, 1),
  ('ela_6ri_3', 'language_arts', 'common_core', 'RI.6.3', 'Analyze Connections', 'Analyze in detail how a key individual, event, or idea is introduced, illustrated, and elaborated in a text.', 6, 'middle', 'Reading Informational', 'Key Ideas and Details', 22, 1),
  ('ela_6ri_4', 'language_arts', 'common_core', 'RI.6.4', 'Technical Vocabulary', 'Determine the meaning of words and phrases as they are used in a text, including figurative, connotative, and technical meanings.', 6, 'middle', 'Reading Informational', 'Craft and Structure', 23, 1),
  ('ela_6ri_5', 'language_arts', 'common_core', 'RI.6.5', 'Analyze Text Structure', 'Analyze how a particular sentence, paragraph, chapter, or section fits into the overall structure of a text and contributes to the development of the ideas.', 6, 'middle', 'Reading Informational', 'Craft and Structure', 24, 1),
  ('ela_6ri_6', 'language_arts', 'common_core', 'RI.6.6', 'Author''s Purpose and Point of View', 'Determine an author''s point of view or purpose in a text and explain how it is conveyed in the text.', 6, 'middle', 'Reading Informational', 'Craft and Structure', 25, 1),
  ('ela_6ri_7', 'language_arts', 'common_core', 'RI.6.7', 'Integrate Multiple Sources', 'Integrate information presented in different media or formats as well as in words to develop a coherent understanding of a topic or issue.', 6, 'middle', 'Reading Informational', 'Integration of Knowledge', 26, 1),
  ('ela_6ri_8', 'language_arts', 'common_core', 'RI.6.8', 'Evaluate Arguments', 'Trace and evaluate the argument and specific claims in a text, distinguishing claims that are supported by reasons and evidence from claims that are not.', 6, 'middle', 'Reading Informational', 'Integration of Knowledge', 27, 1),
  ('ela_6ri_9', 'language_arts', 'common_core', 'RI.6.9', 'Compare Authors'' Presentations', 'Compare and contrast one author''s presentation of events with that of another.', 6, 'middle', 'Reading Informational', 'Integration of Knowledge', 28, 1);

-- ============================================================================
-- GRADE 6 WRITING STANDARDS
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  -- Text Types and Purposes
  ('ela_6w_1', 'language_arts', 'common_core', 'W.6.1', 'Write Arguments', 'Write arguments to support claims with clear reasons and relevant evidence.', 6, 'middle', 'Writing', 'Text Types and Purposes', 40, 1),
  ('ela_6w_1a', 'language_arts', 'common_core', 'W.6.1a', 'Introduce Claims', 'Introduce claim(s) and organize the reasons and evidence clearly.', 6, 'middle', 'Writing', 'Text Types and Purposes', 41, 1),
  ('ela_6w_1b', 'language_arts', 'common_core', 'W.6.1b', 'Support Claims', 'Support claim(s) with clear reasons and relevant evidence, using credible sources and demonstrating an understanding of the topic or text.', 6, 'middle', 'Writing', 'Text Types and Purposes', 42, 1),
  ('ela_6w_1c', 'language_arts', 'common_core', 'W.6.1c', 'Use Transitions', 'Use words, phrases, and clauses to clarify the relationships among claim(s) and reasons.', 6, 'middle', 'Writing', 'Text Types and Purposes', 43, 1),
  ('ela_6w_1d', 'language_arts', 'common_core', 'W.6.1d', 'Formal Style', 'Establish and maintain a formal style.', 6, 'middle', 'Writing', 'Text Types and Purposes', 44, 1),
  ('ela_6w_1e', 'language_arts', 'common_core', 'W.6.1e', 'Concluding Statement', 'Provide a concluding statement or section that follows from the argument presented.', 6, 'middle', 'Writing', 'Text Types and Purposes', 45, 1),

  ('ela_6w_2', 'language_arts', 'common_core', 'W.6.2', 'Write Informative/Explanatory', 'Write informative/explanatory texts to examine a topic and convey ideas, concepts, and information through the selection, organization, and analysis of relevant content.', 6, 'middle', 'Writing', 'Text Types and Purposes', 46, 1),
  ('ela_6w_3', 'language_arts', 'common_core', 'W.6.3', 'Write Narratives', 'Write narratives to develop real or imagined experiences or events using effective technique, relevant descriptive details, and well-structured event sequences.', 6, 'middle', 'Writing', 'Text Types and Purposes', 47, 1),

  -- Production and Distribution
  ('ela_6w_4', 'language_arts', 'common_core', 'W.6.4', 'Clear and Coherent Writing', 'Produce clear and coherent writing in which the development, organization, and style are appropriate to task, purpose, and audience.', 6, 'middle', 'Writing', 'Production and Distribution', 50, 1),
  ('ela_6w_5', 'language_arts', 'common_core', 'W.6.5', 'Writing Process', 'With some guidance and support from peers and adults, develop and strengthen writing as needed by planning, revising, editing, rewriting, or trying a new approach.', 6, 'middle', 'Writing', 'Production and Distribution', 51, 1),
  ('ela_6w_6', 'language_arts', 'common_core', 'W.6.6', 'Use Technology', 'Use technology, including the Internet, to produce and publish writing as well as to interact and collaborate with others.', 6, 'middle', 'Writing', 'Production and Distribution', 52, 1),

  -- Research
  ('ela_6w_7', 'language_arts', 'common_core', 'W.6.7', 'Conduct Research', 'Conduct short research projects to answer a question, drawing on several sources and refocusing the inquiry when appropriate.', 6, 'middle', 'Writing', 'Research', 55, 1),
  ('ela_6w_8', 'language_arts', 'common_core', 'W.6.8', 'Gather Information', 'Gather relevant information from multiple print and digital sources; assess the credibility of each source; and quote or paraphrase the data and conclusions of others while avoiding plagiarism.', 6, 'middle', 'Writing', 'Research', 56, 1),
  ('ela_6w_9', 'language_arts', 'common_core', 'W.6.9', 'Draw Evidence', 'Draw evidence from literary or informational texts to support analysis, reflection, and research.', 6, 'middle', 'Writing', 'Research', 57, 1);

-- ============================================================================
-- GRADE 6 LANGUAGE STANDARDS (Grammar, Usage, Vocabulary)
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  -- Conventions
  ('ela_6l_1', 'language_arts', 'common_core', 'L.6.1', 'Standard English Grammar', 'Demonstrate command of the conventions of standard English grammar and usage when writing or speaking.', 6, 'middle', 'Language', 'Conventions', 70, 1),
  ('ela_6l_1a', 'language_arts', 'common_core', 'L.6.1a', 'Subjective/Objective/Possessive Pronouns', 'Ensure that pronouns are in the proper case (subjective, objective, possessive).', 6, 'middle', 'Language', 'Conventions', 71, 1),
  ('ela_6l_1b', 'language_arts', 'common_core', 'L.6.1b', 'Intensive Pronouns', 'Use intensive pronouns (e.g., myself, ourselves).', 6, 'middle', 'Language', 'Conventions', 72, 1),
  ('ela_6l_1c', 'language_arts', 'common_core', 'L.6.1c', 'Pronoun Antecedent Agreement', 'Recognize and correct inappropriate shifts in pronoun number and person.', 6, 'middle', 'Language', 'Conventions', 73, 1),
  ('ela_6l_1d', 'language_arts', 'common_core', 'L.6.1d', 'Vague Pronouns', 'Recognize and correct vague pronouns (i.e., ones with unclear or ambiguous antecedents).', 6, 'middle', 'Language', 'Conventions', 74, 1),
  ('ela_6l_1e', 'language_arts', 'common_core', 'L.6.1e', 'Sentence Variety', 'Recognize variations from standard English in their own and others'' writing and speaking, and identify and use strategies to improve expression.', 6, 'middle', 'Language', 'Conventions', 75, 1),

  ('ela_6l_2', 'language_arts', 'common_core', 'L.6.2', 'Punctuation and Spelling', 'Demonstrate command of the conventions of standard English capitalization, punctuation, and spelling when writing.', 6, 'middle', 'Language', 'Conventions', 76, 1),
  ('ela_6l_2a', 'language_arts', 'common_core', 'L.6.2a', 'Punctuation in Sentences', 'Use punctuation (commas, parentheses, dashes) to set off nonrestrictive/parenthetical elements.', 6, 'middle', 'Language', 'Conventions', 77, 1),
  ('ela_6l_2b', 'language_arts', 'common_core', 'L.6.2b', 'Spelling Correctly', 'Spell correctly.', 6, 'middle', 'Language', 'Conventions', 78, 1),

  -- Knowledge of Language
  ('ela_6l_3', 'language_arts', 'common_core', 'L.6.3', 'Knowledge of Language', 'Use knowledge of language and its conventions when writing, speaking, reading, or listening.', 6, 'middle', 'Language', 'Knowledge of Language', 80, 1),
  ('ela_6l_3a', 'language_arts', 'common_core', 'L.6.3a', 'Sentence Patterns', 'Vary sentence patterns for meaning, reader/listener interest, and style.', 6, 'middle', 'Language', 'Knowledge of Language', 81, 1),
  ('ela_6l_3b', 'language_arts', 'common_core', 'L.6.3b', 'Maintain Consistency', 'Maintain consistency in style and tone.', 6, 'middle', 'Language', 'Knowledge of Language', 82, 1),

  -- Vocabulary Acquisition
  ('ela_6l_4', 'language_arts', 'common_core', 'L.6.4', 'Determine Word Meanings', 'Determine or clarify the meaning of unknown and multiple-meaning words and phrases based on grade 6 reading and content.', 6, 'middle', 'Language', 'Vocabulary', 85, 1),
  ('ela_6l_4a', 'language_arts', 'common_core', 'L.6.4a', 'Context Clues', 'Use context (e.g., the overall meaning of a sentence or paragraph; a word''s position or function in a sentence) as a clue to the meaning of a word or phrase.', 6, 'middle', 'Language', 'Vocabulary', 86, 1),
  ('ela_6l_4b', 'language_arts', 'common_core', 'L.6.4b', 'Greek/Latin Affixes and Roots', 'Use common, grade-appropriate Greek or Latin affixes and roots as clues to the meaning of a word.', 6, 'middle', 'Language', 'Vocabulary', 87, 1),
  ('ela_6l_4c', 'language_arts', 'common_core', 'L.6.4c', 'Reference Materials', 'Consult reference materials (e.g., dictionaries, glossaries, thesauruses), both print and digital, to find the pronunciation of a word or determine or clarify its precise meaning or its part of speech.', 6, 'middle', 'Language', 'Vocabulary', 88, 1),
  ('ela_6l_4d', 'language_arts', 'common_core', 'L.6.4d', 'Verify Meaning', 'Verify the preliminary determination of the meaning of a word or phrase.', 6, 'middle', 'Language', 'Vocabulary', 89, 1),

  ('ela_6l_5', 'language_arts', 'common_core', 'L.6.5', 'Figurative Language', 'Demonstrate understanding of figurative language, word relationships, and nuances in word meanings.', 6, 'middle', 'Language', 'Vocabulary', 90, 1),
  ('ela_6l_5a', 'language_arts', 'common_core', 'L.6.5a', 'Interpret Figures of Speech', 'Interpret figures of speech (e.g., personification) in context.', 6, 'middle', 'Language', 'Vocabulary', 91, 1),
  ('ela_6l_5b', 'language_arts', 'common_core', 'L.6.5b', 'Word Relationships', 'Use the relationship between particular words (e.g., cause/effect, part/whole, item/category) to better understand each of the words.', 6, 'middle', 'Language', 'Vocabulary', 92, 1),
  ('ela_6l_5c', 'language_arts', 'common_core', 'L.6.5c', 'Connotation/Denotation', 'Distinguish among the connotations (associations) of words with similar denotations (definitions).', 6, 'middle', 'Language', 'Vocabulary', 93, 1),

  ('ela_6l_6', 'language_arts', 'common_core', 'L.6.6', 'Academic Vocabulary', 'Acquire and use accurately grade-appropriate general academic and domain-specific words and phrases.', 6, 'middle', 'Language', 'Vocabulary', 95, 1);

-- ============================================================================
-- GRADES 7-8 EXTENSION STANDARDS (Selected Key Standards)
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  -- Grade 7 Reading Literature
  ('ela_7rl_1', 'language_arts', 'common_core', 'RL.7.1', 'Cite Multiple Sources', 'Cite several pieces of textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text.', 7, 'middle', 'Reading Literature', 'Key Ideas and Details', 100, 1, 1),
  ('ela_7rl_2', 'language_arts', 'common_core', 'RL.7.2', 'Theme Development', 'Determine a theme or central idea of a text and analyze its development over the course of the text; provide an objective summary of the text.', 7, 'middle', 'Reading Literature', 'Key Ideas and Details', 101, 1, 1),
  ('ela_7rl_3', 'language_arts', 'common_core', 'RL.7.3', 'Analyze Interactions', 'Analyze how particular elements of a story or drama interact (e.g., how setting shapes the characters or plot).', 7, 'middle', 'Reading Literature', 'Key Ideas and Details', 102, 1, 1),
  ('ela_7rl_6', 'language_arts', 'common_core', 'RL.7.6', 'Contrasting Points of View', 'Analyze how an author develops and contrasts the points of view of different characters or narrators in a text.', 7, 'middle', 'Reading Literature', 'Craft and Structure', 103, 1, 1),

  -- Grade 7 Writing
  ('ela_7w_1', 'language_arts', 'common_core', 'W.7.1', 'Arguments with Evidence', 'Write arguments to support claims with clear reasons and relevant evidence, acknowledging alternate or opposing claims.', 7, 'middle', 'Writing', 'Text Types and Purposes', 110, 1, 1),
  ('ela_7w_2', 'language_arts', 'common_core', 'W.7.2', 'Informative Analysis', 'Write informative/explanatory texts to examine a topic and convey ideas, concepts, and information through the selection, organization, and analysis of relevant content.', 7, 'middle', 'Writing', 'Text Types and Purposes', 111, 1, 1),
  ('ela_7w_3', 'language_arts', 'common_core', 'W.7.3', 'Narrative Technique', 'Write narratives to develop real or imagined experiences or events using effective technique, relevant descriptive details, and well-structured event sequences.', 7, 'middle', 'Writing', 'Text Types and Purposes', 112, 1, 1),

  -- Grade 8 Reading Literature
  ('ela_8rl_1', 'language_arts', 'common_core', 'RL.8.1', 'Strongest Evidence', 'Cite the textual evidence that most strongly supports an analysis of what the text says explicitly as well as inferences drawn from the text.', 8, 'middle', 'Reading Literature', 'Key Ideas and Details', 120, 1, 1),
  ('ela_8rl_2', 'language_arts', 'common_core', 'RL.8.2', 'Theme and Summary', 'Determine a theme or central idea of a text and analyze its development over the course of the text, including its relationship to the characters, setting, and plot; provide an objective summary.', 8, 'middle', 'Reading Literature', 'Key Ideas and Details', 121, 1, 1),
  ('ela_8rl_4', 'language_arts', 'common_core', 'RL.8.4', 'Word Choice Impact', 'Determine the meaning of words and phrases as they are used in a text, including figurative and connotative meanings; analyze the impact of specific word choices on meaning and tone, including analogies or allusions.', 8, 'middle', 'Reading Literature', 'Craft and Structure', 122, 1, 1),
  ('ela_8rl_6', 'language_arts', 'common_core', 'RL.8.6', 'Differences in Perspective', 'Analyze how differences in the points of view of the characters and the audience or reader create such effects as suspense or humor.', 8, 'middle', 'Reading Literature', 'Craft and Structure', 123, 1, 1),

  -- Grade 8 Writing
  ('ela_8w_1', 'language_arts', 'common_core', 'W.8.1', 'Acknowledge Counterclaims', 'Write arguments to support claims with clear reasons and relevant evidence, acknowledging and responding to counterclaims.', 8, 'middle', 'Writing', 'Text Types and Purposes', 130, 1, 1),
  ('ela_8w_2', 'language_arts', 'common_core', 'W.8.2', 'Complex Informative', 'Write informative/explanatory texts to examine a topic and convey ideas, concepts, and information through the selection, organization, and analysis of relevant content.', 8, 'middle', 'Writing', 'Text Types and Purposes', 131, 1, 1);

-- ============================================================================
-- CURRICULUM TOPICS - LANGUAGE ARTS
-- ============================================================================

-- Reading Literature Topics
INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ela_evidence_intro', 'language_arts', 'ela_6rl_1', 'Introduction to Textual Evidence', 'Understanding what counts as textual evidence', '["Define textual evidence", "Identify explicit information in a text", "Locate relevant quotes and details"]', 1, 20),
  ('topic_ela_citing_evidence', 'language_arts', 'ela_6rl_1', 'Citing Evidence Properly', 'How to properly cite evidence from a text', '["Use quotation marks correctly", "Introduce quotes smoothly", "Connect evidence to claims"]', 2, 25),
  ('topic_ela_inference', 'language_arts', 'ela_6rl_1', 'Making Inferences', 'Drawing conclusions from textual evidence', '["Define inference", "Combine text clues with background knowledge", "Support inferences with evidence"]', 2, 30),
  ('topic_ela_theme_intro', 'language_arts', 'ela_6rl_2', 'Understanding Theme', 'What is theme and how to identify it', '["Define theme vs. topic", "Identify common themes in literature", "Distinguish theme from summary"]', 2, 25),
  ('topic_ela_theme_development', 'language_arts', 'ela_6rl_2', 'How Theme Develops', 'Tracing theme development through a text', '["Track how details build theme", "Identify key moments that reveal theme", "Explain how events support theme"]', 3, 35),
  ('topic_ela_summary', 'language_arts', 'ela_6rl_2', 'Writing Objective Summaries', 'Summarizing without personal opinions', '["Include only key events and ideas", "Avoid personal judgments", "Maintain objectivity"]', 2, 25),
  ('topic_ela_plot_elements', 'language_arts', 'ela_6rl_3', 'Elements of Plot', 'Understanding plot structure', '["Identify exposition, rising action, climax, falling action, resolution", "Explain how events connect", "Recognize plot complications"]', 1, 20),
  ('topic_ela_character_development', 'language_arts', 'ela_6rl_3', 'Character Development', 'How characters change through a story', '["Track character changes", "Identify what causes characters to change", "Connect character development to plot"]', 2, 30),
  ('topic_ela_figurative_language', 'language_arts', 'ela_6rl_4', 'Figurative Language', 'Understanding figures of speech', '["Identify similes, metaphors, personification", "Interpret figurative meaning", "Explain effect on reader"]', 2, 30),
  ('topic_ela_connotation', 'language_arts', 'ela_6rl_4', 'Connotation and Denotation', 'Word meanings beyond dictionary definitions', '["Define connotation and denotation", "Identify word connotations", "Analyze author word choice"]', 2, 25),
  ('topic_ela_tone', 'language_arts', 'ela_6rl_4', 'Understanding Tone', 'How word choice creates tone', '["Define tone in literature", "Identify words that create tone", "Describe tone using precise vocabulary"]', 2, 25),
  ('topic_ela_text_structure_lit', 'language_arts', 'ela_6rl_5', 'Text Structure in Literature', 'How authors organize stories', '["Identify chapter/scene purposes", "Analyze how structure affects meaning", "Connect structure to theme"]', 3, 30),
  ('topic_ela_point_of_view', 'language_arts', 'ela_6rl_6', 'Point of View', 'Understanding narrator perspective', '["Identify first, second, third person POV", "Explain how POV affects reader experience", "Analyze author''s POV choices"]', 2, 25);

-- Writing Topics
INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ela_argument_intro', 'language_arts', 'ela_6w_1', 'Introduction to Argumentative Writing', 'Understanding the purpose of arguments', '["Define claim, reasons, evidence", "Identify parts of an argument", "Understand audience and purpose"]', 1, 20),
  ('topic_ela_claims', 'language_arts', 'ela_6w_1a', 'Writing Strong Claims', 'Crafting arguable thesis statements', '["Write clear, arguable claims", "Avoid fact-based claims", "Position claims strategically"]', 2, 30),
  ('topic_ela_evidence_writing', 'language_arts', 'ela_6w_1b', 'Supporting with Evidence', 'Using credible sources to support claims', '["Select relevant evidence", "Evaluate source credibility", "Connect evidence to claims"]', 2, 35),
  ('topic_ela_transitions', 'language_arts', 'ela_6w_1c', 'Using Transitions', 'Connecting ideas with transition words', '["Use transitions between sentences", "Use transitions between paragraphs", "Choose appropriate transition types"]', 2, 25),
  ('topic_ela_formal_style', 'language_arts', 'ela_6w_1d', 'Writing in Formal Style', 'Maintaining academic tone', '["Avoid slang and contractions", "Use third person when appropriate", "Maintain objective tone"]', 2, 20),
  ('topic_ela_conclusions', 'language_arts', 'ela_6w_1e', 'Writing Conclusions', 'Ending arguments effectively', '["Summarize without repeating", "End with impact", "Connect to broader significance"]', 2, 25),
  ('topic_ela_informative_intro', 'language_arts', 'ela_6w_2', 'Informative Writing Basics', 'Explaining topics clearly', '["Organize information logically", "Use facts and details", "Maintain focus on topic"]', 2, 30),
  ('topic_ela_narrative_elements', 'language_arts', 'ela_6w_3', 'Narrative Writing Elements', 'Crafting engaging stories', '["Develop characters and setting", "Create conflict and tension", "Use descriptive details"]', 2, 35),
  ('topic_ela_writing_process', 'language_arts', 'ela_6w_5', 'The Writing Process', 'Planning, drafting, revising, editing', '["Create effective outlines", "Write focused drafts", "Revise for content and style", "Edit for conventions"]', 2, 40),
  ('topic_ela_research_skills', 'language_arts', 'ela_6w_7', 'Research Skills', 'Finding and using sources', '["Generate research questions", "Find credible sources", "Take effective notes"]', 2, 35),
  ('topic_ela_avoiding_plagiarism', 'language_arts', 'ela_6w_8', 'Avoiding Plagiarism', 'Quoting and paraphrasing ethically', '["Quote sources correctly", "Paraphrase without copying", "Give proper credit"]', 2, 25);

-- Grammar and Vocabulary Topics
INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ela_pronoun_cases', 'language_arts', 'ela_6l_1a', 'Pronoun Cases', 'Using subjective, objective, and possessive pronouns', '["Identify pronoun cases", "Choose correct pronoun form", "Fix pronoun case errors"]', 2, 25),
  ('topic_ela_pronoun_agreement', 'language_arts', 'ela_6l_1c', 'Pronoun-Antecedent Agreement', 'Making pronouns agree with their antecedents', '["Identify antecedents", "Match pronoun number and gender", "Fix agreement errors"]', 2, 25),
  ('topic_ela_punctuation_advanced', 'language_arts', 'ela_6l_2a', 'Advanced Punctuation', 'Using commas, dashes, and parentheses', '["Use commas to set off elements", "Use dashes for emphasis", "Use parentheses for asides"]', 2, 30),
  ('topic_ela_sentence_variety', 'language_arts', 'ela_6l_3a', 'Sentence Variety', 'Varying sentence structure for effect', '["Vary sentence beginnings", "Mix sentence lengths", "Use different sentence types"]', 2, 30),
  ('topic_ela_context_clues', 'language_arts', 'ela_6l_4a', 'Using Context Clues', 'Determining word meanings from context', '["Use surrounding words as clues", "Apply context clue strategies", "Verify meanings"]', 2, 25),
  ('topic_ela_roots_affixes', 'language_arts', 'ela_6l_4b', 'Greek and Latin Roots', 'Using word parts to determine meaning', '["Identify common roots", "Recognize prefixes and suffixes", "Build words from parts"]', 2, 35),
  ('topic_ela_figures_of_speech', 'language_arts', 'ela_6l_5a', 'Figures of Speech', 'Interpreting figurative expressions', '["Identify personification, hyperbole, idioms", "Interpret figurative meaning", "Use figurative language in writing"]', 2, 30),
  ('topic_ela_word_relationships', 'language_arts', 'ela_6l_5b', 'Word Relationships', 'Understanding how words relate', '["Identify synonyms and antonyms", "Understand analogies", "Recognize word families"]', 2, 25),
  ('topic_ela_academic_vocab', 'language_arts', 'ela_6l_6', 'Academic Vocabulary', 'Using formal academic language', '["Learn tier 2 academic words", "Use domain-specific terms", "Apply vocabulary in context"]', 2, 40);

-- ============================================================================
-- QUESTION BANK - LANGUAGE ARTS
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  -- Reading Literature Questions
  ('q_ela_evidence_001', 'language_arts', 'ela_6rl_1', 'topic_ela_evidence_intro', 'multiple_choice', 'What is textual evidence?', '["Your personal opinion about a text", "Information directly from the text that supports an idea", "A summary of the whole story", "The title and author of a book"]', 'Information directly from the text that supports an idea', 'Textual evidence is information, quotes, or details taken directly from the text that support your analysis or claims about the text.', 25, 1, 'remember', 1, '["Think about where evidence comes from", "Consider what supports claims about a text"]'),

  ('q_ela_evidence_002', 'language_arts', 'ela_6rl_1', 'topic_ela_citing_evidence', 'multiple_choice', 'Which is the BEST way to introduce a quote from a text?', '["The text says, "..."", "According to the author, "..."", "Just put the quote with quotation marks", "I think the quote means"]', 'According to the author, "..."', 'Introducing quotes smoothly with phrases like "According to the author" or "The narrator explains" helps integrate evidence into your writing and makes it clear where the information comes from.', 35, 2, 'apply', 2, '["Think about how to smoothly connect a quote", "What sounds most professional?"]'),

  ('q_ela_inference_001', 'language_arts', 'ela_6rl_1', 'topic_ela_inference', 'multiple_choice', 'An inference is:', '["A guess with no support", "A conclusion based on evidence and reasoning", "Copying directly from the text", "The author''s exact words"]', 'A conclusion based on evidence and reasoning', 'An inference combines textual evidence with your own reasoning and background knowledge to draw a logical conclusion that isn''t directly stated in the text.', 30, 2, 'understand', 2, '["Think about what inference involves", "How is it different from just finding information?"]'),

  ('q_ela_theme_001', 'language_arts', 'ela_6rl_2', 'topic_ela_theme_intro', 'multiple_choice', 'What is the difference between a topic and a theme?', '["They mean the same thing", "A topic is one word; a theme is a message or lesson", "A theme is one word; a topic is a message", "Topics are in fiction; themes are in nonfiction"]', 'A topic is one word; a theme is a message or lesson', 'A topic is a single word or short phrase (like "friendship" or "courage"), while a theme is a complete message or lesson about that topic (like "True friendship requires sacrifice").', 40, 2, 'understand', 2, '["How detailed is each one?", "Which one teaches a lesson?"]'),

  ('q_ela_theme_002', 'language_arts', 'ela_6rl_2', 'topic_ela_theme_intro', 'multiple_choice', 'Which of the following is a THEME (not just a topic)?', '["Love", "Perseverance leads to success", "Family", "War"]', 'Perseverance leads to success', 'This is a theme because it expresses a complete message about perseverance. The other options are topics (single words) that could be developed into themes.', 35, 2, 'analyze', 2, '["Which one expresses a complete idea?", "Which one teaches something?"]'),

  ('q_ela_plot_001', 'language_arts', 'ela_6rl_3', 'topic_ela_plot_elements', 'multiple_choice', 'What is the climax of a story?', '["The beginning where characters are introduced", "The turning point or most intense moment", "The end where everything is resolved", "The part where problems begin"]', 'The turning point or most intense moment', 'The climax is the turning point of the story where tension is highest and the main conflict comes to a head. After the climax, the story moves toward resolution.', 30, 1, 'remember', 1, '["Think about the most exciting part", "What comes after rising action?"]'),

  ('q_ela_figurative_001', 'language_arts', 'ela_6rl_4', 'topic_ela_figurative_language', 'multiple_choice', '"The wind whispered through the trees" is an example of:', '["Simile", "Metaphor", "Personification", "Hyperbole"]', 'Personification', 'Personification gives human qualities to non-human things. Wind cannot actually whisper - that''s a human action - so this is personification.', 35, 2, 'apply', 2, '["What human quality is given?", "Can wind really whisper?"]'),

  ('q_ela_figurative_002', 'language_arts', 'ela_6rl_4', 'topic_ela_figurative_language', 'multiple_choice', '"Her smile was as bright as the sun" is an example of:', '["Simile", "Metaphor", "Personification", "Onomatopoeia"]', 'Simile', 'A simile compares two things using "like" or "as." This sentence compares a smile to the sun using the word "as."', 30, 2, 'apply', 2, '["Look for comparison words", "Is \"like\" or \"as\" used?"]'),

  ('q_ela_figurative_003', 'language_arts', 'ela_6rl_4', 'topic_ela_figurative_language', 'multiple_choice', '"Life is a journey" is an example of:', '["Simile", "Metaphor", "Personification", "Alliteration"]', 'Metaphor', 'A metaphor directly compares two things without using "like" or "as." This sentence says life IS a journey, making a direct comparison.', 35, 2, 'apply', 2, '["Is this a direct comparison?", "Are \"like\" or \"as\" used?"]'),

  ('q_ela_pov_001', 'language_arts', 'ela_6rl_6', 'topic_ela_point_of_view', 'multiple_choice', 'A story using "I," "me," and "my" is told from which point of view?', '["First person", "Second person", "Third person limited", "Third person omniscient"]', 'First person', 'First person point of view uses first person pronouns (I, me, my, we, us) because the narrator is a character in the story telling their own experience.', 25, 1, 'remember', 1, '["What pronouns indicate the narrator is part of the story?"]'),

  -- Writing Questions
  ('q_ela_claim_001', 'language_arts', 'ela_6w_1a', 'topic_ela_claims', 'multiple_choice', 'Which is the BEST example of an arguable claim?', '["The sky is blue", "Pizza was invented in Italy", "Schools should require uniforms", "There are 50 states in the USA"]', 'Schools should require uniforms', 'An arguable claim is a statement that can be debated - people can reasonably agree or disagree. The other options are facts that cannot be argued.', 40, 2, 'evaluate', 3, '["Which one could someone disagree with?", "Which one is a fact vs. opinion?"]'),

  ('q_ela_evidence_writing_001', 'language_arts', 'ela_6w_1b', 'topic_ela_evidence_writing', 'multiple_choice', 'What makes a source credible?', '["It was found on the internet", "It has colorful pictures", "It is written by an expert and can be verified", "It agrees with your opinion"]', 'It is written by an expert and can be verified', 'Credible sources are written by qualified experts, can be verified by other sources, and come from reputable publications. Just being online or agreeing with you doesn''t make a source credible.', 45, 2, 'evaluate', 3, '["Think about who writes reliable information", "What makes information trustworthy?"]'),

  ('q_ela_transition_001', 'language_arts', 'ela_6w_1c', 'topic_ela_transitions', 'multiple_choice', 'Which transition word shows CONTRAST?', '["Furthermore", "However", "Therefore", "Additionally"]', 'However', '"However" signals that the next idea contrasts with or contradicts the previous one. The other options show addition (furthermore, additionally) or cause/effect (therefore).', 30, 2, 'apply', 2, '["Which word signals an opposite idea?", "Think about \"but\" synonyms"]'),

  ('q_ela_formal_001', 'language_arts', 'ela_6w_1d', 'topic_ela_formal_style', 'multiple_choice', 'Which sentence uses formal academic style?', '["Kids these days are totally into video games.", "Young people demonstrate significant interest in video games.", "Lots of people like playing games and stuff.", "Video games are like super popular now."]', 'Young people demonstrate significant interest in video games.', 'Formal academic style avoids slang, contractions, and casual language. It uses precise vocabulary and maintains an objective, professional tone.', 35, 2, 'apply', 2, '["Look for professional language", "Which avoids slang?"]'),

  -- Grammar Questions
  ('q_ela_pronoun_001', 'language_arts', 'ela_6l_1a', 'topic_ela_pronoun_cases', 'multiple_choice', 'Choose the correct pronoun: "The teacher gave the award to Sarah and ___."', '["I", "me", "myself", "mine"]', 'me', 'After a preposition like "to," use the objective case pronoun "me." You can check by removing "Sarah and" - you would say "The teacher gave the award to me."', 35, 2, 'apply', 2, '["What case follows a preposition?", "Try removing \"Sarah and\""]'),

  ('q_ela_pronoun_002', 'language_arts', 'ela_6l_1a', 'topic_ela_pronoun_cases', 'multiple_choice', 'Choose the correct pronoun: "___ and Jake went to the store."', '["Me", "Him", "She", "Her"]', 'She', 'As the subject of the sentence, use the subjective case pronoun "She." You can check by removing "and Jake" - you would say "She went to the store."', 30, 2, 'apply', 2, '["What case is needed for subjects?", "Try removing \"and Jake\""]'),

  ('q_ela_punctuation_001', 'language_arts', 'ela_6l_2a', 'topic_ela_punctuation_advanced', 'multiple_choice', 'Which sentence uses commas correctly?', '["My brother, who lives in Texas visits often.", "My brother who lives in Texas, visits often.", "My brother, who lives in Texas, visits often.", "My brother who lives in Texas visits often."]', 'My brother, who lives in Texas, visits often.', 'Nonrestrictive clauses (extra information that could be removed) should be set off by commas on both sides. "Who lives in Texas" adds extra information but isn''t essential to identifying the brother.', 45, 2, 'apply', 2, '["What needs commas on both sides?", "Is the clause essential or extra?"]'),

  -- Vocabulary Questions
  ('q_ela_context_001', 'language_arts', 'ela_6l_4a', 'topic_ela_context_clues', 'multiple_choice', 'Use context clues: "The teacher was so LOQUACIOUS that the lecture went an hour over time; she just wouldn''t stop talking." What does LOQUACIOUS mean?', '["Quiet", "Talkative", "Angry", "Tired"]', 'Talkative', 'The context clues "she just wouldn''t stop talking" and the lecture going over time suggest that loquacious means very talkative.', 40, 2, 'apply', 2, '["Look for clues about talking", "What caused the lecture to go long?"]'),

  ('q_ela_roots_001', 'language_arts', 'ela_6l_4b', 'topic_ela_roots_affixes', 'multiple_choice', 'The Latin root "scrib/script" means "to write." What does "manuscript" most likely mean?', '["A type of music", "Something written by hand", "A machine", "A type of insect"]', 'Something written by hand', 'Knowing that "script" means write and "manu" means hand, we can determine that manuscript means something written by hand.', 40, 2, 'apply', 2, '["What does script mean?", "What might manu mean?"]'),

  ('q_ela_connotation_001', 'language_arts', 'ela_6l_5c', 'topic_ela_connotation', 'multiple_choice', 'Which word has the most POSITIVE connotation?', '["Skinny", "Thin", "Slender", "Scrawny"]', 'Slender', 'While all these words describe someone not overweight, "slender" has the most positive connotation, suggesting grace and elegance. "Skinny" and "scrawny" often have negative connotations.', 45, 2, 'analyze', 3, '["Which word sounds most complimentary?", "Consider the emotional associations"]');

-- ============================================================================
-- PREREQUISITES FOR LANGUAGE ARTS TOPICS
-- ============================================================================

INSERT OR IGNORE INTO hyro_skill_prerequisites (id, skill_id, skill_type, prerequisite_id, prerequisite_type, strength) VALUES
  -- Reading prerequisites
  ('prereq_ela_001', 'topic_ela_citing_evidence', 'topic', 'topic_ela_evidence_intro', 'topic', 'required'),
  ('prereq_ela_002', 'topic_ela_inference', 'topic', 'topic_ela_evidence_intro', 'topic', 'required'),
  ('prereq_ela_003', 'topic_ela_theme_development', 'topic', 'topic_ela_theme_intro', 'topic', 'required'),
  ('prereq_ela_004', 'topic_ela_summary', 'topic', 'topic_ela_theme_intro', 'topic', 'recommended'),
  ('prereq_ela_005', 'topic_ela_character_development', 'topic', 'topic_ela_plot_elements', 'topic', 'required'),
  ('prereq_ela_006', 'topic_ela_tone', 'topic', 'topic_ela_connotation', 'topic', 'required'),
  ('prereq_ela_007', 'topic_ela_text_structure_lit', 'topic', 'topic_ela_plot_elements', 'topic', 'required'),

  -- Writing prerequisites
  ('prereq_ela_010', 'topic_ela_claims', 'topic', 'topic_ela_argument_intro', 'topic', 'required'),
  ('prereq_ela_011', 'topic_ela_evidence_writing', 'topic', 'topic_ela_claims', 'topic', 'required'),
  ('prereq_ela_012', 'topic_ela_transitions', 'topic', 'topic_ela_evidence_writing', 'topic', 'recommended'),
  ('prereq_ela_013', 'topic_ela_conclusions', 'topic', 'topic_ela_transitions', 'topic', 'recommended'),
  ('prereq_ela_014', 'topic_ela_avoiding_plagiarism', 'topic', 'topic_ela_research_skills', 'topic', 'required'),

  -- Grammar/Vocab prerequisites
  ('prereq_ela_020', 'topic_ela_pronoun_agreement', 'topic', 'topic_ela_pronoun_cases', 'topic', 'required'),
  ('prereq_ela_021', 'topic_ela_sentence_variety', 'topic', 'topic_ela_punctuation_advanced', 'topic', 'recommended'),
  ('prereq_ela_022', 'topic_ela_figures_of_speech', 'topic', 'topic_ela_context_clues', 'topic', 'recommended'),
  ('prereq_ela_023', 'topic_ela_academic_vocab', 'topic', 'topic_ela_word_relationships', 'topic', 'recommended');
