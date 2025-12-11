# Meta-Learner API Reference

Complete reference for all exported functions, types, and classes.

## Classes

### `MetaLearner`
Main singleton class for meta-learning operations.

```typescript
class MetaLearner {
  static getInstance(): MetaLearner;
  
  recordTrajectory(trajectory: TrajectoryRecord): void;
  
  recommendTrajectory(
    studentId: string,
    statName: string,
    targetState: StateVector,
    currentState?: StateVector
  ): TrajectoryPlan;
  
  findMatchingPatterns(
    currentState: StateVector,
    targetState: StateVector,
    limit?: number
  ): LearnedPattern[];
}
```

## Types

### `StateVector`
A point in the C/E/G manifold.

```typescript
interface StateVector {
  coherence: number;      // 0-100
  entropy: number;        // 0-100
  generativity: number;   // 0-100
}
```

### `Intervention`
A learning action/activity.

```typescript
interface Intervention {
  type: 'content' | 'scaffolding' | 'challenge' | 'rest' | 'review' | 'exploration';
  content_id?: string;
  difficulty_adjustment?: number;
  duration_minutes: number;
  stat_target: string;
}
```

### `TrajectoryRecord`
A recorded learning journey.

```typescript
interface TrajectoryRecord {
  id: string;
  student_id: string;
  stat_name: string;
  start_state: StateVector;
  end_state: StateVector;
  interventions: Intervention[];
  duration_hours: number;
  success: boolean;
  efficiency: number;
  created_at: number;
}
```

### `LearnedPattern`
A clustered pattern learned from trajectories.

```typescript
interface LearnedPattern {
  id: string;
  source_state_cluster: StateVector;
  target_state_cluster: StateVector;
  optimal_intervention_sequence: Intervention[];
  confidence: number;                    // 0-1
  sample_count: number;
  average_duration_hours: number;
  success_rate: number;                  // 0-1
  stat_name?: string;
  created_at: number;
  updated_at: number;
}
```

### `TrajectoryPlan`
A recommended learning path.

```typescript
interface TrajectoryPlan {
  student_id: string;
  stat_name: string;
  current_state: StateVector;
  target_state: StateVector;
  recommended_interventions: Intervention[];
  estimated_duration_hours: number;
  confidence: number;                    // 0-1
  pattern_source?: string;               // Pattern ID used
}
```

## Core Functions

### `getMetaLearner()`
Get the singleton MetaLearner instance.

```typescript
function getMetaLearner(): MetaLearner
```

**Returns:** The singleton MetaLearner instance

**Example:**
```typescript
const learner = getMetaLearner();
```

---

### `recordLearningTrajectory()`
Record a completed learning trajectory.

```typescript
function recordLearningTrajectory(
  studentId: string,
  statName: StatName,
  startState: StateVector,
  endState: StateVector,
  interventions: Intervention[],
  durationHours: number,
  success: boolean
): TrajectoryRecord
```

**Parameters:**
- `studentId` - Student identifier
- `statName` - The stat being trained (e.g., 'math', 'reading')
- `startState` - C/E/G state at start of session
- `endState` - C/E/G state at end of session
- `interventions` - List of activities/interventions performed
- `durationHours` - Total session duration in hours
- `success` - Whether the session met its learning goals

**Returns:** The recorded trajectory record

**Example:**
```typescript
const trajectory = recordLearningTrajectory(
  'student_123',
  'math',
  { coherence: 40, entropy: 60, generativity: 45 },
  { coherence: 60, entropy: 45, generativity: 65 },
  [
    { type: 'content', stat_target: 'math', duration_minutes: 20 },
    { type: 'scaffolding', stat_target: 'math', duration_minutes: 15 }
  ],
  0.5,
  true
);
```

---

### `manifoldDistance()`
Calculate Euclidean distance between two states in C/E/G space.

```typescript
function manifoldDistance(
  state1: StateVector,
  state2: StateVector
): number
```

**Parameters:**
- `state1` - First state vector
- `state2` - Second state vector

**Returns:** Euclidean distance between states

**Example:**
```typescript
const dist = manifoldDistance(
  { coherence: 50, entropy: 50, generativity: 50 },
  { coherence: 60, entropy: 60, generativity: 60 }
);
// Returns ~17.32
```

---

### `clusterState()`
Round a state to the nearest cluster center.

```typescript
function clusterState(state: StateVector): StateVector
```

**Parameters:**
- `state` - The state to cluster

**Returns:** Clustered state (rounded to nearest 10)

**Example:**
```typescript
const clustered = clusterState(
  { coherence: 47, entropy: 53, generativity: 62 }
);
// Returns { coherence: 50, entropy: 50, generativity: 60 }
```

---

### `findSimilarPatterns()`
Find patterns matching a state within a given radius.

```typescript
function findSimilarPatterns(
  state: StateVector,
  radius?: number
): LearnedPattern[]
```

**Parameters:**
- `state` - The state to match
- `radius` - Search radius (default: 15)

**Returns:** Array of matching patterns sorted by confidence

**Example:**
```typescript
const patterns = findSimilarPatterns(
  { coherence: 50, entropy: 50, generativity: 50 },
  15
);
```

---

### `buildTrajectoryFromPattern()`
Build a trajectory plan from a learned pattern.

