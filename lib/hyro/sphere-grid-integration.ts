/**
 * Sphere Grid Integration Layer - Hyro Education System
 *
 * @hyro-domain competency_visualization
 * @hyro-manifold Connects taxonomy, curriculum data, and visualization
 *
 * PURPOSE:
 * This module integrates the hierarchical taxonomy system with:
 * - Existing curriculum data (Common Core, NGSS, etc.)
 * - Student mastery data
 * - Test-out confidence system
 * - Sphere grid visualization
 *
 * It transforms raw educational data into the visual sphere grid structure.
 */

import type {
  SphereNode,
  SphereGrid,
  NodeConnection,
  GridSector,
  GridRing,
  NodeState,
  NodeAnimation,
  NodeSize,
  GridTier,
  SphereSubject,
  SphereGridConfig,
} from './sphere-grid-types';
import { DEFAULT_GRID_CONFIG, DEFAULT_SPHERE_COLORS } from './sphere-grid-types';
import type {
  SphereTaxonomyTree,
  SphereRealm,
  SphereDomain,
  SphereCluster,
  SphereStrand,
  StandardTaxonomy,
  PrerequisiteGraph,
} from './sphere-grid-taxonomy';
import {
  DEFAULT_REALMS,
  DEFAULT_DOMAINS,
  buildTaxonomyTree,
  getHierarchyPath,
  calculateTaxonomyPosition,
} from './sphere-grid-taxonomy';
import type { Standard, StandardMastery } from './education-store';
import type { TestOutConfidence } from './testout-confidence-types';

// =============================================================================
// INTEGRATION TYPES
// =============================================================================

/**
 * Input data for grid generation from curriculum sources
 */
export interface CurriculumSource {
  standards: Standard[];
  masteryData: Map<string, StandardMastery>;
  testOutData: Map<string, TestOutConfidence>;
}

/**
 * Mapping from curriculum standard IDs to sphere grid nodes
 */
export interface StandardMapping {
  curriculumId: string;        // Original standard ID (e.g., "CCSS.MATH.6.RP.A.1")
  sphereNodeId: string;        // Sphere grid node ID
  subject: SphereSubject;
  domainId: string;
  clusterId: string;
  strandId: string;
}

/**
 * Grade band configuration for vertical organization
 */
export interface GradeBand {
  id: string;
  name: string;
  grades: string[];
  tierRange: [number, number];
  colorMultiplier: number;     // Adjust color intensity
}

// =============================================================================
// DEFAULT GRADE BANDS
// =============================================================================

export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { id: 'k-2', name: 'Early Elementary', grades: ['K', '1', '2'], tierRange: [0, 2], colorMultiplier: 0.7 },
  { id: '3-5', name: 'Late Elementary', grades: ['3', '4', '5'], tierRange: [2, 4], colorMultiplier: 0.85 },
  { id: '6-8', name: 'Middle School', grades: ['6', '7', '8'], tierRange: [3, 6], colorMultiplier: 1.0 },
  { id: '9-12', name: 'High School', grades: ['9', '10', '11', '12'], tierRange: [5, 8], colorMultiplier: 1.1 },
];

// =============================================================================
// STANDARD TO SPHERE MAPPING
// =============================================================================

/**
 * Parse a Common Core standard ID into components
 */
