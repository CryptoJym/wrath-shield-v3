# HYRO Forge: Meta-Dimensions System

## Overview

The Meta-Dimensions System tracks higher-order learning capabilities that go beyond traditional academic subjects. While the 8-stat model (math, reading, science, coding, study_skills, critical_thinking, technology, problem_solving) handles academic content well, subjects like **Art**, **Music**, and **Physical Education** develop different capabilities that affect how students move through the C/E/G manifold.

## The Seven Meta-Dimensions

All dimensions are measured on a 0-1 scale (stored as 0-100 internally):

### 1. Manifold Fluidity
**Ability to move fluidly between conceptual states**
- High = Easy state transitions, natural context-switching
- Low = Gets stuck in single perspectives
- Boosted by: Art, Coding, Problem Solving

### 2. Multi-Model Coherence
**Cross-domain integration and synthesis**
- High = Naturally connects ideas across subjects
- Low = Treats each domain in isolation
- Boosted by: Math, Music, Social Studies

### 3. Identity Elasticity
**Adaptability to new contexts and self-concept flexibility**
- High = Comfortable trying new things, growth mindset
- Low = Rigid identity, fear of looking incompetent
- Boosted by: Art, PE, Writing

### 4. Gradient Awareness
**Metacognitive monitoring of learning trajectory**
- High = Knows what they're improving at, calibrated self-assessment
- Low = Poor sense of own progress
- Boosted by: PE, Math, Study Skills

### 5. Entropy Intuition
**Comfort with uncertainty and productive exploration**
- High = Embraces confusion as learning opportunity
- Low = Needs constant structure and validation
- Boosted by: Science, Art, Music

### 6. Non-Dual Resolution
**Ability to hold contradictions productively**
- High = Comfortable with paradox and ambiguity
- Low = Forces binary choices, black-and-white thinking
- Boosted by: Critical Thinking, Reading, Social Studies

### 7. Cooperative Generativity
**Collaborative creation and value generation**
- High = Builds on others' ideas, co-creates naturally
- Low = Isolated thinking, competitive rather than collaborative
- Boosted by: Art, Music, Writing

## Architecture

### Database Schema

The system uses the existing `hyro_meta_dimension_estimates` table from migration 041:

```sql
CREATE TABLE hyro_meta_dimension_estimates (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  dimension_name TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 50,     -- 0-100 scale
  ci_low REAL NOT NULL DEFAULT 0,
  ci_high REAL NOT NULL DEFAULT 100,
  evidence_json TEXT,
  n_observations INTEGER DEFAULT 0,
  confidence_level TEXT DEFAULT 'low',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(student_id, dimension_name)
);
```

Events are stored in `hyro_state_vectors` with `stat_name='meta_event'`.

### Core Functions

#### Initialization
```typescript
import { initializeMetaDimensions } from './forge-meta-dimensions';

// Initialize defaults (all at 0.5) for new student
const dimensions = initializeMetaDimensions(studentId);
```

#### Getting Current State
```typescript
import { getStudentMetaDimensions } from './forge-meta-dimensions';

const dimensions = getStudentMetaDimensions(studentId);
// Returns: { manifold_fluidity: 0.52, multi_model_coherence: 0.48, ... }
```

#### Updating from Learning Activities
```typescript
import { applySubjectToMetaDimensions } from './forge-meta-dimensions';

// After a 60-minute art session with 85% performance
const updated = applySubjectToMetaDimensions(
  studentId,
  'art',
  85,      // performance score (0-100)
  60       // duration in minutes
);
```

#### Manifold Movement Moderation
```typescript
import { calculateManifoldModifier } from './forge-meta-dimensions';

const dimensions = getStudentMetaDimensions(studentId);
const movement = { coherence: 5, entropy: -3, generativity: 2 };

// Meta-dimensions modify how easily learner moves through C/E/G space
const modified = calculateManifoldModifier(dimensions, movement);
```

## Subject-to-MetaDimension Mappings

### Academic Subjects (Moderate Contributions)

| Subject | Primary Dimensions | Max Boost per Session |
|---------|-------------------|----------------------|
| Math | multi_model_coherence, gradient_awareness | 0.3, 0.2 |
| Reading | multi_model_coherence, non_dual_resolution | 0.2, 0.2 |
| Writing | cooperative_generativity, identity_elasticity | 0.3, 0.2 |
| Science | entropy_intuition, gradient_awareness | 0.3, 0.2 |
| Coding | manifold_fluidity, gradient_awareness | 0.3, 0.2 |

