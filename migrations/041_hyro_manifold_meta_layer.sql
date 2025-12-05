-- ============================================================================
-- HYRO MANIFOLD: Meta-Generative Assessment Layer
-- Migration 041: State vectors, meta dimensions, and v2 diagnostic schema
-- Created: 2025-12-04
--
-- Implements the GTC (Generative Transfer Capacity) framework:
-- - 3D State Vectors per domain: Coherence (C), Entropy (E), Generativity (G)
-- - 7 Meta-Generative Dimensions (cross-cutting capabilities)
-- - Enhanced diagnostic items with multi-modal support
-- - LLM-evaluated response schema
-- ============================================================================

-- ============================================================================
-- STATE VECTORS TABLE
-- Per-domain 3D position in the Coherence × Entropy × Generativity manifold
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_state_vectors (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  stat_name TEXT NOT NULL,           -- math, reading, science, etc.

  -- 3D State Vector (0-100 scale)
  coherence REAL NOT NULL DEFAULT 50,      -- Internal consistency of knowledge
  entropy REAL NOT NULL DEFAULT 50,        -- Ability to handle uncertainty/novelty
  generativity REAL NOT NULL DEFAULT 50,   -- Capacity for novel value creation

  -- Sub-components (JSON) for explainability
  components_json TEXT NOT NULL DEFAULT '{}',
  -- Example: {
  --   "coherence": {"accuracy": 0.85, "consistency": 0.90, "integration": 0.78},
  --   "entropy": {"uncertainty_handling": 0.70, "novelty_response": 0.65},
  --   "generativity": {"transfer": 0.60, "synthesis": 0.55, "utility": 0.70}
  -- }

  -- Confidence intervals
  ci_low REAL NOT NULL DEFAULT 0,          -- Lower bound of confidence interval
  ci_high REAL NOT NULL DEFAULT 100,       -- Upper bound (starts wide)

  -- Assessment metadata
  n_items_used INTEGER NOT NULL DEFAULT 0,
  signal_agreement REAL,                   -- Cross-signal consistency (0-1)
  last_item_id TEXT,                       -- Most recent diagnostic item

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(student_id, stat_name)
);

CREATE INDEX IF NOT EXISTS idx_state_vectors_student ON hyro_state_vectors(student_id);
CREATE INDEX IF NOT EXISTS idx_state_vectors_stat ON hyro_state_vectors(stat_name);

-- ============================================================================
-- META-GENERATIVE DIMENSIONS TABLE
-- 7 cross-cutting capabilities invisible to standard subject tests
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_meta_dimension_estimates (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  dimension_name TEXT NOT NULL,
  -- Dimensions:
  --   manifold_fluidity     - Navigation across conceptual spaces
  --   multi_model_coherence - Synthesis across multiple mental models
  --   identity_elasticity   - Comfort with epistemic humility
  --   gradient_awareness    - Recognition of own learning velocity
  --   entropy_intuition     - Sense for when structure helps vs. hinders
  --   non_dual_resolution   - Holding paradox without collapsing
  --   cooperative_generativity - Co-creation with other intelligences

  score REAL NOT NULL DEFAULT 50,          -- 0-100 scale
  ci_low REAL NOT NULL DEFAULT 0,
  ci_high REAL NOT NULL DEFAULT 100,

  -- Evidence trail
  evidence_json TEXT,
  -- Example: {
  --   "probe_ids": ["probe_fs_01", "probe_ec_02"],
  --   "observations": ["Strong frame-shift on geometry->music analogy"],
  --   "quotes": ["I noticed the pattern might not hold if..."]
  -- }

  n_observations INTEGER DEFAULT 0,
  confidence_level TEXT DEFAULT 'low',     -- low, medium, high

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(student_id, dimension_name)
);

CREATE INDEX IF NOT EXISTS idx_meta_dimensions_student ON hyro_meta_dimension_estimates(student_id);
CREATE INDEX IF NOT EXISTS idx_meta_dimensions_dimension ON hyro_meta_dimension_estimates(dimension_name);

