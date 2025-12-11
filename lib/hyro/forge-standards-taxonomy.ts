/**
 * HYRO FORGE: Standards Taxonomy System
 *
 * Comprehensive mapping of educational standards to the HYRO Forge assessment system.
 * Connects Common Core (CCSS), NGSS, C3 Framework, and custom standards to our
 * 11-stat, 4-tier blueprint architecture.
 *
 * Standards Frameworks Supported:
 * - CCSS-Math: Common Core State Standards for Mathematics
 * - CCSS-ELA: Common Core State Standards for English Language Arts
 * - NGSS: Next Generation Science Standards
 * - C3: College, Career, and Civic Life Framework for Social Studies
 * - Custom: Financial Literacy, Coding, Study Skills, Critical Thinking,
 *           Technology, Problem Solving
 *
 * @hyro-domain standards_taxonomy
 * @hyro-manifold Educational standards alignment engine
 */

import { StatName, STAT_NAMES } from './forge-types';
import { StrandTier, ManifoldDimension, ASSESSMENT_BLUEPRINTS, Strand } from './forge-blueprints';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Educational Standards Frameworks
 */
export type StandardsFramework =
  | 'CCSS-Math'    // Common Core State Standards - Math
  | 'CCSS-ELA'     // Common Core State Standards - English Language Arts
  | 'NGSS'         // Next Generation Science Standards
  | 'C3'           // College, Career, and Civic Life Framework
  | 'NCTM'         // National Council of Teachers of Mathematics
  | 'ISTE'         // International Society for Technology in Education
  | 'CSTA'         // Computer Science Teachers Association
  | 'JumpStart'    // Jump$tart Financial Literacy Standards
  | 'Custom';      // Custom HYRO Forge standards

/**
 * Grade bands mapping to our tier system
 */
export type GradeBand = 'K-2' | '3-5' | '6-8' | '9-12' | '12+';

/**
 * Webb's Depth of Knowledge levels
 */
export type DOKLevel = 1 | 2 | 3 | 4;

/**
 * Bloom's Taxonomy levels (revised)
 */
export type BloomLevel =
  | 'Remember'
  | 'Understand'
  | 'Apply'
  | 'Analyze'
  | 'Evaluate'
  | 'Create';

/**
 * Standard code representation
 */
export interface StandardCode {
  /** Full standard code (e.g., "CCSS.MATH.CONTENT.6.RP.A.1") */
  code: string;

  /** Framework this standard belongs to */
  framework: StandardsFramework;

  /** Human-readable description */
  description: string;

  /** Short title for display */
  shortTitle: string;

  /** Grade level(s) this standard applies to */
  grades: number[];

  /** Domain within the framework */
  domain: string;

  /** Cluster/category within the domain */
  cluster: string;

  /** Webb's DOK level */
  dokLevel: DOKLevel;

  /** Bloom's taxonomy level */
  bloomLevel: BloomLevel;

  /** Prerequisites (other standard codes) */
  prerequisites: string[];

  /** Related standards (cross-references) */
  relatedStandards: string[];

  /** Keywords for searchability */
  keywords: string[];
}

/**
 * Mapping of a standard to HYRO blueprint strands
 */
export interface StandardToStrandMapping {
  standardCode: string;
  statName: StatName;
  strandName: string;
  tier: StrandTier;
  weight: number; // 0-1, how strongly this standard aligns to this strand
  manifoldDimensions: Partial<Record<ManifoldDimension, number>>; // 0-1 weights per dimension
}

/**
 * Result of looking up a strand for a standard
 */
export interface StrandLookupResult {
  stat: StatName;
  strand: string;
  tier: StrandTier;
  weight: number;
  manifoldFocus: ManifoldDimension;
}

/**
 * Cognitive demand profile for a standard
 */
export interface CognitiveDemandProfile {
  dokLevel: DOKLevel;
  dokDescription: string;
  bloomLevel: BloomLevel;
  bloomVerbs: string[];
  manifoldProfile: Record<ManifoldDimension, number>;
  cognitiveLoad: 'recall' | 'procedural' | 'conceptual' | 'transfer';
  estimatedTimeMinutes: number;
}

/**
 * Standard validation result
 */
export interface StandardValidationResult {
  isValid: boolean;
  matchedStandards: string[];
  suggestedStandards: string[];
  coverageScore: number; // 0-1
  missingCoverage: string[];
  warnings: string[];
}

// =============================================================================
// GRADE TO TIER MAPPING
// =============================================================================

/**
 * Maps grade levels to HYRO tiers
 */
export const GRADE_TO_TIER: Record<number, StrandTier> = {
  0: 'Foundation',  // Kindergarten
  1: 'Foundation',
  2: 'Foundation',
  3: 'Foundation',
  4: 'Foundation',
  5: 'Foundation',
  6: 'Bridge',
  7: 'Bridge',
  8: 'Bridge',
  9: 'Power',
  10: 'Power',
  11: 'Power',
  12: 'Horizon',
  13: 'Horizon', // College/Advanced
};

/**
 * Maps tiers to grade ranges
 */
export const TIER_TO_GRADES: Record<StrandTier, { min: number; max: number; label: string }> = {
  'Foundation': { min: 0, max: 5, label: 'K-5' },
  'Bridge': { min: 6, max: 8, label: '6-8' },
  'Power': { min: 9, max: 11, label: '9-11' },
  'Horizon': { min: 12, max: 16, label: '12+/Advanced' },
};

// =============================================================================
// DEPTH OF KNOWLEDGE PROFILES
// =============================================================================

export const DOK_PROFILES: Record<DOKLevel, {
  name: string;
  description: string;
  verbs: string[];
  manifoldProfile: Record<ManifoldDimension, number>;
  typicalTimeMultiplier: number;
}> = {
  1: {
    name: 'Recall and Reproduction',
    description: 'Recall of a fact, information, or procedure',
    verbs: ['recall', 'identify', 'define', 'list', 'name', 'label', 'match', 'select'],
    manifoldProfile: {
      coherence: 0.8,
      fluidity: 0.2,
      elasticity: 0.1,
      gradient_awareness: 0.2,
      entropy_intuition: 0.1,
      non_dual_resolution: 0.1,
      generativity: 0.1,
    },
    typicalTimeMultiplier: 0.5,
  },
  2: {
    name: 'Skills and Concepts',
    description: 'Use of information, conceptual knowledge, and procedures',
    verbs: ['apply', 'calculate', 'solve', 'classify', 'compare', 'organize', 'explain', 'interpret'],
    manifoldProfile: {
      coherence: 0.7,
      fluidity: 0.5,
      elasticity: 0.3,
      gradient_awareness: 0.4,
      entropy_intuition: 0.3,
      non_dual_resolution: 0.2,
      generativity: 0.3,
    },
    typicalTimeMultiplier: 1.0,
  },
  3: {
    name: 'Strategic Thinking',
    description: 'Reasoning, planning, developing evidence, and complex thinking',
    verbs: ['analyze', 'evaluate', 'construct', 'investigate', 'justify', 'critique', 'hypothesize'],
    manifoldProfile: {
      coherence: 0.6,
      fluidity: 0.7,
      elasticity: 0.6,
      gradient_awareness: 0.7,
      entropy_intuition: 0.5,
      non_dual_resolution: 0.5,
      generativity: 0.6,
    },
    typicalTimeMultiplier: 2.0,
  },
  4: {
    name: 'Extended Thinking',
    description: 'Complex reasoning, planning, development, and thinking over time',
    verbs: ['design', 'create', 'synthesize', 'prove', 'develop', 'research', 'connect'],
    manifoldProfile: {
      coherence: 0.5,
      fluidity: 0.8,
      elasticity: 0.8,
      gradient_awareness: 0.8,
      entropy_intuition: 0.7,
      non_dual_resolution: 0.7,
      generativity: 0.9,
    },
    typicalTimeMultiplier: 4.0,
  },
};

// =============================================================================
// BLOOM'S TAXONOMY PROFILES
// =============================================================================

export const BLOOM_PROFILES: Record<BloomLevel, {
  level: number;
  description: string;
  verbs: string[];
  dokRange: [DOKLevel, DOKLevel];
}> = {
  'Remember': {
    level: 1,
    description: 'Retrieve relevant knowledge from long-term memory',
    verbs: ['recognize', 'recall', 'list', 'define', 'name', 'identify', 'match'],
    dokRange: [1, 1],
  },
  'Understand': {
    level: 2,
    description: 'Construct meaning from instructional messages',
    verbs: ['interpret', 'exemplify', 'classify', 'summarize', 'infer', 'compare', 'explain'],
    dokRange: [1, 2],
  },
  'Apply': {
    level: 3,
    description: 'Carry out or use a procedure in a given situation',
    verbs: ['execute', 'implement', 'solve', 'use', 'demonstrate', 'calculate'],
    dokRange: [2, 2],
  },
  'Analyze': {
    level: 4,
    description: 'Break material into parts and determine relationships',
    verbs: ['differentiate', 'organize', 'attribute', 'deconstruct', 'analyze', 'examine'],
    dokRange: [2, 3],
  },
  'Evaluate': {
    level: 5,
    description: 'Make judgments based on criteria and standards',
    verbs: ['check', 'critique', 'judge', 'evaluate', 'justify', 'argue', 'defend'],
    dokRange: [3, 4],
  },
  'Create': {
    level: 6,
    description: 'Put elements together to form a coherent whole',
    verbs: ['generate', 'plan', 'produce', 'design', 'construct', 'develop', 'invent'],
    dokRange: [3, 4],
  },
};

// =============================================================================
// COMMON CORE MATH STANDARDS (CCSS-Math)
// =============================================================================

/**
 * CCSS Math Domains by grade band
 */
export const CCSS_MATH_DOMAINS: Record<GradeBand, string[]> = {
  'K-2': [
    'CC', // Counting & Cardinality (K only)
    'OA', // Operations & Algebraic Thinking
    'NBT', // Number & Operations in Base Ten
    'MD', // Measurement & Data
    'G', // Geometry
  ],
  '3-5': [
    'OA', // Operations & Algebraic Thinking
    'NBT', // Number & Operations in Base Ten
    'NF', // Number & Operations—Fractions
    'MD', // Measurement & Data
    'G', // Geometry
  ],
  '6-8': [
    'RP', // Ratios & Proportional Relationships
    'NS', // The Number System
    'EE', // Expressions & Equations
    'F', // Functions (8th grade)
    'G', // Geometry
    'SP', // Statistics & Probability
  ],
  '9-12': [
    'N-RN', // The Real Number System
    'N-Q', // Quantities
    'N-CN', // The Complex Number System
    'A-SSE', // Seeing Structure in Expressions
    'A-APR', // Arithmetic with Polynomials
    'A-CED', // Creating Equations
    'A-REI', // Reasoning with Equations
    'F-IF', // Interpreting Functions
    'F-BF', // Building Functions
    'F-LE', // Linear, Quadratic, & Exponential Models
    'F-TF', // Trigonometric Functions
    'G-CO', // Congruence
    'G-SRT', // Similarity, Right Triangles, & Trigonometry
    'G-C', // Circles
    'G-GPE', // Expressing Geometric Properties
    'G-GMD', // Geometric Measurement & Dimension
    'G-MG', // Modeling with Geometry
    'S-ID', // Interpreting Categorical & Quantitative Data
    'S-IC', // Making Inferences & Justifying Conclusions
    'S-CP', // Conditional Probability & Rules
    'S-MD', // Using Probability to Make Decisions
  ],
  '12+': [], // Advanced/College level
};

