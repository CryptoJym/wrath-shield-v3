/**
 * Neuroscience Curriculum - Hyro Education System
 *
 * @hyro-domain brain_based_learning
 * @hyro-standards NS-MEM-*, NS-ATT-*, NS-EMO-*, NS-MOT-*, NS-META-*, NS-PLAST-*
 * @hyro-manifold Integrates with all meta-dimensions
 * @hyro-rationale Evidence-based neuroscience principles for learning optimization
 *
 * KEY RESEARCHERS INTEGRATED:
 * - Michael Gazzaniga: Interpreter module, split-brain research
 * - David Eagleman: Neuroplasticity, time perception, livewiring
 * - Joseph LeDoux: Emotional brain, amygdala, anxiety
 * - Robert Sapolsky: Stress, dopamine, behavioral biology
 * - Stanislas Dehaene: Conscious access, reading/number sense
 * - Barbara Oakley: Learning how to learn, focused/diffuse modes
 */

import type {
  NeurosciencePrinciple,
  NSStandard,
  NSStandardId,
  NSExercise,
  NSSelfExperiment,
  PlasticityEnhancer,
  EmotionRegulationStrategy,
  BrainOptimizedSession,
  SleepStage,
  CircadianLearningWindow,
  BrainSystem,
  NeurotransmitterSystem,
  LearningMode,
} from './neuroscience-types';

// =============================================================================
// CORE NEUROSCIENCE PRINCIPLES
// =============================================================================

