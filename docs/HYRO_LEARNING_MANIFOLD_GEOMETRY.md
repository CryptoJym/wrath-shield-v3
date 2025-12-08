# HYRO Learning Manifold Geometry
_Manifold + Graph as Information Architecture for Adaptive Paths_

## 1. Purpose

This document defines the **geometry of learning** in Hyro Forge.

It formalizes:

- The **state manifold** (C/E/G + latent dimensions),
- The **attractor fields** (flow, confusion, boredom, frustration, discovery),
- The **objective space** for optimization (learning gain, engagement, efficiency, transfer),
- The **knowledge graph geometry** (concept relations, prerequisites, misconceptions),
- And the **update rules** that turn all of this into an adaptive education path.

The goal: make Hyro's path updates **geometrically grounded**, not ad-hoc heuristics.

---

## 2. Core Objects

### 2.1 Learner State Vector

For each learner `L` at time `t`, we maintain a **high-dimensional state vector**:

```ts
type LearnerState = {
  // Core 3D control manifold
  C: number; // Coherence        [0..100]
  E: number; // Entropy/Stability (higher = more noise/instability) [0..100]
  G: number; // Generativity     [0..100]

  // Cognitive components (subvector)
  components: {
    perception: number;         // signal extraction
    model_coherence: number;    // internal model accuracy
    transfer: number;           // zero/few-shot application
    output_utility: number;     // usefulness of produced artifacts
    efficiency: number;         // time/effort vs gain
  };

  // Meta-generative dimensions (7D)
  meta: {
    manifold_fluidity: number;
    multi_model_coherence: number;
    identity_elasticity: number;
    gradient_awareness: number;
    entropy_intuition: number;
    non_dual_resolution: number;
    cooperative_generativity: number;
  };

  // Affective/engagement scalars
  affect: {
    arousal: number;     // energy / activation
    valence: number;     // pleasantness/unpleasantness
    persistence: number; // stick-with-it-ness
  };

  // Knowledge mastery snapshot (link to graph)
  mastery: {
    // concept_id -> mastery estimate
    [conceptId: string]: number; // 0..1
  };

  updatedAt: number; // timestamp
};
```

**Interpretation:**

- The 3D (C, E, G) projection is the **control manifold** we use for path decisions.
- The rest (components, meta, affect, mastery) is the **full latent state** that informs C/E/G and more advanced decisions.

### 2.2 C/E/G Manifold (Existing)

This is the 3D state space where each learner is a point:

| Dimension | Description |
|-----------|-------------|
| **Coherence (C)** | Internal consistency of knowledge and predictions; how well their current mental model fits observed data. |
| **Entropy (E)** | Uncertainty, volatility, and tolerance for novelty. High E can mean productive exploration or chaotic confusion; E must be interpreted in context with C and G. |
| **Generativity (G)** | Ability to produce novel, useful connections: explanations, analogies, solutions, creative variations. |

This manifold is already implemented as part of the ZPD engine and learning state estimation.

### 2.3 Attractor Fields (Existing)

In (C, E, G) space we define 5 attractor basins as prototype centroids:

| Attractor | C | E | G | Characteristics |
|-----------|---|---|---|-----------------|
| **Flow** | 75 | 35 | 70 | Optimal learning state, deep engagement |
| **Confusion** | 35 | 75 | 45 | Fragmented understanding, high uncertainty |
| **Boredom** | 80 | 25 | 30 | Strong understanding but low challenge |
| **Frustration** | 30 | 80 | 25 | Weak understanding, high challenge |
| **Discovery** | 55 | 60 | 75 | Active exploration, creative learning |

These points define the center of attractor basins. The system computes:

```ts
state.attractor = argmin_attractor(distance((C,E,G), attractor.centroid));
```

…using a suitable distance metric (e.g. Euclidean with per-axis weights).

These attractors are used to:
- Diagnose current learner mode,
- Predict likely next mode under different actions,
- Choose interventions (e.g., if drifting toward frustration, reduce difficulty & increase structure).

### 2.4 Pareto Frontier in Objective Space (Existing)

The system already optimizes content selection over a 4D objective space:

```ts
type ObjectiveVector = {
  learning_gain: number;
  engagement: number;
  efficiency: number;
  transfer_potential: number;
};
```

