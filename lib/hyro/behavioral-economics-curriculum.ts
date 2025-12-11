/**
 * Behavioral Economics Curriculum - Hyro Education System
 *
 * @hyro-domain behavioral_economics
 * @hyro-standards BE-1.*, BE-2.*, BE-3.*, BE-4.*
 * @hyro-manifold Integrated with C/E/G through transparency and metacognition
 * @hyro-metacognition Core design principle - every concept taught with WHY
 * @hyro-rationale This curriculum teaches decision-making frameworks and cognitive bias awareness
 *                 with full transparency about why each concept matters.
 *
 * DESIGN PRINCIPLES:
 * 1. Every bias taught includes evolutionary/psychological REASON it exists
 * 2. Students learn WHEN biases help vs. hurt (not all biases are always bad)
 * 3. Practical debiasing strategies are tied to specific contexts
 * 4. Metacognition is woven throughout - students reflect on their own thinking
 */

import type {
  BiasCurriculumEntry,
  BiasType,
  WRAPFramework,
  BEStandard,
  BEStandardId,
  BEQuestion,
} from './behavioral-economics-types';

// =============================================================================
// COGNITIVE BIASES CURRICULUM
// =============================================================================

export const BIAS_CURRICULUM: Record<BiasType, BiasCurriculumEntry> = {
  confirmation_bias: {
    id: 'confirmation_bias',
    name: 'Confirmation Bias',
    definition: 'The tendency to search for, interpret, favor, and recall information in a way that confirms or supports one\'s prior beliefs or values.',
    shortDescription: 'Seeking evidence that confirms what we already believe',

    evolutionaryReason: 'In ancestral environments, questioning every belief was cognitively expensive and potentially dangerous. Trusting established knowledge within your group promoted survival and social cohesion.',
    psychologicalMechanism: 'Confirmation bias reduces cognitive dissonance (the discomfort of holding contradictory beliefs) and protects self-esteem. It\'s easier to find reasons we\'re right than to question our assumptions.',

    adaptiveContexts: [
      'Building on established scientific knowledge (we don\'t re-prove gravity daily)',
      'Maintaining useful heuristics that work most of the time',
      'Preserving valuable cultural knowledge and traditions',
      'Quick decision-making when time is limited',
    ],
    maladaptiveContexts: [
      'Evaluating new evidence that contradicts strongly held beliefs',
      'Making hiring or evaluation decisions (seeking evidence candidate is good/bad)',
      'Diagnosing problems (looking for evidence of suspected cause)',
      'Political and social reasoning',
      'Scientific hypothesis testing',
    ],

    selfRecognitionCues: [
      'Feeling satisfied when finding information that supports your view',
      'Dismissing contradictory evidence as "flawed" without careful analysis',
      'Only seeking out news sources that align with your views',
      'Getting defensive when someone challenges your position',
    ],
    externalIndicators: [
      'Person ignores or dismisses strong counter-evidence',
      'Research strategy only includes confirming sources',
      'Rapid acceptance of weak supporting evidence',
      'Double standards for evidence (harder scrutiny for opposing views)',
    ],

    debiasingStrategies: [
      'Actively seek disconfirming evidence ("What would prove me wrong?")',
      'Pre-commit to evaluation criteria before seeing evidence',
      'Assign someone to play "devil\'s advocate" role',
      'Consider the opposite: Imagine your belief is wrong',
      'Seek out perspectives from people who disagree',
    ],
    practiceScenarios: [
      'Research a political topic using ONLY sources from the opposing view',
      'List 5 reasons your favorite solution might be wrong',
      'Before a debate, write the strongest version of the opposing argument',
    ],

    relatedBiases: ['availability_heuristic', 'self_serving_bias', 'overconfidence_bias'],
    system1vs2: 'both',

    prerequisiteKnowledge: ['Basic understanding of evidence evaluation', 'Awareness that beliefs can be wrong'],
    difficultyLevel: 'foundational',
    commonMisunderstandings: [
      'Thinking confirmation bias only affects "other people"',
      'Believing being aware of it is enough to prevent it',
      'Confusing healthy skepticism with confirmation bias',
    ],
  },

  availability_heuristic: {
    id: 'availability_heuristic',
    name: 'Availability Heuristic',
    definition: 'A mental shortcut that relies on immediate examples that come to mind when evaluating a topic, concept, or decision.',
    shortDescription: 'Judging probability by how easily examples come to mind',

    evolutionaryReason: 'Events that are frequent or impactful are more memorable. Using memory as a proxy for probability usually works because common things are easier to recall. This was computationally efficient for survival.',
    psychologicalMechanism: 'The brain substitutes "How easily can I think of examples?" for "How probable is this?" This substitution is fast and effortless (System 1) but can be misleading when memory is biased.',

    adaptiveContexts: [
      'Estimating frequency of common events in your direct experience',
      'Quick risk assessment in familiar environments',
      'Learning from recent, relevant experiences',
      'Social learning from vivid examples',
    ],
    maladaptiveContexts: [
      'Assessing probability of rare but dramatic events (plane crashes, shark attacks)',
      'Making judgments influenced by recent news coverage',
      'Evaluating risks in unfamiliar domains',
      'Any situation where memorable ≠ frequent',
    ],

    selfRecognitionCues: [
      'Feeling certain about probability based on vivid memories',
      'Recent news stories influencing your risk perception',
      'Overweighting dramatic or emotional events',
      'Struggling to think of counter-examples',
    ],
    externalIndicators: [
      'Probability estimates that match media coverage, not statistics',
      'Over-estimating rare dramatic risks, under-estimating common ones',
      'Decisions heavily influenced by recent events',
    ],

    debiasingStrategies: [
      'Seek out base rates and statistical data',
      'Ask: "Am I basing this on ease of recall or actual frequency?"',
      'Consider what makes some events more memorable than others',
      'Deliberately search for less dramatic counter-examples',
      'Use the "outside view" - look at statistical patterns, not just your experience',
    ],
    practiceScenarios: [
      'Compare your fear of flying vs. driving to actual fatality statistics',
      'Estimate probability of various causes of death, then compare to CDC data',
      'Track media coverage of an event vs. its actual frequency',
    ],

    relatedBiases: ['confirmation_bias', 'hindsight_bias', 'framing_effect'],
    system1vs2: 'system1',

    prerequisiteKnowledge: ['Basic probability concepts', 'Understanding of memory'],
    difficultyLevel: 'foundational',
    commonMisunderstandings: [
      'Thinking vivid memories are more accurate',
      'Confusing "I can imagine it" with "it\'s likely"',
      'Believing media coverage reflects actual risk levels',
    ],
  },

  anchoring_effect: {
    id: 'anchoring_effect',
    name: 'Anchoring Effect',
    definition: 'The tendency to rely too heavily on the first piece of information encountered (the "anchor") when making decisions.',
    shortDescription: 'Over-relying on the first number or information you encounter',

    evolutionaryReason: 'In stable environments, initial information is often informative. Using it as a starting point and adjusting is computationally efficient. The problem is we typically adjust insufficiently.',
    psychologicalMechanism: 'Anchors work through two mechanisms: (1) Insufficient adjustment from the anchor, and (2) Selective activation of anchor-consistent information in memory.',

    adaptiveContexts: [
      'When the anchor is actually informative (expert estimates)',
      'Stable environments where initial data is reliable',
      'Starting negotiations with realistic anchors',
    ],
    maladaptiveContexts: [
      'When anchors are arbitrary or manipulative',
      'Negotiations where the other party sets the anchor',
      'Any numerical estimation without independent analysis first',
      'Performance reviews anchored on previous ratings',
    ],

    selfRecognitionCues: [
      'Final estimate feels "reasonable" relative to initial number',
      'Difficulty imagining significantly different values',
      'Adjustments feel "too extreme" when moving far from anchor',
    ],
    externalIndicators: [
      'Final estimates cluster around initial anchor regardless of relevance',
      'Insufficient adjustment even when anchor is random',
    ],

    debiasingStrategies: [
      'Generate your own anchor BEFORE seeing others',
      'Consider multiple anchors from different sources',
      'Ask: "Would I make the same estimate without this anchor?"',
      'Use ranges instead of point estimates',
      'Deliberately consider extreme alternatives',
    ],
    practiceScenarios: [
      'Estimate a value, then learn the anchor was random - how does that feel?',
      'Practice negotiation with awareness of who sets the first number',
      'Compare estimates made before vs. after seeing irrelevant anchors',
    ],

    relatedBiases: ['status_quo_bias', 'framing_effect'],
    system1vs2: 'system1',

    prerequisiteKnowledge: ['Basic numerical estimation', 'Understanding of negotiation'],
    difficultyLevel: 'foundational',
    commonMisunderstandings: [
      'Thinking you can ignore anchors through willpower',
      'Believing only "relevant" anchors affect judgment',
      'Not recognizing anchors in everyday contexts',
    ],
  },

  loss_aversion: {
    id: 'loss_aversion',
    name: 'Loss Aversion',
    definition: 'The tendency to prefer avoiding losses over acquiring equivalent gains. Losses feel roughly twice as painful as equivalent gains feel good.',
    shortDescription: 'Losses hurt about twice as much as gains feel good',

    evolutionaryReason: 'In ancestral environments with scarce resources, a loss could mean death (losing food, shelter, group membership). Gains were nice but rarely as consequential. This asymmetry made loss-prevention critical for survival.',
    psychologicalMechanism: 'The amygdala (emotional center) responds more strongly to losses than gains. This creates an asymmetric utility function where the pain of losing $100 exceeds the pleasure of gaining $100.',

    adaptiveContexts: [
      'Protecting essential resources for survival',
      'Maintaining valuable relationships',
      'Avoiding irreversible negative outcomes',
      'Being appropriately cautious with high-stakes decisions',
    ],
    maladaptiveContexts: [
      'Holding losing investments too long (to avoid realizing the loss)',
      'Refusing fair gambles with positive expected value',
      'Over-insuring against small losses',
      'Staying in bad situations to avoid loss of sunk costs',
      'Risk-averse behavior when risks are manageable',
    ],

    selfRecognitionCues: [
      'Strong emotional resistance to "realizing" a loss',
      'Asymmetric emotional reactions to gains vs. losses',
      'Difficulty selling losing investments',
      'Preferring "safe" options even when risky option has better expected value',
    ],
    externalIndicators: [
      'Refusing positive expected value gambles',
      'Extreme reactions to small losses',
      'Irrational attachment to possessions (endowment effect)',
    ],

    debiasingStrategies: [
      'Reframe losses as "costs" or "investments"',
      'Consider opportunity cost of avoiding action',
      'Use pre-commitment to prevent loss-averse responses',
      'Calculate expected values mathematically',
      'Ask: "Would I make this choice from a blank slate?"',
    ],
    practiceScenarios: [
      'Track emotional reactions to gains vs. losses over a week',
      'Practice "mental accounting" that frames losses as costs',
      'Analyze past decisions where loss aversion led to poor outcomes',
    ],

    relatedBiases: ['sunk_cost_fallacy', 'status_quo_bias', 'anchoring_effect'],
    system1vs2: 'system1',

    prerequisiteKnowledge: ['Basic expected value calculations', 'Understanding of risk'],
    difficultyLevel: 'foundational',
    commonMisunderstandings: [
      'Thinking loss aversion is always irrational',
      'Confusing loss aversion with risk aversion',
      'Believing awareness eliminates the bias',
    ],
  },

  sunk_cost_fallacy: {
    id: 'sunk_cost_fallacy',
    name: 'Sunk Cost Fallacy',
    definition: 'The tendency to continue a behavior or endeavor because of previously invested resources (time, money, effort) that cannot be recovered.',
    shortDescription: 'Continuing because you\'ve already invested, not because it\'s worth continuing',

    evolutionaryReason: 'In ancestral environments, persistence often paid off. Abandoning partially completed goals meant losing the investment. Also, social pressure to "finish what you started" reinforced consistency.',
    psychologicalMechanism: 'Driven by loss aversion (not wanting to "waste" the investment), consistency motivation (appearing committed), and cognitive dissonance (justifying past decisions).',

    adaptiveContexts: [
      'When persistence genuinely increases chances of success',
      'When signaling commitment is valuable',
      'Learning that requires sustained effort through difficulties',
    ],
    maladaptiveContexts: [
      'Projects where additional investment won\'t improve outcomes',
      'Relationships or jobs that aren\'t working',
      'Financial investments that have declined',
      'Any decision where past costs are truly unrecoverable',
    ],

    selfRecognitionCues: [
      'Justifying continuation with "I\'ve already put so much into this"',
      'Difficulty abandoning projects regardless of current prospects',
      'Emotional attachment to past investments',
      'Continuing to avoid feeling like past effort was "wasted"',
    ],
    externalIndicators: [
      'Escalation of commitment despite negative feedback',
      'Reasoning that references past investment rather than future value',
    ],

    debiasingStrategies: [
      '"Zero-based thinking": If I wasn\'t already invested, would I start now?',
      'Focus only on future costs and benefits',
      'Explicitly state: "The past investment is gone regardless"',
      'Set decision rules in advance (e.g., "If X happens, I\'ll quit")',
      'Get outside perspective from someone not emotionally invested',
    ],
    practiceScenarios: [
      'Identify a current commitment and evaluate it ignoring sunk costs',
      'Practice "kill the project" exercises on past investments',
      'Create pre-commitment rules for future investments',
    ],

    relatedBiases: ['loss_aversion', 'overconfidence_bias'],
    system1vs2: 'both',

    prerequisiteKnowledge: ['Understanding of opportunity cost', 'Basic decision-making'],
    difficultyLevel: 'intermediate',
    commonMisunderstandings: [
      'Thinking sunk costs literally affect future value',
      'Confusing sunk cost fallacy with appropriate persistence',
      'Not recognizing sunk costs in non-monetary investments (time, effort)',
    ],
  },

  fundamental_attribution_error: {
    id: 'fundamental_attribution_error',
    name: 'Fundamental Attribution Error',
    definition: 'The tendency to overemphasize personality-based explanations for others\' behavior while underemphasizing situational factors.',
    shortDescription: 'Attributing others\' behavior to their character while ignoring their situation',

    evolutionaryReason: 'Quickly categorizing others as "good" or "bad" helped make rapid social decisions. Character judgments are more stable and actionable than situational analysis, which requires more information.',
    psychologicalMechanism: 'When observing others, their behavior is salient (foreground) while their situation is less visible (background). We also have asymmetric information - we know our own situations but not others\'.',

    adaptiveContexts: [
      'Making quick judgments about trustworthiness',
      'Identifying consistent personality patterns',
      'Holding people appropriately accountable',
    ],
    maladaptiveContexts: [
      'Evaluating someone in an unusual situation',
      'Making hiring or performance decisions',
      'Understanding why someone behaved "badly"',
      'Cross-cultural interactions where situations differ',
      'Judging people facing circumstances you haven\'t experienced',
    ],

    selfRecognitionCues: [
      'Quick judgments about someone\'s "character"',
      'Asymmetric explanations (your mistakes = situation, their mistakes = character)',
      'Surprise when someone\'s behavior changes in a new context',
    ],
    externalIndicators: [
      'Explanations that focus on personality traits',
      'Little consideration of situational factors',
      'Stable predictions about behavior across very different contexts',
    ],

    debiasingStrategies: [
      'Actively ask: "What situational factors might explain this?"',
      'Imagine yourself in exactly their situation',
      'Consider how the person behaves in different contexts',
      'Ask them about their situation before judging',
      'Apply the same explanatory lens you\'d use for yourself',
    ],
    practiceScenarios: [
      'Analyze a public figure\'s controversial behavior using only situational factors',
      'Track your attributions for others vs. self over a week',
      'Re-analyze a past judgment after learning about the person\'s situation',
    ],

    relatedBiases: ['self_serving_bias', 'halo_effect'],
    system1vs2: 'system1',

    prerequisiteKnowledge: ['Basic social psychology', 'Perspective-taking'],
    difficultyLevel: 'intermediate',
    commonMisunderstandings: [
      'Thinking character and situation are mutually exclusive',
      'Applying this to oneself (we actually do the opposite)',
      'Using it to excuse all bad behavior',
    ],
  },

  hindsight_bias: {
    id: 'hindsight_bias',
    name: 'Hindsight Bias',
    definition: 'The tendency, after an event has occurred, to see it as having been predictable, despite little or no objective basis for predicting it.',
    shortDescription: '"I knew it all along" - but you didn\'t',

    evolutionaryReason: 'Constructing coherent narratives helps learning and memory. Once we know the outcome, our brain efficiently reorganizes memories to make the outcome seem inevitable, which simplifies the story.',
    psychologicalMechanism: 'Memory reconstruction and confirmation bias work together. Outcome knowledge automatically activates supporting evidence while making contradictory information harder to retrieve.',

    adaptiveContexts: [
      'Learning from experience (even if distorted)',
      'Creating coherent narratives for communication',
      'Building confidence in pattern recognition',
    ],
    maladaptiveContexts: [
      'Evaluating past decisions (judging with outcome knowledge)',
      'Learning from mistakes (thinking you "should have known")',
      'Assigning blame or credit for uncertain outcomes',
      'Forecasting future events based on past predictions',
    ],

    selfRecognitionCues: [
      'Events feeling more predictable than they were',
      'Difficulty remembering how uncertain things felt before',
      'Thinking others "should have seen it coming"',
    ],
    externalIndicators: [
      'Overconfident post-hoc explanations',
      'Criticism of decisions that were reasonable given available information',
    ],

    debiasingStrategies: [
      'Document predictions BEFORE events occur',
      'Reconstruct the pre-outcome mindset explicitly',
      'Consider alternative outcomes that seemed plausible',
      'Judge decisions by process, not just outcome',
      'Keep a decision journal with predictions and reasoning',
    ],
    practiceScenarios: [
      'Write predictions, seal them, compare after outcomes',
      'Practice "prospective hindsight" - imagine failure and work backward',
      'Review past predictions to calibrate hindsight',
    ],

    relatedBiases: ['overconfidence_bias', 'confirmation_bias'],
    system1vs2: 'system1',

    prerequisiteKnowledge: ['Understanding of probability', 'Memory basics'],
    difficultyLevel: 'intermediate',
    commonMisunderstandings: [
      'Confusing hindsight bias with genuine predictability',
      'Thinking documented predictions are immune (we misremember even those)',
      'Using it to avoid all accountability',
    ],
  },

  overconfidence_bias: {
    id: 'overconfidence_bias',
    name: 'Overconfidence Bias',
    definition: 'The tendency to be more confident in one\'s judgments, knowledge, and abilities than is warranted by actual performance or evidence.',
    shortDescription: 'Being more certain than you should be',

    evolutionaryReason: 'Confidence facilitates action. In uncertain ancestral environments, confident individuals who acted decisively often survived better than hesitant ones. Confidence also signals competence to others.',
    psychologicalMechanism: 'Multiple sources: limited feedback on predictions, confirmation bias supporting beliefs, motivated reasoning, and genuinely not knowing what we don\'t know.',

    adaptiveContexts: [
      'Motivating action in the face of uncertainty',
      'Inspiring confidence in others (leadership)',
      'Persisting through early difficulties',
      'Social signaling of competence',
    ],
    maladaptiveContexts: [
      'Probability estimates and forecasting',
      'Planning (planning fallacy)',
      'Risk assessment',
      'Any domain where calibration matters',
      'Learning (thinking you know more than you do)',
    ],

    selfRecognitionCues: [
      'High certainty with limited evidence',
      'Narrow confidence intervals on estimates',
      'Surprise when predictions are wrong',
      'Difficulty imagining being wrong',
    ],
    externalIndicators: [
      'Predictions that are too precise',
      'Resistance to updating beliefs with new evidence',
      'History of overconfident predictions',
    ],

    debiasingStrategies: [
      'Track prediction accuracy over time',
      'Use wider confidence intervals',
      'Seek out disconfirming evidence',
      'Ask: "What would have to be true for me to be wrong?"',
      'Get calibrated through practice and feedback',
      'Consider the outside view (base rates)',
    ],
    practiceScenarios: [
      'Make 90% confidence interval predictions, track accuracy',
      'Practice calibration training exercises',
      'Review past predictions and update confidence',
    ],

    relatedBiases: ['confirmation_bias', 'hindsight_bias', 'dunning_kruger_effect'],
    system1vs2: 'both',

    prerequisiteKnowledge: ['Basic probability', 'Understanding of confidence intervals'],
    difficultyLevel: 'intermediate',
    commonMisunderstandings: [
      'Confusing confidence with competence',
      'Thinking calibration training is only for statisticians',
      'Believing humility about knowledge means lack of confidence in action',
    ],
  },

  status_quo_bias: {
    id: 'status_quo_bias',
    name: 'Status Quo Bias',
    definition: 'The tendency to prefer the current state of affairs, even when better alternatives exist and switching costs are low.',
    shortDescription: 'Preferring things as they are, even when change would be better',

    evolutionaryReason: 'In stable environments, change is risky. The current state has proven survivable; changes are uncertain. Preference for status quo conserved energy and avoided unknown risks.',
    psychologicalMechanism: 'Combination of loss aversion (any change involves "losing" current state), effort aversion (change requires cognitive effort), and uncertainty aversion.',

    adaptiveContexts: [
      'When current situation is genuinely optimal',
      'When switching costs exceed benefits',
      'Stable environments where change is truly risky',
      'Preserving valuable traditions and institutions',
    ],
    maladaptiveContexts: [
      'When better alternatives are available',
      'When defaults are not optimized for you',
      'Automatic renewals and subscriptions',
      'Career decisions where staying is easier than exploring',
      'Any situation where you haven\'t actively chosen the status quo',
    ],

    selfRecognitionCues: [
      'Justifying current state without comparing alternatives',
      'Feeling uncomfortable about changes even when beneficial',
      'Not considering options you haven\'t tried',
      'Default options feeling "natural"',
    ],
    externalIndicators: [
      'Sticking with defaults without evaluation',
      'Resistance to change even with clear benefits',
      'Rationalizing current state after the fact',
    ],

    debiasingStrategies: [
      'Ask: "If I wasn\'t already here, would I choose this?"',
      'Actively evaluate alternatives periodically',
      'Consider opportunity cost of not changing',
      'Set reminders to review ongoing commitments',
      'Frame the status quo as an active choice',
    ],
    practiceScenarios: [
      'Audit one recurring commitment - would you start it today?',
      'Practice "fresh start" thinking on a current situation',
      'Review defaults in software and services',
    ],

    relatedBiases: ['loss_aversion', 'sunk_cost_fallacy', 'anchoring_effect'],
    system1vs2: 'system1',

    prerequisiteKnowledge: ['Understanding of defaults', 'Basic decision-making'],
    difficultyLevel: 'foundational',
    commonMisunderstandings: [
      'Thinking all status quo preference is bias (sometimes it\'s optimal)',
      'Confusing stability with stagnation',
      'Not recognizing how defaults shape behavior',
    ],
  },

  dunning_kruger_effect: {
    id: 'dunning_kruger_effect',
    name: 'Dunning-Kruger Effect',
    definition: 'A cognitive bias whereby people with limited knowledge or competence in a domain overestimate their own ability, while experts may underestimate theirs.',
    shortDescription: 'Beginners are overconfident; experts are underconfident',

    evolutionaryReason: 'Limited metacognitive ability in beginners - they don\'t know enough to know what they don\'t know. Experts see all the complexity and nuance, making them appropriately humble.',
    psychologicalMechanism: 'Metacognition (thinking about thinking) requires skill. The same knowledge needed to perform well is needed to recognize good performance. Without it, incompetence masks itself.',

    adaptiveContexts: [
      'Beginner confidence enables trying new things',
      'Expert humility drives continued learning',
    ],
    maladaptiveContexts: [
      'Beginners making important decisions without consulting experts',
      'Experts not sharing valuable knowledge due to excessive humility',
      'Confident incompetence spreading misinformation',
      'Self-assessment for learning and development',
    ],

    selfRecognitionCues: [
      'High confidence early in learning a skill',
      'Decreasing confidence as you learn more',
      '"The more I learn, the less I know"',
      'Surprise at the complexity discovered with expertise',
    ],
    externalIndicators: [
      'Inverse relationship between actual performance and self-assessment in beginners',
      'Experts qualifying statements and acknowledging uncertainty',
    ],

    debiasingStrategies: [
      'Seek feedback from more knowledgeable others',
      'Approach new domains with epistemic humility',
      'Use objective metrics rather than self-assessment',
      'Compare yourself to a higher reference point',
      'Remember past domains where you went through this cycle',
    ],
    practiceScenarios: [
      'Track confidence across learning a new skill',
      'Seek expert feedback in a domain where you feel confident',
      'Reflect on past domains where you were initially overconfident',
    ],

    relatedBiases: ['overconfidence_bias', 'self_serving_bias'],
    system1vs2: 'both',

    prerequisiteKnowledge: ['Metacognition basics', 'Understanding of expertise'],
    difficultyLevel: 'intermediate',
    commonMisunderstandings: [
      'Using it to dismiss all confident non-experts',
      'Thinking it means beginners are always wrong',
      'Not recognizing when you\'re in the "peak of ignorance"',
    ],
  },

  // Additional biases (shorter entries for completeness)
  bandwagon_effect: {
    id: 'bandwagon_effect',
    name: 'Bandwagon Effect',
    definition: 'The tendency to adopt beliefs or behaviors because many other people do the same.',
    shortDescription: 'Following the crowd',
    evolutionaryReason: 'Social conformity promoted group cohesion and survival. Going against the group was risky.',
    psychologicalMechanism: 'Social proof heuristic - assuming others have information we don\'t.',
    adaptiveContexts: ['Learning social norms', 'Efficient information aggregation'],
    maladaptiveContexts: ['Bubbles and manias', 'Mob behavior', 'Fashion over function'],
    selfRecognitionCues: ['Preferring popular options without analysis'],
    externalIndicators: ['Rapid adoption matching trends, not merit'],
    debiasingStrategies: ['Ask: "Would I choose this if no one else had?"', 'Seek contrarian views'],
    practiceScenarios: ['Identify one belief held because it\'s popular'],
    relatedBiases: ['availability_heuristic', 'confirmation_bias'],
    system1vs2: 'system1',
    prerequisiteKnowledge: ['Social influence basics'],
    difficultyLevel: 'foundational',
    commonMisunderstandings: ['Thinking crowd wisdom is always wrong'],
  },

  framing_effect: {
    id: 'framing_effect',
    name: 'Framing Effect',
    definition: 'The tendency to draw different conclusions from the same information depending on how it\'s presented.',
    shortDescription: 'Same facts, different reactions based on presentation',
    evolutionaryReason: 'Context matters for survival - the same information in different contexts means different things.',
    psychologicalMechanism: 'System 1 responds to surface features; reframing activates different emotional and cognitive responses.',
    adaptiveContexts: ['Appropriate emotional responses to context'],
    maladaptiveContexts: ['Marketing manipulation', 'Risk decisions', 'Policy evaluation'],
    selfRecognitionCues: ['Strong reactions to presentation rather than content'],
    externalIndicators: ['Different decisions on equivalent framings'],
    debiasingStrategies: ['Reframe information in multiple ways', 'Strip to base facts'],
    practiceScenarios: ['Present same data as "90% success" vs "10% failure"'],
    relatedBiases: ['loss_aversion', 'anchoring_effect'],
    system1vs2: 'system1',
    prerequisiteKnowledge: ['Basic communication concepts'],
    difficultyLevel: 'foundational',
    commonMisunderstandings: ['Thinking objective presentation is always possible'],
  },

  halo_effect: {
    id: 'halo_effect',
    name: 'Halo Effect',
    definition: 'The tendency for an impression in one area to influence opinion in another area.',
    shortDescription: 'One positive trait makes everything seem positive',
    evolutionaryReason: 'Efficient categorization - if something is good in one way, it might be good in others.',
    psychologicalMechanism: 'Cognitive coherence - we prefer consistent impressions.',
    adaptiveContexts: ['Rapid social evaluation'],
    maladaptiveContexts: ['Hiring decisions', 'Performance reviews', 'Celebrity endorsements'],
    selfRecognitionCues: ['Global impressions overriding specific evidence'],
    externalIndicators: ['Correlated ratings across unrelated dimensions'],
    debiasingStrategies: ['Evaluate traits independently', 'Use structured evaluation'],
    practiceScenarios: ['Rate someone on multiple dimensions before seeing totals'],
    relatedBiases: ['fundamental_attribution_error'],
    system1vs2: 'system1',
    prerequisiteKnowledge: ['Basic evaluation concepts'],
    difficultyLevel: 'foundational',
    commonMisunderstandings: ['Only applies to attractive people'],
  },

  self_serving_bias: {
    id: 'self_serving_bias',
    name: 'Self-Serving Bias',
    definition: 'The tendency to attribute positive outcomes to internal factors (skill) and negative outcomes to external factors (luck, circumstances).',
    shortDescription: 'Taking credit for success, blaming circumstances for failure',
    evolutionaryReason: 'Protects self-esteem and maintains motivation for future attempts.',
    psychologicalMechanism: 'Motivated reasoning + asymmetric attribution.',
    adaptiveContexts: ['Maintaining motivation after failure', 'Mental health protection'],
    maladaptiveContexts: ['Learning from failure', 'Team dynamics', 'Skill development'],
    selfRecognitionCues: ['Asymmetric explanations for success vs. failure'],
    externalIndicators: ['Consistent pattern of external blame'],
    debiasingStrategies: ['Apply same explanatory lens to successes and failures'],
    practiceScenarios: ['Analyze a success - what role did luck play?'],
    relatedBiases: ['fundamental_attribution_error', 'overconfidence_bias'],
    system1vs2: 'both',
    prerequisiteKnowledge: ['Attribution theory basics'],
    difficultyLevel: 'intermediate',
    commonMisunderstandings: ['Thinking it\'s just arrogance'],
  },

  negativity_bias: {
    id: 'negativity_bias',
    name: 'Negativity Bias',
    definition: 'The tendency to give more weight to negative experiences, information, or emotions than positive ones.',
    shortDescription: 'Bad is stronger than good',
    evolutionaryReason: 'Negative events were more consequential for survival - missing a threat = death, missing an opportunity = survivable.',
    psychologicalMechanism: 'Asymmetric neural processing - negative stimuli receive more processing resources.',
    adaptiveContexts: ['Threat detection', 'Risk avoidance', 'Learning from mistakes'],
    maladaptiveContexts: ['Overall life satisfaction', 'Relationship evaluation', 'News consumption'],
    selfRecognitionCues: ['Negative events dominating memory', 'Need multiple positives to offset one negative'],
    externalIndicators: ['Disproportionate focus on criticism vs. praise'],
    debiasingStrategies: ['Deliberately notice and record positive events', 'Ratio awareness (aim for 3-5:1 positive:negative)'],
    practiceScenarios: ['Keep a gratitude journal for one week'],
    relatedBiases: ['loss_aversion', 'availability_heuristic'],
    system1vs2: 'system1',
    prerequisiteKnowledge: ['Emotional awareness'],
    difficultyLevel: 'foundational',
    commonMisunderstandings: ['Thinking it means pessimism is accurate'],
  },
};

