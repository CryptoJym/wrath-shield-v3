-- HYRO FORGE: LLM Communications Curriculum
-- Migration 023: NOVEL DOMAIN - Using AI as a Co-Development Partner
-- This is a cutting-edge curriculum focused on:
--   1. Vision Articulation - Translating mental models into clear communication
--   2. Prompt Engineering - Effectively communicating with AI systems
--   3. AI Co-Development - Building applications and ideas with LLM assistance
--   4. Perception Refinement - Using AI as a mirror to improve understanding
--
-- PHILOSOPHY: "Vibe Coding" - The focus is not on memorizing syntax, but on
-- developing the ability to communicate intent clearly enough that AI can
-- help manifest it into reality. This is about augmenting human capability.

-- ============================================================================
-- LLM COMMUNICATIONS STANDARDS (Original - No External Standard Set)
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  -- ==========================================================================
  -- STRAND 1: VISION ARTICULATION
  -- The ability to clearly express what you want to create or understand
  -- ==========================================================================
  ('llm_va_1', 'llm_communications', 'hyro_advanced', 'LLM.VA.1', 'Mental Model Externalization', 'Develop the ability to translate internal mental models, ideas, and visions into clear, structured external expressions that others (including AI) can understand.', NULL, 'middle', 'Vision Articulation', 'Core Skill', 1, 1, 1),
  ('llm_va_2', 'llm_communications', 'hyro_advanced', 'LLM.VA.2', 'Goal Decomposition', 'Break down complex goals into smaller, achievable sub-goals that can be clearly communicated and progressively implemented.', NULL, 'middle', 'Vision Articulation', 'Core Skill', 2, 1, 1),
  ('llm_va_3', 'llm_communications', 'hyro_advanced', 'LLM.VA.3', 'Constraint Specification', 'Identify and articulate constraints, requirements, and boundaries that shape what success looks like for any given project or problem.', NULL, 'middle', 'Vision Articulation', 'Core Skill', 3, 1, 1),
  ('llm_va_4', 'llm_communications', 'hyro_advanced', 'LLM.VA.4', 'Vision Iteration', 'Refine and evolve initial visions based on feedback, new information, and deeper understanding gained through the development process.', NULL, 'middle', 'Vision Articulation', 'Advanced', 4, 1, 1),
  ('llm_va_5', 'llm_communications', 'hyro_advanced', 'LLM.VA.5', 'Abstraction Levels', 'Communicate at appropriate levels of abstraction - from high-level vision to specific implementation details - based on context and audience.', NULL, 'middle', 'Vision Articulation', 'Advanced', 5, 1, 1),

  -- ==========================================================================
  -- STRAND 2: PROMPT ENGINEERING
  -- Effective communication with AI systems
  -- ==========================================================================
  ('llm_pe_1', 'llm_communications', 'hyro_advanced', 'LLM.PE.1', 'Clear Intent Communication', 'Write prompts that clearly convey intent, including desired outcomes, format, tone, and constraints.', NULL, 'middle', 'Prompt Engineering', 'Foundations', 10, 1, 1),
  ('llm_pe_2', 'llm_communications', 'hyro_advanced', 'LLM.PE.2', 'Context Provision', 'Provide appropriate context, background information, and examples that help AI understand the task fully.', NULL, 'middle', 'Prompt Engineering', 'Foundations', 11, 1, 1),
  ('llm_pe_3', 'llm_communications', 'hyro_advanced', 'LLM.PE.3', 'Role and Persona Assignment', 'Effectively use role-playing and persona techniques to guide AI behavior and output style.', NULL, 'middle', 'Prompt Engineering', 'Techniques', 12, 1, 1),
  ('llm_pe_4', 'llm_communications', 'hyro_advanced', 'LLM.PE.4', 'Chain-of-Thought Prompting', 'Structure prompts to encourage step-by-step reasoning and transparent problem-solving processes.', NULL, 'middle', 'Prompt Engineering', 'Techniques', 13, 1, 1),
  ('llm_pe_5', 'llm_communications', 'hyro_advanced', 'LLM.PE.5', 'Few-Shot Learning', 'Use examples within prompts to demonstrate desired output patterns and formats.', NULL, 'middle', 'Prompt Engineering', 'Techniques', 14, 1, 1),
  ('llm_pe_6', 'llm_communications', 'hyro_advanced', 'LLM.PE.6', 'Iterative Refinement', 'Develop skills in prompt iteration - refining based on AI responses to achieve better results.', NULL, 'middle', 'Prompt Engineering', 'Advanced', 15, 1, 1),
  ('llm_pe_7', 'llm_communications', 'hyro_advanced', 'LLM.PE.7', 'Multi-Turn Conversations', 'Manage extended conversations with AI, building on previous exchanges effectively.', NULL, 'middle', 'Prompt Engineering', 'Advanced', 16, 1, 1),
  ('llm_pe_8', 'llm_communications', 'hyro_advanced', 'LLM.PE.8', 'Output Formatting', 'Specify and obtain structured outputs (JSON, markdown, code, etc.) appropriate for different use cases.', NULL, 'middle', 'Prompt Engineering', 'Advanced', 17, 1, 1),

  -- ==========================================================================
  -- STRAND 3: AI CO-DEVELOPMENT
  -- Building things together with AI assistance
  -- ==========================================================================
  ('llm_cd_1', 'llm_communications', 'hyro_advanced', 'LLM.CD.1', 'Project Conceptualization', 'Use AI as a brainstorming partner to develop, expand, and refine project ideas.', NULL, 'middle', 'Co-Development', 'Ideation', 20, 1, 1),
  ('llm_cd_2', 'llm_communications', 'hyro_advanced', 'LLM.CD.2', 'Architecture Planning', 'Collaborate with AI to design high-level structures for projects, whether code, writing, or other creative work.', NULL, 'middle', 'Co-Development', 'Planning', 21, 1, 1),
  ('llm_cd_3', 'llm_communications', 'hyro_advanced', 'LLM.CD.3', 'Incremental Building', 'Build projects step-by-step with AI assistance, maintaining coherence and direction throughout.', NULL, 'middle', 'Co-Development', 'Implementation', 22, 1, 1),
  ('llm_cd_4', 'llm_communications', 'hyro_advanced', 'LLM.CD.4', 'Code Generation Collaboration', 'Work with AI to generate, understand, modify, and debug code without requiring deep syntax knowledge.', NULL, 'middle', 'Co-Development', 'Implementation', 23, 1, 1),
  ('llm_cd_5', 'llm_communications', 'hyro_advanced', 'LLM.CD.5', 'Quality Evaluation', 'Evaluate AI-generated content for correctness, completeness, and alignment with goals.', NULL, 'middle', 'Co-Development', 'Evaluation', 24, 1, 1),
  ('llm_cd_6', 'llm_communications', 'hyro_advanced', 'LLM.CD.6', 'Error Recognition and Recovery', 'Identify when AI output is incorrect, incomplete, or off-track, and communicate corrections effectively.', NULL, 'middle', 'Co-Development', 'Evaluation', 25, 1, 1),
  ('llm_cd_7', 'llm_communications', 'hyro_advanced', 'LLM.CD.7', 'Integration and Synthesis', 'Combine multiple AI-generated components into coherent, functional wholes.', NULL, 'middle', 'Co-Development', 'Advanced', 26, 1, 1),
  ('llm_cd_8', 'llm_communications', 'hyro_advanced', 'LLM.CD.8', 'Tool Chain Awareness', 'Understand different AI tools and their strengths/limitations for various tasks.', NULL, 'middle', 'Co-Development', 'Advanced', 27, 1, 1),

  -- ==========================================================================
  -- STRAND 4: PERCEPTION REFINEMENT
  -- Using AI as a mirror to improve understanding and clarity of thought
  -- ==========================================================================
  ('llm_pr_1', 'llm_communications', 'hyro_advanced', 'LLM.PR.1', 'Assumption Identification', 'Use AI dialogue to surface and examine hidden assumptions in your thinking.', NULL, 'middle', 'Perception Refinement', 'Self-Awareness', 30, 1, 1),
  ('llm_pr_2', 'llm_communications', 'hyro_advanced', 'LLM.PR.2', 'Clarity Testing', 'Use AI as a test of whether your ideas are clearly expressed - if AI misunderstands, refine your communication.', NULL, 'middle', 'Perception Refinement', 'Self-Awareness', 31, 1, 1),
  ('llm_pr_3', 'llm_communications', 'hyro_advanced', 'LLM.PR.3', 'Perspective Expansion', 'Use AI to explore alternative viewpoints, approaches, and solutions you might not have considered.', NULL, 'middle', 'Perception Refinement', 'Growth', 32, 1, 1),
  ('llm_pr_4', 'llm_communications', 'hyro_advanced', 'LLM.PR.4', 'Knowledge Gap Recognition', 'Identify gaps in your understanding through AI interaction and develop strategies to address them.', NULL, 'middle', 'Perception Refinement', 'Growth', 33, 1, 1),
  ('llm_pr_5', 'llm_communications', 'hyro_advanced', 'LLM.PR.5', 'Bias Detection', 'Recognize and account for biases in both your own thinking and AI responses.', NULL, 'middle', 'Perception Refinement', 'Critical Thinking', 34, 1, 1),
  ('llm_pr_6', 'llm_communications', 'hyro_advanced', 'LLM.PR.6', 'Metacognitive Monitoring', 'Develop awareness of your own thinking processes and learning patterns through AI-assisted reflection.', NULL, 'middle', 'Perception Refinement', 'Advanced', 35, 1, 1),
  ('llm_pr_7', 'llm_communications', 'hyro_advanced', 'LLM.PR.7', 'Vision Distortion Correction', 'Use AI feedback to identify and correct distortions in how you perceive problems, solutions, or situations.', NULL, 'middle', 'Perception Refinement', 'Advanced', 36, 1, 1);

