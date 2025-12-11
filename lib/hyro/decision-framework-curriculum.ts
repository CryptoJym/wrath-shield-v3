/**
 * Decision Framework Curriculum - Hyro Education System
 *
 * @hyro-domain decision_science
 * @hyro-standards DS-1.*, DS-2.*, DS-3.*, DS-4.*
 * @hyro-manifold Integrated with C/E/G through Strategic Thinking dimension
 * @hyro-metacognition Core design principle - every technique taught with WHY it works
 *
 * DESIGN PRINCIPLES:
 * 1. Pre-mortem technique based on Gary Klein's research
 * 2. Choice architecture from Thaler & Sunstein's "Nudge"
 * 3. Probabilistic thinking from Annie Duke's "Thinking in Bets"
 * 4. Integration with existing WRAP framework
 */

import type {
  DSStandard,
  DSStandardId,
  NudgeType,
  NudgeDesign,
  DecisionExercise,
  PreMortemAnalysis,
  DecisionBet,
} from './decision-framework-types';

// =============================================================================
// PRE-MORTEM CURRICULUM
// =============================================================================

/**
 * Pre-mortem technique guide - based on Gary Klein's research
 */
export const PREMORTEM_GUIDE = {
  overview: {
    name: 'Pre-Mortem Analysis',
    creator: 'Gary Klein',
    source: 'Sources of Power (1998), Harvard Business Review (2007)',
    purpose: 'Uncover hidden risks by imagining failure BEFORE it happens',

    whyItWorks: [
      'Counteracts overconfidence by making failure psychologically "real"',
      'Gives permission to voice concerns that might otherwise be suppressed',
      'Activates prospective hindsight - we\'re better at explaining past events than predicting future ones',
      'Leverages the brain\'s natural narrative-building ability',
      'Reduces groupthink by legitimizing dissent',
    ],

    whenToUse: [
      'Before major decisions with significant consequences',
      'When launching new projects or initiatives',
      'When team seems overconfident about success',
      'When there\'s pressure to conform (groupthink risk)',
      'Before irreversible commitments',
    ],

    limitations: [
      'Works best with team/group input (diverse perspectives)',
      'Time investment required (30-60 minutes minimum)',
      'Quality depends on psychological safety',
      'Can induce excessive pessimism if not balanced',
    ],
  },

  steps: [
    {
      step: 1,
      name: 'Setup',
      description: 'Frame the decision and gather participants',
      duration: '5 minutes',
      instructions: [
        'Clearly state the decision or project being analyzed',
        'Identify all stakeholders who should participate',
        'Establish psychological safety (all concerns are valid)',
        'Set a specific future timeframe (e.g., "6 months from now")',
      ],
      facilitatorNotes: [
        'Emphasize that this is about process improvement, not blame',
        'Mix experience levels for diverse perspectives',
      ],
    },
    {
      step: 2,
      name: 'Imagine Failure',
      description: 'Vividly imagine the project has failed completely',
      duration: '5 minutes',
      instructions: [
        'Say: "Imagine we are 6 months in the future..."',
        '"The decision we made today has failed SPECTACULARLY."',
        '"It\'s the worst failure anyone has seen."',
        'Give participants 2-3 minutes to silently imagine this scenario',
        'Make it vivid - what does failure look, feel, smell like?',
      ],
      facilitatorNotes: [
        'The more vivid, the better the brainstorming',
        'Silence is important - let imaginations work',
        'Some discomfort is normal and productive',
      ],
    },
    {
      step: 3,
      name: 'Brainstorm Causes',
      description: 'Generate all possible reasons for the failure',
      duration: '15-20 minutes',
      instructions: [
        'Each person independently writes down ALL reasons why it failed',
        'No filtering - write everything, even "silly" ideas',
        'Think across categories: internal, external, execution, assumptions',
        'Consider: people, process, technology, market, timing, resources',
        'Round-robin sharing: each person shares one cause, repeat until exhausted',
      ],
      facilitatorNotes: [
        'Independent writing BEFORE sharing prevents anchoring',
        'Encourage quantity over quality initially',
        'Probe for specifics: "What exactly would cause that?"',
      ],
    },
    {
      step: 4,
      name: 'Prioritize Risks',
      description: 'Rank failure causes by likelihood and impact',
      duration: '10 minutes',
      instructions: [
        'For each cause, estimate likelihood (0-100%)',
        'For each cause, estimate impact if it occurs (0-100)',
        'Calculate risk score: likelihood × impact / 100',
        'Sort by risk score',
        'Focus on top 5-7 risks',
      ],
      facilitatorNotes: [
        'Voting can speed this up for large lists',
        'Don\'t over-engineer - rough estimates are fine',
      ],
    },
    {
      step: 5,
      name: 'Create Mitigations',
      description: 'Develop specific actions to prevent or detect each risk',
      duration: '15-20 minutes',
      instructions: [
        'For each top risk, ask: "How can we prevent this?"',
        'If it can\'t be prevented: "How can we detect it early?"',
        'If it can\'t be detected: "How can we minimize impact?"',
        'Assign owner and deadline for each mitigation',
        'Create specific, measurable tripwires',
      ],
      facilitatorNotes: [
        'Actions must be specific and actionable',
        'Owner must accept responsibility',
        'Tripwires must be objective, not subjective',
      ],
    },
    {
      step: 6,
      name: 'Document & Review',
      description: 'Record findings and schedule follow-up',
      duration: '5 minutes',
      instructions: [
        'Document all risks, mitigations, and tripwires',
        'Share with all stakeholders',
        'Schedule review of tripwires at appropriate intervals',
        'Plan retrospective to compare predictions with reality',
      ],
      facilitatorNotes: [
        'Documentation enables learning from predictions',
        'Regular review prevents "set and forget"',
      ],
    },
  ],

  // Example prompts to stimulate thinking
  brainstormPrompts: {
    internal: [
      'What could go wrong with our team?',
      'What skills might we be missing?',
      'What internal conflicts could derail us?',
      'What if key people leave?',
      'What processes might break down?',
    ],
    external: [
      'What could competitors do?',
      'What market changes could hurt us?',
      'What regulatory changes are possible?',
      'What economic factors could affect this?',
      'What technology shifts might matter?',
    ],
    execution: [
      'What if we run out of time?',
      'What if we run out of money?',
      'What dependencies could fail?',
      'What if quality is worse than expected?',
      'What if scaling is harder than anticipated?',
    ],
    assumptions: [
      'What are we assuming about customers?',
      'What are we assuming about technology?',
      'What are we assuming about costs?',
      'What are we assuming about timeline?',
      'What "obvious" things might be wrong?',
    ],
  },

  // Tripwire templates
  tripwireTemplates: [
    {
      category: 'Financial',
      template: 'If [metric] exceeds/falls below [threshold] by [date], we will [action]',
      examples: [
        'If burn rate exceeds $50K/month by Month 3, we will cut feature scope by 30%',
        'If revenue is below $10K by Month 6, we will pivot to B2B',
      ],
    },
    {
      category: 'Timeline',
      template: 'If [milestone] is not complete by [date], we will [action]',
      examples: [
        'If MVP is not deployed by March 1, we will descope authentication features',
        'If beta testing hasn\'t started by April 15, we will delay launch by 1 month',
      ],
    },
    {
      category: 'Quality',
      template: 'If [quality metric] is below [threshold], we will [action]',
      examples: [
        'If NPS falls below 30, we will pause new features for UX improvement sprint',
        'If bug count exceeds 50 critical issues, we will enter code freeze',
      ],
    },
    {
      category: 'Team',
      template: 'If [team metric] indicates [condition], we will [action]',
      examples: [
        'If more than 2 team members express burnout concerns, we will reduce sprint scope',
        'If velocity drops below 60% of baseline for 2 sprints, we will investigate',
      ],
    },
  ],
};

