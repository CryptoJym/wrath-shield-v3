-- HYRO FORGE: Expanded Language Arts Question Bank
-- Migration 027: 80+ Additional ELA Questions for Robust Diagnostic Assessment
--
-- Focus: Reading comprehension, writing skills, grammar, vocabulary
-- Philosophy: Test understanding of language as a tool for thought and communication

INSERT INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES

-- =============================================================================
-- READING LITERATURE (RL)
-- =============================================================================

-- Theme and Central Idea
('q_ela_rl_101', 'language_arts', 'std_rl6_2', 'topic_ela_theme', 'multiple_choice', 'A story shows a character repeatedly failing but continuing to try until they succeed. What theme does this suggest?', '["Failure is permanent", "Success comes from luck", "Persistence leads to success", "Only talented people succeed"]', 'Persistence leads to success', 'The pattern of failing but continuing shows that the author values persistence. The character succeeds BECAUSE they didnt give up.', 40, 2, 'analyze', 3, '["What does the character DO?", "What does the outcome suggest?"]'),

('q_ela_rl_102', 'language_arts', 'std_rl6_2', 'topic_ela_theme', 'multiple_choice', 'Which best describes the difference between theme and topic?', '["Theme is longer than topic", "Topic is what happens; theme is the message about it", "They mean the same thing", "Theme is the main character"]', 'Topic is what happens; theme is the message about it', 'Topic is the subject (like friendship), while theme is what the author is SAYING about that subject (like true friendship requires sacrifice).', 45, 2, 'understand', 2, '["Topic = subject matter", "Theme = message or lesson"]'),

('q_ela_rl_103', 'language_arts', 'std_rl6_2', 'topic_ela_theme', 'multiple_choice', 'A story is about a rich person who loses everything but finds happiness. What theme might this suggest?', '["Money solves all problems", "True happiness doesnt come from wealth", "Poor people are happier", "Never trust banks"]', 'True happiness doesnt come from wealth', 'The character finds happiness AFTER losing wealth, suggesting the author believes happiness comes from something other than money.', 45, 2, 'analyze', 3, '["What changes in the character?", "What does the story seem to value?"]'),

-- Character Analysis
('q_ela_rl_104', 'language_arts', 'std_rl6_3', 'topic_ela_character', 'multiple_choice', 'What does it mean to analyze a character indirectly?', '["The author tells you directly what the character is like", "You infer character traits from actions, speech, and thoughts", "You only look at physical descriptions", "You skip character analysis entirely"]', 'You infer character traits from actions, speech, and thoughts', 'Indirect characterization means figuring out what a character is like based on evidence, not being told directly.', 35, 2, 'understand', 2, '["Direct = told, Indirect = shown", "What can actions reveal?"]'),

('q_ela_rl_105', 'language_arts', 'std_rl6_3', 'topic_ela_character', 'multiple_choice', 'A character always helps others but never asks for help themselves. This suggests they might be:', '["Lazy", "Proud or independent", "Untrustworthy", "Boring"]', 'Proud or independent', 'Not asking for help while giving it suggests the character values self-reliance or has too much pride to appear needy.', 45, 2, 'analyze', 3, '["What does this behavior pattern reveal?", "Why might someone never ask for help?"]'),

('q_ela_rl_106', 'language_arts', 'std_rl6_3', 'topic_ela_character', 'multiple_choice', 'What is a dynamic character?', '["A loud, energetic character", "A character who changes over the course of the story", "The main character", "A character who moves a lot"]', 'A character who changes over the course of the story', 'Dynamic characters grow, learn, or change. Static characters stay the same throughout.', 35, 2, 'understand', 2, '["Dynamic = changing", "Static = unchanging"]'),

-- Point of View
('q_ela_rl_107', 'language_arts', 'std_rl6_6', 'topic_ela_pov', 'multiple_choice', 'A story uses "I" and "me" throughout. What point of view is this?', '["First person", "Second person", "Third person limited", "Third person omniscient"]', 'First person', 'First person uses I/me/my. The narrator is a character in the story telling it from their perspective.', 25, 1, 'understand', 1, '["What pronoun signals first person?", "I = first person"]'),

