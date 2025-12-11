/**
 * Pattern Recognition & Medici Effect Curriculum - Hyro Education System
 *
 * @hyro-domain pattern_recognition
 * @hyro-standards PR-1.*, PR-2.*, PR-3.*, PR-4.*
 * @hyro-manifold Extends C/E/G with Pattern Recognition (PR) and Cross-Domain Transfer (CDT)
 *
 * This file contains the complete curriculum for pattern recognition training,
 * including structural patterns, intersection case studies, and exercises.
 */

import type {
  Pattern,
  StructuralPatternType,
  KnowledgeDomain,
  IntersectionCase,
  IntersectionType,
  AnalogyExercise,
  ChunkingExercise,
  PRStandard,
  PRStandardId,
  PatternAbstractionLevel,
} from './pattern-recognition-types';

// =============================================================================
// CORE STRUCTURAL PATTERNS LIBRARY
// =============================================================================

/**
 * Complete library of structural patterns for cross-domain recognition
 */
export const PATTERN_LIBRARY: Record<StructuralPatternType, Pattern> = {
  // ==========================================================================
  // MATHEMATICAL/LOGICAL PATTERNS
  // ==========================================================================

  proportional_relationship: {
    id: 'pattern-proportional',
    name: 'Proportional Relationship',
    type: 'proportional_relationship',
    abstractDescription: 'When one quantity changes, another changes in direct proportion, maintaining a constant ratio.',
    visualRepresentation: `
      A ─────> B
      ↑        ↑
      ×k       ×k
      ↑        ↑
      C ─────> D
    `,
    mathematicalForm: 'y = kx (where k is constant)',
    definingFeatures: [
      'Constant ratio between quantities',
      'Linear relationship through origin',
      'Scalable in both directions',
      'Multiplicative not additive relationship',
    ],
    optionalFeatures: [
      'May have practical bounds',
      'May break down at extremes',
    ],
    counterIndicators: [
      'Non-zero y-intercept',
      'Ratio changes as quantities change',
      'Threshold effects',
    ],
    domainExamples: [
      {
        domain: 'physics',
        example: 'Ohm\'s Law: V = IR (voltage proportional to current)',
        explanation: 'Doubling the current doubles the voltage for a fixed resistance.',
      },
      {
        domain: 'economics',
        example: 'Unit pricing: cost proportional to quantity purchased',
        explanation: 'Buying twice as much costs twice as much (before discounts).',
      },
      {
        domain: 'biology',
        example: 'Enzyme kinetics at low substrate (Michaelis-Menten)',
        explanation: 'Reaction rate proportional to substrate concentration initially.',
      },
      {
        domain: 'music',
        example: 'Octave relationships: frequency doubles with each octave',
        explanation: 'A4 = 440Hz, A5 = 880Hz - constant 2:1 ratio.',
      },
    ],
    relatedPatterns: ['exponential_growth', 'trade_off'],
    oppositePatterns: ['threshold_effect'],
    abstractionLevel: 'structural',
    difficulty: -1,
    prerequisites: [],
  },

  exponential_growth: {
    id: 'pattern-exponential',
    name: 'Exponential Growth/Decay',
    type: 'exponential_growth',
    abstractDescription: 'Change is proportional to current size, creating accelerating growth or decay.',
    visualRepresentation: `
           ↗
          ↗
         ↗
        ↗
      ↗↗
      ═════════>
    `,
    mathematicalForm: 'y = a × e^(kt) or y = a × b^t',
    definingFeatures: [
      'Rate of change proportional to current value',
      'Constant doubling/halving time',
      'Acceleration over time',
      'Multiplicative accumulation',
    ],
    optionalFeatures: [
      'May transition to S-curve with limits',
      'May have delay before visible growth',
    ],
    counterIndicators: [
      'Linear growth rate',
      'Fixed additions over time',
      'Quick saturation',
    ],
    domainExamples: [
      {
        domain: 'biology',
        example: 'Bacterial population growth in unlimited resources',
        explanation: 'Each bacterium divides, so more bacteria = faster growth.',
      },
      {
        domain: 'economics',
        example: 'Compound interest: money earning interest on interest',
        explanation: '$1000 at 7% doubles roughly every 10 years.',
      },
      {
        domain: 'computer_science',
        example: 'Algorithm time complexity O(2^n)',
        explanation: 'Adding one input doubles the computation time.',
      },
      {
        domain: 'physics',
        example: 'Radioactive decay: half-life',
        explanation: 'Same fraction decays each time period, not same amount.',
      },
      {
        domain: 'sociology',
        example: 'Viral content spreading on social media',
        explanation: 'Each sharer exposes new potential sharers.',
      },
    ],
    relatedPatterns: ['feedback_loop', 'cascade', 'network_effect'],
    oppositePatterns: ['homeostasis'],
    abstractionLevel: 'structural',
    difficulty: 0,
    prerequisites: ['pattern-proportional'],
  },

  feedback_loop: {
    id: 'pattern-feedback',
    name: 'Feedback Loop',
    type: 'feedback_loop',
    abstractDescription: 'Output of a system influences its own input, creating reinforcing or balancing dynamics.',
    visualRepresentation: `
      ┌─────────────┐
      │             ↓
      │    ┌───────────┐
      │    │  PROCESS  │
      │    └───────────┘
      │             │
      └─────────────┘
        (feedback)
    `,
    definingFeatures: [
      'Circular causation',
      'Output affects future input',
      'Self-modification over time',
      'Can be positive (reinforcing) or negative (balancing)',
    ],
    optionalFeatures: [
      'Time delay in the loop',
      'Multiple interacting loops',
      'Threshold for activation',
    ],
    counterIndicators: [
      'One-way causation only',
      'No connection between output and input',
      'External control only',
    ],
    domainExamples: [
      {
        domain: 'biology',
        example: 'Thermoregulation: body temperature control',
        explanation: 'High temp triggers cooling; cooling reduces temp; reduced temp stops cooling.',
      },
      {
        domain: 'psychology',
        example: 'Self-fulfilling prophecy',
        explanation: 'Belief affects behavior, behavior affects outcomes, outcomes reinforce belief.',
      },
      {
        domain: 'economics',
        example: 'Inflation expectations spiral',
        explanation: 'Expecting inflation → raise prices → causes inflation → reinforces expectations.',
      },
      {
        domain: 'engineering',
        example: 'Cruise control in cars',
        explanation: 'Speed sensed → compared to target → throttle adjusted → new speed.',
      },
      {
        domain: 'ecology',
        example: 'Predator-prey cycles',
        explanation: 'More prey → more predators → fewer prey → fewer predators → more prey.',
      },
    ],
    relatedPatterns: ['homeostasis', 'exponential_growth', 'oscillation'],
    oppositePatterns: [],
    abstractionLevel: 'systemic',
    difficulty: 1,
    prerequisites: ['pattern-proportional'],
  },

  network_effect: {
    id: 'pattern-network',
    name: 'Network Effect',
    type: 'network_effect',
    abstractDescription: 'Value of a system increases as more entities participate or connect.',
    visualRepresentation: `
        ●───●
       /│\\ /│\\
      ● │ ● │ ●
       \\│/ \\│/
        ●───●
      More nodes = More connections = More value
    `,
    mathematicalForm: 'Value ∝ n² (Metcalfe\'s Law) or n×log(n)',
    definingFeatures: [
      'Value increases with participants',
      'Positive externalities from joining',
      'Winner-take-all dynamics',
      'Switching costs increase over time',
    ],
    optionalFeatures: [
      'Critical mass threshold',
      'Possibility of multiple equilibria',
      'Congestion effects at scale',
    ],
    counterIndicators: [
      'Value independent of user count',
      'Rivalrous goods (your use reduces mine)',
      'Quality degrades with scale',
    ],
    domainExamples: [
      {
        domain: 'computer_science',
        example: 'Social media platforms',
        explanation: 'Facebook is valuable because your friends are there.',
      },
      {
        domain: 'economics',
        example: 'Currency adoption',
        explanation: 'Money is useful because others accept it.',
      },
      {
        domain: 'biology',
        example: 'Language evolution',
        explanation: 'A language is valuable when others speak it.',
      },
      {
        domain: 'engineering',
        example: 'Electrical grid standardization',
        explanation: 'More devices using same standard = more useful infrastructure.',
      },
    ],
    relatedPatterns: ['exponential_growth', 'first_mover', 'path_dependency'],
    oppositePatterns: ['trade_off'],
    abstractionLevel: 'systemic',
    difficulty: 1,
    prerequisites: ['pattern-exponential'],
  },

  threshold_effect: {
    id: 'pattern-threshold',
    name: 'Threshold Effect (Tipping Point)',
    type: 'threshold_effect',
    abstractDescription: 'System behavior changes dramatically when a critical value is reached.',
    visualRepresentation: `
                    ↗↗↗
                   ↗
      ════════════╱
                ▲
          threshold
    `,
    definingFeatures: [
      'Discontinuous change at critical point',
      'Qualitative shift in behavior',
      'Often irreversible',
      'Accumulation precedes sudden change',
    ],
    optionalFeatures: [
      'Hysteresis (different thresholds up vs. down)',
      'Multiple thresholds',
      'Warning signs before threshold',
    ],
    counterIndicators: [
      'Gradual, continuous change',
      'Linear response to inputs',
      'Easily reversible',
    ],
    domainExamples: [
      {
        domain: 'physics',
        example: 'Phase transitions: ice to water at 0°C',
        explanation: 'Temperature changes gradually but state changes suddenly.',
      },
      {
        domain: 'sociology',
        example: 'Social tipping points for behavior change',
        explanation: '25% adoption threshold for new social norms.',
      },
      {
        domain: 'biology',
        example: 'Action potential in neurons',
        explanation: 'Sub-threshold stimuli cause nothing; above threshold triggers full response.',
      },
      {
        domain: 'economics',
        example: 'Market crashes',
        explanation: 'Gradual concern accumulation, sudden panic selling.',
      },
      {
        domain: 'ecology',
        example: 'Ecosystem collapse',
        explanation: 'Gradual degradation then sudden regime shift.',
      },
    ],
    relatedPatterns: ['cascade', 'path_dependency'],
    oppositePatterns: ['proportional_relationship'],
    abstractionLevel: 'systemic',
    difficulty: 1,
    prerequisites: [],
  },

  // ==========================================================================
  // SYSTEMS PATTERNS
  // ==========================================================================

  emergence: {
    id: 'pattern-emergence',
    name: 'Emergence',
    type: 'emergence',
    abstractDescription: 'Complex properties or behaviors arise from simple interactions that cannot be predicted from components alone.',
    visualRepresentation: `
      [Simple Rules]     [Complex Result]
         ● ● ●      →       ╔═══╗
         ● ● ●              ║ ? ║
         ● ● ●              ╚═══╝
    `,
    definingFeatures: [
      'Whole has properties parts lack',
      'Cannot reduce to components',
      'Arises from interactions',
      'Often surprising or unpredictable',
    ],
    optionalFeatures: [
      'Multiple levels of emergence',
      'Self-organization',
      'Downward causation',
    ],
    counterIndicators: [
      'Properties traceable to single components',
      'Linear summation of parts',
      'Predictable from reductionist analysis',
    ],
    domainExamples: [
      {
        domain: 'biology',
        example: 'Consciousness from neurons',
        explanation: 'No single neuron is conscious; consciousness emerges from their interactions.',
      },
      {
        domain: 'economics',
        example: 'Market prices from individual trades',
        explanation: 'No trader sets "the price"; it emerges from all transactions.',
      },
      {
        domain: 'physics',
        example: 'Temperature from molecular motion',
        explanation: 'Individual molecules don\'t have temperature; it\'s a collective property.',
      },
      {
        domain: 'sociology',
        example: 'Culture from individual behaviors',
        explanation: 'Shared norms and meanings emerge from countless interactions.',
      },
      {
        domain: 'computer_science',
        example: 'Swarm intelligence in algorithms',
        explanation: 'Simple agents following rules produce complex problem-solving.',
      },
    ],
    relatedPatterns: ['hierarchy', 'feedback_loop', 'network_effect'],
    oppositePatterns: ['modularity'],
    abstractionLevel: 'systemic',
    difficulty: 2,
    prerequisites: ['pattern-feedback'],
  },

  hierarchy: {
    id: 'pattern-hierarchy',
    name: 'Hierarchical Organization',
    type: 'hierarchy',
    abstractDescription: 'System organized in nested levels where each level has distinct properties and dynamics.',
    visualRepresentation: `
           ▲
          /│\\
         / │ \\
        ▲  ▲  ▲
       /│\\/│\\/│\\
      ●●●●●●●●●●●
    `,
    definingFeatures: [
      'Nested levels of organization',
      'Each level has unique properties',
      'Upward and downward causation',
      'Stability through modularity',
    ],
    optionalFeatures: [
      'Different timescales at different levels',
      'Information compression between levels',
      'Emergent properties at each level',
    ],
    counterIndicators: [
      'Flat organization',
      'All parts equivalent',
      'No nested structure',
    ],
    domainExamples: [
      {
        domain: 'biology',
        example: 'Biological organization: cells → tissues → organs → systems',
        explanation: 'Each level has distinct functions while contributing to higher levels.',
      },
      {
        domain: 'business',
        example: 'Corporate hierarchy: teams → departments → divisions → company',
        explanation: 'Nested management structure for coordination.',
      },
      {
        domain: 'computer_science',
        example: 'Software architecture: functions → classes → modules → systems',
        explanation: 'Layered abstraction for managing complexity.',
      },
      {
        domain: 'ecology',
        example: 'Ecological levels: organism → population → community → ecosystem',
        explanation: 'Different ecological questions at each level.',
      },
    ],
    relatedPatterns: ['modularity', 'emergence'],
    oppositePatterns: [],
    abstractionLevel: 'structural',
    difficulty: 0,
    prerequisites: [],
  },

  modularity: {
    id: 'pattern-modularity',
    name: 'Modularity',
    type: 'modularity',
    abstractDescription: 'System composed of independent, interchangeable units that can be combined in different ways.',
    visualRepresentation: `
      ┌───┐ ┌───┐ ┌───┐
      │ A │←│ B │→│ C │
      └───┘ └───┘ └───┘
        ↓     ↓     ↓
      Standard interfaces
    `,
    definingFeatures: [
      'Separable components',
      'Standard interfaces between modules',
      'Independence of internal implementation',
      'Recombinability',
    ],
    optionalFeatures: [
      'Hot-swappability',
      'Parallel development possible',
      'Fault isolation',
    ],
    counterIndicators: [
      'Tight coupling between parts',
      'Cannot change one without changing others',
      'No clear boundaries',
    ],
    domainExamples: [
      {
        domain: 'engineering',
        example: 'LEGO bricks',
        explanation: 'Standard connectors allow any brick to connect to any other.',
      },
      {
        domain: 'biology',
        example: 'Protein domains',
        explanation: 'Proteins built from reusable domain modules.',
      },
      {
        domain: 'computer_science',
        example: 'Microservices architecture',
        explanation: 'Independent services communicate through APIs.',
      },
      {
        domain: 'music',
        example: 'Sample-based music production',
        explanation: 'Combining pre-made loops and samples.',
      },
    ],
    relatedPatterns: ['hierarchy', 'redundancy'],
    oppositePatterns: ['emergence'],
    abstractionLevel: 'structural',
    difficulty: 0,
    prerequisites: [],
  },

  redundancy: {
    id: 'pattern-redundancy',
    name: 'Redundancy',
    type: 'redundancy',
    abstractDescription: 'Multiple copies or paths ensure function continues if one fails.',
    visualRepresentation: `
      ┌───┐   ┌───┐
      │ A │   │ A'│
      └─┬─┘   └─┬─┘
        └───┬───┘
            ↓
          Output
    `,
    definingFeatures: [
      'Multiple pathways to same function',
      'Backup systems',
      'Graceful degradation',
      'Fault tolerance',
    ],
    optionalFeatures: [
      'Active-active (all working) vs. active-passive (backup idle)',
      'Geographic distribution',
      'Different implementation for same function',
    ],
    counterIndicators: [
      'Single point of failure',
      'No backup',
      'Efficiency over resilience',
    ],
    domainExamples: [
      {
        domain: 'biology',
        example: 'Two kidneys, two lungs',
        explanation: 'Can survive with one; second provides backup.',
      },
      {
        domain: 'engineering',
        example: 'Aircraft flight control systems',
        explanation: 'Triple-redundant computers for safety-critical systems.',
      },
      {
        domain: 'computer_science',
        example: 'RAID storage',
        explanation: 'Data spread across multiple drives; one can fail without data loss.',
      },
      {
        domain: 'business',
        example: 'Supply chain diversification',
        explanation: 'Multiple suppliers prevent single-source disruption.',
      },
    ],
    relatedPatterns: ['modularity', 'homeostasis'],
    oppositePatterns: [],
    abstractionLevel: 'structural',
    difficulty: 0,
    prerequisites: [],
  },

  homeostasis: {
    id: 'pattern-homeostasis',
    name: 'Homeostasis',
    type: 'homeostasis',
    abstractDescription: 'System self-regulates to maintain stable internal conditions despite external changes.',
    visualRepresentation: `
      External Change → [SYSTEM] → Stable Output
                          ↑
                    Regulatory
                    Feedback
    `,
    definingFeatures: [
      'Set point or target state',
      'Sensor detecting deviation',
      'Corrective mechanism',
      'Negative feedback loop',
    ],
    optionalFeatures: [
      'Multiple regulated variables',
      'Set point may adjust (allostasis)',
      'Energy cost of regulation',
    ],
    counterIndicators: [
      'Passive response to environment',
      'No regulation mechanism',
      'Positive feedback (amplification)',
    ],
    domainExamples: [
      {
        domain: 'biology',
        example: 'Blood glucose regulation',
        explanation: 'Insulin and glucagon maintain blood sugar in narrow range.',
      },
      {
        domain: 'engineering',
        example: 'Thermostat-controlled HVAC',
        explanation: 'Measures temperature, activates heating/cooling to maintain setpoint.',
      },
      {
        domain: 'economics',
        example: 'Central bank interest rate policy',
        explanation: 'Adjusting rates to target inflation level.',
      },
      {
        domain: 'psychology',
        example: 'Cognitive dissonance reduction',
        explanation: 'Mind adjusts beliefs to reduce uncomfortable inconsistency.',
      },
    ],
    relatedPatterns: ['feedback_loop', 'redundancy'],
    oppositePatterns: ['exponential_growth', 'cascade'],
    abstractionLevel: 'systemic',
    difficulty: 1,
    prerequisites: ['pattern-feedback'],
  },

  // ==========================================================================
  // PROCESS PATTERNS
  // ==========================================================================

  iteration: {
    id: 'pattern-iteration',
    name: 'Iteration (Successive Refinement)',
    type: 'iteration',
    abstractDescription: 'Repeated cycles of action and adjustment gradually improve toward a goal.',
    visualRepresentation: `
      v1 → test → v2 → test → v3 → test → ...
       ↑    ↓      ↑    ↓      ↑    ↓
       └────┘      └────┘      └────┘
    `,
    definingFeatures: [
      'Repeated cycles',
      'Each cycle builds on previous',
      'Gradual improvement',
      'Learning from each iteration',
    ],
    optionalFeatures: [
      'Convergence to optimum',
      'Diminishing returns over time',
      'Ability to pivot direction',
    ],
    counterIndicators: [
      'One-shot solution',
      'No feedback between attempts',
      'Random trial and error',
    ],
    domainExamples: [
      {
        domain: 'design_thinking',
        example: 'Design thinking: prototype → test → refine',
        explanation: 'Each prototype teaches lessons for the next version.',
      },
      {
        domain: 'mathematics',
        example: 'Newton\'s method for root finding',
        explanation: 'Each estimate improves on the previous.',
      },
      {
        domain: 'biology',
        example: 'Evolution by natural selection',
        explanation: 'Each generation is refined by selection pressures.',
      },
      {
        domain: 'art',
        example: 'Artistic revision process',
        explanation: 'Multiple drafts progressively refined.',
      },
    ],
    relatedPatterns: ['feedback_loop', 'convergence'],
    oppositePatterns: [],
    abstractionLevel: 'procedural',
    difficulty: -1,
    prerequisites: [],
  },

  branching: {
    id: 'pattern-branching',
    name: 'Branching (Divergence)',
    type: 'branching',
    abstractDescription: 'Single path divides into multiple distinct paths or outcomes.',
    visualRepresentation: `
            ↗ A
           /
      ════╱
           \\
            ↘ B
    `,
    definingFeatures: [
      'Decision point',
      'Multiple possible paths',
      'Paths may be mutually exclusive',
      'Different outcomes from same starting point',
    ],
    optionalFeatures: [
      'Reversibility (can paths merge again?)',
      'Path dependencies',
      'Probabilistic branching',
    ],
    counterIndicators: [
      'Single predetermined path',
      'No choices available',
      'Paths that look different but lead same place',
    ],
    domainExamples: [
      {
        domain: 'biology',
        example: 'Evolutionary speciation',
        explanation: 'One species diverges into multiple lineages.',
      },
      {
        domain: 'computer_science',
        example: 'Git branching in version control',
        explanation: 'Code development splits into parallel versions.',
      },
      {
        domain: 'history',
        example: 'Historical counterfactuals',
        explanation: 'Key decisions create alternative historical paths.',
      },
      {
        domain: 'business',
        example: 'Product line diversification',
        explanation: 'One product expands into family of variants.',
      },
    ],
    relatedPatterns: ['convergence', 'path_dependency'],
    oppositePatterns: ['convergence'],
    abstractionLevel: 'procedural',
    difficulty: 0,
    prerequisites: [],
  },

  convergence: {
    id: 'pattern-convergence',
    name: 'Convergence',
    type: 'convergence',
    abstractDescription: 'Multiple different paths or approaches lead to the same outcome.',
    visualRepresentation: `
      A ↘
          ═════ Target
      B ↗
    `,
    definingFeatures: [
      'Multiple starting points',
      'Same or similar end state',
      'Independent paths',
      'Attractor state',
    ],
    optionalFeatures: [
      'Different speeds of convergence',
      'May not be identical end states',
      'Local vs. global convergence',
    ],
    counterIndicators: [
      'Divergent outcomes from similar starts',
      'No common destination',
      'Paths never meet',
    ],
    domainExamples: [
      {
        domain: 'biology',
        example: 'Convergent evolution: wings in birds, bats, insects',
        explanation: 'Different origins, similar solution to flight.',
      },
      {
        domain: 'mathematics',
        example: 'Multiple proofs of same theorem',
        explanation: 'Different approaches reach same conclusion.',
      },
      {
        domain: 'economics',
        example: 'Economic convergence between countries',
        explanation: 'Developing nations approaching developed nation income levels.',
      },
      {
        domain: 'philosophy',
        example: 'Independent invention of similar ideas',
        explanation: 'Multiple cultures developing similar concepts independently.',
      },
    ],
    relatedPatterns: ['iteration', 'branching'],
    oppositePatterns: ['branching'],
    abstractionLevel: 'procedural',
    difficulty: 0,
    prerequisites: [],
  },

  oscillation: {
    id: 'pattern-oscillation',
    name: 'Oscillation',
    type: 'oscillation',
    abstractDescription: 'System moves back and forth between states in a periodic or quasi-periodic manner.',
    visualRepresentation: `
      ∿∿∿∿∿∿∿∿∿∿∿∿∿∿
    `,
    definingFeatures: [
      'Periodic change',
      'Return to previous states',
      'Alternation between extremes',
      'Rhythm or cycle',
    ],
    optionalFeatures: [
      'Regular vs. irregular period',
      'Damped (decreasing) or sustained',
      'Multiple interacting frequencies',
    ],
    counterIndicators: [
      'Monotonic change (always increasing/decreasing)',
      'Random fluctuation',
      'Stable equilibrium',
    ],
    domainExamples: [
      {
        domain: 'physics',
        example: 'Pendulum motion',
        explanation: 'Swings back and forth with regular period.',
      },
      {
        domain: 'biology',
        example: 'Circadian rhythms',
        explanation: 'Daily cycles of sleep/wake, hormone levels.',
      },
      {
        domain: 'economics',
        example: 'Business cycles',
        explanation: 'Expansion and contraction phases.',
      },
      {
        domain: 'ecology',
        example: 'Predator-prey population cycles',
        explanation: 'Lynx-hare oscillations over years.',
      },
      {
        domain: 'psychology',
        example: 'Mood cycles in bipolar disorder',
        explanation: 'Alternation between manic and depressive states.',
      },
    ],
    relatedPatterns: ['feedback_loop', 'homeostasis'],
    oppositePatterns: ['convergence'],
    abstractionLevel: 'systemic',
    difficulty: 1,
    prerequisites: ['pattern-feedback'],
  },

  cascade: {
    id: 'pattern-cascade',
    name: 'Cascade (Chain Reaction)',
    type: 'cascade',
    abstractDescription: 'Initial event triggers a sequence of events, each causing the next.',
    visualRepresentation: `
      ● → ●● → ●●●● → ●●●●●●●●
    `,
    definingFeatures: [
      'Sequential triggering',
      'Each step enables next',
      'Amplification possible',
      'Can be difficult to stop once started',
    ],
    optionalFeatures: [
      'Branching cascades',
      'Threshold for initiation',
      'Saturation effects',
    ],
    counterIndicators: [
      'Isolated events',
      'No causal chain',
      'Self-limiting processes',
    ],
    domainExamples: [
      {
        domain: 'physics',
        example: 'Nuclear chain reaction',
        explanation: 'Each fission releases neutrons that cause more fissions.',
      },
      {
        domain: 'biology',
        example: 'Enzyme cascade in blood clotting',
        explanation: 'Each enzyme activates the next in sequence.',
      },
      {
        domain: 'economics',
        example: 'Bank run contagion',
        explanation: 'One bank failure triggers panic at others.',
      },
      {
        domain: 'ecology',
        example: 'Trophic cascade in ecosystems',
        explanation: 'Removing top predator affects all levels below.',
      },
      {
        domain: 'sociology',
        example: 'Information cascade in social media',
        explanation: 'One viral post triggers shares that trigger more shares.',
      },
    ],
    relatedPatterns: ['exponential_growth', 'threshold_effect'],
    oppositePatterns: ['homeostasis'],
    abstractionLevel: 'systemic',
    difficulty: 1,
    prerequisites: ['pattern-threshold'],
  },

  // ==========================================================================
  // STRATEGIC PATTERNS
  // ==========================================================================

  trade_off: {
    id: 'pattern-tradeoff',
    name: 'Trade-Off',
    type: 'trade_off',
    abstractDescription: 'Gaining one benefit requires sacrificing another; optimization under constraints.',
    visualRepresentation: `
      A ↑
        │\\
        │ \\
        │  \\  Frontier
        │   \\
        └────────→ B
    `,
    mathematicalForm: 'Pareto frontier: cannot improve A without worsening B',
    definingFeatures: [
      'Competing objectives',
      'Cannot maximize all simultaneously',
      'Choices involve sacrifices',
      'Efficient frontier of options',
    ],
    optionalFeatures: [
      'May shift trade-off curve with innovation',
      'Non-linear trade-offs',
      'Multiple trade-off dimensions',
    ],
    counterIndicators: [
      'Win-win situations (no sacrifice needed)',
      'Dominated options (worse in all dimensions)',
      'Unlimited resources',
    ],
    domainExamples: [
      {
        domain: 'economics',
        example: 'Risk vs. return in investing',
        explanation: 'Higher expected returns require accepting more risk.',
      },
      {
        domain: 'engineering',
        example: 'Speed vs. accuracy trade-off',
        explanation: 'Faster processing often means more errors.',
      },
      {
        domain: 'biology',
        example: 'Energy allocation in organisms',
        explanation: 'Energy to reproduction means less for growth/survival.',
      },
      {
        domain: 'business',
        example: 'Quality, speed, cost triangle',
        explanation: 'Pick two: fast and good costs more, fast and cheap is lower quality.',
      },
    ],
    relatedPatterns: ['leverage_point'],
    oppositePatterns: [],
    abstractionLevel: 'functional',
    difficulty: 0,
    prerequisites: [],
  },

  leverage_point: {
    id: 'pattern-leverage',
    name: 'Leverage Point',
    type: 'leverage_point',
    abstractDescription: 'Places in a system where small changes can produce large effects.',
    visualRepresentation: `
      Small ●
      Input  \\
              \\_____|█████████> Large Output
                    ▲
                Leverage
    `,
    definingFeatures: [
      'Disproportionate effect to cause',
      'System sensitivity at specific points',
      'Strategic intervention opportunity',
      'Multiplier effect',
    ],
    optionalFeatures: [
      'May be hard to identify',
      'May have delayed effects',
      'Could work in both directions',
    ],
    counterIndicators: [
      'Proportional response',
      'Distributed, equal sensitivity',
      'No amplification',
    ],
    domainExamples: [
      {
        domain: 'systems_thinking',
        example: 'Donella Meadows\' leverage points in systems',
        explanation: 'Paradigm shifts > system goals > feedback > parameters.',
      },
      {
        domain: 'physics',
        example: 'Physical lever amplifying force',
        explanation: 'Small force at long distance lifts heavy weight.',
      },
      {
        domain: 'economics',
        example: 'Financial leverage',
        explanation: 'Borrowed money amplifies gains (and losses).',
      },
      {
        domain: 'biology',
        example: 'Keystone species in ecosystems',
        explanation: 'One species\' removal has outsized ecosystem impact.',
      },
    ],
    relatedPatterns: ['threshold_effect', 'cascade'],
    oppositePatterns: [],
    abstractionLevel: 'functional',
    difficulty: 1,
    prerequisites: ['pattern-feedback'],
  },

  path_dependency: {
    id: 'pattern-path-dependency',
    name: 'Path Dependency',
    type: 'path_dependency',
    abstractDescription: 'Current options are constrained by historical choices; history matters.',
    visualRepresentation: `
      Past → Choice 1 → Choice 2 → Now
                ↓           ↓
           (closed)    (closed)
    `,
    definingFeatures: [
      'Past decisions constrain future options',
      'Lock-in effects',
      'Increasing returns to established path',
      'Switching costs',
    ],
    optionalFeatures: [
      'May be reversible at high cost',
      'Accumulated advantages',
      'Institutional memory',
    ],
    counterIndicators: [
      'Clean slate possible',
      'History irrelevant to current choice',
      'Low switching costs',
    ],
    domainExamples: [
      {
        domain: 'economics',
        example: 'QWERTY keyboard layout',
        explanation: 'Persists despite potentially better alternatives due to learning investment.',
      },
      {
        domain: 'biology',
        example: 'Evolutionary constraints from body plan',
        explanation: 'Vertebrate body plan constrains possible adaptations.',
      },
      {
        domain: 'political_science',
        example: 'Constitutional path dependency',
        explanation: 'Original constitutional choices shape all future politics.',
      },
      {
        domain: 'computer_science',
        example: 'Legacy system integration',
        explanation: 'New systems must work with old decisions.',
      },
    ],
    relatedPatterns: ['first_mover', 'network_effect'],
    oppositePatterns: [],
    abstractionLevel: 'systemic',
    difficulty: 1,
    prerequisites: [],
  },

  first_mover: {
    id: 'pattern-first-mover',
    name: 'First Mover Advantage/Disadvantage',
    type: 'first_mover',
    abstractDescription: 'Timing of entry affects competitive position; being first has both advantages and risks.',
    visualRepresentation: `
      First:  ●═══════════════→ Established
      Second:     ●═══════════→ Learns from first
    `,
    definingFeatures: [
      'Timing as strategic variable',
      'Early entry captures something',
      'Learning curve effects',
      'Standard-setting opportunity',
    ],
    optionalFeatures: [
      'Fast follower may outperform',
      'Market may not be ready for first',
      'First may define category',
    ],
    counterIndicators: [
      'Timing irrelevant to success',
      'Market not winner-take-all',
      'Infinite market space',
    ],
    domainExamples: [
      {
        domain: 'business',
        example: 'Amazon\'s early e-commerce dominance',
        explanation: 'Early entry built brand, infrastructure, and network effects.',
      },
      {
        domain: 'biology',
        example: 'Pioneer species in ecological succession',
        explanation: 'First species to colonize shape environment for followers.',
      },
      {
        domain: 'economics',
        example: 'Google vs. earlier search engines',
        explanation: 'Not first, but fast follower with better product.',
      },
      {
        domain: 'history',
        example: 'Colonial land claims',
        explanation: 'First to claim territory gained lasting advantages.',
      },
    ],
    relatedPatterns: ['path_dependency', 'network_effect'],
    oppositePatterns: [],
    abstractionLevel: 'functional',
    difficulty: 1,
    prerequisites: [],
  },

  prisoners_dilemma: {
    id: 'pattern-prisoners-dilemma',
    name: 'Prisoner\'s Dilemma',
    type: 'prisoners_dilemma',
    abstractDescription: 'Individual rationality leads to collectively suboptimal outcomes; cooperation requires overcoming incentives to defect.',
    visualRepresentation: `
                  Player B
                  C     D
           C   (3,3) (0,5)
    Player A
           D   (5,0) (1,1)
    `,
    definingFeatures: [
      'Mutual cooperation is best collectively',
      'Individual incentive to defect',
      'Both defecting is worst outcome',
      'Temptation to exploit cooperators',
    ],
    optionalFeatures: [
      'Repeated games change dynamics',
      'Communication may enable cooperation',
      'Reputation effects',
    ],
    counterIndicators: [
      'Aligned incentives',
      'No temptation to defect',
      'Pure competition (zero-sum)',
    ],
    domainExamples: [
      {
        domain: 'economics',
        example: 'Price wars between competitors',
        explanation: 'Both companies cutting prices hurts both.',
      },
      {
        domain: 'ecology',
        example: 'Tragedy of the commons',
        explanation: 'Individual overuse depletes shared resource.',
      },
      {
        domain: 'political_science',
        example: 'Arms race dynamics',
        explanation: 'Both nations arming is costly; neither can unilaterally disarm.',
      },
      {
        domain: 'psychology',
        example: 'Social loafing in groups',
        explanation: 'Individual shirking while hoping others contribute.',
      },
    ],
    relatedPatterns: ['trade_off'],
    oppositePatterns: [],
    abstractionLevel: 'functional',
    difficulty: 2,
    prerequisites: ['pattern-tradeoff'],
  },
};