### Non-Academic Subjects (Stronger, Multi-Dimensional)

| Subject | Primary Dimensions | Max Boost per Session |
|---------|-------------------|----------------------|
| **Art** | manifold_fluidity (0.4)<br>cooperative_generativity (0.4)<br>identity_elasticity (0.3)<br>entropy_intuition (0.2) | Multi-dimensional |
| **Music** | multi_model_coherence (0.4)<br>entropy_intuition (0.3)<br>cooperative_generativity (0.3)<br>manifold_fluidity (0.2) | Multi-dimensional |
| **PE** | gradient_awareness (0.4)<br>identity_elasticity (0.3)<br>manifold_fluidity (0.2)<br>entropy_intuition (0.2) | Multi-dimensional |

### Why Art/Music/PE are Powerful

Non-academic subjects contribute to **multiple** meta-dimensions simultaneously:

- **Art** develops spatial reasoning, creative flexibility, and collaborative creation
- **Music** requires temporal pattern recognition, emotional regulation, and ensemble coordination
- **PE** provides immediate physical feedback, builds resilience, and requires real-time adaptation

This is why they're critical for the "Ultimate Level Up Machine" - they develop the **meta-skills** that make all other learning more effective.

## Recommendations System

```typescript
import { getMetaDimensionRecommendations } from './forge-meta-dimensions';

const recs = getMetaDimensionRecommendations(studentId);
// Returns array of dimensions below 0.4 threshold with activity suggestions

recs.forEach(rec => {
  console.log(`${rec.dimension}: ${rec.current}`);
  console.log('Try:', rec.recommended_activities);
});
```

## Integration with C/E/G Manifold

Meta-dimensions affect state transitions in the learning manifold:

1. **Manifold Fluidity**: Amplifies all movement (faster transitions)
2. **Gradient Awareness**: Helps coherence recovery
3. **Entropy Intuition**: Stabilizes or amplifies entropy as needed
4. **Multi-Model Coherence**: Boosts generativity

Example:
```typescript
// Student with high manifold_fluidity (0.8) moves faster through space
// Student with low manifold_fluidity (0.3) has sluggish state changes
const modifier = calculateManifoldModifier(dimensions, movement);
// Returns amplified/dampened movement vector
```

## Decay Function (Optional)

Meta-dimensions decay more slowly than academic skills (90-day half-life):

```typescript
import { applyMetaDimensionDecay } from './forge-meta-dimensions';

// Run periodically (e.g., weekly maintenance job)
const decayed = applyMetaDimensionDecay(studentId);
```

## Complete Workflow Example

```typescript
import {
  initializeMetaDimensions,
  getStudentMetaDimensions,
  applySubjectToMetaDimensions,
  calculateMetaScore,
  getMetaDimensionRecommendations,
} from './forge-meta-dimensions';

// 1. Setup new student
const initial = initializeMetaDimensions(studentId);

// 2. Record learning sessions
applySubjectToMetaDimensions(studentId, 'math', 78, 45);
applySubjectToMetaDimensions(studentId, 'art', 92, 60);
applySubjectToMetaDimensions(studentId, 'physical_education', 88, 50);

// 3. Check progress
const dimensions = getStudentMetaDimensions(studentId);
const overallScore = calculateMetaScore(dimensions);

// 4. Get personalized recommendations
const recommendations = getMetaDimensionRecommendations(studentId);
```

## Files

- **forge-meta-dimensions.ts** - Core implementation
- **forge-meta-dimensions.example.ts** - Integration examples
- **META_DIMENSIONS_README.md** - This file

## Database Tables

- `hyro_meta_dimension_estimates` - Current dimension values per student
- `hyro_state_vectors` (with stat_name='meta_event') - Change event history

## Related Systems

- **forge-learner-state.ts** - C/E/G manifold and learner state vectors
- **forge-proficiency.ts** - Academic stat tracking
- **forge-grade-benchmarks.ts** - Grade-level expectations

## Design Philosophy

Meta-dimensions answer the question: **"How do we track learning from subjects that don't fit the academic model?"**

Traditional education focuses on **what** students know. Meta-dimensions track **how** they learn:
- Can they shift perspectives? (manifold_fluidity)
- Do they connect ideas across domains? (multi_model_coherence)
- Are they comfortable with uncertainty? (entropy_intuition)
- Can they collaborate generatively? (cooperative_generativity)

These capabilities are **orthogonal** to content mastery but **critical** for lifelong learning success.