('q_ela_rl_108', 'language_arts', 'std_rl6_6', 'topic_ela_pov', 'multiple_choice', 'How does first-person narration affect what the reader knows?', '["Reader knows everything about all characters", "Reader only knows what the narrator knows and experiences", "Reader knows nothing", "It has no effect"]', 'Reader only knows what the narrator knows and experiences', 'First person limits knowledge to one characters perspective. The reader cant know what other characters truly think.', 40, 2, 'analyze', 2, '["Whose head are you inside?", "Can you know what others think?"]'),

('q_ela_rl_109', 'language_arts', 'std_rl6_6', 'topic_ela_pov', 'multiple_choice', 'A story describes the thoughts of multiple characters. What point of view is this?', '["First person", "Second person", "Third person limited", "Third person omniscient"]', 'Third person omniscient', 'Omniscient means all-knowing. The narrator can see into any characters mind, not just one.', 40, 2, 'understand', 2, '["Omniscient = all-knowing", "Who knows everyones thoughts?"]'),

-- Literary Elements
('q_ela_rl_110', 'language_arts', 'std_rl6_4', 'topic_ela_figurative', 'multiple_choice', 'The wind whispered through the trees. This is an example of:', '["Simile", "Metaphor", "Personification", "Hyperbole"]', 'Personification', 'Personification gives human qualities to non-human things. Wind cant actually whisper.', 30, 2, 'apply', 2, '["Can wind really whisper?", "What human action is attributed?"]'),

('q_ela_rl_111', 'language_arts', 'std_rl6_4', 'topic_ela_figurative', 'multiple_choice', 'Her smile was a ray of sunshine. This is:', '["Simile", "Metaphor", "Personification", "Alliteration"]', 'Metaphor', 'Metaphor says something IS something else. Her smile IS sunshine (not like sunshine).', 35, 2, 'apply', 2, '["Like/as = simile", "IS = metaphor"]'),

('q_ela_rl_112', 'language_arts', 'std_rl6_4', 'topic_ela_figurative', 'multiple_choice', 'I waited forever for the bus. This is:', '["Simile", "Metaphor", "Personification", "Hyperbole"]', 'Hyperbole', 'Hyperbole is exaggeration for effect. You didnt literally wait forever.', 30, 2, 'apply', 2, '["Is this literally true?", "Exaggeration = hyperbole"]'),

-- =============================================================================
-- READING INFORMATIONAL TEXT (RI)
-- =============================================================================

('q_ela_ri_101', 'language_arts', 'std_ri6_1', 'topic_ela_informational', 'multiple_choice', 'When an author provides statistics and quotes from experts, they are:', '["Using emotional appeal", "Making personal attacks", "Supporting claims with evidence", "Wasting space"]', 'Supporting claims with evidence', 'Statistics and expert quotes are forms of evidence that support the authors claims. Good informational text backs up statements.', 35, 2, 'understand', 2, '["What do statistics prove?", "Why quote experts?"]'),

('q_ela_ri_102', 'language_arts', 'std_ri6_2', 'topic_ela_central_idea', 'multiple_choice', 'What is the difference between main idea and supporting details?', '["They are the same", "Main idea is the big point; details explain and prove it", "Details are more important", "Main idea comes last"]', 'Main idea is the big point; details explain and prove it', 'Main idea is the central message. Supporting details provide evidence, examples, and explanations that develop the main idea.', 35, 2, 'understand', 2, '["Whats the big picture?", "What proves the big picture?"]'),

('q_ela_ri_103', 'language_arts', 'std_ri6_2', 'topic_ela_central_idea', 'multiple_choice', 'To find the main idea, you should ask:', '["What is the first sentence?", "What is the author mostly talking about?", "What is the longest paragraph about?", "What is in bold?"]', 'What is the author mostly talking about?', 'Main idea is what the whole text is primarily about. Its not always in the first sentence or in bold.', 30, 2, 'analyze', 2, '["Consider the whole text", "What keeps coming up?"]'),