-- ============================================================================
-- DIAGNOSTIC ITEMS V2
-- Enhanced schema with multi-modal support and construct mapping
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_diagnostic_items_v2 (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,                 -- Primary stat measured

  -- Item metadata
  item_type TEXT NOT NULL,                 -- mcq, short_answer, extended_response, image_analysis, code_problem
  modality TEXT DEFAULT 'text',            -- text, image, diagram, code, audio, mixed
  difficulty REAL DEFAULT 0.5,             -- IRT difficulty parameter (calibrated)
  discrimination REAL DEFAULT 1.0,         -- IRT discrimination (slope)

  -- Construct mapping (what this item actually measures)
  constructs_measured TEXT NOT NULL,       -- JSON array
  -- Example: ["factual_recall", "procedural_application", "transfer"]

  -- Content
  prompt TEXT NOT NULL,
  prompt_media_url TEXT,                   -- For image/diagram/audio items
  options TEXT,                            -- JSON for MCQ options
  correct_answer TEXT,                     -- For MCQ/short_answer
  scoring_rubric TEXT,                     -- JSON rubric for extended responses

  -- Meta probe mapping (if this item feeds meta dimensions)
  meta_probe_type TEXT,                    -- frame_shift, entropy_compression, non_dual_synthesis
  target_meta_dimensions TEXT,             -- JSON array of meta dimension names

  -- Calibration data
  n_responses INTEGER DEFAULT 0,
  p_value REAL,                            -- Empirical difficulty
  avg_time_seconds REAL,

  is_active INTEGER DEFAULT 1,
  grade_level_min INTEGER,
  grade_level_max INTEGER,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_diag_v2_stat ON hyro_diagnostic_items_v2(stat_name);
CREATE INDEX IF NOT EXISTS idx_diag_v2_type ON hyro_diagnostic_items_v2(item_type);
CREATE INDEX IF NOT EXISTS idx_diag_v2_modality ON hyro_diagnostic_items_v2(modality);
CREATE INDEX IF NOT EXISTS idx_diag_v2_meta ON hyro_diagnostic_items_v2(meta_probe_type);

-- ============================================================================
-- DIAGNOSTIC RESPONSES V2
-- Enhanced with multi-signal capture and LLM evaluation
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_diagnostic_responses_v2 (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  item_id TEXT NOT NULL,

  -- Student response
  response_text TEXT,
  response_option_id TEXT,                 -- For MCQ
  response_media_url TEXT,                 -- For drawing/code submissions

  -- Timing signals
  time_to_first_action_ms INTEGER,
  total_time_ms INTEGER,
  pause_pattern TEXT,                      -- JSON of pause timestamps
  revision_count INTEGER DEFAULT 0,

  -- Self-report signals
  confidence_self_report REAL,             -- 0-100, student's stated confidence
  difficulty_perception REAL,              -- 0-100, how hard did they find it

  -- MCQ correctness (for backward compatibility)
  is_correct INTEGER,

  -- LLM Evaluation (structured JSON matching spec)
  llm_evaluation TEXT,
  -- Schema: {
  --   "item_id": "...",
  --   "scores": {
  --     "validity": 0-1,        -- Is answer valid/relevant
  --     "coherence": 0-1,       -- Internal logical consistency
  --     "transfer": 0-1,        -- Evidence of applying knowledge
  --     "utility": 0-1,         -- Would this be useful in practice
  --     "efficiency": 0-1       -- Parsimony of explanation
  --   },
  --   "meta": {
  --     "manifold_fluidity": 0-1,
  --     "multi_model_coherence": 0-1,
  --     "identity_elasticity": 0-1,
  --     "gradient_awareness": 0-1,
  --     "entropy_intuition": 0-1,
  --     "non_dual_resolution": 0-1,
  --     "cooperative_generativity": 0-1
  --   },
  --   "confidence": {
  --     "overall": 0-1,
  --     "low_evidence_dims": ["..."]
  --   },
  --   "evidence": {
  --     "quotes": ["..."],
  --     "observations": ["..."]
  --   },
  --   "flags": {
  --     "overconfident": bool,
  --     "handwavy": bool,
  --     "style_over_substance_risk": bool
  --   }
  -- }

  llm_model_used TEXT,                     -- opus-4-5, gemini-2.0-flash, etc.
  llm_raw_response TEXT,                   -- Full LLM response for audit

  -- Aggregated scores (denormalized for query efficiency)
  score_validity REAL,
  score_coherence REAL,
  score_transfer REAL,
  score_utility REAL,
  score_efficiency REAL,

  -- Meta dimension signals
  meta_manifold_fluidity REAL,
  meta_multi_model_coherence REAL,
  meta_identity_elasticity REAL,
  meta_gradient_awareness REAL,
  meta_entropy_intuition REAL,
  meta_non_dual_resolution REAL,
  meta_cooperative_generativity REAL,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_resp_v2_session ON hyro_diagnostic_responses_v2(session_id);
CREATE INDEX IF NOT EXISTS idx_resp_v2_student ON hyro_diagnostic_responses_v2(student_id);
CREATE INDEX IF NOT EXISTS idx_resp_v2_item ON hyro_diagnostic_responses_v2(item_id);

-- ============================================================================
-- DIAGNOSTIC SESSIONS V2
-- Session-level tracking with stopping criteria
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_diagnostic_sessions_v2 (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  stat_name TEXT,                          -- NULL for meta-only sessions
  session_type TEXT DEFAULT 'domain',      -- domain, meta, full

  -- Session state
  status TEXT DEFAULT 'active',            -- active, paused, completed, expired
  current_item_index INTEGER DEFAULT 0,

  -- Stopping criteria tracking
  information_gain_rate REAL,              -- Moving average of info gain per item
  ci_width REAL,                           -- Current confidence interval width
  items_since_last_update INTEGER,         -- Items since last significant CI change

  -- Thresholds (can be customized per session)
  target_ci_width REAL DEFAULT 15,         -- Stop when CI < this
  min_items INTEGER DEFAULT 3,
  max_items INTEGER DEFAULT 12,
  info_gain_floor REAL DEFAULT 0.02,       -- Stop if gain/item drops below

  -- State snapshot at completion
  final_state_vector TEXT,                 -- JSON of final CEG values
  final_meta_estimates TEXT,               -- JSON of meta dimension estimates

  started_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER,
  expires_at INTEGER                       -- Optional session timeout
);

CREATE INDEX IF NOT EXISTS idx_sess_v2_student ON hyro_diagnostic_sessions_v2(student_id);
CREATE INDEX IF NOT EXISTS idx_sess_v2_stat ON hyro_diagnostic_sessions_v2(stat_name);
CREATE INDEX IF NOT EXISTS idx_sess_v2_status ON hyro_diagnostic_sessions_v2(status);

-- ============================================================================
-- META PROBE ITEMS
-- Dedicated probes for meta-generative dimensions
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_meta_probes (
  id TEXT PRIMARY KEY,
  probe_type TEXT NOT NULL,                -- frame_shift, entropy_compression, non_dual_synthesis
  title TEXT NOT NULL,
  description TEXT,

  -- Content
  prompt TEXT NOT NULL,
  prompt_media_url TEXT,
  context_domains TEXT,                    -- JSON array of domains used

  -- Evaluation criteria
  target_dimensions TEXT NOT NULL,         -- JSON array of meta dimensions targeted
  scoring_guidance TEXT,                   -- Instructions for LLM evaluator
  exemplar_responses TEXT,                 -- JSON with high/medium/low examples

  -- Calibration
  difficulty REAL DEFAULT 0.5,
  n_administrations INTEGER DEFAULT 0,
  avg_time_seconds REAL,

  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_meta_probes_type ON hyro_meta_probes(probe_type);

-- ============================================================================
-- SEED META PROBES
-- The three core probe types from the manifold specification
-- ============================================================================

-- Frame Shift Triad Probes
INSERT OR IGNORE INTO hyro_meta_probes (id, probe_type, title, description, prompt, context_domains, target_dimensions, scoring_guidance) VALUES
(
  'probe_fs_01',
  'frame_shift',
  'Pattern Bridge',
  'Tests ability to recognize deep structural similarities across domains',
  'Consider the Pythagorean theorem (a² + b² = c²) and the relationship between musical harmony intervals. Both involve specific numerical relationships that create "completeness" or "resolution."

Explore this connection:
1. What patterns do you notice in how both work?
2. Can you think of another domain where similar patterns appear?
3. What might this tell us about how the universe organizes itself?

Take your time. There are no wrong answers—I am curious how you think about this.',
  '["math", "music", "philosophy"]',
  '["manifold_fluidity", "multi_model_coherence"]',
  'Look for:
- Genuine insight vs. surface-level analogy
- Ability to articulate the structural connection
- Generation of novel third example
- Comfort with uncertainty in speculative thinking
- Meta-awareness of own reasoning process'
),
(
  'probe_fs_02',
  'frame_shift',
  'Scale Shift',
  'Tests ability to apply patterns across different scales',
  'Cells in your body work together, each doing its own job, but somehow creating you—a conscious being who can think about cells.

Similarly, individual ants in a colony follow simple rules, but the colony as a whole solves complex problems no single ant could solve.

Questions to explore:
1. What do these have in common?
2. Can you think of this pattern at a much larger scale (like planets or galaxies)?
3. What about at a smaller scale (atoms)?
4. Do you think there could be something "above" humans that we are parts of, the way cells are parts of us?',
  '["biology", "systems_thinking", "philosophy"]',
  '["manifold_fluidity", "entropy_intuition", "multi_model_coherence"]',
  'Evaluate:
- Recognition of emergence as a pattern
- Ability to extrapolate across scales
- Comfort with nested complexity
- Creative thinking about meta-levels
- Epistemic humility about limits of analogy'
);

-- Entropy Compression Probes
INSERT OR IGNORE INTO hyro_meta_probes (id, probe_type, title, description, prompt, context_domains, target_dimensions, scoring_guidance) VALUES
(
  'probe_ec_01',
  'entropy_compression',
  'Signal in Noise',
  'Tests ability to find structure in apparent chaos',
  'Here is a list of numbers that seem random but actually follow a hidden pattern:

2, 3, 5, 9, 17, 33, ...

Also consider these letters: O, T, T, F, F, S, S, E, N, T

And these words: Fly, Spider, Bird, Cat, Dog, Cow, Horse

Questions:
1. Can you find what pattern each sequence follows?
2. What strategy did you use to look for patterns?
3. Which was hardest? Why?
4. Create your own "hidden pattern" sequence that would be fun for a friend to solve.',
  '["math", "logic", "metacognition"]',
  '["entropy_intuition", "gradient_awareness"]',
  'Assess:
- Pattern recognition accuracy
- Meta-awareness of own problem-solving strategy
- Ability to articulate reasoning process
- Creativity in generating own pattern
- Calibration between difficulty and own ability'
),
(
  'probe_ec_02',
  'entropy_compression',
  'Useful Simplification',
  'Tests ability to distill complexity without losing meaning',
  'Read this passage carefully:

"The mitochondria, often called the powerhouse of the cell, convert glucose and oxygen into ATP through a complex process involving the electron transport chain, the citric acid cycle, and glycolysis. This ATP provides the energy for virtually all cellular processes, from muscle contraction to nerve signal transmission."

Now:
1. Explain this to a 5-year-old in 2-3 sentences.
2. Explain it to a fellow student your age in 2-3 sentences.
3. What did you have to leave out for the 5-year-old? Why?
4. What is the MOST important thing to understand about this topic?',
  '["biology", "communication", "metacognition"]',
  '["entropy_intuition", "multi_model_coherence", "cooperative_generativity"]',
  'Evaluate:
- Accuracy of simplified explanations
- Appropriate calibration for different audiences
- Meta-awareness of what was lost/preserved
- Identification of core concept vs. details
- Communication adaptability'
);

-- Non-dual Synthesis Probes
INSERT OR IGNORE INTO hyro_meta_probes (id, probe_type, title, description, prompt, context_domains, target_dimensions, scoring_guidance) VALUES
(
  'probe_nd_01',
  'non_dual_synthesis',
  'Both True',
  'Tests ability to hold paradox without forcing resolution',
  'Consider these pairs of statements. Both sides seem true, yet they seem to contradict:

A) "Practice makes perfect" vs. "If you need to practice too much, maybe it is not your natural talent"

B) "Be yourself" vs. "Always be learning and growing into someone new"

C) "Light is a wave" vs. "Light is a particle"

For each pair:
1. How can both be true at the same time?
2. Is it possible the contradiction itself teaches us something?
3. Can you think of a situation where holding both ideas (without choosing one) would be more useful than picking a side?',
  '["philosophy", "physics", "psychology"]',
  '["non_dual_resolution", "identity_elasticity", "manifold_fluidity"]',
  'Look for:
- Comfort with ambiguity (not rushing to resolve)
- Recognition of context-dependence
- Ability to synthesize without erasing tension
- Meta-awareness that paradox can be generative
- Creative examples of productive paradox-holding'
),
(
  'probe_nd_02',
  'non_dual_synthesis',
  'Observer and Observed',
  'Tests ability to recognize self-referential loops',
  'Here is a strange fact: Right now, your brain is trying to understand how your brain works. The thing doing the understanding IS the thing being understood.

Similarly:
- When you decide to "be more spontaneous," are you being spontaneous or planned?
- If you try to not think about something, you have to think about it to know what not to think about.

Questions:
1. Does it feel weird to think about your brain thinking? Why or why not?
2. Can you think of other examples where the observer and the thing being observed are the same?
3. Do you think there are limits to how well we can understand ourselves? Why?
4. Is there a way to "step outside" the loop, or are we always inside it?',
  '["philosophy", "neuroscience", "metacognition"]',
  '["non_dual_resolution", "identity_elasticity", "gradient_awareness"]',
  'Assess:
- Comfort with self-referential concepts
- Recognition of strange loops
- Epistemic humility about self-knowledge limits
- Creative engagement with the paradox
- Avoidance of false resolution or dismissal'
);

