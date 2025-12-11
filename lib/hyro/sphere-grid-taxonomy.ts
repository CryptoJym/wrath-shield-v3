/**
 * Sphere Grid Taxonomy System - Hyro Education System
 *
 * @hyro-domain competency_visualization
 * @hyro-manifold Hierarchical structure for sphere grid organization
 * @hyro-rationale Parent-child architecture for intuitive navigation and extension
 *
 * HIERARCHY STRUCTURE (Parent → Child):
 *
 *   ROOT (Center of Grid)
 *     └─ REALM (Major Learning Areas)
 *         └─ DOMAIN (Subject Areas)
 *             └─ CLUSTER (Skill Groups)
 *                 └─ STRAND (Learning Progressions)
 *                     └─ STANDARD (Individual Competencies)
 *                         └─ SUBSTANDARD (Component Skills)
 *
 * VISUAL MAPPING:
 * - Realm → Defines large angular sectors (pie slices)
 * - Domain → Subdivisions within sectors
 * - Cluster → Groups nodes at similar tiers
 * - Strand → Radial paths from inner to outer
 * - Standard → Individual nodes
 * - Substandard → Mini-nodes attached to standards
 *
 * This structure enables:
 * 1. Easy addition of new subjects (add Realm or Domain)
 * 2. Clear prerequisite chains (Strand connections)
 * 3. Visual grouping by relatedness (Cluster proximity)
 * 4. Pass-off requirements at any level
 */

// =============================================================================
// HIERARCHY LEVEL TYPES
// =============================================================================

/**
 * The top-level learning areas (major sections of the grid)
 * Each Realm gets a distinct angular sector and color family
 */
export interface SphereRealm {
  id: string;                    // e.g., "academic", "metacognitive", "life_skills"
  name: string;                  // Display name
  description: string;

  // Visual properties
  colorFamily: string;           // Base hue for this realm
  iconEmoji: string;             // Representative icon

  // Structure
  domains: string[];             // Domain IDs in this realm

  // Grid positioning
  startAngle: number;            // Starting angle (0 to 2π)
  angularWidth: number;          // Width in radians

  // Importance
  weight: number;                // Relative importance (affects size)

  // Metadata
  order: number;                 // Display order
  locked: boolean;               // Can be hidden initially
}

/**
 * Subject-level domains within a Realm
 * Maps to traditional subject areas
 */
export interface SphereDomain {
  id: string;                    // e.g., "math", "ela", "science"
  realmId: string;               // Parent realm
  name: string;
  description: string;

  // Visual properties
  primaryColor: string;          // Main color for this domain
  secondaryColor: string;        // Accent color
  iconEmoji: string;

  // Structure
  clusters: string[];            // Cluster IDs in this domain

  // Standards alignment
  standardsPrefix: string[];     // e.g., ["CCSS.MATH", "6.RP", "6.NS"]

  // Grid positioning (relative to realm)
  angularOffset: number;         // Offset from realm start
  angularWidth: number;          // Width within realm

  // Pass-off configuration
  passOffEnabled: boolean;       // Can students test out?
  passOffRequirements?: DomainPassOff;

  // Metadata
  order: number;
  gradeRange: [string, string];  // ["K", "12"] or ["6", "8"]
}

/**
 * Skill groupings within a Domain
 * Groups related standards that should be learned together
 */
export interface SphereCluster {
  id: string;                    // e.g., "ratios_proportions", "number_operations"
  domainId: string;              // Parent domain
  name: string;
  description: string;

  // Visual properties
  colorShade: 'light' | 'medium' | 'dark';  // Shade variation of domain color
  iconEmoji: string;

  // Structure
  strands: string[];             // Strand IDs in this cluster

  // Grid positioning
  tierRange: [number, number];   // [minTier, maxTier] e.g., [2, 4]
  angularOffset: number;         // Offset within domain
  angularWidth: number;

  // Learning properties
  complexity: 'foundational' | 'intermediate' | 'advanced';
  dokRange: [1, 2] | [2, 3] | [3, 4];