('q_ela_ri_104', 'language_arts', 'std_ri6_5', 'topic_ela_text_structure', 'multiple_choice', 'An article explains what causes climate change and what results from it. This structure is:', '["Compare/contrast", "Cause/effect", "Problem/solution", "Chronological"]', 'Cause/effect', 'This structure shows what leads to something (cause) and what happens because of it (effect).', 35, 2, 'analyze', 2, '["Causes = reasons why", "Effects = results"]'),

('q_ela_ri_105', 'language_arts', 'std_ri6_5', 'topic_ela_text_structure', 'multiple_choice', 'Signal words like "first," "then," "finally" suggest which structure?', '["Compare/contrast", "Cause/effect", "Problem/solution", "Chronological/sequence"]', 'Chronological/sequence', 'Time-order words signal that the text is organized by sequence or chronology.', 30, 2, 'apply', 2, '["These words show order", "Sequence = step by step"]'),

('q_ela_ri_106', 'language_arts', 'std_ri6_6', 'topic_ela_author_purpose', 'multiple_choice', 'An author writes about the dangers of junk food, using facts and urging readers to eat better. The purpose is to:', '["Entertain", "Inform only", "Persuade", "Describe"]', 'Persuade', 'When an author tries to change the readers behavior or opinion, the purpose is persuasion.', 35, 2, 'analyze', 2, '["Is the author trying to change you?", "Urging = persuading"]'),

('q_ela_ri_107', 'language_arts', 'std_ri6_8', 'topic_ela_argument_eval', 'multiple_choice', 'Which is an example of a claim?', '["The sky is blue", "Water is H2O", "Homework should be banned", "The sun rises in the east"]', 'Homework should be banned', 'A claim is a debatable statement that requires evidence. The other options are facts.', 35, 2, 'analyze', 2, '["Can this be argued?", "Claim = debatable opinion"]'),

('q_ela_ri_108', 'language_arts', 'std_ri6_8', 'topic_ela_argument_eval', 'multiple_choice', 'What makes evidence strong?', '["It sounds impressive", "It comes from reliable sources and directly supports the claim", "It is very long", "It agrees with what you already believe"]', 'It comes from reliable sources and directly supports the claim', 'Strong evidence is relevant (connected to the claim), from credible sources, and sufficient (enough to prove the point).', 45, 2, 'evaluate', 3, '["Does it actually prove the claim?", "Is the source trustworthy?"]'),

-- =============================================================================
-- WRITING (W)
-- =============================================================================

('q_ela_w_101', 'language_arts', 'std_w6_1', 'topic_ela_argument_claims', 'multiple_choice', 'In an argumentative essay, where does the thesis usually go?', '["In the conclusion", "At the end of the introduction", "In the body paragraphs", "In the title"]', 'At the end of the introduction', 'The thesis is typically the last sentence of the introduction, setting up what the essay will argue.', 30, 2, 'understand', 2, '["Thesis = main argument", "Introduction prepares for it"]'),

('q_ela_w_102', 'language_arts', 'std_w6_1', 'topic_ela_argument_claims', 'multiple_choice', 'What is a counterclaim?', '["A claim made by the author", "An opposing viewpoint that the author addresses", "A summary of the essay", "A type of evidence"]', 'An opposing viewpoint that the author addresses', 'A counterclaim is an argument against your position. Strong arguments acknowledge and respond to counterclaims.', 40, 2, 'understand', 2, '["What might someone disagree with?", "Counter = opposite"]'),

('q_ela_w_103', 'language_arts', 'std_w6_1', 'topic_ela_argument_claims', 'multiple_choice', 'Why should an argumentative essay include a counterclaim?', '["To confuse the reader", "To show you understand other views and can still prove yours is stronger", "To make the essay longer", "It shouldnt include one"]', 'To show you understand other views and can still prove yours is stronger', 'Addressing counterclaims shows intellectual honesty and strengthens your argument by demonstrating you can handle objections.', 45, 2, 'analyze', 3, '["Does ignoring objections make you more convincing?", "What shows thorough thinking?"]'),