-- ============================================================================
-- CURRICULUM TOPICS - LLM COMMUNICATIONS
-- ============================================================================

INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- Vision Articulation Topics
  ('topic_llm_idea_capture', 'llm_communications', 'llm_va_1', 'Capturing Ideas Clearly', 'How to express your ideas so others can understand them', '["Describe ideas in your own words", "Identify the core concept vs details", "Use analogies and examples to explain"]', 1, 20),
  ('topic_llm_what_vs_how', 'llm_communications', 'llm_va_1', 'Separating What from How', 'Distinguishing desired outcomes from implementation methods', '["Focus on what you want to achieve", "Leave room for different approaches", "Describe end goals clearly"]', 2, 25),
  ('topic_llm_breaking_down', 'llm_communications', 'llm_va_2', 'Breaking Down Big Ideas', 'Decomposing large projects into manageable pieces', '["Identify major components of a project", "Create logical sequences of steps", "Know when to break down further"]', 2, 30),
  ('topic_llm_requirements', 'llm_communications', 'llm_va_3', 'Defining Requirements', 'Specifying what success looks like', '["List must-have features vs nice-to-haves", "Define boundaries and limitations", "Create clear acceptance criteria"]', 2, 30),
  ('topic_llm_refinement', 'llm_communications', 'llm_va_4', 'Iterating on Ideas', 'Improving ideas through feedback cycles', '["Accept feedback constructively", "Identify what needs to change", "Maintain core vision while adapting"]', 3, 35),

  -- Prompt Engineering Topics
  ('topic_llm_basic_prompts', 'llm_communications', 'llm_pe_1', 'Writing Basic Prompts', 'Getting started with AI communication', '["Write clear, complete requests", "Include relevant context", "Specify desired format"]', 1, 20),
  ('topic_llm_context_setting', 'llm_communications', 'llm_pe_2', 'Setting Context', 'Providing background information for AI', '["Identify what AI needs to know", "Share relevant constraints", "Explain the broader goal"]', 2, 25),
  ('topic_llm_role_prompts', 'llm_communications', 'llm_pe_3', 'Using Role Prompts', 'Assigning personas to guide AI responses', '["Create effective role descriptions", "Match roles to tasks", "Combine roles with specific requests"]', 2, 25),
  ('topic_llm_step_by_step', 'llm_communications', 'llm_pe_4', 'Encouraging Reasoning', 'Getting AI to show its work', '["Ask for step-by-step explanations", "Request reasoning before answers", "Verify logical flow"]', 2, 30),
  ('topic_llm_examples', 'llm_communications', 'llm_pe_5', 'Learning from Examples', 'Using examples to guide AI output', '["Select representative examples", "Show input-output patterns", "Explain why examples demonstrate the goal"]', 2, 30),
  ('topic_llm_iteration', 'llm_communications', 'llm_pe_6', 'Improving Through Iteration', 'Refining prompts based on results', '["Analyze why a prompt didn''t work", "Make targeted adjustments", "Build on successful patterns"]', 3, 35),
  ('topic_llm_conversations', 'llm_communications', 'llm_pe_7', 'Multi-Turn Conversations', 'Building on previous exchanges', '["Reference earlier discussion", "Build incrementally", "Maintain context across turns"]', 3, 35),
  ('topic_llm_structured_output', 'llm_communications', 'llm_pe_8', 'Getting Structured Outputs', 'Requesting specific formats', '["Request JSON, tables, or lists", "Specify field names and structure", "Validate output format"]', 3, 30),

  -- Co-Development Topics
  ('topic_llm_brainstorming', 'llm_communications', 'llm_cd_1', 'Brainstorming with AI', 'Using AI to generate and expand ideas', '["Ask open-ended questions", "Build on AI suggestions", "Filter and prioritize ideas"]', 1, 25),
  ('topic_llm_project_planning', 'llm_communications', 'llm_cd_2', 'Planning Projects with AI', 'Designing project structure collaboratively', '["Describe project goals clearly", "Request architecture suggestions", "Evaluate and refine plans"]', 2, 35),
  ('topic_llm_building_together', 'llm_communications', 'llm_cd_3', 'Building Step by Step', 'Incremental development with AI', '["Start with small components", "Test as you go", "Maintain direction and coherence"]', 2, 40),
  ('topic_llm_code_collab', 'llm_communications', 'llm_cd_4', 'Collaborating on Code', 'Working with AI to write and modify code', '["Describe what the code should do", "Request explanations of generated code", "Ask for modifications and improvements"]', 2, 45),
  ('topic_llm_evaluating', 'llm_communications', 'llm_cd_5', 'Evaluating AI Output', 'Assessing quality of AI responses', '["Check for accuracy and completeness", "Verify alignment with goals", "Identify areas for improvement"]', 2, 30),
  ('topic_llm_error_handling', 'llm_communications', 'llm_cd_6', 'Handling AI Errors', 'Recognizing and correcting mistakes', '["Identify incorrect or incomplete output", "Communicate corrections clearly", "Learn from error patterns"]', 3, 35),
  ('topic_llm_integration', 'llm_communications', 'llm_cd_7', 'Integrating Components', 'Combining AI outputs into cohesive work', '["Plan how pieces fit together", "Resolve conflicts between components", "Test integrated systems"]', 4, 45),

  -- Perception Refinement Topics
  ('topic_llm_assumptions', 'llm_communications', 'llm_pr_1', 'Uncovering Assumptions', 'Finding hidden beliefs in your thinking', '["Ask AI to identify assumptions", "Question why you believe things", "Test assumptions against evidence"]', 2, 30),
  ('topic_llm_clarity_check', 'llm_communications', 'llm_pr_2', 'Testing Your Clarity', 'Using AI to check understanding', '["If AI misunderstands, your message isn''t clear", "Identify specific unclear parts", "Rewrite for clarity"]', 2, 25),
  ('topic_llm_perspectives', 'llm_communications', 'llm_pr_3', 'Exploring New Perspectives', 'Using AI to see other viewpoints', '["Ask for alternative approaches", "Consider opposing views", "Synthesize multiple perspectives"]', 2, 30),
  ('topic_llm_knowledge_gaps', 'llm_communications', 'llm_pr_4', 'Finding Knowledge Gaps', 'Identifying what you don''t know', '["Notice when AI explains something new", "Recognize confusion as a signal", "Create learning goals from gaps"]', 2, 25),
  ('topic_llm_bias_awareness', 'llm_communications', 'llm_pr_5', 'Recognizing Biases', 'Understanding biases in thinking', '["Identify your own biases", "Recognize AI biases", "Seek balanced information"]', 3, 35),
  ('topic_llm_thinking_about_thinking', 'llm_communications', 'llm_pr_6', 'Metacognition', 'Thinking about your own thinking', '["Observe your thought patterns", "Identify learning preferences", "Improve thinking strategies"]', 3, 40),
  ('topic_llm_vision_correction', 'llm_communications', 'llm_pr_7', 'Correcting Vision Distortions', 'Using AI to improve perception accuracy', '["Identify where your understanding differs from reality", "Use AI as a reality check", "Iteratively refine your mental models"]', 4, 45);