  // Pass-off configuration
  passOffEnabled: boolean;
  passOffRequirements?: ClusterPassOff;

  // Prerequisites
  prerequisiteClusters: string[];

  // Metadata
  order: number;
  gradeLevel: string;            // Primary grade level
}

/**
 * Learning progressions within a Cluster
 * Represents a vertical path through the grid (prerequisite chains)
 */
export interface SphereStrand {
  id: string;                    // e.g., "ratio_concepts", "unit_rates"
  clusterId: string;             // Parent cluster
  name: string;
  description: string;

  // Structure
  standards: string[];           // Ordered standard IDs (prerequisite order)

  // Grid positioning
  angle: number;                 // Fixed angle for this strand (radial line)
  startTier: number;             // Starting tier (closest to center)
  endTier: number;               // Ending tier (furthest from center)

  // Learning properties
  estimatedHours: number;        // Total time to complete strand
  assessmentType: 'continuous' | 'milestone' | 'gateway';

  // Prerequisites
  prerequisiteStrands: string[];

  // Pass-off
  passOffEnabled: boolean;
  passOffRequirements?: StrandPassOff;

  // Metadata
  order: number;
}

/**
 * Individual standards (nodes in the grid)
 * Already defined in sphere-grid-types.ts as SphereNode
 * This interface adds taxonomy-specific properties
 */
export interface StandardTaxonomy {
  standardId: string;            // Links to SphereNode.id
  strandId: string;              // Parent strand

  // Position in progression
  sequenceNumber: number;        // Order within strand (1, 2, 3...)

  // Relationships
  coRequisites: string[];        // Standards that should be learned together

  // Substandards
  substandards: SubstandardDef[];

  // Pass-off
  passOffEnabled: boolean;
  passOffWeight: number;         // Weight in parent pass-off (0-1)
  assessmentItemCount: number;   // Items needed for valid assessment
}

/**
 * Component skills within a standard
 * Represents fine-grained skills that compose a standard
 */
export interface SubstandardDef {
  id: string;                    // e.g., "6.RP.A.1.a"
  standardId: string;            // Parent standard
  name: string;
  description: string;

  // Visual properties (mini-node)
  position: 'top' | 'right' | 'bottom' | 'left';  // Relative to parent node
  size: 'tiny' | 'small';

  // Mastery
  weight: number;                // Contribution to parent standard (0-1)

  // Learning properties
  dokLevel: 1 | 2 | 3 | 4;
  estimatedMinutes: number;
}

// =============================================================================
// PASS-OFF REQUIREMENT TYPES
// =============================================================================

/**
 * Base pass-off requirements
 */
interface BasePassOff {
  minimumScore: number;          // 0-100 (typically 80)
  assessmentType: 'adaptive' | 'fixed' | 'portfolio';
  timeLimit?: number;            // Minutes
  retakePolicy: {
    waitDays: number;
    maxAttempts: number;
  };
  proctored: boolean;
}

/**
 * Domain-level pass-off (grade level test-out)
 */
export interface DomainPassOff extends BasePassOff {
  level: 'domain';
  requiredClusters: string[];    // All clusters must be passed
  minimumClusterScore: number;
  cumulativeScoreRequired: number;
  portfolioRequired: boolean;
}

/**
 * Cluster-level pass-off (skill group mastery)
 */
export interface ClusterPassOff extends BasePassOff {
  level: 'cluster';
  requiredStrands: string[];
  minimumStrandScore: number;
  keyStandards: string[];        // Must pass these specifically
}

/**
 * Strand-level pass-off (learning progression)
 */
export interface StrandPassOff extends BasePassOff {
  level: 'strand';
  requiredStandards: string[];
  minimumStandardScore: number;
  gatewayStandards: string[];    // Must pass before attempting pass-off
}

// =============================================================================
// TAXONOMY TREE STRUCTURE
// =============================================================================

/**
 * Complete taxonomy tree for a student's sphere grid
 */
export interface SphereTaxonomyTree {
  id: string;
  studentId: string;

