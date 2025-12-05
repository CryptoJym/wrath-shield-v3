-- HYRO FORGE: LLM Technical Foundations & Meta-Learning
-- Migration 024: Understanding how AI actually works + Learning to Learn
--
-- PHILOSOPHY: "Know thy tool" - To leverage AI maximally, understand its nature.
-- This isn't about becoming a ML engineer - it's about building accurate mental
-- models of what's happening under the hood so you can work WITH the system.
--
-- META-LEARNING: "Level up your learning" - These are the real secrets to
-- accelerated growth. What schools should teach but don't.

-- ============================================================================
-- STRAND 5: LLM TECHNICAL FOUNDATIONS
-- Understanding how AI systems actually work
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  -- Core Concepts
  ('llm_tf_1', 'llm_communications', 'hyro_advanced', 'LLM.TF.1', 'What LLMs Actually Are', 'Understand that LLMs are statistical pattern matchers trained on text, not thinking beings. They predict probable next tokens based on patterns learned from training data.', NULL, 'middle', 'Technical Foundations', 'Core Concepts', 40, 1, 1),
  ('llm_tf_2', 'llm_communications', 'hyro_advanced', 'LLM.TF.2', 'Token Prediction', 'Understand that LLMs work by predicting the most likely next token (word piece) given all previous tokens. This is the fundamental operation.', NULL, 'middle', 'Technical Foundations', 'Core Concepts', 41, 1, 1),
  ('llm_tf_3', 'llm_communications', 'hyro_advanced', 'LLM.TF.3', 'Training vs Inference', 'Distinguish between training (when AI learns patterns) and inference (when AI uses those patterns). Understand that chatting with AI is inference, not learning.', NULL, 'middle', 'Technical Foundations', 'Core Concepts', 42, 1, 1),
  ('llm_tf_4', 'llm_communications', 'hyro_advanced', 'LLM.TF.4', 'Context Windows', 'Understand that LLMs have limited memory (context window) and how this affects conversations. Know that earlier parts of long conversations can be "forgotten".', NULL, 'middle', 'Technical Foundations', 'Core Concepts', 43, 1, 1),

  -- Mathematical Foundations (Conceptual)
  ('llm_tf_5', 'llm_communications', 'hyro_advanced', 'LLM.TF.5', 'Probability and Prediction', 'Understand how probability distributions determine which token comes next. Higher probability = more likely to be chosen. This is why responses can vary.', NULL, 'middle', 'Technical Foundations', 'Math Foundations', 44, 1, 1),
  ('llm_tf_6', 'llm_communications', 'hyro_advanced', 'LLM.TF.6', 'Temperature and Randomness', 'Understand how temperature settings affect creativity vs consistency. Low temp = more predictable, High temp = more creative but riskier.', NULL, 'middle', 'Technical Foundations', 'Math Foundations', 45, 1, 1),
  ('llm_tf_7', 'llm_communications', 'hyro_advanced', 'LLM.TF.7', 'Embeddings and Meaning', 'Understand that words are converted to numbers (vectors) that capture meaning. Similar meanings = closer numbers. This is how AI understands relationships.', NULL, 'middle', 'Technical Foundations', 'Math Foundations', 46, 1, 1),
  ('llm_tf_8', 'llm_communications', 'hyro_advanced', 'LLM.TF.8', 'Attention Mechanisms', 'Understand how AI focuses on relevant parts of the input. Like how you focus on key words when reading - AI does something similar mathematically.', NULL, 'middle', 'Technical Foundations', 'Math Foundations', 47, 1, 1),

  -- Practical Implications
  ('llm_tf_9', 'llm_communications', 'hyro_advanced', 'LLM.TF.9', 'Why AI Hallucinates', 'Understand why AI makes things up: it generates probable sequences, not factual ones. Pattern matching isnt truth-checking. Always verify important information.', NULL, 'middle', 'Technical Foundations', 'Practical Implications', 48, 1, 1),
  ('llm_tf_10', 'llm_communications', 'hyro_advanced', 'LLM.TF.10', 'Training Data Effects', 'Understand that AI knowledge comes from its training data. It cant know things that happened after training, and reflects patterns (including biases) from that data.', NULL, 'middle', 'Technical Foundations', 'Practical Implications', 49, 1, 1),
  ('llm_tf_11', 'llm_communications', 'hyro_advanced', 'LLM.TF.11', 'Prompt Position Effects', 'Understand that where information appears in a prompt matters. AI pays more attention to beginnings and ends. Important info should be placed strategically.', NULL, 'middle', 'Technical Foundations', 'Practical Implications', 50, 1, 1),
  ('llm_tf_12', 'llm_communications', 'hyro_advanced', 'LLM.TF.12', 'Model Size and Capability', 'Understand the relationship between model size (parameters) and capability. Bigger models can handle more complex tasks but have tradeoffs (speed, cost).', NULL, 'middle', 'Technical Foundations', 'Practical Implications', 51, 1, 1);

