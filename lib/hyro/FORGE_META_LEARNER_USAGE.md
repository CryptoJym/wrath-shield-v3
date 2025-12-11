# HYRO Forge Meta-Learner Usage Guide

## Overview

The Meta-Learning Trajectory System is the "Ultimate Level Up Machine" - a recursive improvement engine that learns from every student's learning trajectory through the C/E/G manifold.

## Core Concepts

### State Vector
A point in the C/E/G (Coherence/Entropy/Generativity) manifold:
```typescript
interface StateVector {
  coherence: number;      // 0-100: Internal consistency of knowledge
  entropy: number;        // 0-100: Uncertainty and novelty tolerance  
  generativity: number;   // 0-100: Ability to produce novel connections
}
```

### Intervention
An action taken to move a student through the manifold:
```typescript
interface Intervention {
  type: 'content' | 'scaffolding' | 'challenge' | 'rest' | 'review' | 'exploration';
  content_id?: string;
  difficulty_adjustment?: number;
  duration_minutes: number;
  stat_target: string;
}
```

### Trajectory Record
A complete learning journey from start to end state:
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

## Basic Usage

### 1. Recording a Learning Trajectory

```typescript
import { recordLearningTrajectory } from '@/lib/hyro/forge-meta-learner';

// After a student completes a learning session
const trajectory = recordLearningTrajectory(
  'student_123',
  'math',
  { coherence: 45, entropy: 60, generativity: 50 },  // Start state
  { coherence: 65, entropy: 45, generativity: 60 },  // End state
  [
    { type: 'content', stat_target: 'math', duration_minutes: 20 },
    { type: 'scaffolding', stat_target: 'math', duration_minutes: 15 },
    { type: 'challenge', stat_target: 'math', duration_minutes: 10 }
  ],
  0.75,  // Duration in hours
  true   // Success
);
```

### 2. Getting a Recommended Trajectory

```typescript
import { getMetaLearner } from '@/lib/hyro/forge-meta-learner';

const learner = getMetaLearner();

const plan = learner.recommendTrajectory(
  'student_456',
  'reading',
  { coherence: 75, entropy: 35, generativity: 70 },  // Target state
  { coherence: 50, entropy: 50, generativity: 50 }   // Current state (optional)
);

console.log('Recommended interventions:', plan.recommended_interventions);
console.log('Estimated duration:', plan.estimated_duration_hours, 'hours');
console.log('Confidence:', plan.confidence);
```

### 3. Viewing Pattern Statistics

```typescript
import { getPatternStatistics } from '@/lib/hyro/forge-meta-learner';

const stats = getPatternStatistics();

console.log('Total patterns learned:', stats.total_patterns);
console.log('Average confidence:', stats.average_confidence);
console.log('Average success rate:', stats.average_success_rate);
console.log('Patterns by stat:', stats.patterns_by_stat);
```

### 4. Viewing Student History

```typescript
import { getTrajectoryHistory } from '@/lib/hyro/forge-meta-learner';

const history = getTrajectoryHistory('student_123', 'math', 10);

for (const trajectory of history) {
  console.log(`Trajectory ${trajectory.id}:`);
  console.log(`  Start: C=${trajectory.start_state.coherence}, E=${trajectory.start_state.entropy}, G=${trajectory.start_state.generativity}`);
  console.log(`  End: C=${trajectory.end_state.coherence}, E=${trajectory.end_state.entropy}, G=${trajectory.end_state.generativity}`);
  console.log(`  Success: ${trajectory.success}`);
  console.log(`  Efficiency: ${trajectory.efficiency.toFixed(2)}x`);
}
```

## Integration Points

### Session Orchestrator
Record trajectories after session completion:

```typescript
import { recordLearningTrajectory } from '@/lib/hyro/forge-meta-learner';

// In session orchestrator after session ends
const trajectory = recordLearningTrajectory(
  session.student_id,
  session.stat_name,
  session.start_state,
  session.end_state,
  session.interventions,
  session.duration_hours,
  session.success
);
```

### Content Recommender
Use trajectory plans to recommend content:

```typescript
import { getMetaLearner } from '@/lib/hyro/forge-meta-learner';

const learner = getMetaLearner();
const plan = learner.recommendTrajectory(
  studentId,
  statName,
  targetState,
  currentState
);

// Use plan.recommended_interventions to select content
const nextContent = selectContentForIntervention(
  plan.recommended_interventions[0]
);
```

### HGM Safety Integration
The meta-learner automatically uses HGM Optimizer for safety checks:

```typescript
import { proposeTrajectoryImprovement } from '@/lib/hyro/forge-meta-learner';

// When proposing a pattern optimization
const result = proposeTrajectoryImprovement(currentPattern, proposedPattern);

if (result.valid && result.experiment) {
  // Experiment created and monitored by HGM
  console.log('Experiment ID:', result.experiment.id);
} else {
  console.log('Improvement rejected by safety checks');
}
```

## Pattern Learning Process

1. **Trajectory Recording**: After each session, record the trajectory
2. **Clustering**: States are clustered to ~10 unit radius
3. **Pattern Matching**: Find similar patterns (source + target states)
4. **Reinforcement**: Successful trajectories reinforce patterns (+0.05 confidence)
5. **Weakening**: Failed trajectories weaken patterns (-0.1 confidence)
6. **Pattern Creation**: New patterns created with 0.5 confidence

## Safety Guarantees

- **HGM Integration**: Maximum ±5% change per iteration
- **Statistical Confidence**: Requires p < 0.01 for changes
- **Effect Size**: Cohen's d > 0.8 required
- **Sample Size**: Minimum 30 observations before applying

## Database Schema

### `hyro_trajectory_records`
- Records all learning trajectories
- Indexed by: student_id, stat_name, success, created_at

### `hyro_learned_patterns`
- Stores learned patterns with confidence scores
- Indexed by: confidence, success_rate, stat_name
- Updates incrementally with new evidence

## Performance

- **Trajectory Recording**: O(1) - Direct database insert
- **Pattern Update**: O(n) - n = number of similar patterns (~10-20)
- **Recommendation**: O(n log n) - n = total patterns (~100s)
- **Query Performance**: All queries indexed, <10ms typical

## Best Practices

1. **Record Often**: Record trajectories after every significant session
2. **Track Success**: Be honest about success/failure to improve patterns
3. **Use Interventions**: Provide detailed intervention data for better learning
4. **Monitor Confidence**: Higher confidence patterns = better recommendations
5. **Review History**: Check trajectory history to understand student progress

## Future Enhancements

- Multi-stat trajectory optimization
- Transfer learning across students
- Adaptive intervention selection
- Real-time trajectory adjustment
- Cross-domain pattern transfer