-- ============================================================================
-- QUESTION BANK - LLM COMMUNICATIONS
-- These are more reflective and open-ended than traditional subjects
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  -- Vision Articulation Questions
  ('q_llm_va_001', 'llm_communications', 'llm_va_1', 'topic_llm_idea_capture', 'multiple_choice', 'When explaining an idea to AI, what is MOST important?', '["Using technical vocabulary", "Being as brief as possible", "Describing the desired outcome clearly", "Providing code examples"]', 'Describing the desired outcome clearly', 'AI can help with technical details, but it needs to understand what you''re trying to achieve. Clear outcome description lets AI suggest appropriate approaches.', 30, 2, 'understand', 2, '["What does AI need to help you?", "Technical details can come later - what comes first?"]'),

  ('q_llm_va_002', 'llm_communications', 'llm_va_2', 'topic_llm_breaking_down', 'multiple_choice', 'You want to build a simple game. What is the best first step when working with AI?', '["Ask AI to write all the code at once", "Describe the complete game and ask for step-by-step guidance", "Ask AI to choose what game to make", "Start writing code yourself first"]', 'Describe the complete game and ask for step-by-step guidance', 'Breaking down a big project into steps helps both you and AI work effectively. Starting with a clear vision but asking for incremental guidance is the "vibe coding" approach.', 35, 2, 'apply', 2, '["How do you eat an elephant?", "What keeps you in control while getting help?"]'),

  ('q_llm_va_003', 'llm_communications', 'llm_va_3', 'topic_llm_requirements', 'multiple_choice', 'Which is an example of a well-defined requirement?', '["Make it look nice", "I want something cool", "The button should be blue and say Submit", "Do whatever you think is best"]', 'The button should be blue and say Submit', 'Good requirements are specific and testable. "Blue button that says Submit" can be verified; "nice" and "cool" are vague and subjective.', 30, 2, 'analyze', 2, '["Which one can you clearly check?", "Which is specific enough to build?"]'),

  -- Prompt Engineering Questions
  ('q_llm_pe_001', 'llm_communications', 'llm_pe_1', 'topic_llm_basic_prompts', 'multiple_choice', 'Which prompt will likely give the best result?', '["write poem", "Write a 4-line poem about the ocean with a rhyme scheme of ABAB", "do something creative", "poem please"]', 'Write a 4-line poem about the ocean with a rhyme scheme of ABAB', 'The best prompts are clear about what you want (poem), include specifics (4 lines, about ocean), and define format (ABAB rhyme). More detail = better results.', 25, 1, 'apply', 2, '["Which one tells AI exactly what you want?", "Which provides the most guidance?"]'),

  ('q_llm_pe_002', 'llm_communications', 'llm_pe_2', 'topic_llm_context_setting', 'multiple_choice', 'You want AI to help write an email to your teacher. What context should you provide?', '["Nothing - AI will figure it out", "The teacher''s name only", "What the email is about, your grade level, and the tone you want", "Your entire conversation history with the teacher"]', 'What the email is about, your grade level, and the tone you want', 'Good context includes: the purpose (what it''s about), relevant background (your grade level), and constraints (formal/informal tone). Too little or too much context both hurt.', 35, 2, 'apply', 2, '["What does AI need to write appropriately?", "What makes an email suitable for a teacher?"]'),

  ('q_llm_pe_003', 'llm_communications', 'llm_pe_3', 'topic_llm_role_prompts', 'multiple_choice', 'When might you use a role prompt like "Act as a science teacher"?', '["When you want AI to grade your work harshly", "When you want explanations at an appropriate level", "Only for science questions", "Never - roles don''t help"]', 'When you want explanations at an appropriate level', 'Role prompts help AI adopt appropriate expertise, vocabulary, and explanation style. A "science teacher" role signals: explain clearly, use appropriate examples, be educational.', 35, 2, 'understand', 2, '["How might a teacher explain differently than an expert?", "What does the role tell AI about how to respond?"]'),

  ('q_llm_pe_004', 'llm_communications', 'llm_pe_4', 'topic_llm_step_by_step', 'multiple_choice', 'Why might you ask AI to "explain your reasoning step by step"?', '["To make the response longer", "To verify the logic and catch errors", "Because AI always makes mistakes", "It doesn''t matter"]', 'To verify the logic and catch errors', 'Step-by-step reasoning (Chain of Thought) lets you see HOW AI reached its answer. This helps you: catch mistakes, learn the process, and build understanding.', 40, 2, 'analyze', 3, '["What can you check if you see the steps?", "How does transparency help you?"]'),

  ('q_llm_pe_005', 'llm_communications', 'llm_pe_5', 'topic_llm_examples', 'multiple_choice', 'You want AI to write jokes in a specific style. What''s the best approach?', '["Tell AI: write jokes", "Give 2-3 examples of jokes in that style, then ask for more", "Describe the style in technical terms", "Ask AI what style of jokes are best"]', 'Give 2-3 examples of jokes in that style, then ask for more', 'Few-shot learning means showing examples of what you want. Examples are often clearer than descriptions and help AI match the exact style, format, or pattern you need.', 35, 2, 'apply', 2, '["What''s clearer - describing a style or showing it?", "How do you learn a new style?"]'),

  -- Co-Development Questions
  ('q_llm_cd_001', 'llm_communications', 'llm_cd_1', 'topic_llm_brainstorming', 'multiple_choice', 'When brainstorming with AI, what approach works best?', '["Accept the first idea AI suggests", "Ask AI to give you ONE perfect idea", "Ask for multiple ideas, then build on the interesting ones", "Only use your own ideas, not AI''s"]', 'Ask for multiple ideas, then build on the interesting ones', 'Good brainstorming generates many ideas before evaluating. Ask AI for multiple options, then use YOUR judgment to pick and develop the promising ones.', 30, 2, 'apply', 2, '["How does brainstorming work?", "Who makes the final decisions?"]'),

  ('q_llm_cd_002', 'llm_communications', 'llm_cd_4', 'topic_llm_code_collab', 'multiple_choice', 'AI writes some code for you. You don''t understand part of it. What should you do?', '["Just use it - AI knows best", "Delete it and try again", "Ask AI to explain that part in simple terms", "Only use code you write yourself"]', 'Ask AI to explain that part in simple terms', 'Vibe coding means you don''t need to memorize syntax, but you SHOULD understand what''s happening. Ask AI to explain - learning happens through understanding, not just using.', 35, 2, 'apply', 2, '["Should you use things you don''t understand?", "How can AI help you learn?"]'),

  ('q_llm_cd_003', 'llm_communications', 'llm_cd_5', 'topic_llm_evaluating', 'multiple_choice', 'How do you know if AI''s output is good?', '["AI is always right, so it''s always good", "Check if it does what you asked for and makes sense", "Only experts can evaluate AI output", "It''s impossible to know"]', 'Check if it does what you asked for and makes sense', 'YOU are the judge of whether AI output meets YOUR goals. Does it do what you wanted? Does the logic make sense? Does it work when you test it? Trust yourself to evaluate.', 35, 2, 'evaluate', 3, '["Who knows what you wanted?", "What are you checking for?"]'),

  ('q_llm_cd_004', 'llm_communications', 'llm_cd_6', 'topic_llm_error_handling', 'multiple_choice', 'AI gives you code that doesn''t work. What''s the best response?', '["Conclude AI is useless", "Copy the error message and ask AI to fix it", "Start completely over", "Give up on the project"]', 'Copy the error message and ask AI to fix it', 'Errors are normal and AI can help fix them! Share the error message - it contains clues. AI can often explain what went wrong and how to fix it.', 30, 2, 'apply', 2, '["What information does an error message contain?", "Can AI help debug its own work?"]'),

  -- Perception Refinement Questions
  ('q_llm_pr_001', 'llm_communications', 'llm_pr_1', 'topic_llm_assumptions', 'multiple_choice', 'You ask AI a question and get a surprising answer. What should you consider?', '["AI is definitely wrong", "Your question might have contained assumptions you didn''t notice", "Ignore it and ask again", "AI and humans think the same way"]', 'Your question might have contained assumptions you didn''t notice', 'Surprising answers often reveal hidden assumptions in our thinking. AI''s "misunderstanding" might actually be pointing out that you assumed something without realizing it.', 40, 3, 'analyze', 3, '["Why might AI interpret differently?", "What might you have assumed without stating?"]'),

  ('q_llm_pr_002', 'llm_communications', 'llm_pr_2', 'topic_llm_clarity_check', 'multiple_choice', 'AI doesn''t understand what you''re asking. This means:', '["AI is broken", "Your request might not be as clear as you thought", "You should use simpler words only", "AI can''t help with your problem"]', 'Your request might not be as clear as you thought', 'AI serves as a mirror for your communication. If AI misunderstands, it''s valuable feedback that your message could be clearer. Use this to improve your communication skills.', 35, 2, 'analyze', 3, '["What does misunderstanding tell you?", "Is the problem always with the listener?"]'),

  ('q_llm_pr_003', 'llm_communications', 'llm_pr_3', 'topic_llm_perspectives', 'multiple_choice', 'Why might you ask AI "What are some other ways to approach this problem?"', '["Because your way is wrong", "To discover options you might not have considered", "AI always knows the best approach", "To waste time"]', 'To discover options you might not have considered', 'We all have limited perspectives. AI can suggest approaches from different fields, cultures, or disciplines that might not occur to us. Exploring options often leads to better solutions.', 35, 2, 'understand', 2, '["Can anyone think of all approaches?", "What value does a different perspective bring?"]'),

  ('q_llm_pr_004', 'llm_communications', 'llm_pr_5', 'topic_llm_bias_awareness', 'multiple_choice', 'What should you remember about AI responses?', '["AI is always neutral and unbiased", "AI can reflect biases from its training data", "AI opinions are facts", "AI never makes mistakes"]', 'AI can reflect biases from its training data', 'AI learns from human-created data, which contains human biases. AI can also make mistakes or have incomplete information. Critical thinking means evaluating ALL sources, including AI.', 45, 3, 'analyze', 3, '["Where does AI knowledge come from?", "Are all information sources perfect?"]'),

  ('q_llm_pr_005', 'llm_communications', 'llm_pr_7', 'topic_llm_vision_correction', 'multiple_choice', 'You keep trying to explain something to AI but it doesn''t get it. This might mean:', '["Give up - AI can''t help", "Your mental model of the problem might have a gap or distortion", "AI is just bad at this topic", "You need to use more technical language"]', 'Your mental model of the problem might have a gap or distortion', 'Persistent misunderstanding can reveal that our own understanding isn''t as complete as we thought. This is valuable - it shows exactly where we need to think more clearly.', 50, 3, 'analyze', 4, '["What if the problem isn''t AI''s understanding?", "What can difficulty communicating reveal?"]');