export function parseStandardId(standardId: string): {
  subject: SphereSubject;
  grade: string;
  domain: string;
  cluster?: string;
  standard?: string;
  substandard?: string;
} | null {
  // Common Core Math: CCSS.MATH.6.RP.A.1
  // Pattern: [PREFIX].[GRADE].[DOMAIN].[CLUSTER].[STANDARD]
  const mathMatch = standardId.match(/(?:CCSS\.)?(?:MATH\.)?(\d+|K)\.([A-Z]+)\.([A-Z])\.(\d+)(?:\.([a-z]))?/i);
  if (mathMatch) {
    return {
      subject: 'math',
      grade: mathMatch[1],
      domain: mathMatch[2],
      cluster: mathMatch[3],
      standard: mathMatch[4],
      substandard: mathMatch[5],
    };
  }

  // Simpler math: 6.RP.A.1
  const simpleMathMatch = standardId.match(/^(\d+|K)\.([A-Z]+)\.([A-Z])\.(\d+)(?:\.([a-z]))?$/i);
  if (simpleMathMatch) {
    return {
      subject: 'math',
      grade: simpleMathMatch[1],
      domain: simpleMathMatch[2],
      cluster: simpleMathMatch[3],
      standard: simpleMathMatch[4],
      substandard: simpleMathMatch[5],
    };
  }

  // ELA: CCSS.ELA-LITERACY.RL.6.1
  const elaMatch = standardId.match(/(?:CCSS\.)?(?:ELA[.-]?(?:LITERACY)?\.)?([A-Z]+)\.(\d+|K)\.(\d+)(?:\.([a-z]))?/i);
  if (elaMatch) {
    return {
      subject: 'ela',
      grade: elaMatch[2],
      domain: elaMatch[1],
      standard: elaMatch[3],
      substandard: elaMatch[4],
    };
  }

  // NGSS: HS-PS1-1, MS-LS1-1, 5-ESS1-1
  const ngssMatch = standardId.match(/(?:(K|HS|\d+|MS)-)?([A-Z]+\d+)-(\d+)/i);
  if (ngssMatch) {
    const gradeMap: Record<string, string> = { 'K': 'K', 'MS': '6', 'HS': '9' };
    return {
      subject: 'science',
      grade: ngssMatch[1] ? (gradeMap[ngssMatch[1]] || ngssMatch[1]) : 'K',
      domain: ngssMatch[2],
      standard: ngssMatch[3],
    };
  }

  // Custom curriculum standards (CT.DF.1, NS.LTM.2, etc.)
  const customMatch = standardId.match(/^([A-Z]+)\.([A-Z]+)\.(\d+)(?:\.(\d+))?$/i);
  if (customMatch) {
    const subjectMap: Record<string, SphereSubject> = {
      'CT': 'critical_thinking',
      'DF': 'decision_making',
      'NS': 'neuroscience',
      'PR': 'pattern_recognition',
      'ML': 'meta_learning',
      'DM': 'decision_making',
    };
    return {
      subject: subjectMap[customMatch[1]] || 'critical_thinking',
      grade: '6', // Default grade for custom standards
      domain: customMatch[2],
      standard: customMatch[3],
      substandard: customMatch[4],
    };
  }

  return null;
}

/**
 * Map a curriculum standard to sphere subject
 */
export function mapToSphereSubject(standard: Standard): SphereSubject {
  const parsed = parseStandardId(standard.id);
  if (parsed) return parsed.subject;

  // Fallback to category-based mapping
  const category = (standard.category || '').toLowerCase();

  if (category.includes('math')) return 'math';
  if (category.includes('ela') || category.includes('reading') || category.includes('writing')) return 'ela';
  if (category.includes('science')) return 'science';
  if (category.includes('social')) return 'social_studies';
  if (category.includes('critical') || category.includes('thinking')) return 'critical_thinking';
  if (category.includes('neuro')) return 'neuroscience';
  if (category.includes('decision')) return 'decision_making';
  if (category.includes('pattern')) return 'pattern_recognition';
  if (category.includes('meta') || category.includes('learning')) return 'meta_learning';

  return 'math'; // Default
}

// =============================================================================
// NODE STATE CALCULATION
// =============================================================================

/**
 * Determine node state from mastery and test-out data
 */
