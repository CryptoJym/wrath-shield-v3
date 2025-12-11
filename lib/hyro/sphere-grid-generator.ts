/**
 * Sphere Grid Generator - Hyro Education System
 *
 * @hyro-domain competency_visualization
 * @hyro-manifold Generates sphere grid from standards and mastery data
 *
 * This module transforms curriculum standards and student mastery data
 * into a visual sphere grid structure for the FFX-inspired visualization.
 */

import type {
  SphereNode,
  SphereGrid,
  SphereSubject,
  NodeState,
  NodeAnimation,
  NodeSize,
  GridTier,
  NodeConnection,
  GridSector,
  GridRing,
  SphereGridConfig,
  GridProgressSnapshot,
} from './sphere-grid-types';
import { DEFAULT_GRID_CONFIG } from './sphere-grid-types';

// =============================================================================
// TYPES
// =============================================================================

interface StandardData {
  id: string;
  description: string;
  domain?: string;
  cluster?: string;
  prerequisites?: string[];
  dokLevel?: number;
}

interface DomainData {
  id: string;
  name: string;
  standards: StandardData[];
}

interface CurriculumData {
  grade: string;
  subject: string;
  domains: DomainData[];
}

interface MasteryData {
  standardId: string;
  score: number;
  level: 'not_started' | 'developing' | 'proficient' | 'mastered';
  assessmentCount: number;
  lastAssessedAt: Date | null;
  trend: 'improving' | 'stable' | 'declining';
}

interface TestOutData {
  standardId: string;
  confidence: number;
  category: 'not_ready' | 'needs_prep' | 'likely_ready' | 'recommend_now';
  nextRecommendedDate: Date | null;
}