// =============================================================================
// COMPREHENSIVE STANDARDS DATABASE
// =============================================================================

/**
 * Complete standards registry - Foundation & Bridge tiers for all 11 stats
 * This is the authoritative mapping of educational standards to HYRO Forge
 */
export const STANDARDS_REGISTRY: StandardCode[] = [
  // =========================================================================
  // MATH - FOUNDATION TIER (K-5)
  // =========================================================================
  {
    code: 'CCSS.MATH.CONTENT.K.CC.A.1',
    framework: 'CCSS-Math',
    description: 'Count to 100 by ones and by tens',
    shortTitle: 'Count to 100',
    grades: [0],
    domain: 'Counting & Cardinality',
    cluster: 'Know number names and the count sequence',
    dokLevel: 1,
    bloomLevel: 'Remember',
    prerequisites: [],
    relatedStandards: ['CCSS.MATH.CONTENT.K.CC.A.2', 'CCSS.MATH.CONTENT.K.CC.A.3'],
    keywords: ['counting', 'numbers', 'ones', 'tens', 'sequence'],
  },
  {
    code: 'CCSS.MATH.CONTENT.1.OA.A.1',
    framework: 'CCSS-Math',
    description: 'Use addition and subtraction within 20 to solve word problems',
    shortTitle: 'Add/Subtract Word Problems',
    grades: [1],
    domain: 'Operations & Algebraic Thinking',
    cluster: 'Represent and solve problems involving addition and subtraction',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: ['CCSS.MATH.CONTENT.K.OA.A.1'],
    relatedStandards: ['CCSS.MATH.CONTENT.1.OA.A.2'],
    keywords: ['addition', 'subtraction', 'word problems', 'within 20'],
  },
  {
    code: 'CCSS.MATH.CONTENT.2.NBT.A.1',
    framework: 'CCSS-Math',
    description: 'Understand that the three digits of a three-digit number represent amounts of hundreds, tens, and ones',
    shortTitle: 'Place Value to Hundreds',
    grades: [2],
    domain: 'Number & Operations in Base Ten',
    cluster: 'Understand place value',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: ['CCSS.MATH.CONTENT.1.NBT.B.2'],
    relatedStandards: ['CCSS.MATH.CONTENT.2.NBT.A.2', 'CCSS.MATH.CONTENT.2.NBT.A.3'],
    keywords: ['place value', 'hundreds', 'tens', 'ones', 'three-digit'],
  },
  {
    code: 'CCSS.MATH.CONTENT.3.NF.A.1',
    framework: 'CCSS-Math',
    description: 'Understand a fraction 1/b as the quantity formed by 1 part when a whole is partitioned into b equal parts',
    shortTitle: 'Understanding Unit Fractions',
    grades: [3],
    domain: 'Number & Operations—Fractions',
    cluster: 'Develop understanding of fractions as numbers',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: ['CCSS.MATH.CONTENT.2.G.A.3'],
    relatedStandards: ['CCSS.MATH.CONTENT.3.NF.A.2', 'CCSS.MATH.CONTENT.3.NF.A.3'],
    keywords: ['fractions', 'unit fractions', 'partition', 'equal parts'],
  },
  {
    code: 'CCSS.MATH.CONTENT.4.OA.A.1',
    framework: 'CCSS-Math',
    description: 'Interpret a multiplication equation as a comparison',
    shortTitle: 'Multiplicative Comparisons',
    grades: [4],
    domain: 'Operations & Algebraic Thinking',
    cluster: 'Use the four operations with whole numbers',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: ['CCSS.MATH.CONTENT.3.OA.A.1'],
    relatedStandards: ['CCSS.MATH.CONTENT.4.OA.A.2'],
    keywords: ['multiplication', 'comparison', 'times as many'],
  },
  {
    code: 'CCSS.MATH.CONTENT.5.NF.A.1',
    framework: 'CCSS-Math',
    description: 'Add and subtract fractions with unlike denominators',
    shortTitle: 'Add/Subtract Unlike Fractions',
    grades: [5],
    domain: 'Number & Operations—Fractions',
    cluster: 'Use equivalent fractions to add and subtract fractions',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: ['CCSS.MATH.CONTENT.4.NF.A.1', 'CCSS.MATH.CONTENT.4.NF.A.2'],
    relatedStandards: ['CCSS.MATH.CONTENT.5.NF.A.2'],
    keywords: ['fractions', 'unlike denominators', 'addition', 'subtraction', 'equivalent'],
  },

  // =========================================================================
  // MATH - BRIDGE TIER (6-8)
  // =========================================================================
  {
    code: 'CCSS.MATH.CONTENT.6.RP.A.1',
    framework: 'CCSS-Math',
    description: 'Understand the concept of a ratio and use ratio language',
    shortTitle: 'Understanding Ratios',
    grades: [6],
    domain: 'Ratios & Proportional Relationships',
    cluster: 'Understand ratio concepts and use ratio reasoning',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: ['CCSS.MATH.CONTENT.5.NF.B.5'],
    relatedStandards: ['CCSS.MATH.CONTENT.6.RP.A.2', 'CCSS.MATH.CONTENT.6.RP.A.3'],
    keywords: ['ratio', 'proportion', 'relationship', 'comparison'],
  },
  {
    code: 'CCSS.MATH.CONTENT.6.EE.A.2',
    framework: 'CCSS-Math',
    description: 'Write, read, and evaluate expressions in which letters stand for numbers',
    shortTitle: 'Algebraic Expressions',
    grades: [6],
    domain: 'Expressions & Equations',
    cluster: 'Apply and extend previous understandings of arithmetic',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: ['CCSS.MATH.CONTENT.5.OA.A.2'],
    relatedStandards: ['CCSS.MATH.CONTENT.6.EE.A.3', 'CCSS.MATH.CONTENT.6.EE.A.4'],
    keywords: ['expressions', 'variables', 'algebra', 'evaluate'],
  },
  {
    code: 'CCSS.MATH.CONTENT.7.RP.A.2',
    framework: 'CCSS-Math',
    description: 'Recognize and represent proportional relationships between quantities',
    shortTitle: 'Proportional Relationships',
    grades: [7],
    domain: 'Ratios & Proportional Relationships',
    cluster: 'Analyze proportional relationships and use them',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['CCSS.MATH.CONTENT.6.RP.A.3'],
    relatedStandards: ['CCSS.MATH.CONTENT.7.RP.A.1', 'CCSS.MATH.CONTENT.7.RP.A.3'],
    keywords: ['proportional', 'relationships', 'constant', 'unit rate'],
  },
  {
    code: 'CCSS.MATH.CONTENT.7.EE.B.4',
    framework: 'CCSS-Math',
    description: 'Use variables to represent quantities in a real-world or mathematical problem',
    shortTitle: 'Equations & Inequalities',
    grades: [7],
    domain: 'Expressions & Equations',
    cluster: 'Solve real-life and mathematical problems',
    dokLevel: 3,
    bloomLevel: 'Apply',
    prerequisites: ['CCSS.MATH.CONTENT.6.EE.B.7'],
    relatedStandards: ['CCSS.MATH.CONTENT.7.EE.B.3'],
    keywords: ['equations', 'inequalities', 'variables', 'real-world'],
  },
  {
    code: 'CCSS.MATH.CONTENT.8.F.A.1',
    framework: 'CCSS-Math',
    description: 'Understand that a function is a rule that assigns to each input exactly one output',
    shortTitle: 'Understanding Functions',
    grades: [8],
    domain: 'Functions',
    cluster: 'Define, evaluate, and compare functions',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: ['CCSS.MATH.CONTENT.7.EE.B.4'],
    relatedStandards: ['CCSS.MATH.CONTENT.8.F.A.2', 'CCSS.MATH.CONTENT.8.F.A.3'],
    keywords: ['function', 'input', 'output', 'rule', 'mapping'],
  },
  {
    code: 'CCSS.MATH.CONTENT.8.G.A.1',
    framework: 'CCSS-Math',
    description: 'Verify experimentally the properties of rotations, reflections, and translations',
    shortTitle: 'Geometric Transformations',
    grades: [8],
    domain: 'Geometry',
    cluster: 'Understand congruence and similarity',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['CCSS.MATH.CONTENT.7.G.A.2'],
    relatedStandards: ['CCSS.MATH.CONTENT.8.G.A.2', 'CCSS.MATH.CONTENT.8.G.A.3'],
    keywords: ['transformations', 'rotation', 'reflection', 'translation', 'congruence'],
  },

  // =========================================================================
  // READING - FOUNDATION TIER (K-5)
  // =========================================================================
  {
    code: 'CCSS.ELA-LITERACY.RL.K.1',
    framework: 'CCSS-ELA',
    description: 'With prompting and support, ask and answer questions about key details in a text',
    shortTitle: 'Key Details (K)',
    grades: [0],
    domain: 'Reading Literature',
    cluster: 'Key Ideas and Details',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: [],
    relatedStandards: ['CCSS.ELA-LITERACY.RL.K.2', 'CCSS.ELA-LITERACY.RL.K.3'],
    keywords: ['key details', 'questions', 'answers', 'text', 'reading'],
  },
  {
    code: 'CCSS.ELA-LITERACY.RL.1.2',
    framework: 'CCSS-ELA',
    description: 'Retell stories, including key details, and demonstrate understanding of their central message or lesson',
    shortTitle: 'Retelling Stories',
    grades: [1],
    domain: 'Reading Literature',
    cluster: 'Key Ideas and Details',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: ['CCSS.ELA-LITERACY.RL.K.2'],
    relatedStandards: ['CCSS.ELA-LITERACY.RL.1.1', 'CCSS.ELA-LITERACY.RL.1.3'],
    keywords: ['retell', 'central message', 'lesson', 'key details'],
  },
  {
    code: 'CCSS.ELA-LITERACY.RL.3.1',
    framework: 'CCSS-ELA',
    description: 'Ask and answer questions to demonstrate understanding of a text, referring explicitly to the text as the basis for the answers',
    shortTitle: 'Text Evidence',
    grades: [3],
    domain: 'Reading Literature',
    cluster: 'Key Ideas and Details',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: ['CCSS.ELA-LITERACY.RL.2.1'],
    relatedStandards: ['CCSS.ELA-LITERACY.RL.3.2', 'CCSS.ELA-LITERACY.RL.3.3'],
    keywords: ['text evidence', 'explicit', 'questions', 'answers'],
  },
  {
    code: 'CCSS.ELA-LITERACY.RL.4.4',
    framework: 'CCSS-ELA',
    description: 'Determine the meaning of words and phrases as they are used in a text, including figurative language',
    shortTitle: 'Figurative Language',
    grades: [4],
    domain: 'Reading Literature',
    cluster: 'Craft and Structure',
    dokLevel: 2,
    bloomLevel: 'Analyze',
    prerequisites: ['CCSS.ELA-LITERACY.RL.3.4'],
    relatedStandards: ['CCSS.ELA-LITERACY.L.4.5'],
    keywords: ['figurative language', 'meaning', 'words', 'phrases', 'context'],
  },
  {
    code: 'CCSS.ELA-LITERACY.RI.5.8',
    framework: 'CCSS-ELA',
    description: 'Explain how an author uses reasons and evidence to support particular points in a text',
    shortTitle: 'Author\'s Evidence',
    grades: [5],
    domain: 'Reading Informational Text',
    cluster: 'Integration of Knowledge and Ideas',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['CCSS.ELA-LITERACY.RI.4.8'],
    relatedStandards: ['CCSS.ELA-LITERACY.RI.5.9'],
    keywords: ['author', 'reasons', 'evidence', 'support', 'points'],
  },

  // =========================================================================
  // READING - BRIDGE TIER (6-8)
  // =========================================================================
  {
    code: 'CCSS.ELA-LITERACY.RL.6.1',
    framework: 'CCSS-ELA',
    description: 'Cite textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text',
    shortTitle: 'Citing Evidence (6)',
    grades: [6],
    domain: 'Reading Literature',
    cluster: 'Key Ideas and Details',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['CCSS.ELA-LITERACY.RL.5.1'],
    relatedStandards: ['CCSS.ELA-LITERACY.RL.6.2', 'CCSS.ELA-LITERACY.RL.6.3'],
    keywords: ['cite', 'textual evidence', 'inference', 'analysis'],
  },
  {
    code: 'CCSS.ELA-LITERACY.RL.7.2',
    framework: 'CCSS-ELA',
    description: 'Determine a theme or central idea of a text and analyze its development; provide an objective summary',
    shortTitle: 'Theme Analysis',
    grades: [7],
    domain: 'Reading Literature',
    cluster: 'Key Ideas and Details',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['CCSS.ELA-LITERACY.RL.6.2'],
    relatedStandards: ['CCSS.ELA-LITERACY.RL.7.1', 'CCSS.ELA-LITERACY.RL.7.3'],
    keywords: ['theme', 'central idea', 'development', 'summary', 'objective'],
  },
  {
    code: 'CCSS.ELA-LITERACY.RI.8.6',
    framework: 'CCSS-ELA',
    description: 'Determine an author\'s point of view or purpose in a text and analyze how the author acknowledges and responds to conflicting evidence or viewpoints',
    shortTitle: 'Author\'s Purpose',
    grades: [8],
    domain: 'Reading Informational Text',
    cluster: 'Craft and Structure',
    dokLevel: 3,
    bloomLevel: 'Evaluate',
    prerequisites: ['CCSS.ELA-LITERACY.RI.7.6'],
    relatedStandards: ['CCSS.ELA-LITERACY.RI.8.5', 'CCSS.ELA-LITERACY.RI.8.8'],
    keywords: ['point of view', 'purpose', 'conflicting', 'viewpoints', 'analyze'],
  },

  // =========================================================================
  // WRITING - FOUNDATION TIER (K-5)
  // =========================================================================
  {
    code: 'CCSS.ELA-LITERACY.W.K.3',
    framework: 'CCSS-ELA',
    description: 'Use a combination of drawing, dictating, and writing to narrate a single event',
    shortTitle: 'Narrative Writing (K)',
    grades: [0],
    domain: 'Writing',
    cluster: 'Text Types and Purposes',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: [],
    relatedStandards: ['CCSS.ELA-LITERACY.W.K.1', 'CCSS.ELA-LITERACY.W.K.2'],
    keywords: ['narrative', 'drawing', 'dictating', 'writing', 'event'],
  },
  {
    code: 'CCSS.ELA-LITERACY.W.3.1',
    framework: 'CCSS-ELA',
    description: 'Write opinion pieces on topics or texts, supporting a point of view with reasons',
    shortTitle: 'Opinion Writing',
    grades: [3],
    domain: 'Writing',
    cluster: 'Text Types and Purposes',
    dokLevel: 3,
    bloomLevel: 'Apply',
    prerequisites: ['CCSS.ELA-LITERACY.W.2.1'],
    relatedStandards: ['CCSS.ELA-LITERACY.W.3.2', 'CCSS.ELA-LITERACY.W.3.3'],
    keywords: ['opinion', 'point of view', 'reasons', 'support'],
  },
  {
    code: 'CCSS.ELA-LITERACY.W.5.2',
    framework: 'CCSS-ELA',
    description: 'Write informative/explanatory texts to examine a topic and convey ideas and information clearly',
    shortTitle: 'Informative Writing',
    grades: [5],
    domain: 'Writing',
    cluster: 'Text Types and Purposes',
    dokLevel: 3,
    bloomLevel: 'Apply',
    prerequisites: ['CCSS.ELA-LITERACY.W.4.2'],
    relatedStandards: ['CCSS.ELA-LITERACY.W.5.1', 'CCSS.ELA-LITERACY.W.5.3'],
    keywords: ['informative', 'explanatory', 'topic', 'convey', 'clearly'],
  },

  // =========================================================================
  // WRITING - BRIDGE TIER (6-8)
  // =========================================================================
  {
    code: 'CCSS.ELA-LITERACY.W.6.1',
    framework: 'CCSS-ELA',
    description: 'Write arguments to support claims with clear reasons and relevant evidence',
    shortTitle: 'Argumentative Writing',
    grades: [6],
    domain: 'Writing',
    cluster: 'Text Types and Purposes',
    dokLevel: 3,
    bloomLevel: 'Create',
    prerequisites: ['CCSS.ELA-LITERACY.W.5.1'],
    relatedStandards: ['CCSS.ELA-LITERACY.W.6.2', 'CCSS.ELA-LITERACY.W.6.4'],
    keywords: ['arguments', 'claims', 'reasons', 'evidence', 'support'],
  },
  {
    code: 'CCSS.ELA-LITERACY.W.7.4',
    framework: 'CCSS-ELA',
    description: 'Produce clear and coherent writing in which the development, organization, and style are appropriate to task, purpose, and audience',
    shortTitle: 'Coherent Writing',
    grades: [7],
    domain: 'Writing',
    cluster: 'Production and Distribution of Writing',
    dokLevel: 3,
    bloomLevel: 'Create',
    prerequisites: ['CCSS.ELA-LITERACY.W.6.4'],
    relatedStandards: ['CCSS.ELA-LITERACY.W.7.5', 'CCSS.ELA-LITERACY.W.7.6'],
    keywords: ['coherent', 'organization', 'style', 'purpose', 'audience'],
  },
  {
    code: 'CCSS.ELA-LITERACY.W.8.7',
    framework: 'CCSS-ELA',
    description: 'Conduct short research projects to answer a question, drawing on several sources',
    shortTitle: 'Research Projects',
    grades: [8],
    domain: 'Writing',
    cluster: 'Research to Build and Present Knowledge',
    dokLevel: 4,
    bloomLevel: 'Create',
    prerequisites: ['CCSS.ELA-LITERACY.W.7.7'],
    relatedStandards: ['CCSS.ELA-LITERACY.W.8.8', 'CCSS.ELA-LITERACY.W.8.9'],
    keywords: ['research', 'sources', 'question', 'synthesize'],
  },

  // =========================================================================
  // SCIENCE - FOUNDATION TIER (K-5) - NGSS
  // =========================================================================
  {
    code: 'K-PS2-1',
    framework: 'NGSS',
    description: 'Plan and conduct an investigation to compare the effects of different strengths or different directions of pushes and pulls on the motion of an object',
    shortTitle: 'Pushes and Pulls',
    grades: [0],
    domain: 'Physical Science',
    cluster: 'Motion and Stability: Forces and Interactions',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: [],
    relatedStandards: ['K-PS2-2'],
    keywords: ['forces', 'motion', 'push', 'pull', 'investigation'],
  },
  {
    code: '1-LS1-1',
    framework: 'NGSS',
    description: 'Use materials to design a solution to a human problem by mimicking how plants and/or animals use their external parts',
    shortTitle: 'Biomimicry Design',
    grades: [1],
    domain: 'Life Science',
    cluster: 'From Molecules to Organisms: Structure and Processes',
    dokLevel: 3,
    bloomLevel: 'Create',
    prerequisites: [],
    relatedStandards: ['1-LS1-2'],
    keywords: ['design', 'biomimicry', 'plants', 'animals', 'structure'],
  },
  {
    code: '3-PS2-1',
    framework: 'NGSS',
    description: 'Plan and conduct an investigation to provide evidence of the effects of balanced and unbalanced forces on the motion of an object',
    shortTitle: 'Balanced Forces',
    grades: [3],
    domain: 'Physical Science',
    cluster: 'Motion and Stability: Forces and Interactions',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['K-PS2-1'],
    relatedStandards: ['3-PS2-2'],
    keywords: ['balanced', 'unbalanced', 'forces', 'motion', 'evidence'],
  },
  {
    code: '4-ESS2-2',
    framework: 'NGSS',
    description: 'Analyze and interpret data from maps to describe patterns of Earth\'s features',
    shortTitle: 'Earth\'s Features',
    grades: [4],
    domain: 'Earth and Space Science',
    cluster: 'Earth\'s Systems',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['2-ESS2-2'],
    relatedStandards: ['4-ESS2-1'],
    keywords: ['maps', 'patterns', 'earth', 'features', 'data'],
  },
  {
    code: '5-PS1-1',
    framework: 'NGSS',
    description: 'Develop a model to describe that matter is made of particles too small to be seen',
    shortTitle: 'Particle Model of Matter',
    grades: [5],
    domain: 'Physical Science',
    cluster: 'Matter and Its Interactions',
    dokLevel: 3,
    bloomLevel: 'Create',
    prerequisites: ['2-PS1-1'],
    relatedStandards: ['5-PS1-2', '5-PS1-3'],
    keywords: ['particles', 'matter', 'model', 'atoms', 'molecules'],
  },

  // =========================================================================
  // SCIENCE - BRIDGE TIER (6-8) - NGSS
  // =========================================================================
  {
    code: 'MS-PS1-1',
    framework: 'NGSS',
    description: 'Develop models to describe the atomic composition of simple molecules and extended structures',
    shortTitle: 'Atomic Composition',
    grades: [6, 7, 8],
    domain: 'Physical Science',
    cluster: 'Matter and Its Interactions',
    dokLevel: 3,
    bloomLevel: 'Create',
    prerequisites: ['5-PS1-1'],
    relatedStandards: ['MS-PS1-2', 'MS-PS1-3'],
    keywords: ['atoms', 'molecules', 'composition', 'model', 'structure'],
  },
  {
    code: 'MS-LS1-2',
    framework: 'NGSS',
    description: 'Develop and use a model to describe the function of a cell as a whole and ways parts of cells contribute to the function',
    shortTitle: 'Cell Structure & Function',
    grades: [6, 7, 8],
    domain: 'Life Science',
    cluster: 'From Molecules to Organisms: Structure and Processes',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['4-LS1-1'],
    relatedStandards: ['MS-LS1-1', 'MS-LS1-3'],
    keywords: ['cell', 'function', 'organelles', 'model', 'structure'],
  },
  {
    code: 'MS-ESS1-1',
    framework: 'NGSS',
    description: 'Develop and use a model of the Earth-sun-moon system to describe the cyclic patterns of lunar phases, eclipses, and seasons',
    shortTitle: 'Earth-Sun-Moon System',
    grades: [6, 7, 8],
    domain: 'Earth and Space Science',
    cluster: 'Earth\'s Place in the Universe',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['5-ESS1-2'],
    relatedStandards: ['MS-ESS1-2', 'MS-ESS1-3'],
    keywords: ['lunar phases', 'eclipses', 'seasons', 'solar system', 'model'],
  },

  // =========================================================================
  // SOCIAL STUDIES - FOUNDATION TIER (K-5) - C3 Framework
  // =========================================================================
  {
    code: 'C3.D2.Civ.1.K-2',
    framework: 'C3',
    description: 'Describe roles and responsibilities of people in authority',
    shortTitle: 'Roles in Authority',
    grades: [0, 1, 2],
    domain: 'Civics',
    cluster: 'Civic and Political Institutions',
    dokLevel: 1,
    bloomLevel: 'Understand',
    prerequisites: [],
    relatedStandards: ['C3.D2.Civ.2.K-2'],
    keywords: ['roles', 'responsibilities', 'authority', 'government', 'community'],
  },
  {
    code: 'C3.D2.His.1.3-5',
    framework: 'C3',
    description: 'Create and use a chronological sequence of related events to compare developments that happened at the same time',
    shortTitle: 'Chronological Thinking',
    grades: [3, 4, 5],
    domain: 'History',
    cluster: 'Change, Continuity, and Context',
    dokLevel: 2,
    bloomLevel: 'Analyze',
    prerequisites: ['C3.D2.His.1.K-2'],
    relatedStandards: ['C3.D2.His.2.3-5'],
    keywords: ['chronological', 'sequence', 'events', 'timeline', 'compare'],
  },
  {
    code: 'C3.D2.Geo.2.3-5',
    framework: 'C3',
    description: 'Use maps, satellite images, photographs, and other representations to explain relationships between the locations of places and regions',
    shortTitle: 'Geographic Relationships',
    grades: [3, 4, 5],
    domain: 'Geography',
    cluster: 'Geographic Representations',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: ['C3.D2.Geo.1.K-2'],
    relatedStandards: ['C3.D2.Geo.3.3-5'],
    keywords: ['maps', 'satellite', 'locations', 'regions', 'geography'],
  },
  {
    code: 'C3.D2.Eco.1.3-5',
    framework: 'C3',
    description: 'Compare the benefits and costs of individual choices',
    shortTitle: 'Economic Choices',
    grades: [3, 4, 5],
    domain: 'Economics',
    cluster: 'Economic Decision Making',
    dokLevel: 2,
    bloomLevel: 'Analyze',
    prerequisites: ['C3.D2.Eco.1.K-2'],
    relatedStandards: ['C3.D2.Eco.2.3-5'],
    keywords: ['benefits', 'costs', 'choices', 'decisions', 'trade-offs'],
  },

  // =========================================================================
  // SOCIAL STUDIES - BRIDGE TIER (6-8) - C3 Framework
  // =========================================================================
  {
    code: 'C3.D2.Civ.3.6-8',
    framework: 'C3',
    description: 'Examine the origins, purposes, and impact of constitutions, laws, treaties, and international agreements',
    shortTitle: 'Constitutional Foundations',
    grades: [6, 7, 8],
    domain: 'Civics',
    cluster: 'Civic and Political Institutions',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['C3.D2.Civ.3.3-5'],
    relatedStandards: ['C3.D2.Civ.4.6-8'],
    keywords: ['constitution', 'laws', 'treaties', 'agreements', 'government'],
  },
  {
    code: 'C3.D2.His.2.6-8',
    framework: 'C3',
    description: 'Classify series of historical events and developments as examples of change and/or continuity',
    shortTitle: 'Change and Continuity',
    grades: [6, 7, 8],
    domain: 'History',
    cluster: 'Change, Continuity, and Context',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['C3.D2.His.2.3-5'],
    relatedStandards: ['C3.D2.His.1.6-8'],
    keywords: ['change', 'continuity', 'historical', 'classify', 'development'],
  },
  {
    code: 'C3.D2.Eco.3.6-8',
    framework: 'C3',
    description: 'Explain the roles of buyers and sellers in product, labor, and financial markets',
    shortTitle: 'Market Participants',
    grades: [6, 7, 8],
    domain: 'Economics',
    cluster: 'Exchange and Markets',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: ['C3.D2.Eco.3.3-5'],
    relatedStandards: ['C3.D2.Eco.4.6-8'],
    keywords: ['buyers', 'sellers', 'markets', 'labor', 'financial'],
  },

  // =========================================================================
  // FINANCIAL LITERACY - FOUNDATION TIER (K-5) - JumpStart/Custom
  // =========================================================================
  {
    code: 'HYRO.FL.K-2.1',
    framework: 'JumpStart',
    description: 'Identify the difference between needs and wants',
    shortTitle: 'Needs vs Wants',
    grades: [0, 1, 2],
    domain: 'Financial Decision Making',
    cluster: 'Spending and Saving',
    dokLevel: 1,
    bloomLevel: 'Remember',
    prerequisites: [],
    relatedStandards: ['HYRO.FL.K-2.2'],
    keywords: ['needs', 'wants', 'money', 'spending', 'basic'],
  },
  {
    code: 'HYRO.FL.3-5.1',
    framework: 'JumpStart',
    description: 'Explain how income is earned and the difference between income and expenses',
    shortTitle: 'Income & Expenses',
    grades: [3, 4, 5],
    domain: 'Income',
    cluster: 'Earning and Income',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: ['HYRO.FL.K-2.1'],
    relatedStandards: ['HYRO.FL.3-5.2'],
    keywords: ['income', 'expenses', 'earning', 'money', 'budget'],
  },
  {
    code: 'HYRO.FL.3-5.2',
    framework: 'JumpStart',
    description: 'Create a basic budget that balances income and expenses',
    shortTitle: 'Basic Budgeting',
    grades: [3, 4, 5],
    domain: 'Money Management',
    cluster: 'Spending and Saving',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: ['HYRO.FL.3-5.1'],
    relatedStandards: ['HYRO.FL.3-5.3'],
    keywords: ['budget', 'balance', 'plan', 'spending', 'saving'],
  },

  // =========================================================================
  // FINANCIAL LITERACY - BRIDGE TIER (6-8)
  // =========================================================================
  {
    code: 'HYRO.FL.6-8.1',
    framework: 'JumpStart',
    description: 'Analyze how compound interest affects savings growth over time',
    shortTitle: 'Compound Interest',
    grades: [6, 7, 8],
    domain: 'Saving',
    cluster: 'Saving and Investing',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['HYRO.FL.3-5.2'],
    relatedStandards: ['HYRO.FL.6-8.2'],
    keywords: ['compound interest', 'savings', 'growth', 'time value', 'money'],
  },
  {
    code: 'HYRO.FL.6-8.2',
    framework: 'JumpStart',
    description: 'Compare different types of credit and their appropriate uses',
    shortTitle: 'Understanding Credit',
    grades: [6, 7, 8],
    domain: 'Credit',
    cluster: 'Credit and Debt',
    dokLevel: 2,
    bloomLevel: 'Analyze',
    prerequisites: ['HYRO.FL.3-5.3'],
    relatedStandards: ['HYRO.FL.6-8.3'],
    keywords: ['credit', 'types', 'loans', 'interest rates', 'debt'],
  },
  {
    code: 'HYRO.FL.6-8.3',
    framework: 'JumpStart',
    description: 'Evaluate the relationship between risk and return in investment decisions',
    shortTitle: 'Risk and Return',
    grades: [6, 7, 8],
    domain: 'Investing',
    cluster: 'Saving and Investing',
    dokLevel: 3,
    bloomLevel: 'Evaluate',
    prerequisites: ['HYRO.FL.6-8.1'],
    relatedStandards: ['HYRO.FL.6-8.4'],
    keywords: ['risk', 'return', 'investment', 'diversification', 'stocks'],
  },

  // =========================================================================
  // CODING - FOUNDATION TIER (K-5) - CSTA/Custom
  // =========================================================================
  {
    code: 'CSTA.1A-CS-01',
    framework: 'CSTA',
    description: 'Select and operate appropriate software to perform a variety of tasks',
    shortTitle: 'Software Operation',
    grades: [0, 1, 2],
    domain: 'Computing Systems',
    cluster: 'Devices',
    dokLevel: 1,
    bloomLevel: 'Apply',
    prerequisites: [],
    relatedStandards: ['CSTA.1A-CS-02'],
    keywords: ['software', 'operate', 'devices', 'applications', 'basic'],
  },
  {
    code: 'CSTA.1A-AP-10',
    framework: 'CSTA',
    description: 'Develop programs with sequences and simple loops',
    shortTitle: 'Sequences and Loops',
    grades: [0, 1, 2],
    domain: 'Algorithms & Programming',
    cluster: 'Control',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: ['CSTA.1A-CS-01'],
    relatedStandards: ['CSTA.1A-AP-11'],
    keywords: ['sequences', 'loops', 'programming', 'algorithms', 'repeat'],
  },
  {
    code: 'CSTA.1B-AP-10',
    framework: 'CSTA',
    description: 'Create programs that include sequences, events, loops, and conditionals',
    shortTitle: 'Programming Constructs',
    grades: [3, 4, 5],
    domain: 'Algorithms & Programming',
    cluster: 'Control',
    dokLevel: 2,
    bloomLevel: 'Create',
    prerequisites: ['CSTA.1A-AP-10'],
    relatedStandards: ['CSTA.1B-AP-11', 'CSTA.1B-AP-12'],
    keywords: ['programs', 'events', 'loops', 'conditionals', 'create'],
  },
  {
    code: 'CSTA.1B-AP-11',
    framework: 'CSTA',
    description: 'Decompose problems into smaller, manageable subproblems',
    shortTitle: 'Problem Decomposition',
    grades: [3, 4, 5],
    domain: 'Algorithms & Programming',
    cluster: 'Modularity',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['CSTA.1B-AP-10'],
    relatedStandards: ['CSTA.1B-AP-12'],
    keywords: ['decompose', 'subproblems', 'modular', 'break down', 'functions'],
  },

  // =========================================================================
  // CODING - BRIDGE TIER (6-8)
  // =========================================================================
  {
    code: 'CSTA.2-AP-13',
    framework: 'CSTA',
    description: 'Decompose problems and subproblems into parts to facilitate the design, implementation, and review of programs',
    shortTitle: 'Advanced Decomposition',
    grades: [6, 7, 8],
    domain: 'Algorithms & Programming',
    cluster: 'Modularity',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['CSTA.1B-AP-11'],
    relatedStandards: ['CSTA.2-AP-14'],
    keywords: ['decompose', 'design', 'implementation', 'review', 'modular'],
  },
  {
    code: 'CSTA.2-AP-16',
    framework: 'CSTA',
    description: 'Incorporate existing code, media, and libraries into original programs, and give attribution',
    shortTitle: 'Code Reuse & Attribution',
    grades: [6, 7, 8],
    domain: 'Algorithms & Programming',
    cluster: 'Program Development',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: ['CSTA.1B-AP-10'],
    relatedStandards: ['CSTA.2-AP-17'],
    keywords: ['libraries', 'reuse', 'attribution', 'media', 'integrate'],
  },
  {
    code: 'CSTA.2-DA-07',
    framework: 'CSTA',
    description: 'Represent data using multiple encoding schemes',
    shortTitle: 'Data Representation',
    grades: [6, 7, 8],
    domain: 'Data & Analysis',
    cluster: 'Collection, Visualization, & Transformation',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: ['CSTA.1B-DA-06'],
    relatedStandards: ['CSTA.2-DA-08'],
    keywords: ['data', 'encoding', 'representation', 'binary', 'formats'],
  },

  // =========================================================================
  // STUDY SKILLS - FOUNDATION TIER (K-5) - Custom HYRO Standards
  // =========================================================================
  {
    code: 'HYRO.SS.K-2.1',
    framework: 'Custom',
    description: 'Follow multi-step directions and complete tasks independently',
    shortTitle: 'Following Directions',
    grades: [0, 1, 2],
    domain: 'Time Management',
    cluster: 'Task Completion',
    dokLevel: 1,
    bloomLevel: 'Apply',
    prerequisites: [],
    relatedStandards: ['HYRO.SS.K-2.2'],
    keywords: ['directions', 'tasks', 'independent', 'follow', 'complete'],
  },
  {
    code: 'HYRO.SS.3-5.1',
    framework: 'Custom',
    description: 'Use a planner or calendar to track assignments and due dates',
    shortTitle: 'Assignment Tracking',
    grades: [3, 4, 5],
    domain: 'Time Management',
    cluster: 'Organization',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: ['HYRO.SS.K-2.1'],
    relatedStandards: ['HYRO.SS.3-5.2'],
    keywords: ['planner', 'calendar', 'assignments', 'due dates', 'organize'],
  },
  {
    code: 'HYRO.SS.3-5.2',
    framework: 'Custom',
    description: 'Take notes from texts and lectures using a structured format',
    shortTitle: 'Note Taking',
    grades: [3, 4, 5],
    domain: 'Note Taking & Organization',
    cluster: 'Information Processing',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: ['HYRO.SS.K-2.2'],
    relatedStandards: ['HYRO.SS.3-5.3'],
    keywords: ['notes', 'structured', 'format', 'Cornell', 'outline'],
  },

  // =========================================================================
  // STUDY SKILLS - BRIDGE TIER (6-8)
  // =========================================================================
  {
    code: 'HYRO.SS.6-8.1',
    framework: 'Custom',
    description: 'Apply time management techniques to balance multiple subjects and activities',
    shortTitle: 'Time Management Systems',
    grades: [6, 7, 8],
    domain: 'Time Management',
    cluster: 'Prioritization',
    dokLevel: 3,
    bloomLevel: 'Apply',
    prerequisites: ['HYRO.SS.3-5.1'],
    relatedStandards: ['HYRO.SS.6-8.2'],
    keywords: ['time management', 'balance', 'prioritize', 'schedule', 'activities'],
  },
  {
    code: 'HYRO.SS.6-8.2',
    framework: 'Custom',
    description: 'Use spaced repetition and active recall techniques for exam preparation',
    shortTitle: 'Spaced Repetition',
    grades: [6, 7, 8],
    domain: 'Test Taking Strategies',
    cluster: 'Study Techniques',
    dokLevel: 3,
    bloomLevel: 'Apply',
    prerequisites: ['HYRO.SS.3-5.2'],
    relatedStandards: ['HYRO.SS.6-8.3'],
    keywords: ['spaced repetition', 'active recall', 'flashcards', 'exam', 'memory'],
  },
  {
    code: 'HYRO.SS.6-8.3',
    framework: 'Custom',
    description: 'Monitor and adjust learning strategies based on self-assessment of progress',
    shortTitle: 'Metacognitive Monitoring',
    grades: [6, 7, 8],
    domain: 'Metacognition',
    cluster: 'Self-Regulation',
    dokLevel: 4,
    bloomLevel: 'Evaluate',
    prerequisites: ['HYRO.SS.6-8.1', 'HYRO.SS.6-8.2'],
    relatedStandards: [],
    keywords: ['metacognition', 'self-assessment', 'monitor', 'adjust', 'strategies'],
  },

  // =========================================================================
  // CRITICAL THINKING - FOUNDATION TIER (K-5)
  // =========================================================================
  {
    code: 'HYRO.CT.K-2.1',
    framework: 'Custom',
    description: 'Distinguish between facts and opinions in simple statements',
    shortTitle: 'Fact vs Opinion',
    grades: [0, 1, 2],
    domain: 'Analysis & Evaluation',
    cluster: 'Evidence Analysis',
    dokLevel: 2,
    bloomLevel: 'Analyze',
    prerequisites: [],
    relatedStandards: ['HYRO.CT.K-2.2'],
    keywords: ['facts', 'opinions', 'distinguish', 'evidence', 'true'],
  },
  {
    code: 'HYRO.CT.3-5.1',
    framework: 'Custom',
    description: 'Identify reasons and evidence an author uses to support points in a text',
    shortTitle: 'Evaluating Evidence',
    grades: [3, 4, 5],
    domain: 'Analysis & Evaluation',
    cluster: 'Argument Analysis',
    dokLevel: 2,
    bloomLevel: 'Analyze',
    prerequisites: ['HYRO.CT.K-2.1'],
    relatedStandards: ['HYRO.CT.3-5.2'],
    keywords: ['reasons', 'evidence', 'support', 'author', 'argument'],
  },
  {
    code: 'HYRO.CT.3-5.2',
    framework: 'Custom',
    description: 'Formulate questions to clarify problems and gather relevant information',
    shortTitle: 'Inquiry Skills',
    grades: [3, 4, 5],
    domain: 'Problem Solving Heuristics',
    cluster: 'Information Gathering',
    dokLevel: 3,
    bloomLevel: 'Apply',
    prerequisites: ['HYRO.CT.K-2.2'],
    relatedStandards: ['HYRO.CT.3-5.3'],
    keywords: ['questions', 'clarify', 'problems', 'information', 'inquiry'],
  },

  // =========================================================================
  // CRITICAL THINKING - BRIDGE TIER (6-8)
  // =========================================================================
  {
    code: 'HYRO.CT.6-8.1',
    framework: 'Custom',
    description: 'Analyze arguments for logical validity, identifying premises and conclusions',
    shortTitle: 'Argument Analysis',
    grades: [6, 7, 8],
    domain: 'Logic & Reasoning',
    cluster: 'Formal Logic',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['HYRO.CT.3-5.1'],
    relatedStandards: ['HYRO.CT.6-8.2'],
    keywords: ['arguments', 'logic', 'validity', 'premises', 'conclusions'],
  },
  {
    code: 'HYRO.CT.6-8.2',
    framework: 'Custom',
    description: 'Identify and explain common logical fallacies in real-world arguments',
    shortTitle: 'Logical Fallacies',
    grades: [6, 7, 8],
    domain: 'Logic & Reasoning',
    cluster: 'Fallacy Detection',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['HYRO.CT.6-8.1'],
    relatedStandards: ['HYRO.CT.6-8.3'],
    keywords: ['fallacies', 'logical errors', 'ad hominem', 'strawman', 'bias'],
  },
  {
    code: 'HYRO.CT.6-8.3',
    framework: 'Custom',
    description: 'Recognize and mitigate common cognitive biases in decision making',
    shortTitle: 'Cognitive Bias Awareness',
    grades: [6, 7, 8],
    domain: 'Cognitive Bias Mitigation',
    cluster: 'Self-Awareness',
    dokLevel: 4,
    bloomLevel: 'Evaluate',
    prerequisites: ['HYRO.CT.6-8.2'],
    relatedStandards: [],
    keywords: ['cognitive bias', 'confirmation bias', 'anchoring', 'heuristics', 'decision'],
  },

  // =========================================================================
  // TECHNOLOGY - FOUNDATION TIER (K-5) - ISTE Standards
  // =========================================================================
  {
    code: 'ISTE.1a',
    framework: 'ISTE',
    description: 'Articulate and set personal learning goals, develop strategies leveraging technology to achieve them',
    shortTitle: 'Digital Learning Goals',
    grades: [0, 1, 2, 3, 4, 5],
    domain: 'Digital Literacy',
    cluster: 'Empowered Learner',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: [],
    relatedStandards: ['ISTE.1b', 'ISTE.1c'],
    keywords: ['learning goals', 'technology', 'strategies', 'digital', 'personal'],
  },
  {
    code: 'ISTE.2b',
    framework: 'ISTE',
    description: 'Engage in positive, safe, legal and ethical behavior when using technology',
    shortTitle: 'Digital Citizenship',
    grades: [0, 1, 2, 3, 4, 5],
    domain: 'Digital Literacy',
    cluster: 'Digital Citizen',
    dokLevel: 2,
    bloomLevel: 'Apply',
    prerequisites: [],
    relatedStandards: ['ISTE.2a', 'ISTE.2c'],
    keywords: ['digital citizenship', 'safety', 'ethical', 'legal', 'online'],
  },

  // =========================================================================
  // TECHNOLOGY - BRIDGE TIER (6-8)
  // =========================================================================
  {
    code: 'ISTE.5a',
    framework: 'ISTE',
    description: 'Formulate problem definitions suited for technology-assisted methods',
    shortTitle: 'Computational Problem Solving',
    grades: [6, 7, 8],
    domain: 'Hardware & Systems',
    cluster: 'Computational Thinker',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['ISTE.1a'],
    relatedStandards: ['ISTE.5b', 'ISTE.5c'],
    keywords: ['problem definition', 'computational', 'technology', 'methods', 'systematic'],
  },
  {
    code: 'ISTE.6b',
    framework: 'ISTE',
    description: 'Create original works or responsibly repurpose digital resources into new creations',
    shortTitle: 'Digital Creation',
    grades: [6, 7, 8],
    domain: 'Network & Security',
    cluster: 'Creative Communicator',
    dokLevel: 3,
    bloomLevel: 'Create',
    prerequisites: ['ISTE.2b'],
    relatedStandards: ['ISTE.6a', 'ISTE.6c'],
    keywords: ['create', 'original', 'digital', 'repurpose', 'multimedia'],
  },

  // =========================================================================
  // PROBLEM SOLVING - FOUNDATION TIER (K-5)
  // =========================================================================
  {
    code: 'HYRO.PS.K-2.1',
    framework: 'Custom',
    description: 'Identify what a problem is asking and relevant given information',
    shortTitle: 'Problem Identification',
    grades: [0, 1, 2],
    domain: 'Problem Definition',
    cluster: 'Understanding Problems',
    dokLevel: 2,
    bloomLevel: 'Understand',
    prerequisites: [],
    relatedStandards: ['HYRO.PS.K-2.2'],
    keywords: ['identify', 'problem', 'given', 'information', 'asking'],
  },
  {
    code: 'HYRO.PS.3-5.1',
    framework: 'Custom',
    description: 'Use multiple strategies (draw a picture, make a list, work backwards) to solve problems',
    shortTitle: 'Problem Solving Strategies',
    grades: [3, 4, 5],
    domain: 'Strategy Formulation',
    cluster: 'Heuristics',
    dokLevel: 3,
    bloomLevel: 'Apply',
    prerequisites: ['HYRO.PS.K-2.1'],
    relatedStandards: ['HYRO.PS.3-5.2'],
    keywords: ['strategies', 'draw', 'list', 'work backwards', 'solve'],
  },
  {
    code: 'HYRO.PS.3-5.2',
    framework: 'Custom',
    description: 'Check work and evaluate whether solutions make sense',
    shortTitle: 'Solution Evaluation',
    grades: [3, 4, 5],
    domain: 'Evaluation & Reflection',
    cluster: 'Verification',
    dokLevel: 2,
    bloomLevel: 'Evaluate',
    prerequisites: ['HYRO.PS.3-5.1'],
    relatedStandards: [],
    keywords: ['check', 'evaluate', 'solutions', 'sense', 'verify'],
  },

  // =========================================================================
  // PROBLEM SOLVING - BRIDGE TIER (6-8)
  // =========================================================================
  {
    code: 'HYRO.PS.6-8.1',
    framework: 'Custom',
    description: 'Decompose complex problems into simpler sub-problems',
    shortTitle: 'Problem Decomposition',
    grades: [6, 7, 8],
    domain: 'Problem Definition',
    cluster: 'Analysis',
    dokLevel: 3,
    bloomLevel: 'Analyze',
    prerequisites: ['HYRO.PS.3-5.1'],
    relatedStandards: ['HYRO.PS.6-8.2'],
    keywords: ['decompose', 'complex', 'sub-problems', 'break down', 'analyze'],
  },
  {
    code: 'HYRO.PS.6-8.2',
    framework: 'Custom',
    description: 'Apply systematic approaches (scientific method, design thinking) to novel problems',
    shortTitle: 'Systematic Problem Solving',
    grades: [6, 7, 8],
    domain: 'Execution & Monitoring',
    cluster: 'Methodology',
    dokLevel: 3,
    bloomLevel: 'Apply',
    prerequisites: ['HYRO.PS.6-8.1'],
    relatedStandards: ['HYRO.PS.6-8.3'],
    keywords: ['systematic', 'scientific method', 'design thinking', 'novel', 'approach'],
  },
  {
    code: 'HYRO.PS.6-8.3',
    framework: 'Custom',
    description: 'Generate and evaluate multiple solution approaches before committing to one',
    shortTitle: 'Lateral Thinking',
    grades: [6, 7, 8],
    domain: 'Lateral Thinking',
    cluster: 'Creative Solutions',
    dokLevel: 4,
    bloomLevel: 'Create',
    prerequisites: ['HYRO.PS.6-8.2'],
    relatedStandards: [],
    keywords: ['generate', 'evaluate', 'multiple', 'approaches', 'creative'],
  },
];