  // Structure
  realms: Map<string, SphereRealm>;
  domains: Map<string, SphereDomain>;
  clusters: Map<string, SphereCluster>;
  strands: Map<string, SphereStrand>;
  standards: Map<string, StandardTaxonomy>;

  // Index maps for fast lookup
  realmToDomains: Map<string, string[]>;
  domainToClusters: Map<string, string[]>;
  clusterToStrands: Map<string, string[]>;
  strandToStandards: Map<string, string[]>;
  standardToSubstandards: Map<string, SubstandardDef[]>;

  // Reverse lookups
  standardToStrand: Map<string, string>;
  strandToCluster: Map<string, string>;
  clusterToDomain: Map<string, string>;
  domainToRealm: Map<string, string>;

  // Prerequisites graph
  prerequisiteGraph: PrerequisiteGraph;

  // Metadata
  generatedAt: Date;
  version: string;
}

/**
 * Prerequisite relationship graph
 */
export interface PrerequisiteGraph {
  // Direct prerequisites
  prerequisites: Map<string, string[]>;   // nodeId → prerequisite nodeIds

  // Reverse: what does this unlock
  unlocks: Map<string, string[]>;         // nodeId → unlocked nodeIds

  // Full transitive closure
  allPrerequisites: Map<string, Set<string>>;  // All ancestors
  allDependents: Map<string, Set<string>>;     // All descendants

  // Critical path analysis
  criticalPaths: Map<string, string[]>;   // nodeId → longest path to it

  // Topological order (valid learning sequence)
  topologicalOrder: string[];
}

// =============================================================================
// REALM DEFINITIONS (Pre-configured)
// =============================================================================

/**
 * Default realm configurations
 * These define the major sections of the sphere grid
 */
export const DEFAULT_REALMS: Record<string, Omit<SphereRealm, 'domains'>> = {
  academic_core: {
    id: 'academic_core',
    name: 'Academic Core',
    description: 'Traditional academic subjects: Math, ELA, Science, Social Studies',
    colorFamily: '#3b82f6',      // Blue family
    iconEmoji: '📚',
    startAngle: 0,
    angularWidth: Math.PI,       // Half the circle
    weight: 0.5,
    order: 1,
    locked: false,
  },
  metacognitive: {
    id: 'metacognitive',
    name: 'Metacognitive Skills',
    description: 'Learning how to learn: Study skills, self-regulation, reflection',
    colorFamily: '#8b5cf6',      // Purple family
    iconEmoji: '🧠',
    startAngle: Math.PI,
    angularWidth: Math.PI / 3,
    weight: 0.2,
    order: 2,
    locked: false,
  },
  critical_reasoning: {
    id: 'critical_reasoning',
    name: 'Critical Reasoning',
    description: 'Decision making, pattern recognition, logical analysis',
    colorFamily: '#ec4899',      // Pink family
    iconEmoji: '🎯',
    startAngle: Math.PI + Math.PI / 3,
    angularWidth: Math.PI / 3,
    weight: 0.2,
    order: 3,
    locked: false,
  },
  applied_knowledge: {
    id: 'applied_knowledge',
    name: 'Applied Knowledge',
    description: 'Real-world application: Projects, portfolios, demonstrations',
    colorFamily: '#f59e0b',      // Amber family
    iconEmoji: '🔧',
    startAngle: Math.PI + 2 * Math.PI / 3,
    angularWidth: Math.PI / 3,
    weight: 0.1,
    order: 4,
    locked: true,               // Unlock after academic progress
  },
};

/**
 * Default domain configurations within realms
 */