export const NEUROSCIENCE_PRINCIPLES: NeurosciencePrinciple[] = [
  // ===== MEMORY PRINCIPLES =====
  {
    id: 'principle-spacing-effect',
    name: 'The Spacing Effect',
    category: 'memory',
    description: 'Information is better retained when learning sessions are spread out over time rather than massed together. This leverages memory consolidation processes during sleep and allows for retrieval practice.',
    brainMechanisms: [
      'Repeated consolidation cycles strengthen synaptic connections',
      'Each retrieval attempt strengthens memory trace',
      'Sleep-dependent memory consolidation between sessions',
      'Contextual variation across sessions enhances encoding',
    ],
    brainSystems: ['hippocampus', 'prefrontal_cortex', 'temporal_cortex'],
    neurotransmitters: ['glutamate', 'acetylcholine', 'dopamine'],
    keyResearchers: ['Hermann Ebbinghaus', 'Robert Bjork', 'Nate Kornell'],
    keyCitations: [
      'Ebbinghaus, H. (1885). Memory: A Contribution to Experimental Psychology',
      'Cepeda et al. (2006). Distributed practice in verbal recall tasks',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Distributed practice produces 10-30% better retention than massed practice',
      'Optimal spacing increases with retention interval desired',
      'Forgetting between sessions is actually beneficial',
    ],
    teachingStrategies: [
      'Build spaced review into curriculum design',
      'Use spaced repetition software (Anki, etc.)',
      'Schedule cumulative assessments',
    ],
    studentStrategies: [
      'Study a topic, then return to it days later',
      'Use flashcard apps with spaced repetition algorithms',
      'Plan study sessions across multiple days before tests',
    ],
    commonMisapplications: [
      'Spacing too close together (needs adequate gap)',
      'Only spacing practice, not initial learning',
      'Abandoning material that feels forgotten',
    ],
    relevantMetaDimensions: ['gradient_awareness', 'entropy_intuition'],
    cegEffects: { coherence: 15, entropy: -10, generativity: 5 },
  },

  {
    id: 'principle-retrieval-practice',
    name: 'The Testing Effect / Retrieval Practice',
    category: 'memory',
    description: 'Actively retrieving information from memory strengthens the memory trace more than passive re-studying. The effort of retrieval is what produces the learning benefit.',
    brainMechanisms: [
      'Retrieval strengthens neural pathways to the memory',
      'Creates additional retrieval routes',
      'Identifies gaps in knowledge for targeted study',
      'Engages elaborative processing during search',
    ],
    brainSystems: ['hippocampus', 'prefrontal_cortex', 'anterior_cingulate'],
    neurotransmitters: ['glutamate', 'dopamine', 'norepinephrine'],
    keyResearchers: ['Henry Roediger', 'Jeffrey Karpicke', 'Mark McDaniel'],
    keyCitations: [
      'Roediger & Karpicke (2006). Test-enhanced learning',
      'Karpicke & Roediger (2008). The critical importance of retrieval for learning',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Testing produces better retention than restudying (even with no feedback)',
      'Difficulty of retrieval correlates with learning benefit',
      'Works for both factual and conceptual knowledge',
    ],
    teachingStrategies: [
      'Use frequent low-stakes quizzes',
      'Ask students to recall before re-presenting material',
      'Implement "retrieval practice warm-ups"',
    ],
    studentStrategies: [
      'Close the book and try to recall key points',
      'Use flashcards actively, not passively',
      'Write summaries from memory before checking notes',
      'Practice explaining concepts without looking',
    ],
    commonMisapplications: [
      'Only using recognition tests (multiple choice) instead of recall',
      'Checking answers too quickly without effortful retrieval',
      'Avoiding testing because it feels harder',
    ],
    relevantMetaDimensions: ['gradient_awareness', 'multi_model_coherence'],
    cegEffects: { coherence: 20, entropy: -8, generativity: 10 },
  },

  {
    id: 'principle-interleaving',
    name: 'Interleaving',
    category: 'memory',
    description: 'Mixing different topics, problem types, or skills during practice leads to better long-term retention and transfer than blocked practice of one type at a time.',
    brainMechanisms: [
      'Forces discrimination between problem types',
      'Strengthens retrieval of appropriate strategies',
      'Prevents contextual interference from aiding performance artificially',
      'Builds flexible mental representations',
    ],
    brainSystems: ['prefrontal_cortex', 'basal_ganglia', 'parietal_cortex'],
    neurotransmitters: ['dopamine', 'norepinephrine', 'acetylcholine'],
    keyResearchers: ['Doug Rohrer', 'Kelli Taylor', 'Robert Bjork'],
    keyCitations: [
      'Rohrer & Taylor (2007). The shuffling of mathematics problems improves learning',
      'Kornell & Bjork (2008). Learning concepts and categories',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Blocked practice feels easier but produces worse long-term learning',
      'Interleaving forces learners to identify problem types',
      'Most beneficial when items are somewhat similar (require discrimination)',
    ],
    teachingStrategies: [
      'Mix problem types in homework assignments',
      'Spiral curriculum design',
      'Cumulative tests covering multiple units',
    ],
    studentStrategies: [
      'Mix up practice problems from different chapters',
      'Alternate between subjects during study sessions',
      'Shuffle flashcard decks',
    ],
    commonMisapplications: [
      'Switching too frequently (need enough practice per item)',
      'Interleaving completely unrelated material',
      'Abandoning because performance feels worse',
    ],
    relevantMetaDimensions: ['manifold_fluidity', 'multi_model_coherence'],
    cegEffects: { coherence: 12, entropy: 5, generativity: 15 },
  },

  {
    id: 'principle-sleep-consolidation',
    name: 'Sleep-Dependent Memory Consolidation',
    category: 'memory',
    description: 'Sleep plays a critical role in consolidating memories from temporary hippocampal storage to long-term cortical storage. Different sleep stages consolidate different types of memory.',
    brainMechanisms: [
      'Hippocampal replay during slow-wave sleep transfers memories to cortex',
      'Sleep spindles bind new memories to existing knowledge',
      'REM sleep consolidates procedural and emotional memories',
      'Synaptic homeostasis theory: sleep prunes weak connections',
    ],
    brainSystems: ['hippocampus', 'prefrontal_cortex', 'temporal_cortex', 'basal_ganglia'],
    neurotransmitters: ['acetylcholine', 'gaba', 'norepinephrine'],
    keyResearchers: ['Matthew Walker', 'Robert Stickgold', 'Giulio Tononi'],
    keyCitations: [
      'Walker, M. (2017). Why We Sleep',
      'Stickgold & Walker (2013). Sleep-dependent memory triage',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Studying before sleep enhances consolidation',
      'Sleep deprivation dramatically impairs learning',
      'Naps can provide consolidation benefits',
    ],
    teachingStrategies: [
      'Avoid early morning tests when possible',
      'Educate students about sleep importance',
      'Consider sleep in homework load planning',
    ],
    studentStrategies: [
      'Review key material before bed',
      'Prioritize 7-9 hours of sleep',
      'Consider a brief nap after learning difficult material',
      'Avoid all-night cramming sessions',
    ],
    commonMisapplications: [
      'Believing one can "catch up" on sleep',
      'Using devices before bed (disrupts sleep quality)',
      'Sacrificing sleep for more study time',
    ],
    relevantMetaDimensions: ['gradient_awareness', 'entropy_intuition'],
    cegEffects: { coherence: 25, entropy: -20, generativity: 10 },
  },

  // ===== ATTENTION PRINCIPLES =====
  {
    id: 'principle-cognitive-load',
    name: 'Cognitive Load Theory',
    category: 'attention',
    description: 'Working memory has limited capacity. Effective learning requires managing cognitive load to prevent overload while maintaining productive engagement.',
    brainMechanisms: [
      'Prefrontal cortex has limited active maintenance capacity',
      'Overload causes information loss and stress response',
      'Chunking can expand effective capacity',
      'Expertise reduces load through automatization',
    ],
    brainSystems: ['prefrontal_cortex', 'parietal_cortex', 'anterior_cingulate'],
    neurotransmitters: ['dopamine', 'norepinephrine', 'cortisol'],
    keyResearchers: ['John Sweller', 'Richard Mayer', 'Paul Chandler'],
    keyCitations: [
      'Sweller, J. (1988). Cognitive load during problem solving',
      'Mayer, R. (2009). Multimedia Learning',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Working memory holds approximately 4±1 chunks',
      'Extraneous load should be minimized',
      'Intrinsic load can be managed through sequencing',
      'Germane load (productive effort) should be optimized',
    ],
    teachingStrategies: [
      'Reduce split attention (integrate text and visuals)',
      'Remove seductive details',
      'Sequence from simple to complex',
      'Pre-train component skills',
    ],
    studentStrategies: [
      'Break complex material into smaller parts',
      'Master prerequisites before advanced topics',
      'Remove distractions while learning',
      'Take notes to offload working memory',
    ],
    commonMisapplications: [
      'Making things too easy (underload)',
      'Assuming all simplification is good',
      'Ignoring individual differences in capacity',
    ],
    relevantMetaDimensions: ['gradient_awareness', 'manifold_fluidity'],
    cegEffects: { coherence: 15, entropy: -15, generativity: 5 },
  },

  {
    id: 'principle-focused-diffuse',
    name: 'Focused and Diffuse Modes',
    category: 'attention',
    description: 'The brain alternates between focused (task-positive) and diffuse (default mode) states. Both are essential for learning—focused for deliberate practice, diffuse for insight and consolidation.',
    brainMechanisms: [
      'Task-positive network (TPN) for focused attention',
      'Default mode network (DMN) for mind-wandering and insight',
      'TPN and DMN are anti-correlated',
      'Creative insights often emerge during DMN activity',
    ],
    brainSystems: ['prefrontal_cortex', 'parietal_cortex', 'default_mode_network', 'salience_network'],
    neurotransmitters: ['norepinephrine', 'dopamine', 'acetylcholine'],
    keyResearchers: ['Barbara Oakley', 'Marcus Raichle', 'Jonathan Schooler'],
    keyCitations: [
      'Oakley, B. (2014). A Mind for Numbers',
      'Raichle et al. (2001). A default mode of brain function',
    ],
    evidenceStrength: 'moderate',
    learningImplications: [
      'Sustained focus depletes and needs recovery',
      'Breaks allow diffuse processing of difficult material',
      'Sleep allows extended diffuse processing',
      'Alternating modes produces better learning than either alone',
    ],
    teachingStrategies: [
      'Build break time into lessons',
      'Introduce problem before teaching solution (let diffuse mode work)',
      'Allow think time before calling on students',
    ],
    studentStrategies: [
      'Use Pomodoro technique (25 min focus, 5 min break)',
      'When stuck, take a walk or do something else',
      'Start difficult homework early to allow diffuse processing',
      'Sleep on difficult problems',
    ],
    commonMisapplications: [
      'Using phone during "breaks" (prevents diffuse mode)',
      'Never allowing mind to wander',
      'Forcing focus when exhausted',
    ],
    relevantMetaDimensions: ['manifold_fluidity', 'entropy_intuition'],
    cegEffects: { coherence: 10, entropy: 10, generativity: 20 },
  },

  // ===== EMOTION PRINCIPLES =====
  {
    id: 'principle-yerkes-dodson',
    name: 'Yerkes-Dodson Law (Optimal Arousal)',
    category: 'emotion',
    description: 'Performance follows an inverted-U relationship with arousal. Moderate arousal optimizes performance, while too little or too much impairs it. The optimal level varies by task complexity.',
    brainMechanisms: [
      'Norepinephrine modulates prefrontal cortex function',
      'Low arousal: insufficient attention and motivation',
      'High arousal: amygdala dominance, prefrontal suppression',
      'Optimal arousal: balanced prefrontal-limbic interaction',
    ],
    brainSystems: ['prefrontal_cortex', 'amygdala', 'anterior_cingulate', 'insula'],
    neurotransmitters: ['norepinephrine', 'cortisol', 'dopamine'],
    keyResearchers: ['Robert Yerkes', 'John Dodson', 'Joseph LeDoux'],
    keyCitations: [
      'Yerkes & Dodson (1908). The relation of strength of stimulus to rapidity of habit-formation',
      'LeDoux, J. (1996). The Emotional Brain',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Some stress/challenge enhances learning',
      'Excessive stress impairs complex cognition',
      'Simple tasks tolerate higher arousal than complex tasks',
      'Individual differences in optimal arousal level',
    ],
    teachingStrategies: [
      'Calibrate challenge to student level',
      'Create safe environment for productive struggle',
      'Provide stress management techniques before high-stakes tests',
    ],
    studentStrategies: [
      'Learn your personal optimal arousal level',
      'Use relaxation techniques if over-aroused',
      'Use activation techniques if under-aroused',
      'Practice with mild stress to build tolerance',
    ],
    commonMisapplications: [
      'Eliminating all stress from learning',
      'Creating excessive pressure',
      'Ignoring individual arousal differences',
    ],
    relevantMetaDimensions: ['gradient_awareness', 'entropy_intuition'],
    cegEffects: { coherence: 15, entropy: 0, generativity: 10 },
  },

  {
    id: 'principle-amygdala-learning',
    name: 'Amygdala and Emotional Memory',
    category: 'emotion',
    description: 'The amygdala tags experiences with emotional significance, enhancing memory for emotional events. Strong negative emotions can hijack cognition, while positive emotions can enhance learning.',
    brainMechanisms: [
      'Amygdala modulates hippocampal memory consolidation',
      'Emotional arousal enhances memory encoding',
      'Fear conditioning creates rapid, persistent memories',
      'Amygdala can override prefrontal control under stress',
    ],
    brainSystems: ['amygdala', 'hippocampus', 'prefrontal_cortex', 'insula'],
    neurotransmitters: ['norepinephrine', 'cortisol', 'dopamine'],
    keyResearchers: ['Joseph LeDoux', 'James McGaugh', 'Elizabeth Phelps'],
    keyCitations: [
      'LeDoux, J. (2015). Anxious: Using the Brain to Understand and Treat Fear and Anxiety',
      'McGaugh, J. (2004). The amygdala modulates the consolidation of memories',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Emotional experiences are remembered better',
      'Test anxiety can impair performance',
      'Prior negative experiences create learning barriers',
      'Positive emotional associations enhance engagement',
    ],
    teachingStrategies: [
      'Create emotionally positive learning environments',
      'Address math anxiety and other academic fears',
      'Use stories and examples that engage emotions',
      'Build relationships that create safety',
    ],
    studentStrategies: [
      'Recognize when anxiety is interfering',
      'Use anxiety reappraisal ("I am excited")',
      'Build positive associations with difficult subjects',
      'Practice exposure to feared situations gradually',
    ],
    commonMisapplications: [
      'Avoiding all negative emotions',
      'Using fear as primary motivator',
      'Ignoring emotional barriers to learning',
    ],
    relevantMetaDimensions: ['identity_elasticity', 'non_dual_resolution'],
    cegEffects: { coherence: 10, entropy: -5, generativity: 15 },
  },

  // ===== MOTIVATION PRINCIPLES =====
  {
    id: 'principle-dopamine-reward',
    name: 'Dopamine and Reward Prediction',
    category: 'motivation',
    description: 'Dopamine signals reward prediction error—the difference between expected and received reward. It drives motivation and learning by signaling what actions lead to better-than-expected outcomes.',
    brainMechanisms: [
      'Dopamine neurons fire for unexpected rewards',
      'Activity decreases for expected rewards (habituation)',
      'Negative prediction error (worse than expected) causes dip',
      'Anticipation of reward drives motivated behavior',
    ],
    brainSystems: ['basal_ganglia', 'prefrontal_cortex', 'amygdala'],
    neurotransmitters: ['dopamine'],
    keyResearchers: ['Wolfram Schultz', 'Robert Sapolsky', 'Kent Berridge'],
    keyCitations: [
      'Sapolsky, R. (2017). Behave: The Biology of Humans at Our Best and Worst',
      'Schultz, W. (1998). Predictive reward signal of dopamine neurons',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Variable rewards are more motivating than predictable ones',
      'Dopamine drives wanting more than liking',
      'Immediate rewards compete with delayed rewards',
      'Novel and unexpected elements maintain engagement',
    ],
    teachingStrategies: [
      'Use variable reward schedules (random bonuses)',
      'Provide unexpected positive feedback',
      'Connect learning to meaningful goals',
      'Use progress tracking to show advancement',
    ],
    studentStrategies: [
      'Create meaningful rewards for accomplishments',
      'Use variable self-rewards',
      'Focus on progress, not just outcomes',
      'Understand that motivation dips are normal (habituation)',
    ],
    commonMisapplications: [
      'Over-relying on extrinsic rewards',
      'Rewards that undermine intrinsic motivation',
      'Predictable reward schedules that lose power',
    ],
    relevantMetaDimensions: ['gradient_awareness', 'cooperative_generativity'],
    cegEffects: { coherence: 10, entropy: 5, generativity: 20 },
  },

  {
    id: 'principle-temporal-discounting',
    name: 'Temporal Discounting',
    category: 'motivation',
    description: 'The brain discounts future rewards relative to immediate ones. This hyperbolic discounting makes long-term goals difficult to pursue and underlies procrastination.',
    brainMechanisms: [
      'Limbic system responds to immediate rewards',
      'Prefrontal cortex represents future rewards',
      'Competition between systems determines choice',
      'Prefrontal damage increases impulsivity',
    ],
    brainSystems: ['prefrontal_cortex', 'basal_ganglia', 'amygdala', 'insula'],
    neurotransmitters: ['dopamine', 'serotonin'],
    keyResearchers: ['Walter Mischel', 'George Ainslie', 'Samuel McClure'],
    keyCitations: [
      'Mischel, W. (2014). The Marshmallow Test',
      'McClure et al. (2004). Separate neural systems value immediate and delayed monetary rewards',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Long-term academic goals are heavily discounted',
      'Procrastination is neurologically "rational"',
      'Self-control is a limited resource',
      'Implementation intentions can bypass the discount',
    ],
    teachingStrategies: [
      'Break long-term goals into shorter milestones',
      'Make immediate consequences of choices salient',
      'Help students create commitment devices',
      'Reduce friction for desired behaviors',
    ],
    studentStrategies: [
      'Use commitment devices (study groups, accountability)',
      'Create immediate rewards for studying',
      'Use implementation intentions ("When X, I will Y")',
      'Remove temptations from environment',
    ],
    commonMisapplications: [
      'Relying solely on willpower',
      'Only emphasizing long-term benefits',
      'Punishing rather than restructuring environment',
    ],
    relevantMetaDimensions: ['gradient_awareness', 'identity_elasticity'],
    cegEffects: { coherence: 15, entropy: -10, generativity: 10 },
  },

  // ===== METACOGNITION PRINCIPLES =====
  {
    id: 'principle-interpreter-module',
    name: 'The Interpreter Module',
    category: 'metacognition',
    description: 'The left hemisphere contains an "interpreter" that constantly constructs narratives to explain our experiences and behaviors, often confabulating when it lacks access to the real causes.',
    brainMechanisms: [
      'Left hemisphere language areas construct explanations',
      'Split-brain research reveals interpreter function',
      'Interpreter has no access to unconscious processes',
      'Confabulation occurs without awareness',
    ],
    brainSystems: ['prefrontal_cortex', 'temporal_cortex'],
    neurotransmitters: ['dopamine', 'acetylcholine'],
    keyResearchers: ['Michael Gazzaniga', 'Joseph LeDoux'],
    keyCitations: [
      'Gazzaniga, M. (2011). Who\'s in Charge? Free Will and the Science of the Brain',
      'Gazzaniga, M. (1998). The Mind\'s Past',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Our explanations for our own learning may be wrong',
      'Illusions of learning are common and persistent',
      'Metacognitive beliefs need validation against evidence',
      'Narrative coherence doesn\'t equal accuracy',
    ],
    teachingStrategies: [
      'Teach about cognitive biases explicitly',
      'Use objective measures rather than just self-report',
      'Challenge students\' explanations constructively',
      'Model intellectual humility',
    ],
    studentStrategies: [
      'Test your understanding, don\'t just feel it',
      'Be skeptical of your own explanations',
      'Seek disconfirming evidence',
      'Use external verification of learning',
    ],
    commonMisapplications: [
      'Over-relying on confidence as a guide',
      'Taking first explanations as truth',
      'Ignoring evidence that contradicts narratives',
    ],
    relevantMetaDimensions: ['identity_elasticity', 'non_dual_resolution', 'entropy_intuition'],
    cegEffects: { coherence: 5, entropy: 15, generativity: 20 },
  },

  {
    id: 'principle-illusions-learning',
    name: 'Illusions of Learning',
    category: 'metacognition',
    description: 'Common study strategies create feelings of fluency that do not correspond to actual learning. Rereading, highlighting, and familiarity can produce confidence without competence.',
    brainMechanisms: [
      'Processing fluency is misattributed to learning',
      'Recognition memory differs from recall ability',
      'Implicit memory creates familiarity without explicit retrieval',
      'Metacognitive monitoring can be decoupled from actual learning',
    ],
    brainSystems: ['prefrontal_cortex', 'hippocampus', 'temporal_cortex'],
    neurotransmitters: ['dopamine', 'acetylcholine'],
    keyResearchers: ['Robert Bjork', 'Elizabeth Bjork', 'Nate Kornell'],
    keyCitations: [
      'Bjork, R. (1994). Memory and metamemory considerations',
      'Kornell & Bjork (2007). The promise and perils of self-regulated study',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Rereading is one of the least effective study strategies',
      'Fluency during study doesn\'t predict test performance',
      'Desirable difficulties enhance long-term learning',
      'Effective strategies often feel less effective',
    ],
    teachingStrategies: [
      'Teach about effective vs. ineffective study strategies',
      'Create opportunities for retrieval practice',
      'Use frequent formative assessment',
      'Help students interpret performance accurately',
    ],
    studentStrategies: [
      'Replace rereading with retrieval practice',
      'Test yourself before feeling ready',
      'Trust evidence over feelings of knowing',
      'Embrace productive struggle',
    ],
    commonMisapplications: [
      'Relying on highlighting and rereading',
      'Avoiding difficulty in studying',
      'Using recognition as evidence of recall ability',
    ],
    relevantMetaDimensions: ['gradient_awareness', 'multi_model_coherence'],
    cegEffects: { coherence: 20, entropy: -5, generativity: 10 },
  },

  // ===== PLASTICITY PRINCIPLES =====
  {
    id: 'principle-neuroplasticity',
    name: 'Experience-Dependent Neuroplasticity',
    category: 'plasticity',
    description: 'The brain physically changes in response to experience throughout life. Learning literally rewires the brain through synaptic changes, myelination, and even neurogenesis.',
    brainMechanisms: [
      'Long-term potentiation strengthens used synapses',
      'Hebbian learning: "neurons that fire together wire together"',
      'Myelination increases with practice',
      'Neurogenesis continues in hippocampus',
    ],
    brainSystems: ['hippocampus', 'prefrontal_cortex', 'cerebellum', 'basal_ganglia'],
    neurotransmitters: ['glutamate', 'dopamine', 'acetylcholine'],
    keyResearchers: ['David Eagleman', 'Michael Merzenich', 'Eric Kandel'],
    keyCitations: [
      'Eagleman, D. (2020). Livewired: The Inside Story of the Ever-Changing Brain',
      'Merzenich, M. (2013). Soft-Wired',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Intelligence is not fixed',
      'Effortful practice causes brain changes',
      'The brain adapts to demands placed on it',
      'Use it or lose it—unused circuits weaken',
    ],
    teachingStrategies: [
      'Teach growth mindset with biological basis',
      'Emphasize that struggle causes brain growth',
      'Celebrate effort and improvement',
      'Provide challenging but achievable tasks',
    ],
    studentStrategies: [
      'Understand that difficulty is growing your brain',
      'Persist through challenges',
      'Believe in your capacity to improve',
      'View mistakes as learning opportunities',
    ],
    commonMisapplications: [
      'Claiming any amount of practice makes perfect',
      'Ignoring the role of quality practice',
      'Oversimplifying plasticity (brain training games)',
    ],
    relevantMetaDimensions: ['identity_elasticity', 'gradient_awareness', 'cooperative_generativity'],
    cegEffects: { coherence: 20, entropy: 5, generativity: 25 },
  },

  {
    id: 'principle-deliberate-practice',
    name: 'Deliberate Practice',
    category: 'plasticity',
    description: 'Expertise develops through deliberate practice—targeted, effortful activities designed to improve specific aspects of performance, with immediate feedback and repetition.',
    brainMechanisms: [
      'Focused attention drives targeted synaptic changes',
      'Error signals from feedback guide learning',
      'Repetition consolidates neural patterns',
      'Challenge at edge of ability maximizes growth',
    ],
    brainSystems: ['prefrontal_cortex', 'basal_ganglia', 'cerebellum', 'anterior_cingulate'],
    neurotransmitters: ['dopamine', 'norepinephrine', 'acetylcholine'],
    keyResearchers: ['Anders Ericsson', 'Robert Pool', 'Angela Duckworth'],
    keyCitations: [
      'Ericsson, A. & Pool, R. (2016). Peak: Secrets from the New Science of Expertise',
      'Ericsson et al. (1993). The role of deliberate practice',
    ],
    evidenceStrength: 'strong',
    learningImplications: [
      'Mere experience doesn\'t produce expertise',
      'Practice must be at the edge of current ability',
      'Feedback is essential for improvement',
      '10,000 hours is not a magic number',
    ],
    teachingStrategies: [
      'Provide immediate, specific feedback',
      'Design practice at appropriate challenge level',
      'Focus on specific skill components',
      'Model expert thinking processes',
    ],
    studentStrategies: [
      'Practice at the edge of your ability',
      'Seek specific feedback',
      'Focus on weaknesses, not strengths',
      'Use mental practice to supplement physical practice',
    ],
    commonMisapplications: [
      'Equating any practice with deliberate practice',
      'Practicing without feedback',
      'Only practicing strengths',
    ],
    relevantMetaDimensions: ['gradient_awareness', 'manifold_fluidity'],
    cegEffects: { coherence: 25, entropy: -5, generativity: 15 },
  },
];