-- ============================================================================
-- PREREQUISITES FOR LLM COMMUNICATIONS TOPICS
-- ============================================================================

INSERT OR IGNORE INTO hyro_skill_prerequisites (id, skill_id, skill_type, prerequisite_id, prerequisite_type, strength) VALUES
  ('prereq_llm_001', 'topic_llm_what_vs_how', 'topic', 'topic_llm_idea_capture', 'topic', 'required'),
  ('prereq_llm_002', 'topic_llm_breaking_down', 'topic', 'topic_llm_idea_capture', 'topic', 'required'),
  ('prereq_llm_003', 'topic_llm_requirements', 'topic', 'topic_llm_breaking_down', 'topic', 'recommended'),
  ('prereq_llm_004', 'topic_llm_refinement', 'topic', 'topic_llm_requirements', 'topic', 'required'),
  ('prereq_llm_005', 'topic_llm_context_setting', 'topic', 'topic_llm_basic_prompts', 'topic', 'required'),
  ('prereq_llm_006', 'topic_llm_role_prompts', 'topic', 'topic_llm_context_setting', 'topic', 'recommended'),
  ('prereq_llm_007', 'topic_llm_step_by_step', 'topic', 'topic_llm_basic_prompts', 'topic', 'required'),
  ('prereq_llm_008', 'topic_llm_examples', 'topic', 'topic_llm_basic_prompts', 'topic', 'required'),
  ('prereq_llm_009', 'topic_llm_iteration', 'topic', 'topic_llm_examples', 'topic', 'required'),
  ('prereq_llm_010', 'topic_llm_conversations', 'topic', 'topic_llm_iteration', 'topic', 'required'),
  ('prereq_llm_011', 'topic_llm_structured_output', 'topic', 'topic_llm_context_setting', 'topic', 'required'),
  ('prereq_llm_012', 'topic_llm_project_planning', 'topic', 'topic_llm_brainstorming', 'topic', 'required'),
  ('prereq_llm_013', 'topic_llm_building_together', 'topic', 'topic_llm_project_planning', 'topic', 'required'),
  ('prereq_llm_014', 'topic_llm_code_collab', 'topic', 'topic_llm_building_together', 'topic', 'recommended'),
  ('prereq_llm_015', 'topic_llm_evaluating', 'topic', 'topic_llm_building_together', 'topic', 'required'),
  ('prereq_llm_016', 'topic_llm_error_handling', 'topic', 'topic_llm_evaluating', 'topic', 'required'),
  ('prereq_llm_017', 'topic_llm_integration', 'topic', 'topic_llm_error_handling', 'topic', 'required'),
  ('prereq_llm_018', 'topic_llm_clarity_check', 'topic', 'topic_llm_assumptions', 'topic', 'required'),
  ('prereq_llm_019', 'topic_llm_perspectives', 'topic', 'topic_llm_clarity_check', 'topic', 'recommended'),
  ('prereq_llm_020', 'topic_llm_bias_awareness', 'topic', 'topic_llm_perspectives', 'topic', 'required'),
  ('prereq_llm_021', 'topic_llm_thinking_about_thinking', 'topic', 'topic_llm_bias_awareness', 'topic', 'required'),
  ('prereq_llm_022', 'topic_llm_vision_correction', 'topic', 'topic_llm_thinking_about_thinking', 'topic', 'required');