// =============================================================================
// STANDARD-TO-STRAND MAPPINGS
// =============================================================================

/**
 * Maps standards to HYRO blueprint strands
 */
export const STANDARD_STRAND_MAPPINGS: StandardToStrandMapping[] = [
  // Math - Foundation
  { standardCode: 'CCSS.MATH.CONTENT.K.CC.A.1', statName: 'math', strandName: 'Arithmetic & Number Sense', tier: 'Foundation', weight: 1.0, manifoldDimensions: { coherence: 0.9, fluidity: 0.1, generativity: 0.1 } },
  { standardCode: 'CCSS.MATH.CONTENT.1.OA.A.1', statName: 'math', strandName: 'Arithmetic & Number Sense', tier: 'Foundation', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.3, generativity: 0.2 } },
  { standardCode: 'CCSS.MATH.CONTENT.2.NBT.A.1', statName: 'math', strandName: 'Arithmetic & Number Sense', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.2, generativity: 0.1 } },
  { standardCode: 'CCSS.MATH.CONTENT.3.NF.A.1', statName: 'math', strandName: 'Arithmetic & Number Sense', tier: 'Foundation', weight: 0.7, manifoldDimensions: { coherence: 0.7, fluidity: 0.4, generativity: 0.3 } },
  { standardCode: 'CCSS.MATH.CONTENT.4.OA.A.1', statName: 'math', strandName: 'Algebra I (Foundations)', tier: 'Foundation', weight: 0.6, manifoldDimensions: { coherence: 0.6, fluidity: 0.4, generativity: 0.3 } },
  { standardCode: 'CCSS.MATH.CONTENT.5.NF.A.1', statName: 'math', strandName: 'Arithmetic & Number Sense', tier: 'Foundation', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, generativity: 0.3 } },

  // Math - Bridge
  { standardCode: 'CCSS.MATH.CONTENT.6.RP.A.1', statName: 'math', strandName: 'Algebra II & Functions', tier: 'Bridge', weight: 0.7, manifoldDimensions: { coherence: 0.6, fluidity: 0.5, gradient_awareness: 0.6 } },
  { standardCode: 'CCSS.MATH.CONTENT.6.EE.A.2', statName: 'math', strandName: 'Algebra II & Functions', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, gradient_awareness: 0.5 } },
  { standardCode: 'CCSS.MATH.CONTENT.7.RP.A.2', statName: 'math', strandName: 'Algebra II & Functions', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, gradient_awareness: 0.7 } },
  { standardCode: 'CCSS.MATH.CONTENT.7.EE.B.4', statName: 'math', strandName: 'Algebra II & Functions', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.6, fluidity: 0.5, gradient_awareness: 0.6 } },
  { standardCode: 'CCSS.MATH.CONTENT.8.F.A.1', statName: 'math', strandName: 'Pre-Calculus & Limits', tier: 'Bridge', weight: 0.7, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, gradient_awareness: 0.7 } },
  { standardCode: 'CCSS.MATH.CONTENT.8.G.A.1', statName: 'math', strandName: 'Geometry & Spatial Reasoning', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.7, generativity: 0.4 } },

  // Reading - Foundation
  { standardCode: 'CCSS.ELA-LITERACY.RL.K.1', statName: 'reading', strandName: 'Key Ideas & Details', tier: 'Foundation', weight: 1.0, manifoldDimensions: { coherence: 0.8, fluidity: 0.2, generativity: 0.1 } },
  { standardCode: 'CCSS.ELA-LITERACY.RL.1.2', statName: 'reading', strandName: 'Key Ideas & Details', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.3, generativity: 0.2 } },
  { standardCode: 'CCSS.ELA-LITERACY.RL.3.1', statName: 'reading', strandName: 'Key Ideas & Details', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.3, generativity: 0.2 } },
  { standardCode: 'CCSS.ELA-LITERACY.RL.4.4', statName: 'reading', strandName: 'Craft & Structure', tier: 'Foundation', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, elasticity: 0.4 } },
  { standardCode: 'CCSS.ELA-LITERACY.RI.5.8', statName: 'reading', strandName: 'Integration of Knowledge', tier: 'Bridge', weight: 0.7, manifoldDimensions: { coherence: 0.6, fluidity: 0.5, non_dual_resolution: 0.5 } },

  // Reading - Bridge
  { standardCode: 'CCSS.ELA-LITERACY.RL.6.1', statName: 'reading', strandName: 'Integration of Knowledge', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, non_dual_resolution: 0.6 } },
  { standardCode: 'CCSS.ELA-LITERACY.RL.7.2', statName: 'reading', strandName: 'Integration of Knowledge', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, non_dual_resolution: 0.7 } },
  { standardCode: 'CCSS.ELA-LITERACY.RI.8.6', statName: 'reading', strandName: 'Literary Theory & Criticism', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.5, fluidity: 0.6, elasticity: 0.7 } },

  // Writing - Foundation & Bridge
  { standardCode: 'CCSS.ELA-LITERACY.W.K.3', statName: 'writing', strandName: 'Organization & Purpose', tier: 'Foundation', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.3, generativity: 0.4 } },
  { standardCode: 'CCSS.ELA-LITERACY.W.3.1', statName: 'writing', strandName: 'Evidence & Elaboration', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.4, non_dual_resolution: 0.4 } },
  { standardCode: 'CCSS.ELA-LITERACY.W.5.2', statName: 'writing', strandName: 'Evidence & Elaboration', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, generativity: 0.4 } },
  { standardCode: 'CCSS.ELA-LITERACY.W.6.1', statName: 'writing', strandName: 'Rhetoric & Persuasion', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, non_dual_resolution: 0.7 } },
  { standardCode: 'CCSS.ELA-LITERACY.W.7.4', statName: 'writing', strandName: 'Rhetoric & Persuasion', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.6, generativity: 0.6 } },
  { standardCode: 'CCSS.ELA-LITERACY.W.8.7', statName: 'writing', strandName: 'Technical & Scientific Writing', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, generativity: 0.7 } },

  // Science (NGSS)
  { standardCode: 'K-PS2-1', statName: 'science', strandName: 'Physical Sciences (Newtonian)', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.3, generativity: 0.3 } },
  { standardCode: '1-LS1-1', statName: 'science', strandName: 'Life Sciences (Cellular)', tier: 'Foundation', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.4, generativity: 0.5 } },
  { standardCode: '3-PS2-1', statName: 'science', strandName: 'Physical Sciences (Newtonian)', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, gradient_awareness: 0.4 } },
  { standardCode: '4-ESS2-2', statName: 'science', strandName: 'Earth & Space Sciences', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, gradient_awareness: 0.5 } },
  { standardCode: '5-PS1-1', statName: 'science', strandName: 'Physical Sciences (Newtonian)', tier: 'Foundation', weight: 0.8, manifoldDimensions: { coherence: 0.6, fluidity: 0.5, generativity: 0.5 } },
  { standardCode: 'MS-PS1-1', statName: 'science', strandName: 'Organic Chemistry', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, generativity: 0.5 } },
  { standardCode: 'MS-LS1-2', statName: 'science', strandName: 'Genetics & Epigenetics', tier: 'Bridge', weight: 0.7, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, elasticity: 0.5 } },
  { standardCode: 'MS-ESS1-1', statName: 'science', strandName: 'Earth & Space Sciences', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.6, gradient_awareness: 0.5 } },

  // Social Studies (C3)
  { standardCode: 'C3.D2.Civ.1.K-2', statName: 'social_studies', strandName: 'Civics & Government', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.2, generativity: 0.2 } },
  { standardCode: 'C3.D2.His.1.3-5', statName: 'social_studies', strandName: 'History (World & US)', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, gradient_awareness: 0.4 } },
  { standardCode: 'C3.D2.Geo.2.3-5', statName: 'social_studies', strandName: 'Geography & Geopolitics', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, gradient_awareness: 0.4 } },
  { standardCode: 'C3.D2.Eco.1.3-5', statName: 'social_studies', strandName: 'Economics (Macro/Micro)', tier: 'Foundation', weight: 0.8, manifoldDimensions: { coherence: 0.6, fluidity: 0.5, gradient_awareness: 0.5 } },
  { standardCode: 'C3.D2.Civ.3.6-8', statName: 'social_studies', strandName: 'Civics & Government', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, non_dual_resolution: 0.5 } },
  { standardCode: 'C3.D2.His.2.6-8', statName: 'social_studies', strandName: 'History (World & US)', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, gradient_awareness: 0.6 } },
  { standardCode: 'C3.D2.Eco.3.6-8', statName: 'social_studies', strandName: 'Economics (Macro/Micro)', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.6, fluidity: 0.5, gradient_awareness: 0.6 } },

  // Financial Literacy
  { standardCode: 'HYRO.FL.K-2.1', statName: 'financial_literacy', strandName: 'Money Management', tier: 'Foundation', weight: 1.0, manifoldDimensions: { coherence: 0.9, fluidity: 0.2, generativity: 0.1 } },
  { standardCode: 'HYRO.FL.3-5.1', statName: 'financial_literacy', strandName: 'Income & Careers', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.3, generativity: 0.2 } },
  { standardCode: 'HYRO.FL.3-5.2', statName: 'financial_literacy', strandName: 'Money Management', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.4, generativity: 0.3 } },
  { standardCode: 'HYRO.FL.6-8.1', statName: 'financial_literacy', strandName: 'Investing & Risk', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.6, fluidity: 0.5, entropy_intuition: 0.6 } },
  { standardCode: 'HYRO.FL.6-8.2', statName: 'financial_literacy', strandName: 'Credit & Debt', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, gradient_awareness: 0.5 } },
  { standardCode: 'HYRO.FL.6-8.3', statName: 'financial_literacy', strandName: 'Investing & Risk', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.5, fluidity: 0.6, entropy_intuition: 0.8 } },

  // Coding (CSTA)
  { standardCode: 'CSTA.1A-CS-01', statName: 'coding', strandName: 'Algorithms & Logic', tier: 'Foundation', weight: 0.7, manifoldDimensions: { coherence: 0.8, fluidity: 0.3, generativity: 0.2 } },
  { standardCode: 'CSTA.1A-AP-10', statName: 'coding', strandName: 'Algorithms & Logic', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.4, generativity: 0.3 } },
  { standardCode: 'CSTA.1B-AP-10', statName: 'coding', strandName: 'Algorithms & Logic', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, generativity: 0.5 } },
  { standardCode: 'CSTA.1B-AP-11', statName: 'coding', strandName: 'Data Structures', tier: 'Foundation', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, generativity: 0.4 } },
  { standardCode: 'CSTA.2-AP-13', statName: 'coding', strandName: 'Systems & Architecture', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.6, generativity: 0.5 } },
  { standardCode: 'CSTA.2-AP-16', statName: 'coding', strandName: 'Systems & Architecture', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, generativity: 0.6 } },
  { standardCode: 'CSTA.2-DA-07', statName: 'coding', strandName: 'Data Structures', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.4, generativity: 0.4 } },

  // Study Skills
  { standardCode: 'HYRO.SS.K-2.1', statName: 'study_skills', strandName: 'Time Management', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.9, fluidity: 0.2, generativity: 0.1 } },
  { standardCode: 'HYRO.SS.3-5.1', statName: 'study_skills', strandName: 'Time Management', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.3, generativity: 0.2 } },
  { standardCode: 'HYRO.SS.3-5.2', statName: 'study_skills', strandName: 'Note Taking & Organization', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.4, generativity: 0.3 } },
  { standardCode: 'HYRO.SS.6-8.1', statName: 'study_skills', strandName: 'Test Taking Strategies', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, generativity: 0.4 } },
  { standardCode: 'HYRO.SS.6-8.2', statName: 'study_skills', strandName: 'Test Taking Strategies', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, generativity: 0.5 } },
  { standardCode: 'HYRO.SS.6-8.3', statName: 'study_skills', strandName: 'Metacognition', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, elasticity: 0.7 } },

  // Critical Thinking
  { standardCode: 'HYRO.CT.K-2.1', statName: 'critical_thinking', strandName: 'Analysis & Evaluation', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.3, generativity: 0.2 } },
  { standardCode: 'HYRO.CT.3-5.1', statName: 'critical_thinking', strandName: 'Analysis & Evaluation', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.4, generativity: 0.3 } },
  { standardCode: 'HYRO.CT.3-5.2', statName: 'critical_thinking', strandName: 'Problem Solving Heuristics', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, generativity: 0.4 } },
  { standardCode: 'HYRO.CT.6-8.1', statName: 'critical_thinking', strandName: 'Logic & Reasoning (Formal)', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.4, non_dual_resolution: 0.4 } },
  { standardCode: 'HYRO.CT.6-8.2', statName: 'critical_thinking', strandName: 'Logic & Reasoning (Formal)', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, elasticity: 0.5 } },
  { standardCode: 'HYRO.CT.6-8.3', statName: 'critical_thinking', strandName: 'Cognitive Bias Mitigation', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.5, fluidity: 0.6, elasticity: 0.8 } },

  // Technology (ISTE)
  { standardCode: 'ISTE.1a', statName: 'technology', strandName: 'Digital Literacy', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.4, generativity: 0.4 } },
  { standardCode: 'ISTE.2b', statName: 'technology', strandName: 'Digital Literacy', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.3, generativity: 0.3 } },
  { standardCode: 'ISTE.5a', statName: 'technology', strandName: 'Hardware & Systems', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, generativity: 0.5 } },
  { standardCode: 'ISTE.6b', statName: 'technology', strandName: 'Network & Security', tier: 'Bridge', weight: 0.8, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, generativity: 0.7 } },

  // Problem Solving
  { standardCode: 'HYRO.PS.K-2.1', statName: 'problem_solving', strandName: 'Problem Definition', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.8, fluidity: 0.3, generativity: 0.2 } },
  { standardCode: 'HYRO.PS.3-5.1', statName: 'problem_solving', strandName: 'Strategy Formulation', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.6, fluidity: 0.6, generativity: 0.5 } },
  { standardCode: 'HYRO.PS.3-5.2', statName: 'problem_solving', strandName: 'Evaluation & Reflection', tier: 'Foundation', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.4, elasticity: 0.4 } },
  { standardCode: 'HYRO.PS.6-8.1', statName: 'problem_solving', strandName: 'Problem Definition', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.6, generativity: 0.5 } },
  { standardCode: 'HYRO.PS.6-8.2', statName: 'problem_solving', strandName: 'Execution & Monitoring', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.7, fluidity: 0.5, generativity: 0.5 } },
  { standardCode: 'HYRO.PS.6-8.3', statName: 'problem_solving', strandName: 'Lateral Thinking', tier: 'Bridge', weight: 0.9, manifoldDimensions: { coherence: 0.5, fluidity: 0.7, generativity: 0.8 } },
];

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Get a standard by its code
 */