// =============================================================================
// NEUROSCIENCE STANDARDS
// =============================================================================

export const NS_STANDARDS: Record<NSStandardId, NSStandard> = {
  // ===== MEMORY STANDARDS =====
  'NS-MEM-1.1': {
    id: 'NS-MEM-1.1',
    title: 'Understand memory types and their functions',
    description: 'Identify and distinguish between working, episodic, semantic, procedural, and emotional memory systems.',
    category: 'memory',
    objectives: [
      'Define and differentiate the major memory systems',
      'Explain the brain structures associated with each memory type',
      'Identify which memory type is engaged in different learning activities',
    ],
    prerequisites: [],
    assessmentCriteria: [
      'Correctly identifies memory type in novel scenarios',
      'Explains brain-memory relationships accurately',
      'Applies knowledge to optimize personal learning',
    ],
    masteryIndicators: [
      'Can categorize any learning activity by memory type',
      'Can explain why different subjects require different study approaches',
      'Uses memory type knowledge to select study strategies',
    ],
    practiceActivities: [
      'Memory type identification exercises',
      'Self-observation journal of memory processes',
      'Design study strategies for different memory types',
    ],
    realWorldApplications: [
      'Choosing study methods for different subjects',
      'Understanding why some things are easier to remember',
      'Explaining memory phenomena in daily life',
    ],
    difficultyLevel: 3,
    suggestedGradeRange: '5-7',
    estimatedHours: 2,
  },

  'NS-MEM-1.2': {
    id: 'NS-MEM-1.2',
    title: 'Apply spaced practice principles',
    description: 'Understand and implement spaced practice for optimal long-term retention.',
    category: 'memory',
    objectives: [
      'Explain why spaced practice works better than massed practice',
      'Calculate optimal spacing intervals for different retention goals',
      'Create personal spaced practice schedules',
    ],
    prerequisites: ['NS-MEM-1.1'],
    assessmentCriteria: [
      'Demonstrates understanding of spacing effect mechanism',
      'Creates appropriate spacing schedules',
      'Shows improved retention through spaced practice',
    ],
    masteryIndicators: [
      'Consistently uses spaced practice in own learning',
      'Can explain spacing effect to others',
      'Adjusts spacing based on retention goals',
    ],
    practiceActivities: [
      'Spacing experiment with vocabulary words',
      'Design study calendars with optimal spacing',
      'Compare massed vs. spaced learning results',
    ],
    realWorldApplications: [
      'Studying for cumulative exams',
      'Learning a new language',
      'Maintaining professional knowledge',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '5-8',
    estimatedHours: 3,
  },

  'NS-MEM-1.3': {
    id: 'NS-MEM-1.3',
    title: 'Use retrieval practice effectively',
    description: 'Apply the testing effect to strengthen memory through active recall.',
    category: 'memory',
    objectives: [
      'Explain why retrieval strengthens memory',
      'Distinguish retrieval practice from recognition/re-reading',
      'Design effective self-testing routines',
    ],
    prerequisites: ['NS-MEM-1.1'],
    assessmentCriteria: [
      'Uses retrieval practice instead of re-reading',
      'Creates effective self-quizzes',
      'Can explain the mechanism of testing effect',
    ],
    masteryIndicators: [
      'Habitually tests self before reviewing notes',
      'Prefers recall over recognition exercises',
      'Sees improved test performance from retrieval practice',
    ],
    practiceActivities: [
      'Flashcard creation and use',
      'Closed-book summarization',
      'Practice teaching material to others',
    ],
    realWorldApplications: [
      'Preparing for any exam',
      'Retaining information from meetings/lectures',
      'Building expertise in any domain',
    ],
    difficultyLevel: 3,
    suggestedGradeRange: '4-6',
    estimatedHours: 2,
  },

  'NS-MEM-1.4': {
    id: 'NS-MEM-1.4',
    title: 'Leverage interleaving for retention',
    description: 'Mix practice of different topics and problem types for enhanced discrimination and transfer.',
    category: 'memory',
    objectives: [
      'Understand why interleaving improves long-term learning',
      'Recognize when interleaving is most beneficial',
      'Overcome the illusion that blocked practice is better',
    ],
    prerequisites: ['NS-MEM-1.2', 'NS-MEM-1.3'],
    assessmentCriteria: [
      'Correctly applies interleaving in practice',
      'Can explain interleaving benefits despite feeling harder',
      'Uses interleaving for appropriate content',
    ],
    masteryIndicators: [
      'Prefers interleaved practice despite difficulty feeling',
      'Can design interleaved practice schedules',
      'Shows improved transfer across problem types',
    ],
    practiceActivities: [
      'Interleaved vs. blocked practice experiments',
      'Mixed problem set creation',
      'Cross-subject study sessions',
    ],
    realWorldApplications: [
      'Studying math with mixed problem types',
      'Learning to identify categories (art, music, species)',
      'Developing flexible problem-solving skills',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '6-9',
    estimatedHours: 3,
  },

  'NS-MEM-2.1': {
    id: 'NS-MEM-2.1',
    title: "Understand sleep's role in consolidation",
    description: 'Recognize sleep as essential for memory consolidation and optimize sleep for learning.',
    category: 'memory',
    objectives: [
      'Explain sleep stages and their memory functions',
      'Understand sleep deprivation effects on learning',
      'Apply sleep hygiene principles for learning optimization',
    ],
    prerequisites: ['NS-MEM-1.1'],
    assessmentCriteria: [
      'Correctly describes sleep-memory relationship',
      'Maintains adequate sleep for learning',
      'Uses strategic timing of study relative to sleep',
    ],
    masteryIndicators: [
      'Prioritizes sleep over late-night studying',
      'Reviews material before sleep for consolidation',
      'Can explain why all-nighters backfire',
    ],
    practiceActivities: [
      'Sleep tracking experiment',
      'Compare learning with and without adequate sleep',
      'Design optimal study-sleep schedule',
    ],
    realWorldApplications: [
      'Managing study schedules around sleep',
      'Understanding jet lag effects on cognition',
      'Long-term health and cognitive function',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '6-8',
    estimatedHours: 2,
  },

  'NS-MEM-2.2': {
    id: 'NS-MEM-2.2',
    title: 'Apply chunking for working memory',
    description: 'Use chunking strategies to expand effective working memory capacity.',
    category: 'memory',
    objectives: [
      'Understand working memory limitations',
      'Recognize natural chunks in information',
      'Create meaningful chunks to aid memory',
    ],
    prerequisites: ['NS-MEM-1.1'],
    assessmentCriteria: [
      'Identifies chunking opportunities in material',
      'Creates effective mnemonics and groupings',
      'Demonstrates expanded effective capacity',
    ],
    masteryIndicators: [
      'Automatically looks for patterns to chunk',
      'Creates personal chunking strategies',
      'Can hold more information through chunking',
    ],
    practiceActivities: [
      'Digit span with chunking',
      'Create acronyms and mnemonics',
      'Analyze expert chunking in chess/music',
    ],
    realWorldApplications: [
      'Remembering phone numbers and codes',
      'Learning complex procedures',
      'Building expertise through pattern recognition',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '5-7',
    estimatedHours: 2,
  },

  'NS-MEM-2.3': {
    id: 'NS-MEM-2.3',
    title: 'Use elaboration for semantic encoding',
    description: 'Connect new information to existing knowledge for deeper encoding.',
    category: 'memory',
    objectives: [
      'Understand why elaboration enhances memory',
      'Generate meaningful connections to prior knowledge',
      'Use questioning strategies for elaboration',
    ],
    prerequisites: ['NS-MEM-1.1', 'NS-MEM-2.2'],
    assessmentCriteria: [
      'Actively generates connections when learning',
      'Asks "how" and "why" questions',
      'Shows improved retention through elaboration',
    ],
    masteryIndicators: [
      'Habitually connects new learning to existing knowledge',
      'Can explain material in multiple ways',
      'Creates rich, interconnected memory networks',
    ],
    practiceActivities: [
      'Elaborative interrogation practice',
      'Concept mapping',
      'Analogy generation',
    ],
    realWorldApplications: [
      'Understanding complex texts',
      'Building integrated knowledge',
      'Preparing for application-based assessments',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '6-9',
    estimatedHours: 3,
  },

  // ===== ATTENTION STANDARDS =====
  'NS-ATT-1.1': {
    id: 'NS-ATT-1.1',
    title: 'Recognize attention as limited resource',
    description: 'Understand that attention is finite and must be managed strategically.',
    category: 'attention',
    objectives: [
      'Explain the limited capacity of attention',
      'Identify costs of multitasking',
      'Understand attention as requiring active management',
    ],
    prerequisites: [],
    assessmentCriteria: [
      'Correctly describes attention limitations',
      'Avoids multitasking during focused work',
      'Plans attention allocation strategically',
    ],
    masteryIndicators: [
      'Treats attention as valuable resource',
      'Single-tasks during important work',
      'Can explain multitasking costs to others',
    ],
    practiceActivities: [
      'Attention span self-assessment',
      'Multitasking experiment',
      'Attention audit of daily activities',
    ],
    realWorldApplications: [
      'Managing study environment',
      'Avoiding dangerous multitasking (texting while driving)',
      'Prioritizing what deserves attention',
    ],
    difficultyLevel: 2,
    suggestedGradeRange: '4-6',
    estimatedHours: 1.5,
  },

  'NS-ATT-1.2': {
    id: 'NS-ATT-1.2',
    title: 'Manage cognitive load effectively',
    description: 'Recognize and manage different types of cognitive load to optimize learning.',
    category: 'attention',
    objectives: [
      'Distinguish intrinsic, extraneous, and germane load',
      'Identify and reduce extraneous load',
      'Match material complexity to current capacity',
    ],
    prerequisites: ['NS-ATT-1.1', 'NS-MEM-2.2'],
    assessmentCriteria: [
      'Identifies sources of cognitive overload',
      'Reduces unnecessary complexity in learning materials',
      'Sequences learning to manage load',
    ],
    masteryIndicators: [
      'Recognizes when overloaded and adjusts',
      'Actively simplifies learning environment',
      'Sequences learning from simple to complex',
    ],
    practiceActivities: [
      'Cognitive load analysis of study materials',
      'Redesign learning resources for lower extraneous load',
      'Personal load management experiment',
    ],
    realWorldApplications: [
      'Designing presentations and documents',
      'Managing information overload',
      'Sequencing learning in any domain',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '7-10',
    estimatedHours: 3,
  },

  'NS-ATT-1.3': {
    id: 'NS-ATT-1.3',
    title: 'Alternate focused and diffuse modes',
    description: 'Strategically switch between focused and diffuse thinking modes for optimal learning.',
    category: 'attention',
    objectives: [
      'Understand the difference between focused and diffuse modes',
      'Recognize when each mode is most effective',
      'Use techniques to enter each mode intentionally',
    ],
    prerequisites: ['NS-ATT-1.1'],
    assessmentCriteria: [
      'Correctly identifies appropriate mode for task',
      'Uses breaks strategically for diffuse mode',
      'Shows improved problem-solving through mode switching',
    ],
    masteryIndicators: [
      'Intentionally uses both modes in learning',
      'Takes effective breaks that enable diffuse processing',
      'Reports insights arising from diffuse mode',
    ],
    practiceActivities: [
      'Pomodoro technique implementation',
      'Walking breaks for problem incubation',
      'Sleep-on-it experiments for difficult problems',
    ],
    realWorldApplications: [
      'Creative problem solving',
      'Overcoming stuck points in work',
      'Balancing deep work with recovery',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '6-9',
    estimatedHours: 2,
  },

  'NS-ATT-2.1': {
    id: 'NS-ATT-2.1',
    title: 'Identify personal attention patterns',
    description: 'Develop awareness of individual attention strengths, weaknesses, and rhythms.',
    category: 'attention',
    objectives: [
      'Track personal attention patterns over time',
      'Identify peak attention times and durations',
      'Recognize personal distractibility triggers',
    ],
    prerequisites: ['NS-ATT-1.1'],
    assessmentCriteria: [
      'Accurately describes own attention patterns',
      'Schedules demanding work during peak times',
      'Anticipates and mitigates distraction triggers',
    ],
    masteryIndicators: [
      'Has detailed knowledge of personal attention patterns',
      'Optimizes schedule around attention rhythms',
      'Proactively manages distraction vulnerabilities',
    ],
    practiceActivities: [
      'Attention diary for one week',
      'Peak time identification experiment',
      'Distraction trigger analysis',
    ],
    realWorldApplications: [
      'Personal productivity optimization',
      'Career planning around cognitive strengths',
      'Self-accommodation for attention challenges',
    ],
    difficultyLevel: 3,
    suggestedGradeRange: '5-8',
    estimatedHours: 2,
  },

  'NS-ATT-2.2': {
    id: 'NS-ATT-2.2',
    title: 'Apply environment optimization',
    description: 'Design physical and digital environments to support sustained attention.',
    category: 'attention',
    objectives: [
      'Identify environmental factors affecting attention',
      'Design optimal study environments',
      'Manage digital distractions effectively',
    ],
    prerequisites: ['NS-ATT-2.1'],
    assessmentCriteria: [
      'Creates supportive study environments',
      'Uses tools to block digital distractions',
      'Reports improved focus from environmental changes',
    ],
    masteryIndicators: [
      'Consistently studies in optimized environments',
      'Has systems for managing digital distractions',
      'Can help others optimize their environments',
    ],
    practiceActivities: [
      'Study space redesign project',
      'App/website blocker implementation',
      'Compare focus in different environments',
    ],
    realWorldApplications: [
      'Home office design',
      'Managing smartphone use',
      'Creating focus rituals',
    ],
    difficultyLevel: 3,
    suggestedGradeRange: '5-8',
    estimatedHours: 2,
  },

  'NS-ATT-2.3': {
    id: 'NS-ATT-2.3',
    title: 'Use strategic breaks for restoration',
    description: 'Design and use breaks that actually restore attention capacity.',
    category: 'attention',
    objectives: [
      'Understand what restores vs. depletes attention',
      'Design restorative break activities',
      'Time breaks optimally for sustained performance',
    ],
    prerequisites: ['NS-ATT-1.3', 'NS-ATT-2.1'],
    assessmentCriteria: [
      'Takes breaks before attention depletion',
      'Uses truly restorative activities during breaks',
      'Returns from breaks with restored attention',
    ],
    masteryIndicators: [
      'Has reliable break routines that restore attention',
      'Knows which activities restore vs. deplete',
      'Maintains sustained performance through strategic breaks',
    ],
    practiceActivities: [
      'Break activity comparison experiment',
      'Optimal break timing determination',
      'Nature break vs. phone break comparison',
    ],
    realWorldApplications: [
      'Maintaining productivity during long work days',
      'Exam-day break strategy',
      'Preventing burnout',
    ],
    difficultyLevel: 3,
    suggestedGradeRange: '5-8',
    estimatedHours: 1.5,
  },

  // ===== EMOTION STANDARDS =====
  'NS-EMO-1.1': {
    id: 'NS-EMO-1.1',
    title: 'Understand emotion-cognition interaction',
    description: 'Recognize how emotions affect thinking and learning, and vice versa.',
    category: 'emotion',
    objectives: [
      'Explain the bidirectional relationship between emotion and cognition',
      'Identify how different emotions affect learning',
      'Understand the role of the amygdala in learning',
    ],
    prerequisites: [],
    assessmentCriteria: [
      'Correctly describes emotion-cognition interaction',
      'Identifies emotional influences on own learning',
      'Can explain why emotions matter for learning',
    ],
    masteryIndicators: [
      'Considers emotional state when learning',
      'Can predict how emotions will affect performance',
      'Uses emotion awareness to improve learning',
    ],
    practiceActivities: [
      'Emotional state and learning performance tracking',
      'Analysis of emotional influences on past learning experiences',
      'Emotion-learning connection mapping',
    ],
    realWorldApplications: [
      'Understanding test anxiety',
      'Recognizing emotional barriers to subjects',
      'Using positive emotions to enhance learning',
    ],
    difficultyLevel: 3,
    suggestedGradeRange: '5-7',
    estimatedHours: 2,
  },

  'NS-EMO-1.2': {
    id: 'NS-EMO-1.2',
    title: 'Recognize stress effects on learning',
    description: 'Understand how acute and chronic stress affect cognitive function and memory.',
    category: 'emotion',
    objectives: [
      'Distinguish between productive and harmful stress',
      'Explain stress hormone effects on the brain',
      'Identify signs of stress overload',
    ],
    prerequisites: ['NS-EMO-1.1'],
    assessmentCriteria: [
      'Correctly describes stress-cognition relationship',
      'Recognizes own stress levels',
      'Can explain Yerkes-Dodson curve',
    ],
    masteryIndicators: [
      'Monitors stress levels during learning',
      'Takes action when stress becomes counterproductive',
      'Maintains stress in productive range when possible',
    ],
    practiceActivities: [
      'Stress level self-monitoring',
      'Yerkes-Dodson application to personal experience',
      'Stress-performance relationship analysis',
    ],
    realWorldApplications: [
      'Managing exam stress',
      'Understanding chronic stress effects',
      'Optimizing challenge level for performance',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '6-9',
    estimatedHours: 2,
  },

  'NS-EMO-1.3': {
    id: 'NS-EMO-1.3',
    title: 'Apply emotion regulation strategies',
    description: 'Use evidence-based strategies to regulate emotions for optimal learning.',
    category: 'emotion',
    objectives: [
      'Learn multiple emotion regulation strategies',
      'Match strategies to emotional states',
      'Implement strategies in learning contexts',
    ],
    prerequisites: ['NS-EMO-1.1', 'NS-EMO-1.2'],
    assessmentCriteria: [
      'Knows multiple regulation strategies',
      'Selects appropriate strategies for situations',
      'Successfully regulates emotions for learning',
    ],
    masteryIndicators: [
      'Has reliable emotion regulation toolkit',
      'Uses regulation proactively, not just reactively',
      'Can help others learn regulation strategies',
    ],
    practiceActivities: [
      'Strategy practice and effectiveness tracking',
      'Cognitive reappraisal exercises',
      'Deep breathing and grounding techniques',
    ],
    realWorldApplications: [
      'Managing test anxiety',
      'Recovering from academic setbacks',
      'Maintaining equanimity under pressure',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '6-10',
    estimatedHours: 4,
  },

  'NS-EMO-2.1': {
    id: 'NS-EMO-2.1',
    title: 'Identify amygdala hijack signs',
    description: 'Recognize when the amygdala has overridden prefrontal control and learn recovery strategies.',
    category: 'emotion',
    objectives: [
      'Understand the amygdala hijack mechanism',
      'Identify personal signs of hijack',
      'Learn recovery techniques',
    ],
    prerequisites: ['NS-EMO-1.1', 'NS-EMO-1.2'],
    assessmentCriteria: [
      'Can describe amygdala hijack process',
      'Identifies own early warning signs',
      'Successfully uses recovery techniques',
    ],
    masteryIndicators: [
      'Catches hijack early before full escalation',
      'Has reliable recovery protocols',
      'Can explain process and recovery to others',
    ],
    practiceActivities: [
      'Personal trigger and sign identification',
      'Recovery technique practice',
      'Post-hijack reflection journaling',
    ],
    realWorldApplications: [
      'Managing panic during tests',
      'Recovering from triggering situations',
      'Preventing escalation of emotional reactions',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '7-10',
    estimatedHours: 3,
  },

  'NS-EMO-2.2': {
    id: 'NS-EMO-2.2',
    title: 'Use arousal optimization techniques',
    description: 'Adjust arousal level up or down to reach optimal state for the task.',
    category: 'emotion',
    objectives: [
      'Identify personal optimal arousal for different tasks',
      'Learn techniques to increase arousal when too low',
      'Learn techniques to decrease arousal when too high',
    ],
    prerequisites: ['NS-EMO-1.2', 'NS-EMO-1.3'],
    assessmentCriteria: [
      'Accurately assesses own arousal level',
      'Knows techniques for both directions',
      'Successfully adjusts arousal for tasks',
    ],
    masteryIndicators: [
      'Reliably achieves optimal arousal for tasks',
      'Has personalized arousal adjustment toolkit',
      'Can teach techniques to others',
    ],
    practiceActivities: [
      'Arousal level calibration exercises',
      'Energy-raising technique practice',
      'Calming technique practice',
    ],
    realWorldApplications: [
      'Pre-performance preparation',
      'Recovering from overwhelming situations',
      'Maintaining alertness during boring tasks',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '6-9',
    estimatedHours: 2,
  },

  'NS-EMO-2.3': {
    id: 'NS-EMO-2.3',
    title: 'Cultivate productive emotional states',
    description: 'Proactively create emotional conditions that support learning.',
    category: 'emotion',
    objectives: [
      'Identify emotional states that support learning',
      'Develop techniques to cultivate positive states',
      'Build emotional resilience for learning',
    ],
    prerequisites: ['NS-EMO-1.3', 'NS-EMO-2.2'],
    assessmentCriteria: [
      'Can name productive emotional states for learning',
      'Has techniques to cultivate each state',
      'Maintains positive emotional tone during learning',
    ],
    masteryIndicators: [
      'Habitually cultivates productive states before learning',
      'Has resilience strategies for difficult content',
      'Experiences learning as emotionally positive',
    ],
    practiceActivities: [
      'Curiosity cultivation exercises',
      'Pre-learning emotional preparation rituals',
      'Gratitude and growth mindset practices',
    ],
    realWorldApplications: [
      'Approaching dreaded subjects',
      'Maintaining enthusiasm over long projects',
      'Building love of learning',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '7-10',
    estimatedHours: 3,
  },

  // ===== MOTIVATION STANDARDS =====
  'NS-MOT-1.1': {
    id: 'NS-MOT-1.1',
    title: "Understand dopamine's role in motivation",
    description: 'Learn how the dopamine system drives motivation and how to work with it.',
    category: 'motivation',
    objectives: [
      "Explain dopamine's role in reward and motivation",
      'Understand reward prediction error',
      'Recognize dopamine-related motivation patterns',
    ],
    prerequisites: [],
    assessmentCriteria: [
      'Correctly describes dopamine function',
      'Identifies dopamine influences in own motivation',
      'Can explain why some rewards lose effectiveness',
    ],
    masteryIndicators: [
      'Uses dopamine understanding to structure rewards',
      'Can explain motivation neuroscience to others',
      'Manages reward systems for sustained motivation',
    ],
    practiceActivities: [
      'Reward tracking and analysis',
      'Dopamine pattern recognition in daily life',
      'Variable reward implementation',
    ],
    realWorldApplications: [
      'Understanding why novelty is motivating',
      'Designing effective reward systems',
      'Understanding addiction mechanisms',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '7-10',
    estimatedHours: 2,
  },

  'NS-MOT-1.2': {
    id: 'NS-MOT-1.2',
    title: 'Apply reward timing principles',
    description: 'Use optimal timing and scheduling of rewards to maintain motivation.',
    category: 'motivation',
    objectives: [
      'Understand immediate vs. delayed reward effects',
      'Learn variable ratio reward scheduling',
      'Apply reward timing to maintain engagement',
    ],
    prerequisites: ['NS-MOT-1.1'],
    assessmentCriteria: [
      'Designs appropriate reward schedules',
      'Uses variety to prevent habituation',
      'Maintains motivation through strategic rewards',
    ],
    masteryIndicators: [
      'Has personalized effective reward system',
      'Avoids common reward timing mistakes',
      'Can design reward systems for others',
    ],
    practiceActivities: [
      'Reward schedule experimentation',
      'Fixed vs. variable schedule comparison',
      'Personal reward system design',
    ],
    realWorldApplications: [
      'Gamification design',
      'Self-motivation systems',
      'Habit formation',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '7-10',
    estimatedHours: 2,
  },

  'NS-MOT-1.3': {
    id: 'NS-MOT-1.3',
    title: 'Balance intrinsic and extrinsic motivation',
    description: 'Understand when extrinsic rewards help vs. undermine intrinsic motivation.',
    category: 'motivation',
    objectives: [
      'Distinguish intrinsic from extrinsic motivation',
      'Understand the overjustification effect',
      'Use extrinsic rewards without undermining intrinsic motivation',
    ],
    prerequisites: ['NS-MOT-1.1', 'NS-MOT-1.2'],
    assessmentCriteria: [
      'Can identify intrinsic vs. extrinsic motivation',
      'Avoids undermining intrinsic motivation',
      'Uses extrinsic rewards strategically',
    ],
    masteryIndicators: [
      'Maintains intrinsic motivation while using rewards',
      'Can explain overjustification effect',
      'Has sustainable motivation strategies',
    ],
    practiceActivities: [
      'Intrinsic motivation inventory',
      'Analysis of past reward effects',
      'Reward strategy redesign',
    ],
    realWorldApplications: [
      'Parenting and teaching approaches',
      'Workplace motivation',
      'Hobby and passion maintenance',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '8-11',
    estimatedHours: 2,
  },

  'NS-MOT-2.1': {
    id: 'NS-MOT-2.1',
    title: 'Manage temporal discounting',
    description: 'Overcome the tendency to prefer immediate over delayed rewards.',
    category: 'motivation',
    objectives: [
      'Understand temporal discounting mechanism',
      'Identify personal discounting patterns',
      'Apply strategies to value future rewards',
    ],
    prerequisites: ['NS-MOT-1.1'],
    assessmentCriteria: [
      'Correctly describes temporal discounting',
      'Identifies discounting in own decisions',
      'Uses strategies to overcome discounting',
    ],
    masteryIndicators: [
      'Successfully pursues long-term goals',
      'Uses commitment devices effectively',
      'Can help others manage discounting',
    ],
    practiceActivities: [
      'Personal discounting rate assessment',
      'Commitment device design',
      'Future self visualization exercises',
    ],
    realWorldApplications: [
      'Overcoming procrastination',
      'Saving for the future',
      'Long-term project completion',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '7-10',
    estimatedHours: 3,
  },

  'NS-MOT-2.2': {
    id: 'NS-MOT-2.2',
    title: 'Design effective goal structures',
    description: 'Create goal hierarchies that maintain motivation and guide action.',
    category: 'motivation',
    objectives: [
      'Understand goal hierarchy principles',
      'Create effective sub-goal structures',
      'Balance approach and avoidance goals',
    ],
    prerequisites: ['NS-MOT-2.1'],
    assessmentCriteria: [
      'Creates well-structured goal hierarchies',
      'Uses proximal and distal goals appropriately',
      'Maintains motivation through goal design',
    ],
    masteryIndicators: [
      'Has clear, motivating goal structures',
      'Adjusts goals based on feedback',
      'Can help others design goals',
    ],
    practiceActivities: [
      'Goal hierarchy mapping',
      'SMART goal revision',
      'Mastery vs. performance goal analysis',
    ],
    realWorldApplications: [
      'Academic planning',
      'Career goal setting',
      'Personal development',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '6-9',
    estimatedHours: 2,
  },

  'NS-MOT-2.3': {
    id: 'NS-MOT-2.3',
    title: 'Maintain sustainable motivation',
    description: 'Build motivation systems that last without leading to burnout.',
    category: 'motivation',
    objectives: [
      'Recognize signs of motivational depletion',
      'Build recovery into motivation systems',
      'Maintain long-term sustainable engagement',
    ],
    prerequisites: ['NS-MOT-1.3', 'NS-MOT-2.2'],
    assessmentCriteria: [
      'Recognizes early burnout signs',
      'Has recovery strategies',
      'Maintains motivation over long periods',
    ],
    masteryIndicators: [
      'Sustains motivation without burnout',
      'Has resilient motivation system',
      'Can advise others on sustainable motivation',
    ],
    practiceActivities: [
      'Burnout risk assessment',
      'Recovery activity identification',
      'Long-term motivation plan creation',
    ],
    realWorldApplications: [
      'Preventing academic burnout',
      'Career sustainability',
      'Lifelong learning maintenance',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '8-11',
    estimatedHours: 3,
  },

  // ===== METACOGNITION STANDARDS =====
  'NS-META-1.1': {
    id: 'NS-META-1.1',
    title: 'Recognize illusions of learning',
    description: 'Identify common cognitive illusions that lead to false confidence in learning.',
    category: 'metacognition',
    objectives: [
      'Name and describe common illusions of learning',
      'Recognize illusions in own study practices',
      'Use evidence-based alternatives to illusory practices',
    ],
    prerequisites: ['NS-MEM-1.3'],
    assessmentCriteria: [
      'Identifies illusions when they occur',
      'Avoids common illusory study practices',
      'Uses objective measures of learning',
    ],
    masteryIndicators: [
      'Consistently uses effective over illusory practices',
      'Can explain illusions to others',
      'Tests understanding rather than relying on feelings',
    ],
    practiceActivities: [
      'Illusion identification exercises',
      'Study practice audit',
      'Feeling vs. performance comparison',
    ],
    realWorldApplications: [
      'Avoiding ineffective studying',
      'Making accurate learning predictions',
      'Helping others study effectively',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '6-9',
    estimatedHours: 2,
  },

  'NS-META-1.2': {
    id: 'NS-META-1.2',
    title: 'Calibrate confidence accurately',
    description: 'Align confidence judgments with actual knowledge and performance.',
    category: 'metacognition',
    objectives: [
      'Assess own calibration (over/under-confidence)',
      'Use strategies to improve calibration',
      'Make more accurate predictions of performance',
    ],
    prerequisites: ['NS-META-1.1'],
    assessmentCriteria: [
      'Accurately assesses own calibration bias',
      'Predictions align with actual performance',
      'Uses feedback to improve calibration',
    ],
    masteryIndicators: [
      'Consistently well-calibrated confidence',
      'Accurate predictions of test performance',
      'Uses calibration awareness in decision-making',
    ],
    practiceActivities: [
      'Confidence-performance tracking',
      'Calibration exercises with feedback',
      'Prediction accuracy analysis',
    ],
    realWorldApplications: [
      'Knowing when to study more',
      'Accurate self-assessment',
      'Better decision-making under uncertainty',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '7-10',
    estimatedHours: 3,
  },

  'NS-META-1.3': {
    id: 'NS-META-1.3',
    title: 'Monitor comprehension in real-time',
    description: 'Develop ongoing awareness of understanding while learning.',
    category: 'metacognition',
    objectives: [
      'Recognize signs of confusion vs. understanding',
      'Use comprehension monitoring strategies',
      'Take corrective action when confused',
    ],
    prerequisites: ['NS-META-1.1'],
    assessmentCriteria: [
      'Notices confusion when it occurs',
      'Uses strategies to check understanding',
      'Takes action to resolve confusion',
    ],
    masteryIndicators: [
      'Monitors comprehension automatically',
      'Quickly detects and addresses confusion',
      'Maintains accurate awareness of understanding',
    ],
    practiceActivities: [
      'Self-explanation practice',
      'Confusion journaling',
      'Comprehension checkpoint exercises',
    ],
    realWorldApplications: [
      'Reading comprehension',
      'Lecture understanding',
      'Learning from feedback',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '5-8',
    estimatedHours: 2,
  },

  'NS-META-2.1': {
    id: 'NS-META-2.1',
    title: 'Understand interpreter module biases',
    description: 'Recognize how the narrative-constructing mind creates systematic biases.',
    category: 'metacognition',
    objectives: [
      'Explain the interpreter module concept',
      'Identify common cognitive biases',
      'Recognize own confabulation tendencies',
    ],
    prerequisites: ['NS-META-1.1', 'NS-META-1.2'],
    assessmentCriteria: [
      'Describes interpreter function accurately',
      'Identifies biases in own thinking',
      'Questions own explanations appropriately',
    ],
    masteryIndicators: [
      'Maintains healthy skepticism of own narratives',
      'Seeks external validation of explanations',
      'Recognizes bias in real-time',
    ],
    practiceActivities: [
      'Bias identification exercises',
      'Attribution analysis',
      'Narrative questioning practice',
    ],
    realWorldApplications: [
      'Avoiding self-deception',
      'Better self-understanding',
      'Improved decision-making',
    ],
    difficultyLevel: 6,
    suggestedGradeRange: '9-12',
    estimatedHours: 3,
  },

  'NS-META-2.2': {
    id: 'NS-META-2.2',
    title: 'Develop growth mindset foundations',
    description: 'Build neurologically-grounded beliefs about intelligence and learning capacity.',
    category: 'metacognition',
    objectives: [
      'Understand brain plasticity as basis for growth',
      'Recognize fixed vs. growth mindset patterns',
      'Develop growth-oriented responses to challenge',
    ],
    prerequisites: ['NS-PLAST-1.1'],
    assessmentCriteria: [
      'Expresses growth-oriented beliefs',
      'Responds to challenge with effort',
      'Views mistakes as learning opportunities',
    ],
    masteryIndicators: [
      'Consistently demonstrates growth mindset',
      'Persists through difficulty',
      'Can explain and model growth mindset',
    ],
    practiceActivities: [
      'Mindset language audit',
      'Challenge response reflection',
      'Growth mindset reframing exercises',
    ],
    realWorldApplications: [
      'Approaching difficult subjects',
      'Recovering from failure',
      'Embracing learning challenges',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '5-8',
    estimatedHours: 3,
  },

  'NS-META-2.3': {
    id: 'NS-META-2.3',
    title: 'Apply strategic self-reflection',
    description: 'Use structured reflection to improve learning and performance.',
    category: 'metacognition',
    objectives: [
      'Learn effective reflection frameworks',
      'Practice regular learning reflection',
      'Use reflection insights to improve',
    ],
    prerequisites: ['NS-META-1.2', 'NS-META-1.3'],
    assessmentCriteria: [
      'Uses structured reflection regularly',
      'Generates actionable insights from reflection',
      'Shows improvement from reflection practice',
    ],
    masteryIndicators: [
      'Has habitual reflection practice',
      'Consistently improves from reflection',
      'Can guide others in reflection',
    ],
    practiceActivities: [
      'Post-learning reflection exercises',
      'Exam wrapper completion',
      'Weekly learning review',
    ],
    realWorldApplications: [
      'Continuous improvement',
      'Professional development',
      'Life learning optimization',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '6-9',
    estimatedHours: 2,
  },

  // ===== PLASTICITY STANDARDS =====
  'NS-PLAST-1.1': {
    id: 'NS-PLAST-1.1',
    title: 'Understand brain changeability',
    description: 'Grasp the fundamental concept that the brain changes through experience.',
    category: 'plasticity',
    objectives: [
      'Explain basic neuroplasticity mechanisms',
      'Understand that intelligence is not fixed',
      'Recognize implications for learning',
    ],
    prerequisites: [],
    assessmentCriteria: [
      'Correctly describes neuroplasticity',
      'Can give examples of brain change',
      'Applies plasticity understanding to own learning',
    ],
    masteryIndicators: [
      'Deeply believes in brain changeability',
      'Uses knowledge to persist through difficulty',
      'Can explain neuroplasticity to others',
    ],
    practiceActivities: [
      'Brain change evidence review',
      'Personal growth documentation',
      'Neuroplasticity case study analysis',
    ],
    realWorldApplications: [
      'Approaching new challenges',
      'Recovery from setbacks',
      'Lifelong learning belief',
    ],
    difficultyLevel: 2,
    suggestedGradeRange: '4-6',
    estimatedHours: 1.5,
  },

  'NS-PLAST-1.2': {
    id: 'NS-PLAST-1.2',
    title: 'Apply deliberate practice principles',
    description: 'Use deliberate practice to accelerate skill development.',
    category: 'plasticity',
    objectives: [
      'Distinguish deliberate practice from mere experience',
      'Design deliberate practice routines',
      'Seek and use appropriate feedback',
    ],
    prerequisites: ['NS-PLAST-1.1'],
    assessmentCriteria: [
      'Practices at edge of ability',
      'Seeks specific feedback',
      'Shows accelerated improvement',
    ],
    masteryIndicators: [
      'Has deliberate practice routines',
      'Consistently practices at appropriate difficulty',
      'Can design practice for others',
    ],
    practiceActivities: [
      'Deliberate practice design exercise',
      'Feedback seeking practice',
      'Edge-of-ability identification',
    ],
    realWorldApplications: [
      'Skill development in any domain',
      'Expert performance pursuit',
      'Efficient learning',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '7-10',
    estimatedHours: 3,
  },

  'NS-PLAST-1.3': {
    id: 'NS-PLAST-1.3',
    title: 'Leverage sensitive periods',
    description: 'Understand and work with developmental windows for learning.',
    category: 'plasticity',
    objectives: [
      'Understand sensitive periods concept',
      'Identify relevant sensitive periods',
      'Optimize learning during open windows',
    ],
    prerequisites: ['NS-PLAST-1.1'],
    assessmentCriteria: [
      'Correctly describes sensitive periods',
      'Identifies current developmental opportunities',
      'Prioritizes time-sensitive learning',
    ],
    masteryIndicators: [
      'Makes learning decisions considering sensitive periods',
      'Understands both possibilities and limitations',
      'Can advise others on sensitive periods',
    ],
    practiceActivities: [
      'Sensitive period mapping',
      'Current window identification',
      'Learning priority analysis',
    ],
    realWorldApplications: [
      'Language learning timing',
      'Music and motor skill development',
      'Educational planning',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '9-12',
    estimatedHours: 2,
  },

  'NS-PLAST-2.1': {
    id: 'NS-PLAST-2.1',
    title: 'Support myelination through practice',
    description: 'Understand and leverage myelination for skill automatization.',
    category: 'plasticity',
    objectives: [
      'Explain myelination and its function',
      'Understand how practice drives myelination',
      'Design practice for myelination',
    ],
    prerequisites: ['NS-PLAST-1.2'],
    assessmentCriteria: [
      'Correctly describes myelination process',
      'Uses repetitive practice appropriately',
      'Understands automatization through myelination',
    ],
    masteryIndicators: [
      'Designs practice for automatization',
      'Persists through repetitive practice',
      'Can explain myelination to others',
    ],
    practiceActivities: [
      'Skill automatization project',
      'Myelination-focused practice design',
      'Before/after automatization comparison',
    ],
    realWorldApplications: [
      'Building automatic skills',
      'Freeing cognitive resources',
      'Expert performance development',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '8-11',
    estimatedHours: 2,
  },

  'NS-PLAST-2.2': {
    id: 'NS-PLAST-2.2',
    title: 'Use enriched environments',
    description: 'Design learning environments that support brain development.',
    category: 'plasticity',
    objectives: [
      'Understand enriched environment effects on brain',
      'Identify enrichment factors',
      'Create enriched learning contexts',
    ],
    prerequisites: ['NS-PLAST-1.1'],
    assessmentCriteria: [
      'Describes enrichment effects accurately',
      'Identifies enrichment opportunities',
      'Creates enriched environments',
    ],
    masteryIndicators: [
      'Actively creates enriched environments',
      'Understands enrichment principles deeply',
      'Can design environments for others',
    ],
    practiceActivities: [
      'Environment enrichment audit',
      'Enrichment design project',
      'Multi-modal learning integration',
    ],
    realWorldApplications: [
      'Study space design',
      'Learning activity selection',
      'Child development support',
    ],
    difficultyLevel: 4,
    suggestedGradeRange: '6-9',
    estimatedHours: 2,
  },

  'NS-PLAST-2.3': {
    id: 'NS-PLAST-2.3',
    title: 'Balance challenge and support',
    description: 'Optimize the challenge level for maximum brain development.',
    category: 'plasticity',
    objectives: [
      'Understand zone of proximal development',
      'Identify optimal challenge levels',
      'Balance struggle with support',
    ],
    prerequisites: ['NS-PLAST-1.2', 'NS-EMO-1.2'],
    assessmentCriteria: [
      'Correctly identifies optimal challenge',
      'Seeks appropriate difficulty',
      'Knows when to seek support',
    ],
    masteryIndicators: [
      'Consistently operates in growth zone',
      'Adjusts challenge appropriately',
      'Can calibrate challenge for others',
    ],
    practiceActivities: [
      'Challenge level calibration exercises',
      'Zone of proximal development mapping',
      'Support seeking practice',
    ],
    realWorldApplications: [
      'Self-directed learning',
      'Tutoring and teaching',
      'Skill development optimization',
    ],
    difficultyLevel: 5,
    suggestedGradeRange: '7-10',
    estimatedHours: 2,
  },
};

// =============================================================================
// EMOTION REGULATION STRATEGIES
// =============================================================================

export const EMOTION_REGULATION_STRATEGIES: EmotionRegulationStrategy[] = [
  {
    id: 'strategy-cognitive-reappraisal',
    name: 'Cognitive Reappraisal',
    type: 'cognitive',
    targetEmotions: ['anxious', 'frustrated', 'overwhelmed'],
    contraindicated: ['bored'],
    mechanism: 'Reframes the meaning of a situation to change its emotional impact. Changes interpretation before emotion fully develops.',
    brainSystems: ['prefrontal_cortex', 'amygdala', 'anterior_cingulate'],
    steps: [
      'Notice the emotion and triggering thought',
      'Pause and question the interpretation',
      'Generate alternative interpretations',
      'Choose a more balanced/helpful interpretation',
      'Notice the shift in emotional response',
    ],
    durationMinutes: 5,
    difficultyLevel: 'intermediate',
    effectivenessRating: 85,
    researchSupport: [
      'Gross, J.J. (2002). Emotion regulation: Affective, cognitive, and social consequences',
      'Ochsner et al. (2002). Rethinking feelings: An fMRI study of cognitive regulation of emotion',
    ],
  },
  {
    id: 'strategy-anxiety-reappraisal',
    name: 'Anxiety-to-Excitement Reappraisal',
    type: 'cognitive',
    targetEmotions: ['anxious'],
    contraindicated: ['calm', 'bored'],
    mechanism: 'Reinterprets anxiety arousal as excitement. Works because both emotions share similar physiological signatures.',
    brainSystems: ['prefrontal_cortex', 'insula'],
    steps: [
      'Notice anxiety symptoms (racing heart, etc.)',
      'Label the feeling: "I am excited"',
      'Focus on approach aspects of the situation',
      'Think about potential positive outcomes',
    ],
    durationMinutes: 2,
    difficultyLevel: 'beginner',
    effectivenessRating: 75,
    researchSupport: [
      'Brooks, A.W. (2014). Get excited: Reappraising pre-performance anxiety as excitement',
    ],
  },
  {
    id: 'strategy-box-breathing',
    name: 'Box Breathing (4-4-4-4)',
    type: 'physiological',
    targetEmotions: ['anxious', 'overwhelmed', 'frustrated'],
    contraindicated: ['bored'],
    mechanism: 'Activates parasympathetic nervous system through controlled breathing. Slows heart rate and reduces cortisol.',
    brainSystems: ['insula', 'amygdala', 'prefrontal_cortex'],
    steps: [
      'Inhale slowly for 4 counts',
      'Hold for 4 counts',
      'Exhale slowly for 4 counts',
      'Hold for 4 counts',
      'Repeat 4-6 times',
    ],
    durationMinutes: 3,
    difficultyLevel: 'beginner',
    effectivenessRating: 80,
    researchSupport: [
      'Ma et al. (2017). The effect of diaphragmatic breathing on attention, negative affect and stress',
    ],
  },
  {
    id: 'strategy-grounding-5-4-3-2-1',
    name: '5-4-3-2-1 Grounding',
    type: 'behavioral',
    targetEmotions: ['anxious', 'overwhelmed'],
    contraindicated: ['bored', 'calm'],
    mechanism: 'Redirects attention to present sensory experience, interrupting anxious future-focused thoughts.',
    brainSystems: ['parietal_cortex', 'occipital_cortex', 'prefrontal_cortex'],
    steps: [
      'Identify 5 things you can see',
      'Identify 4 things you can touch',
      'Identify 3 things you can hear',
      'Identify 2 things you can smell',
      'Identify 1 thing you can taste',
    ],
    durationMinutes: 3,
    difficultyLevel: 'beginner',
    effectivenessRating: 75,
    researchSupport: [
      'Bremner et al. (2006). Psychometric properties of the early trauma inventory',
    ],
  },
  {
    id: 'strategy-self-distancing',
    name: 'Self-Distancing',
    type: 'cognitive',
    targetEmotions: ['anxious', 'frustrated', 'overwhelmed'],
    contraindicated: [],
    mechanism: 'Creates psychological distance by taking third-person perspective, reducing emotional intensity.',
    brainSystems: ['prefrontal_cortex', 'temporal_cortex'],
    steps: [
      'Visualize yourself from outside (third person)',
      'Describe the situation using your name, not "I"',
      'Ask what advice you would give a friend',
      'Consider how you will view this in 5 years',
    ],
    durationMinutes: 5,
    difficultyLevel: 'intermediate',
    effectivenessRating: 78,
    researchSupport: [
      'Kross et al. (2014). Self-talk as a regulatory mechanism',
    ],
  },
  {
    id: 'strategy-body-scan',
    name: 'Body Scan',
    type: 'physiological',
    targetEmotions: ['anxious', 'overwhelmed', 'frustrated'],
    contraindicated: [],
    mechanism: 'Develops interoceptive awareness and releases held tension. Engages parasympathetic system.',
    brainSystems: ['insula', 'prefrontal_cortex'],
    steps: [
      'Find a comfortable position',
      'Focus attention on your feet',
      'Notice any sensations without judgment',
      'Slowly move attention up through body',
      'Release tension as you notice it',
      'End at the top of your head',
    ],
    durationMinutes: 10,
    difficultyLevel: 'beginner',
    effectivenessRating: 82,
    researchSupport: [
      'Kabat-Zinn, J. (1990). Full Catastrophe Living',
    ],
  },
];

// =============================================================================
// SLEEP STAGES
// =============================================================================

export const SLEEP_STAGES: SleepStage[] = [
  {
    stage: 'N1',
    name: 'Light Sleep',
    learningFunction: 'Transition stage; minimal consolidation',
    memoryTypes: [],
    brainwavePattern: 'Theta waves (4-7 Hz)',
    typicalDuration: 5,
  },
  {
    stage: 'N2',
    name: 'Light Sleep with Spindles',
    learningFunction: 'Memory consolidation begins; sleep spindles integrate new memories with existing knowledge',
    memoryTypes: ['semantic', 'procedural'],
    brainwavePattern: 'Sleep spindles and K-complexes',
    typicalDuration: 25,
  },
  {
    stage: 'N3',
    name: 'Deep Sleep (Slow-Wave)',
    learningFunction: 'Critical for declarative memory consolidation; hippocampal replay transfers memories to cortex',
    memoryTypes: ['episodic', 'semantic', 'working'],
    brainwavePattern: 'Delta waves (0.5-4 Hz)',
    typicalDuration: 25,
  },
  {
    stage: 'REM',
    name: 'Rapid Eye Movement',
    learningFunction: 'Procedural and emotional memory consolidation; creative insight; emotional processing',
    memoryTypes: ['procedural', 'emotional', 'episodic'],
    brainwavePattern: 'Mixed frequency, similar to waking',
    typicalDuration: 25,
  },
];

// =============================================================================
// CIRCADIAN LEARNING WINDOWS
// =============================================================================

export const CIRCADIAN_WINDOWS: CircadianLearningWindow[] = [
  {
    timeRange: { start: '06:00', end: '09:00' },
    optimalFor: ['retrieval', 'focused'],
    cognitiveStrengths: ['Alertness rising', 'Good for review', 'Creativity peak for some'],
    cognitiveWeaknesses: ['Working memory not at peak', 'Cortisol high'],
    hormonalState: {
      dopamine: 'moderate',
      norepinephrine: 'high',
      serotonin: 'low',
      acetylcholine: 'moderate',
      gaba: 'low',
      glutamate: 'moderate',
      cortisol: 'high',
      oxytocin: 'low',
    },
  },
  {
    timeRange: { start: '09:00', end: '12:00' },
    optimalFor: ['focused', 'elaborative', 'retrieval'],
    cognitiveStrengths: ['Peak alertness', 'Best analytical thinking', 'Working memory optimal'],
    cognitiveWeaknesses: ['May be too alert for creative/diffuse thinking'],
    hormonalState: {
      dopamine: 'high',
      norepinephrine: 'high',
      serotonin: 'moderate',
      acetylcholine: 'high',
      gaba: 'low',
      glutamate: 'high',
      cortisol: 'moderate',
      oxytocin: 'moderate',
    },
  },
  {
    timeRange: { start: '12:00', end: '14:00' },
    optimalFor: ['interleaved', 'retrieval'],
    cognitiveStrengths: ['Good for routine tasks', 'Social learning'],
    cognitiveWeaknesses: ['Post-lunch dip', 'Reduced alertness', 'Not ideal for new complex material'],
    hormonalState: {
      dopamine: 'moderate',
      norepinephrine: 'low',
      serotonin: 'high',
      acetylcholine: 'low',
      gaba: 'moderate',
      glutamate: 'moderate',
      cortisol: 'low',
      oxytocin: 'high',
    },
  },
  {
    timeRange: { start: '14:00', end: '16:00' },
    optimalFor: ['diffuse', 'generative'],
    cognitiveStrengths: ['Creativity may be higher', 'Good for insight problems'],
    cognitiveWeaknesses: ['Alertness low', 'Not ideal for memorization', 'Energy dip'],
    hormonalState: {
      dopamine: 'low',
      norepinephrine: 'low',
      serotonin: 'moderate',
      acetylcholine: 'low',
      gaba: 'high',
      glutamate: 'low',
      cortisol: 'low',
      oxytocin: 'moderate',
    },
  },
  {
    timeRange: { start: '16:00', end: '19:00' },
    optimalFor: ['focused', 'retrieval', 'elaborative'],
    cognitiveStrengths: ['Second alertness peak', 'Good working memory', 'Physical coordination peak'],
    cognitiveWeaknesses: ['May be tired from day'],
    hormonalState: {
      dopamine: 'high',
      norepinephrine: 'moderate',
      serotonin: 'moderate',
      acetylcholine: 'high',
      gaba: 'low',
      glutamate: 'high',
      cortisol: 'low',
      oxytocin: 'moderate',
    },
  },
  {
    timeRange: { start: '19:00', end: '22:00' },
    optimalFor: ['diffuse', 'generative', 'retrieval'],
    cognitiveStrengths: ['Good for review before sleep', 'Creativity window', 'Reflection time'],
    cognitiveWeaknesses: ['Declining alertness', 'Not ideal for new complex material'],
    hormonalState: {
      dopamine: 'moderate',
      norepinephrine: 'low',
      serotonin: 'high',
      acetylcholine: 'moderate',
      gaba: 'high',
      glutamate: 'low',
      cortisol: 'low',
      oxytocin: 'high',
    },
  },
];

// =============================================================================
// PLASTICITY ENHANCERS
// =============================================================================

export const PLASTICITY_ENHANCERS: PlasticityEnhancer[] = [
  {
    id: 'enhancer-exercise',
    name: 'Aerobic Exercise',
    mechanism: 'neurogenesis',
    description: 'Aerobic exercise increases BDNF (brain-derived neurotrophic factor), promoting neurogenesis in the hippocampus and enhancing learning capacity.',
    practicalApplications: [
      '20-30 minutes of moderate cardio before learning',
      'Regular exercise routine (3-4 times per week)',
      'Walking breaks during study sessions',
    ],
    contraindications: [
      'Exercising to exhaustion impairs cognition',
      'Allow 15-20 minutes after exercise before demanding cognitive work',
    ],
    optimalDuration: 30,
    optimalFrequency: '3-4x/week',
    researchSupport: 'strong',
    keyCitations: [
      'Hillman et al. (2008). Be smart, exercise your heart: Exercise effects on brain and cognition',
      'Ratey, J. (2008). Spark: The Revolutionary New Science of Exercise and the Brain',
    ],
  },
  {
    id: 'enhancer-sleep',
    name: 'Quality Sleep',
    mechanism: 'synaptic_strengthening',
    description: 'Sleep consolidates memories and enables synaptic homeostasis—pruning weak connections and strengthening important ones.',
    practicalApplications: [
      'Consistent 7-9 hours of sleep',
      'Study key material before sleep',
      'Maintain regular sleep schedule',
    ],
    contraindications: [
      'Sleeping too little is harmful',
      'Sleeping too much may indicate other issues',
      'Irregular schedules impair consolidation',
    ],
    optimalDuration: 480,
    optimalFrequency: 'daily',
    researchSupport: 'strong',
    keyCitations: [
      'Walker, M. (2017). Why We Sleep',
      'Tononi & Cirelli (2014). Sleep and the price of plasticity',
    ],
  },
  {
    id: 'enhancer-novelty',
    name: 'Novelty and Challenge',
    mechanism: 'synaptogenesis',
    description: 'Novel experiences and optimal challenge drive formation of new synaptic connections. The brain grows in response to demands placed on it.',
    practicalApplications: [
      'Seek challenging but achievable tasks',
      'Learn new skills regularly',
      'Vary learning environments and methods',
    ],
    contraindications: [
      'Too much novelty without consolidation is counterproductive',
      'Challenge without adequate support causes stress',
    ],
    optimalDuration: 60,
    optimalFrequency: 'daily',
    researchSupport: 'strong',
    keyCitations: [
      'Eagleman, D. (2020). Livewired',
      'Merzenich, M. (2013). Soft-Wired',
    ],
  },
  {
    id: 'enhancer-social-learning',
    name: 'Social Learning',
    mechanism: 'receptor_changes',
    description: 'Social interaction releases oxytocin and enhances learning through emotional engagement, mirror neuron activation, and collaborative elaboration.',
    practicalApplications: [
      'Study groups and peer learning',
      'Teaching others what you learn',
      'Discussion-based learning',
    ],
    contraindications: [
      'Social anxiety can impair learning',
      'Group dynamics can be distracting',
      'Balance social and individual study',
    ],
    optimalDuration: 45,
    optimalFrequency: '2-3x/week',
    researchSupport: 'moderate',
    keyCitations: [
      'Lieberman, M. (2013). Social: Why Our Brains Are Wired to Connect',
    ],
  },
  {
    id: 'enhancer-mindfulness',
    name: 'Mindfulness Meditation',
    mechanism: 'dendritic_growth',
    description: 'Regular meditation practice increases gray matter in attention and emotional regulation regions, enhancing cognitive control.',
    practicalApplications: [
      '10-20 minutes daily meditation',
      'Brief mindfulness before study sessions',
      'Mindful awareness during learning',
    ],
    contraindications: [
      'Not a quick fix—requires consistent practice',
      'Some forms may not be suitable for trauma',
    ],
    optimalDuration: 15,
    optimalFrequency: 'daily',
    researchSupport: 'moderate',
    keyCitations: [
      'Hölzel et al. (2011). Mindfulness practice leads to increases in regional brain gray matter density',
    ],
  },
];

// =============================================================================
// SAMPLE EXERCISES
// =============================================================================

export const SAMPLE_NS_EXERCISES: NSExercise[] = [
  {
    id: 'exercise-spacing-experiment',
    standardId: 'NS-MEM-1.2',
    title: 'Personal Spacing Experiment',
    description: 'Conduct a self-experiment to demonstrate the spacing effect with vocabulary learning.',
    instructions: [
      'Select 40 new vocabulary words or facts to learn',
      'Divide into two groups of 20',
      'Group A: Study all at once (massed practice) for 30 minutes',
      'Group B: Study 10 minutes on Day 1, 10 minutes on Day 3, 10 minutes on Day 5',
      'Test yourself on both groups on Day 7',
      'Compare results and reflect on the experience',
    ],
    durationMinutes: 60,
    type: 'experiment',
    mode: 'focused',
    targetBrainSystems: ['hippocampus', 'prefrontal_cortex'],
    cognitiveLoadLevel: 4,
    successCriteria: [
      'Completes both study conditions',
      'Conducts fair comparison test',
      'Correctly interprets results',
      'Can explain the spacing effect',
    ],
    rubric: [
      { level: 4, description: 'Expertly designs and conducts experiment, draws sophisticated conclusions', examples: ['Controls for confounds', 'Considers individual factors'] },
      { level: 3, description: 'Successfully completes experiment and correctly interprets results', examples: ['Clear data collection', 'Accurate conclusions'] },
      { level: 2, description: 'Completes experiment with some methodological issues', examples: ['Unequal conditions', 'Basic interpretation'] },
      { level: 1, description: 'Incomplete experiment or incorrect conclusions', examples: ['Missing data', 'Misattributes results'] },
    ],
    difficulty: 4,
    hints: [
      'Use similar difficulty words in both groups',
      'Study at the same time of day',
      'Don\'t review between sessions except as planned',
    ],
    prerequisiteExercises: [],
  },
  {
    id: 'exercise-retrieval-comparison',
    standardId: 'NS-MEM-1.3',
    title: 'Retrieval vs. Re-reading Challenge',
    description: 'Compare the effectiveness of retrieval practice versus re-reading.',
    instructions: [
      'Read a short educational article once',
      'Split the content into two halves',
      'Half A: Re-read 3 times over 20 minutes',
      'Half B: Read once, then do 3 recall attempts without looking',
      'Wait 24 hours',
      'Test yourself on both halves',
      'Record and compare results',
    ],
    durationMinutes: 45,
    type: 'experiment',
    mode: 'retrieval',
    targetBrainSystems: ['hippocampus', 'prefrontal_cortex'],
    cognitiveLoadLevel: 5,
    successCriteria: [
      'Completes both conditions faithfully',
      'Conducts fair test after delay',
      'Recognizes retrieval practice superiority',
      'Commits to using retrieval practice',
    ],
    rubric: [
      { level: 4, description: 'Thorough experiment with insightful analysis of why retrieval works', examples: ['Connects to brain mechanisms', 'Plans future application'] },
      { level: 3, description: 'Completes experiment and correctly interprets testing effect', examples: ['Clear difference observed', 'Accurate explanation'] },
      { level: 2, description: 'Experiment completed but analysis is superficial', examples: ['Results noted but not explained', 'Limited insight'] },
      { level: 1, description: 'Incomplete or misinterpreted experiment', examples: ['Conditions mixed', 'Wrong conclusions'] },
    ],
    difficulty: 4,
    hints: [
      'Don\'t peek during retrieval practice—the struggle is the point',
      'It\'s okay if retrieval feels harder—that\'s the desirable difficulty',
      'Test both halves with the same type of questions',
    ],
    prerequisiteExercises: [],
  },
  {
    id: 'exercise-arousal-calibration',
    standardId: 'NS-EMO-2.2',
    title: 'Arousal Level Calibration',
    description: 'Learn to identify and adjust your arousal level for optimal performance.',
    instructions: [
      'Over one week, rate your arousal level (1-10) before various activities',
      'Note whether the arousal level felt optimal for the task',
      'Identify activities/techniques that raise your arousal',
      'Identify activities/techniques that lower your arousal',
      'Practice using these to adjust arousal intentionally',
      'Create a personal arousal management toolkit',
    ],
    durationMinutes: 15,
    type: 'practice',
    mode: 'focused',
    targetBrainSystems: ['prefrontal_cortex', 'amygdala', 'insula'],
    cognitiveLoadLevel: 3,
    successCriteria: [
      'Accurately identifies current arousal level',
      'Knows techniques for both directions',
      'Successfully adjusts arousal when needed',
      'Has personalized toolkit',
    ],
    rubric: [
      { level: 4, description: 'Expert arousal awareness with diverse, effective adjustment techniques', examples: ['Rapid accurate assessment', 'Multiple reliable techniques'] },
      { level: 3, description: 'Good arousal awareness and at least 2 techniques in each direction', examples: ['Usually accurate assessment', 'Effective adjustments'] },
      { level: 2, description: 'Basic awareness, limited adjustment ability', examples: ['Delayed recognition', 'One technique per direction'] },
      { level: 1, description: 'Difficulty identifying arousal or adjusting it', examples: ['Unaware of state', 'Techniques don\'t work'] },
    ],
    difficulty: 3,
    hints: [
      'Physical sensations are often the clearest arousal indicators',
      'What works for others may not work for you—experiment',
      'Start practicing when the stakes are low',
    ],
    prerequisiteExercises: [],
  },
];

// =============================================================================
// SAMPLE SELF-EXPERIMENTS
// =============================================================================

export const SAMPLE_SELF_EXPERIMENTS: NSSelfExperiment[] = [
  {
    id: 'self-exp-sleep',
    standardId: 'NS-MEM-2.1',
    title: 'Sleep and Learning Performance',
    principle: 'Sleep is essential for memory consolidation',
    hypothesis: 'I will perform better on recall tests when I have had adequate sleep (7-9 hours) compared to insufficient sleep (<6 hours).',
    controlCondition: 'Study session followed by 5-6 hours of sleep',
    experimentalCondition: 'Study session followed by 8 hours of sleep',
    duration: '2 weeks',
    measurementMethod: 'Quiz scores on comparable material studied the night before',
    dataPoints: [
      { name: 'hours_slept', type: 'numeric', frequency: 'daily' },
      { name: 'sleep_quality', type: 'categorical', frequency: 'daily' },
      { name: 'quiz_score', type: 'numeric', frequency: 'every 2-3 days' },
      { name: 'subjective_alertness', type: 'numeric', frequency: 'daily' },
    ],
    expectedOutcome: 'Higher quiz scores and better subjective alertness after adequate sleep nights',
    howToInterpret: 'Compare average quiz scores after adequate vs. inadequate sleep nights. A meaningful difference is 10% or more.',
    personalVariables: [
      'Individual sleep needs vary (some need more, some less)',
      'Sleep quality matters as much as quantity',
      'Stress and other factors affect both sleep and performance',
    ],
    reflectionPrompts: [
      'How did your performance differ between conditions?',
      'What barriers prevent you from getting adequate sleep regularly?',
      'What one change could you make to improve your sleep?',
      'How will this experiment change your study habits?',
    ],
  },
  {
    id: 'self-exp-attention-breaks',
    standardId: 'NS-ATT-2.3',
    title: 'Break Activities and Attention Restoration',
    principle: 'Different break activities restore attention differently',
    hypothesis: 'Nature exposure and physical movement will restore attention better than phone use during study breaks.',
    controlCondition: 'Phone/social media use during breaks',
    experimentalCondition: 'A) Brief walk outside, B) Physical stretching',
    duration: '1 week',
    measurementMethod: 'Sustained attention test (simple reaction time or focus duration) before and after breaks',
    dataPoints: [
      { name: 'break_type', type: 'categorical', frequency: 'each break' },
      { name: 'break_duration', type: 'numeric', frequency: 'each break' },
      { name: 'attention_before', type: 'numeric', frequency: 'each break' },
      { name: 'attention_after', type: 'numeric', frequency: 'each break' },
      { name: 'subjective_refreshment', type: 'numeric', frequency: 'each break' },
    ],
    expectedOutcome: 'Greater attention restoration after nature/movement breaks compared to phone breaks',
    howToInterpret: 'Compare attention improvement (after minus before) across break types. Look for patterns in which breaks feel most refreshing.',
    personalVariables: [
      'Weather and environment affect nature break effectiveness',
      'Phone use habits vary in how draining they are',
      'Physical state affects movement break benefits',
    ],
    reflectionPrompts: [
      'Which break type restored your attention most effectively?',
      'Why do you think phone breaks may be less restorative?',
      'What makes restorative breaks difficult to take?',
      'How will you change your break habits based on this experiment?',
    ],
  },
];

export default {};
