# Meta-Dimensions Quick Start Guide

## 30-Second Overview

Meta-dimensions track **how students learn**, not just **what they know**. Art, Music, and PE develop these capabilities more effectively than traditional academics.

## Common Use Cases

### 1. Initialize New Student
```typescript
import { initializeMetaDimensions } from '@/lib/hyro/forge-meta-dimensions';

// Sets all 7 dimensions to 0.5 (neutral)
const dimensions = initializeMetaDimensions(studentId);
```

### 2. Record Learning Session
```typescript
import { applySubjectToMetaDimensions } from '@/lib/hyro/forge-meta-dimensions';

// After a 60-minute art class with 85% performance
const updated = applySubjectToMetaDimensions(
  studentId,
  'art',           // subject
  85,              // performance (0-100)
  60               // duration (minutes)
);

// Art boosts: manifold_fluidity, cooperative_generativity, 
//             identity_elasticity, entropy_intuition
```

### 3. Get Current State
```typescript
import { getStudentMetaDimensions } from '@/lib/hyro/forge-meta-dimensions';

const dims = getStudentMetaDimensions(studentId);
console.log(dims.manifold_fluidity);        // 0.52
console.log(dims.gradient_awareness);       // 0.48
```

### 4. Calculate Overall Meta Score
```typescript
import { calculateMetaScore } from '@/lib/hyro/forge-meta-dimensions';

const score = calculateMetaScore(dimensions);
console.log(score); // 0.534 (average of all 7 dimensions)
```

### 5. Get Personalized Recommendations
```typescript
import { getMetaDimensionRecommendations } from '@/lib/hyro/forge-meta-dimensions';

const recs = getMetaDimensionRecommendations(studentId);
// Returns dimensions below 0.4 with activity suggestions

recs.forEach(rec => {
  console.log(`Improve ${rec.dimension} (current: ${rec.current})`);
  console.log(`Try: ${rec.recommended_activities[0]}`);
});
```

### 6. Modify C/E/G Movement
```typescript
import { 
  getStudentMetaDimensions,
  calculateManifoldModifier 
} from '@/lib/hyro/forge-meta-dimensions';

const dims = getStudentMetaDimensions(studentId);
const movement = { coherence: 5, entropy: -3, generativity: 2 };

// Meta-dimensions amplify/dampen movement
const modified = calculateManifoldModifier(dims, movement);
// High manifold_fluidity = faster transitions
```

## Subject Impact Chart

### Strongest Meta-Dimension Boosters

| Subject | Top Dimensions | Max Boost |
|---------|---------------|-----------|
| **Art** | manifold_fluidity, cooperative_generativity | 0.4 each |
| **Music** | multi_model_coherence, entropy_intuition | 0.4, 0.3 |
| **PE** | gradient_awareness, identity_elasticity | 0.4, 0.3 |

### Academic Subject Impact

| Subject | Primary Dimensions | Max Boost |
|---------|-------------------|-----------|
| Math | multi_model_coherence, gradient_awareness | 0.3, 0.2 |
| Science | entropy_intuition, gradient_awareness | 0.3, 0.2 |
| Coding | manifold_fluidity, gradient_awareness | 0.3, 0.2 |

## The 7 Meta-Dimensions (One-Line Descriptions)

1. **manifold_fluidity** - How easily you shift between perspectives
2. **multi_model_coherence** - How well you connect ideas across domains
3. **identity_elasticity** - How comfortable you are trying new things
4. **gradient_awareness** - How aware you are of your own learning progress
5. **entropy_intuition** - How comfortable you are with uncertainty
6. **non_dual_resolution** - How well you hold contradictions
7. **cooperative_generativity** - How well you co-create with others

## Common Patterns

### Pattern 1: Multi-Subject Day
```typescript
// Record a full day of learning
applySubjectToMetaDimensions(studentId, 'math', 78, 45);
applySubjectToMetaDimensions(studentId, 'art', 92, 60);
applySubjectToMetaDimensions(studentId, 'physical_education', 88, 50);

// Check overall progress
const score = calculateMetaScore(getStudentMetaDimensions(studentId));
```

### Pattern 2: Weekly Check-In
```typescript
const dimensions = getStudentMetaDimensions(studentId);
const recommendations = getMetaDimensionRecommendations(studentId);

if (recommendations.length > 0) {
  // Focus on weakest dimension this week
  const focus = recommendations[0];
  console.log(`This week: ${focus.dimension}`);
  console.log(`Try: ${focus.recommended_activities[0]}`);
}
```

### Pattern 3: Manifold Integration
```typescript
import { LearnerState } from '@/lib/hyro/forge-learner-state';

// Get meta-dimensions
const metaDims = getStudentMetaDimensions(studentId);

// Use them to modify C/E/G movement
const movement = calculateCEGMovement(activity); // your function
const modified = calculateManifoldModifier(metaDims, movement);

// Apply modified movement to learner state
const newState = applyTrajectoryEffect(learnerState, {
  delta_C: modified.coherence,
  delta_E: modified.entropy,
  delta_G: modified.generativity,
  confidence: 0.8
});
```

## Key Design Principles

1. **Values are 0-1** (stored as 0-100 in DB)
2. **Default is 0.5** (neutral starting point)
3. **Diminishing returns** (harder to improve when already high)
4. **Duration matters** (longer sessions = more impact, capped at 60min)
5. **Performance scales** (85% performance = 85% of max boost)
6. **Non-academic subjects are powerful** (Art/Music/PE boost multiple dimensions)

## Files to Know

- `lib/hyro/forge-meta-dimensions.ts` - Main implementation
- `lib/hyro/forge-meta-dimensions.example.ts` - Examples
- `lib/hyro/META_DIMENSIONS_README.md` - Full documentation

## Database Tables

- `hyro_meta_dimension_estimates` - Current values per student
- `hyro_state_vectors` (stat_name='meta_event') - Change history

## Next Steps

1. Read `META_DIMENSIONS_README.md` for full details
2. Check `forge-meta-dimensions.example.ts` for integration patterns
3. Test with: `initializeMetaDimensions(testStudentId)`

---

**Quick Reminder**: Meta-dimensions answer "How do they learn?" while stats answer "What do they know?"