export function getStandardByCode(code: string): StandardCode | undefined {
  return STANDARDS_REGISTRY.find(s => s.code === code);
}

/**
 * Get all standards for a specific stat/strand/tier combination
 */
export function getStandardsForStrand(
  statName: StatName,
  strandName: string,
  tier?: StrandTier
): StandardCode[] {
  const mappings = STANDARD_STRAND_MAPPINGS.filter(m =>
    m.statName === statName &&
    m.strandName === strandName &&
    (tier === undefined || m.tier === tier)
  );

  const standardCodes = mappings.map(m => m.standardCode);
  return STANDARDS_REGISTRY.filter(s => standardCodes.includes(s.code));
}

/**
 * Reverse lookup: get strand info for a standard code
 */
export function getStrandForStandard(standardCode: string): StrandLookupResult | undefined {
  const mapping = STANDARD_STRAND_MAPPINGS.find(m => m.standardCode === standardCode);
  if (!mapping) return undefined;

  // Get the manifold focus from the blueprint
  const blueprint = ASSESSMENT_BLUEPRINTS[mapping.statName];
  const strand = blueprint?.strands.find(s => s.strand === mapping.strandName);

  return {
    stat: mapping.statName,
    strand: mapping.strandName,
    tier: mapping.tier,
    weight: mapping.weight,
    manifoldFocus: strand?.manifold_focus || 'coherence',
  };
}

