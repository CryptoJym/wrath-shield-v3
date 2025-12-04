-- HYRO FORGE: Critical Thinking Curriculum
-- Migration 029: The Foundation of Capability - Teaching Genuine Reasoning
--
-- PHILOSOPHY: This is NOT about hoop-jumping education. This is about building
-- the actual cognitive tools to evaluate truth claims, reason from first principles,
-- and make sound decisions. Critical thinking is the meta-skill that makes all
-- other learning more effective.
--
-- GOAL: Hyro should be able to:
-- - Identify logical fallacies in political speeches, advertisements, and arguments
-- - Construct valid arguments and evaluate evidence
-- - Reason from fundamental principles rather than accepting received wisdom
-- - Make decisions using quantitative reasoning and probability
-- - Evaluate sources critically and distinguish truth from manipulation
--
-- TIER 1 PRIORITY: This is the foundation. Everything else builds on this.

-- ============================================================================
-- STRAND 1: FORMAL LOGIC (CT.LOG)
-- The mathematics of reasoning
-- ============================================================================

INSERT INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  ('ct_log_1', 'critical_thinking', 'hyro_advanced', 'CT.LOG.1', 'Propositions and Truth Values', 'Understand that propositions are statements that are either true or false. Recognize that questions, commands, and opinions are not propositions.', NULL, 'middle', 'Formal Logic', 'Foundations', 1, 1, 1),
  ('ct_log_2', 'critical_thinking', 'hyro_advanced', 'CT.LOG.2', 'Logical Connectives', 'Understand and apply logical operators: AND (conjunction), OR (disjunction), NOT (negation), IF-THEN (implication), IF AND ONLY IF (biconditional).', NULL, 'middle', 'Formal Logic', 'Foundations', 2, 1, 1),
  ('ct_log_3', 'critical_thinking', 'hyro_advanced', 'CT.LOG.3', 'Truth Tables', 'Construct and interpret truth tables for compound propositions. Use truth tables to determine logical equivalence and validity.', NULL, 'middle', 'Formal Logic', 'Methods', 3, 1, 1),
  ('ct_log_4', 'critical_thinking', 'hyro_advanced', 'CT.LOG.4', 'Valid vs Invalid Arguments', 'Distinguish between valid arguments (where conclusion follows from premises) and invalid arguments. Understand that validity is about structure, not truth.', NULL, 'middle', 'Formal Logic', 'Argument Structure', 4, 1, 1),
  ('ct_log_5', 'critical_thinking', 'hyro_advanced', 'CT.LOG.5', 'Deductive Reasoning', 'Apply deductive reasoning to derive guaranteed conclusions from premises. Understand when deduction is appropriate vs other forms of reasoning.', NULL, 'middle', 'Formal Logic', 'Argument Structure', 5, 1, 1),
  ('ct_log_6', 'critical_thinking', 'hyro_advanced', 'CT.LOG.6', 'Categorical Syllogisms', 'Construct and evaluate categorical syllogisms. Identify valid forms (Barbara, Celarent, etc.) and common errors.', NULL, 'middle', 'Formal Logic', 'Syllogistic Logic', 6, 1, 1),
  ('ct_log_7', 'critical_thinking', 'hyro_advanced', 'CT.LOG.7', 'Conditional Reasoning', 'Understand conditional statements (if P then Q). Distinguish between affirming the antecedent (valid) and affirming the consequent (invalid).', NULL, 'middle', 'Formal Logic', 'Syllogistic Logic', 7, 1, 1),
  ('ct_log_8', 'critical_thinking', 'hyro_advanced', 'CT.LOG.8', 'Logical Equivalence', 'Recognize logically equivalent statements (contrapositive, De Morgans laws). Understand how to transform statements while preserving truth.', NULL, 'middle', 'Formal Logic', 'Advanced Concepts', 8, 1, 1),
  ('ct_log_9', 'critical_thinking', 'hyro_advanced', 'CT.LOG.9', 'Proof Structures', 'Understand basic proof techniques: direct proof, proof by contradiction, proof by cases. Apply these methods to simple arguments.', NULL, 'middle', 'Formal Logic', 'Advanced Concepts', 9, 1, 1),
  ('ct_log_10', 'critical_thinking', 'hyro_advanced', 'CT.LOG.10', 'Quantifiers', 'Understand universal (for all) and existential (there exists) quantifiers. Recognize how quantifiers affect the truth of statements.', NULL, 'middle', 'Formal Logic', 'Advanced Concepts', 10, 1, 1);

-- ============================================================================
-- STRAND 2: INFORMAL LOGIC & FALLACIES (CT.FAL)
-- Recognizing bad arguments in the wild
-- ============================================================================

INSERT INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  ('ct_fal_1', 'critical_thinking', 'hyro_advanced', 'CT.FAL.1', 'Ad Hominem Attacks', 'Identify ad hominem fallacies: attacking the person instead of their argument. Understand why personal attacks dont refute claims.', NULL, 'middle', 'Informal Logic', 'Attack Fallacies', 20, 1, 1),
  ('ct_fal_2', 'critical_thinking', 'hyro_advanced', 'CT.FAL.2', 'Straw Man Arguments', 'Recognize straw man fallacies: misrepresenting an opponents position to make it easier to attack. Distinguish from genuine counterarguments.', NULL, 'middle', 'Informal Logic', 'Attack Fallacies', 21, 1, 1),
  ('ct_fal_3', 'critical_thinking', 'hyro_advanced', 'CT.FAL.3', 'Appeal to Authority', 'Identify inappropriate appeals to authority. Distinguish between legitimate expertise and irrelevant credentials.', NULL, 'middle', 'Informal Logic', 'Appeal Fallacies', 22, 1, 1),
  ('ct_fal_4', 'critical_thinking', 'hyro_advanced', 'CT.FAL.4', 'Appeal to Emotion', 'Recognize when arguments manipulate emotions instead of providing evidence. Understand the difference between emotional appeals and emotional evidence.', NULL, 'middle', 'Informal Logic', 'Appeal Fallacies', 23, 1, 1),
  ('ct_fal_5', 'critical_thinking', 'hyro_advanced', 'CT.FAL.5', 'False Dichotomy', 'Identify false dichotomies: presenting only two options when more exist. Recognize "either/or" thinking that ignores middle ground.', NULL, 'middle', 'Informal Logic', 'Structural Fallacies', 24, 1, 1),
  ('ct_fal_6', 'critical_thinking', 'hyro_advanced', 'CT.FAL.6', 'Slippery Slope', 'Recognize slippery slope fallacies: claiming one event will inevitably lead to extreme consequences without justification.', NULL, 'middle', 'Informal Logic', 'Structural Fallacies', 25, 1, 1),
  ('ct_fal_7', 'critical_thinking', 'hyro_advanced', 'CT.FAL.7', 'Circular Reasoning', 'Identify circular reasoning (begging the question): using the conclusion as a premise. Understand why this fails to provide support.', NULL, 'middle', 'Informal Logic', 'Structural Fallacies', 26, 1, 1),
  ('ct_fal_8', 'critical_thinking', 'hyro_advanced', 'CT.FAL.8', 'Hasty Generalization', 'Recognize hasty generalizations: drawing broad conclusions from insufficient evidence. Understand sample size and representativeness.', NULL, 'middle', 'Informal Logic', 'Evidence Fallacies', 27, 1, 1),
  ('ct_fal_9', 'critical_thinking', 'hyro_advanced', 'CT.FAL.9', 'Correlation vs Causation', 'Distinguish between correlation and causation. Understand that events happening together doesnt mean one caused the other.', NULL, 'middle', 'Informal Logic', 'Evidence Fallacies', 28, 1, 1),
  ('ct_fal_10', 'critical_thinking', 'hyro_advanced', 'CT.FAL.10', 'Red Herring', 'Identify red herrings: introducing irrelevant information to distract from the main argument. Recognize topic-shifting as a diversionary tactic.', NULL, 'middle', 'Informal Logic', 'Distraction Fallacies', 29, 1, 1),
  ('ct_fal_11', 'critical_thinking', 'hyro_advanced', 'CT.FAL.11', 'Appeal to Ignorance', 'Recognize arguments from ignorance: claiming something is true because it hasnt been proven false (or vice versa). Understand burden of proof.', NULL, 'middle', 'Informal Logic', 'Evidence Fallacies', 30, 1, 1),
  ('ct_fal_12', 'critical_thinking', 'hyro_advanced', 'CT.FAL.12', 'Bandwagon Fallacy', 'Identify bandwagon appeals: claiming something is true or right because many people believe it. Understand that popularity doesnt equal truth.', NULL, 'middle', 'Informal Logic', 'Appeal Fallacies', 31, 1, 1);