export const DEFAULT_DOMAINS: Record<string, Omit<SphereDomain, 'clusters'>> = {
  // Academic Core
  math: {
    id: 'math',
    realmId: 'academic_core',
    name: 'Mathematics',
    description: 'Numbers, operations, algebra, geometry, statistics',
    primaryColor: '#3b82f6',
    secondaryColor: '#60a5fa',
    iconEmoji: '🔢',
    standardsPrefix: ['CCSS.MATH', 'CC.', '*.RP', '*.NS', '*.EE', '*.G', '*.SP'],
    angularOffset: 0,
    angularWidth: Math.PI / 4,
    passOffEnabled: true,
    order: 1,
    gradeRange: ['K', '12'],
  },
  ela: {
    id: 'ela',
    realmId: 'academic_core',
    name: 'English Language Arts',
    description: 'Reading, writing, speaking, listening, language',
    primaryColor: '#22c55e',
    secondaryColor: '#4ade80',
    iconEmoji: '📖',
    standardsPrefix: ['CCSS.ELA', 'RL.', 'RI.', 'W.', 'SL.', 'L.'],
    angularOffset: Math.PI / 4,
    angularWidth: Math.PI / 4,
    passOffEnabled: true,
    order: 2,
    gradeRange: ['K', '12'],
  },
  science: {
    id: 'science',
    realmId: 'academic_core',
    name: 'Science',
    description: 'Life science, physical science, earth science, engineering',
    primaryColor: '#a855f7',
    secondaryColor: '#c084fc',
    iconEmoji: '🔬',
    standardsPrefix: ['NGSS', 'LS.', 'PS.', 'ESS.', 'ETS.'],
    angularOffset: Math.PI / 2,
    angularWidth: Math.PI / 4,
    passOffEnabled: true,
    order: 3,
    gradeRange: ['K', '12'],
  },
  social_studies: {
    id: 'social_studies',
    realmId: 'academic_core',
    name: 'Social Studies',
    description: 'History, geography, civics, economics',
    primaryColor: '#f59e0b',
    secondaryColor: '#fbbf24',
    iconEmoji: '🌍',
    standardsPrefix: ['SS.', 'C3.', 'D1.', 'D2.', 'D3.', 'D4.'],
    angularOffset: 3 * Math.PI / 4,
    angularWidth: Math.PI / 4,
    passOffEnabled: true,
    order: 4,
    gradeRange: ['K', '12'],
  },

  // Metacognitive Skills
  meta_learning: {
    id: 'meta_learning',
    realmId: 'metacognitive',
    name: 'Meta-Learning',
    description: 'Understanding how you learn best',
    primaryColor: '#8b5cf6',
    secondaryColor: '#a78bfa',
    iconEmoji: '🔄',
    standardsPrefix: ['ML.'],
    angularOffset: 0,
    angularWidth: Math.PI / 6,
    passOffEnabled: true,
    order: 1,
    gradeRange: ['3', '12'],
  },
  neuroscience: {
    id: 'neuroscience',
    realmId: 'metacognitive',
    name: 'Neuroscience of Learning',
    description: 'Brain science foundations for effective learning',
    primaryColor: '#06b6d4',
    secondaryColor: '#22d3ee',
    iconEmoji: '🧬',
    standardsPrefix: ['NS.'],
    angularOffset: Math.PI / 6,
    angularWidth: Math.PI / 6,
    passOffEnabled: true,
    order: 2,
    gradeRange: ['4', '12'],
  },

  // Critical Reasoning
  decision_making: {
    id: 'decision_making',
    realmId: 'critical_reasoning',
    name: 'Decision Making',
    description: 'WRAP framework, cognitive biases, rational choice',
    primaryColor: '#f97316',
    secondaryColor: '#fb923c',
    iconEmoji: '⚖️',
    standardsPrefix: ['DM.', 'CT.DF.'],
    angularOffset: 0,
    angularWidth: Math.PI / 6,
    passOffEnabled: true,
    order: 1,
    gradeRange: ['5', '12'],
  },
  pattern_recognition: {
    id: 'pattern_recognition',
    realmId: 'critical_reasoning',
    name: 'Pattern Recognition',
    description: 'Cross-domain patterns, Medici Effect, analogical thinking',
    primaryColor: '#ec4899',
    secondaryColor: '#f472b6',
    iconEmoji: '🔮',
    standardsPrefix: ['PR.', 'CT.PR.'],
    angularOffset: Math.PI / 6,
    angularWidth: Math.PI / 6,
    passOffEnabled: true,
    order: 2,
    gradeRange: ['5', '12'],
  },
};