('q_ela_w_104', 'language_arts', 'std_w6_2', 'topic_ela_informative', 'multiple_choice', 'An informative essay should be:', '["Heavily opinionated", "Objective and fact-based", "Fictional", "Persuasive"]', 'Objective and fact-based', 'Informative writing explains and informs. It should present facts objectively, not persuade.', 30, 2, 'understand', 2, '["Inform = give information", "Not trying to convince"]'),

('q_ela_w_105', 'language_arts', 'std_w6_2', 'topic_ela_informative', 'multiple_choice', 'What should body paragraphs in an informative essay include?', '["Only personal opinions", "A topic sentence, evidence, and explanation", "Just a list of facts", "Only questions"]', 'A topic sentence, evidence, and explanation', 'Body paragraphs need structure: topic sentence (main point), evidence (facts/details), and explanation (why it matters).', 40, 2, 'understand', 2, '["What makes a complete paragraph?", "Topic, evidence, explain"]'),

('q_ela_w_106', 'language_arts', 'std_w6_3', 'topic_ela_narrative', 'multiple_choice', 'Which narrative technique helps readers feel like theyre in the scene?', '["Telling what happened", "Using sensory details and description", "Summarizing quickly", "Using mostly dialogue"]', 'Using sensory details and description', 'Sensory details (what characters see, hear, feel, smell, taste) create vivid imagery that immerses readers.', 40, 2, 'understand', 2, '["What makes writing vivid?", "Appeal to the senses"]'),

('q_ela_w_107', 'language_arts', 'std_w6_3', 'topic_ela_narrative', 'multiple_choice', 'Show, dont tell means:', '["Write more words", "Use actions and details rather than just stating emotions", "Tell a longer story", "Add more characters"]', 'Use actions and details rather than just stating emotions', 'Instead of "He was scared," show it: "His hands trembled as sweat dripped down his forehead."', 45, 2, 'apply', 3, '["Which is more vivid?", "Actions reveal emotions"]'),

('q_ela_w_108', 'language_arts', 'std_w6_5', 'topic_ela_writing_process', 'multiple_choice', 'During revision, you should focus on:', '["Fixing spelling only", "Improving ideas, organization, and clarity", "Adding more pages", "Changing the font"]', 'Improving ideas, organization, and clarity', 'Revision is about big-picture improvements. Editing (grammar, spelling) comes after revision.', 35, 2, 'understand', 2, '["Revision = re-vision = see again", "Big picture first"]'),

('q_ela_w_109', 'language_arts', 'std_w6_5', 'topic_ela_writing_process', 'multiple_choice', 'What is the purpose of peer review?', '["To copy others work", "To get feedback from another perspective", "To compete with classmates", "To avoid doing your own editing"]', 'To get feedback from another perspective', 'Other readers can spot issues you miss because youre too close to your own writing.', 35, 2, 'understand', 2, '["Why ask someone else?", "Fresh eyes see differently"]'),

-- =============================================================================
-- LANGUAGE (L) - GRAMMAR AND VOCABULARY
-- =============================================================================

('q_ela_l_101', 'language_arts', 'std_l6_1', 'topic_ela_grammar_pronouns', 'multiple_choice', 'Choose the correct pronoun: "Me and him / He and I went to the store."', '["Me and him", "He and I", "Him and me", "I and he"]', 'He and I', 'Subjective pronouns (I, he, she, we, they) are used as subjects. Test by removing one: "I went" is correct, not "me went."', 35, 2, 'apply', 2, '["Remove the other person", "Would you say me went?"]'),

('q_ela_l_102', 'language_arts', 'std_l6_1', 'topic_ela_grammar_pronouns', 'multiple_choice', 'Choose the correct pronoun: "The teacher gave the award to (she/her)."', '["she", "her", "hers", "herself"]', 'her', 'After a preposition (to), use objective pronouns (me, him, her, us, them).', 35, 2, 'apply', 2, '["To is a preposition", "Prepositions take objective pronouns"]'),

('q_ela_l_103', 'language_arts', 'std_l6_1', 'topic_ela_grammar_verbs', 'multiple_choice', 'Which sentence uses the correct verb tense? "Yesterday, I (walk/walked/will walk) to school."', '["walk", "walked", "will walk", "walking"]', 'walked', 'Yesterday signals past tense. Walked is the past tense of walk.', 25, 1, 'apply', 1, '["Yesterday = past", "Past tense of walk = walked"]'),