-- ============================================================================
-- STRAND 3: ARGUMENT ANALYSIS (CT.ARG)
-- Dissecting and evaluating real arguments
-- ============================================================================

INSERT INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  ('ct_arg_1', 'critical_thinking', 'hyro_advanced', 'CT.ARG.1', 'Identifying Claims', 'Extract the main claim (conclusion) from an argument. Distinguish between the central thesis and supporting points.', NULL, 'middle', 'Argument Analysis', 'Argument Structure', 40, 1, 1),
  ('ct_arg_2', 'critical_thinking', 'hyro_advanced', 'CT.ARG.2', 'Finding Premises', 'Identify premises: the reasons offered in support of a conclusion. Map the structure of complex arguments.', NULL, 'middle', 'Argument Analysis', 'Argument Structure', 41, 1, 1),
  ('ct_arg_3', 'critical_thinking', 'hyro_advanced', 'CT.ARG.3', 'Evaluating Evidence Quality', 'Assess the quality of evidence: Is it relevant? Sufficient? Representative? From reliable sources? Recent enough?', NULL, 'middle', 'Argument Analysis', 'Evidence Evaluation', 42, 1, 1),
  ('ct_arg_4', 'critical_thinking', 'hyro_advanced', 'CT.ARG.4', 'Fact vs Opinion', 'Distinguish between factual claims (verifiable), opinions (personal judgments), and reasoned conclusions (supported by evidence).', NULL, 'middle', 'Argument Analysis', 'Evidence Evaluation', 43, 1, 1),
  ('ct_arg_5', 'critical_thinking', 'hyro_advanced', 'CT.ARG.5', 'Identifying Assumptions', 'Recognize unstated assumptions underlying arguments. Question what must be true for the argument to work.', NULL, 'middle', 'Argument Analysis', 'Deep Analysis', 44, 1, 1),
  ('ct_arg_6', 'critical_thinking', 'hyro_advanced', 'CT.ARG.6', 'Hidden Premises', 'Identify implicit premises: unstated assumptions that bridge premises to conclusions. Make the implicit explicit.', NULL, 'middle', 'Argument Analysis', 'Deep Analysis', 45, 1, 1),
  ('ct_arg_7', 'critical_thinking', 'hyro_advanced', 'CT.ARG.7', 'Constructing Counterarguments', 'Build effective counterarguments: challenge premises, provide counterevidence, offer alternative explanations.', NULL, 'middle', 'Argument Analysis', 'Response Skills', 46, 1, 1),
  ('ct_arg_8', 'critical_thinking', 'hyro_advanced', 'CT.ARG.8', 'Steelmanning', 'Practice steelmanning: constructing the strongest possible version of an opposing argument before critiquing it.', NULL, 'middle', 'Argument Analysis', 'Response Skills', 47, 1, 1),
  ('ct_arg_9', 'critical_thinking', 'hyro_advanced', 'CT.ARG.9', 'Argument Strength Assessment', 'Evaluate overall argument strength considering validity, soundness, evidence quality, and potential objections.', NULL, 'middle', 'Argument Analysis', 'Synthesis', 48, 1, 1);

-- ============================================================================
-- STRAND 4: FIRST PRINCIPLES REASONING (CT.FPR)
-- Building understanding from the ground up
-- ============================================================================

INSERT INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  ('ct_fpr_1', 'critical_thinking', 'hyro_advanced', 'CT.FPR.1', 'What Are First Principles?', 'Understand first principles as foundational truths that cannot be deduced from other propositions. Distinguish from assumptions and conventions.', NULL, 'middle', 'First Principles', 'Foundations', 60, 1, 1),
  ('ct_fpr_2', 'critical_thinking', 'hyro_advanced', 'CT.FPR.2', 'Deconstructing Complex Problems', 'Break down complex problems into fundamental components. Identify core elements vs accidental features.', NULL, 'middle', 'First Principles', 'Methods', 61, 1, 1),
  ('ct_fpr_3', 'critical_thinking', 'hyro_advanced', 'CT.FPR.3', 'Questioning Assumptions', 'Systematically question assumptions: Why is this done this way? What if the opposite were true? What am I taking for granted?', NULL, 'middle', 'First Principles', 'Methods', 62, 1, 1),
  ('ct_fpr_4', 'critical_thinking', 'hyro_advanced', 'CT.FPR.4', 'Building From Fundamentals', 'Reason upward from first principles to construct understanding. Combine basic truths to derive complex insights.', NULL, 'middle', 'First Principles', 'Construction', 63, 1, 1),
  ('ct_fpr_5', 'critical_thinking', 'hyro_advanced', 'CT.FPR.5', 'Limits of Analogical Reasoning', 'Understand when analogies are useful and when they mislead. Recognize that surface similarity doesnt guarantee deep similarity.', NULL, 'middle', 'First Principles', 'Critical Awareness', 64, 1, 1),
  ('ct_fpr_6', 'critical_thinking', 'hyro_advanced', 'CT.FPR.6', 'Novel Problem Solving', 'Apply first principles thinking to novel problems where existing solutions dont exist. Generate creative solutions from fundamentals.', NULL, 'middle', 'First Principles', 'Application', 65, 1, 1),
  ('ct_fpr_7', 'critical_thinking', 'hyro_advanced', 'CT.FPR.7', 'Identifying Constraints', 'Distinguish between real constraints (physical laws, logic) and perceived constraints (conventions, assumptions). Challenge the latter.', NULL, 'middle', 'First Principles', 'Application', 66, 1, 1),
  ('ct_fpr_8', 'critical_thinking', 'hyro_advanced', 'CT.FPR.8', 'Reasoning by Analogy vs First Principles', 'Compare reasoning by analogy (this is like that) with reasoning from first principles (what must be true?). Know when to use each.', NULL, 'middle', 'First Principles', 'Integration', 67, 1, 1);

-- ============================================================================
-- STRAND 5: SOURCE EVALUATION (CT.SRC)
-- Determining what to trust in an information-saturated world
-- ============================================================================

INSERT INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  ('ct_src_1', 'critical_thinking', 'hyro_advanced', 'CT.SRC.1', 'Credibility Assessment', 'Evaluate source credibility using CRAAP test: Currency, Relevance, Authority, Accuracy, Purpose. Apply systematically to information sources.', NULL, 'middle', 'Source Evaluation', 'Credibility', 80, 1, 1),
  ('ct_src_2', 'critical_thinking', 'hyro_advanced', 'CT.SRC.2', 'Primary vs Secondary Sources', 'Distinguish primary sources (firsthand evidence) from secondary sources (interpretations). Understand when each is appropriate.', NULL, 'middle', 'Source Evaluation', 'Source Types', 81, 1, 1),
  ('ct_src_3', 'critical_thinking', 'hyro_advanced', 'CT.SRC.3', 'Detecting Bias', 'Identify bias in sources: political, commercial, ideological. Understand that bias doesnt necessarily invalidate information but requires awareness.', NULL, 'middle', 'Source Evaluation', 'Critical Reading', 82, 1, 1),
  ('ct_src_4', 'critical_thinking', 'hyro_advanced', 'CT.SRC.4', 'Understanding Peer Review', 'Understand the peer review process in science and scholarship. Know why peer-reviewed sources are generally more reliable.', NULL, 'middle', 'Source Evaluation', 'Academic Sources', 83, 1, 1),
  ('ct_src_5', 'critical_thinking', 'hyro_advanced', 'CT.SRC.5', 'Information Provenance', 'Trace information back to its original source. Verify claims by checking primary sources rather than trusting secondary reports.', NULL, 'middle', 'Source Evaluation', 'Verification', 84, 1, 1),
  ('ct_src_6', 'critical_thinking', 'hyro_advanced', 'CT.SRC.6', 'Cross-Verification', 'Verify important claims through multiple independent sources. Understand the difference between multiple sources and multiple reports of the same source.', NULL, 'middle', 'Source Evaluation', 'Verification', 85, 1, 1),
  ('ct_src_7', 'critical_thinking', 'hyro_advanced', 'CT.SRC.7', 'Expertise Recognition', 'Identify genuine expertise: relevant credentials, track record, peer recognition. Distinguish from credentialism and appeals to false authority.', NULL, 'middle', 'Source Evaluation', 'Authority', 86, 1, 1),
  ('ct_src_8', 'critical_thinking', 'hyro_advanced', 'CT.SRC.8', 'Conflicts of Interest', 'Identify potential conflicts of interest: financial incentives, ideological commitments. Understand how these can bias information.', NULL, 'middle', 'Source Evaluation', 'Critical Awareness', 87, 1, 1),
  ('ct_src_9', 'critical_thinking', 'hyro_advanced', 'CT.SRC.9', 'Statistical Literacy', 'Critically evaluate statistical claims: sample size, methodology, correlation vs causation, cherry-picking data, misleading visualizations.', NULL, 'middle', 'Source Evaluation', 'Quantitative Skills', 88, 1, 1);