// =============================================================================
// MEDICI EFFECT INTERSECTION CASES
// =============================================================================

/**
 * Famous intersection innovations for teaching cross-domain thinking
 */
export const INTERSECTION_CASES: IntersectionCase[] = [
  {
    id: 'medici-velcro',
    name: 'Velcro - Burrs to Fasteners',
    intersectionType: 'concept_transfer',
    fields: ['biology', 'engineering'],
    background: 'George de Mestral was a Swiss engineer who went hiking with his dog in 1941.',
    insight: 'He noticed burrs stuck to his clothes and dog\'s fur. Under microscope, he saw tiny hooks catching fabric loops.',
    outcome: 'Invented Velcro - billions of uses from shoes to NASA spacesuits.',
    whatWasTransferred: 'The hook-and-loop attachment mechanism from plant burrs.',
    whyItWorked: 'The biological solution had been optimized by evolution for the exact problem: temporary attachment.',
    barriers: ['Existing fastener industry skepticism', 'Manufacturing challenges', '8 years to commercialize'],
    enablers: ['Curiosity to investigate', 'Microscope access', 'Engineering skills to replicate'],
    patternId: 'pattern-modularity',
    explorationQuestions: [
      'What other biological attachment mechanisms exist?',
      'What human problems involve temporary attachment?',
      'How do other organisms solve similar problems differently?',
    ],
    analogousOpportunities: [
      {
        fields: ['biology', 'architecture'],
        description: 'Termite mounds and passive building cooling',
        difficulty: 1,
      },
      {
        fields: ['biology', 'materials_science'],
        description: 'Gecko feet and reusable adhesives',
        difficulty: 1,
      },
    ],
  },
  {
    id: 'medici-printing-press',
    name: 'Printing Press - Wine Press to Publishing',
    intersectionType: 'method_transfer',
    fields: ['engineering', 'literature'],
    background: 'Johannes Gutenberg was a goldsmith familiar with metal work and knew of screw presses used in winemaking.',
    insight: 'Combined movable type (his metalworking innovation) with the screw press mechanism to mass-produce text.',
    outcome: 'Sparked the information revolution, enabling the Renaissance and Reformation.',
    whatWasTransferred: 'The mechanical pressing mechanism from wine/olive oil production.',
    whyItWorked: 'The press solved the force-distribution problem for ink transfer; existing technology, new application.',
    barriers: ['Need for significant capital', 'Church control of knowledge', 'Literacy rates'],
    enablers: ['Cross-domain expertise', 'Rising demand for books', 'Metalworking skills for type'],
    patternId: 'pattern-modularity',
    explorationQuestions: [
      'What agricultural technologies might have other applications?',
      'What industries use pressing/compression that could transfer elsewhere?',
      'How did combining existing technologies create something revolutionary?',
    ],
    analogousOpportunities: [
      {
        fields: ['manufacturing', 'medicine'],
        description: '3D printing and organ fabrication',
        difficulty: 2,
      },
    ],
  },
  {
    id: 'medici-mpesa',
    name: 'M-Pesa - Airtime to Banking',
    intersectionType: 'problem_reframing',
    fields: ['economics', 'computer_science', 'sociology'],
    background: 'Kenya had limited banking infrastructure but widespread mobile phone adoption.',
    insight: 'Mobile airtime was already being transferred as currency. Why not formalize mobile-based banking?',
    outcome: 'Revolutionized financial inclusion; model replicated across developing world.',
    whatWasTransferred: 'Reframed "phone minutes" as "money" using existing infrastructure.',
    whyItWorked: 'Met people where they were (phones) rather than where banks wanted them (branches).',
    barriers: ['Banking regulations', 'Trust in digital money', 'Agent network needed'],
    enablers: ['High mobile penetration', 'Need for remittances', 'Existing informal sharing of airtime'],
    patternId: 'pattern-network',
    explorationQuestions: [
      'What existing infrastructure is underutilized for financial services?',
      'How can informal economic practices inspire formal innovation?',
      'What other services could piggyback on communication networks?',
    ],
    analogousOpportunities: [
      {
        fields: ['gaming', 'finance'],
        description: 'Virtual game currencies and real-world payments',
        difficulty: 1,
      },
    ],
  },
  {
    id: 'medici-pixar',
    name: 'Pixar - Technology Meets Storytelling',
    intersectionType: 'combinatorial_innovation',
    fields: ['computer_science', 'art', 'literature'],
    background: 'Ed Catmull had computer graphics PhD; Steve Jobs saw business potential; John Lasseter brought animation artistry.',
    insight: 'Computer graphics could enable a new art form, but only if combined with traditional storytelling excellence.',
    outcome: 'Created entirely new medium; revolutionized animation industry.',
    whatWasTransferred: 'Combined rendering technology with character-driven narrative craft.',
    whyItWorked: 'Neither technology alone (impressive demos) nor traditional animation alone could achieve what the combination did.',
    barriers: ['Massive compute requirements', 'Industry skepticism', 'Years of development'],
    enablers: ['Diverse team with different expertise', 'Patient capital', 'Clear artistic vision'],
    patternId: 'pattern-emergence',
    explorationQuestions: [
      'What other art forms might emerge from new technology?',
      'How do you balance technological capability with artistic vision?',
      'What combinations of expertise might create new creative fields?',
    ],
    analogousOpportunities: [
      {
        fields: ['artificial_intelligence', 'music'],
        description: 'AI-assisted composition and performance',
        difficulty: 2,
      },
    ],
  },
  {
    id: 'medici-spotify',
    name: 'Spotify - Piracy Insights to Streaming',
    intersectionType: 'constraint_relaxation',
    fields: ['computer_science', 'music', 'economics'],
    background: 'Music piracy (Napster, etc.) showed people wanted instant access to music libraries without ownership.',
    insight: 'Instead of fighting piracy, make legal streaming so convenient that piracy isn\'t worth the hassle.',
    outcome: 'Transformed music industry economics; streaming now dominates.',
    whatWasTransferred: 'The user experience insights from piracy (instant access, huge catalog) made legal.',
    whyItWorked: 'Competed with piracy on convenience rather than just legality.',
    barriers: ['Record label resistance', 'Artist compensation concerns', 'Technical infrastructure'],
    enablers: ['Piracy proved the demand', 'Label desperation', 'Broadband adoption'],
    patternId: 'pattern-tradeoff',
    explorationQuestions: [
      'What can "gray market" behaviors teach us about unmet needs?',
      'How can illegal activities be "legalized" through better business models?',
      'What other industries face similar piracy/convenience trade-offs?',
    ],
    analogousOpportunities: [
      {
        fields: ['publishing', 'technology'],
        description: 'Subscription models for news/books based on content piracy patterns',
        difficulty: 1,
      },
    ],
  },
];

