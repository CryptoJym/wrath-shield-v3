# Meta-Learner Integration Guide

## Session Orchestrator Integration

Add meta-learning to the session orchestrator to record trajectories and use learned patterns for session planning.

### Step 1: Import Meta-Learner

```typescript
// In forge-session-orchestrator.ts
import {
  getMetaLearner,
  recordLearningTrajectory,
  StateVector,
  Intervention as MetaIntervention
} from './forge-meta-learner';
```

### Step 2: Record Trajectory on Session Completion

```typescript
// Add to completeSession() function
export function completeSession(sessionId: string): SessionPlan {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  
  // ... existing completion logic ...
  
  // NEW: Record trajectory for meta-learning
  if (session.status === 'completed') {
    const startState = getStateSnapshot(session.started_at);
    const endState = getCurrentStateVector(session.student_id);
    
    // Convert session activities to interventions
    const interventions: MetaIntervention[] = session.activities
      .filter(a => a.status === 'completed')
      .map(activity => ({
        type: activityTypeToInterventionType(activity.type),
        content_id: activity.reference_id,
        duration_minutes: activity.estimated_minutes,
        stat_target: activity.stat_focus[0] || 'study_skills'
      }));
    
    // Record trajectory for primary stat
    if (session.stat_focus.length > 0) {
      recordLearningTrajectory(
        session.student_id,
        session.stat_focus[0],
        startState,
        endState,
        interventions,
        session.actual_minutes / 60,
        session.completion_rate >= 0.8
      );
    }
  }
  
  return session;
}

// Helper function
function activityTypeToInterventionType(type: ActivityType): MetaIntervention['type'] {
  switch (type) {
    case 'diagnostic': return 'challenge';
    case 'srs_review': return 'review';
    case 'reading': return 'content';
    case 'comprehension': return 'challenge';
    case 'quest': return 'content';
    case 'reflection': return 'review';
    case 'break': return 'rest';
    default: return 'content';
  }
}
```

### Step 3: Use Meta-Learner for Session Planning

```typescript
// Add to generateSessionPlan() function
export function generateSessionPlan(
  studentId: string,
  targetDate?: string,
  options?: { useMetaLearning?: boolean }
): SessionPlan {
  const useML = options?.useMetaLearning ?? true;
  
  // ... existing context gathering ...
  
  // NEW: Get meta-learning recommendations if enabled
  let metaRecommendations: MetaIntervention[] = [];
  if (useML && context.primary_stat) {
    const learner = getMetaLearner();
    const currentState = getCurrentStateVector(studentId);
    const targetState = getTargetStateForStat(context.primary_stat);
    
    const plan = learner.recommendTrajectory(
      studentId,
      context.primary_stat,
      targetState,
      currentState
    );
    
    if (plan.confidence > 0.5) {
      console.log(`[Session] Using meta-learned pattern (confidence: ${plan.confidence.toFixed(2)})`);
      metaRecommendations = plan.recommended_interventions;
    }
  }
  
  // Use meta recommendations to inform activity selection
  const activities = buildActivitiesFromRecommendations(
    context,
    metaRecommendations
  );
  
  // ... rest of session planning logic ...
}
```

## Content Recommender Integration

Use meta-learning to recommend content based on successful trajectories.

```typescript
// In forge-recommender.ts
import { getMetaLearner, findSimilarPatterns } from './forge-meta-learner';

export function getOptimalContentPath(
  studentId: string,
  statName: StatName,
  currentState: StateVector
): Content[] {
  const learner = getMetaLearner();
  
  // Find patterns that worked for similar states
  const patterns = findSimilarPatterns(currentState, 15);
  
  if (patterns.length === 0) {
    return getDefaultContentPath(statName);
  }
  
  // Use highest confidence pattern
  const bestPattern = patterns[0];
  
  // Map interventions to content
  const content = bestPattern.optimal_intervention_sequence.map(intervention => {
    return selectContentForIntervention(intervention, statName);
  });
  
  return content;
}
```

## Quest Generator Integration

Generate quests based on successful learning patterns.

```typescript
// In forge-quest-generator.ts
import { getMetaLearner, getPatternStatistics } from './forge-meta-learner';

export function generateMetaLearnedQuest(
  studentId: string,
  statName: StatName
): Quest {
  const stats = getPatternStatistics();
  const learner = getMetaLearner();
  
  // Get current state
  const currentState = getCurrentStateVector(studentId);
  
  // Find optimal target state based on patterns
  const targetState = findOptimalNextState(currentState, statName);
  
  // Get trajectory plan
  const plan = learner.recommendTrajectory(
    studentId,
    statName,
    targetState,
    currentState
  );
  
  // Create quest from plan
  return {
    id: randomUUID(),
    quest_type: 'daily',
    title: `Advance ${statName} (Meta-Learned)`,
    description: `Complete ${plan.recommended_interventions.length} activities to reach next level`,
    required_stat: statName,
    difficulty: estimateDifficulty(plan),
    xp_reward: Math.round(plan.estimated_duration_hours * 100),
    stat_boost: { [statName]: 5 },
    status: 'available',
    // ... other fields ...
  };
}
```