-- ============================================================================
-- STRAND 6: DECISION MAKING (CT.DEC)
-- Making better choices through quantitative reasoning
-- ============================================================================

INSERT INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  ('ct_dec_1', 'critical_thinking', 'hyro_advanced', 'CT.DEC.1', 'Expected Value', 'Calculate and apply expected value: probability × outcome. Use expected value to compare risky options.', NULL, 'middle', 'Decision Making', 'Quantitative Tools', 100, 1, 1),
  ('ct_dec_2', 'critical_thinking', 'hyro_advanced', 'CT.DEC.2', 'Risk Assessment', 'Evaluate risks quantitatively: likelihood × severity. Distinguish between high-probability/low-impact and low-probability/high-impact risks.', NULL, 'middle', 'Decision Making', 'Quantitative Tools', 101, 1, 1),
  ('ct_dec_3', 'critical_thinking', 'hyro_advanced', 'CT.DEC.3', 'Opportunity Cost', 'Understand opportunity cost: the value of the next best alternative. Apply to decision-making by considering what youre giving up.', NULL, 'middle', 'Decision Making', 'Economic Thinking', 102, 1, 1),
  ('ct_dec_4', 'critical_thinking', 'hyro_advanced', 'CT.DEC.4', 'Sunk Cost Fallacy', 'Recognize sunk cost fallacy: continuing something because of past investment rather than future value. Learn to ignore sunk costs in decisions.', NULL, 'middle', 'Decision Making', 'Cognitive Biases', 103, 1, 1),
  ('ct_dec_5', 'critical_thinking', 'hyro_advanced', 'CT.DEC.5', 'Reversible vs Irreversible Decisions', 'Distinguish between reversible decisions (low stakes, experiment) and irreversible decisions (high stakes, deliberate carefully).', NULL, 'middle', 'Decision Making', 'Decision Types', 104, 1, 1),
  ('ct_dec_6', 'critical_thinking', 'hyro_advanced', 'CT.DEC.6', 'Second-Order Thinking', 'Think beyond immediate consequences: what happens after that? Consider second and third-order effects of decisions.', NULL, 'middle', 'Decision Making', 'Strategic Thinking', 105, 1, 1),
  ('ct_dec_7', 'critical_thinking', 'hyro_advanced', 'CT.DEC.7', 'Base Rate Neglect', 'Understand base rates: general probability of events. Avoid ignoring base rates when considering specific cases.', NULL, 'middle', 'Decision Making', 'Cognitive Biases', 106, 1, 1),
  ('ct_dec_8', 'critical_thinking', 'hyro_advanced', 'CT.DEC.8', 'Bayesian Updating', 'Update beliefs based on new evidence. Understand how to revise probability estimates as new information arrives.', NULL, 'middle', 'Decision Making', 'Advanced Concepts', 107, 1, 1),
  ('ct_dec_9', 'critical_thinking', 'hyro_advanced', 'CT.DEC.9', 'Decision Trees', 'Construct and analyze decision trees for complex choices. Map out options, probabilities, and outcomes systematically.', NULL, 'middle', 'Decision Making', 'Tools and Methods', 108, 1, 1);

-- ============================================================================
-- CURRICULUM TOPICS - FORMAL LOGIC
-- ============================================================================

INSERT INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ct_propositions', 'critical_thinking', 'ct_log_1', 'Understanding Propositions', 'What makes a statement true or false', '["Define proposition as a declarative statement", "Identify whether statements are propositions", "Recognize that questions and commands are not propositions"]', 1, 25),
  ('topic_ct_truth_values', 'critical_thinking', 'ct_log_1', 'Truth Values', 'Every proposition is either true or false', '["Understand binary nature of truth", "Evaluate truth values of simple propositions", "Recognize that some propositions have unknown truth values"]', 1, 20),
  ('topic_ct_and_or', 'critical_thinking', 'ct_log_2', 'AND and OR', 'Combining propositions with conjunction and disjunction', '["Understand AND requires both parts true", "Understand OR requires at least one part true", "Apply these operators to compound statements"]', 2, 30),
  ('topic_ct_negation', 'critical_thinking', 'ct_log_2', 'Negation (NOT)', 'Inverting truth values', '["Understand NOT flips truth value", "Apply negation to simple and compound statements", "Recognize double negation"]', 2, 25),
  ('topic_ct_conditional', 'critical_thinking', 'ct_log_2', 'IF-THEN Statements', 'Understanding conditional logic', '["Understand if P then Q structure", "Know when conditionals are true/false", "Recognize antecedent and consequent"]', 2, 35),
  ('topic_ct_truth_tables', 'critical_thinking', 'ct_log_3', 'Constructing Truth Tables', 'Systematic evaluation of compound propositions', '["Build truth tables for compound statements", "Use truth tables to test validity", "Identify logical equivalences via truth tables"]', 3, 40),
  ('topic_ct_validity', 'critical_thinking', 'ct_log_4', 'Argument Validity', 'When conclusions follow from premises', '["Define valid argument", "Test arguments for validity", "Understand validity is about form not content"]', 2, 30),
  ('topic_ct_soundness', 'critical_thinking', 'ct_log_4', 'Sound Arguments', 'Valid arguments with true premises', '["Define sound argument", "Distinguish validity from soundness", "Evaluate both form and content"]', 2, 25),
  ('topic_ct_deduction', 'critical_thinking', 'ct_log_5', 'Deductive Reasoning', 'Reasoning that guarantees conclusions', '["Understand deduction provides certainty", "Apply deductive reasoning", "Contrast with inductive reasoning"]', 2, 30),
  ('topic_ct_syllogisms', 'critical_thinking', 'ct_log_6', 'Categorical Syllogisms', 'Classic three-part arguments', '["Identify major and minor premises", "Test syllogisms for validity", "Recognize valid forms"]', 3, 35),
  ('topic_ct_modus_ponens', 'critical_thinking', 'ct_log_7', 'Modus Ponens', 'If P then Q. P. Therefore Q.', '["Understand modus ponens structure", "Apply modus ponens to arguments", "Recognize this valid form in natural language"]', 2, 25),
  ('topic_ct_modus_tollens', 'critical_thinking', 'ct_log_7', 'Modus Tollens', 'If P then Q. Not Q. Therefore not P.', '["Understand modus tollens structure", "Apply modus tollens to arguments", "Recognize this valid form in natural language"]', 3, 30),
  ('topic_ct_contrapositive', 'critical_thinking', 'ct_log_8', 'Contrapositive', 'Logical equivalence through negation and reversal', '["Form the contrapositive of conditional", "Know contrapositive is logically equivalent", "Distinguish from converse and inverse"]', 3, 30),
  ('topic_ct_proof_direct', 'critical_thinking', 'ct_log_9', 'Direct Proof', 'Proving by logical steps from premises', '["Construct direct proofs", "Identify valid inference steps", "Build logical chains"]', 3, 40);

-- ============================================================================
-- CURRICULUM TOPICS - INFORMAL LOGIC & FALLACIES
-- ============================================================================

INSERT INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ct_ad_hominem', 'critical_thinking', 'ct_fal_1', 'Ad Hominem Fallacy', 'Attacking the person, not the argument', '["Identify ad hominem attacks", "Explain why they dont refute arguments", "Distinguish from legitimate character evidence"]', 2, 25),
  ('topic_ct_straw_man', 'critical_thinking', 'ct_fal_2', 'Straw Man Fallacy', 'Misrepresenting opponents positions', '["Recognize straw man misrepresentations", "Identify the real vs distorted argument", "Avoid committing this fallacy yourself"]', 2, 30),
  ('topic_ct_false_authority', 'critical_thinking', 'ct_fal_3', 'Appeal to False Authority', 'When expertise doesnt apply', '["Identify inappropriate appeals to authority", "Evaluate relevance of credentials", "Recognize celebrity endorsements as fallacious"]', 2, 25),
  ('topic_ct_appeal_emotion', 'critical_thinking', 'ct_fal_4', 'Appeal to Emotion', 'Manipulating feelings instead of reasoning', '["Recognize emotional manipulation", "Distinguish emotion from evidence", "Identify common emotional appeals"]', 2, 25),
  ('topic_ct_false_dichotomy', 'critical_thinking', 'ct_fal_5', 'False Dichotomy', 'Ignoring options between extremes', '["Identify false either/or choices", "Recognize excluded middle options", "Challenge binary thinking"]', 2, 30),
  ('topic_ct_slippery_slope', 'critical_thinking', 'ct_fal_6', 'Slippery Slope Fallacy', 'Unjustified chain reactions', '["Recognize slippery slope arguments", "Evaluate whether chain is justified", "Distinguish from legitimate causal chains"]', 2, 25),
  ('topic_ct_circular', 'critical_thinking', 'ct_fal_7', 'Circular Reasoning', 'Using conclusion as premise', '["Identify circular arguments", "Recognize question-begging", "Explain why circles dont prove anything"]', 2, 30),
  ('topic_ct_hasty_gen', 'critical_thinking', 'ct_fal_8', 'Hasty Generalization', 'Broad claims from thin evidence', '["Recognize insufficient sample sizes", "Evaluate representativeness of evidence", "Understand anecdotes vs data"]', 2, 25),
  ('topic_ct_correlation', 'critical_thinking', 'ct_fal_9', 'Correlation vs Causation', 'Together doesnt mean because', '["Distinguish correlation from causation", "Identify confounding variables", "Understand reverse causation"]', 2, 35),
  ('topic_ct_red_herring', 'critical_thinking', 'ct_fal_10', 'Red Herring Fallacy', 'Changing the subject', '["Recognize topic shifting", "Identify irrelevant diversions", "Refocus on original question"]', 2, 20),
  ('topic_ct_bandwagon', 'critical_thinking', 'ct_fal_12', 'Bandwagon Fallacy', 'Popular doesnt mean true', '["Identify bandwagon appeals", "Understand popularity vs truth", "Recognize peer pressure arguments"]', 2, 20);