// =============================================================================
// PATTERN RECOGNITION STANDARDS
// =============================================================================

export const PR_STANDARDS: Record<PRStandardId, PRStandard> = {
  // PR-1: Pattern Recognition Basics
  'PR-1.1': {
    id: 'PR-1.1',
    category: 'basics',
    title: 'Surface vs. Structural Similarities',
    description: 'Distinguish between superficial resemblances and deep structural patterns.',
    performanceIndicators: [
      'Correctly classify similarities as surface or structural',
      'Explain why structural patterns are more transferable',
      'Identify surface distractors in analogies',
    ],
    prerequisites: [],
    assessmentTypes: ['recognition', 'completion'],
    difficultyLevels: {
      recognition: 'Identify whether given similarity is surface or structural',
      understanding: 'Explain the difference with examples',
      application: 'Classify new examples correctly',
      transfer: 'Apply distinction to novel domains',
      creation: 'Generate examples of each type',
    },
    manifoldDimensions: { coherence: 0.6, entropy: 0.3, generativity: 0.4, patternRecognition: 0.8 },
  },
  'PR-1.2': {
    id: 'PR-1.2',
    category: 'basics',
    title: 'Common Structural Patterns',
    description: 'Recognize and name fundamental patterns like feedback loops, exponential growth, and trade-offs.',
    performanceIndicators: [
      'Identify at least 10 core patterns by name',
      'Match examples to correct pattern types',
      'Describe defining features of each pattern',
    ],
    prerequisites: ['PR-1.1'],
    assessmentTypes: ['recognition', 'completion'],
    difficultyLevels: {
      recognition: 'Name pattern when shown example',
      understanding: 'Explain why example fits pattern',
      application: 'Identify patterns in new examples',
      transfer: 'Find patterns in unfamiliar domains',
      creation: 'Generate novel examples of patterns',
    },
    manifoldDimensions: { coherence: 0.7, entropy: 0.4, generativity: 0.5, patternRecognition: 0.9 },
  },
  'PR-1.3': {
    id: 'PR-1.3',
    category: 'basics',
    title: 'Domain-Agnostic Description',
    description: 'Describe patterns in abstract terms that transcend specific domains.',
    performanceIndicators: [
      'Describe patterns without domain-specific vocabulary',
      'Translate domain-specific descriptions to abstract form',
      'Verify that description captures essential structure',
    ],
    prerequisites: ['PR-1.2'],
    assessmentTypes: ['generation'],
    difficultyLevels: {
      recognition: 'Identify which description is most abstract',
      understanding: 'Explain why abstraction aids transfer',
      application: 'Abstract given domain-specific pattern',
      transfer: 'Abstract patterns from novel domains',
      creation: 'Create abstract representations of new patterns',
    },
    manifoldDimensions: { coherence: 0.8, entropy: 0.5, generativity: 0.6, patternRecognition: 0.85 },
  },
  'PR-1.4': {
    id: 'PR-1.4',
    category: 'basics',
    title: 'Personal Pattern Library',
    description: 'Build and maintain a personal collection of recognized patterns with examples.',
    performanceIndicators: [
      'Document patterns with multiple domain examples',
      'Add new patterns when encountered',
      'Retrieve relevant patterns when problem-solving',
    ],
    prerequisites: ['PR-1.3'],
    assessmentTypes: ['design'],
    difficultyLevels: {
      recognition: 'Access pattern from library when prompted',
      understanding: 'Organize patterns by type and relationship',
      application: 'Use library to solve problems',
      transfer: 'Extend library to new domains',
      creation: 'Discover and document new patterns',
    },
    manifoldDimensions: { coherence: 0.75, entropy: 0.6, generativity: 0.7, patternRecognition: 0.9 },
  },

  // PR-2: Analogical Reasoning
  'PR-2.1': {
    id: 'PR-2.1',
    category: 'analogical',
    title: 'Structural Analogy Completion',
    description: 'Complete structural analogies of the form A:B :: C:?',
    performanceIndicators: [
      'Identify the relation in the source pair',
      'Map that relation to the target domain',
      'Generate appropriate completion',
    ],
    prerequisites: ['PR-1.2'],
    assessmentTypes: ['completion'],
    difficultyLevels: {
      recognition: 'Complete simple within-domain analogies',
      understanding: 'Explain the mapped relation',
      application: 'Complete cross-domain analogies',
      transfer: 'Complete analogies in unfamiliar domains',
      creation: 'Create well-structured analogies',
    },
    manifoldDimensions: { coherence: 0.7, entropy: 0.5, generativity: 0.6, patternRecognition: 0.85 },
  },
  'PR-2.2': {
    id: 'PR-2.2',
    category: 'analogical',
    title: 'Analogy Quality Evaluation',
    description: 'Assess the quality of analogies based on structural mapping criteria.',
    performanceIndicators: [
      'Rate analogy systematicity correctly',
      'Identify surface vs. structural mappings',
      'Detect inconsistencies in mappings',
    ],
    prerequisites: ['PR-2.1'],
    assessmentTypes: ['recognition'],
    difficultyLevels: {
      recognition: 'Identify strong vs. weak analogies',
      understanding: 'Explain quality criteria',
      application: 'Rate analogies on multiple dimensions',
      transfer: 'Evaluate analogies in novel fields',
      creation: 'Improve weak analogies',
    },
    manifoldDimensions: { coherence: 0.8, entropy: 0.4, generativity: 0.5, patternRecognition: 0.9 },
  },
  'PR-2.3': {
    id: 'PR-2.3',
    category: 'analogical',
    title: 'Analogy Generation',
    description: 'Generate structural analogies given a pattern or domain.',
    performanceIndicators: [
      'Produce novel, structurally valid analogies',
      'Select appropriate source domains',
      'Maintain structural consistency',
    ],
    prerequisites: ['PR-2.2'],
    assessmentTypes: ['generation'],
    difficultyLevels: {
      recognition: 'Select best source for analogy',
      understanding: 'Explain analogy generation process',
      application: 'Generate analogies for given targets',
      transfer: 'Generate analogies in unfamiliar domains',
      creation: 'Generate multiple analogies for one pattern',
    },
    manifoldDimensions: { coherence: 0.75, entropy: 0.6, generativity: 0.8, patternRecognition: 0.85 },
  },
  'PR-2.4': {
    id: 'PR-2.4',
    category: 'analogical',
    title: 'Predictive Analogy',
    description: 'Use analogies to make predictions about the target domain.',
    performanceIndicators: [
      'Generate candidate inferences from analogies',
      'Assess confidence in analogical predictions',
      'Validate predictions against evidence',
    ],
    prerequisites: ['PR-2.3'],
    assessmentTypes: ['generation', 'transfer'],
    difficultyLevels: {
      recognition: 'Identify predictions implied by analogy',
      understanding: 'Explain basis for analogical prediction',
      application: 'Make predictions using given analogies',
      transfer: 'Make predictions in novel domains',
      creation: 'Design experiments to test analogical predictions',
    },
    manifoldDimensions: { coherence: 0.7, entropy: 0.7, generativity: 0.85, patternRecognition: 0.8 },
  },

  // PR-3: Cross-Domain Transfer
  'PR-3.1': {
    id: 'PR-3.1',
    category: 'transfer',
    title: 'Pattern Transfer',
    description: 'Apply recognized patterns to solve problems in novel domains.',
    performanceIndicators: [
      'Identify applicable patterns for new problems',
      'Adapt pattern to fit target context',
      'Apply pattern to generate solution',
    ],
    prerequisites: ['PR-1.4', 'PR-2.1'],
    assessmentTypes: ['transfer'],
    difficultyLevels: {
      recognition: 'Identify when pattern might apply',
      understanding: 'Explain how pattern applies',
      application: 'Apply pattern to solve problem',
      transfer: 'Apply in distant domains',
      creation: 'Adapt pattern for novel situations',
    },
    manifoldDimensions: { coherence: 0.65, entropy: 0.7, generativity: 0.85, patternRecognition: 0.9 },
  },
  'PR-3.2': {
    id: 'PR-3.2',
    category: 'transfer',
    title: 'Transfer Opportunity Recognition',
    description: 'Proactively identify opportunities to apply patterns from other domains.',
    performanceIndicators: [
      'Actively seek cross-domain connections',
      'Recognize structural similarities across fields',
      'Propose transfer opportunities',
    ],
    prerequisites: ['PR-3.1'],
    assessmentTypes: ['generation'],
    difficultyLevels: {
      recognition: 'Notice when domains are structurally similar',
      understanding: 'Explain why transfer might work',
      application: 'Find transfer opportunities in given domains',
      transfer: 'Find opportunities across diverse fields',
      creation: 'Systematically generate transfer ideas',
    },
    manifoldDimensions: { coherence: 0.6, entropy: 0.8, generativity: 0.9, patternRecognition: 0.85 },
  },
  'PR-3.3': {
    id: 'PR-3.3',
    category: 'transfer',
    title: 'Pattern Adaptation',
    description: 'Modify patterns to fit the constraints and opportunities of new contexts.',
    performanceIndicators: [
      'Identify aspects of pattern that need modification',
      'Adjust pattern while preserving essential structure',
      'Verify adapted pattern still solves problem',
    ],
    prerequisites: ['PR-3.2'],
    assessmentTypes: ['transfer', 'design'],
    difficultyLevels: {
      recognition: 'Identify what needs adaptation',
      understanding: 'Explain why adaptation is needed',
      application: 'Adapt given pattern for new context',
      transfer: 'Adapt patterns across distant domains',
      creation: 'Design novel adaptations',
    },
    manifoldDimensions: { coherence: 0.7, entropy: 0.75, generativity: 0.9, patternRecognition: 0.85 },
  },
  'PR-3.4': {
    id: 'PR-3.4',
    category: 'transfer',
    title: 'Pattern Combination',
    description: 'Combine multiple patterns from different domains to address complex problems.',
    performanceIndicators: [
      'Identify complementary patterns',
      'Integrate patterns coherently',
      'Apply combined patterns effectively',
    ],
    prerequisites: ['PR-3.3'],
    assessmentTypes: ['design'],
    difficultyLevels: {
      recognition: 'Identify when combination might help',
      understanding: 'Explain how patterns complement each other',
      application: 'Combine given patterns for problem',
      transfer: 'Combine patterns from distant domains',
      creation: 'Design novel pattern combinations',
    },
    manifoldDimensions: { coherence: 0.65, entropy: 0.85, generativity: 0.95, patternRecognition: 0.9 },
  },

  // PR-4: Intersection Innovation
  'PR-4.1': {
    id: 'PR-4.1',
    category: 'intersection',
    title: 'Systematic Intersection Exploration',
    description: 'Methodically explore the intersection of two or more fields for innovation opportunities.',
    performanceIndicators: [
      'Apply structured exploration process',
      'Document concepts/methods from each field',
      'Generate intersection ideas systematically',
    ],
    prerequisites: ['PR-3.2'],
    assessmentTypes: ['design'],
    difficultyLevels: {
      recognition: 'Identify promising field intersections',
      understanding: 'Explain intersection exploration method',
      application: 'Conduct exploration between given fields',
      transfer: 'Explore unfamiliar field intersections',
      creation: 'Design exploration strategies',
    },
    manifoldDimensions: { coherence: 0.6, entropy: 0.9, generativity: 0.95, patternRecognition: 0.85 },
  },
  'PR-4.2': {
    id: 'PR-4.2',
    category: 'intersection',
    title: 'Intersection Idea Generation',
    description: 'Generate novel ideas at the intersection of multiple fields.',
    performanceIndicators: [
      'Produce diverse intersection ideas',
      'Ideas combine elements from multiple fields',
      'Ideas are novel (not obvious existing solutions)',
    ],
    prerequisites: ['PR-4.1'],
    assessmentTypes: ['generation'],
    difficultyLevels: {
      recognition: 'Identify intersection ideas in examples',
      understanding: 'Explain what makes good intersection ideas',
      application: 'Generate ideas at given intersections',
      transfer: 'Generate ideas at unfamiliar intersections',
      creation: 'Develop intersection idea generation methods',
    },
    manifoldDimensions: { coherence: 0.55, entropy: 0.95, generativity: 1.0, patternRecognition: 0.8 },
  },
  'PR-4.3': {
    id: 'PR-4.3',
    category: 'intersection',
    title: 'Intersection Idea Evaluation',
    description: 'Assess intersection ideas for novelty, feasibility, and potential impact.',
    performanceIndicators: [
      'Rate ideas on multiple criteria',
      'Identify strengths and weaknesses',
      'Prioritize ideas for development',
    ],
    prerequisites: ['PR-4.2'],
    assessmentTypes: ['recognition'],
    difficultyLevels: {
      recognition: 'Identify strong vs. weak intersection ideas',
      understanding: 'Explain evaluation criteria',
      application: 'Evaluate given intersection ideas',
      transfer: 'Evaluate ideas in unfamiliar fields',
      creation: 'Develop evaluation frameworks',
    },
    manifoldDimensions: { coherence: 0.7, entropy: 0.7, generativity: 0.8, patternRecognition: 0.85 },
  },
  'PR-4.4': {
    id: 'PR-4.4',
    category: 'intersection',
    title: 'Intersection Strategy Design',
    description: 'Design strategies for finding and developing intersection innovations.',
    performanceIndicators: [
      'Create processes for intersection exploration',
      'Build diverse knowledge portfolios',
      'Develop systems for capturing intersection insights',
    ],
    prerequisites: ['PR-4.3'],
    assessmentTypes: ['design'],
    difficultyLevels: {
      recognition: 'Identify effective intersection strategies',
      understanding: 'Explain why strategies work',
      application: 'Apply strategies to find intersections',
      transfer: 'Adapt strategies for new contexts',
      creation: 'Design novel intersection strategies',
    },
    manifoldDimensions: { coherence: 0.65, entropy: 0.85, generativity: 0.95, patternRecognition: 0.9 },
  },
};

