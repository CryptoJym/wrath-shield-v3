/**
 * Sphere Grid System Types - Hyro Education System
 *
 * @hyro-domain competency_visualization
 * @hyro-manifold Integrates with mastery tracking, test-out confidence, and ZPD engine
 * @hyro-rationale FFX-inspired sphere grid for visualizing competency progression
 *
 * PURPOSE:
 * Creates a visual representation of learning progression where competencies
 * radiate outward from a center point. Students can see their mastery spreading
 * like light across a constellation of connected skills.
 *
 * DESIGN PHILOSOPHY:
 * - Center: Current position / core foundational skills
 * - Inner rings: Prerequisites and foundational concepts
 * - Outer rings: Advanced skills building on mastered foundations
 * - Connections: Prerequisite relationships shown as paths
 * - Glow intensity: Mastery level (brighter = more mastered)
 * - Node size: Importance/weight of the standard
 * - Colors: Subject domain (Math=blue, ELA=green, Science=purple, etc.)
 */

// =============================================================================
// CORE NODE TYPES
// =============================================================================

/**
 * Subject domains for color coding
 */
export type SphereSubject =
  | 'math'
  | 'ela'
  | 'science'
  | 'social_studies'
  | 'critical_thinking'
  | 'neuroscience'
  | 'decision_making'
  | 'pattern_recognition'
  | 'meta_learning';

/**
 * Node state in the sphere grid
 */
export type NodeState =
  | 'locked'           // Prerequisites not met, greyed out
  | 'available'        // Ready to learn, visible but dim
  | 'in_progress'      // Currently working on, pulsing
  | 'approaching'      // Near mastery (70-85%), warming up
  | 'mastered'         // Proficient (85%+), glowing
  | 'test_ready'       // High confidence for test-out, bright glow + indicator
  | 'tested_passed'    // Already passed official test, golden
  | 'legendary';       // Beyond standard expectations, special effects

/**
 * Visual tier in the grid (distance from center)
 */
export type GridTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // 0 = center, 8 = outer edge

/**
 * Node size based on importance
 */
export type NodeSize = 'small' | 'medium' | 'large' | 'core';

/**
 * Animation state for nodes
 */
export type NodeAnimation =
  | 'none'
  | 'pulse'            // Gentle pulse for in-progress
  | 'glow'             // Steady glow for mastered
  | 'beacon'           // Bright beacon for test-ready
  | 'sparkle'          // Sparkle effect for legendary
  | 'unlock'           // Flash animation when unlocked
  | 'complete';        // Celebration animation

// =============================================================================
// SPHERE NODE
// =============================================================================

/**
 * A single node in the sphere grid representing a competency/standard
 */
export interface SphereNode {
  id: string;                    // Standard ID (e.g., "6.RP.A.1")

  // Display info
  name: string;                  // Short name
  description: string;           // Full description
  subject: SphereSubject;
  gradeLevel: string;            // K, 1, 2, ... 12
  domain: string;                // e.g., "Ratios & Proportional Relationships"
  cluster?: string;              // e.g., "Understand ratio concepts..."

  // Position in grid
  tier: GridTier;                // Distance from center (0-8)
  angle: number;                 // Angle in radians (0 to 2π)
  x: number;                     // Computed x position
  y: number;                     // Computed y position

  // Visual properties
  size: NodeSize;
  state: NodeState;
  animation: NodeAnimation;

  // Connections
  prerequisites: string[];       // IDs of prerequisite nodes
  unlocks: string[];             // IDs of nodes this unlocks

  // Mastery data
  mastery: {
    score: number;               // 0-100
    level: string;               // 'not_started' | 'developing' | 'proficient' | 'mastered'
    assessmentCount: number;
    lastAssessedAt: Date | null;
    trend: 'improving' | 'stable' | 'declining';
  };

  // Test-out readiness
  testOutConfidence: {
    score: number;               // 0-100
    category: string;            // 'not_ready' | 'needs_prep' | 'likely_ready' | 'recommend_now'
    nextRecommendedDate: Date | null;
  };

  // Metadata
  isCore: boolean;               // Is this a power/priority standard?
  dokLevel: 1 | 2 | 3 | 4;       // Depth of Knowledge
  estimatedMinutes: number;      // Estimated time to master
}

/**
 * Connection between nodes (prerequisite relationship)
 */
export interface NodeConnection {
  from: string;                  // Source node ID
  to: string;                    // Target node ID
  strength: number;              // 0-1, how strong the dependency is
  state: 'locked' | 'unlocked' | 'active' | 'completed';
  animated: boolean;             // Should show particle flow animation?
}

// =============================================================================
// SPHERE GRID STRUCTURE
// =============================================================================

/**
 * A sector of the sphere grid (usually grouped by subject)
 */
