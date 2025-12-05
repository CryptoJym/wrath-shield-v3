-- HYRO FORGE: Cross-Domain Connections
-- Migration 025: Building the Integrated World Model
--
-- PHILOSOPHY: Knowledge isn't siloed. Math IS in science. Writing IS thinking.
-- Science uses math. Critical thinking is everywhere. These connections are
-- what separates shallow memorization from deep understanding.
--
-- "The more connections, the easier remembering becomes."

-- ============================================================================
-- CROSS-DOMAIN CONNECTIONS TABLE
-- Links concepts across different subjects
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_cross_domain_connections (
  id TEXT PRIMARY KEY,
  source_topic_id TEXT NOT NULL,
  target_topic_id TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  connection_type TEXT NOT NULL,  -- 'applies_in', 'supports', 'same_concept', 'analogy', 'prerequisite_for'
  strength TEXT DEFAULT 'moderate', -- 'weak', 'moderate', 'strong', 'essential'
  description TEXT,               -- Human-readable explanation of the connection
  examples TEXT,                  -- JSON array of concrete examples
  learning_opportunities TEXT,    -- How to use this connection for learning
  bidirectional INTEGER DEFAULT 1, -- Can the connection go both ways?
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(source_topic_id, target_topic_id)
);

CREATE INDEX IF NOT EXISTS idx_cross_source ON hyro_cross_domain_connections(source_topic_id);
CREATE INDEX IF NOT EXISTS idx_cross_target ON hyro_cross_domain_connections(target_topic_id);
CREATE INDEX IF NOT EXISTS idx_cross_type ON hyro_cross_domain_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_cross_domains ON hyro_cross_domain_connections(source_domain, target_domain);