// =============================================================================
// WRAP FRAMEWORK (Heath Brothers - Decisive)
// =============================================================================

export const WRAP_FRAMEWORK: WRAPFramework = {
  stages: {
    widen: {
      description: 'Expand your options beyond the obvious. Avoid narrow framing.',
      keyQuestion: 'What OTHER options should I be considering?',
      techniques: [
        {
          id: 'avoid_narrow_framing',
          stage: 'widen',
          name: 'Avoid Narrow Framing',
          description: 'Transform "whether or not" decisions into "which one" decisions',
          howToApply: [
            'If you\'re asking "Should I do X or not?", add options',
            'Generate at least 3 alternatives before choosing',
            'Ask: "What would I do if this option disappeared?"',
          ],
          examplePrompts: [
            'What else could I do instead?',
            'What would happen if I couldn\'t do X?',
            'What are ALL the ways to solve this problem?',
          ],
          commonMistakes: [
            'Comparing only to the status quo',
            'Stopping at the first alternative',
            'Not considering hybrid approaches',
          ],
        },
        {
          id: 'multitrack',
          stage: 'widen',
          name: 'Multitrack',
          description: 'Consider multiple options simultaneously rather than sequentially',
          howToApply: [
            'Develop 2-3 options in parallel',
            'Compare options to each other, not just to status quo',
            'Prevents falling in love with one option too early',
          ],
          examplePrompts: [
            'What if I developed both Option A and Option B?',
            'What are the tradeoffs between these options?',
          ],
          commonMistakes: [
            'Sequential evaluation creates attachment to early options',
            'Not giving each option fair consideration',
          ],
        },
        {
          id: 'find_someone_solved',
          stage: 'widen',
          name: 'Find Someone Who\'s Solved Your Problem',
          description: 'Look for others who have faced similar decisions',
          howToApply: [
            'Seek out people who\'ve made similar decisions',
            'Look for "bright spots" - places where the problem is already solved',
            'Study competitors or analogous situations',
          ],
          examplePrompts: [
            'Who else has faced this decision?',
            'Where is this already working?',
            'What can I learn from similar situations?',
          ],
          commonMistakes: [
            'Thinking your situation is unique',
            'Not looking outside your industry/domain',
          ],
        },
      ],
    },
    reality_test: {
      description: 'Test your assumptions. Get outside your head.',
      keyQuestion: 'How can I get information to check my assumptions?',
      techniques: [
        {
          id: 'consider_opposite',
          stage: 'reality_test',
          name: 'Consider the Opposite',
          description: 'Deliberately seek disconfirming evidence',
          howToApply: [
            'Ask: "What would have to be true for this option to be wrong?"',
            'Assign someone to argue the opposite position',
            'Seek out people who would disagree',
          ],
          examplePrompts: [
            'What evidence would change my mind?',
            'Who would disagree and why?',
            'What am I not seeing?',
          ],
          commonMistakes: [
            'Going through the motions without genuine openness',
            'Dismissing disconfirming evidence too quickly',
          ],
        },
        {
          id: 'zoom_out',
          stage: 'reality_test',
          name: 'Zoom Out (Outside View)',
          description: 'Look at base rates and how similar decisions typically turn out',
          howToApply: [
            'Find base rates for similar situations',
            'Ask: "How do decisions like this usually turn out?"',
            'Consult reference class forecasting',
          ],
          examplePrompts: [
            'What\'s the base rate of success for this type of venture?',
            'What usually happens in situations like this?',
          ],
          commonMistakes: [
            'Thinking your case is special',
            'Using irrelevant base rates',
          ],
        },
        {
          id: 'ooch',
          stage: 'reality_test',
          name: 'Ooch (Small Experiments)',
          description: 'Run small tests to gain information before committing',
          howToApply: [
            'Find the smallest test that gives useful information',
            'Prototype, pilot, or test before full commitment',
            'Gather real-world data, not just predictions',
          ],
          examplePrompts: [
            'How can I try this on a small scale first?',
            'What\'s the cheapest way to learn if this works?',
          ],
          commonMistakes: [
            'Testing at too large a scale',
            'Not defining success criteria in advance',
          ],
        },
      ],
    },
    attain_distance: {
      description: 'Overcome short-term emotion. Get perspective.',
      keyQuestion: 'How would I feel about this decision later?',
      techniques: [
        {
          id: 'ten_ten_ten',
          stage: 'attain_distance',
          name: '10/10/10',
          description: 'Consider how you\'ll feel about this decision at different time horizons',
          howToApply: [
            'Ask: "How will I feel about this in 10 minutes?"',
            '"How will I feel in 10 months?"',
            '"How will I feel in 10 years?"',
          ],
          examplePrompts: [
            'Ten minutes from now, how will I feel?',
            'Ten months from now, will this matter?',
            'Ten years from now, what will I wish I had done?',
          ],
          commonMistakes: [
            'Not taking the exercise seriously',
            'Confusing current emotions with predictions',
          ],
        },
        {
          id: 'best_friend_test',
          stage: 'attain_distance',
          name: 'Best Friend Test',
          description: 'What would you tell your best friend to do?',
          howToApply: [
            'Imagine your best friend in your situation',
            'What advice would you give them?',
            'Apply that advice to yourself',
          ],
          examplePrompts: [
            'If my best friend were in this situation, what would I tell them?',
            'Why wouldn\'t I follow my own advice?',
          ],
          commonMistakes: [
            'Not being honest about what you\'d actually advise',
            'Ignoring the advice you generate',
          ],
        },
        {
          id: 'successor_test',
          stage: 'attain_distance',
          name: 'Successor Test',
          description: 'What would your successor do?',
          howToApply: [
            'Imagine someone new came into your role',
            'What would they do with fresh eyes?',
            'Remove yourself from sunk costs and history',
          ],
          examplePrompts: [
            'If I were replaced tomorrow, what would my successor do?',
            'What am I holding onto that doesn\'t make sense?',
          ],
          commonMistakes: [
            'Not committing to the fresh perspective',
            'Defending current state out of ego',
          ],
        },
      ],
    },
    prepare_wrong: {
      description: 'Anticipate what could go wrong. Plan for the unexpected.',
      keyQuestion: 'What if I\'m wrong about this?',
      techniques: [
        {
          id: 'bookending',
          stage: 'prepare_wrong',
          name: 'Bookending the Future',
          description: 'Consider both best-case and worst-case scenarios',
          howToApply: [
            'Vividly imagine the best case - what leads to it?',
            'Vividly imagine the worst case - what leads to it?',
            'Prepare for both',
          ],
          examplePrompts: [
            'What\'s the best that could happen? How do I get there?',
            'What\'s the worst that could happen? How do I prevent/handle it?',
          ],
          commonMistakes: [
            'Only considering average case',
            'Dismissing extreme scenarios',
          ],
        },
        {
          id: 'tripwires',
          stage: 'prepare_wrong',
          name: 'Set Tripwires',
          description: 'Establish conditions that will trigger reconsideration',
          howToApply: [
            'Define specific, measurable conditions to reconsider',
            'Commit to action if tripwire is hit',
            'Don\'t rely on noticing gradually',
          ],
          examplePrompts: [
            'At what point should I reconsider this decision?',
            'What would make me change course?',
            'What are my "get out" conditions?',
          ],
          commonMistakes: [
            'Setting vague tripwires',
            'Ignoring tripwires when hit',
            'Moving tripwires when approached',
          ],
        },
        {
          id: 'premortem',
          stage: 'prepare_wrong',
          name: 'Premortem',
          description: 'Imagine the decision has failed. Work backward to understand why.',
          howToApply: [
            'Imagine it\'s 6 months later and the decision failed spectacularly',
            'Ask: "Why did it fail?"',
            'Work backward to identify risks to address now',
          ],
          examplePrompts: [
            'Imagine this has failed completely. What went wrong?',
            'What risks did we not see coming?',
          ],
          commonMistakes: [
            'Not committing to the failure scenario',
            'Identifying risks but not addressing them',
          ],
        },
      ],
    },
  },
};