/**
 * Get all standards for a specific stat
 */
export function getStandardsForStat(statName: StatName, tier?: StrandTier): StandardCode[] {
  const mappings = STANDARD_STRAND_MAPPINGS.filter(m =>
    m.statName === statName &&
    (tier === undefined || m.tier === tier)
  );

  const standardCodes = Array.from(new Set(mappings.map(m => m.standardCode)));
  return STANDARDS_REGISTRY.filter(s => standardCodes.includes(s.code));
}

/**
 * Get standards for a specific grade level
 */
export function getStandardsForGrade(grade: number, statName?: StatName): StandardCode[] {
  return STANDARDS_REGISTRY.filter(s => {
    const gradeMatch = s.grades.includes(grade);
    if (!statName) return gradeMatch;

    const mapping = STANDARD_STRAND_MAPPINGS.find(m => m.standardCode === s.code);
    return gradeMatch && mapping?.statName === statName;
  });
}

/**
 * Get standards by DOK level
 */
export function getStandardsByDOK(dokLevel: DOKLevel, statName?: StatName): StandardCode[] {
  return STANDARDS_REGISTRY.filter(s => {
    const dokMatch = s.dokLevel === dokLevel;
    if (!statName) return dokMatch;

    const mapping = STANDARD_STRAND_MAPPINGS.find(m => m.standardCode === s.code);
    return dokMatch && mapping?.statName === statName;
  });
}