-- ============================================================================
-- CURRICULUM TOPICS - ARGUMENT ANALYSIS
-- ============================================================================

INSERT INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ct_claims', 'critical_thinking', 'ct_arg_1', 'Identifying Claims', 'Finding the main point', '["Extract the main conclusion", "Distinguish claim from support", "Identify implicit conclusions"]', 2, 25),
  ('topic_ct_premises', 'critical_thinking', 'ct_arg_2', 'Finding Premises', 'The reasons offered for conclusions', '["Identify supporting premises", "Map argument structure", "Recognize indicator words (because, since, therefore)"]', 2, 30),
  ('topic_ct_evidence_quality', 'critical_thinking', 'ct_arg_3', 'Evaluating Evidence', 'Is the evidence any good?', '["Apply relevance test", "Assess sufficiency of evidence", "Evaluate source quality"]', 3, 35),
  ('topic_ct_fact_opinion', 'critical_thinking', 'ct_arg_4', 'Fact vs Opinion', 'Verifiable vs subjective', '["Distinguish factual claims from opinions", "Identify value judgments", "Recognize reasoned conclusions"]', 2, 25),
  ('topic_ct_assumptions', 'critical_thinking', 'ct_arg_5', 'Uncovering Assumptions', 'What must be true for this to work?', '["Identify unstated assumptions", "Question background beliefs", "Make implicit explicit"]', 3, 35),
  ('topic_ct_counterargs', 'critical_thinking', 'ct_arg_7', 'Building Counterarguments', 'Arguing the other side', '["Challenge premises", "Provide counterevidence", "Offer alternative explanations"]', 3, 40),
  ('topic_ct_steelman', 'critical_thinking', 'ct_arg_8', 'Steelmanning', 'The strongest opposing case', '["Construct best version of opposing view", "Address strong arguments not weak ones", "Demonstrate intellectual honesty"]', 3, 35);

-- ============================================================================
-- CURRICULUM TOPICS - FIRST PRINCIPLES REASONING
-- ============================================================================

INSERT INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ct_what_first_prin', 'critical_thinking', 'ct_fpr_1', 'What Are First Principles?', 'Foundational truths we build from', '["Define first principles", "Distinguish from assumptions", "Identify fundamental vs derived truths"]', 2, 30),
  ('topic_ct_decompose', 'critical_thinking', 'ct_fpr_2', 'Problem Decomposition', 'Breaking things down', '["Decompose complex problems", "Identify core components", "Separate essential from accidental"]', 3, 35),
  ('topic_ct_question_assume', 'critical_thinking', 'ct_fpr_3', 'Questioning Assumptions', 'What if the opposite were true?', '["Challenge unstated assumptions", "Ask why systematically", "Identify what youre taking for granted"]', 2, 30),
  ('topic_ct_build_up', 'critical_thinking', 'ct_fpr_4', 'Building From Basics', 'Constructing understanding from ground up', '["Reason from fundamentals upward", "Combine basic truths", "Derive complex from simple"]', 3, 40),
  ('topic_ct_analogy_limits', 'critical_thinking', 'ct_fpr_5', 'When Analogies Mislead', 'Surface similarity isnt deep similarity', '["Recognize limits of analogical reasoning", "Identify where analogies break down", "Know when to reason from first principles instead"]', 3, 30),
  ('topic_ct_novel_problems', 'critical_thinking', 'ct_fpr_6', 'Novel Problem Solving', 'No playbook exists', '["Apply first principles to new situations", "Generate solutions from fundamentals", "Avoid over-relying on existing patterns"]', 3, 40),
  ('topic_ct_constraints', 'critical_thinking', 'ct_fpr_7', 'Real vs Perceived Constraints', 'What actually limits us?', '["Distinguish laws of nature from conventions", "Challenge perceived limitations", "Identify true constraints"]', 3, 35);

-- ============================================================================
-- CURRICULUM TOPICS - SOURCE EVALUATION
-- ============================================================================

INSERT INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ct_craap', 'critical_thinking', 'ct_src_1', 'CRAAP Test', 'Currency, Relevance, Authority, Accuracy, Purpose', '["Apply CRAAP test to sources", "Evaluate each dimension", "Make informed credibility judgments"]', 2, 30),
  ('topic_ct_primary_sec', 'critical_thinking', 'ct_src_2', 'Primary vs Secondary Sources', 'Firsthand vs interpreted', '["Distinguish primary from secondary sources", "Know when to use each", "Trace back to primary sources"]', 2, 25),
  ('topic_ct_bias_detect', 'critical_thinking', 'ct_src_3', 'Detecting Bias', 'Everyone has an angle', '["Identify political bias", "Recognize commercial interests", "Understand ideological framing"]', 2, 30),
  ('topic_ct_peer_review', 'critical_thinking', 'ct_src_4', 'Peer Review Process', 'How science vets claims', '["Understand peer review mechanism", "Recognize its limitations", "Prefer peer-reviewed sources for science"]', 3, 35),
  ('topic_ct_provenance', 'critical_thinking', 'ct_src_5', 'Tracing Provenance', 'Following information to its source', '["Track claims to original source", "Identify telephone game distortions", "Verify through primary sources"]', 3, 30),
  ('topic_ct_cross_verify', 'critical_thinking', 'ct_src_6', 'Cross-Verification', 'Multiple independent confirmations', '["Verify through independent sources", "Distinguish independent from derivative", "Know when cross-verification matters"]', 3, 30),
  ('topic_ct_expertise', 'critical_thinking', 'ct_src_7', 'Recognizing Expertise', 'Who actually knows this?', '["Evaluate relevant credentials", "Assess track record", "Distinguish expertise from credentialism"]', 2, 25),
  ('topic_ct_conflicts', 'critical_thinking', 'ct_src_8', 'Conflicts of Interest', 'Who benefits from this claim?', '["Identify financial conflicts", "Recognize ideological motivations", "Understand how conflicts bias information"]', 3, 30),
  ('topic_ct_stats_literacy', 'critical_thinking', 'ct_src_9', 'Statistical Literacy', 'Numbers can mislead', '["Evaluate sample sizes", "Recognize cherry-picked data", "Identify misleading visualizations"]', 3, 40);

-- ============================================================================
-- CURRICULUM TOPICS - DECISION MAKING
-- ============================================================================