// =============================================================================
// CHOICE ARCHITECTURE CURRICULUM (Nudge)
// =============================================================================

export const NUDGE_CURRICULUM: Record<NudgeType, {
  name: string;
  description: string;
  psychologicalBasis: string;
  whenToUse: string[];
  howToImplement: string[];
  examples: Array<{ context: string; implementation: string; effect: string }>;
  ethicalConsiderations: string[];
  limitations: string[];
}> = {
  default_option: {
    name: 'Default Options',
    description: 'Make the preferred choice the automatic default',
    psychologicalBasis: 'Status quo bias and effort aversion mean people stick with defaults. Defaults can increase adoption of beneficial behaviors from ~30% to ~90%.',

    whenToUse: [
      'When there\'s a clearly beneficial option',
      'When people often choose suboptimally due to inertia',
      'When the choice can be easily overridden',
      'When you can\'t or shouldn\'t mandate the behavior',
    ],

    howToImplement: [
      'Identify the behavior you want to encourage',
      'Make it the pre-selected option',
      'Ensure opt-out is easy and prominent',
      'Consider "active choice" if defaults feel manipulative',
    ],

    examples: [
      {
        context: 'Retirement savings',
        implementation: 'Auto-enroll employees in 401(k) with 6% contribution',
        effect: 'Participation increased from 49% to 86%',
      },
      {
        context: 'Organ donation',
        implementation: 'Opt-out rather than opt-in for donor registration',
        effect: 'Consent rates increased from ~15% to ~90%',
      },
      {
        context: 'Software settings',
        implementation: 'Privacy-protective settings as default',
        effect: 'Most users keep protective defaults',
      },
    ],

    ethicalConsiderations: [
      'Defaults should align with user\'s likely preferences',
      'Opt-out must be genuinely easy',
      'Be transparent about defaults',
      'Avoid defaults that primarily benefit the organization',
    ],

    limitations: [
      'Doesn\'t work when people have strong preferences',
      'Can backfire if default is clearly self-serving',
      'May reduce engagement if people don\'t think about choice',
    ],
  },

  feedback_loop: {
    name: 'Feedback Loops',
    description: 'Provide immediate, clear feedback on behavior and its consequences',
    psychologicalBasis: 'Behavior change requires awareness of current behavior. Immediate feedback creates tighter cause-effect connection than delayed feedback.',

    whenToUse: [
      'When people don\'t know their current behavior',
      'When consequences are delayed or invisible',
      'When behavior needs gradual adjustment',
      'When intrinsic motivation can be developed',
    ],

    howToImplement: [
      'Make the feedback immediate (or as close as possible)',
      'Make it clear and understandable',
      'Connect behavior directly to outcomes',
      'Include comparison points (past self, peers, goals)',
    ],

    examples: [
      {
        context: 'Energy consumption',
        implementation: 'Real-time display showing current electricity usage and cost',
        effect: '5-15% reduction in energy use',
      },
      {
        context: 'Driving behavior',
        implementation: 'Instant MPG display in car dashboard',
        effect: 'Improved fuel efficiency through behavior adjustment',
      },
      {
        context: 'Learning',
        implementation: 'Immediate quiz results with explanations',
        effect: 'Better retention and error correction',
      },
    ],

    ethicalConsiderations: [
      'Feedback should empower, not shame',
      'Allow user control over feedback frequency/visibility',
      'Be accurate - incorrect feedback erodes trust',
    ],

    limitations: [
      'Can be overwhelming if too frequent',
      'May cause anxiety if feedback is consistently negative',
      'Requires technology investment for real-time feedback',
    ],
  },

  simplification: {
    name: 'Simplification',
    description: 'Reduce complexity and friction to make good choices easier',
    psychologicalBasis: 'Decision fatigue and cognitive load reduce willpower. Every friction point is a chance to give up.',

    whenToUse: [
      'When complexity prevents action',
      'When good options are buried in noise',
      'When the process has unnecessary steps',
      'When information overload causes paralysis',
    ],

    howToImplement: [
      'Reduce the number of steps required',
      'Eliminate unnecessary choices',
      'Use plain language instead of jargon',
      'Pre-fill information where possible',
      'Break complex decisions into smaller chunks',
    ],

    examples: [
      {
        context: 'College financial aid',
        implementation: 'Pre-filled FAFSA forms using tax data',
        effect: '8% increase in aid applications',
      },
      {
        context: 'Voting',
        implementation: 'Same-day registration and mail-in ballots',
        effect: 'Increased voter participation',
      },
      {
        context: 'Medication adherence',
        implementation: 'Weekly pill organizers with day labels',
        effect: 'Improved medication compliance',
      },
    ],

    ethicalConsiderations: [
      'Don\'t oversimplify to the point of removing important information',
      'Ensure simplification doesn\'t reduce autonomy',
      'Make complexity available for those who want it',
    ],

    limitations: [
      'Some decisions genuinely require complexity',
      'Oversimplification can hide important tradeoffs',
      'May not work for people who want control over details',
    ],
  },

  social_proof: {
    name: 'Social Proof',
    description: 'Show what others do to establish norms and guide behavior',
    psychologicalBasis: 'Humans are social beings who use others\' behavior as information. "If everyone does it, it must be right/safe/normal."',

    whenToUse: [
      'When people are uncertain about correct behavior',
      'When peer behavior is actually positive',
      'When the reference group is relevant to the person',
      'When behavior is visible or can be made visible',
    ],

    howToImplement: [
      'Show what similar others actually do',
      'Use specific numbers ("73% of your neighbors...")',
      'Choose relevant reference groups',
      'Highlight positive behaviors, not negative ones',
    ],

    examples: [
      {
        context: 'Hotel towel reuse',
        implementation: '"75% of guests in this room reused their towels"',
        effect: '33% more towel reuse than generic message',
      },
      {
        context: 'Tax compliance',
        implementation: '"9 out of 10 people in your area pay on time"',
        effect: 'Significant increase in timely payment',
      },
      {
        context: 'Energy conservation',
        implementation: 'Comparison to efficient neighbors on utility bill',
        effect: '2% reduction in energy use',
      },
    ],

    ethicalConsiderations: [
      'Only use accurate statistics',
      'Don\'t highlight negative behaviors (can normalize them)',
      'Consider privacy implications of making behavior visible',
    ],

    limitations: [
      'Can backfire if negative behavior is common ("everyone cheats")',
      'Doesn\'t work well for highly personal decisions',
      'Reference group must be genuinely relevant',
    ],
  },

  salience: {
    name: 'Salience',
    description: 'Make important information prominent and attention-grabbing',
    psychologicalBasis: 'Attention is limited. What we notice shapes what we consider. Invisible information might as well not exist.',

    whenToUse: [
      'When important information is buried or ignored',
      'When consequences are abstract or distant',
      'When competing information drowns out key facts',
      'When people need reminders at decision point',
    ],

    howToImplement: [
      'Place information at the point of decision',
      'Use visual contrast (color, size, position)',
      'Make abstract consequences concrete',
      'Use images and stories, not just numbers',
    ],

    examples: [
      {
        context: 'Cigarette warnings',
        implementation: 'Graphic images on packages',
        effect: 'Increased awareness of health risks',
      },
      {
        context: 'Calorie labels',
        implementation: 'Large, prominent calorie counts on menus',
        effect: 'Reduced calorie consumption at restaurants',
      },
      {
        context: 'Deadline reminders',
        implementation: 'Push notifications before due dates',
        effect: 'Reduced late payments and submissions',
      },
    ],

    ethicalConsiderations: [
      'Salience can be used to manipulate',
      'Don\'t make information salient just because it benefits you',
      'Balance salience - not everything can be prominent',
    ],

    limitations: [
      'Habituation reduces effectiveness over time',
      'Too much salience creates noise',
      'Emotional salience can backfire (fear doesn\'t always motivate)',
    ],
  },

  commitment_device: {
    name: 'Commitment Devices',
    description: 'Help people commit to future actions that serve their long-term interests',
    psychologicalBasis: 'Present bias makes us overweight immediate gratification. Commitment devices let our "planning self" constrain our "doing self."',

    whenToUse: [
      'When people want to change but struggle with follow-through',
      'When immediate desires conflict with long-term goals',
      'When willpower is likely to be depleted at decision time',
      'When the person voluntarily wants to constrain themselves',
    ],

    howToImplement: [
      'Create binding pre-commitments (social, financial, or procedural)',
      'Make it easy to commit, hard to back out',
      'Link commitment to values and identity',
      'Add social accountability',
    ],

    examples: [
      {
        context: 'Savings',
        implementation: 'Automatic transfers on payday before spending',
        effect: 'Increased savings rates',
      },
      {
        context: 'Weight loss',
        implementation: 'Commitment contracts with financial stakes (stickK.com)',
        effect: 'Higher goal achievement rates',
      },
      {
        context: 'Study habits',
        implementation: 'Website blockers during study hours',
        effect: 'Reduced distraction, increased focus time',
      },
    ],

    ethicalConsiderations: [
      'Must be genuinely voluntary',
      'Allow escape valve for genuine emergencies',
      'Stakes should not be ruinous',
    ],

    limitations: [
      'Can feel paternalistic if imposed',
      'Inflexibility can cause problems if circumstances change',
      'Requires initial motivation to set up',
    ],
  },

  implementation_intention: {
    name: 'Implementation Intentions',
    description: 'Create specific if-then plans linking situations to actions',
    psychologicalBasis: 'Intentions often don\'t become actions. "When X happens, I will do Y" creates automatic trigger-response pattern.',

    whenToUse: [
      'When people intend to act but don\'t follow through',
      'When the trigger for action is unclear',
      'When habit formation is the goal',
      'When willpower may be low at decision time',
    ],

    howToImplement: [
      'Specify the WHEN (time/situation trigger)',
      'Specify the WHERE (location)',
      'Specify the HOW (exact action)',
      'Practice the if-then mentally',
    ],

    examples: [
      {
        context: 'Exercise',
        implementation: '"When I finish lunch on weekdays, I will walk for 15 minutes around the building"',
        effect: 'Doubled exercise compliance',
      },
      {
        context: 'Studying',
        implementation: '"When I sit down at my desk after school, I will review flashcards for 10 minutes"',
        effect: 'Increased consistent study behavior',
      },
      {
        context: 'Medication',
        implementation: '"When I brush my teeth at night, I will take my vitamins"',
        effect: 'Improved medication adherence',
      },
    ],

    ethicalConsiderations: [
      'Person should create their own if-then plans',
      'Don\'t impose rigid rules',
      'Allow flexibility for genuine exceptions',
    ],

    limitations: [
      'Requires motivation to create the plan',
      'May not work for complex, context-dependent behaviors',
      'Can feel robotic if over-applied',
    ],
  },

  cooling_off_period: {
    name: 'Cooling-Off Periods',
    description: 'Introduce delay between decision and action for consequential choices',
    psychologicalBasis: 'Emotional "hot" states lead to different decisions than "cool" rational states. Time allows emotions to subside and reflection to occur.',

    whenToUse: [
      'For irreversible or high-stakes decisions',
      'When emotional manipulation is likely',
      'When regret is common after similar decisions',
      'When the decision can reasonably be delayed',
    ],

    howToImplement: [
      'Require waiting period before finalizing',
      'Send confirmation requests after delay',
      'Make cancellation easy during cooling period',
      'Provide information during wait time',
    ],

    examples: [
      {
        context: 'Major purchases',
        implementation: '24-hour wait on purchases over $500',
        effect: 'Reduced impulse buying, fewer returns',
      },
      {
        context: 'Account deletion',
        implementation: '14-day wait to delete social media account',
        effect: 'Reduced regretful deletions',
      },
      {
        context: 'Marriage licenses',
        implementation: 'Waiting period between license and ceremony',
        effect: 'Time for reconsideration (debated effectiveness)',
      },
    ],

    ethicalConsiderations: [
      'Don\'t use to create obstacles to legitimate choices',
      'Cooling period should match decision stakes',
      'Emergency exceptions should exist',
    ],

    limitations: [
      'Can be annoying for genuinely considered decisions',
      'Doesn\'t help if decision is already well-considered',
      'May not work for chronic impulsivity',
    ],
  },

  structured_choice: {
    name: 'Structured Choice',
    description: 'Organize options in ways that facilitate good decisions',
    psychologicalBasis: 'How options are organized affects what we choose. Categorization, ordering, and framing guide attention and comparison.',

    whenToUse: [
      'When there are many options to choose from',
      'When options differ on multiple dimensions',
      'When comparison is difficult',
      'When choice paralysis is likely',
    ],

    howToImplement: [
      'Group similar options together',
      'Order by relevance to user needs',
      'Highlight key differentiating features',
      'Provide comparison tools',
      'Limit options in each category',
    ],

    examples: [
      {
        context: 'Insurance selection',
        implementation: 'Organize by coverage level (basic/standard/premium) with clear feature comparison',
        effect: 'Faster, more confident decisions',
      },
      {
        context: 'Restaurant menus',
        implementation: 'Organize by type, highlight popular/recommended items',
        effect: 'Reduced decision time, increased satisfaction',
      },
      {
        context: 'Course selection',
        implementation: 'Organize by requirement fulfilled, difficulty level',
        effect: 'Better course-student fit',
      },
    ],

    ethicalConsiderations: [
      'Don\'t structure to hide unfavorable options',
      'Make structure logic transparent',
      'Allow alternative views/sorting',
    ],

    limitations: [
      'Structure may not match all users\' mental models',
      'Can impose choice architect\'s priorities',
      'Requires understanding of user needs',
    ],
  },

  mapping: {
    name: 'Mapping',
    description: 'Help people understand the relationship between choices and outcomes',
    psychologicalBasis: 'Abstract features are hard to evaluate. Mapping translates features into understandable, comparable units.',

    whenToUse: [
      'When options have technical specifications',
      'When outcomes are hard to visualize',
      'When long-term consequences matter',
      'When comparison across options is difficult',
    ],

    howToImplement: [
      'Translate technical specs to user-relevant outcomes',
      'Use concrete examples and scenarios',
      'Show projections over time',
      'Provide personalized estimates where possible',
    ],

    examples: [
      {
        context: 'Camera shopping',
        implementation: 'Show sample photos at different megapixel levels',
        effect: 'Better understanding of actual quality differences',
      },
      {
        context: 'Retirement planning',
        implementation: 'Show projected monthly income, not just balance',
        effect: 'More realistic planning decisions',
      },
      {
        context: 'Phone data plans',
        implementation: 'Translate GB to "hours of video" or "songs downloaded"',
        effect: 'Better plan selection for actual usage',
      },
    ],

    ethicalConsiderations: [
      'Mapping should be accurate',
      'Don\'t selectively map favorable attributes only',
      'Include uncertainty when projecting',
    ],

    limitations: [
      'Mapping requires assumptions that may not hold',
      'Personalization requires data',
      'Some features resist simple mapping',
    ],
  },

  error_expected: {
    name: 'Expect Error',
    description: 'Design systems assuming people will make mistakes',
    psychologicalBasis: 'Humans are fallible. Systems designed for perfect behavior will fail. Error-tolerant design accepts human nature.',

    whenToUse: [
      'For any system humans interact with',
      'When mistakes have significant consequences',
      'When cognitive load is high',
      'When attention may be divided',
    ],

    howToImplement: [
      'Make errors reversible where possible',
      'Add confirmation for consequential actions',
      'Provide clear error messages with recovery paths',
      'Use constraints to prevent impossible actions',
      'Create "undo" capabilities',
    ],

    examples: [
      {
        context: 'Email',
        implementation: '"Undo send" feature with 30-second delay',
        effect: 'Reduced regretted emails',
      },
      {
        context: 'File systems',
        implementation: 'Trash/recycle bin instead of immediate deletion',
        effect: 'Recovery from accidental deletions',
      },
      {
        context: 'Forms',
        implementation: 'Save draft automatically, validate before submit',
        effect: 'Reduced lost work, caught errors early',
      },
    ],

    ethicalConsiderations: [
      'Don\'t blame users for system-induced errors',
      'Error recovery should be genuinely easy',
      'Learn from errors to improve design',
    ],

    limitations: [
      'Can\'t prevent all errors',
      'Some errors can\'t be undone',
      'May reduce sense of responsibility',
    ],
  },

  incentive_alignment: {
    name: 'Incentive Alignment',
    description: 'Ensure that immediate incentives support long-term goals',
    psychologicalBasis: 'People respond to incentives. When immediate and long-term incentives conflict, immediate usually wins.',

    whenToUse: [
      'When behavior doesn\'t match stated preferences',
      'When short-term costs prevent long-term benefits',
      'When external incentives can be modified',
      'When intrinsic motivation needs support',
    ],

    howToImplement: [
      'Identify misaligned incentives',
      'Add immediate rewards for beneficial behaviors',
      'Add immediate costs for harmful behaviors',
      'Make long-term consequences more immediate',
    ],

    examples: [
      {
        context: 'Health insurance',
        implementation: 'Lower premiums for preventive care participation',
        effect: 'Increased preventive health behaviors',
      },
      {
        context: 'Education',
        implementation: 'XP and badges for completing learning activities',
        effect: 'Increased engagement and completion',
      },
      {
        context: 'Environmental behavior',
        implementation: 'Immediate rebates for energy-efficient purchases',
        effect: 'Increased adoption of efficient products',
      },
    ],

    ethicalConsiderations: [
      'Incentives can crowd out intrinsic motivation',
      'Be cautious of unintended consequences',
      'Don\'t create perverse incentives',
    ],

    limitations: [
      'Incentives may not persist without continued reward',
      'Can be expensive to maintain',
      'May attract gaming/cheating',
    ],
  },
};