export function calculateNodeState(
  mastery: StandardMastery | undefined,
  testOut: TestOutConfidence | undefined,
  prerequisitesMet: boolean
): NodeState {
  // Locked if prerequisites not met
  if (!prerequisitesMet) return 'locked';

  // No mastery data = available
  if (!mastery || mastery.mastery_level < 10) return 'available';

  // Check test-out status first
  if (testOut) {
    if (testOut.confidenceCategory === 'recommend_now') return 'test_ready';
    if (mastery.status === 'mastered') {
      // Check if they've actually passed the test
      if (mastery.mastery_level >= 95) return 'legendary';
      return 'mastered';
    }
  }

  // Determine based on mastery level
  if (mastery.mastery_level >= 95) return 'legendary';
  if (mastery.mastery_level >= 85) return 'mastered';
  if (mastery.mastery_level >= 70) return 'approaching';
  if (mastery.mastery_level >= 30) return 'in_progress';

  return 'available';
}

/**
 * Determine animation based on node state and confidence
 */
export function calculateAnimation(
  state: NodeState,
  testOutConfidence?: number
): NodeAnimation {
  switch (state) {
    case 'locked':
      return 'none';
    case 'available':
      return 'none';
    case 'in_progress':
      return 'pulse';
    case 'approaching':
      return testOutConfidence && testOutConfidence > 70 ? 'glow' : 'pulse';
    case 'mastered':
      return 'glow';
    case 'test_ready':
      return 'beacon';
    case 'tested_passed':
      return 'complete';
    case 'legendary':
      return 'sparkle';
    default:
      return 'none';
  }
}

/**
 * Calculate node size based on standard importance
 */
export function calculateNodeSize(
  standard: Standard,
  dokLevel: number,
  isCore: boolean
): NodeSize {
  if (isCore) return 'core';
  if (dokLevel >= 4) return 'large';
  if (dokLevel >= 2) return 'medium';
  return 'small';
}

// =============================================================================
// GRID GENERATION FROM CURRICULUM
// =============================================================================

/**
 * Generate sphere grid from curriculum data
 */