INSERT INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ct_expected_value', 'critical_thinking', 'ct_dec_1', 'Expected Value', 'Probability × Outcome', '["Calculate expected value", "Compare risky options", "Apply to real decisions"]', 3, 35),
  ('topic_ct_risk_assess', 'critical_thinking', 'ct_dec_2', 'Risk Assessment', 'Likelihood × Severity', '["Evaluate risk quantitatively", "Distinguish high/low probability and impact", "Prioritize risks appropriately"]', 3, 30),
  ('topic_ct_opp_cost', 'critical_thinking', 'ct_dec_3', 'Opportunity Cost', 'What are you giving up?', '["Define opportunity cost", "Identify next best alternative", "Factor into decisions"]', 2, 25),
  ('topic_ct_sunk_cost', 'critical_thinking', 'ct_dec_4', 'Sunk Cost Fallacy', 'Past investment shouldnt drive future choices', '["Recognize sunk cost fallacy", "Ignore sunk costs in decisions", "Focus on future value only"]', 2, 30),
  ('topic_ct_reversible', 'critical_thinking', 'ct_dec_5', 'Reversible Decisions', 'Two-way doors vs one-way doors', '["Distinguish reversible from irreversible", "Move fast on reversible decisions", "Deliberate on irreversible ones"]', 2, 25),
  ('topic_ct_second_order', 'critical_thinking', 'ct_dec_6', 'Second-Order Thinking', 'And then what happens?', '["Think beyond immediate effects", "Consider second and third-order consequences", "Map causal chains"]', 3, 35),
  ('topic_ct_base_rate', 'critical_thinking', 'ct_dec_7', 'Base Rate Thinking', 'Start with the general probability', '["Understand base rates", "Avoid base rate neglect", "Adjust from base rate with evidence"]', 3, 30),
  ('topic_ct_bayesian', 'critical_thinking', 'ct_dec_8', 'Updating Beliefs', 'Revising with new evidence', '["Update probabilities with new data", "Understand Bayesian thinking", "Avoid confirmation bias"]', 4, 40),
  ('topic_ct_decision_trees', 'critical_thinking', 'ct_dec_9', 'Decision Trees', 'Mapping complex choices', '["Construct decision trees", "Map options and probabilities", "Calculate expected values at nodes"]', 3, 35);

-- ============================================================================
-- QUESTION BANK - FORMAL LOGIC
-- ============================================================================

INSERT INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  ('q_ct_log_001', 'critical_thinking', 'ct_log_1', 'topic_ct_propositions', 'multiple_choice', 'Which of the following is a proposition?', '["What time is it?", "Close the door", "The Earth is round", "I hope it rains"]', 'The Earth is round', 'A proposition is a declarative statement that is either true or false. "The Earth is round" can be evaluated as true or false. Questions and commands are not propositions.', 30, 1, 'understand', 2, '["Propositions are statements", "They must be true or false"]'),

  ('q_ct_log_002', 'critical_thinking', 'ct_log_2', 'topic_ct_and_or', 'multiple_choice', 'If P is "Its raining" and Q is "Its cold", when is "P AND Q" true?', '["When at least one is true", "When both are true", "When neither is true", "When exactly one is true"]', 'When both are true', 'A conjunction (AND) is only true when both parts are true. If either P or Q is false, then P AND Q is false.', 25, 1, 'understand', 2, '["AND requires both parts", "Think about when both conditions hold"]'),

  ('q_ct_log_003', 'critical_thinking', 'ct_log_2', 'topic_ct_and_or', 'multiple_choice', 'If P is "Its sunny" and Q is "Its warm", when is "P OR Q" true?', '["Only when both are true", "When at least one is true", "When neither is true", "Only when exactly one is true"]', 'When at least one is true', 'A disjunction (OR) is true when at least one part is true. It can be true when both are true, or when just one is true.', 25, 1, 'understand', 2, '["OR requires at least one", "One or both can be true"]'),

  ('q_ct_log_004', 'critical_thinking', 'ct_log_2', 'topic_ct_conditional', 'multiple_choice', 'In "If it rains, then the ground is wet", when is this statement FALSE?', '["When it rains and the ground is wet", "When it rains and the ground is NOT wet", "When it doesnt rain and the ground is wet", "When it doesnt rain and the ground is dry"]', 'When it rains and the ground is NOT wet', 'A conditional "If P then Q" is only false when P is true but Q is false. The only way to break the promise is if it rains (P) but the ground isnt wet (Q).', 40, 2, 'analyze', 3, '["When does the promise break?", "If P happens but Q doesnt, thats false"]'),

  ('q_ct_log_005', 'critical_thinking', 'ct_log_4', 'topic_ct_validity', 'multiple_choice', 'An argument is VALID when:', '["The premises are true", "The conclusion is true", "If the premises were true, the conclusion must be true", "Everyone agrees with it"]', 'If the premises were true, the conclusion must be true', 'Validity is about logical structure, not truth. An argument is valid if the conclusion necessarily follows from the premises - even if the premises are actually false.', 45, 2, 'understand', 2, '["Validity is about structure", "Would the conclusion follow IF premises were true?"]'),

  ('q_ct_log_006', 'critical_thinking', 'ct_log_5', 'topic_ct_deduction', 'multiple_choice', 'All mammals are warm-blooded. A whale is a mammal. Therefore:', '["A whale might be warm-blooded", "A whale is probably warm-blooded", "A whale is definitely warm-blooded", "We cannot conclude anything"]', 'A whale is definitely warm-blooded', 'This is valid deductive reasoning. If ALL mammals are warm-blooded and whales are mammals, then whales MUST be warm-blooded. Deduction provides certainty when premises are true.', 35, 2, 'apply', 2, '["ALL mammals includes whales", "Deduction gives certainty"]'),

  ('q_ct_log_007', 'critical_thinking', 'ct_log_7', 'topic_ct_modus_ponens', 'multiple_choice', 'If it snows, school is cancelled. It snowed. Therefore:', '["School might be cancelled", "School is cancelled", "School is not cancelled", "We need more information"]', 'School is cancelled', 'This is modus ponens: If P then Q. P. Therefore Q. The conditional states if it snows (P), school is cancelled (Q). It snowed (P is true), so school is cancelled (Q must be true).', 30, 2, 'apply', 2, '["If P then Q, and P happened", "So Q must happen"]'),

  ('q_ct_log_008', 'critical_thinking', 'ct_log_7', 'topic_ct_modus_tollens', 'multiple_choice', 'If John studied, he passed. John did NOT pass. Therefore:', '["John studied", "John did not study", "John might have studied", "We cannot conclude"]', 'John did not study', 'This is modus tollens: If P then Q. NOT Q. Therefore NOT P. If studying (P) guarantees passing (Q), and John didnt pass (NOT Q), then he didnt study (NOT P).', 40, 2, 'apply', 3, '["If P then Q, but Q didnt happen", "So P didnt happen either"]'),

  ('q_ct_log_009', 'critical_thinking', 'ct_log_8', 'topic_ct_contrapositive', 'multiple_choice', 'What is the contrapositive of "If it rains, then the game is cancelled"?', '["If the game is cancelled, then it rains", "If it doesnt rain, then the game is not cancelled", "If the game is not cancelled, then it didnt rain", "If it rains, then the game is not cancelled"]', 'If the game is not cancelled, then it didnt rain', 'The contrapositive negates both parts and reverses them: If P then Q becomes If NOT Q then NOT P. This is logically equivalent to the original.', 50, 3, 'apply', 3, '["Negate both parts and reverse", "NOT Q then NOT P"]'),

  ('q_ct_log_010', 'critical_thinking', 'ct_log_4', 'topic_ct_validity', 'multiple_choice', 'Which is TRUE about this argument: "All dogs bark. Fido barks. Therefore Fido is a dog."?', '["Valid and sound", "Valid but not sound", "Invalid but true conclusion", "Invalid and false conclusion"]', 'Invalid but true conclusion', 'This is INVALID reasoning (affirming the consequent fallacy). Just because dogs bark doesnt mean everything that barks is a dog. The conclusion might be true, but it doesnt follow logically.', 55, 3, 'analyze', 3, '["Does the conclusion HAVE to follow?", "Could other things bark besides dogs?"]');

-- ============================================================================
-- QUESTION BANK - INFORMAL LOGIC & FALLACIES
-- ============================================================================