export interface GridSector {
  id: string;
  name: string;
  subject: SphereSubject;
  startAngle: number;            // Starting angle in radians
  endAngle: number;              // Ending angle in radians
  color: string;                 // Primary color for this sector
  gradientColors: [string, string]; // Gradient from inner to outer
  nodes: string[];               // Node IDs in this sector
}

/**
 * A ring in the sphere grid (nodes at same distance from center)
 */
export interface GridRing {
  tier: GridTier;
  radius: number;                // Distance from center in pixels
  nodes: string[];               // Node IDs in this ring
  label?: string;                // Optional label for this ring (e.g., "Grade 6")
}

/**
 * The complete sphere grid
 */
export interface SphereGrid {
  id: string;
  studentId: string;
  name: string;
  description: string;

  // Grid structure
  centerX: number;
  centerY: number;
  maxRadius: number;

  // Content
  nodes: Map<string, SphereNode>;
  connections: NodeConnection[];
  sectors: GridSector[];
  rings: GridRing[];

  // Statistics
  stats: {
    totalNodes: number;
    masteredNodes: number;
    inProgressNodes: number;
    availableNodes: number;
    lockedNodes: number;
    testReadyNodes: number;
    completionPercent: number;
  };

  // Timestamps
  generatedAt: Date;
  lastUpdatedAt: Date;
}

// =============================================================================
// GRID CONFIGURATION
// =============================================================================

/**
 * Configuration for sphere grid generation
 */
export interface SphereGridConfig {
  // Display settings
  width: number;
  height: number;
  padding: number;
  centerSize: number;            // Size of center node

  // Ring configuration
  ringSpacing: number;           // Pixels between rings
  ringCount: number;             // Number of rings

  // Node settings
  nodeMinSize: number;
  nodeMaxSize: number;
  connectionWidth: number;

  // Visual settings
  showLabels: boolean;
  showConnections: boolean;
  showMasteryGlow: boolean;
  animationsEnabled: boolean;

  // Filtering
  subjects: SphereSubject[];
  gradeLevels: string[];
  showLocked: boolean;

  // Colors (can be customized)
  colors: SphereGridColors;
}

/**
 * Color scheme for the sphere grid
 */
export interface SphereGridColors {
  background: string;

  // Subject colors
  math: string;
  ela: string;
  science: string;
  social_studies: string;
  critical_thinking: string;
  neuroscience: string;
  decision_making: string;
  pattern_recognition: string;
  meta_learning: string;

  // State colors
  locked: string;
  available: string;
  inProgress: string;
  approaching: string;
  mastered: string;
  testReady: string;
  testedPassed: string;
  legendary: string;

  // Connection colors
  connectionLocked: string;
  connectionUnlocked: string;
  connectionActive: string;
  connectionCompleted: string;

  // Effects
  glowColor: string;
  pulseColor: string;
  particleColor: string;
}

/**
 * Default color scheme (can be themed)
 */
export const DEFAULT_SPHERE_COLORS: SphereGridColors = {
  background: '#0a0a1a',

  // Subject colors (jewel tones)
  math: '#3b82f6',           // Blue
  ela: '#22c55e',            // Green
  science: '#a855f7',        // Purple
  social_studies: '#f59e0b', // Amber
  critical_thinking: '#ec4899', // Pink
  neuroscience: '#06b6d4',   // Cyan
  decision_making: '#f97316', // Orange
  pattern_recognition: '#8b5cf6', // Violet
  meta_learning: '#14b8a6',  // Teal

  // State colors
  locked: '#374151',         // Gray-700
  available: '#4b5563',      // Gray-600
  inProgress: '#fbbf24',     // Amber-400 (pulsing)
  approaching: '#fb923c',    // Orange-400
  mastered: '#34d399',       // Emerald-400
  testReady: '#60a5fa',      // Blue-400 (beacon)
  testedPassed: '#fcd34d',   // Yellow-300 (golden)
  legendary: '#c084fc',      // Purple-400 (sparkle)

  // Connections
  connectionLocked: '#1f2937',
  connectionUnlocked: '#374151',
  connectionActive: '#60a5fa',
  connectionCompleted: '#34d399',

  // Effects
  glowColor: '#ffffff',
  pulseColor: '#fbbf24',
  particleColor: '#60a5fa',
};

// =============================================================================
// INTERACTION TYPES
// =============================================================================

/**
 * User interaction with a node
 */
export interface NodeInteraction {
  nodeId: string;
  type: 'hover' | 'click' | 'focus' | 'blur';
  timestamp: Date;
}

/**
 * Node detail view data
 */
export interface NodeDetail {
  node: SphereNode;

  // Related nodes
  prerequisites: SphereNode[];
  unlocks: SphereNode[];
  sameCluster: SphereNode[];