// =============================================================================
// SAMPLE EXERCISES
// =============================================================================

export const SAMPLE_ANALOGY_EXERCISES: AnalogyExercise[] = [
  {
    id: 'analogy-ex-1',
    exerciseType: 'complete_analogy',
    source: {
      a: 'Thermostat',
      b: 'Constant room temperature',
      relation: 'maintains_through_feedback',
    },
    target: {
      c: 'Central bank',
      d: 'Stable inflation rate',
      relation: 'maintains_through_feedback',
    },
    correctAnswer: 'Stable inflation rate',
    scoringRubric: {
      criteria: [
        { name: 'Structural match', description: 'Answer matches the feedback loop structure', maxPoints: 2 },
        { name: 'Domain accuracy', description: 'Answer is accurate for economics', maxPoints: 1 },
      ],
      totalPoints: 3,
    },
    difficulty: 0,
    patternId: 'pattern-feedback',
    standardsAddressed: ['PR-2.1'],
  },
  {
    id: 'analogy-ex-2',
    exerciseType: 'find_source',
    target: {
      c: 'Viral video spreading on social media',
      relation: 'exponential_growth_through_sharing',
    },
    correctAnswer: 'Bacterial population growth in unlimited resources',
    scoringRubric: {
      criteria: [
        { name: 'Pattern match', description: 'Source exemplifies exponential growth', maxPoints: 2 },
        { name: 'Structural depth', description: 'Source shares deep structure not just surface', maxPoints: 2 },
      ],
      totalPoints: 4,
    },
    difficulty: 1,
    patternId: 'pattern-exponential',
    standardsAddressed: ['PR-2.3', 'PR-3.2'],
  },
  {
    id: 'analogy-ex-3',
    exerciseType: 'evaluate',
    analogyToEvaluate: {
      id: 'eval-analogy-1',
      sourceDomain: 'biology',
      targetDomain: 'computer_science',
      sourceScenario: {
        description: 'Immune system fighting infection',
        entities: ['white blood cells', 'pathogen', 'antibodies'],
        relations: [
          { from: 'white blood cells', to: 'pathogen', relation: 'identifies' },
          { from: 'white blood cells', to: 'antibodies', relation: 'produces' },
          { from: 'antibodies', to: 'pathogen', relation: 'neutralizes' },
        ],
      },
      targetScenario: {
        description: 'Antivirus software fighting malware',
        entities: ['scanner', 'virus', 'quarantine'],
        relations: [
          { from: 'scanner', to: 'virus', relation: 'identifies' },
          { from: 'scanner', to: 'quarantine', relation: 'creates' },
          { from: 'quarantine', to: 'virus', relation: 'isolates' },
        ],
      },
      entityMappings: [
        { sourceEntity: 'white blood cells', targetEntity: 'scanner', confidence: 90 },
        { sourceEntity: 'pathogen', targetEntity: 'virus', confidence: 95 },
        { sourceEntity: 'antibodies', targetEntity: 'quarantine', confidence: 60 },
      ],
      relationMappings: [
        { sourceRelation: 'identifies', targetRelation: 'identifies', confidence: 95 },
        { sourceRelation: 'produces', targetRelation: 'creates', confidence: 70 },
        { sourceRelation: 'neutralizes', targetRelation: 'isolates', confidence: 50 },
      ],
      quality: 'mixed',
      structuralConsistency: 70,
      systematicity: 65,
      candidateInferences: [
        { inference: 'Antivirus should "remember" previous viruses like immune memory', confidence: 80 },
      ],
      underlyingPattern: 'pattern-feedback',
      difficulty: 1,
    },
    evaluationCriteria: ['structural consistency', 'entity mapping quality', 'relation mapping quality', 'inference validity'],
    scoringRubric: {
      criteria: [
        { name: 'Structural analysis', description: 'Correctly assess structural mapping', maxPoints: 3 },
        { name: 'Weakness identification', description: 'Identify where analogy breaks down', maxPoints: 2 },
        { name: 'Inference evaluation', description: 'Assess validity of candidate inference', maxPoints: 2 },
      ],
      totalPoints: 7,
    },
    difficulty: 2,
    patternId: 'pattern-feedback',
    standardsAddressed: ['PR-2.2', 'PR-2.4'],
  },
];