INSERT INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  ('q_ct_fal_001', 'critical_thinking', 'ct_fal_1', 'topic_ct_ad_hominem', 'multiple_choice', '"You cant trust Sarahs argument about climate change - shes not even a scientist!" What fallacy is this?', '["Appeal to authority", "Ad hominem", "Straw man", "Red herring"]', 'Ad hominem', 'This attacks Sarah personally (her credentials) rather than addressing her actual argument. Even non-scientists can make valid arguments if they cite proper evidence.', 35, 2, 'analyze', 2, '["Is this attacking the person or the argument?", "Does not being a scientist make the argument wrong?"]'),

  ('q_ct_fal_002', 'critical_thinking', 'ct_fal_2', 'topic_ct_straw_man', 'multiple_choice', 'Alex says "We should have some gun regulations." Ben responds "Alex wants to ban all guns and take away our rights!" What fallacy is this?', '["Ad hominem", "Straw man", "Slippery slope", "False dichotomy"]', 'Straw man', 'Ben misrepresents Alexs position (some regulations) as an extreme position (ban all guns) to make it easier to attack. This is a straw man fallacy.', 40, 2, 'analyze', 3, '["Is Ben representing Alex accurately?", "Did Alex say ban all guns?"]'),

  ('q_ct_fal_003', 'critical_thinking', 'ct_fal_3', 'topic_ct_false_authority', 'multiple_choice', '"This toothpaste must be great - my favorite basketball player endorses it!" What fallacy is this?', '["Appeal to emotion", "Bandwagon", "Appeal to false authority", "Hasty generalization"]', 'Appeal to false authority', 'Being good at basketball doesnt make someone an authority on toothpaste. This appeals to irrelevant authority - celebrity status rather than dental expertise.', 30, 2, 'analyze', 2, '["Is a basketball player an expert on toothpaste?", "What makes someone an authority?"]'),

  ('q_ct_fal_004', 'critical_thinking', 'ct_fal_5', 'topic_ct_false_dichotomy', 'multiple_choice', '"Either you support my plan completely, or you want the company to fail." What fallacy is this?', '["Straw man", "False dichotomy", "Slippery slope", "Circular reasoning"]', 'False dichotomy', 'This presents only two options (support completely vs want failure) when many middle positions exist: support parts, suggest modifications, have alternative plans, etc.', 35, 2, 'analyze', 2, '["Are these the only two options?", "Could you disagree without wanting failure?"]'),

  ('q_ct_fal_005', 'critical_thinking', 'ct_fal_6', 'topic_ct_slippery_slope', 'multiple_choice', '"If we let students turn in homework one day late, soon theyll want a week, then a month, and eventually well have no deadlines at all!" What fallacy is this?', '["False dichotomy", "Slippery slope", "Hasty generalization", "Red herring"]', 'Slippery slope', 'This claims one small change will inevitably lead to extreme consequences without justification. A one-day extension doesnt necessarily lead to no deadlines.', 35, 2, 'analyze', 3, '["Is each step inevitable?", "Does A necessarily lead to Z?"]'),

  ('q_ct_fal_006', 'critical_thinking', 'ct_fal_7', 'topic_ct_circular', 'multiple_choice', '"God exists because the Bible says so, and the Bible is true because it\'s the word of God." What fallacy is this?', '["Appeal to authority", "Circular reasoning", "Straw man", "Red herring"]', 'Circular reasoning', 'This uses the conclusion (God exists) as part of the evidence. The argument goes in a circle: Bible proves God, God proves Bible. No independent justification is provided.', 40, 2, 'analyze', 3, '["Is the conclusion used in the premise?", "Does this go in a circle?"]'),

  ('q_ct_fal_007', 'critical_thinking', 'ct_fal_8', 'topic_ct_hasty_gen', 'multiple_choice', '"I met two rude people from that city, so everyone from there must be rude." What fallacy is this?', '["Hasty generalization", "Straw man", "False dichotomy", "Appeal to emotion"]', 'Hasty generalization', 'This draws a broad conclusion about an entire city from only two examples. The sample size is far too small to support such a sweeping generalization.', 30, 2, 'analyze', 2, '["How many people were observed?", "Is this enough to judge everyone?"]'),

  ('q_ct_fal_008', 'critical_thinking', 'ct_fal_9', 'topic_ct_correlation', 'multiple_choice', '"Ice cream sales and drowning deaths both increase in summer. Therefore, ice cream causes drowning." What\'s wrong with this reasoning?', '["Its circular", "It confuses correlation with causation", "Its a straw man", "Its an appeal to emotion"]', 'It confuses correlation with causation', 'Both ice cream sales and drowning increase in summer because of a third factor: warm weather. Correlation doesnt prove causation. They happen together but neither causes the other.', 40, 2, 'analyze', 3, '["Do they happen together?", "Does one cause the other, or is there another explanation?"]'),

  ('q_ct_fal_009', 'critical_thinking', 'ct_fal_10', 'topic_ct_red_herring', 'multiple_choice', 'During a debate about education funding, one candidate says "My opponent doesnt even recycle!" What fallacy is this?', '["Ad hominem", "Red herring", "Straw man", "False dichotomy"]', 'Red herring', 'This introduces an irrelevant topic (recycling) to distract from the actual issue (education funding). Its a diversion tactic to avoid addressing the real argument.', 35, 2, 'analyze', 2, '["Is recycling relevant to education funding?", "Is this changing the subject?"]'),

  ('q_ct_fal_010', 'critical_thinking', 'ct_fal_12', 'topic_ct_bandwagon', 'multiple_choice', '"Everyone believes this, so it must be true." What fallacy is this?', '["Appeal to authority", "Bandwagon", "Hasty generalization", "Circular reasoning"]', 'Bandwagon', 'This appeals to popularity as evidence of truth. Many people believing something doesnt make it true - historically, majorities have been wrong about many things.', 25, 1, 'understand', 2, '["Does popularity equal truth?", "Have majorities ever been wrong?"]');

-- ============================================================================
-- QUESTION BANK - ARGUMENT ANALYSIS
-- ============================================================================

INSERT INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  ('q_ct_arg_001', 'critical_thinking', 'ct_arg_1', 'topic_ct_claims', 'multiple_choice', 'In this passage, what is the main claim? "Students should start school later. Research shows teenagers need more sleep. Countries with later start times have better outcomes."', '["Research shows teenagers need more sleep", "Students should start school later", "Countries with later times have better outcomes", "Teenagers need sleep"]', 'Students should start school later', 'The main claim is the conclusion the author wants you to accept. The other statements are premises (evidence) offered to support the main claim that school should start later.', 35, 2, 'analyze', 2, '["What is being argued FOR?", "Which statement do the others support?"]'),

  ('q_ct_arg_002', 'critical_thinking', 'ct_arg_2', 'topic_ct_premises', 'multiple_choice', 'How many premises support this argument? "We should exercise regularly (1) because it improves heart health, (2) boosts mental health, and (3) increases lifespan."', '["1", "2", "3", "4"]', '3', 'There are three premises (reasons) offered: improves heart health, boosts mental health, and increases lifespan. All three support the conclusion to exercise regularly.', 30, 2, 'analyze', 2, '["Count the reasons given", "Look for multiple because statements"]'),

  ('q_ct_arg_003', 'critical_thinking', 'ct_arg_4', 'topic_ct_fact_opinion', 'multiple_choice', 'Which is a FACT (verifiable) rather than an opinion?', '["Pizza is the best food", "Water freezes at 0°C at standard pressure", "Summer is better than winter", "That movie was boring"]', 'Water freezes at 0°C at standard pressure', 'This is a verifiable fact that can be tested and proven true or false. The others are subjective opinions that vary by person.', 25, 1, 'understand', 2, '["Can this be tested?", "Is there objective truth to this?"]'),

  ('q_ct_arg_004', 'critical_thinking', 'ct_arg_3', 'topic_ct_evidence_quality', 'multiple_choice', 'Which evidence is STRONGEST for "Exercise improves health"?', '["My friend exercises and feels great", "A study of 10,000 people over 20 years showed exercise reduces disease", "A fitness influencer says exercise helps", "I think exercise is good"]', 'A study of 10,000 people over 20 years showed exercise reduces disease', 'This is the strongest evidence: large sample size (10,000), long duration (20 years), systematic study. The others are anecdotes, appeals to questionable authority, or personal opinions.', 40, 2, 'evaluate', 3, '["Which is most systematic?", "Which has the most data?"]'),

  ('q_ct_arg_005', 'critical_thinking', 'ct_arg_5', 'topic_ct_assumptions', 'multiple_choice', '"We should ban this book because children might read it." What assumption underlies this argument?', '["Books are dangerous", "Children read books", "If children might read something inappropriate, it should be banned", "Parents cant supervise reading"]', 'If children might read something inappropriate, it should be banned', 'The hidden assumption is that potential access by children justifies banning. This assumes we should ban anything children might encounter, which is questionable.', 50, 3, 'analyze', 3, '["What must be true for this argument to work?", "What principle is being assumed?"]'),

  ('q_ct_arg_006', 'critical_thinking', 'ct_arg_7', 'topic_ct_counterargs', 'multiple_choice', 'Argument: "We should eliminate homework to reduce student stress." Which is the STRONGEST counterargument?', '["Some students like homework", "Homework has been around forever", "Research shows homework in moderation improves learning outcomes", "Teachers assign homework"]', 'Research shows homework in moderation improves learning outcomes', 'This directly challenges the premise with evidence. It suggests homework has benefits that might outweigh stress, and proposes moderation rather than elimination.', 45, 2, 'evaluate', 3, '["Which provides contrary evidence?", "Which addresses the core issue?"]'),

  ('q_ct_arg_007', 'critical_thinking', 'ct_arg_8', 'topic_ct_steelman', 'multiple_choice', 'Opponent says: "We need lower taxes." Which is STEELMANNING their position?', '["They just want rich people to pay nothing", "Lower taxes could stimulate economic growth and create jobs", "They dont care about public services", "They want to defund everything"]', 'Lower taxes could stimulate economic growth and create jobs', 'Steelmanning means constructing the strongest version of their argument, not the weakest. This presents the best economic case for lower taxes rather than dismissing or misrepresenting it.', 45, 2, 'evaluate', 3, '["Which is the strongest version?", "Which takes them seriously?"]');