('q_ela_l_104', 'language_arts', 'std_l6_1', 'topic_ela_grammar_verbs', 'multiple_choice', 'Identify the error: "The team have won the championship."', '["team should be teams", "have should be has", "won should be win", "No error"]', 'have should be has', 'Team is a collective noun (singular). Singular subjects take singular verbs: has, not have.', 40, 2, 'apply', 2, '["Is team singular or plural?", "One team = singular"]'),

('q_ela_l_105', 'language_arts', 'std_l6_2', 'topic_ela_punctuation', 'multiple_choice', 'Where should the comma go? "After I finished my homework I played video games."', '["After After", "After homework", "After I", "No comma needed"]', 'After homework', 'A comma follows an introductory clause. "After I finished my homework" is the introductory clause.', 35, 2, 'apply', 2, '["Find where the intro ends", "Comma after intro clause"]'),

('q_ela_l_106', 'language_arts', 'std_l6_2', 'topic_ela_punctuation', 'multiple_choice', 'Which sentence uses commas correctly with a list?', '["I need eggs milk and bread.", "I need eggs, milk, and bread.", "I need, eggs, milk, and bread.", "I need eggs, milk and, bread."]', 'I need eggs, milk, and bread.', 'Commas separate items in a list. The Oxford comma before "and" is optional but recommended.', 30, 2, 'apply', 2, '["Separate list items with commas", "Comma before each item except first"]'),

('q_ela_l_107', 'language_arts', 'std_l6_2', 'topic_ela_punctuation', 'multiple_choice', 'When should you use a semicolon?', '["Before any list", "To join two related complete sentences", "After every sentence", "Instead of a period always"]', 'To join two related complete sentences', 'Semicolons connect independent clauses that are closely related in meaning, without using a conjunction.', 45, 2, 'understand', 2, '["Can both parts stand alone?", "Are they closely related?"]'),

('q_ela_l_108', 'language_arts', 'std_l6_4', 'topic_ela_vocab_context', 'multiple_choice', 'In the sentence "The arid desert had no water," what does arid mean?', '["Wet", "Cold", "Dry", "Large"]', 'Dry', 'Context clue: "no water" tells you arid relates to dryness. Deserts with no water are dry.', 30, 2, 'apply', 2, '["What does no water suggest?", "Use context clues"]'),

('q_ela_l_109', 'language_arts', 'std_l6_4', 'topic_ela_vocab_context', 'multiple_choice', 'What type of context clue is used in: "The house was dilapidated, with broken windows and a sagging roof"?', '["Definition", "Example/Description", "Contrast", "Synonym"]', 'Example/Description', 'The sentence describes WHAT makes it dilapidated (broken windows, sagging roof), providing descriptive examples.', 40, 2, 'analyze', 2, '["How do we know what dilapidated means?", "The examples show us"]'),

('q_ela_l_110', 'language_arts', 'std_l6_4', 'topic_ela_vocab_roots', 'multiple_choice', 'The root "aud" means "to hear." What does "audible" mean?', '["Visible", "Able to be heard", "Loud", "Musical"]', 'Able to be heard', 'Aud = hear + ible = able to. Audible = able to be heard.', 30, 2, 'apply', 2, '["aud = hear", "-ible = able to"]'),

('q_ela_l_111', 'language_arts', 'std_l6_4', 'topic_ela_vocab_roots', 'multiple_choice', 'The prefix "mis-" means "wrong." What does "misconduct" mean?', '["Perfect conduct", "Wrong or bad conduct", "No conduct", "Conduct again"]', 'Wrong or bad conduct', 'Mis- (wrong) + conduct = wrong conduct, inappropriate behavior.', 30, 2, 'apply', 2, '["mis- = wrong or bad", "Add to conduct"]'),

('q_ela_l_112', 'language_arts', 'std_l6_5', 'topic_ela_word_relationships', 'multiple_choice', 'What is the relationship between "happy" and "joyful"?', '["Antonyms", "Synonyms", "Homonyms", "Unrelated"]', 'Synonyms', 'Synonyms are words with similar meanings. Happy and joyful both describe positive emotions.', 25, 1, 'understand', 1, '["Similar or opposite?", "Both mean positive feeling"]'),