  // Progress details
  assessmentHistory: Array<{
    date: Date;
    score: number;
    type: string;
  }>;

  // Recommendations
  actions: Array<{
    type: 'practice' | 'review' | 'test' | 'explore';
    label: string;
    url?: string;
  }>;

  // Resources
  resources: Array<{
    type: 'video' | 'article' | 'practice' | 'quiz';
    title: string;
    url: string;
    duration?: number;
  }>;
}

/**
 * Pan/zoom state for the grid
 */
export interface GridViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
  focusedNodeId: string | null;
  selectedNodeIds: string[];
  highlightedSector: string | null;
}

// =============================================================================
// PROGRESS TRACKING
// =============================================================================

/**
 * Snapshot of grid progress at a point in time
 */
export interface GridProgressSnapshot {
  studentId: string;
  timestamp: Date;

  // Overall stats
  totalNodes: number;
  masteredNodes: number;
  completionPercent: number;

  // By subject
  bySubject: Record<SphereSubject, {
    total: number;
    mastered: number;
    percent: number;
  }>;

  // By grade
  byGrade: Record<string, {
    total: number;
    mastered: number;
    percent: number;
  }>;

  // Recent achievements
  recentMasteries: Array<{
    nodeId: string;
    nodeName: string;
    masteredAt: Date;
  }>;

  // Test readiness
  testReadyCount: number;
  testReadyNodes: string[];
}

/**
 * Progress timeline entry
 */
export interface ProgressTimelineEntry {
  date: Date;
  event: 'node_unlocked' | 'node_started' | 'node_mastered' | 'test_ready' | 'test_passed';
  nodeId: string;
  nodeName: string;
  subject: SphereSubject;
  details?: Record<string, unknown>;
}

/**
 * Progress animation state (for showing growth over time)
 */
export interface ProgressAnimationState {
  startDate: Date;
  endDate: Date;
  currentDate: Date;
  playing: boolean;
  speed: number; // 1x, 2x, 5x, etc.
  snapshots: GridProgressSnapshot[];
}

// =============================================================================
// ACHIEVEMENTS & MILESTONES
// =============================================================================

/**
 * Grid-related achievement
 */
export interface GridAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;

  // Conditions
  type: 'mastery_count' | 'subject_complete' | 'grade_complete' | 'streak' | 'speed' | 'special';
  condition: {
    subject?: SphereSubject;
    gradeLevel?: string;
    count?: number;
    streak?: number;
    timeLimit?: number; // Days
  };

  // Rewards
  xpReward: number;
  unlocks?: string[]; // Special node IDs or features

  // Status
  earned: boolean;
  earnedAt?: Date;
  progress: number; // 0-100
}

/**
 * Milestone marker on the grid
 */
export interface GridMilestone {
  id: string;
  name: string;
  description: string;

  // Position
  tier: GridTier;
  angle: number;

  // Requirements
  requiredNodes: string[];

  // Status
  unlocked: boolean;
  unlockedAt?: Date;

  // Rewards
  xpReward: number;
  achievement?: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * API response for loading sphere grid
 */
export interface SphereGridResponse {
  success: boolean;
  grid?: SphereGrid;
  error?: string;
}

/**
 * API response for node detail
 */
export interface NodeDetailResponse {
  success: boolean;
  detail?: NodeDetail;
  error?: string;
}

/**
 * API response for progress history
 */
export interface ProgressHistoryResponse {
  success: boolean;
  snapshots?: GridProgressSnapshot[];
  timeline?: ProgressTimelineEntry[];
  error?: string;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_GRID_CONFIG: SphereGridConfig = {
  width: 1200,
  height: 1200,
  padding: 50,
  centerSize: 60,

  ringSpacing: 100,
  ringCount: 8,

  nodeMinSize: 12,
  nodeMaxSize: 40,
  connectionWidth: 2,

  showLabels: true,
  showConnections: true,
  showMasteryGlow: true,
  animationsEnabled: true,

  subjects: ['math', 'ela', 'science'],
  gradeLevels: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  showLocked: true,

  colors: DEFAULT_SPHERE_COLORS,
};

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Filter options for the sphere grid
 */
export interface GridFilterOptions {
  subjects?: SphereSubject[];
  gradeLevels?: string[];
  states?: NodeState[];
  searchQuery?: string;
  showOnlyTestReady?: boolean;
  showOnlyInProgress?: boolean;
}

/**
 * Sort options for node lists
 */
export type GridSortOption =
  | 'mastery_high'
  | 'mastery_low'
  | 'test_ready'
  | 'recently_updated'
  | 'alphabetical'
  | 'grade_level';

export default {
  DEFAULT_SPHERE_COLORS,
  DEFAULT_GRID_CONFIG,
};