-- ============================================================================
-- QUESTION BANK - FIRST PRINCIPLES REASONING
-- ============================================================================

INSERT INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  ('q_ct_fpr_001', 'critical_thinking', 'ct_fpr_1', 'topic_ct_what_first_prin', 'multiple_choice', 'Which is a FIRST PRINCIPLE rather than a derived conclusion?', '["Democracy is the best government", "Matter is composed of atoms", "Humans have rights", "Force equals mass times acceleration"]', 'Force equals mass times acceleration', 'F=ma is a fundamental law of physics that cannot be derived from other propositions - its a first principle. The others are conclusions derived from other reasoning or values.', 50, 3, 'analyze', 3, '["Which is fundamental and underived?", "Which is the most basic truth?"]'),

  ('q_ct_fpr_002', 'critical_thinking', 'ct_fpr_2', 'topic_ct_decompose', 'multiple_choice', 'To understand "Why is the sky blue?" from first principles, you should first ask:', '["What did my teacher say?", "What do most people think?", "What is light and how does it interact with atmosphere?", "What does Wikipedia say?"]', 'What is light and how does it interact with atmosphere?', 'First principles reasoning breaks down to fundamentals. Understanding light, atmosphere, and their interaction gets to the physical basis, rather than accepting explanations from authority.', 45, 2, 'apply', 3, '["What are the basic components?", "What fundamental physics explains this?"]'),

  ('q_ct_fpr_003', 'critical_thinking', 'ct_fpr_3', 'topic_ct_question_assume', 'multiple_choice', 'Someone says "Thats how weve always done it." The BEST first-principles response is:', '["Tradition must be right", "We should never change", "Why was it done that way? Is that reason still valid?", "Old ways are always bad"]', 'Why was it done that way? Is that reason still valid?', 'First principles thinking questions tradition. Understanding the original reason and whether it still applies is better than blindly accepting OR rejecting tradition.', 40, 2, 'apply', 2, '["Question the assumption", "Understand the WHY behind tradition"]'),

  ('q_ct_fpr_004', 'critical_thinking', 'ct_fpr_5', 'topic_ct_analogy_limits', 'multiple_choice', '"The brain is like a computer" - when does this analogy BREAK DOWN?', '["Brains process information", "Both have memory", "Brains are biological and learn through neural plasticity, computers are digital and follow fixed programs", "Both use electricity"]', 'Brains are biological and learn through neural plasticity, computers are digital and follow fixed programs', 'While brains and computers share some surface similarities, their fundamental mechanisms are different. Analogies help understanding but break down when pushed too far.', 50, 3, 'evaluate', 3, '["Where are they fundamentally different?", "What does the analogy miss?"]'),

  ('q_ct_fpr_005', 'critical_thinking', 'ct_fpr_6', 'topic_ct_novel_problems', 'multiple_choice', 'You face a problem no one has solved before. First principles thinking says:', '["Copy what similar problems did", "Give up - if no one solved it, its impossible", "Break it into fundamental components and build a solution from basics", "Ask an expert"]', 'Break it into fundamental components and build a solution from basics', 'When no playbook exists, reason from first principles. Deconstruct to fundamentals and build up. Copying only works for solved problems.', 45, 2, 'apply', 3, '["No existing solution means what?", "How do you solve novel problems?"]'),

  ('q_ct_fpr_006', 'critical_thinking', 'ct_fpr_7', 'topic_ct_constraints', 'multiple_choice', 'Which is a REAL constraint (not just convention)?', '["We must wear formal clothes to meetings", "We must obey the law of gravity", "We must follow this workflow", "We must use this software"]', 'We must obey the law of gravity', 'Laws of physics are real constraints. The others are conventions or choices that can be changed. First principles thinking distinguishes unchangeable reality from changeable convention.', 35, 2, 'analyze', 2, '["Which cannot be changed?", "Which is a law of nature?"]');

-- ============================================================================
-- QUESTION BANK - SOURCE EVALUATION
-- ============================================================================

INSERT INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  ('q_ct_src_001', 'critical_thinking', 'ct_src_1', 'topic_ct_craap', 'multiple_choice', 'You find a website about nutrition from 1995. Which CRAAP criterion is most problematic?', '["Currency", "Relevance", "Authority", "Accuracy"]', 'Currency', 'A 1995 source on nutrition is 30+ years old. Nutritional science has evolved significantly. Currency (how recent) is the main concern, though other factors matter too.', 35, 2, 'evaluate', 2, '["How old is this?", "Has science changed since then?"]'),

  ('q_ct_src_002', 'critical_thinking', 'ct_src_2', 'topic_ct_primary_sec', 'multiple_choice', 'For researching the Constitutional Convention, which is a PRIMARY source?', '["A history textbook chapter on the Convention", "James Madisons notes from the Convention", "A documentary about the founding fathers", "A Wikipedia article on the Constitution"]', 'James Madisons notes from the Convention', 'Madisons notes are firsthand accounts from someone present. The others are interpretations or summaries created later - secondary sources.', 40, 2, 'analyze', 2, '["Who was there?", "Which is firsthand evidence?"]'),

  ('q_ct_src_003', 'critical_thinking', 'ct_src_3', 'topic_ct_bias_detect', 'multiple_choice', 'A study on sugar safety is funded by a soft drink company. What should you consider?', '["Funding source is irrelevant", "The study is automatically false", "There may be financial bias - verify through independent research", "Companies never bias research"]', 'There may be financial bias - verify through independent research', 'Funding creates potential conflict of interest. The study might still be valid, but you should be skeptical and look for independent verification. Follow the money.', 40, 2, 'evaluate', 3, '["Who benefits from the results?", "Could funding influence findings?"]'),

  ('q_ct_src_004', 'critical_thinking', 'ct_src_4', 'topic_ct_peer_review', 'multiple_choice', 'Why are peer-reviewed scientific papers generally more reliable?', '["Theyre always correct", "Other experts evaluated the methods and evidence before publication", "Theyre published in journals", "Scientists are always right"]', 'Other experts evaluated the methods and evidence before publication', 'Peer review means other experts in the field checked the work for errors, bias, and validity before publication. Its not perfect but adds a quality filter.', 40, 2, 'understand', 2, '["What does peer review do?", "Who checks the work?"]'),

  ('q_ct_src_005', 'critical_thinking', 'ct_src_5', 'topic_ct_provenance', 'multiple_choice', 'You see "Scientists say..." in a news article. What should you do?', '["Believe it - its from scientists", "Ignore it - media always lies", "Find and check the original study", "Ask your teacher"]', 'Find and check the original study', 'Trace claims to their source. News may misrepresent research. Check what scientists actually said, not what reporters say they said.', 45, 2, 'apply', 3, '["Can you verify this?", "What did the original source say?"]'),

  ('q_ct_src_006', 'critical_thinking', 'ct_src_6', 'topic_ct_cross_verify', 'multiple_choice', 'You find the same claim on five websites. Why might this NOT be strong verification?', '["Five sources is always enough", "All five might be copying the same original source", "More is always better", "Websites never agree"]', 'All five might be copying the same original source', 'Multiple reports of the same original source isnt independent verification. You need multiple INDEPENDENT sources, not multiple reports of one source.', 50, 3, 'analyze', 3, '["Are these truly independent?", "Could they all copy each other?"]'),

  ('q_ct_src_007', 'critical_thinking', 'ct_src_7', 'topic_ct_expertise', 'multiple_choice', 'Who is the BEST authority on whether a new medical treatment works?', '["A celebrity who used it", "A PhD researcher who studied this treatment in clinical trials", "Someone who sells the treatment", "Your neighbor who read about it"]', 'A PhD researcher who studied this treatment in clinical trials', 'Relevant expertise matters. Someone who actually researched the treatment systematically has the most credible knowledge. Celebrities, sellers, and casual readers lack this expertise.', 35, 2, 'evaluate', 2, '["Who actually studied this?", "What makes someone an expert?"]'),

  ('q_ct_src_008', 'critical_thinking', 'ct_src_9', 'topic_ct_stats_literacy', 'multiple_choice', 'A headline says "New drug is 50% more effective!" The old drug worked 2% of the time. How effective is the new drug?', '["52%", "50%", "3%", "Cannot determine"]', '3%', '50% MORE than 2% means 2% + (0.5 × 2%) = 2% + 1% = 3%. This is relative increase. The headline sounds impressive but absolute improvement is just 1 percentage point.', 55, 3, 'analyze', 3, '["50% more than what baseline?", "What is 50% of 2%?"]');