/**
 * Search standards by keyword
 */
export function searchStandards(query: string, limit = 20): StandardCode[] {
  const lowerQuery = query.toLowerCase();

  return STANDARDS_REGISTRY
    .filter(s =>
      s.description.toLowerCase().includes(lowerQuery) ||
      s.shortTitle.toLowerCase().includes(lowerQuery) ||
      s.keywords.some(k => k.toLowerCase().includes(lowerQuery)) ||
      s.code.toLowerCase().includes(lowerQuery)
    )
    .slice(0, limit);
}

// =============================================================================
// COGNITIVE DEMAND FUNCTIONS
// =============================================================================

/**
 * Get the cognitive demand profile for a standard
 */
export function getCognitiveDemandProfile(standardCode: string): CognitiveDemandProfile | undefined {
  const standard = getStandardByCode(standardCode);
  if (!standard) return undefined;

  const dokProfile = DOK_PROFILES[standard.dokLevel];
  const bloomProfile = BLOOM_PROFILES[standard.bloomLevel];

  // Estimate time based on DOK and Bloom's level
  const baseMinutes = 2;
  const timeEstimate = Math.round(baseMinutes * dokProfile.typicalTimeMultiplier * (1 + (bloomProfile.level - 1) * 0.2));

  // Determine cognitive load type
  let cognitiveLoad: 'recall' | 'procedural' | 'conceptual' | 'transfer';
  if (standard.dokLevel === 1) {
    cognitiveLoad = 'recall';
  } else if (standard.dokLevel === 2) {
    cognitiveLoad = ['Apply', 'Understand'].includes(standard.bloomLevel) ? 'procedural' : 'conceptual';
  } else if (standard.dokLevel === 3) {
    cognitiveLoad = 'conceptual';
  } else {
    cognitiveLoad = 'transfer';
  }

  return {
    dokLevel: standard.dokLevel,
    dokDescription: dokProfile.description,
    bloomLevel: standard.bloomLevel,
    bloomVerbs: bloomProfile.verbs,
    manifoldProfile: dokProfile.manifoldProfile,
    cognitiveLoad,
    estimatedTimeMinutes: timeEstimate,
  };
}