-- ============================================================================
-- STRAND 6: META-LEARNING
-- Learning how to learn - the ultimate skill multiplier
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  -- Learning Science
  ('llm_ml_1', 'llm_communications', 'hyro_advanced', 'LLM.ML.1', 'How Memory Works', 'Understand the difference between working memory and long-term memory. Know why spaced repetition beats cramming and how sleep consolidates learning.', NULL, 'middle', 'Meta-Learning', 'Learning Science', 60, 1, 1),
  ('llm_ml_2', 'llm_communications', 'hyro_advanced', 'LLM.ML.2', 'Active vs Passive Learning', 'Understand why active recall (testing yourself) beats passive review (re-reading). Generate answers, dont just recognize them.', NULL, 'middle', 'Meta-Learning', 'Learning Science', 61, 1, 1),
  ('llm_ml_3', 'llm_communications', 'hyro_advanced', 'LLM.ML.3', 'Interleaving and Spacing', 'Understand why mixing different topics and spreading practice over time leads to deeper learning than blocked, massed practice.', NULL, 'middle', 'Meta-Learning', 'Learning Science', 62, 1, 1),
  ('llm_ml_4', 'llm_communications', 'hyro_advanced', 'LLM.ML.4', 'Desirable Difficulties', 'Understand that struggle is part of learning. Things that feel harder often lead to better retention. Easy learning = easy forgetting.', NULL, 'middle', 'Meta-Learning', 'Learning Science', 63, 1, 1),

  -- Skill Building
  ('llm_ml_5', 'llm_communications', 'hyro_advanced', 'LLM.ML.5', 'Deliberate Practice', 'Understand what separates experts from amateurs: targeted practice on weaknesses, immediate feedback, stretching beyond comfort zone.', NULL, 'middle', 'Meta-Learning', 'Skill Building', 64, 1, 1),
  ('llm_ml_6', 'llm_communications', 'hyro_advanced', 'LLM.ML.6', 'The Power of Chunking', 'Understand how experts see patterns that beginners miss. Building chunks of knowledge lets you work with bigger concepts efficiently.', NULL, 'middle', 'Meta-Learning', 'Skill Building', 65, 1, 1),
  ('llm_ml_7', 'llm_communications', 'hyro_advanced', 'LLM.ML.7', 'Transfer of Learning', 'Understand how to apply knowledge across domains. The key is finding deep structure, not surface similarity.', NULL, 'middle', 'Meta-Learning', 'Skill Building', 66, 1, 1),
  ('llm_ml_8', 'llm_communications', 'hyro_advanced', 'LLM.ML.8', 'The 80/20 Principle', 'Understand that 20% of efforts often produce 80% of results. Identify the highest-leverage skills and focus there first.', NULL, 'middle', 'Meta-Learning', 'Skill Building', 67, 1, 1),

  -- Mindset and Psychology
  ('llm_ml_9', 'llm_communications', 'hyro_advanced', 'LLM.ML.9', 'Growth Mindset Applied', 'Understand that ability is built, not fixed. Intelligence grows through effort. Challenges are opportunities. Feedback is information, not judgment.', NULL, 'middle', 'Meta-Learning', 'Mindset', 68, 1, 1),
  ('llm_ml_10', 'llm_communications', 'hyro_advanced', 'LLM.ML.10', 'Managing Cognitive Load', 'Understand that your brain has limited processing capacity. Break complex problems into pieces. Use external tools to extend your mind.', NULL, 'middle', 'Meta-Learning', 'Mindset', 69, 1, 1),
  ('llm_ml_11', 'llm_communications', 'hyro_advanced', 'LLM.ML.11', 'Flow State Engineering', 'Understand what creates optimal learning states: clear goals, immediate feedback, challenge matching skill. Learn to create these conditions.', NULL, 'middle', 'Meta-Learning', 'Mindset', 70, 1, 1),
  ('llm_ml_12', 'llm_communications', 'hyro_advanced', 'LLM.ML.12', 'Productive Failure', 'Understand that failing while trying is better than succeeding without trying. Failure reveals what you dont know - essential information.', NULL, 'middle', 'Meta-Learning', 'Mindset', 71, 1, 1),

  -- AI-Augmented Learning
  ('llm_ml_13', 'llm_communications', 'hyro_advanced', 'LLM.ML.13', 'AI as Learning Partner', 'Understand how to use AI to accelerate learning: instant feedback, explanation on demand, personalized examples, Socratic dialogue.', NULL, 'middle', 'Meta-Learning', 'AI-Augmented', 72, 1, 1),
  ('llm_ml_14', 'llm_communications', 'hyro_advanced', 'LLM.ML.14', 'The Feynman Technique with AI', 'Understand how to use AI to test your understanding: explain concepts to AI, have it find gaps and ask clarifying questions.', NULL, 'middle', 'Meta-Learning', 'AI-Augmented', 73, 1, 1),
  ('llm_ml_15', 'llm_communications', 'hyro_advanced', 'LLM.ML.15', 'Building Personal Knowledge Bases', 'Understand how to use AI to organize, connect, and retrieve knowledge. Create systems that grow smarter over time.', NULL, 'middle', 'Meta-Learning', 'AI-Augmented', 74, 1, 1),
  ('llm_ml_16', 'llm_communications', 'hyro_advanced', 'LLM.ML.16', 'Rapid Skill Acquisition', 'Understand frameworks for learning new skills fast: deconstruct, select key components, remove barriers, practice the 20% that matters.', NULL, 'middle', 'Meta-Learning', 'AI-Augmented', 75, 1, 1);

-- ============================================================================
-- CURRICULUM TOPICS - TECHNICAL FOUNDATIONS
-- ============================================================================

INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- Core LLM Concepts
  ('topic_llm_what_is_llm', 'llm_communications', 'llm_tf_1', 'What is an LLM?', 'Understanding Large Language Models as pattern matchers', '["Explain that LLMs predict text based on patterns", "Distinguish LLMs from traditional programs", "Understand that LLMs dont truly understand like humans"]', 1, 25),
  ('topic_llm_tokens', 'llm_communications', 'llm_tf_2', 'Tokens and Tokenization', 'How text is broken into pieces for AI processing', '["Understand words are broken into tokens", "Know that tokens affect cost and limits", "See how tokenization affects different languages"]', 2, 30),
  ('topic_llm_next_token', 'llm_communications', 'llm_tf_2', 'Next Token Prediction', 'The core operation of language models', '["Explain how AI picks the next word", "Understand probability in word selection", "Know why AI output can vary each time"]', 2, 35),
  ('topic_llm_training', 'llm_communications', 'llm_tf_3', 'How AI Gets Trained', 'Understanding the training process conceptually', '["Distinguish training from chatting", "Know AI learns from massive text datasets", "Understand knowledge cutoff dates"]', 2, 30),
  ('topic_llm_context', 'llm_communications', 'llm_tf_4', 'Context Windows Explained', 'Understanding AI memory limits', '["Know that AI has limited conversation memory", "Understand why long chats can lose context", "Learn strategies for managing context"]', 2, 25),

  -- Math Foundations
  ('topic_llm_probability', 'llm_communications', 'llm_tf_5', 'Probability in AI', 'How likelihood determines AI output', '["Understand probability as chance", "See how high probability tokens get selected", "Know this is why AI can be wrong confidently"]', 2, 35),
  ('topic_llm_temperature', 'llm_communications', 'llm_tf_6', 'Temperature Settings', 'Controlling creativity vs consistency', '["Know what temperature does to output", "Choose right temperature for different tasks", "Understand tradeoff between creative and accurate"]', 2, 25),
  ('topic_llm_embeddings', 'llm_communications', 'llm_tf_7', 'Word Embeddings', 'How AI represents meaning with numbers', '["Understand words become number lists", "Know similar words have similar numbers", "See how this captures relationships"]', 3, 40),
  ('topic_llm_attention', 'llm_communications', 'llm_tf_8', 'Attention Mechanisms', 'How AI focuses on whats relevant', '["Understand AI weighs input importance", "See why word order matters", "Know this enables understanding context"]', 3, 45),

  -- Practical Understanding
  ('topic_llm_hallucination', 'llm_communications', 'llm_tf_9', 'Why AI Makes Things Up', 'Understanding and detecting hallucinations', '["Know AI generates probable not true text", "Learn to verify important claims", "Recognize signs of hallucination"]', 2, 30),
  ('topic_llm_data_bias', 'llm_communications', 'llm_tf_10', 'Training Data and Bias', 'How training affects AI behavior', '["Know AI reflects its training data", "Understand bias can be embedded", "Learn to question AI outputs critically"]', 3, 35),
  ('topic_llm_prompt_position', 'llm_communications', 'llm_tf_11', 'Prompt Position Matters', 'Strategic placement of information', '["Know beginnings and ends get attention", "Learn to structure prompts strategically", "Understand the lost in the middle effect"]', 3, 30),
  ('topic_llm_model_comparison', 'llm_communications', 'llm_tf_12', 'Comparing AI Models', 'Understanding model differences', '["Know bigger isnt always better", "Understand speed vs capability tradeoffs", "Choose right model for different tasks"]', 3, 35);

-- ============================================================================
-- CURRICULUM TOPICS - META-LEARNING
-- ============================================================================

INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- Learning Science
  ('topic_ml_memory', 'llm_communications', 'llm_ml_1', 'Memory Systems', 'Understanding how your brain stores information', '["Know working memory is limited", "Understand long-term memory needs consolidation", "Learn why sleep matters for learning"]', 2, 30),
  ('topic_ml_recall', 'llm_communications', 'llm_ml_2', 'Active Recall', 'Testing yourself to learn better', '["Know testing beats re-reading", "Understand retrieval practice strengthens memory", "Apply self-testing strategies"]', 2, 25),
  ('topic_ml_spacing', 'llm_communications', 'llm_ml_3', 'Spaced Repetition', 'Timing your practice for maximum retention', '["Know why cramming fails long-term", "Understand optimal spacing of reviews", "Use spaced repetition effectively"]', 2, 30),
  ('topic_ml_difficulty', 'llm_communications', 'llm_ml_4', 'Embracing Difficulty', 'Why struggle leads to learning', '["Know that easy learning fades fast", "Embrace productive struggle", "Distinguish good difficulty from bad"]', 2, 25),

  -- Skill Building
  ('topic_ml_deliberate', 'llm_communications', 'llm_ml_5', 'Deliberate Practice', 'How experts actually practice', '["Know practice quality beats quantity", "Focus on weaknesses specifically", "Get and use immediate feedback"]', 2, 35),
  ('topic_ml_chunking', 'llm_communications', 'llm_ml_6', 'Chunking Knowledge', 'Building expert-level pattern recognition', '["Understand how experts see differently", "Build knowledge chunks through practice", "Connect new info to existing chunks"]', 3, 35),
  ('topic_ml_transfer', 'llm_communications', 'llm_ml_7', 'Transfer Learning', 'Applying knowledge across domains', '["Find deep structure in problems", "See connections between fields", "Build flexible mental models"]', 3, 40),
  ('topic_ml_pareto', 'llm_communications', 'llm_ml_8', 'The 80/20 of Learning', 'Finding high-leverage knowledge', '["Identify the vital few concepts", "Focus efforts where they matter most", "Avoid diminishing returns"]', 2, 25),

  -- Mindset
  ('topic_ml_growth', 'llm_communications', 'llm_ml_9', 'Growth Mindset in Practice', 'Building beliefs that support learning', '["Know ability grows through effort", "See challenges as growth opportunities", "Use failure as feedback"]', 2, 30),
  ('topic_ml_cognitive_load', 'llm_communications', 'llm_ml_10', 'Managing Mental Energy', 'Working within brain limits', '["Know your brain has processing limits", "Break complex problems down", "Use external tools strategically"]', 2, 30),
  ('topic_ml_flow', 'llm_communications', 'llm_ml_11', 'Creating Flow States', 'Engineering optimal learning conditions', '["Know what creates flow", "Match challenge to skill level", "Remove distractions strategically"]', 3, 35),
  ('topic_ml_failure', 'llm_communications', 'llm_ml_12', 'Learning from Failure', 'Making mistakes work for you', '["Know failure reveals knowledge gaps", "Analyze mistakes productively", "Build resilience through failure"]', 2, 25),

  -- AI-Augmented Learning
  ('topic_ml_ai_partner', 'llm_communications', 'llm_ml_13', 'AI as Study Partner', 'Leveraging AI for accelerated learning', '["Use AI for instant feedback", "Get personalized explanations", "Practice with AI Socratic dialogue"]', 2, 35),
  ('topic_ml_feynman', 'llm_communications', 'llm_ml_14', 'The Feynman Technique', 'Explain to learn deeper', '["Teach concepts to test understanding", "Use AI to find gaps in explanations", "Iterate until truly understood"]', 2, 30),
  ('topic_ml_knowledge_system', 'llm_communications', 'llm_ml_15', 'Building Knowledge Systems', 'Organizing learning for retrieval', '["Create systems to capture learning", "Connect knowledge across domains", "Build searchable personal knowledge"]', 3, 40),
  ('topic_ml_rapid', 'llm_communications', 'llm_ml_16', 'Rapid Skill Acquisition', 'Learning new skills fast', '["Deconstruct skills into components", "Identify the critical 20%", "Remove barriers to practice"]', 3, 35);