-- ============================================================================
-- QUESTION BANK - DECISION MAKING
-- ============================================================================

INSERT INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  ('q_ct_dec_001', 'critical_thinking', 'ct_dec_1', 'topic_ct_expected_value', 'multiple_choice', 'Option A: 100% chance of $10. Option B: 50% chance of $25. Which has higher expected value?', '["Option A", "Option B", "Equal", "Cannot determine"]', 'Option B', 'Expected value = probability × outcome. A: 1.0 × $10 = $10. B: 0.5 × $25 = $12.50. Option B has higher expected value despite the risk.', 40, 2, 'apply', 2, '["Multiply probability by amount", "1.0 × 10 vs 0.5 × 25"]'),

  ('q_ct_dec_002', 'critical_thinking', 'ct_dec_2', 'topic_ct_risk_assess', 'multiple_choice', 'Risk A: 80% chance of minor injury. Risk B: 1% chance of death. Which should you prioritize avoiding?', '["Risk A - its more likely", "Risk B - severity matters more", "Equal priority", "Depends on circumstances"]', 'Depends on circumstances', 'Good answer. Risk = likelihood × severity. Both matter. High probability/low impact vs low probability/high impact require different strategies. Context determines which is worse.', 50, 3, 'evaluate', 3, '["Consider both dimensions", "What matters more in this context?"]'),

  ('q_ct_dec_003', 'critical_thinking', 'ct_dec_3', 'topic_ct_opp_cost', 'multiple_choice', 'You spend 3 hours watching TV. The opportunity cost is:', '["$0 - TV was free", "Whatever you would have done with those 3 hours instead", "The cost of your TV", "The electricity used"]', 'Whatever you would have done with those 3 hours instead', 'Opportunity cost is the value of the next best alternative. Those 3 hours could have been spent studying, exercising, working, etc. Thats what you gave up.', 35, 2, 'understand', 2, '["What else could you have done?", "What did you give up?"]'),

  ('q_ct_dec_004', 'critical_thinking', 'ct_dec_4', 'topic_ct_sunk_cost', 'multiple_choice', 'You paid $100 for a concert ticket. You\'re sick on concert day. Should you go?', '["Yes - you paid $100", "Decide based only on whether going now is worth feeling worse", "The $100 is lost either way", "Both B and C"]', 'Both B and C', 'The $100 is a sunk cost - you cant get it back whether you go or not. Decide based on future consequences: is suffering through the concert worth it? Ignore the sunk cost.', 45, 2, 'apply', 3, '["Can you get the $100 back?", "What matters going forward?"]'),

  ('q_ct_dec_005', 'critical_thinking', 'ct_dec_5', 'topic_ct_reversible', 'multiple_choice', 'Which decision deserves the MOST careful deliberation?', '["What to have for lunch", "Which college to attend", "Which movie to watch", "What shirt to wear"]', 'Which college to attend', 'College choice is largely irreversible and has long-term consequences. The others are easily reversible decisions that deserve less deliberation. Two-way doors can be walked through quickly.', 30, 2, 'evaluate', 2, '["Which can you undo?", "Which has lasting effects?"]'),

  ('q_ct_dec_006', 'critical_thinking', 'ct_dec_6', 'topic_ct_second_order', 'multiple_choice', 'You get a promotion requiring 60-hour work weeks. Second-order thinking considers:', '["The salary increase", "The salary AND impact on health, relationships, and future career", "What your friends think", "The job title"]', 'The salary AND impact on health, relationships, and future career', 'Second-order thinking asks "and then what?" Beyond immediate benefits (salary), consider downstream effects: health from overwork, relationship strain, burnout, opportunity costs.', 45, 2, 'analyze', 3, '["What happens after that?", "What are the downstream effects?"]'),

  ('q_ct_dec_007', 'critical_thinking', 'ct_dec_7', 'topic_ct_base_rate', 'multiple_choice', 'A disease affects 1 in 10,000 people. A test is 99% accurate. You test positive. You should think:', '["I definitely have it - 99% accurate", "I probably dont have it - the base rate is very low", "50/50 chance", "The test is wrong"]', 'I probably dont have it - the base rate is very low', 'With such a low base rate (0.01%), even a 99% accurate test will have many false positives. Most positive results will be false. Bayesian reasoning combines base rate with test accuracy.', 60, 4, 'analyze', 3, '["How rare is the disease?", "How many false positives in 10,000 tests?"]'),

  ('q_ct_dec_008', 'critical_thinking', 'ct_dec_8', 'topic_ct_bayesian', 'multiple_choice', 'You believed something had 50% chance of being true. You see strong evidence FOR it. You should:', '["Now believe it has 100% chance", "Update to higher than 50% but not certainty", "Stay at 50%", "Reject the evidence"]', 'Update to higher than 50% but not certainty', 'Bayesian updating means revising probabilities based on evidence. Strong evidence should increase your confidence, but rarely to 100%. Update toward the evidence but maintain appropriate uncertainty.', 50, 3, 'apply', 3, '["Should evidence change your mind?", "Should you be 100% certain?"]'),

  ('q_ct_dec_009', 'critical_thinking', 'ct_dec_9', 'topic_ct_decision_trees', 'multiple_choice', 'What is the main benefit of drawing a decision tree for complex choices?', '["It makes you look smart", "It forces you to map out all options, probabilities, and outcomes systematically", "Its required for school", "It guarantees the right decision"]', 'It forces you to map out all options, probabilities, and outcomes systematically', 'Decision trees externalize your thinking. By mapping all branches, you avoid overlooking options and can calculate expected values for each path. It clarifies complex decisions.', 40, 2, 'understand', 2, '["What does visualization do?", "How does it help thinking?"]');

-- ============================================================================
-- PREREQUISITES
-- ============================================================================

INSERT INTO hyro_skill_prerequisites (id, skill_id, skill_type, prerequisite_id, prerequisite_type, strength) VALUES
  -- Formal Logic chain
  ('prereq_ct_001', 'topic_ct_and_or', 'topic', 'topic_ct_propositions', 'topic', 'required'),
  ('prereq_ct_002', 'topic_ct_conditional', 'topic', 'topic_ct_and_or', 'topic', 'required'),
  ('prereq_ct_003', 'topic_ct_truth_tables', 'topic', 'topic_ct_conditional', 'topic', 'required'),
  ('prereq_ct_004', 'topic_ct_validity', 'topic', 'topic_ct_propositions', 'topic', 'required'),
  ('prereq_ct_005', 'topic_ct_soundness', 'topic', 'topic_ct_validity', 'topic', 'required'),
  ('prereq_ct_006', 'topic_ct_modus_ponens', 'topic', 'topic_ct_conditional', 'topic', 'required'),
  ('prereq_ct_007', 'topic_ct_modus_tollens', 'topic', 'topic_ct_modus_ponens', 'topic', 'recommended'),
  ('prereq_ct_008', 'topic_ct_contrapositive', 'topic', 'topic_ct_conditional', 'topic', 'required'),

  -- Argument Analysis builds on logic
  ('prereq_ct_009', 'topic_ct_premises', 'topic', 'topic_ct_claims', 'topic', 'required'),
  ('prereq_ct_010', 'topic_ct_evidence_quality', 'topic', 'topic_ct_premises', 'topic', 'required'),
  ('prereq_ct_011', 'topic_ct_counterargs', 'topic', 'topic_ct_evidence_quality', 'topic', 'recommended'),
  ('prereq_ct_012', 'topic_ct_steelman', 'topic', 'topic_ct_counterargs', 'topic', 'recommended'),

  -- First Principles
  ('prereq_ct_013', 'topic_ct_decompose', 'topic', 'topic_ct_what_first_prin', 'topic', 'required'),
  ('prereq_ct_014', 'topic_ct_question_assume', 'topic', 'topic_ct_what_first_prin', 'topic', 'required'),
  ('prereq_ct_015', 'topic_ct_build_up', 'topic', 'topic_ct_decompose', 'topic', 'required'),

  -- Source Evaluation
  ('prereq_ct_016', 'topic_ct_cross_verify', 'topic', 'topic_ct_provenance', 'topic', 'recommended'),
  ('prereq_ct_017', 'topic_ct_conflicts', 'topic', 'topic_ct_bias_detect', 'topic', 'recommended'),

  -- Decision Making
  ('prereq_ct_018', 'topic_ct_risk_assess', 'topic', 'topic_ct_expected_value', 'topic', 'recommended'),
  ('prereq_ct_019', 'topic_ct_bayesian', 'topic', 'topic_ct_base_rate', 'topic', 'required'),
  ('prereq_ct_020', 'topic_ct_decision_trees', 'topic', 'topic_ct_expected_value', 'topic', 'required');