// =============================================================================
// DECISION SCIENCE STANDARDS
// =============================================================================

export const DS_STANDARDS: Record<DSStandardId, DSStandard> = {
  // Pre-mortem standards
  'DS-1.1': {
    id: 'DS-1.1',
    category: 'premortem',
    title: 'Conduct Basic Pre-Mortem Analysis',
    description: 'Students can lead a basic pre-mortem exercise, imagining failure and brainstorming causes.',
    performanceIndicators: [
      'Explain the purpose and psychology of pre-mortems',
      'Facilitate the "imagine failure" step effectively',
      'Generate at least 10 distinct failure causes',
      'Categorize causes (internal, external, execution, assumption)',
    ],
    prerequisites: [],
    assessmentTypes: ['scenario', 'application'],
    difficultyLevels: {
      recognition: 'Explain what a pre-mortem is and why it works',
      understanding: 'Describe the psychological mechanisms (prospective hindsight, permission to dissent)',
      application: 'Conduct a pre-mortem on a provided scenario',
      transfer: 'Apply pre-mortem to novel decision contexts',
      creation: 'Design pre-mortem variations for different contexts',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 20,
      generativity: 15,
      strategicThinking: 25,
    },
  },
  'DS-1.2': {
    id: 'DS-1.2',
    category: 'premortem',
    title: 'Generate Diverse Failure Modes',
    description: 'Students can generate failure causes across multiple categories and think beyond obvious risks.',
    performanceIndicators: [
      'Generate causes in all categories (internal, external, execution, assumption)',
      'Identify "invisible gorilla" blind spots',
      'Think second and third-order effects',
      'Consider stakeholder-specific failure modes',
    ],
    prerequisites: ['DS-1.1'],
    assessmentTypes: ['application', 'analysis'],
    difficultyLevels: {
      recognition: 'Identify missing categories in a failure analysis',
      understanding: 'Explain why diverse perspectives matter',
      application: 'Generate diverse causes for a decision',
      transfer: 'Apply in unfamiliar domains',
      creation: 'Develop frameworks for systematic failure exploration',
    },
    manifoldDimensions: {
      coherence: 10,
      entropy: 25,
      generativity: 20,
      strategicThinking: 20,
    },
  },
  'DS-1.3': {
    id: 'DS-1.3',
    category: 'premortem',
    title: 'Create Actionable Mitigations',
    description: 'Students can transform identified risks into specific, actionable mitigation plans.',
    performanceIndicators: [
      'Prioritize risks by likelihood and impact',
      'Create specific, measurable mitigation actions',
      'Assign ownership and deadlines',
      'Distinguish prevention, detection, and response strategies',
    ],
    prerequisites: ['DS-1.2'],
    assessmentTypes: ['application', 'design'],
    difficultyLevels: {
      recognition: 'Evaluate quality of mitigation plans',
      understanding: 'Explain prevention vs. detection vs. response',
      application: 'Create mitigations for identified risks',
      transfer: 'Adapt mitigation strategies across contexts',
      creation: 'Design mitigation frameworks for organizations',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 10,
      generativity: 20,
      strategicThinking: 25,
    },
  },
  'DS-1.4': {
    id: 'DS-1.4',
    category: 'premortem',
    title: 'Set Effective Tripwires',
    description: 'Students can create specific, measurable tripwires that trigger reconsideration.',
    performanceIndicators: [
      'Write specific, objective tripwire conditions',
      'Link tripwires to specific actions',
      'Set appropriate check frequencies',
      'Avoid vague or movable tripwires',
    ],
    prerequisites: ['DS-1.3'],
    assessmentTypes: ['application', 'design'],
    difficultyLevels: {
      recognition: 'Identify good vs. poor tripwires',
      understanding: 'Explain why tripwires prevent drift',
      application: 'Create tripwires for a decision',
      transfer: 'Apply to ongoing personal decisions',
      creation: 'Design tripwire monitoring systems',
    },
    manifoldDimensions: {
      coherence: 25,
      entropy: 10,
      generativity: 15,
      strategicThinking: 20,
    },
  },

  // Choice architecture standards
  'DS-2.1': {
    id: 'DS-2.1',
    category: 'choice_architecture',
    title: 'Identify Nudge Types in Environments',
    description: 'Students can identify and classify nudges in real-world environments.',
    performanceIndicators: [
      'Recognize nudge types (defaults, social proof, salience, etc.)',
      'Identify intended behavior change',
      'Assess ethical implications',
      'Evaluate likely effectiveness',
    ],
    prerequisites: [],
    assessmentTypes: ['scenario', 'analysis'],
    difficultyLevels: {
      recognition: 'Identify nudges in examples',
      understanding: 'Explain psychological mechanisms',
      application: 'Analyze environments for nudges',
      transfer: 'Identify subtle or novel nudges',
      creation: 'Develop nudge identification frameworks',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 15,
      generativity: 10,
      strategicThinking: 15,
    },
  },
  'DS-2.2': {
    id: 'DS-2.2',
    category: 'choice_architecture',
    title: 'Design Ethical Nudges',
    description: 'Students can design nudges that are transparent, beneficial, and respect autonomy.',
    performanceIndicators: [
      'Apply NUDGES checklist (iNcentives, Understand mappings, Defaults, Give feedback, Expect error, Structure complex choices)',
      'Consider ethical implications',
      'Ensure transparency and easy opt-out',
      'Avoid paternalism and manipulation',
    ],
    prerequisites: ['DS-2.1'],
    assessmentTypes: ['design', 'application'],
    difficultyLevels: {
      recognition: 'Evaluate nudge designs for ethics',
      understanding: 'Explain libertarian paternalism principles',
      application: 'Design nudges for provided contexts',
      transfer: 'Adapt nudges across domains',
      creation: 'Develop nudge design frameworks',
    },
    manifoldDimensions: {
      coherence: 15,
      entropy: 20,
      generativity: 25,
      strategicThinking: 20,
    },
  },
  'DS-2.3': {
    id: 'DS-2.3',
    category: 'choice_architecture',
    title: 'Evaluate Nudge Effectiveness',
    description: 'Students can design evaluation plans and assess nudge effectiveness.',
    performanceIndicators: [
      'Define success metrics',
      'Design controlled experiments',
      'Interpret results appropriately',
      'Account for unintended consequences',
    ],
    prerequisites: ['DS-2.2'],
    assessmentTypes: ['design', 'analysis'],
    difficultyLevels: {
      recognition: 'Identify evaluation design flaws',
      understanding: 'Explain why controlled testing matters',
      application: 'Design evaluation for a nudge',
      transfer: 'Adapt evaluation methods across contexts',
      creation: 'Develop evaluation frameworks',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 15,
      generativity: 15,
      strategicThinking: 20,
    },
  },
  'DS-2.4': {
    id: 'DS-2.4',
    category: 'choice_architecture',
    title: 'Create Choice Architectures',
    description: 'Students can design complete choice environments that support good decisions.',
    performanceIndicators: [
      'Audit existing choice architecture',
      'Apply multiple nudge types synergistically',
      'Balance autonomy with guidance',
      'Design for diverse users',
    ],
    prerequisites: ['DS-2.2', 'DS-2.3'],
    assessmentTypes: ['design', 'application'],
    difficultyLevels: {
      recognition: 'Evaluate choice architecture designs',
      understanding: 'Explain trade-offs in choice design',
      application: 'Redesign a choice environment',
      transfer: 'Apply to novel contexts',
      creation: 'Design comprehensive choice systems',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 20,
      generativity: 25,
      strategicThinking: 25,
    },
  },

  // Probabilistic thinking standards
  'DS-3.1': {
    id: 'DS-3.1',
    category: 'probabilistic',
    title: 'Frame Decisions as Bets',
    description: 'Students can explicitly state probabilities, outcomes, and expected values for decisions.',
    performanceIndicators: [
      'Identify possible outcomes',
      'Assign probabilities to outcomes',
      'Estimate value of each outcome',
      'Acknowledge uncertainty explicitly',
    ],
    prerequisites: [],
    assessmentTypes: ['application', 'analysis'],
    difficultyLevels: {
      recognition: 'Recognize decisions as bets',
      understanding: 'Explain why explicit probabilities help',
      application: 'Frame a decision as a bet',
      transfer: 'Apply to emotional/personal decisions',
      creation: 'Develop bet-framing templates',
    },
    manifoldDimensions: {
      coherence: 25,
      entropy: 15,
      generativity: 10,
      strategicThinking: 20,
    },
  },
  'DS-3.2': {
    id: 'DS-3.2',
    category: 'probabilistic',
    title: 'Calculate Expected Value',
    description: 'Students can calculate and interpret expected value for decision-making.',
    performanceIndicators: [
      'Calculate EV correctly',
      'Interpret EV in context',
      'Recognize when EV is insufficient (risk aversion, ruin)',
      'Use EV to compare options',
    ],
    prerequisites: ['DS-3.1'],
    assessmentTypes: ['application', 'analysis'],
    difficultyLevels: {
      recognition: 'Calculate EV from given probabilities',
      understanding: 'Explain limitations of EV',
      application: 'Apply EV to real decisions',
      transfer: 'Use EV in novel contexts',
      creation: 'Develop EV-based decision tools',
    },
    manifoldDimensions: {
      coherence: 25,
      entropy: 10,
      generativity: 15,
      strategicThinking: 20,
    },
  },
  'DS-3.3': {
    id: 'DS-3.3',
    category: 'probabilistic',
    title: 'Separate Skill from Luck',
    description: 'Students can analyze outcomes to distinguish skill and luck components.',
    performanceIndicators: [
      'Apply resulting analysis (2x2 matrix)',
      'Identify luck factors in outcomes',
      'Avoid resulting (judging decisions by outcomes)',
      'Estimate skill-luck ratio',
    ],
    prerequisites: ['DS-3.2'],
    assessmentTypes: ['analysis', 'reflection'],
    difficultyLevels: {
      recognition: 'Classify outcomes in 2x2 matrix',
      understanding: 'Explain why resulting is problematic',
      application: 'Analyze personal decisions',
      transfer: 'Apply to others\' decisions fairly',
      creation: 'Design skill-luck analysis frameworks',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 20,
      generativity: 15,
      strategicThinking: 25,
    },
  },
  'DS-3.4': {
    id: 'DS-3.4',
    category: 'probabilistic',
    title: 'Update Beliefs with Evidence',
    description: 'Students can update probability estimates appropriately when new evidence arrives.',
    performanceIndicators: [
      'Apply Bayesian updating conceptually',
      'Avoid anchoring on prior beliefs',
      'Weight evidence appropriately',
      'Recognize when beliefs should change significantly',
    ],
    prerequisites: ['DS-3.1', 'DS-3.3'],
    assessmentTypes: ['application', 'analysis'],
    difficultyLevels: {
      recognition: 'Identify when updating is needed',
      understanding: 'Explain Bayesian principles conceptually',
      application: 'Update beliefs with new evidence',
      transfer: 'Apply to emotionally charged beliefs',
      creation: 'Design belief-updating protocols',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 25,
      generativity: 15,
      strategicThinking: 20,
    },
  },

  // Integration standards
  'DS-4.1': {
    id: 'DS-4.1',
    category: 'integration',
    title: 'Apply Multiple Frameworks to Complex Decisions',
    description: 'Students can integrate WRAP, pre-mortem, nudge design, and probabilistic thinking.',
    performanceIndicators: [
      'Select appropriate frameworks for context',
      'Apply multiple frameworks synergistically',
      'Recognize framework limitations',
      'Synthesize insights across frameworks',
    ],
    prerequisites: ['DS-1.4', 'DS-2.4', 'DS-3.4'],
    assessmentTypes: ['application', 'transfer'],
    difficultyLevels: {
      recognition: 'Match frameworks to decision types',
      understanding: 'Explain framework complementarity',
      application: 'Apply multiple frameworks to one decision',
      transfer: 'Apply to novel complex decisions',
      creation: 'Design integrated decision processes',
    },
    manifoldDimensions: {
      coherence: 25,
      entropy: 20,
      generativity: 20,
      strategicThinking: 30,
    },
  },
  'DS-4.2': {
    id: 'DS-4.2',
    category: 'integration',
    title: 'Adapt Frameworks to Context',
    description: 'Students can modify decision frameworks for specific contexts and constraints.',
    performanceIndicators: [
      'Assess context constraints (time, information, stakes)',
      'Simplify frameworks appropriately',
      'Maintain core principles while adapting',
      'Create context-specific variations',
    ],
    prerequisites: ['DS-4.1'],
    assessmentTypes: ['design', 'transfer'],
    difficultyLevels: {
      recognition: 'Identify when adaptation is needed',
      understanding: 'Explain core principles vs. implementation',
      application: 'Adapt framework for specific context',
      transfer: 'Adapt across diverse contexts',
      creation: 'Design context-adaptive frameworks',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 25,
      generativity: 25,
      strategicThinking: 25,
    },
  },
  'DS-4.3': {
    id: 'DS-4.3',
    category: 'integration',
    title: 'Teach Decision Frameworks to Others',
    description: 'Students can effectively teach decision frameworks to peers and younger students.',
    performanceIndicators: [
      'Explain frameworks at appropriate level',
      'Create engaging examples and exercises',
      'Assess understanding and adjust',
      'Facilitate practice and feedback',
    ],
    prerequisites: ['DS-4.1'],
    assessmentTypes: ['teaching', 'design'],
    difficultyLevels: {
      recognition: 'Evaluate teaching effectiveness',
      understanding: 'Explain teaching principles for frameworks',
      application: 'Teach framework to peers',
      transfer: 'Teach to diverse audiences',
      creation: 'Design curriculum for decision education',
    },
    manifoldDimensions: {
      coherence: 20,
      entropy: 20,
      generativity: 30,
      strategicThinking: 20,
    },
  },
  'DS-4.4': {
    id: 'DS-4.4',
    category: 'integration',
    title: 'Design Decision-Making Systems',
    description: 'Students can design organizational decision-making systems and processes.',
    performanceIndicators: [
      'Audit existing decision processes',
      'Identify decision quality bottlenecks',
      'Design improved processes',
      'Implement and evaluate changes',
    ],
    prerequisites: ['DS-4.2', 'DS-4.3'],
    assessmentTypes: ['design', 'application'],
    difficultyLevels: {
      recognition: 'Evaluate organizational decision systems',
      understanding: 'Explain system-level decision quality',
      application: 'Design improved decision processes',
      transfer: 'Apply to different organizational contexts',
      creation: 'Design comprehensive decision systems',
    },
    manifoldDimensions: {
      coherence: 25,
      entropy: 20,
      generativity: 30,
      strategicThinking: 30,
    },
  },
};