('q_ela_l_113', 'language_arts', 'std_l6_5', 'topic_ela_word_relationships', 'multiple_choice', 'What is the relationship between "enormous" and "tiny"?', '["Synonyms", "Antonyms", "Homonyms", "Neither"]', 'Antonyms', 'Antonyms are words with opposite meanings. Enormous (very big) is opposite of tiny (very small).', 25, 1, 'understand', 1, '["Similar or opposite?", "Big vs small"]'),

('q_ela_l_114', 'language_arts', 'std_l6_5', 'topic_ela_word_relationships', 'multiple_choice', 'Which word has a MORE negative connotation: "thrifty" or "cheap"?', '["Thrifty", "Cheap", "Same connotation", "Neither is negative"]', 'Cheap', 'Both mean not spending much, but "cheap" suggests stingy or low quality. "Thrifty" is more positive (wise with money).', 40, 2, 'analyze', 2, '["Same meaning, different feeling", "Which sounds worse?"]'),

-- =============================================================================
-- SPEAKING AND LISTENING (SL)
-- =============================================================================

('q_ela_sl_101', 'language_arts', 'std_sl6_1', 'topic_ela_discussion', 'multiple_choice', 'In a group discussion, what should you do when you disagree with someone?', '["Interrupt and tell them theyre wrong", "Respectfully explain your different view with reasons", "Stay silent and fume", "Leave the discussion"]', 'Respectfully explain your different view with reasons', 'Productive disagreement involves listening, acknowledging the other view, and explaining your reasoning calmly.', 35, 2, 'apply', 2, '["How do you disagree productively?", "Respect + reasons"]'),

('q_ela_sl_102', 'language_arts', 'std_sl6_1', 'topic_ela_discussion', 'multiple_choice', 'Active listening includes:', '["Planning what youll say next", "Checking your phone", "Making eye contact and asking clarifying questions", "Interrupting with your ideas"]', 'Making eye contact and asking clarifying questions', 'Active listening means focusing on understanding the speaker, not just waiting for your turn to talk.', 35, 2, 'understand', 2, '["Listening vs waiting to talk", "How do you show youre listening?"]'),

('q_ela_sl_103', 'language_arts', 'std_sl6_3', 'topic_ela_evaluate_speaker', 'multiple_choice', 'A speaker claims "Everyone agrees that..." but provides no evidence. This is:', '["Strong reasoning", "A logical fallacy (appeal to popularity)", "Effective persuasion", "Good evidence"]', 'A logical fallacy (appeal to popularity)', 'Just because "everyone" supposedly agrees doesnt make something true. This is a bandwagon fallacy.', 45, 3, 'evaluate', 3, '["Is this actual evidence?", "Does popularity prove truth?"]'),

-- =============================================================================
-- ADVANCED / EXTENSION QUESTIONS
-- =============================================================================

('q_ela_adv_101', 'language_arts', 'std_rl6_6', 'topic_ela_pov', 'multiple_choice', 'An unreliable narrator is one who:', '["Tells the story in third person", "May not tell the truth or see things accurately", "Is the main character", "Uses present tense"]', 'May not tell the truth or see things accurately', 'Unreliable narrators have biases, lie, or misunderstand events. Readers must question their account.', 50, 3, 'analyze', 3, '["Why might a narrator be unreliable?", "Can narrators be biased?"]'),

('q_ela_adv_102', 'language_arts', 'std_rl6_4', 'topic_ela_figurative', 'multiple_choice', 'In a story about war, a dove appears at the end. The dove likely symbolizes:', '["Death", "Peace", "Confusion", "Wealth"]', 'Peace', 'Doves are common symbols of peace, especially meaningful in a war context as the conflict ends.', 40, 2, 'analyze', 3, '["What do doves traditionally represent?", "Context matters"]'),