export function generateGridFromCurriculum(
  studentId: string,
  source: CurriculumSource,
  config: Partial<SphereGridConfig> = {}
): SphereGrid {
  const fullConfig: SphereGridConfig = { ...DEFAULT_GRID_CONFIG, ...config };
  const colors = fullConfig.colors;

  const centerX = fullConfig.width / 2;
  const centerY = fullConfig.height / 2;
  const maxRadius = Math.min(fullConfig.width, fullConfig.height) / 2 - fullConfig.padding;
  const ringSpacing = maxRadius / fullConfig.ringCount;

  // Group standards by subject and domain
  const bySubject = groupBySubject(source.standards);
  const byDomain = groupByDomain(source.standards);

  // Build nodes
  const nodes = new Map<string, SphereNode>();
  const connections: NodeConnection[] = [];
  const sectors: GridSector[] = [];
  const rings: GridRing[] = [];

  // Initialize rings
  for (let i = 0; i < fullConfig.ringCount; i++) {
    rings.push({
      tier: i as GridTier,
      radius: (i + 1) * ringSpacing,
      nodes: [],
    });
  }

  // Calculate angular allocation per subject
  const subjectCount = Object.keys(bySubject).length;
  const angularWidthPerSubject = (2 * Math.PI) / Math.max(subjectCount, 1);

  let currentAngle = 0;

  // Process each subject
  for (const [subject, standards] of Object.entries(bySubject)) {
    const sphereSubject = subject as SphereSubject;
    const subjectColor = colors[sphereSubject] || colors.math;

    // Group by domain within subject
    const subjectDomains = new Map<string, Standard[]>();
    for (const std of standards) {
      const parsed = parseStandardId(std.id);
      const domainKey = parsed?.domain || std.domain || 'general';
      const existing = subjectDomains.get(domainKey) || [];
      existing.push(std);
      subjectDomains.set(domainKey, existing);
    }

    // Calculate angular width per domain
    const domainCount = subjectDomains.size;
    const angularWidthPerDomain = angularWidthPerSubject / Math.max(domainCount, 1);

    let domainAngle = currentAngle;

    // Process each domain
    for (const [domain, domainStandards] of subjectDomains) {
      // Sort by grade and prerequisites for tier assignment
      const sortedStandards = sortByPrerequisiteDepth(domainStandards, source.standards);

      // Position nodes
      const angleStep = angularWidthPerDomain / Math.max(sortedStandards.length, 1);

      for (let i = 0; i < sortedStandards.length; i++) {
        const std = sortedStandards[i];
        const mastery = source.masteryData.get(std.id);
        const testOut = source.testOutData.get(std.id);

        // Calculate tier based on prerequisite depth
        const prereqDepth = calculatePrerequisiteDepth(std.id, source.standards);
        const tier = Math.min(fullConfig.ringCount - 1, prereqDepth) as GridTier;

        // Check if prerequisites are met
        const prerequisitesMet = checkPrerequisitesMet(
          std.id,
          source.standards,
          source.masteryData
        );

        // Calculate state and animation
        const state = calculateNodeState(mastery, testOut, prerequisitesMet);
        const animation = calculateAnimation(state, testOut?.confidenceScore);

        // Calculate position
        const nodeAngle = domainAngle + i * angleStep;
        const radius = (tier + 1) * ringSpacing;
        const x = centerX + radius * Math.cos(nodeAngle);
        const y = centerY + radius * Math.sin(nodeAngle);

        // Determine DOK level
        const dokLevel = inferDOKLevel(std);
        const isCore = isCoreStandard(std);

        // Create node
        const node: SphereNode = {
          id: std.id,
          name: std.description.slice(0, 50),
          description: std.description,
          subject: sphereSubject,
          gradeLevel: extractGradeLevel(std),
          domain,
          cluster: std.cluster,
          tier,
          angle: nodeAngle,
          x,
          y,
          size: calculateNodeSize(std, dokLevel, isCore),
          state,
          animation,
          prerequisites: std.prerequisites || [],
          unlocks: findUnlocks(std.id, source.standards),
          mastery: {
            score: mastery?.mastery_level || 0,
            level: mastery?.status || 'not_started',
            assessmentCount: mastery?.evidence_count || 0,
            lastAssessedAt: mastery?.last_practiced_at
              ? new Date(mastery.last_practiced_at * 1000)
              : null,
            trend: mastery?.trend as 'improving' | 'stable' | 'declining' || 'stable',
          },
          testOutConfidence: {
            score: testOut?.confidenceScore || 0,
            category: testOut?.confidenceCategory || 'not_ready',
            nextRecommendedDate: testOut?.recommendation?.targetDate || null,
          },
          isCore,
          dokLevel: dokLevel as 1 | 2 | 3 | 4,
          estimatedMinutes: dokLevel * 15,
        };

        nodes.set(std.id, node);
        rings[tier].nodes.push(std.id);

        // Add connections for prerequisites
        for (const prereqId of std.prerequisites || []) {
          const prereqNode = nodes.get(prereqId);
          const connectionState = getConnectionState(
            prereqNode?.state || 'locked',
            state
          );

          connections.push({
            from: prereqId,
            to: std.id,
            strength: 0.8,
            state: connectionState,
            animated: connectionState === 'active',
          });
        }
      }

      domainAngle += angularWidthPerDomain;
    }

    // Create sector for this subject
    sectors.push({
      id: sphereSubject,
      name: getSubjectDisplayName(sphereSubject),
      subject: sphereSubject,
      startAngle: currentAngle,
      endAngle: currentAngle + angularWidthPerSubject,
      color: subjectColor,
      gradientColors: [subjectColor, `${subjectColor}80`],
      nodes: standards.map((s) => s.id),
    });

    currentAngle += angularWidthPerSubject;
  }

  // Calculate statistics
  const nodesArray = Array.from(nodes.values());
  const stats = {
    totalNodes: nodesArray.length,
    masteredNodes: nodesArray.filter((n) =>
      ['mastered', 'tested_passed', 'legendary'].includes(n.state)
    ).length,
    inProgressNodes: nodesArray.filter((n) => n.state === 'in_progress').length,
    availableNodes: nodesArray.filter((n) => n.state === 'available').length,
    lockedNodes: nodesArray.filter((n) => n.state === 'locked').length,
    testReadyNodes: nodesArray.filter((n) => n.state === 'test_ready').length,
    completionPercent: Math.round(
      (nodesArray.filter((n) =>
        ['mastered', 'tested_passed', 'legendary'].includes(n.state)
      ).length /
        nodesArray.length) *
        100
    ),
  };

  return {
    id: `grid-${studentId}-${Date.now()}`,
    studentId,
    name: 'Competency Sphere Grid',
    description: 'Visual map of learning progression',
    centerX,
    centerY,
    maxRadius,
    nodes,
    connections,
    sectors,
    rings,
    stats,
    generatedAt: new Date(),
    lastUpdatedAt: new Date(),
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Group standards by sphere subject
 */
function groupBySubject(standards: Standard[]): Record<string, Standard[]> {
  const result: Record<string, Standard[]> = {};

  for (const std of standards) {
    const subject = mapToSphereSubject(std);
    if (!result[subject]) {
      result[subject] = [];
    }
    result[subject].push(std);
  }

  return result;
}

/**
 * Group standards by domain
 */
function groupByDomain(standards: Standard[]): Record<string, Standard[]> {
  const result: Record<string, Standard[]> = {};

  for (const std of standards) {
    const domain = std.domain || 'general';
    if (!result[domain]) {
      result[domain] = [];
    }
    result[domain].push(std);
  }

  return result;
}

/**
 * Sort standards by prerequisite depth (topological sort)
 */
function sortByPrerequisiteDepth(
  standards: Standard[],
  allStandards: Standard[]
): Standard[] {
  const standardMap = new Map<string, Standard>();
  for (const std of allStandards) {
    standardMap.set(std.id, std);
  }

  const depths = new Map<string, number>();

  function getDepth(id: string, visited: Set<string> = new Set()): number {
    if (depths.has(id)) return depths.get(id)!;
    if (visited.has(id)) return 0; // Cycle detected
    visited.add(id);

    const std = standardMap.get(id);
    if (!std || !std.prerequisites || std.prerequisites.length === 0) {
      depths.set(id, 0);
      return 0;
    }

    let maxDepth = 0;
    for (const prereq of std.prerequisites) {
      maxDepth = Math.max(maxDepth, getDepth(prereq, visited) + 1);
    }

    depths.set(id, maxDepth);
    return maxDepth;
  }

  for (const std of standards) {
    getDepth(std.id);
  }

  return [...standards].sort((a, b) => {
    const depthA = depths.get(a.id) || 0;
    const depthB = depths.get(b.id) || 0;
    return depthA - depthB;
  });
}

/**
 * Calculate prerequisite depth for a standard
 */
function calculatePrerequisiteDepth(
  standardId: string,
  allStandards: Standard[]
): number {
  const standardMap = new Map<string, Standard>();
  for (const std of allStandards) {
    standardMap.set(std.id, std);
  }

  function getDepth(id: string, visited: Set<string> = new Set()): number {
    if (visited.has(id)) return 0;
    visited.add(id);

    const std = standardMap.get(id);
    if (!std || !std.prerequisites || std.prerequisites.length === 0) {
      return 0;
    }

    let maxDepth = 0;
    for (const prereq of std.prerequisites) {
      maxDepth = Math.max(maxDepth, getDepth(prereq, visited) + 1);
    }

    return maxDepth;
  }

  return getDepth(standardId);
}

/**
 * Check if all prerequisites are met
 */
function checkPrerequisitesMet(
  standardId: string,
  allStandards: Standard[],
  masteryData: Map<string, StandardMastery>
): boolean {
  const standardMap = new Map<string, Standard>();
  for (const std of allStandards) {
    standardMap.set(std.id, std);
  }

  const std = standardMap.get(standardId);
  if (!std || !std.prerequisites || std.prerequisites.length === 0) {
    return true;
  }

  for (const prereqId of std.prerequisites) {
    const mastery = masteryData.get(prereqId);
    if (!mastery || mastery.mastery_level < 70) {
      return false;
    }
  }

  return true;
}

/**
 * Find standards that this standard unlocks
 */
function findUnlocks(standardId: string, allStandards: Standard[]): string[] {
  const unlocks: string[] = [];

  for (const std of allStandards) {
    if (std.prerequisites?.includes(standardId)) {
      unlocks.push(std.id);
    }
  }

  return unlocks;
}

/**
 * Infer DOK level from standard description
 */
function inferDOKLevel(standard: Standard): number {
  const desc = standard.description.toLowerCase();

  // DOK 4: Create, design, prove, synthesize
  if (
    desc.includes('create') ||
    desc.includes('design') ||
    desc.includes('prove') ||
    desc.includes('synthesize')
  ) {
    return 4;
  }

  // DOK 3: Analyze, evaluate, investigate
  if (
    desc.includes('analyze') ||
    desc.includes('evaluate') ||
    desc.includes('investigate') ||
    desc.includes('explain why')
  ) {
    return 3;
  }

  // DOK 2: Apply, solve, compare
  if (
    desc.includes('apply') ||
    desc.includes('solve') ||
    desc.includes('compare') ||
    desc.includes('classify')
  ) {
    return 2;
  }

  // DOK 1: Recall, identify, define
  return 1;
}

/**
 * Check if standard is a core/power standard
 */
function isCoreStandard(standard: Standard): boolean {
  // Core standards are typically:
  // - Math: Anything with letters in the cluster (e.g., 6.RP.A.1)
  // - Higher DOK levels
  // - Marked as priority in metadata

  if ((standard as unknown as { priority?: boolean }).priority) return true;

  const parsed = parseStandardId(standard.id);
  if (parsed?.cluster) return true;

  const dok = inferDOKLevel(standard);
  return dok >= 3;
}

/**
 * Extract grade level from standard
 */
function extractGradeLevel(standard: Standard): string {
  const parsed = parseStandardId(standard.id);
  if (parsed?.grade) return parsed.grade;

  // Try to extract from category or domain
  const match = (standard.category || standard.domain || '').match(/(\d+|K)/i);
  return match ? match[1] : '6';
}

/**
 * Get connection state based on node states
 */
function getConnectionState(
  fromState: NodeState,
  toState: NodeState
): 'locked' | 'unlocked' | 'active' | 'completed' {
  if (fromState === 'locked' || toState === 'locked') {
    return 'locked';
  }

  const masteredStates: NodeState[] = ['mastered', 'tested_passed', 'legendary'];

  if (masteredStates.includes(fromState) && masteredStates.includes(toState)) {
    return 'completed';
  }

  if (masteredStates.includes(fromState) && !masteredStates.includes(toState)) {
    return 'active';
  }

  return 'unlocked';
}

/**
 * Get display name for sphere subject
 */
function getSubjectDisplayName(subject: SphereSubject): string {
  const names: Record<SphereSubject, string> = {
    math: 'Mathematics',
    ela: 'English Language Arts',
    science: 'Science',
    social_studies: 'Social Studies',
    critical_thinking: 'Critical Thinking',
    neuroscience: 'Neuroscience',
    decision_making: 'Decision Making',
    pattern_recognition: 'Pattern Recognition',
    meta_learning: 'Meta-Learning',
  };
  return names[subject] || subject;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  parseStandardId,
  mapToSphereSubject,
  calculateNodeState,
  calculateAnimation,
  calculateNodeSize,
  generateGridFromCurriculum,
  DEFAULT_GRADE_BANDS,
};