// =============================================================================
// CLUSTER TEMPLATES
// =============================================================================

/**
 * Math cluster templates (example for one subject)
 */
export const MATH_CLUSTER_TEMPLATES: Record<string, Omit<SphereCluster, 'strands'>> = {
  // Grade 6 clusters
  ratios_proportions: {
    id: 'ratios_proportions',
    domainId: 'math',
    name: 'Ratios & Proportional Relationships',
    description: 'Understanding and applying ratio concepts',
    colorShade: 'medium',
    iconEmoji: '📊',
    tierRange: [1, 3],
    angularOffset: 0,
    angularWidth: Math.PI / 16,
    complexity: 'intermediate',
    dokRange: [2, 3],
    passOffEnabled: true,
    prerequisiteClusters: [],
    order: 1,
    gradeLevel: '6',
  },
  number_system: {
    id: 'number_system',
    domainId: 'math',
    name: 'The Number System',
    description: 'Multi-digit operations and rational numbers',
    colorShade: 'light',
    iconEmoji: '🔢',
    tierRange: [1, 4],
    angularOffset: Math.PI / 16,
    angularWidth: Math.PI / 16,
    complexity: 'foundational',
    dokRange: [1, 2],
    passOffEnabled: true,
    prerequisiteClusters: [],
    order: 2,
    gradeLevel: '6',
  },
  expressions_equations: {
    id: 'expressions_equations',
    domainId: 'math',
    name: 'Expressions & Equations',
    description: 'Writing and solving algebraic expressions',
    colorShade: 'dark',
    iconEmoji: '📐',
    tierRange: [2, 5],
    angularOffset: 2 * Math.PI / 16,
    angularWidth: Math.PI / 16,
    complexity: 'intermediate',
    dokRange: [2, 3],
    passOffEnabled: true,
    prerequisiteClusters: ['number_system'],
    order: 3,
    gradeLevel: '6',
  },
  geometry_6: {
    id: 'geometry_6',
    domainId: 'math',
    name: 'Geometry',
    description: 'Area, surface area, and volume',
    colorShade: 'medium',
    iconEmoji: '📐',
    tierRange: [2, 4],
    angularOffset: 3 * Math.PI / 16,
    angularWidth: Math.PI / 16,
    complexity: 'intermediate',
    dokRange: [2, 3],
    passOffEnabled: true,
    prerequisiteClusters: ['number_system'],
    order: 4,
    gradeLevel: '6',
  },
  statistics_probability: {
    id: 'statistics_probability',
    domainId: 'math',
    name: 'Statistics & Probability',
    description: 'Data analysis and statistical reasoning',
    colorShade: 'light',
    iconEmoji: '📈',
    tierRange: [3, 5],
    angularOffset: 4 * Math.PI / 16,
    angularWidth: Math.PI / 16,
    complexity: 'advanced',
    dokRange: [3, 4],
    passOffEnabled: true,
    prerequisiteClusters: ['ratios_proportions', 'number_system'],
    order: 5,
    gradeLevel: '6',
  },
};

// =============================================================================
// TAXONOMY BUILDER FUNCTIONS
// =============================================================================

/**
 * Build complete taxonomy tree from configuration
 */