```typescript
function buildTrajectoryFromPattern(
  pattern: LearnedPattern,
  currentState: StateVector,
  targetState: StateVector
): TrajectoryPlan
```

**Parameters:**
- `pattern` - The learned pattern to use
- `currentState` - Current student state
- `targetState` - Desired target state

**Returns:** Customized trajectory plan

**Example:**
```typescript
const plan = buildTrajectoryFromPattern(
  bestPattern,
  { coherence: 50, entropy: 50, generativity: 50 },
  { coherence: 75, entropy: 35, generativity: 70 }
);
```

---

### `planOptimalTrajectory()`
Rule-based fallback when no patterns exist.

```typescript
function planOptimalTrajectory(
  studentId: string,
  statName: string,
  targetState: StateVector
): TrajectoryPlan
```

**Parameters:**
- `studentId` - Student identifier
- `statName` - The stat being trained
- `targetState` - Desired target state

**Returns:** Rule-based trajectory plan (confidence ~0.3)

**Example:**
```typescript
const plan = planOptimalTrajectory(
  'student_new',
  'math',
  { coherence: 75, entropy: 35, generativity: 70 }
);
```

---

## Analytics Functions

### `getPatternStatistics()`
Get statistics about learned patterns.

```typescript
function getPatternStatistics(): {
  total_patterns: number;
  average_confidence: number;
  average_success_rate: number;
  patterns_by_stat: Record<string, number>;
}
```

**Returns:** Pattern statistics object

**Example:**
```typescript
const stats = getPatternStatistics();
console.log('Total patterns:', stats.total_patterns);
console.log('Avg confidence:', stats.average_confidence);
console.log('Avg success rate:', stats.average_success_rate);
console.log('By stat:', stats.patterns_by_stat);
```

---

### `getTrajectoryHistory()`
Get trajectory history for a student.

```typescript
function getTrajectoryHistory(
  studentId: string,
  statName?: string,
  limit?: number
): TrajectoryRecord[]
```

**Parameters:**
- `studentId` - Student identifier
- `statName` - Optional stat filter
- `limit` - Maximum records to return (default: 50)

**Returns:** Array of trajectory records, newest first

**Example:**
```typescript
const history = getTrajectoryHistory('student_123', 'math', 10);
console.log(`Last 10 math trajectories:`);
for (const t of history) {
  console.log(`  ${t.success ? '✓' : '✗'} ${t.id.slice(0, 8)}...`);
}
```

---

## HGM Integration

### `proposeTrajectoryImprovement()`
Propose a pattern improvement for HGM safety validation.

```typescript
function proposeTrajectoryImprovement(
  currentPattern: LearnedPattern,
  proposedPattern: LearnedPattern
): {
  valid: boolean;
  experiment?: ExperimentConfig;
}
```

**Parameters:**
- `currentPattern` - Current pattern
- `proposedPattern` - Proposed improved pattern

**Returns:** Validation result with optional experiment

**Example:**
```typescript
const result = proposeTrajectoryImprovement(
  currentPattern,
  proposedPattern
);

if (result.valid && result.experiment) {
  console.log('Experiment created:', result.experiment.id);
} else {
  console.log('Improvement rejected by safety checks');
}
```

---

## Constants

### Cluster Radius
```typescript
const CLUSTER_RADIUS = 10;
```
State vectors are clustered to the nearest 10-unit grid point.

### Pattern Confidence Adjustments
```typescript
const REINFORCE_AMOUNT = 0.05;  // Success increases confidence
const WEAKEN_AMOUNT = -0.1;     // Failure decreases confidence
```

### Pattern Similarity Threshold
```typescript
const SIMILAR_PATTERN_RADIUS = 15;
```
Default radius for finding similar patterns.

---

## Usage Patterns

### Pattern 1: Session Completion
```typescript
// After completing a learning session
const trajectory = recordLearningTrajectory(
  session.student_id,
  session.primary_stat,
  session.start_state,
  session.end_state,
  session.interventions,
  session.duration_hours,
  session.completion_rate >= 0.8
);
```

### Pattern 2: Session Planning
```typescript
// When planning a new session
const learner = getMetaLearner();
const plan = learner.recommendTrajectory(
  studentId,
  targetStat,
  targetState,
  currentState
);

// Use plan.recommended_interventions to build session
```

### Pattern 3: Analytics Dashboard
```typescript
// Display meta-learning insights
const stats = getPatternStatistics();
const recentTrajectories = getTrajectoryHistory(studentId, undefined, 5);

return {
  patterns_learned: stats.total_patterns,
  average_confidence: stats.average_confidence,
  recent_sessions: recentTrajectories
};
```

---

## Performance Guidelines

- **Recording**: Call after every significant learning event (session, quest, assessment)
- **Recommendations**: Cache for session duration, regenerate between sessions
- **Analytics**: Can be called frequently (<10ms response time)
- **Pattern Updates**: Automatic and incremental (no manual intervention needed)

---

## Safety Considerations

All pattern updates are validated through HGM Optimizer:
- Maximum ±5% change per iteration
- p < 0.01 statistical confidence
- Cohen's d > 0.8 effect size
- Minimum 30 observations

Pattern confidence automatically adjusts based on success/failure rates.