// =============================================================================
// BEHAVIORAL ECONOMICS STANDARDS
// =============================================================================

export const BE_STANDARDS: Record<BEStandardId, BEStandard> = {
  'BE-1.1': {
    id: 'BE-1.1',
    category: 'biases',
    title: 'Identify Confirmation Bias',
    description: 'Students can identify confirmation bias in themselves and others, understanding when it helps vs. hurts decision-making.',
    performanceIndicators: [
      'Recognize confirmation bias in described scenarios',
      'Identify personal instances of confirmation bias',
      'Explain why confirmation bias exists (evolutionary/psychological)',
      'Apply debiasing strategies in practice scenarios',
    ],
    prerequisites: [],
    assessmentTypes: ['scenario', 'reflection', 'application'],
    difficultyLevels: {
      recognition: 'Identify confirmation bias in a scenario',
      understanding: 'Explain why confirmation bias exists and when it\'s useful',
      application: 'Apply debiasing strategies in novel situations',
      transfer: 'Recognize confirmation bias in unfamiliar domains',
      creation: 'Design processes that mitigate confirmation bias',
    },
    manifoldDimensions: {
      coherence: 10,
      entropy: 15,
      generativity: 5,
    },
  },
  'BE-1.2': {
    id: 'BE-1.2',
    category: 'biases',
    title: 'Apply Availability Heuristic Awareness',
    description: 'Students understand the availability heuristic and can correct for it in probability judgments.',
    performanceIndicators: [
      'Explain the availability heuristic',
      'Identify when ease of recall might bias judgment',
      'Seek base rates to correct availability-based estimates',
    ],
    prerequisites: ['BE-1.1'],
    assessmentTypes: ['scenario', 'prediction', 'application'],
    difficultyLevels: {
      recognition: 'Identify availability heuristic in examples',
      understanding: 'Explain the evolutionary basis',
      application: 'Correct probability estimates using base rates',
      transfer: 'Apply to unfamiliar risk domains',
      creation: 'Design prompts that correct for availability bias',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 10,
      generativity: 5,
    },
  },
  'BE-1.3': {
    id: 'BE-1.3',
    category: 'biases',
    title: 'Recognize and Adjust for Anchoring',
    description: 'Students can recognize anchoring effects and apply strategies to reduce anchor influence.',
    performanceIndicators: [
      'Explain anchoring mechanism',
      'Identify anchors in negotiation and estimation',
      'Generate independent estimates before seeing anchors',
    ],
    prerequisites: ['BE-1.1'],
    assessmentTypes: ['scenario', 'application'],
    difficultyLevels: {
      recognition: 'Identify anchors in scenarios',
      understanding: 'Explain why anchors affect judgment',
      application: 'Generate estimates before seeing anchors',
      transfer: 'Recognize anchors in subtle contexts',
      creation: 'Design anchor-resistant processes',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 5,
      generativity: 10,
    },
  },
  'BE-1.4': {
    id: 'BE-1.4',
    category: 'biases',
    title: 'Understand Loss Aversion in Decision-Making',
    description: 'Students understand loss aversion and can reframe decisions to reduce its distorting effects.',
    performanceIndicators: [
      'Explain loss aversion and its evolutionary basis',
      'Identify when loss aversion affects decisions',
      'Reframe losses to enable more rational decisions',
    ],
    prerequisites: ['BE-1.1'],
    assessmentTypes: ['scenario', 'reflection', 'application'],
    difficultyLevels: {
      recognition: 'Identify loss aversion in examples',
      understanding: 'Explain the ~2x asymmetry',
      application: 'Reframe a loss-averse decision',
      transfer: 'Recognize loss aversion in unfamiliar contexts',
      creation: 'Design choice architectures that mitigate loss aversion',
    },
    manifoldDimensions: {
      coherence: 10,
      entropy: 15,
      generativity: 5,
    },
  },
  'BE-1.5': {
    id: 'BE-1.5',
    category: 'biases',
    title: 'Identify Sunk Cost Fallacy Patterns',
    description: 'Students can identify sunk cost reasoning and apply zero-based thinking.',
    performanceIndicators: [
      'Explain sunk cost fallacy',
      'Identify sunk cost reasoning in decisions',
      'Apply zero-based thinking ("if I wasn\'t here, would I start?")',
    ],
    prerequisites: ['BE-1.4'],
    assessmentTypes: ['scenario', 'reflection', 'application'],
    difficultyLevels: {
      recognition: 'Identify sunk cost reasoning',
      understanding: 'Explain why it\'s a fallacy',
      application: 'Apply zero-based thinking to own decisions',
      transfer: 'Recognize sunk costs in non-financial domains',
      creation: 'Design pre-commitment rules',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 10,
      generativity: 10,
    },
  },
  'BE-2.1': {
    id: 'BE-2.1',
    category: 'frameworks',
    title: 'Apply WRAP Process to Complex Decisions',
    description: 'Students can apply the complete WRAP decision framework to complex decisions.',
    performanceIndicators: [
      'Explain each stage of WRAP',
      'Apply appropriate techniques at each stage',
      'Complete a structured decision analysis using WRAP',
    ],
    prerequisites: ['BE-1.1', 'BE-1.2', 'BE-1.3', 'BE-1.4', 'BE-1.5'],
    assessmentTypes: ['application', 'transfer'],
    difficultyLevels: {
      recognition: 'Identify WRAP stages',
      understanding: 'Explain why each stage matters',
      application: 'Apply WRAP to a provided decision',
      transfer: 'Apply WRAP to personal decisions',
      creation: 'Adapt WRAP for specific contexts',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 15,
      generativity: 15,
    },
  },
  'BE-2.2': {
    id: 'BE-2.2',
    category: 'frameworks',
    title: 'Use 10/10/10 for Emotional Distance',
    description: 'Students can apply the 10/10/10 technique to gain emotional perspective on decisions.',
    performanceIndicators: [
      'Apply 10/10/10 to a decision',
      'Recognize when emotional distance is needed',
      'Use temporal perspective to reduce present bias',
    ],
    prerequisites: ['BE-2.1'],
    assessmentTypes: ['reflection', 'application'],
    difficultyLevels: {
      recognition: 'Explain 10/10/10 technique',
      understanding: 'Understand why temporal distance helps',
      application: 'Apply to a current decision',
      transfer: 'Recognize when to use the technique',
      creation: 'Develop personal distance-gaining techniques',
    },
    manifoldDimensions: {
      coherence: 10,
      entropy: 20,
      generativity: 10,
    },
  },
  'BE-2.3': {
    id: 'BE-2.3',
    category: 'frameworks',
    title: 'Implement Pre-Commitment Strategies',
    description: 'Students can design and implement pre-commitment strategies to overcome predictable biases.',
    performanceIndicators: [
      'Explain the logic of pre-commitment',
      'Identify situations requiring pre-commitment',
      'Design effective pre-commitment strategies',
    ],
    prerequisites: ['BE-1.4', 'BE-1.5'],
    assessmentTypes: ['application', 'transfer'],
    difficultyLevels: {
      recognition: 'Identify pre-commitment in examples',
      understanding: 'Explain why pre-commitment works',
      application: 'Design pre-commitment for a scenario',
      transfer: 'Apply to personal decision contexts',
      creation: 'Create novel pre-commitment mechanisms',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 5,
      generativity: 20,
    },
  },
  'BE-2.4': {
    id: 'BE-2.4',
    category: 'frameworks',
    title: 'Create Effective Tripwires',
    description: 'Students can create specific, actionable tripwires for ongoing decisions.',
    performanceIndicators: [
      'Define tripwires with specific, measurable criteria',
      'Commit to action if tripwire is triggered',
      'Review and adjust tripwires appropriately',
    ],
    prerequisites: ['BE-2.1', 'BE-2.3'],
    assessmentTypes: ['application', 'transfer'],
    difficultyLevels: {
      recognition: 'Identify tripwires in examples',
      understanding: 'Explain why tripwires help',
      application: 'Create tripwires for a decision',
      transfer: 'Apply to ongoing personal decisions',
      creation: 'Design tripwire systems for organizations',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 10,
      generativity: 15,
    },
  },
  'BE-3.1': {
    id: 'BE-3.1',
    category: 'calibration',
    title: 'Make Calibrated Probability Estimates',
    description: 'Students can make probability estimates that are calibrated (90% confidence intervals contain truth ~90% of the time).',
    performanceIndicators: [
      'Understand calibration concept',
      'Make probability estimates with appropriate confidence',
      'Track and improve calibration over time',
    ],
    prerequisites: ['BE-1.1'],
    assessmentTypes: ['prediction', 'reflection'],
    difficultyLevels: {
      recognition: 'Explain what calibration means',
      understanding: 'Understand overconfidence patterns',
      application: 'Make calibrated estimates in practice',
      transfer: 'Apply to unfamiliar estimation domains',
      creation: 'Design calibration training exercises',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 15,
      generativity: 5,
    },
  },
  'BE-3.2': {
    id: 'BE-3.2',
    category: 'calibration',
    title: 'Track and Improve Prediction Accuracy',
    description: 'Students maintain prediction records and use them to improve forecasting ability.',
    performanceIndicators: [
      'Make explicit predictions',
      'Track prediction accuracy over time',
      'Identify patterns in prediction errors',
      'Adjust based on feedback',
    ],
    prerequisites: ['BE-3.1'],
    assessmentTypes: ['prediction', 'reflection'],
    difficultyLevels: {
      recognition: 'Explain importance of tracking',
      understanding: 'Understand feedback loops',
      application: 'Maintain prediction journal',
      transfer: 'Apply tracking to new domains',
      creation: 'Design prediction tracking systems',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 20,
      generativity: 10,
    },
  },
  'BE-3.3': {
    id: 'BE-3.3',
    category: 'calibration',
    title: 'Distinguish Skill from Luck in Outcomes',
    description: 'Students can analyze outcomes to separate skill and luck components.',
    performanceIndicators: [
      'Understand skill-luck spectrum',
      'Identify skill vs. luck in outcomes',
      'Evaluate decisions by process, not just outcome',
    ],
    prerequisites: ['BE-3.1', 'BE-3.2'],
    assessmentTypes: ['scenario', 'reflection'],
    difficultyLevels: {
      recognition: 'Identify skill vs. luck in examples',
      understanding: 'Explain resulting fallacy',
      application: 'Analyze personal outcomes',
      transfer: 'Apply to unfamiliar domains',
      creation: 'Design luck-accounting systems',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 15,
      generativity: 10,
    },
  },
  'BE-3.4': {
    id: 'BE-3.4',
    category: 'calibration',
    title: 'Maintain Decision Journals Effectively',
    description: 'Students maintain effective decision journals that capture pre-decision thinking.',
    performanceIndicators: [
      'Document decisions with pre-outcome reasoning',
      'Review decisions to learn from process',
      'Avoid hindsight bias in review',
    ],
    prerequisites: ['BE-3.2', 'BE-2.1'],
    assessmentTypes: ['reflection', 'application'],
    difficultyLevels: {
      recognition: 'Explain decision journal purpose',
      understanding: 'Understand hindsight bias prevention',
      application: 'Maintain personal decision journal',
      transfer: 'Apply to team/organizational decisions',
      creation: 'Design decision journal templates',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 10,
      generativity: 15,
    },
  },
  'BE-4.1': {
    id: 'BE-4.1',
    category: 'metacognition',
    title: 'Predict Own Learning and Performance',
    description: 'Students can accurately predict their own learning and performance before assessments.',
    performanceIndicators: [
      'Make explicit predictions before learning/testing',
      'Compare predictions to actual outcomes',
      'Identify patterns in prediction errors',
    ],
    prerequisites: [],
    assessmentTypes: ['prediction', 'reflection'],
    difficultyLevels: {
      recognition: 'Understand prediction value',
      understanding: 'Recognize illusions of knowledge',
      application: 'Make calibrated self-predictions',
      transfer: 'Apply to new learning domains',
      creation: 'Design self-prediction systems',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 15,
      generativity: 10,
    },
  },
  'BE-4.2': {
    id: 'BE-4.2',
    category: 'metacognition',
    title: 'Monitor Comprehension in Real-Time',
    description: 'Students can monitor their own comprehension during learning and identify confusion.',
    performanceIndicators: [
      'Notice when understanding breaks down',
      'Identify specific points of confusion',
      'Take corrective action (re-read, ask questions)',
    ],
    prerequisites: ['BE-4.1'],
    assessmentTypes: ['reflection', 'application'],
    difficultyLevels: {
      recognition: 'Explain comprehension monitoring',
      understanding: 'Understand monitoring signals',
      application: 'Monitor during learning',
      transfer: 'Apply to unfamiliar content',
      creation: 'Design comprehension checkpoints',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 10,
      generativity: 15,
    },
  },
  'BE-4.3': {
    id: 'BE-4.3',
    category: 'metacognition',
    title: 'Evaluate Learning Strategy Effectiveness',
    description: 'Students can evaluate which learning strategies work best for them in different contexts.',
    performanceIndicators: [
      'Try multiple learning strategies',
      'Compare effectiveness across strategies',
      'Match strategies to learning contexts',
    ],
    prerequisites: ['BE-4.1', 'BE-4.2'],
    assessmentTypes: ['reflection', 'application'],
    difficultyLevels: {
      recognition: 'Identify learning strategies',
      understanding: 'Understand strategy effectiveness research',
      application: 'Test strategies personally',
      transfer: 'Apply to new learning domains',
      creation: 'Design personal learning optimization',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 15,
      generativity: 20,
    },
  },
  'BE-4.4': {
    id: 'BE-4.4',
    category: 'metacognition',
    title: 'Regulate Learning Based on Feedback',
    description: 'Students can adjust their learning approach based on feedback and performance.',
    performanceIndicators: [
      'Interpret feedback accurately',
      'Adjust effort and strategy based on feedback',
      'Persist appropriately vs. change approach',
    ],
    prerequisites: ['BE-4.2', 'BE-4.3'],
    assessmentTypes: ['reflection', 'application', 'transfer'],
    difficultyLevels: {
      recognition: 'Explain regulation purpose',
      understanding: 'Understand feedback utilization',
      application: 'Regulate based on actual feedback',
      transfer: 'Apply to new learning contexts',
      creation: 'Design feedback-responsive learning systems',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 20,
      generativity: 15,
    },
  },
};

// Export all for easy importing
export default {
  BIAS_CURRICULUM,
  WRAP_FRAMEWORK,
  BE_STANDARDS,
};