-- ============================================================================
-- QUESTION BANK - TECHNICAL FOUNDATIONS
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  -- Core Concepts
  ('q_llm_tf_001', 'llm_communications', 'llm_tf_1', 'topic_llm_what_is_llm', 'multiple_choice', 'What is an LLM fundamentally doing when it responds to you?', '["Thinking about your question like a human", "Looking up answers in a database", "Predicting probable next words based on patterns it learned", "Running logical rules like a calculator"]', 'Predicting probable next words based on patterns it learned', 'LLMs are statistical pattern matchers. They dont think, understand, or look things up - they predict what text is likely to come next based on patterns in their training data.', 35, 2, 'understand', 2, '["Think about what AI learned from", "Its not thinking or looking things up"]'),

  ('q_llm_tf_002', 'llm_communications', 'llm_tf_2', 'topic_llm_tokens', 'multiple_choice', 'Why does AI break words into "tokens" instead of processing whole words?', '["Its faster than whole words", "Common word parts can be reused across many words", "Tokens are easier to store", "Its just how computers work"]', 'Common word parts can be reused across many words', 'Tokenization lets AI handle any word, even new ones, by combining common pieces. "unbelievable" might become "un", "believ", "able" - reusable parts the AI knows from other words.', 40, 2, 'understand', 2, '["Think about word parts like prefixes and suffixes", "How would you handle words youve never seen?"]'),

  ('q_llm_tf_003', 'llm_communications', 'llm_tf_2', 'topic_llm_next_token', 'multiple_choice', 'If AI is predicting "The cat sat on the ___", why might it sometimes say "mat" and sometimes "floor"?', '["Its making random mistakes", "Both have high probability and randomness selects between them", "It remembers different things each time", "The question is confusing it"]', 'Both have high probability and randomness selects between them', 'When multiple tokens have similar probability, the AI samples from them somewhat randomly (controlled by temperature). Both "mat" and "floor" are reasonable completions.', 45, 2, 'analyze', 3, '["Think about probability distribution", "Is there only one right answer?"]'),

  ('q_llm_tf_004', 'llm_communications', 'llm_tf_3', 'topic_llm_training', 'multiple_choice', 'When you have a long conversation with AI, is it learning from what you teach it?', '["Yes, it updates its knowledge as you talk", "No, it uses fixed knowledge and your conversation is only temporary context", "Yes, but only until you close the chat", "It depends on the AI"]', 'No, it uses fixed knowledge and your conversation is only temporary context', 'Chatting is "inference" not "training". The AI uses its pre-learned patterns plus your conversation as context, but doesnt actually update its knowledge. Tomorrow it wont remember.', 40, 2, 'understand', 2, '["Training requires updating the model", "What happens when you start a new chat?"]'),

  ('q_llm_tf_005', 'llm_communications', 'llm_tf_4', 'topic_llm_context', 'multiple_choice', 'You have a very long conversation and AI seems to forget something you said at the beginning. Why?', '["The AI is confused", "The context window filled up and old information was dropped", "AI has bad memory", "You werent clear enough"]', 'The context window filled up and old information was dropped', 'LLMs have a limited context window - they can only process so many tokens at once. When you exceed this, the oldest parts of the conversation are effectively forgotten.', 40, 2, 'understand', 2, '["Think about memory limits", "What happens when a bucket overflows?"]'),

  ('q_llm_tf_006', 'llm_communications', 'llm_tf_5', 'topic_llm_probability', 'multiple_choice', 'Why can AI be confidently wrong about facts?', '["It lies on purpose", "High probability doesnt mean true - likely text isnt always factual text", "It doesnt have access to facts", "Its just bad at some topics"]', 'High probability doesnt mean true - likely text isnt always factual text', 'AI predicts what text is LIKELY to follow, not what is TRUE. If many texts say something false, AI might confidently repeat it. Pattern matching isnt fact checking.', 45, 2, 'analyze', 3, '["Probable and true arent the same", "What did AI learn from?"]'),

  ('q_llm_tf_007', 'llm_communications', 'llm_tf_6', 'topic_llm_temperature', 'multiple_choice', 'You want AI to write a creative story. Should you use high or low temperature?', '["Low - for accuracy", "High - for variety and creativity", "Doesnt matter", "Medium only"]', 'High - for variety and creativity', 'Higher temperature increases randomness, leading to more varied and creative outputs. Lower temperature makes outputs more predictable and consistent - better for factual tasks.', 35, 2, 'apply', 2, '["Creative means varied and unexpected", "What does temperature control?"]'),

  ('q_llm_tf_008', 'llm_communications', 'llm_tf_7', 'topic_llm_embeddings', 'multiple_choice', 'In AI word embeddings, "king" and "queen" would have numbers that are:', '["Completely different", "Somewhat similar, both relating to royalty", "Identical", "Random"]', 'Somewhat similar, both relating to royalty', 'Word embeddings capture meaning as numbers. Words with related meanings have similar number patterns. King and queen share royalty concepts but differ in gender, so theyre similar but not identical.', 50, 3, 'understand', 2, '["Think about what the words have in common", "How would you represent meaning mathematically?"]'),

  ('q_llm_tf_009', 'llm_communications', 'llm_tf_8', 'topic_llm_attention', 'multiple_choice', 'In the sentence "The bank by the river was flooded", what helps AI know "bank" means riverbank not money bank?', '["It guesses randomly", "Attention mechanism focuses on nearby words like river and flooded", "It always assumes the most common meaning", "AI cant tell the difference"]', 'Attention mechanism focuses on nearby words like river and flooded', 'The attention mechanism lets AI weigh which other words are most relevant for understanding each word. "River" and "flooded" strongly indicate the riverbank meaning.', 55, 3, 'analyze', 3, '["What context clues tell you the meaning?", "How might AI use surrounding words?"]'),

  ('q_llm_tf_010', 'llm_communications', 'llm_tf_9', 'topic_llm_hallucination', 'multiple_choice', 'AI tells you a detailed fact that sounds right but you cant verify it. What should you assume?', '["Its probably true if it sounds confident", "Its definitely false", "It might be a hallucination and needs verification", "AI wouldnt make up details"]', 'It might be a hallucination and needs verification', 'AI generates plausible text, not verified truth. Detailed, confident statements can be completely fabricated. Always verify important facts from authoritative sources.', 40, 2, 'evaluate', 3, '["Confident doesnt mean correct", "What is AI actually doing?"]'),

  ('q_llm_tf_011', 'llm_communications', 'llm_tf_10', 'topic_llm_data_bias', 'multiple_choice', 'AI was trained mostly on English internet text. How might this affect its knowledge?', '["No effect", "It might know more about Western culture and less about others", "It only affects language, not knowledge", "It makes AI more accurate"]', 'It might know more about Western culture and less about others', 'AI reflects its training data. If trained mostly on English internet text, it will know more about topics and perspectives common in that data, and less about underrepresented groups and topics.', 45, 3, 'analyze', 3, '["What was in the training data?", "What might be missing?"]'),

  ('q_llm_tf_012', 'llm_communications', 'llm_tf_11', 'topic_llm_prompt_position', 'multiple_choice', 'You have a long prompt with important instructions. Where should you put the MOST important ones?', '["Only in the middle", "At the beginning and/or end", "It doesnt matter", "In a separate message"]', 'At the beginning and/or end', 'AI attention tends to focus more on the beginning and end of prompts (primacy and recency effects). Important instructions placed in the middle may get less attention.', 45, 3, 'apply', 2, '["Think about how attention works", "Where do you naturally focus?"]');