// =============================================================================
// SAMPLE EXERCISES
// =============================================================================

export const SAMPLE_EXERCISES: DecisionExercise[] = [
  {
    id: 'premortem-startup',
    exerciseType: 'premortem',
    scenario: 'You and two friends have decided to start a tutoring business targeting middle school students in your area. You\'ve saved $500 in startup money and plan to launch in 3 months.',
    context: 'This is your first business venture. Your friends are enthusiastic but none of you have business experience.',
    stakeholders: ['You', 'Two co-founders', 'Parents (customers)', 'Students (users)', 'Potential tutors to hire'],
    constraints: ['Limited budget ($500)', '3-month timeline', 'Part-time (after school)', 'Local area only'],
    hints: [
      'Think about what could go wrong with the team (internal)',
      'Consider what competitors might do (external)',
      'What could go wrong with finding customers?',
      'What are you assuming about demand?',
    ],
    scaffolding: [
      { step: 1, prompt: 'Imagine it\'s 6 months from now and the business failed completely. What happened?', example: 'The tutoring business failed because we couldn\'t find any students to tutor. Parents didn\'t trust teenagers to teach their kids.' },
      { step: 2, prompt: 'Now generate 10+ possible causes of failure', example: 'No demand, friends quit, ran out of money, couldn\'t find meeting space...' },
      { step: 3, prompt: 'Categorize each cause and rate likelihood (0-100) and impact (0-100)' },
      { step: 4, prompt: 'For your top 3 risks, create specific mitigation actions' },
      { step: 5, prompt: 'Set 2 tripwires that would make you reconsider the business' },
    ],
    rubric: {
      criteria: [
        { name: 'Failure imagination', description: 'Vividly imagined failure scenario', maxPoints: 10 },
        { name: 'Cause quantity', description: 'Generated 10+ distinct failure causes', maxPoints: 15 },
        { name: 'Category coverage', description: 'Causes span all categories', maxPoints: 15 },
        { name: 'Risk prioritization', description: 'Risks properly scored and ranked', maxPoints: 15 },
        { name: 'Mitigation quality', description: 'Actions are specific and actionable', maxPoints: 20 },
        { name: 'Tripwire quality', description: 'Tripwires are specific and measurable', maxPoints: 15 },
        { name: 'Insight quality', description: 'Analysis reveals non-obvious risks', maxPoints: 10 },
      ],
      totalPoints: 100,
      passingScore: 70,
    },
    difficulty: 0,
    estimatedMinutes: 30,
    standardsAddressed: ['DS-1.1', 'DS-1.2', 'DS-1.3', 'DS-1.4'],
    prerequisiteExercises: [],
  },
  {
    id: 'nudge-design-cafeteria',
    exerciseType: 'nudge_design',
    scenario: 'Your school wants to increase healthy eating in the cafeteria. Currently, only 30% of students choose the salad bar, and 60% choose pizza/burgers. The school cannot remove unhealthy options or change prices.',
    context: 'The school has limited budget for changes but can redesign the cafeteria layout and signage.',
    stakeholders: ['Students', 'Cafeteria staff', 'School administration', 'Parents'],
    constraints: ['Cannot remove options', 'Cannot change prices', 'Limited budget ($200)', 'Must maintain student choice'],
    hints: [
      'Think about what students see first when they enter',
      'Consider how options are arranged',
      'What do students know about what others choose?',
      'How easy is it to access healthy options?',
    ],
    scaffolding: [
      { step: 1, prompt: 'Analyze the current choice architecture - what nudges (if any) exist?', example: 'Pizza is the first thing visible, placed at eye level...' },
      { step: 2, prompt: 'Identify 3 nudge types that could apply here' },
      { step: 3, prompt: 'Design specific interventions for each nudge type' },
      { step: 4, prompt: 'Consider ethical implications - is this manipulative?' },
      { step: 5, prompt: 'Design a plan to measure if your nudges work' },
    ],
    rubric: {
      criteria: [
        { name: 'Current analysis', description: 'Accurate analysis of existing choice architecture', maxPoints: 15 },
        { name: 'Nudge identification', description: 'Correctly identifies applicable nudge types', maxPoints: 15 },
        { name: 'Design specificity', description: 'Interventions are specific and implementable', maxPoints: 20 },
        { name: 'Multiple nudges', description: 'Uses multiple complementary nudge types', maxPoints: 15 },
        { name: 'Ethical consideration', description: 'Addresses autonomy and transparency', maxPoints: 15 },
        { name: 'Evaluation plan', description: 'Clear plan to measure effectiveness', maxPoints: 20 },
      ],
      totalPoints: 100,
      passingScore: 70,
    },
    difficulty: 0.5,
    estimatedMinutes: 25,
    standardsAddressed: ['DS-2.1', 'DS-2.2', 'DS-2.3'],
    prerequisiteExercises: [],
  },
];

export default {
  PREMORTEM_GUIDE,
  NUDGE_CURRICULUM,
  DS_STANDARDS,
  SAMPLE_EXERCISES,
};