## Analytics Dashboard Integration

Display meta-learning insights on dashboard.

```typescript
// In dashboard API route
import {
  getPatternStatistics,
  getTrajectoryHistory
} from '@/lib/hyro/forge-meta-learner';

export async function GET(request: Request) {
  const studentId = getStudentIdFromAuth(request);
  
  const stats = getPatternStatistics();
  const recentTrajectories = getTrajectoryHistory(studentId, undefined, 5);
  
  return Response.json({
    meta_learning: {
      total_patterns_learned: stats.total_patterns,
      average_pattern_confidence: stats.average_confidence,
      patterns_by_stat: stats.patterns_by_stat,
      recent_trajectories: recentTrajectories.map(t => ({
        stat: t.stat_name,
        success: t.success,
        efficiency: t.efficiency,
        duration_hours: t.duration_hours,
        date: new Date(t.created_at * 1000).toISOString()
      }))
    }
  });
}
```

## Example: Complete Session Flow with Meta-Learning

```typescript
// 1. Start Session
const session = startSession(sessionId);

// 2. Track state at session start
const startState = getCurrentStateVector(studentId);
const startTime = Date.now();

// 3. Execute activities
for (const activity of session.activities) {
  await executeActivity(activity);
}

// 4. Calculate end state
const endState = getCurrentStateVector(studentId);
const endTime = Date.now();
const durationHours = (endTime - startTime) / (1000 * 60 * 60);

// 5. Determine success
const success = calculateSessionSuccess(session);

// 6. Convert activities to interventions
const interventions = session.activities.map(a => ({
  type: activityTypeToInterventionType(a.type),
  content_id: a.reference_id,
  duration_minutes: a.estimated_minutes,
  stat_target: a.stat_focus[0]
}));

// 7. Record trajectory
recordLearningTrajectory(
  studentId,
  session.stat_focus[0],
  startState,
  endState,
  interventions,
  durationHours,
  success
);

// 8. Complete session
completeSession(sessionId);
```

## Monitoring and Debugging

### Check Pattern Growth

```typescript
import { getPatternStatistics } from '@/lib/hyro/forge-meta-learner';

const stats = getPatternStatistics();
console.log('Meta-Learning Status:');
console.log(`  Total patterns: ${stats.total_patterns}`);
console.log(`  Avg confidence: ${stats.average_confidence.toFixed(2)}`);
console.log(`  Avg success rate: ${stats.average_success_rate.toFixed(2)}`);
console.log('  By stat:', stats.patterns_by_stat);
```

### View Student Progress

```typescript
import { getTrajectoryHistory } from '@/lib/hyro/forge-meta-learner';

const history = getTrajectoryHistory(studentId, 'math', 10);

console.log(`Last 10 Math Trajectories for ${studentId}:`);
for (const t of history) {
  const improvement = t.end_state.coherence - t.start_state.coherence;
  console.log(`  ${t.id.slice(0, 8)}... ${t.success ? '✓' : '✗'} C: ${improvement > 0 ? '+' : ''}${improvement.toFixed(0)} (${t.efficiency.toFixed(2)}x)`);
}
```

## Best Practices

1. **Record Trajectories Consistently**: After every session, quest completion, or significant learning event
2. **Use Realistic Success Criteria**: Don't inflate success rates - accuracy improves the system
3. **Monitor Pattern Confidence**: Higher confidence = better recommendations
4. **Start with Rule-Based**: Let meta-learning gradually take over as patterns emerge
5. **A/B Test Recommendations**: Compare meta-learned vs rule-based paths

## Performance Considerations

- Trajectory recording is async-safe (uses prepared statements)
- Pattern updates are incremental (O(n) where n ≈ 10-20)
- Recommendation queries are indexed (<10ms typical)
- Database grows linearly with student activity (~1KB per trajectory)

## Future Enhancements

- Real-time trajectory adjustment during sessions
- Cross-student pattern transfer (privacy-preserving)
- Multi-objective optimization (time + engagement + mastery)
- Adaptive difficulty based on learned patterns
- Automated A/B testing of new patterns via HGM