-- ============================================================================
-- LEARNING PROGRESSIONS - LLM COMMUNICATIONS
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_progressions (id, name, domain, description, grade_span, progression_type, topic_sequence, estimated_weeks) VALUES
  ('prog_llm_foundations', 'LLM Foundations', 'llm_communications', 'Basic skills for working with AI - start here', '6-8', 'standard',
   '["topic_llm_idea_capture", "topic_llm_basic_prompts", "topic_llm_brainstorming", "topic_llm_context_setting", "topic_llm_what_vs_how"]', 3),
  ('prog_llm_prompt_mastery', 'Prompt Engineering Mastery', 'llm_communications', 'Advanced prompt techniques for better AI collaboration', '6-8', 'acceleration',
   '["topic_llm_role_prompts", "topic_llm_step_by_step", "topic_llm_examples", "topic_llm_iteration", "topic_llm_conversations", "topic_llm_structured_output"]', 4),
  ('prog_llm_builder', 'AI-Assisted Builder', 'llm_communications', 'Creating projects with AI help', '6-8', 'standard',
   '["topic_llm_breaking_down", "topic_llm_requirements", "topic_llm_project_planning", "topic_llm_building_together", "topic_llm_code_collab", "topic_llm_evaluating", "topic_llm_error_handling"]', 5),
  ('prog_llm_perception', 'Perception & Clarity', 'llm_communications', 'Using AI to improve thinking and communication', '6-8', 'enrichment',
   '["topic_llm_assumptions", "topic_llm_clarity_check", "topic_llm_perspectives", "topic_llm_knowledge_gaps", "topic_llm_bias_awareness", "topic_llm_thinking_about_thinking", "topic_llm_vision_correction"]', 4);