export const SAMPLE_CHUNKING_EXERCISES: ChunkingExercise[] = [
  {
    id: 'chunk-ex-1',
    patternId: 'pattern-exponential',
    exerciseType: 'recognition',
    scenario: 'A rumor spreads through a school. On day 1, 2 people know it. Each day, each person who knows tells 2 new people.',
    context: 'Social dynamics in a school setting',
    domain: 'sociology',
    correctPattern: 'exponential_growth',
    explanation: 'Each person who knows creates more knowers, so the rate of spread increases with the number who already know.',
    targetTimeSeconds: 30,
    expertTimeSeconds: 10,
    difficulty: -1,
    prerequisiteChunks: [],
  },
  {
    id: 'chunk-ex-2',
    patternId: 'pattern-threshold',
    exerciseType: 'application',
    scenario: 'A social movement has been growing slowly with dedicated activists. Suddenly, a critical mass is reached and the movement explodes into the mainstream.',
    context: 'Social change dynamics',
    domain: 'sociology',
    correctApplication: 'This exemplifies a threshold effect - gradual accumulation of support until reaching a tipping point where behavior change cascades through the population.',
    explanation: 'Social movements often show threshold dynamics - small changes in support have little effect until the threshold is crossed, then change is rapid.',
    targetTimeSeconds: 60,
    expertTimeSeconds: 20,
    difficulty: 1,
    prerequisiteChunks: ['chunk-ex-1'],
  },
  {
    id: 'chunk-ex-3',
    patternId: 'pattern-tradeoff',
    exerciseType: 'transfer',
    scenario: 'In biology, organisms must allocate limited energy between reproduction and survival. In a startup, founders must allocate limited time between product development and customer acquisition.',
    context: 'Resource allocation across domains',
    domain: 'systems_thinking',
    correctPattern: 'trade_off',
    correctApplication: 'Both scenarios involve constrained resources that must be allocated between competing essential activities. You cannot maximize both simultaneously.',
    explanation: 'The trade-off pattern appears whenever there are multiple competing uses for limited resources, whether energy in biology or time/money in business.',
    targetTimeSeconds: 90,
    expertTimeSeconds: 30,
    difficulty: 2,
    prerequisiteChunks: ['chunk-ex-2'],
  },
];

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  PATTERN_LIBRARY,
  INTERSECTION_CASES,
  PR_STANDARDS,
  SAMPLE_ANALOGY_EXERCISES,
  SAMPLE_CHUNKING_EXERCISES,
};