-- ============================================================================
-- SEED INITIAL META DIMENSIONS FOR STUDENTS
-- ============================================================================
-- Note: This will be populated per-student on first assessment

-- ============================================================================
-- EVALUATION CRITERIA TABLE
-- Stores rubrics for LLM evaluators
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_evaluation_criteria (
  id TEXT PRIMARY KEY,
  dimension_name TEXT NOT NULL,
  criteria_type TEXT NOT NULL,             -- score_component, meta_dimension, flag
  name TEXT NOT NULL,
  description TEXT,
  scoring_anchors TEXT,                    -- JSON with 0.0, 0.5, 1.0 descriptions
  weight REAL DEFAULT 1.0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Seed core scoring criteria
INSERT OR IGNORE INTO hyro_evaluation_criteria (id, dimension_name, criteria_type, name, description, scoring_anchors, weight) VALUES
-- Core scores
('crit_validity', 'core', 'score_component', 'validity', 'Is the response valid and relevant to the prompt?',
 '{"0.0": "Completely off-topic or nonsensical", "0.5": "Partially addresses the prompt", "1.0": "Fully addresses all aspects of the prompt"}', 1.0),
('crit_coherence', 'core', 'score_component', 'coherence', 'Does the response have internal logical consistency?',
 '{"0.0": "Self-contradictory or logically confused", "0.5": "Mostly consistent with minor gaps", "1.0": "Fully coherent with clear logical flow"}', 1.0),
('crit_transfer', 'core', 'score_component', 'transfer', 'Does the response show application beyond rote recall?',
 '{"0.0": "Pure memorization/regurgitation", "0.5": "Some application to new context", "1.0": "Creative transfer to novel situations"}', 1.0),
('crit_utility', 'core', 'score_component', 'utility', 'Would this response be useful in practice?',
 '{"0.0": "No practical value", "0.5": "Somewhat useful with caveats", "1.0": "Immediately actionable and valuable"}', 1.0),
('crit_efficiency', 'core', 'score_component', 'efficiency', 'Is the explanation appropriately concise?',
 '{"0.0": "Extremely verbose or incomplete", "0.5": "Adequate but could be tighter", "1.0": "Optimal balance of completeness and concision"}', 0.8),

-- Meta dimensions
('crit_manifold', 'meta', 'meta_dimension', 'manifold_fluidity', 'Navigation across conceptual spaces',
 '{"0.0": "Stuck in single frame", "0.5": "Can shift with prompting", "1.0": "Naturally flows between domains"}', 1.0),
('crit_multimodel', 'meta', 'meta_dimension', 'multi_model_coherence', 'Synthesis across multiple mental models',
 '{"0.0": "Uses single model only", "0.5": "Acknowledges multiple models", "1.0": "Integrates models into unified understanding"}', 1.0),
('crit_identity', 'meta', 'meta_dimension', 'identity_elasticity', 'Comfort with epistemic humility',
 '{"0.0": "Rigid certainty about knowledge", "0.5": "Can acknowledge uncertainty when prompted", "1.0": "Natural epistemic humility and openness"}', 1.0),
('crit_gradient', 'meta', 'meta_dimension', 'gradient_awareness', 'Recognition of own learning velocity',
 '{"0.0": "No metacognitive awareness", "0.5": "Some self-awareness of learning", "1.0": "Clear sense of own growth trajectory"}', 1.0),
('crit_entropy', 'meta', 'meta_dimension', 'entropy_intuition', 'Sense for when structure helps vs. hinders',
 '{"0.0": "Rigidly structured or chaotic", "0.5": "Some flexibility", "1.0": "Intuitively matches structure to need"}', 1.0),
('crit_nondual', 'meta', 'meta_dimension', 'non_dual_resolution', 'Holding paradox without collapsing',
 '{"0.0": "Forces binary resolution", "0.5": "Tolerates ambiguity briefly", "1.0": "Productively holds tension of paradox"}', 1.0),
('crit_coop', 'meta', 'meta_dimension', 'cooperative_generativity', 'Co-creation with other intelligences',
 '{"0.0": "Isolated thinking", "0.5": "Responsive to input", "1.0": "Builds on others ideas generatively"}', 1.0),

-- Flags
('crit_flag_overconf', 'flag', 'flag', 'overconfident', 'Confidence exceeds demonstrated competence',
 '{"true": "States certainty without evidence", "false": "Confidence calibrated to evidence"}', 1.0),
('crit_flag_handwavy', 'flag', 'flag', 'handwavy', 'Vague language masking lack of understanding',
 '{"true": "Uses jargon without substance", "false": "Precise language matching understanding"}', 1.0),
('crit_flag_style', 'flag', 'flag', 'style_over_substance_risk', 'Impressive presentation hiding weak content',
 '{"true": "Form dominates substance", "false": "Substance matches presentation"}', 1.0);

-- ============================================================================
-- Record migration (commented out - no migrations table in this schema)
-- ============================================================================
-- INSERT INTO migrations (name) VALUES ('041_hyro_manifold_meta_layer');