-- ============================================================================
-- CONCEPT CLUSTERS TABLE
-- Groups of related concepts across domains (big ideas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_concept_clusters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  big_idea TEXT,                  -- The overarching concept
  domains_involved TEXT NOT NULL, -- JSON array of domains
  topic_ids TEXT NOT NULL,        -- JSON array of topic IDs in this cluster
  mastery_synergy TEXT,           -- How mastering these together helps
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_clusters_name ON hyro_concept_clusters(name);

-- ============================================================================
-- SEEDING CROSS-DOMAIN CONNECTIONS
-- ============================================================================

-- Mathematics <-> Science Connections
INSERT OR IGNORE INTO hyro_cross_domain_connections (id, source_topic_id, target_topic_id, source_domain, target_domain, connection_type, strength, description, examples, learning_opportunities) VALUES
  ('xd_math_sci_001', 'topic_ratios_intro', 'topic_sci_models', 'mathematics', 'science', 'applies_in', 'strong',
   'Ratios express relationships in scientific models - density, speed, concentration',
   '["Density = mass/volume ratio", "Speed = distance/time ratio", "Concentration = solute/solution ratio"]',
   'When learning ratios, use science examples. When doing science calculations, reinforce ratio skills.'),

  ('xd_math_sci_002', 'topic_unit_rates', 'topic_sci_data', 'mathematics', 'science', 'applies_in', 'strong',
   'Unit rates are essential for interpreting experimental data and measurements',
   '["meters per second", "grams per liter", "organisms per square meter"]',
   'Science data analysis is a perfect context for practicing unit rate calculations.'),

  ('xd_math_sci_003', 'topic_graphing_coordinates', 'topic_sci_data', 'mathematics', 'science', 'applies_in', 'essential',
   'Graphing experimental data uses the same coordinate plane skills',
   '["Time on x-axis, measurement on y-axis", "Independent vs dependent variables", "Identifying trends from plotted points"]',
   'Every science graph is math practice. Every math graph can use science contexts.'),

  ('xd_math_sci_004', 'topic_percent_problems', 'topic_sci_investigation', 'mathematics', 'science', 'applies_in', 'strong',
   'Percentages are used for error analysis, efficiency calculations, and data interpretation',
   '["Percent error in measurements", "Efficiency of energy transfer", "Percent composition of mixtures"]',
   'Science experiments provide meaningful context for percent calculations.'),

  ('xd_math_sci_005', 'topic_expressions_variables', 'topic_sci_models', 'mathematics', 'science', 'same_concept', 'essential',
   'Variables and expressions ARE the language of scientific formulas',
   '["F = ma uses variables", "V = IR expresses a relationship", "E = mc² is an expression"]',
   'Scientific formulas are algebraic expressions. Learning algebra IS learning science language.'),

  ('xd_math_sci_006', 'topic_equations_one_step', 'topic_sci_investigation', 'mathematics', 'science', 'applies_in', 'strong',
   'Solving equations is how we find unknown quantities in science',
   '["Given F and a, solve for m", "Given distance and time, solve for speed", "Given voltage and current, solve for resistance"]',
   'Every science formula rearrangement is equation solving practice.'),

  ('xd_math_sci_007', 'topic_exponents', 'topic_sci_models', 'mathematics', 'science', 'applies_in', 'essential',
   'Scientific notation uses exponents. So do growth/decay models in biology.',
   '["10^8 meters", "2^n generations of cells", "Exponential population growth"]',
   'Scientific notation is exponent practice. Population growth models reinforce exponential thinking.'),

  ('xd_math_sci_008', 'topic_stat_variability', 'topic_sci_data', 'mathematics', 'science', 'same_concept', 'essential',
   'Statistical variability in data is the SAME concept whether in math or science class',
   '["Measurement uncertainty", "Standard deviation of trials", "Confidence in conclusions"]',
   'Science experiments are perfect for learning statistics because the context makes it meaningful.');

-- Mathematics <-> Language Arts Connections
INSERT OR IGNORE INTO hyro_cross_domain_connections (id, source_topic_id, target_topic_id, source_domain, target_domain, connection_type, strength, description, examples, learning_opportunities) VALUES
  ('xd_math_ela_001', 'topic_word_problems', 'topic_ela_vocab_context', 'mathematics', 'language_arts', 'supports', 'strong',
   'Word problems require careful reading comprehension',
   '["Key words like per, each, total indicate operations", "Understanding problem structure", "Extracting relevant information"]',
   'Reading skills directly impact word problem success. Practice both together.'),

  ('xd_math_ela_002', 'topic_expressions_writing', 'topic_ela_writing_clarity', 'mathematics', 'language_arts', 'analogy', 'moderate',
   'Writing clear expressions is like writing clear sentences - precision matters',
   '["Order of operations parallels sentence structure", "Parentheses are like clauses", "Variables are like pronouns"]',
   'Mathematical precision reinforces clear writing. Unclear math = unclear thinking.'),

  ('xd_math_ela_003', 'topic_word_problems', 'topic_ela_text_structure', 'mathematics', 'language_arts', 'applies_in', 'strong',
   'Understanding text structure helps decode word problem structure',
   '["Problem setup (given info)", "Question (what to find)", "Answer structure (showing work)"]',
   'Analyzing word problems IS text analysis. The skills transfer both ways.');

-- Mathematics <-> Critical Thinking Connections
INSERT OR IGNORE INTO hyro_cross_domain_connections (id, source_topic_id, target_topic_id, source_domain, target_domain, connection_type, strength, description, examples, learning_opportunities) VALUES
  ('xd_math_ct_001', 'topic_equations_reasoning', 'topic_ct_logical_reasoning', 'mathematics', 'critical_thinking', 'same_concept', 'essential',
   'Mathematical proof and logical reasoning are the SAME skill',
   '["If-then reasoning in proofs", "Valid steps follow from premises", "Counterexamples disprove claims"]',
   'Math proofs ARE logical reasoning. Every proof is logic practice.'),

  ('xd_math_ct_002', 'topic_number_sense_division', 'topic_ct_pattern_recognition', 'mathematics', 'critical_thinking', 'supports', 'strong',
   'Number sense develops pattern recognition abilities',
   '["Divisibility patterns", "Recognizing number relationships", "Mental math strategies"]',
   'Developing number sense builds general pattern recognition skills.'),

  ('xd_math_ct_003', 'topic_stat_variability', 'topic_ct_evidence_evaluation', 'mathematics', 'critical_thinking', 'supports', 'essential',
   'Understanding statistics is essential for evaluating evidence claims',
   '["Sample size matters", "Correlation vs causation", "Statistical significance"]',
   'Statistical literacy is critical thinking literacy. They are inseparable.');

-- Science <-> Language Arts Connections
INSERT OR IGNORE INTO hyro_cross_domain_connections (id, source_topic_id, target_topic_id, source_domain, target_domain, connection_type, strength, description, examples, learning_opportunities) VALUES
  ('xd_sci_ela_001', 'topic_sci_investigation', 'topic_ela_informational', 'science', 'language_arts', 'supports', 'strong',
   'Scientific papers are informational texts. Reading science = reading practice.',
   '["Abstract as summary", "Methods section structure", "Results interpretation"]',
   'Scientific literature is rich informational text for reading practice.'),

  ('xd_sci_ela_002', 'topic_sci_argument', 'topic_ela_argument_claims', 'science', 'language_arts', 'same_concept', 'essential',
   'Scientific argumentation uses the SAME structure as persuasive writing',
   '["Claims supported by evidence", "Acknowledging limitations", "Addressing counterarguments"]',
   'Science arguments and ELA arguments follow identical structures.'),

  ('xd_sci_ela_003', 'topic_sci_models', 'topic_ela_writing_clarity', 'science', 'language_arts', 'supports', 'moderate',
   'Explaining scientific models requires clear, precise writing',
   '["Defining terms precisely", "Sequential explanation", "Using analogies effectively"]',
   'Science writing demands clarity. It is excellent writing practice.');

-- Science <-> Critical Thinking Connections
INSERT OR IGNORE INTO hyro_cross_domain_connections (id, source_topic_id, target_topic_id, source_domain, target_domain, connection_type, strength, description, examples, learning_opportunities) VALUES
  ('xd_sci_ct_001', 'topic_sci_investigation', 'topic_ct_hypothesis_testing', 'science', 'critical_thinking', 'same_concept', 'essential',
   'The scientific method IS systematic hypothesis testing',
   '["Formulating testable predictions", "Designing fair tests", "Revising based on evidence"]',
   'Science IS critical thinking applied to the natural world.'),

  ('xd_sci_ct_002', 'topic_sci_argument', 'topic_ct_evidence_evaluation', 'science', 'critical_thinking', 'same_concept', 'essential',
   'Evaluating scientific claims uses the same skills as general evidence evaluation',
   '["Source reliability", "Sample quality", "Replication and peer review"]',
   'Science provides endless practice in evidence evaluation.'),

  ('xd_sci_ct_003', 'topic_sci_data', 'topic_ct_pattern_recognition', 'science', 'critical_thinking', 'supports', 'strong',
   'Finding patterns in data is pattern recognition applied',
   '["Trends in graphs", "Correlations in data sets", "Anomaly detection"]',
   'Scientific data analysis develops general pattern recognition.');

-- LLM Communications <-> Critical Thinking Connections
INSERT OR IGNORE INTO hyro_cross_domain_connections (id, source_topic_id, target_topic_id, source_domain, target_domain, connection_type, strength, description, examples, learning_opportunities) VALUES
  ('xd_llm_ct_001', 'topic_llm_assumptions', 'topic_ct_assumption_identification', 'llm_communications', 'critical_thinking', 'same_concept', 'essential',
   'Identifying assumptions in AI prompts uses the same skill as general assumption identification',
   '["Hidden premises in questions", "Unstated constraints", "Implicit goals"]',
   'AI dialogue surfaces assumptions. Use it as a tool for assumption practice.'),

  ('xd_llm_ct_002', 'topic_llm_bias_awareness', 'topic_ct_bias_detection', 'llm_communications', 'critical_thinking', 'same_concept', 'essential',
   'Recognizing AI bias is the same skill as recognizing bias in any source',
   '["Training data bias", "Presentation bias", "Confirmation bias in interpretation"]',
   'AI outputs provide a safe space to practice bias detection.'),

  ('xd_llm_ct_003', 'topic_llm_evaluating', 'topic_ct_evidence_evaluation', 'llm_communications', 'critical_thinking', 'same_concept', 'strong',
   'Evaluating AI output quality applies general evidence evaluation skills',
   '["Is it accurate?", "Is it complete?", "Does it address the question?"]',
   'Every AI response is evidence that can be evaluated critically.'),

  ('xd_llm_ct_004', 'topic_llm_hallucination', 'topic_ct_source_reliability', 'llm_communications', 'critical_thinking', 'supports', 'essential',
   'Understanding AI hallucination teaches source reliability skepticism',
   '["Confident but wrong", "Plausible but fabricated", "Verify before trust"]',
   'AI hallucination awareness builds healthy skepticism of all sources.');

-- LLM Communications <-> Language Arts Connections
INSERT OR IGNORE INTO hyro_cross_domain_connections (id, source_topic_id, target_topic_id, source_domain, target_domain, connection_type, strength, description, examples, learning_opportunities) VALUES
  ('xd_llm_ela_001', 'topic_llm_idea_capture', 'topic_ela_writing_clarity', 'llm_communications', 'language_arts', 'same_concept', 'essential',
   'Articulating ideas to AI requires the same clarity as good writing',
   '["Clear thesis", "Logical organization", "Precise word choice"]',
   'Writing good prompts IS writing clearly. AI provides instant feedback on clarity.'),

  ('xd_llm_ela_002', 'topic_llm_clarity_check', 'topic_ela_writing_revision', 'llm_communications', 'language_arts', 'supports', 'strong',
   'Using AI misunderstanding as feedback parallels the revision process',
   '["If AI misunderstands, revise for clarity", "Iterate toward precision", "Reader feedback improves writing"]',
   'AI as reader provides instant revision feedback.'),

  ('xd_llm_ela_003', 'topic_llm_context_setting', 'topic_ela_text_structure', 'llm_communications', 'language_arts', 'analogy', 'moderate',
   'Providing context in prompts parallels providing background in writing',
   '["Setting the scene", "Establishing shared knowledge", "Building reader understanding"]',
   'Context in prompts mirrors good writing structure.');

-- LLM Communications <-> Mathematics Connections
INSERT OR IGNORE INTO hyro_cross_domain_connections (id, source_topic_id, target_topic_id, source_domain, target_domain, connection_type, strength, description, examples, learning_opportunities) VALUES
  ('xd_llm_math_001', 'topic_llm_probability', 'topic_stat_probability', 'llm_communications', 'mathematics', 'same_concept', 'essential',
   'Understanding AI probability IS understanding probability math',
   '["Token probability distributions", "Why likely isnt certain", "Probability sampling"]',
   'AI probability concepts reinforce mathematical probability understanding.'),

  ('xd_llm_math_002', 'topic_llm_embeddings', 'topic_graphing_coordinates', 'llm_communications', 'mathematics', 'analogy', 'moderate',
   'Word embeddings are vectors in high-dimensional space - like coordinates',
   '["Words as points in space", "Distance = similarity", "Dimensions capture meaning"]',
   'Embeddings extend coordinate thinking to many dimensions.');

-- Meta-Learning <-> All Domains Connections
INSERT OR IGNORE INTO hyro_cross_domain_connections (id, source_topic_id, target_topic_id, source_domain, target_domain, connection_type, strength, description, examples, learning_opportunities) VALUES
  ('xd_ml_math_001', 'topic_ml_deliberate', 'topic_math_practice', 'llm_communications', 'mathematics', 'applies_in', 'essential',
   'Deliberate practice principles apply directly to math skill building',
   '["Focus on weak areas", "Get immediate feedback", "Push beyond comfort zone"]',
   'Math practice should follow deliberate practice principles for maximum growth.'),

  ('xd_ml_sci_001', 'topic_ml_failure', 'topic_sci_investigation', 'llm_communications', 'science', 'supports', 'strong',
   'Scientific experiments often fail - failure is information, not defeat',
   '["Failed experiments reveal what doesnt work", "Iteration toward truth", "Famous scientific failures that led to discovery"]',
   'Science normalizes productive failure. Use it to build failure tolerance.'),

  ('xd_ml_ct_001', 'topic_ml_chunking', 'topic_ct_pattern_recognition', 'llm_communications', 'critical_thinking', 'same_concept', 'strong',
   'Chunking IS pattern recognition - building reusable mental patterns',
   '["Recognizing problem types", "Building mental libraries", "Expert perception"]',
   'Chunking and pattern recognition develop together across all domains.');

-- ============================================================================
-- CONCEPT CLUSTERS - Big Ideas That Span Domains
-- ============================================================================

INSERT OR IGNORE INTO hyro_concept_clusters (id, name, description, big_idea, domains_involved, topic_ids, mastery_synergy) VALUES
  ('cluster_proportion', 'Proportional Relationships',
   'The concept of proportion appears everywhere - ratios, rates, scaling, similarity',
   'Things can relate to each other in consistent ways, and these relationships let us predict and understand.',
   '["mathematics", "science", "social_studies"]',
   '["topic_ratios_intro", "topic_unit_rates", "topic_proportional_graphs", "topic_sci_models"]',
   'Understanding proportion in one domain immediately transfers to others. Master it in math, apply it everywhere.'),

  ('cluster_evidence', 'Evidence-Based Reasoning',
   'Using evidence to support claims is fundamental to science, writing, and critical thinking',
   'Claims without evidence are just opinions. Evidence quality determines conclusion reliability.',
   '["science", "language_arts", "critical_thinking", "llm_communications"]',
   '["topic_sci_argument", "topic_ela_argument_claims", "topic_ct_evidence_evaluation", "topic_llm_evaluating"]',
   'Evidence evaluation is ONE skill that applies across all domains. Practice in any strengthens all.'),

  ('cluster_patterns', 'Pattern Recognition',
   'Finding and using patterns is central to math, science, and expert thinking',
   'The universe has regularities. Finding them gives you power to predict and understand.',
   '["mathematics", "science", "critical_thinking", "llm_communications"]',
   '["topic_number_sense", "topic_sci_data", "topic_ct_pattern_recognition", "topic_ml_chunking"]',
   'Pattern recognition is THE core cognitive skill. Every domain trains it differently.'),

  ('cluster_models', 'Mental Models',
   'Building and refining mental models is how we understand complex systems',
   'Reality is complex. Simple models that capture the essential help us think and communicate.',
   '["science", "mathematics", "llm_communications", "critical_thinking"]',
   '["topic_sci_models", "topic_expressions_variables", "topic_llm_vision_correction", "topic_ct_logical_reasoning"]',
   'Better mental models = better thinking. Each domain adds different model-building tools.'),

  ('cluster_communication', 'Clear Communication',
   'Expressing ideas clearly is essential in every domain',
   'If you cant explain it clearly, you dont understand it well enough yet.',
   '["language_arts", "llm_communications", "mathematics", "science"]',
   '["topic_ela_writing_clarity", "topic_llm_idea_capture", "topic_equations_writing", "topic_sci_argument"]',
   'Clarity in one domain develops clarity in all. AI provides instant feedback on clarity.'),

  ('cluster_learning', 'Learning to Learn',
   'Meta-learning skills accelerate all other learning',
   'The rate at which you learn is more important than what you currently know.',
   '["llm_communications", "critical_thinking"]',
   '["topic_ml_memory", "topic_ml_recall", "topic_ml_deliberate", "topic_ml_rapid", "topic_ml_ai_partner"]',
   'These are force multipliers. Improving learning ability improves EVERYTHING else.'),

  ('cluster_data', 'Data Literacy',
   'Understanding, analyzing, and interpreting data spans math and science',
   'Data is everywhere. Those who can read it understand the world better.',
   '["mathematics", "science", "critical_thinking"]',
   '["topic_stat_variability", "topic_sci_data", "topic_ct_evidence_evaluation", "topic_graphing_coordinates"]',
   'Data literacy is a single skill expressed in multiple domains. Master once, use everywhere.');

-- ============================================================================
-- CONNECTION STRENGTH WEIGHTS FOR ZPD ENGINE
-- When a topic is mastered, connected topics get a boost
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_connection_weights (
  id TEXT PRIMARY KEY,
  connection_type TEXT NOT NULL,
  mastery_boost REAL DEFAULT 0.1,  -- How much to boost connected topic readiness when source is mastered
  description TEXT
);

INSERT OR IGNORE INTO hyro_connection_weights (id, connection_type, mastery_boost, description) VALUES
  ('weight_same_concept', 'same_concept', 0.3, 'Same concept in different context - high transfer'),
  ('weight_applies_in', 'applies_in', 0.2, 'Direct application - moderate transfer'),
  ('weight_supports', 'supports', 0.15, 'Supporting skill - some transfer'),
  ('weight_analogy', 'analogy', 0.1, 'Analogous structure - conceptual transfer'),
  ('weight_prerequisite', 'prerequisite_for', 0.25, 'Direct prerequisite - high transfer');