-- ============================================================================
-- QUESTION BANK - META-LEARNING
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  ('q_llm_ml_001', 'llm_communications', 'llm_ml_1', 'topic_ml_memory', 'multiple_choice', 'Why is sleeping after learning important?', '["It isnt - you should study more instead", "Sleep consolidates memories from working memory to long-term storage", "Sleep helps you forget wrong answers", "Its just for rest"]', 'Sleep consolidates memories from working memory to long-term storage', 'During sleep, your brain replays and strengthens the neural connections formed during learning, moving information into long-term memory. Skipping sleep undermines learning.', 35, 2, 'understand', 2, '["What happens to memories during sleep?", "Why do you forget when tired?"]'),

  ('q_llm_ml_002', 'llm_communications', 'llm_ml_2', 'topic_ml_recall', 'multiple_choice', 'Which study method leads to better long-term retention?', '["Re-reading your notes multiple times", "Highlighting important passages", "Closing your notes and trying to recall what you learned", "Listening to lectures again"]', 'Closing your notes and trying to recall what you learned', 'Active recall - testing yourself - strengthens memory far more than passive review. The effort of retrieval makes the memory stronger. Re-reading feels easier but is far less effective.', 40, 2, 'analyze', 3, '["Which requires more mental effort?", "What strengthens a memory trace?"]'),

  ('q_llm_ml_003', 'llm_communications', 'llm_ml_3', 'topic_ml_spacing', 'multiple_choice', 'You have 3 hours to study for a test next week. Which approach works best?', '["Study all 3 hours the night before", "Study 1 hour on three different days", "Study 3 hours today and forget about it", "It doesnt matter when you study"]', 'Study 1 hour on three different days', 'Spacing your practice over time dramatically improves retention. The forgetting and re-learning process strengthens memory. Cramming leads to fast forgetting after the test.', 40, 2, 'apply', 2, '["What happens between study sessions?", "What does forgetting and re-learning do?"]'),

  ('q_llm_ml_004', 'llm_communications', 'llm_ml_4', 'topic_ml_difficulty', 'multiple_choice', 'Learning feels hard and frustrating. This means:', '["Youre not smart enough for this", "You should find an easier topic", "You might be learning deeply - difficulty often signals growth", "The teaching is bad"]', 'You might be learning deeply - difficulty often signals growth', 'Desirable difficulties - struggling with challenging material - leads to deeper learning. If it feels too easy, youre probably not growing. Discomfort is often a sign of growth.', 35, 2, 'evaluate', 3, '["Does easy always mean good?", "What does struggle indicate?"]'),

  ('q_llm_ml_005', 'llm_communications', 'llm_ml_5', 'topic_ml_deliberate', 'multiple_choice', 'What separates expert practice from regular practice?', '["Experts practice longer", "Experts focus specifically on their weaknesses with feedback", "Experts have more natural talent", "Experts use better equipment"]', 'Experts focus specifically on their weaknesses with feedback', 'Deliberate practice means targeting specific weaknesses, getting immediate feedback, and pushing just beyond your current ability. Time spent practicing matters less than practice quality.', 45, 2, 'understand', 2, '["What makes practice effective?", "Do experts just do more of the same?"]'),

  ('q_llm_ml_006', 'llm_communications', 'llm_ml_6', 'topic_ml_chunking', 'multiple_choice', 'An expert chess player sees a board and immediately notices a "fork" attack. A beginner sees 32 pieces. Whats the difference?', '["The expert has a better memory", "The expert has chunked patterns that the beginner hasnt built yet", "Chess is just talent", "The beginner isnt paying attention"]', 'The expert has chunked patterns that the beginner hasnt built yet', 'Experts develop chunks - recognizable patterns of information. They see "knight fork" as one concept, not 32 separate pieces. This is why experts seem to have better memory - they see bigger units.', 50, 3, 'analyze', 3, '["How do experts perceive differently?", "What is a pattern?"]'),

  ('q_llm_ml_007', 'llm_communications', 'llm_ml_7', 'topic_ml_transfer', 'multiple_choice', 'You learned problem-solving in math. How do you apply it to science?', '["You cant - theyre different subjects", "Find the underlying structure that both share", "Just use the exact same method", "Math has nothing to do with science"]', 'Find the underlying structure that both share', 'Transfer happens when you identify deep structural similarities between domains. Problem decomposition, logical reasoning, and systematic approaches transfer - but you must consciously look for the connection.', 55, 3, 'apply', 3, '["What do problem-solving approaches have in common?", "Look past surface differences"]'),

  ('q_llm_ml_008', 'llm_communications', 'llm_ml_8', 'topic_ml_pareto', 'multiple_choice', 'The 80/20 principle suggests that for learning a new skill you should:', '["Learn everything equally", "Find the 20% of techniques that produce 80% of results and master those first", "Only learn 20% and quit", "Spend 80% of time on the hardest parts"]', 'Find the 20% of techniques that produce 80% of results and master those first', 'In most skills, a small number of core concepts produce most of the practical results. Identify and master these first before diving into edge cases. Be strategic about where to focus.', 45, 2, 'apply', 2, '["Not all knowledge is equally valuable", "Whats most impactful to learn first?"]'),

  ('q_llm_ml_009', 'llm_communications', 'llm_ml_9', 'topic_ml_growth', 'multiple_choice', 'You failed a hard test. A growth mindset response is:', '["Im just not smart enough for this", "This shows I have more to learn - what specifically did I miss?", "Tests are unfair anyway", "I should try an easier subject"]', 'This shows I have more to learn - what specifically did I miss?', 'Growth mindset sees failure as information about what to learn next, not as a judgment of fixed ability. The question becomes "what do I need to work on?" not "am I smart enough?"', 35, 2, 'evaluate', 3, '["Is ability fixed or buildable?", "What can you learn from failure?"]'),

  ('q_llm_ml_010', 'llm_communications', 'llm_ml_10', 'topic_ml_cognitive_load', 'multiple_choice', 'Youre trying to learn something complex and feel overwhelmed. What should you do?', '["Push through - pain is gain", "Give up and try something simpler", "Break it into smaller pieces and tackle one at a time", "Memorize everything at once"]', 'Break it into smaller pieces and tackle one at a time', 'Working memory is limited. When overwhelmed, break the problem into manageable chunks. Master each piece before combining them. Use notes, diagrams, and tools to offload mental work.', 40, 2, 'apply', 2, '["What causes overwhelm?", "How do you eat an elephant?"]'),

  ('q_llm_ml_011', 'llm_communications', 'llm_ml_11', 'topic_ml_flow', 'multiple_choice', 'What conditions create a flow state for learning?', '["Being in a quiet room", "Challenge slightly above current skill with clear goals and immediate feedback", "Having no pressure or deadline", "Being naturally talented"]', 'Challenge slightly above current skill with clear goals and immediate feedback', 'Flow emerges when challenge matches skill (slightly above), goals are clear, and feedback is immediate. Too easy = boredom. Too hard = anxiety. The zone between is where flow happens.', 50, 3, 'understand', 2, '["When do you feel most engaged?", "What makes an activity absorbing?"]'),

  ('q_llm_ml_012', 'llm_communications', 'llm_ml_12', 'topic_ml_failure', 'multiple_choice', 'A scientist does an experiment and it fails. What should they think?', '["Im a bad scientist", "I now have information I didnt have before", "Science is too hard", "I should only do experiments that will succeed"]', 'I now have information I didnt have before', 'Failure in the context of effort provides valuable information. You now know what doesnt work. Every eliminated wrong path brings you closer to the right one. Failure is data.', 40, 2, 'evaluate', 3, '["What did the failure reveal?", "Is all failure bad?"]'),

  ('q_llm_ml_013', 'llm_communications', 'llm_ml_13', 'topic_ml_ai_partner', 'multiple_choice', 'How can AI help you learn faster than traditional methods?', '["It gives you answers so you dont have to think", "It provides instant feedback, personalized explanations, and unlimited practice partners", "It replaces the need to learn", "AI cant help with learning"]', 'It provides instant feedback, personalized explanations, and unlimited practice partners', 'AI accelerates learning through instant feedback (no waiting), personalized explanations at your level, on-demand examples, and 24/7 availability for practice. But YOU still do the learning.', 40, 2, 'understand', 2, '["What makes learning faster?", "What can AI provide that books cant?"]'),

  ('q_llm_ml_014', 'llm_communications', 'llm_ml_14', 'topic_ml_feynman', 'multiple_choice', 'The Feynman Technique says the best way to test your understanding is to:', '["Read more books on the topic", "Explain the concept as if teaching it to someone who doesnt know it", "Take practice tests", "Have an expert evaluate you"]', 'Explain the concept as if teaching it to someone who doesnt know it', 'If you can explain something simply to a novice, you truly understand it. Where your explanation breaks down reveals gaps in your understanding. AI makes a perfect practice student.', 40, 2, 'understand', 2, '["What does teaching require?", "How do you know you understand?"]'),

  ('q_llm_ml_015', 'llm_communications', 'llm_ml_15', 'topic_ml_knowledge_system', 'multiple_choice', 'Why should you build a personal knowledge system rather than just take notes?', '["To impress people", "Notes get lost; systems grow, connect ideas, and help you retrieve knowledge when needed", "Its required for school", "Its just trendy"]', 'Notes get lost; systems grow, connect ideas, and help you retrieve knowledge when needed', 'A knowledge system isnt just storage - its a tool for thinking. Connected notes reveal patterns. Searchable knowledge is retrievable when you need it. The system gets smarter as you add to it.', 50, 3, 'analyze', 3, '["What makes knowledge useful?", "How do ideas connect?"]'),

  ('q_llm_ml_016', 'llm_communications', 'llm_ml_16', 'topic_ml_rapid', 'multiple_choice', 'To learn a new skill rapidly, you should first:', '["Practice as much as possible immediately", "Deconstruct the skill into sub-skills and identify the most important ones", "Find the best teacher", "Buy the best equipment"]', 'Deconstruct the skill into sub-skills and identify the most important ones', 'Rapid skill acquisition starts with analysis: what are the component skills? Which ones give the biggest results? Focus on those first. Practice everything equally wastes time on low-value components.', 45, 2, 'apply', 2, '["Not all parts of a skill are equal", "What gives you 80% of results?"]');

