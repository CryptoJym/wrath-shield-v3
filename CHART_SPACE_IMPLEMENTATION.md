# Chart-Space Implementation Summary

## Overview
Implemented Pareto-optimal content selection and attractor-field clustering for the Hyro Forge educational system.

## Files Created

### `/lib/hyro/forge-chart-space.ts` (680 lines)
Complete implementation of chart-space analytics with:
- Pareto-optimal content selection
- Attractor-field clustering
- State transition prediction
- Optimal trajectory planning
- Visualization data generation

## Key Features Implemented

### 1. Pareto-Optimal Content Selection

**Functions:**
- `calculateContentObjectives(content, studentId)`: Calculates 4 objectives for each content item
  - Learning Gain (0-100): Expected proficiency improvement
  - Engagement Score (0-100): Predicted student engagement  
  - Efficiency Score (0-100): Knowledge gain per unit time
  - Transfer Potential (0-100): Cross-skill applicability

- `getParetoOptimalContent(studentId, candidateContent[])`: Returns Pareto frontier
  - Identifies non-dominated content (Pareto-optimal)
  - Provides top recommendations by different criteria:
    - top_balanced: Best overall score
    - top_learning: Highest learning gain
    - top_engagement: Highest engagement
    - top_efficiency: Best time investment

**Algorithm:**
- Multi-objective optimization using Pareto dominance
- Content A dominates B if A >= B on all objectives and A > B on at least one
- Returns both optimal and dominated content for comparison

### 2. Attractor-Field Clustering

**Attractor Types (5 stable learning states):**
1. **Flow** (C:75, E:35, G:70): Optimal learning state
   - High coherence, comfortable challenge, strong creativity
   - Suggestions: Maintain difficulty, introduce transfer tasks
   
2. **Confusion** (C:35, E:75, G:45): Information overload
   - Fragmented understanding, high uncertainty
   - Suggestions: Structured practice, reduce cognitive load
   
3. **Boredom** (C:80, E:25, G:30): Under-challenged
   - Strong understanding, low difficulty, minimal output
   - Suggestions: Increase difficulty, novel problems
   
4. **Frustration** (C:30, E:80, G:25): Over-challenged
   - Weak understanding, too much challenge, stress
   - Suggestions: Reduce difficulty, provide scaffolding
   
5. **Discovery** (C:55, E:60, G:75): Active exploration
   - Moderate understanding, high novelty tolerance
   - Suggestions: Support exploration, guide toward coherence

**Functions:**
- `clusterLearningStates(studentId, statName)`: Returns all attractors with probabilities
- `detectCurrentAttractor(studentId, statName)`: Returns most likely current state
- `calculateAttractorProbability()`: Gaussian probability based on Euclidean distance

### 3. State Transition Prediction

**Intervention Types:**
- `content`: Regular practice (+3 coherence, +1 generativity, -1 entropy)
- `scaffolding`: Structured support (+5 coherence, -5 entropy)
- `challenge`: Difficulty increase (+5 entropy, +3 generativity)
- `exploration`: Creative tasks (+5 generativity, +3 entropy, -2 coherence)
- `rest`: Recovery period (-3 entropy, +2 generativity)

**Function:**
- `predictStateTransition(currentState, intervention)`: Linear model for state evolution

### 4. Optimal Trajectory Planning

**Function:**
- `planOptimalTrajectory(studentId, statName, targetState)`: Plans intervention sequence
  - Calculates deltas in C/E/G dimensions
  - Prioritizes largest changes first
  - Generates step-by-step intervention plan
  - Estimates total duration and success probability
  - Identifies risk factors (large changes, long duration, etc.)

### 5. Chart-Space Visualization Data

**Functions:**
- `getChartSpaceData(studentId, statName)`: Base visualization data
  - Current state vector
  - 30-day state history
  - Attractor field probabilities

- `getChartSpaceDataWithPareto(studentId, statName, content[])`: Add Pareto frontier

- `getChartSpaceDataWithTrajectory(studentId, statName, targetState)`: Add trajectory plan

### 6. Database Schema

**Tables Created (via `initializeStateHistoryTable()`):**

1. **hyro_state_history**: Time-series state vector tracking
   - Columns: student_id, stat_name, coherence, entropy, generativity, n_items_used, event_type
   - Indexes: (student_id, stat_name), created_at

2. **hyro_attractor_assignments**: Learning state classifications
   - Columns: student_id, stat_name, attractor_type, probability, state_coherence/entropy/generativity
   - Indexes: (student_id, stat_name), attractor_type