export function buildTaxonomyTree(
  studentId: string,
  realms: Map<string, SphereRealm>,
  domains: Map<string, SphereDomain>,
  clusters: Map<string, SphereCluster>,
  strands: Map<string, SphereStrand>,
  standards: Map<string, StandardTaxonomy>
): SphereTaxonomyTree {
  // Build index maps
  const realmToDomains = new Map<string, string[]>();
  const domainToClusters = new Map<string, string[]>();
  const clusterToStrands = new Map<string, string[]>();
  const strandToStandards = new Map<string, string[]>();
  const standardToSubstandards = new Map<string, SubstandardDef[]>();

  // Build reverse lookups
  const standardToStrand = new Map<string, string>();
  const strandToCluster = new Map<string, string>();
  const clusterToDomain = new Map<string, string>();
  const domainToRealm = new Map<string, string>();

  // Populate indexes
  for (const [domainId, domain] of domains) {
    domainToRealm.set(domainId, domain.realmId);
    const existingDomains = realmToDomains.get(domain.realmId) || [];
    existingDomains.push(domainId);
    realmToDomains.set(domain.realmId, existingDomains);
  }

  for (const [clusterId, cluster] of clusters) {
    clusterToDomain.set(clusterId, cluster.domainId);
    const existingClusters = domainToClusters.get(cluster.domainId) || [];
    existingClusters.push(clusterId);
    domainToClusters.set(cluster.domainId, existingClusters);
  }

  for (const [strandId, strand] of strands) {
    strandToCluster.set(strandId, strand.clusterId);
    const existingStrands = clusterToStrands.get(strand.clusterId) || [];
    existingStrands.push(strandId);
    clusterToStrands.set(strand.clusterId, existingStrands);
    strandToStandards.set(strandId, strand.standards);
  }

  for (const [standardId, standard] of standards) {
    standardToStrand.set(standardId, standard.strandId);
    if (standard.substandards?.length > 0) {
      standardToSubstandards.set(standardId, standard.substandards);
    }
  }

  // Build prerequisite graph
  const prerequisiteGraph = buildPrerequisiteGraph(standards, strands, clusters);

  return {
    id: `taxonomy-${studentId}-${Date.now()}`,
    studentId,
    realms,
    domains,
    clusters,
    strands,
    standards,
    realmToDomains,
    domainToClusters,
    clusterToStrands,
    strandToStandards,
    standardToSubstandards,
    standardToStrand,
    strandToCluster,
    clusterToDomain,
    domainToRealm,
    prerequisiteGraph,
    generatedAt: new Date(),
    version: '1.0.0',
  };
}

/**
 * Build prerequisite graph from standards and strands
 */