For a given learner state, we select from the Pareto front the item(s) whose trajectory effect (expected ΔC, ΔE, ΔG) best serves the current strategy.

---

## 3. Geometry as Information Architecture

Here is what "geometry" means in Hyro Forge at the architectural level.

### 3.1 Manifold Geometry (C/E/G and Beyond)

This is the **continuous view** of learning:

- Each learner is a moving point in the C/E/G space.
- The path is their learning trajectory over time.
- Attractor basins define stable behavioral regimes.

**Manifold geometry lets us:**
- Predict where a student is heading,
- Estimate when to intervene,
- Shape interventions as vector changes: "We want to increase C by ~10, lower E by ~15, keep G high."

### 3.2 Graph Geometry (Knowledge Graph)

The knowledge graph is the **discrete relational topology** of the curriculum/concept space:

```ts
type ConceptNode = {
  id: string;
  label: string;
  domain: string; // math, reading, etc.
  prerequisites: string[]; // ids
  related: string[];       // lateral links
  misconceptions: string[]; // misconception ids
};

type MisconceptionNode = {
  id: string;
  label: string;
  conceptId: string;
  pattern: string; // pattern of error
};
```

This graph encodes:
- **Prerequisite chains:** what must be understood before what;
- **Lateral links:** cross-topic analogies and transfer opportunities;
- **Misconception clusters:** recurring error patterns anchored to concepts.

**Graph geometry lets us:**
- See WHY a student is stuck (prereq missing or misconception active),
- Identify valid next concepts (topology),
- Map out reachability and "coverage" of the domain.

### 3.3 Dual Representation: Manifold + Graph

Hyro models learning as:

| View | Purpose |
|------|---------|
| **Graph** | Where you can go (legal concept transitions, prerequisite constraints) |
| **Manifold** | How you're moving (trajectory quality in C/E/G + meta space) |

Every learning step is:

```ts
(nextConcept, nextActivity) = argmin_over_neighbors_in_graph(
  cost_of_move(currentState, neighbor, activity)
);
```

where `cost_of_move` is defined in terms of expected change in:
- C/E/G (manifold),
- objectives (learning_gain, engagement, efficiency, transfer),
- and graph-level metrics (closing prereqs, resolving misconceptions).

**In other words: we compute graph-constrained geodesics in the learning manifold.**

---

## 4. Update Dynamics (How the Path is Updated)

### 4.1 Events as Micro-Steps

Every learner interaction emits an event on the Redis bus:

| Event | Trigger |
|-------|---------|
| `answer.submitted` | Student answers a question |
| `hint.requested` | Student asks for help |
| `session.started` | Learning session begins |
| `session.ended` | Learning session ends |
| `metacog.prompt_responded` | Student responds to reflection prompt |

The event loop does:

**1. State update**
- Update mastery estimates (Bayesian/probabilistic),
- Update C/E/G based on performance, timing, and meta signals,
- Update meta dimensions from behavior.

**2. Attractor detection**
- Recompute distance to attractors,
- Flag if the learner is entering/leaving a basin.

**3. Graph update**
- Mark concepts as stronger/weaker in the mastery map,
- Update misconception counts; create/strengthen misconception nodes/edges if patterns repeat.

**4. Trajectory planning (micro-planning)**
- Use current (C, E, G) + attractor + knowledge graph topology
- Select next concept & activity via graph-constrained optimization in objective space.

### 4.2 Local Update Rule (Per Step)

At each step, we compute a candidate set of next moves:
- Neighboring concepts in the knowledge graph (prereqs satisfied or nearly satisfied),
- Activities associated with those concepts (different modalities, difficulty levels, generative vs practice tasks).

For each candidate `(concept, activity)`, we estimate:
- Expected ΔC, ΔE, ΔG,
- Expected objective vector,
- Impact on misconceptions and graph coverage.

We then choose a move that approximates a **geodesic step** toward desired target regions:
- **Short-term:** toward Flow or Discovery attractors,
- **Long-term:** toward high Coherence, medium Entropy, high Generativity, and full domain coverage.

This is classical **multi-objective control on a manifold**, constrained by the graph structure.

---

## 5. Geometry as Information Architecture: Open Tasks

As of now, the following are **not fully built** and are required to complete the geometry:

### 5.1 Relational Graph Geometry (Graphiti)
Concrete schema and integration for:
- Concept nodes, misconception nodes, edges,
- Temporal/episodic links between sessions and concepts,
- Queries like "what minimal concept set explains these errors?"

### 5.2 Trajectory Optimization ("Geodesics")
Formalize the cost function for paths through the graph given:
- Current learner state,
- Target states (short- and long-term),
- Constraints (time, test requirements like Common Core).

Implement path planners that approximate shortest/steepest paths in C/E/G + objectives space.

### 5.3 Pattern Recognition Across the Manifold
Detect when a learner is:
- approaching a particular attractor (e.g. early-stage frustration),
- stuck in a local basin (e.g. chronic low G, medium C, medium E),
- or displaying rare trajectories (e.g. very high G with high E, low C = "creative chaos").

Use this to trigger meta-level interventions.

---

## 6. HGM (Huxley–Gödel Machine) and Geometric Self-Optimization

The HGM sits above the learner dynamics and **updates the field itself**:

It runs experiments on:
- different cost function weights,
- different attractor definitions,
- different metacognitive prompt policies,
- different ZPD offsets / difficulty adaptation rules.

### 6.1 Autonomy Thresholds

To avoid chaotic regime shifts:

**Auto-apply threshold:**
Only allow HGM to autonomously change parameters when:
- `p < 0.01` (strong evidence change is not random),
- `Cohen's d > 0.8` (large effect size).

**Parameter bounds (without human approval):**
- Limit each autonomous change to **±5%** of the current value.
- Larger changes require human review.

This ensures the field is reshaped gradually and only when evidence is strong.

---

## 7. Metacognition (PMRE) as Geometry Regulator

Metacognition (Planning, Monitoring, Regulation, Evaluation) is not just "extra prompts"; it is a **control system over the learner's own manifold**:

| PMRE Dimension | Effect on Meta-State |
|----------------|---------------------|
| **Planning** | Nudges `identity_elasticity` and `manifold_fluidity` |
| **Monitoring** | Enhances `gradient_awareness` and `entropy_intuition` |
| **Regulation** | Reduces harmful high-E states toward structured exploration |
| **Evaluation** | Reinforces `model_coherence` and `non_dual_resolution` |

### 7.1 Frequency Geometry

We use an **adaptive frequency**:

- ❌ Not every problem (too much noise)
- ❌ Not fixed every 3rd problem (ignores state)
- ❌ Not only on obvious struggle (misses subtle needs)
- ✅ **Adaptive based on each learner's calibration profile and current state**

**Implementation:**
- Track calibration: confidence vs correctness, variability.
- **Increase PMRE prompts** when:
  - calibration is poor (over/underconfidence),
  - entropy is high with low coherence,
  - or attractor shifts indicate confusion/frustration.
- **Decrease** when:
  - learner shows stable, accurate self-monitoring,
  - flow/discovery states are robust.

Metacognition thus becomes a **dynamic regulator on the learner manifold**.

---

## 8. Implementation Priorities (Geometry-First View)

From a geometry standpoint, build in this order:

1. **Formalize LearnerState & C/E/G projection** as the canonical manifold.
2. **Integrate Redis event loop** so state updates and path updates are event-driven.
3. **Implement Graphiti-based knowledge graph** (concepts, prerequisites, misconceptions, temporality).
4. **Define and implement local path update rule:**
   - graph-constrained candidate generation,
   - C/E/G + objective-based selection.
5. **Add adaptive PMRE metacognitive layer** using state and calibration.
6. **Bring HGM online** with:
   - A/B experiments,
   - p/d thresholds,
   - ±5% bounded parameter updates.

---

## 9. Summary

Hyro's "geometry" is not school geometry; it is the **information architecture of learning**:

| Layer | Description |
|-------|-------------|
| **Manifold** | C/E/G + meta state space |
| **Graph** | Knowledge and misconceptions topology |
| **Objectives** | 4D outcomes space |

**Path updates are graph-constrained geodesics in the manifold**, driven by multi-objective optimization and regulated by metacognition.

**The HGM is the outer loop** that incrementally improves the field itself using careful, evidence-based deformations.

This document is the blueprint for making the system's behavior **mathematically coherent** rather than heuristic.