3. **hyro_pareto_selections**: Content selection history
   - Columns: student_id, stat_name, content_id, learning_gain, engagement_score, efficiency_score, transfer_potential, was_pareto_optimal, user_selected
   - Indexes: (student_id, stat_name), content_id

**Recording Functions:**
- `recordStateHistory()`: Log state changes
- `recordAttractorAssignment()`: Log attractor classifications
- `recordParetoSelection()`: Log content selections

## Integration Points

### With Existing Systems:
- **forge-zpd-engine.ts**: Uses `getStateVector()` and `StateVector` type
- **forge-proficiency.ts**: Uses `getSkillProficiency()` for content scoring
- **forge-types.ts**: Uses `StatName` type
- **Database.ts**: Uses `getDatabase()` for all queries

### Usage Example:
```typescript
import {
  getParetoOptimalContent,
  detectCurrentAttractor,
  planOptimalTrajectory,
  getChartSpaceDataWithPareto,
} from './lib/hyro/forge-chart-space';

// 1. Get Pareto-optimal content
const candidateContent = [...]; // Load from DB
const pareto = getParetoOptimalContent('student_001', candidateContent);
console.log('Top balanced content:', pareto.recommendation.top_balanced);

// 2. Detect current learning state
const attractor = detectCurrentAttractor('student_001', 'math');
console.log('Current state:', attractor?.type); // 'flow', 'confusion', etc.
console.log('Suggestions:', attractor?.intervention_suggestions);

// 3. Plan trajectory to target state
const targetState = { coherence: 80, entropy: 40, generativity: 75, n_items_used: 0 };
const trajectory = planOptimalTrajectory('student_001', 'math', targetState);
console.log('Steps:', trajectory.steps.length);
console.log('Duration:', trajectory.total_duration_minutes, 'minutes');
console.log('Success probability:', trajectory.success_probability);

// 4. Get visualization data
const chartData = getChartSpaceDataWithPareto('student_001', 'math', candidateContent);
// Use chartData.state_history for 3D trajectory plot
// Use chartData.attractor_fields for attractor basin visualization
// Use chartData.pareto_frontier for objective space plot
```

## Mathematical Foundations

### Pareto Dominance
- **Definition**: Solution A dominates B if A is no worse than B in all objectives and strictly better in at least one
- **Complexity**: O(n²) for n content items (can be optimized to O(n log n) with sorting)

### Attractor Clustering
- **Distance Metric**: Euclidean distance in 3D C/E/G space
- **Probability**: Gaussian with σ = radius/2, weighted by attractor strength
- **5 pre-defined attractors** based on educational psychology research

### State Transition
- **Model**: Simple linear increments/decrements per intervention type
- **Can be enhanced** with: Markov chains, regression models, or neural networks

### Trajectory Planning
- **Strategy**: Greedy prioritization of largest deltas
- **Duration Estimation**: Fixed durations per intervention type
- **Success Probability**: Based on final distance from target (1 - distance/100)

## Next Steps (Not Implemented)

1. **Advanced Clustering**:
   - Dynamic attractor discovery via DBSCAN or k-means on historical data
   - Student-specific attractor customization

2. **Enhanced State Transition**:
   - Learn transition probabilities from historical data
   - Markov Decision Process for optimal policy

3. **Visualization Components**:
   - 3D scatter plot with state trajectory
   - Attractor basin heatmap
   - Pareto frontier objective space plot
   - Interactive trajectory editor

4. **API Endpoints**:
   - `/api/hyro/chart-space/:studentId/:statName`
   - `/api/hyro/pareto-content`
   - `/api/hyro/trajectory-plan`

5. **Testing**:
   - Unit tests for Pareto algorithm
   - Integration tests with real student data
   - Performance benchmarks for large content sets

## Performance Considerations

- **Pareto optimization**: O(n²) for n content items - consider caching for large sets
- **Attractor calculation**: O(1) for 5 fixed attractors
- **State history queries**: Indexed by (student_id, stat_name) for fast lookup
- **Trajectory planning**: O(1) for fixed 3 dimensions

## Files Modified
None - This is a net-new implementation with no modifications to existing files.

## Dependencies
- `better-sqlite3`: Database operations
- `crypto`: UUID generation for record IDs
- Existing Hyro Forge modules (forge-zpd-engine, forge-proficiency, forge-types)

---

**Created**: 2025-12-08  
**Author**: Claude Code Implementation  
**Status**: Complete and ready for testing