-- ============================================================================
-- PREREQUISITES FOR NEW TOPICS
-- ============================================================================

INSERT OR IGNORE INTO hyro_skill_prerequisites (id, skill_id, skill_type, prerequisite_id, prerequisite_type, strength) VALUES
  -- Technical Foundations Chain
  ('prereq_llm_tf_001', 'topic_llm_tokens', 'topic', 'topic_llm_what_is_llm', 'topic', 'required'),
  ('prereq_llm_tf_002', 'topic_llm_next_token', 'topic', 'topic_llm_tokens', 'topic', 'required'),
  ('prereq_llm_tf_003', 'topic_llm_training', 'topic', 'topic_llm_what_is_llm', 'topic', 'required'),
  ('prereq_llm_tf_004', 'topic_llm_context', 'topic', 'topic_llm_tokens', 'topic', 'recommended'),
  ('prereq_llm_tf_005', 'topic_llm_probability', 'topic', 'topic_llm_next_token', 'topic', 'required'),
  ('prereq_llm_tf_006', 'topic_llm_temperature', 'topic', 'topic_llm_probability', 'topic', 'required'),
  ('prereq_llm_tf_007', 'topic_llm_embeddings', 'topic', 'topic_llm_tokens', 'topic', 'required'),
  ('prereq_llm_tf_008', 'topic_llm_attention', 'topic', 'topic_llm_embeddings', 'topic', 'required'),
  ('prereq_llm_tf_009', 'topic_llm_hallucination', 'topic', 'topic_llm_probability', 'topic', 'required'),
  ('prereq_llm_tf_010', 'topic_llm_data_bias', 'topic', 'topic_llm_training', 'topic', 'required'),
  ('prereq_llm_tf_011', 'topic_llm_prompt_position', 'topic', 'topic_llm_attention', 'topic', 'recommended'),
  ('prereq_llm_tf_012', 'topic_llm_model_comparison', 'topic', 'topic_llm_what_is_llm', 'topic', 'required'),

  -- Meta-Learning Chain
  ('prereq_llm_ml_001', 'topic_ml_recall', 'topic', 'topic_ml_memory', 'topic', 'required'),
  ('prereq_llm_ml_002', 'topic_ml_spacing', 'topic', 'topic_ml_memory', 'topic', 'required'),
  ('prereq_llm_ml_003', 'topic_ml_difficulty', 'topic', 'topic_ml_growth', 'topic', 'recommended'),
  ('prereq_llm_ml_004', 'topic_ml_deliberate', 'topic', 'topic_ml_difficulty', 'topic', 'required'),
  ('prereq_llm_ml_005', 'topic_ml_chunking', 'topic', 'topic_ml_memory', 'topic', 'required'),
  ('prereq_llm_ml_006', 'topic_ml_transfer', 'topic', 'topic_ml_chunking', 'topic', 'required'),
  ('prereq_llm_ml_007', 'topic_ml_pareto', 'topic', 'topic_ml_deliberate', 'topic', 'recommended'),
  ('prereq_llm_ml_008', 'topic_ml_cognitive_load', 'topic', 'topic_ml_memory', 'topic', 'required'),
  ('prereq_llm_ml_009', 'topic_ml_flow', 'topic', 'topic_ml_difficulty', 'topic', 'required'),
  ('prereq_llm_ml_010', 'topic_ml_failure', 'topic', 'topic_ml_growth', 'topic', 'required'),
  ('prereq_llm_ml_011', 'topic_ml_ai_partner', 'topic', 'topic_llm_basic_prompts', 'topic', 'required'),
  ('prereq_llm_ml_012', 'topic_ml_feynman', 'topic', 'topic_ml_recall', 'topic', 'required'),
  ('prereq_llm_ml_013', 'topic_ml_knowledge_system', 'topic', 'topic_ml_chunking', 'topic', 'required'),
  ('prereq_llm_ml_014', 'topic_ml_rapid', 'topic', 'topic_ml_pareto', 'topic', 'required');