('q_ela_adv_103', 'language_arts', 'std_w6_1', 'topic_ela_argument_claims', 'multiple_choice', 'Which is the strongest thesis statement?', '["Pollution is bad.", "In this essay, I will discuss pollution.", "Cities should ban single-use plastics because they harm marine life, fill landfills, and cheaper alternatives exist.", "Some people think pollution is bad but others disagree."]', 'Cities should ban single-use plastics because they harm marine life, fill landfills, and cheaper alternatives exist.', 'Strong theses are specific, debatable, and preview the arguments. This one does all three.', 50, 3, 'evaluate', 3, '["Which is specific and arguable?", "Does it preview reasons?"]'),

('q_ela_adv_104', 'language_arts', 'std_ri6_6', 'topic_ela_author_purpose', 'multiple_choice', 'An author uses emotional language like "horrific tragedy" and "innocent victims." This reveals:', '["Objective reporting", "The authors emotional investment in the topic", "Scientific precision", "No bias"]', 'The authors emotional investment in the topic', 'Word choice reveals attitude. Emotional language shows the author has feelings about the topic and wants readers to share them.', 45, 3, 'analyze', 3, '["Why use emotional words?", "What do word choices reveal?"]'),

('q_ela_adv_105', 'language_arts', 'std_l6_5', 'topic_ela_word_relationships', 'multiple_choice', 'The words "walked," "strolled," "marched," and "trudged" all mean to move on foot but differ in:', '["Definition", "Connotation and manner", "Spelling only", "Nothing"]', 'Connotation and manner', 'Each describes a different WAY of walking: strolled (leisurely), marched (military precision), trudged (wearily). Same basic meaning, different nuance.', 50, 3, 'analyze', 3, '["All mean walking but...", "How does each one feel different?"]'),

('q_ela_adv_106', 'language_arts', 'std_rl6_9', 'topic_ela_compare_texts', 'multiple_choice', 'Two texts cover the same event. Text A uses personal stories, Text B uses statistics. They differ in:', '["Accuracy", "Approach/appeals used", "Topic", "Length"]', 'Approach/appeals used', 'Text A uses emotional/personal appeal (pathos), Text B uses logical/factual appeal (logos). Both can be accurate.', 45, 3, 'analyze', 3, '["Personal stories vs. statistics", "Different ways to convince"]'),

('q_ela_adv_107', 'language_arts', 'std_w6_4', 'topic_ela_writing_clarity', 'multiple_choice', 'What makes writing concise?', '["Using as many words as possible", "Saying things in the fewest words needed", "Using only short sentences", "Avoiding all adjectives"]', 'Saying things in the fewest words needed', 'Concise writing eliminates unnecessary words while keeping all necessary meaning. Its efficient, not just short.', 40, 2, 'understand', 2, '["Concise ≠ short", "No wasted words"]'),

('q_ela_adv_108', 'language_arts', 'std_l6_3', 'topic_ela_language_variety', 'multiple_choice', 'When might you use informal language?', '["In a research paper", "In a text to a friend", "In a job application", "In an essay exam"]', 'In a text to a friend', 'Informal language is appropriate for casual communication. Formal language is for academic and professional contexts.', 30, 2, 'apply', 2, '["Match language to context", "Friends vs. formal settings"]'),

('q_ela_adv_109', 'language_arts', 'std_rl6_1', 'topic_ela_inference', 'multiple_choice', 'An inference is:', '["A fact stated in the text", "A guess with no evidence", "A conclusion based on evidence plus reasoning", "The authors opinion"]', 'A conclusion based on evidence plus reasoning', 'Inference combines what the text says (evidence) with what you know (reasoning) to conclude something not stated directly.', 35, 2, 'understand', 2, '["Not stated directly", "Evidence + reasoning = inference"]'),

('q_ela_adv_110', 'language_arts', 'std_rl6_1', 'topic_ela_inference', 'multiple_choice', 'A character slams doors and speaks in short, clipped sentences. You can infer the character is:', '["Happy", "Tired", "Angry or frustrated", "Confused"]', 'Angry or frustrated', 'Slamming doors and short speech are behaviors associated with anger. The text doesnt say "angry," but evidence suggests it.', 35, 2, 'apply', 3, '["What do these actions suggest?", "Connect behaviors to emotions"]');