/**
 * Map DOK level to manifold dimensions
 */
export function mapDOKToManifold(dokLevel: DOKLevel): Record<ManifoldDimension, number> {
  return DOK_PROFILES[dokLevel].manifoldProfile;
}

/**
 * Map Bloom's level to DOK range
 */
export function mapBloomToDOK(bloomLevel: BloomLevel): [DOKLevel, DOKLevel] {
  return BLOOM_PROFILES[bloomLevel].dokRange;
}

// =============================================================================
// PROMPT GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate a prompt that references specific standards
 */
export function generateStandardsPrompt(
  statName: StatName,
  strandName: string,
  tier: StrandTier,
  dokLevel?: DOKLevel
): string {
  const standards = getStandardsForStrand(statName, strandName, tier);

  // Filter by DOK level if specified
  const filteredStandards = dokLevel
    ? standards.filter(s => s.dokLevel === dokLevel)
    : standards;

  if (filteredStandards.length === 0) {
    return `Generate an assessment item for ${statName} - ${strandName} at the ${tier} level.`;
  }

  const standardsList = filteredStandards
    .slice(0, 3) // Limit to 3 standards for prompt brevity
    .map(s => `• ${s.code}: ${s.shortTitle}`)
    .join('\n');

  const dokInfo = dokLevel ? DOK_PROFILES[dokLevel] : null;
  const dokGuidance = dokInfo
    ? `\n\nTarget DOK Level ${dokLevel} (${dokInfo.name}): ${dokInfo.description}`
    : '';

  return `Generate an assessment item aligned to these standards:

${standardsList}

Subject: ${statName}
Strand: ${strandName}
Tier: ${tier}${dokGuidance}

The item should authentically assess the concepts in these standards.`;
}