interface GeneratorInput {
  studentId: string;
  curriculumData: CurriculumData[];
  masteryData: Map<string, MasteryData>;
  testOutData: Map<string, TestOutData>;
  config?: Partial<SphereGridConfig>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map subject string to SphereSubject type
 */
function mapSubject(subject: string): SphereSubject {
  const subjectMap: Record<string, SphereSubject> = {
    'mathematics': 'math',
    'math': 'math',
    'english language arts': 'ela',
    'ela': 'ela',
    'reading': 'ela',
    'writing': 'ela',
    'science': 'science',
    'social studies': 'social_studies',
    'history': 'social_studies',
    'critical thinking': 'critical_thinking',
    'neuroscience': 'neuroscience',
    'decision making': 'decision_making',
    'pattern recognition': 'pattern_recognition',
    'meta-learning': 'meta_learning',
    'meta learning': 'meta_learning',
  };
  return subjectMap[subject.toLowerCase()] || 'math';
}

/**
 * Determine node state based on mastery and test-out data
 */
function determineNodeState(
  mastery: MasteryData | undefined,
  testOut: TestOutData | undefined,
  prerequisitesMet: boolean
): NodeState {
  if (!prerequisitesMet) return 'locked';

  if (!mastery || mastery.level === 'not_started') return 'available';

  if (testOut?.category === 'recommend_now') return 'test_ready';

  if (mastery.level === 'mastered') {
    if (mastery.score >= 95) return 'legendary';
    return 'mastered';
  }

  if (mastery.level === 'proficient') {
    if (mastery.score >= 85) return 'mastered';
    return 'approaching';
  }

  if (mastery.level === 'developing') {
    return 'in_progress';
  }

  return 'available';
}

/**
 * Determine animation based on node state
 */
function determineAnimation(state: NodeState): NodeAnimation {
  switch (state) {
    case 'in_progress': return 'pulse';
    case 'mastered': return 'glow';
    case 'test_ready': return 'beacon';
    case 'legendary': return 'sparkle';
    case 'tested_passed': return 'complete';
    default: return 'none';
  }
}

/**
 * Calculate tier based on prerequisite depth
 */
function calculateTier(
  standardId: string,
  prerequisites: Map<string, string[]>,
  visited: Set<string> = new Set()
): GridTier {
  if (visited.has(standardId)) return 0 as GridTier; // Prevent cycles
  visited.add(standardId);

  const prereqs = prerequisites.get(standardId) || [];
  if (prereqs.length === 0) return 0 as GridTier;

  let maxDepth = 0;
  for (const prereq of prereqs) {
    const depth = calculateTier(prereq, prerequisites, visited);
    maxDepth = Math.max(maxDepth, depth + 1);
  }

  return Math.min(8, maxDepth) as GridTier;
}

/**
 * Determine node size based on DOK level and core status
 */
function determineNodeSize(dokLevel: number, isCore: boolean): NodeSize {
  if (isCore) return 'core';
  if (dokLevel >= 4) return 'large';
  if (dokLevel >= 2) return 'medium';
  return 'small';
}

/**
 * Calculate position on the grid
 */
function calculatePosition(
  tier: GridTier,
  angleOffset: number,
  nodesInRing: number,
  nodeIndex: number,
  centerX: number,
  centerY: number,
  ringSpacing: number
): { x: number; y: number; angle: number } {
  const radius = (tier + 1) * ringSpacing;
  const angleStep = (2 * Math.PI) / nodesInRing;
  const angle = angleOffset + (nodeIndex * angleStep);

  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
    angle,
  };
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Generate a sphere grid from curriculum and mastery data
 */
export function generateSphereGrid(input: GeneratorInput): SphereGrid {
  const {
    studentId,
    curriculumData,
    masteryData,
    testOutData,
    config: configOverrides,
  } = input;

  const config: SphereGridConfig = {
    ...DEFAULT_GRID_CONFIG,
    ...configOverrides,
  };

  const centerX = config.width / 2;
  const centerY = config.height / 2;
  const maxRadius = Math.min(config.width, config.height) / 2 - config.padding;
  const ringSpacing = maxRadius / config.ringCount;

  // Build prerequisite map
  const prerequisites = new Map<string, string[]>();
  const allStandards: Array<{
    standard: StandardData;
    subject: SphereSubject;
    gradeLevel: string;
    domain: string;
    cluster?: string;
  }> = [];

  for (const curriculum of curriculumData) {
    const subject = mapSubject(curriculum.subject);

    for (const domain of curriculum.domains) {
      for (const standard of domain.standards) {
        prerequisites.set(standard.id, standard.prerequisites || []);
        allStandards.push({
          standard,
          subject,
          gradeLevel: curriculum.grade,
          domain: domain.name,
          cluster: standard.cluster,
        });
      }
    }
  }

  // Calculate tiers for all standards
  const tierMap = new Map<string, GridTier>();
  for (const { standard } of allStandards) {
    tierMap.set(standard.id, calculateTier(standard.id, prerequisites));
  }

  // Group by tier for positioning
  const byTier = new Map<GridTier, typeof allStandards>();
  for (const item of allStandards) {
    const tier = tierMap.get(item.standard.id) || (0 as GridTier);
    if (!byTier.has(tier)) {
      byTier.set(tier, []);
    }
    byTier.get(tier)!.push(item);
  }

  // Build nodes
  const nodes = new Map<string, SphereNode>();
  const connections: NodeConnection[] = [];
  const sectors: GridSector[] = [];
  const rings: GridRing[] = [];

  // Create nodes with positions
  for (const [tier, items] of byTier) {
    const ringNodes: string[] = [];

    // Sort by subject for better visual grouping
    items.sort((a, b) => a.subject.localeCompare(b.subject));

    for (let i = 0; i < items.length; i++) {
      const { standard, subject, gradeLevel, domain, cluster } = items[i];

      const mastery = masteryData.get(standard.id);
      const testOut = testOutData.get(standard.id);

      // Check if prerequisites are met
      const prereqs = prerequisites.get(standard.id) || [];
      const prerequisitesMet = prereqs.length === 0 || prereqs.every(prereqId => {
        const prereqMastery = masteryData.get(prereqId);
        return prereqMastery && prereqMastery.score >= 70;
      });

      const state = determineNodeState(mastery, testOut, prerequisitesMet);
      const animation = determineAnimation(state);
      const dokLevel = (standard.dokLevel || 2) as 1 | 2 | 3 | 4;
      const isCore = dokLevel >= 3;
      const size = determineNodeSize(dokLevel, isCore);

      // Calculate position with some jitter for visual interest
      const { x, y, angle } = calculatePosition(
        tier,
        (Math.PI * 2 * i) / items.length,
        items.length,
        i,
        centerX,
        centerY,
        ringSpacing
      );

      const node: SphereNode = {
        id: standard.id,
        name: standard.description.slice(0, 50),
        description: standard.description,
        subject,
        gradeLevel,
        domain,
        cluster,
        tier,
        angle,
        x,
        y,
        size,
        state,
        animation,
        prerequisites: prereqs,
        unlocks: [],
        mastery: {
          score: mastery?.score || 0,
          level: mastery?.level || 'not_started',
          assessmentCount: mastery?.assessmentCount || 0,
          lastAssessedAt: mastery?.lastAssessedAt || null,
          trend: mastery?.trend || 'stable',
        },
        testOutConfidence: {
          score: testOut?.confidence || 0,
          category: testOut?.category || 'not_ready',
          nextRecommendedDate: testOut?.nextRecommendedDate || null,
        },
        isCore,
        dokLevel,
        estimatedMinutes: dokLevel * 15,
      };

      nodes.set(standard.id, node);
      ringNodes.push(standard.id);
    }

    // Add ring
    rings.push({
      tier,
      radius: (tier + 1) * ringSpacing,
      nodes: ringNodes,
      label: `Tier ${tier}`,
    });
  }

  // Build unlocks (reverse of prerequisites)
  for (const [nodeId, prereqs] of prerequisites) {
    for (const prereqId of prereqs) {
      const prereqNode = nodes.get(prereqId);
      if (prereqNode && !prereqNode.unlocks.includes(nodeId)) {
        prereqNode.unlocks.push(nodeId);
      }
    }
  }

  // Build connections
  for (const [nodeId, prereqs] of prerequisites) {
    const node = nodes.get(nodeId);
    if (!node) continue;

    for (const prereqId of prereqs) {
      const prereqNode = nodes.get(prereqId);
      if (!prereqNode) continue;

      // Determine connection state
      let connectionState: 'locked' | 'unlocked' | 'active' | 'completed' = 'locked';
      if (prereqNode.state === 'mastered' || prereqNode.state === 'tested_passed' || prereqNode.state === 'legendary') {
        if (node.state === 'mastered' || node.state === 'tested_passed' || node.state === 'legendary') {
          connectionState = 'completed';
        } else if (node.state !== 'locked') {
          connectionState = 'active';
        } else {
          connectionState = 'unlocked';
        }
      }

      connections.push({
        from: prereqId,
        to: nodeId,
        strength: 0.7,
        state: connectionState,
        animated: connectionState === 'active',
      });
    }
  }

  // Build sectors (group by subject)
  const subjectGroups = new Map<SphereSubject, string[]>();
  for (const [nodeId, node] of nodes) {
    if (!subjectGroups.has(node.subject)) {
      subjectGroups.set(node.subject, []);
    }
    subjectGroups.get(node.subject)!.push(nodeId);
  }

  const subjectColors = config.colors;
  let sectorAngle = 0;
  for (const [subject, nodeIds] of subjectGroups) {
    const angleSpan = (2 * Math.PI * nodeIds.length) / nodes.size;

    sectors.push({
      id: subject,
      name: subject.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      subject,
      startAngle: sectorAngle,
      endAngle: sectorAngle + angleSpan,
      color: subjectColors[subject],
      gradientColors: [subjectColors[subject], `${subjectColors[subject]}80`],
      nodes: nodeIds,
    });

    sectorAngle += angleSpan;
  }

  // Calculate stats
  const nodesArray = Array.from(nodes.values());
  const stats = {
    totalNodes: nodesArray.length,
    masteredNodes: nodesArray.filter(n =>
      n.state === 'mastered' || n.state === 'tested_passed' || n.state === 'legendary'
    ).length,
    inProgressNodes: nodesArray.filter(n => n.state === 'in_progress').length,
    availableNodes: nodesArray.filter(n => n.state === 'available').length,
    lockedNodes: nodesArray.filter(n => n.state === 'locked').length,
    testReadyNodes: nodesArray.filter(n => n.state === 'test_ready').length,
    completionPercent: Math.round(
      (nodesArray.filter(n =>
        n.state === 'mastered' || n.state === 'tested_passed' || n.state === 'legendary'
      ).length / nodesArray.length) * 100
    ),
  };

  return {
    id: `grid-${studentId}-${Date.now()}`,
    studentId,
    name: 'Competency Sphere Grid',
    description: 'FFX-style visualization of learning progression',
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

/**
 * Generate a progress snapshot for the current state
 */
export function generateProgressSnapshot(
  grid: SphereGrid
): GridProgressSnapshot {
  const nodesArray = Array.from(grid.nodes.values());

  // By subject
  const bySubject: Record<SphereSubject, { total: number; mastered: number; percent: number }> = {} as Record<SphereSubject, { total: number; mastered: number; percent: number }>;
  const subjects: SphereSubject[] = [
    'math', 'ela', 'science', 'social_studies', 'critical_thinking',
    'neuroscience', 'decision_making', 'pattern_recognition', 'meta_learning'
  ];

  for (const subject of subjects) {
    const subjectNodes = nodesArray.filter(n => n.subject === subject);
    const masteredCount = subjectNodes.filter(n =>
      n.state === 'mastered' || n.state === 'tested_passed' || n.state === 'legendary'
    ).length;

    bySubject[subject] = {
      total: subjectNodes.length,
      mastered: masteredCount,
      percent: subjectNodes.length > 0 ? Math.round((masteredCount / subjectNodes.length) * 100) : 0,
    };
  }

  // By grade
  const gradeSet = new Set(nodesArray.map(n => n.gradeLevel));
  const byGrade: Record<string, { total: number; mastered: number; percent: number }> = {};

  for (const grade of gradeSet) {
    const gradeNodes = nodesArray.filter(n => n.gradeLevel === grade);
    const masteredCount = gradeNodes.filter(n =>
      n.state === 'mastered' || n.state === 'tested_passed' || n.state === 'legendary'
    ).length;

    byGrade[grade] = {
      total: gradeNodes.length,
      mastered: masteredCount,
      percent: gradeNodes.length > 0 ? Math.round((masteredCount / gradeNodes.length) * 100) : 0,
    };
  }

  // Test-ready nodes
  const testReadyNodes = nodesArray
    .filter(n => n.state === 'test_ready')
    .map(n => n.id);

  return {
    studentId: grid.studentId,
    timestamp: new Date(),
    totalNodes: grid.stats.totalNodes,
    masteredNodes: grid.stats.masteredNodes,
    completionPercent: grid.stats.completionPercent,
    bySubject,
    byGrade,
    recentMasteries: [],
    testReadyCount: testReadyNodes.length,
    testReadyNodes,
  };
}

/**
 * Create a demo grid with sample data
 */
export function createDemoGrid(studentId: string = 'demo-student'): SphereGrid {
  // Sample curriculum data
  const sampleCurriculum: CurriculumData[] = [
    {
      grade: '6',
      subject: 'Mathematics',
      domains: [
        {
          id: 'RP',
          name: 'Ratios & Proportional Relationships',
          standards: [
            { id: '6.RP.A.1', description: 'Understand the concept of a ratio and use ratio language', prerequisites: [] },
            { id: '6.RP.A.2', description: 'Understand unit rate concepts', prerequisites: ['6.RP.A.1'] },
            { id: '6.RP.A.3', description: 'Use ratio and rate reasoning to solve problems', prerequisites: ['6.RP.A.1', '6.RP.A.2'] },
          ],
        },
        {
          id: 'NS',
          name: 'The Number System',
          standards: [
            { id: '6.NS.A.1', description: 'Interpret and compute quotients of fractions', prerequisites: [] },
            { id: '6.NS.B.2', description: 'Fluently divide multi-digit numbers', prerequisites: [] },
            { id: '6.NS.B.3', description: 'Fluently add, subtract, multiply, and divide decimals', prerequisites: ['6.NS.B.2'] },
            { id: '6.NS.C.5', description: 'Understand positive and negative numbers', prerequisites: [] },
            { id: '6.NS.C.6', description: 'Understand a rational number as a point on the number line', prerequisites: ['6.NS.C.5'] },
          ],
        },
        {
          id: 'EE',
          name: 'Expressions & Equations',
          standards: [
            { id: '6.EE.A.1', description: 'Write and evaluate numerical expressions involving exponents', prerequisites: [] },
            { id: '6.EE.A.2', description: 'Write, read, and evaluate expressions with letters', prerequisites: ['6.EE.A.1'] },
            { id: '6.EE.B.5', description: 'Understand solving an equation or inequality', prerequisites: ['6.EE.A.2'] },
            { id: '6.EE.B.7', description: 'Solve real-world and mathematical problems', prerequisites: ['6.EE.B.5'] },
          ],
        },
      ],
    },
    {
      grade: '6',
      subject: 'Critical Thinking',
      domains: [
        {
          id: 'DF',
          name: 'Decision Framework',
          standards: [
            { id: 'CT.DF.1', description: 'WRAP Framework: Widen options before deciding', prerequisites: [], dokLevel: 3 },
            { id: 'CT.DF.2', description: 'Reality-test assumptions with experiments', prerequisites: ['CT.DF.1'], dokLevel: 3 },
            { id: 'CT.DF.3', description: 'Attain distance before final decisions', prerequisites: ['CT.DF.1'], dokLevel: 3 },
            { id: 'CT.DF.4', description: 'Prepare to be wrong with pre-mortems', prerequisites: ['CT.DF.2', 'CT.DF.3'], dokLevel: 4 },
          ],
        },
      ],
    },
  ];

  // Sample mastery data
  const masteryData = new Map<string, MasteryData>();
  masteryData.set('6.RP.A.1', { standardId: '6.RP.A.1', score: 92, level: 'mastered', assessmentCount: 5, lastAssessedAt: new Date(), trend: 'stable' });
  masteryData.set('6.RP.A.2', { standardId: '6.RP.A.2', score: 78, level: 'proficient', assessmentCount: 3, lastAssessedAt: new Date(), trend: 'improving' });
  masteryData.set('6.NS.A.1', { standardId: '6.NS.A.1', score: 88, level: 'mastered', assessmentCount: 4, lastAssessedAt: new Date(), trend: 'stable' });
  masteryData.set('6.NS.B.2', { standardId: '6.NS.B.2', score: 95, level: 'mastered', assessmentCount: 6, lastAssessedAt: new Date(), trend: 'stable' });
  masteryData.set('6.NS.C.5', { standardId: '6.NS.C.5', score: 65, level: 'developing', assessmentCount: 2, lastAssessedAt: new Date(), trend: 'improving' });
  masteryData.set('6.EE.A.1', { standardId: '6.EE.A.1', score: 72, level: 'proficient', assessmentCount: 3, lastAssessedAt: new Date(), trend: 'improving' });
  masteryData.set('CT.DF.1', { standardId: 'CT.DF.1', score: 85, level: 'mastered', assessmentCount: 2, lastAssessedAt: new Date(), trend: 'stable' });

  // Sample test-out data
  const testOutData = new Map<string, TestOutData>();
  testOutData.set('6.RP.A.1', { standardId: '6.RP.A.1', confidence: 95, category: 'recommend_now', nextRecommendedDate: new Date() });
  testOutData.set('6.NS.B.2', { standardId: '6.NS.B.2', confidence: 88, category: 'likely_ready', nextRecommendedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  testOutData.set('CT.DF.1', { standardId: 'CT.DF.1', confidence: 82, category: 'likely_ready', nextRecommendedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) });

  return generateSphereGrid({
    studentId,
    curriculumData: sampleCurriculum,
    masteryData,
    testOutData,
    config: {
      width: 1000,
      height: 1000,
    },
  });
}

export default {
  generateSphereGrid,
  generateProgressSnapshot,
  createDemoGrid,
};