-- ============================================================================
-- LEARNING PROGRESSIONS - NEW STRANDS
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_progressions (id, name, domain, description, grade_span, progression_type, topic_sequence, estimated_weeks) VALUES
  ('prog_llm_technical', 'Understanding AI', 'llm_communications', 'How LLMs actually work - demystifying the technology', '6-12', 'standard',
   '["topic_llm_what_is_llm", "topic_llm_tokens", "topic_llm_next_token", "topic_llm_training", "topic_llm_context", "topic_llm_probability", "topic_llm_temperature", "topic_llm_hallucination"]', 4),
  ('prog_llm_math_foundations', 'AI Math Concepts', 'llm_communications', 'The mathematics behind AI - conceptual understanding', '7-12', 'acceleration',
   '["topic_llm_probability", "topic_llm_embeddings", "topic_llm_attention", "topic_llm_data_bias", "topic_llm_prompt_position", "topic_llm_model_comparison"]', 5),
  ('prog_ml_science', 'Learning Science', 'llm_communications', 'How learning actually works - the science', '6-12', 'standard',
   '["topic_ml_memory", "topic_ml_recall", "topic_ml_spacing", "topic_ml_difficulty", "topic_ml_cognitive_load", "topic_ml_chunking"]', 4),
  ('prog_ml_practice', 'Practice Mastery', 'llm_communications', 'How to practice for maximum growth', '6-12', 'standard',
   '["topic_ml_deliberate", "topic_ml_failure", "topic_ml_flow", "topic_ml_growth", "topic_ml_pareto", "topic_ml_transfer"]', 4),
  ('prog_ml_ai_accelerated', 'AI-Accelerated Learning', 'llm_communications', 'Using AI to learn faster and deeper', '6-12', 'acceleration',
   '["topic_ml_ai_partner", "topic_ml_feynman", "topic_ml_knowledge_system", "topic_ml_rapid"]', 3);