/**
 * Generate a prompt for a specific standard
 */
export function generateStandardSpecificPrompt(standardCode: string): string | undefined {
  const standard = getStandardByCode(standardCode);
  if (!standard) return undefined;

  const cogProfile = getCognitiveDemandProfile(standardCode);
  const strandInfo = getStrandForStandard(standardCode);

  return `Generate an assessment item for:

Standard: ${standard.code}
Description: ${standard.description}

Grade Level(s): ${standard.grades.join(', ')}
Domain: ${standard.domain}
Cluster: ${standard.cluster}

Cognitive Demand:
• DOK Level ${cogProfile?.dokLevel}: ${cogProfile?.dokDescription}
• Bloom's Level: ${cogProfile?.bloomLevel}
• Suggested verbs: ${cogProfile?.bloomVerbs.slice(0, 4).join(', ')}

${strandInfo ? `HYRO Strand: ${strandInfo.strand} (${strandInfo.stat})` : ''}

Keywords: ${standard.keywords.join(', ')}`;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate that a generated question aligns with standard requirements
 */
export function validateQuestionAgainstStandard(
  questionText: string,
  standardCode: string
): StandardValidationResult {
  const standard = getStandardByCode(standardCode);

  if (!standard) {
    return {
      isValid: false,
      matchedStandards: [],
      suggestedStandards: [],
      coverageScore: 0,
      missingCoverage: ['Standard not found'],
      warnings: [`Standard code "${standardCode}" not found in registry`],
    };
  }

  const lowerQuestion = questionText.toLowerCase();
  const warnings: string[] = [];
  const missingCoverage: string[] = [];

  // Check for keyword coverage
  const matchedKeywords = standard.keywords.filter(k =>
    lowerQuestion.includes(k.toLowerCase())
  );
  const keywordCoverage = matchedKeywords.length / standard.keywords.length;

  // Check for verb alignment with DOK/Bloom
  const dokProfile = DOK_PROFILES[standard.dokLevel];
  const bloomProfile = BLOOM_PROFILES[standard.bloomLevel];
  const allVerbs = [...dokProfile.verbs, ...bloomProfile.verbs];
  const verbMatch = allVerbs.some(v => lowerQuestion.includes(v.toLowerCase()));

  if (!verbMatch) {
    warnings.push(`Question may not align with expected cognitive demand (DOK ${standard.dokLevel})`);
  }

  // Check for domain coverage
  const domainWords = standard.domain.toLowerCase().split(/\s+/);
  const domainMatch = domainWords.some(w => lowerQuestion.includes(w));

  if (!domainMatch) {
    missingCoverage.push(`Domain: ${standard.domain}`);
  }

  // Calculate overall coverage score
  let coverageScore = keywordCoverage * 0.5;
  coverageScore += verbMatch ? 0.25 : 0;
  coverageScore += domainMatch ? 0.25 : 0;

  // Find related standards that might also be covered
  const relatedMatches = STANDARDS_REGISTRY
    .filter(s => s.code !== standardCode)
    .filter(s => s.keywords.some(k => lowerQuestion.includes(k.toLowerCase())))
    .map(s => s.code)
    .slice(0, 3);

  return {
    isValid: coverageScore >= 0.5,
    matchedStandards: coverageScore >= 0.5 ? [standardCode, ...relatedMatches] : relatedMatches,
    suggestedStandards: relatedMatches,
    coverageScore,
    missingCoverage,
    warnings,
  };
}

/**
 * Get tier-appropriate standards for a student based on grade level
 */
export function getTierAppropriateStandards(
  gradeLevel: number,
  statName: StatName
): {
  current: StandardCode[];
  stretch: StandardCode[];
  remedial: StandardCode[];
} {
  const currentTier = GRADE_TO_TIER[gradeLevel] || 'Foundation';
  const tiers: StrandTier[] = ['Foundation', 'Bridge', 'Power', 'Horizon'];
  const tierIndex = tiers.indexOf(currentTier);

  const allStandards = getStandardsForStat(statName);

  // Standards at current tier
  const current = allStandards.filter(s => {
    const mapping = STANDARD_STRAND_MAPPINGS.find(m => m.standardCode === s.code);
    return mapping?.tier === currentTier && s.grades.includes(gradeLevel);
  });

  // Stretch standards (next tier up)
  const stretchTier = tierIndex < tiers.length - 1 ? tiers[tierIndex + 1] : currentTier;
  const stretch = allStandards.filter(s => {
    const mapping = STANDARD_STRAND_MAPPINGS.find(m => m.standardCode === s.code);
    return mapping?.tier === stretchTier;
  }).slice(0, 5);

  // Remedial standards (previous tier)
  const remedialTier = tierIndex > 0 ? tiers[tierIndex - 1] : currentTier;
  const remedial = allStandards.filter(s => {
    const mapping = STANDARD_STRAND_MAPPINGS.find(m => m.standardCode === s.code);
    return mapping?.tier === remedialTier;
  }).slice(0, 5);

  return { current, stretch, remedial };
}

// =============================================================================
// RE-EXPORTED FOR CONVENIENCE (already exported via const declarations)
// =============================================================================

// All constants are already exported via their declarations above.
// Functions exported: getStandardByCode, getStandardsForStrand, getStrandForStandard,
// getStandardsForStat, getStandardsForGrade, getStandardsByDOK, searchStandards,
// getCognitiveDemandProfile, mapDOKToManifold, mapBloomToDOK, generateStandardsPrompt,
// generateStandardSpecificPrompt, validateQuestionAgainstStandard, getTierAppropriateStandards