function buildPrerequisiteGraph(
  standards: Map<string, StandardTaxonomy>,
  strands: Map<string, SphereStrand>,
  clusters: Map<string, SphereCluster>
): PrerequisiteGraph {
  const prerequisites = new Map<string, string[]>();
  const unlocks = new Map<string, string[]>();
  const allPrerequisites = new Map<string, Set<string>>();
  const allDependents = new Map<string, Set<string>>();

  // Build direct prerequisites from strand order
  for (const [strandId, strand] of strands) {
    const strandStandards = strand.standards;
    for (let i = 0; i < strandStandards.length; i++) {
      const standardId = strandStandards[i];

      // Previous standard in strand is a prerequisite
      if (i > 0) {
        const prereqs = prerequisites.get(standardId) || [];
        prereqs.push(strandStandards[i - 1]);
        prerequisites.set(standardId, prereqs);

        // Reverse: previous unlocks current
        const unlocked = unlocks.get(strandStandards[i - 1]) || [];
        unlocked.push(standardId);
        unlocks.set(strandStandards[i - 1], unlocked);
      }
    }

    // Add cross-strand prerequisites from standard corequisites
    for (const standardId of strandStandards) {
      const standard = standards.get(standardId);
      if (standard?.coRequisites) {
        const prereqs = prerequisites.get(standardId) || [];
        prereqs.push(...standard.coRequisites);
        prerequisites.set(standardId, prereqs);
      }
    }
  }

  // Add cluster-level prerequisites
  for (const [clusterId, cluster] of clusters) {
    for (const prereqClusterId of cluster.prerequisiteClusters) {
      const prereqCluster = clusters.get(prereqClusterId);
      const currentClusterStrands = cluster.strands;

      if (prereqCluster) {
        // Last standards of prereq cluster unlock first standards of current cluster
        for (const prereqStrandId of prereqCluster.strands) {
          const prereqStrand = strands.get(prereqStrandId);
          if (prereqStrand && prereqStrand.standards.length > 0) {
            const lastPrereqStandard = prereqStrand.standards[prereqStrand.standards.length - 1];

            for (const currentStrandId of currentClusterStrands) {
              const currentStrand = strands.get(currentStrandId);
              if (currentStrand && currentStrand.standards.length > 0) {
                const firstCurrentStandard = currentStrand.standards[0];

                const prereqs = prerequisites.get(firstCurrentStandard) || [];
                if (!prereqs.includes(lastPrereqStandard)) {
                  prereqs.push(lastPrereqStandard);
                  prerequisites.set(firstCurrentStandard, prereqs);
                }
              }
            }
          }
        }
      }
    }
  }

  // Build transitive closures
  function getAllAncestors(nodeId: string, visited: Set<string> = new Set()): Set<string> {
    if (visited.has(nodeId)) return new Set();
    visited.add(nodeId);

    const ancestors = new Set<string>();
    const directPrereqs = prerequisites.get(nodeId) || [];

    for (const prereq of directPrereqs) {
      ancestors.add(prereq);
      const prereqAncestors = getAllAncestors(prereq, visited);
      for (const ancestor of prereqAncestors) {
        ancestors.add(ancestor);
      }
    }

    return ancestors;
  }

  // Calculate all prerequisites for each standard
  for (const standardId of standards.keys()) {
    allPrerequisites.set(standardId, getAllAncestors(standardId));
  }

  // Calculate all dependents (reverse of all prerequisites)
  for (const [standardId, ancestors] of allPrerequisites) {
    for (const ancestor of ancestors) {
      const deps = allDependents.get(ancestor) || new Set();
      deps.add(standardId);
      allDependents.set(ancestor, deps);
    }
  }

  // Build topological order using Kahn's algorithm
  const topologicalOrder = buildTopologicalOrder(prerequisites, standards);

  // Find critical paths
  const criticalPaths = buildCriticalPaths(prerequisites, standards);

  return {
    prerequisites,
    unlocks,
    allPrerequisites,
    allDependents,
    criticalPaths,
    topologicalOrder,
  };
}

/**
 * Build topological order using Kahn's algorithm
 */
function buildTopologicalOrder(
  prerequisites: Map<string, string[]>,
  standards: Map<string, StandardTaxonomy>
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const standardId of standards.keys()) {
    inDegree.set(standardId, 0);
    adjacency.set(standardId, []);
  }

  // Build adjacency and count in-degrees
  for (const [nodeId, prereqs] of prerequisites) {
    inDegree.set(nodeId, prereqs.length);
    for (const prereq of prereqs) {
      const adj = adjacency.get(prereq) || [];
      adj.push(nodeId);
      adjacency.set(prereq, adj);
    }
  }

  // Find all nodes with no prerequisites
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  // Process queue
  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    const neighbors = adjacency.get(node) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return result;
}

/**
 * Build critical (longest) paths to each node
 */
function buildCriticalPaths(
  prerequisites: Map<string, string[]>,
  standards: Map<string, StandardTaxonomy>
): Map<string, string[]> {
  const criticalPaths = new Map<string, string[]>();
  const memo = new Map<string, string[]>();

  function findLongestPath(nodeId: string): string[] {
    if (memo.has(nodeId)) return memo.get(nodeId)!;

    const prereqs = prerequisites.get(nodeId) || [];
    if (prereqs.length === 0) {
      memo.set(nodeId, [nodeId]);
      return [nodeId];
    }

    let longestPrereqPath: string[] = [];
    for (const prereq of prereqs) {
      const path = findLongestPath(prereq);
      if (path.length > longestPrereqPath.length) {
        longestPrereqPath = path;
      }
    }

    const fullPath = [...longestPrereqPath, nodeId];
    memo.set(nodeId, fullPath);
    return fullPath;
  }

  for (const standardId of standards.keys()) {
    criticalPaths.set(standardId, findLongestPath(standardId));
  }

  return criticalPaths;
}

// =============================================================================
// HIERARCHY NAVIGATION HELPERS
// =============================================================================

/**
 * Get the full hierarchy path for a standard
 */
export function getHierarchyPath(
  standardId: string,
  tree: SphereTaxonomyTree
): {
  realm: SphereRealm;
  domain: SphereDomain;
  cluster: SphereCluster;
  strand: SphereStrand;
  standard: StandardTaxonomy;
} | null {
  const standard = tree.standards.get(standardId);
  if (!standard) return null;

  const strandId = tree.standardToStrand.get(standardId);
  if (!strandId) return null;

  const strand = tree.strands.get(strandId);
  if (!strand) return null;

  const clusterId = tree.strandToCluster.get(strandId);
  if (!clusterId) return null;

  const cluster = tree.clusters.get(clusterId);
  if (!cluster) return null;

  const domainId = tree.clusterToDomain.get(clusterId);
  if (!domainId) return null;

  const domain = tree.domains.get(domainId);
  if (!domain) return null;

  const realmId = tree.domainToRealm.get(domainId);
  if (!realmId) return null;

  const realm = tree.realms.get(realmId);
  if (!realm) return null;

  return { realm, domain, cluster, strand, standard };
}

/**
 * Get all standards in a cluster
 */
export function getClusterStandards(
  clusterId: string,
  tree: SphereTaxonomyTree
): string[] {
  const strands = tree.clusterToStrands.get(clusterId) || [];
  const standards: string[] = [];

  for (const strandId of strands) {
    const strandStandards = tree.strandToStandards.get(strandId) || [];
    standards.push(...strandStandards);
  }

  return standards;
}

/**
 * Get all standards in a domain
 */
export function getDomainStandards(
  domainId: string,
  tree: SphereTaxonomyTree
): string[] {
  const clusters = tree.domainToClusters.get(domainId) || [];
  const standards: string[] = [];

  for (const clusterId of clusters) {
    standards.push(...getClusterStandards(clusterId, tree));
  }

  return standards;
}

/**
 * Get all standards in a realm
 */
export function getRealmStandards(
  realmId: string,
  tree: SphereTaxonomyTree
): string[] {
  const domains = tree.realmToDomains.get(realmId) || [];
  const standards: string[] = [];

  for (const domainId of domains) {
    standards.push(...getDomainStandards(domainId, tree));
  }

  return standards;
}

/**
 * Calculate grid position based on taxonomy hierarchy
 */
export function calculateTaxonomyPosition(
  standardId: string,
  tree: SphereTaxonomyTree,
  gridConfig: { centerX: number; centerY: number; maxRadius: number; ringCount: number }
): { x: number; y: number; tier: number; angle: number } | null {
  const hierarchy = getHierarchyPath(standardId, tree);
  if (!hierarchy) return null;

  const { realm, domain, cluster, strand, standard } = hierarchy;

  // Calculate angle based on hierarchy
  const realmAngle = realm.startAngle + (domain.angularOffset / Math.PI) * realm.angularWidth;
  const domainAngle = realmAngle + (cluster.angularOffset / Math.PI) * domain.angularWidth;
  const clusterAngle = domainAngle + (strand.angle / Math.PI) * cluster.angularWidth;

  // Calculate tier based on strand position
  const strandProgress = standard.sequenceNumber / strand.standards.length;
  const tier = Math.floor(strand.startTier + strandProgress * (strand.endTier - strand.startTier));

  // Calculate x, y
  const ringSpacing = gridConfig.maxRadius / gridConfig.ringCount;
  const radius = (tier + 1) * ringSpacing;
  const x = gridConfig.centerX + radius * Math.cos(clusterAngle);
  const y = gridConfig.centerY + radius * Math.sin(clusterAngle);

  return { x, y, tier, angle: clusterAngle };
}

export default {
  DEFAULT_REALMS,
  DEFAULT_DOMAINS,
  MATH_CLUSTER_TEMPLATES,
  buildTaxonomyTree,
  getHierarchyPath,
  getClusterStandards,
  getDomainStandards,
  getRealmStandards,
  calculateTaxonomyPosition,
};
