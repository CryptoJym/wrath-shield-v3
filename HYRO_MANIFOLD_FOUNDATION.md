# HYRO MANIFOLD: Foundation Architecture

## ARCHITECTURAL MANIFESTO

This document defines the **non-negotiable foundational principles** of the HYRO education system. The Manifold architecture is not a feature—it is the **substrate upon which all learning assessment flows**.

---

## Core Thesis

**Traditional education measures what a student knows. The Manifold measures what a student can become.**

The Generative Transfer Capacity (GTC) framework recognizes that the most valuable educational outcome is not knowledge accumulation but the ability to:
1. Synthesize across domains (Coherence)
2. Navigate uncertainty productively (Entropy)
3. Create novel value from understanding (Generativity)

---

## 1. The 3D State Vector Model

Every learner exists as a position in a 3-dimensional **Cognitive Manifold**:

```
         Generativity (G)
              ↑
              |    * ← Current state
              |   /
              |  /
              | /
              |/____________→ Entropy (E)
             /
            /
           /
          ↓
    Coherence (C)
```

### 1.1 Dimension Definitions

| Dimension | What It Measures | Low Score Indicator | High Score Indicator |
|-----------|------------------|---------------------|----------------------|
| **Coherence (C)** | Internal consistency of knowledge | Fragmented, contradictory understanding | Integrated, unified mental models |
| **Entropy (E)** | Ability to handle uncertainty/novelty | Rigid, needs structure | Comfortable with ambiguity, adapts |
| **Generativity (G)** | Capacity for novel value creation | Reproduces existing knowledge | Creates new connections, transfers |

### 1.2 State Vector Per Domain

Each academic domain has its own state vector:

```typescript
interface StateVector {
  stat_name: StatName;       // math, reading, science, etc.
  coherence: number;         // 0-100
  entropy: number;           // 0-100
  generativity: number;      // 0-100
  ci_low: number;            // Confidence interval lower bound
  ci_high: number;           // Confidence interval upper bound
  n_items_used: number;      // Evidence count
  signal_agreement: number;  // Cross-signal consistency
}
```

### 1.3 State Vector Calculation

State vectors are derived from LLM evaluation scores:

```typescript
// Coherence = validity + coherence + multi-model synthesis
coherence = (
  scores.validity * 0.3 +
  scores.coherence * 0.4 +
  meta.multi_model_coherence * 0.3
) * 100;

// Entropy = transfer ability + entropy intuition + identity elasticity
entropy = (
  scores.transfer * 0.4 +
  meta.entropy_intuition * 0.3 +
  meta.identity_elasticity * 0.3
) * 100;

// Generativity = utility + manifold fluidity + cooperative generativity
generativity = (
  scores.utility * 0.3 +
  meta.manifold_fluidity * 0.35 +
  meta.cooperative_generativity * 0.35
) * 100;
```

---

## 2. The 7 Meta-Generative Dimensions

Beyond domain-specific knowledge, the Manifold tracks **cross-cutting metacognitive capabilities** that predict learning potential:

### 2.1 Dimension Definitions

| Dimension | Description | What It Reveals |
|-----------|-------------|-----------------|
| **manifold_fluidity** | Navigation across conceptual spaces | Can the student shift frames? Apply patterns across domains? |
| **multi_model_coherence** | Synthesis across mental models | Can they hold multiple valid interpretations simultaneously? |
| **identity_elasticity** | Comfort with epistemic humility | Can they say "I don't know" without anxiety? |
| **gradient_awareness** | Recognition of own learning velocity | Do they sense when they're improving or struggling? |
| **entropy_intuition** | Sense for when structure helps vs. hinders | Do they know when to follow rules vs. improvise? |
| **non_dual_resolution** | Holding paradox without collapsing | Can they accept "both/and" rather than forcing "either/or"? |
| **cooperative_generativity** | Co-creation with other intelligences | Can they build on others' ideas generatively? |

### 2.2 Why These Matter

These dimensions are **invisible to traditional assessment**. A student who scores 95% on standardized tests may have:
- Low manifold_fluidity (stuck in subject silos)
- Low identity_elasticity (afraid to show uncertainty)
- Low non_dual_resolution (forces premature closure)

Such a student may perform well on known problems but struggle with novel challenges.

Conversely, a student with lower domain scores but high meta-generative capacity has **greater learning potential**.

---

## 3. Meta Probes: Specialized Assessment Items

The Manifold uses three categories of **meta probes** to elicit meta-generative evidence:

### 3.1 Frame Shift Probes

**Purpose**: Test ability to recognize deep structural similarities across domains.

**Example**: "Consider the Pythagorean theorem and musical harmony intervals. Both involve specific numerical relationships that create 'completeness.' Explore this connection..."

**Targets**: manifold_fluidity, multi_model_coherence

### 3.2 Entropy Compression Probes

**Purpose**: Test ability to find structure in apparent chaos and distill complexity without losing meaning.

**Example**: "Here's a list of numbers that seem random: 2, 3, 5, 9, 17, 33... Can you find the pattern? What strategy did you use?"

**Targets**: entropy_intuition, gradient_awareness

### 3.3 Non-Dual Synthesis Probes

**Purpose**: Test ability to hold paradox without forcing resolution.

**Example**: "'Practice makes perfect' vs. 'If you need to practice too much, maybe it's not your talent.' How can both be true?"

**Targets**: non_dual_resolution, identity_elasticity, manifold_fluidity

---

## 4. LLM-as-Evaluator Architecture

Human-graded rubrics cannot scale. The Manifold uses **LLM evaluation** (Opus 4.5) with structured output:

### 4.1 Evaluation Schema

```typescript
interface EvaluationResult {
  // Core Scores (0-1)
  scores: {
    validity: number;      // Is response relevant?
    coherence: number;     // Internal logical consistency
    transfer: number;      // Beyond rote recall?
    utility: number;       // Practical usefulness
    efficiency: number;    // Appropriate concision
  };

  // Meta Dimensions (0-1)
  meta: {
    manifold_fluidity: number;
    multi_model_coherence: number;
    identity_elasticity: number;
    gradient_awareness: number;
    entropy_intuition: number;
    non_dual_resolution: number;
    cooperative_generativity: number;
  };

  // Quality Control
  confidence: {
    overall: number;
    low_evidence_dims: string[];
  };

  evidence: {
    quotes: string[];        // Short excerpts from response
    observations: string[];  // Evaluator observations
  };

  flags: {
    overconfident: boolean;  // Certainty without evidence
    handwavy: boolean;       // Vague language masking gaps
    style_over_substance_risk: boolean;
  };
}
```

### 4.2 Evaluator Calibration

The evaluator is calibrated such that:
- A competent 5th grader scores **0.5-0.7** on grade-appropriate material
- Epistemic humility is **rewarded**, not penalized
- Rote regurgitation scores **lower** than creative application
- "I don't know, but here's how I'd approach it" beats confident wrongness

---

## 5. Database Schema (Non-Negotiable)

The Manifold requires these tables (Migration 041):

### 5.1 State Vectors

```sql
CREATE TABLE hyro_state_vectors (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  coherence REAL NOT NULL DEFAULT 50,
  entropy REAL NOT NULL DEFAULT 50,
  generativity REAL NOT NULL DEFAULT 50,
  components_json TEXT NOT NULL DEFAULT '{}',
  ci_low REAL NOT NULL DEFAULT 0,
  ci_high REAL NOT NULL DEFAULT 100,
  n_items_used INTEGER NOT NULL DEFAULT 0,
  signal_agreement REAL,
  UNIQUE(student_id, stat_name)
);
```

### 5.2 Meta Dimension Estimates

```sql
CREATE TABLE hyro_meta_dimension_estimates (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  dimension_name TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 50,
  ci_low REAL NOT NULL DEFAULT 0,
  ci_high REAL NOT NULL DEFAULT 100,
  evidence_json TEXT,
  n_observations INTEGER DEFAULT 0,
  confidence_level TEXT DEFAULT 'low',
  UNIQUE(student_id, dimension_name)
);
```

### 5.3 V2 Diagnostic Items

```sql
CREATE TABLE hyro_diagnostic_items_v2 (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,
  item_type TEXT NOT NULL,           -- mcq, short_answer, extended_response
  modality TEXT DEFAULT 'text',       -- text, image, code, mixed
  difficulty REAL DEFAULT 0.5,
  constructs_measured TEXT NOT NULL,  -- JSON array
  meta_probe_type TEXT,               -- frame_shift, entropy_compression, non_dual_synthesis
  target_meta_dimensions TEXT         -- JSON array
);
```

### 5.4 V2 Responses with LLM Evaluation

```sql
CREATE TABLE hyro_diagnostic_responses_v2 (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  response_text TEXT,
  llm_evaluation TEXT,               -- Full EvaluationResult JSON
  llm_model_used TEXT,
  score_validity REAL,
  score_coherence REAL,
  score_transfer REAL,
  score_utility REAL,
  score_efficiency REAL,
  meta_manifold_fluidity REAL,
  meta_multi_model_coherence REAL,
  meta_identity_elasticity REAL,
  meta_gradient_awareness REAL,
  meta_entropy_intuition REAL,
  meta_non_dual_resolution REAL,
  meta_cooperative_generativity REAL
);
```

---

## 6. Architectural Rules (MUST Follow)

### Rule 1: State Vectors Are Primary

Every assessment activity **MUST** update the relevant state vector. If an activity cannot produce state vector updates, it has no place in the Manifold.

### Rule 2: LLM Evaluation for Extended Responses

Any response longer than 50 words **MUST** be evaluated by the LLM evaluator. MCQ can use direct scoring, but all open-ended content flows through `forge-evaluator.ts`.

### Rule 3: Meta Probes in Every Diagnostic Session

A diagnostic session **MUST** include at least one meta probe. Domain-only assessment is incomplete assessment.

### Rule 4: Confidence Intervals Are Required

No state vector update without confidence interval update. Uncertainty must be tracked explicitly.

### Rule 5: Evidence Trail

Every meta dimension score **MUST** include evidence (quotes from student response). No score without justification.

### Rule 6: Multi-Modal Support

The schema supports image, code, and mixed modality items. New item types **MUST NOT** break this extensibility.

---

## 7. API Contract (v2 Diagnostic)

### 7.1 Start Session

```typescript
POST /api/hyro/forge/diagnostic
{
  action: 'start-session',
  studentId: string,
  statName?: StatName,           // null for meta-only session
  sessionType: 'domain' | 'meta' | 'full'
}
```

### 7.2 Get Next Item

```typescript
POST /api/hyro/forge/diagnostic
{
  action: 'next-item',
  sessionId: string
}
// Returns: diagnostic item or meta probe based on adaptive selection
```

### 7.3 Submit Response

```typescript
POST /api/hyro/forge/diagnostic
{
  action: 'submit-response',
  sessionId: string,
  itemId: string,
  response: {
    text?: string,
    optionId?: string,
    confidenceSelfReport?: number,
    timeMs: number
  }
}
// Triggers LLM evaluation for extended responses
// Returns: EvaluationResult + updated state vectors
```

### 7.4 Complete Session

```typescript
POST /api/hyro/forge/diagnostic
{
  action: 'complete-session',
  sessionId: string
}
// Returns: Final state vectors, meta dimension estimates, recommendations
```

---

## 8. Integration with Existing Systems

### 8.1 Proficiency System (`forge-proficiency.ts`)

State vectors **augment** the existing Bayesian proficiency tracking. They do not replace it.

```typescript
// Old: Single proficiency number per stat
{ stat: 'math', level: 65, confidence: 0.8 }

// New: Proficiency + State Vector
{
  stat: 'math',
  level: 65,                    // Traditional proficiency
  confidence: 0.8,
  state_vector: {
    coherence: 70,
    entropy: 55,
    generativity: 62
  },
  meta_dimensions: {
    manifold_fluidity: 0.6,
    // ...
  }
}
```

### 8.2 ZPD Engine (`forge-zpd-engine.ts`)

The ZPD engine uses state vectors to determine optimal challenge:

- **High Coherence, Low Entropy**: Ready for novel/ambiguous content
- **Low Coherence, High Entropy**: Needs structured practice
- **High Generativity**: Ready for transfer tasks
- **Low Generativity**: Focus on foundational understanding

### 8.3 Quest Generator (`forge-quest-generator.ts`)

Quests should target state vector weaknesses:

- Low entropy? Create quests with open-ended problems
- Low generativity? Create cross-domain application quests
- Low coherence? Create synthesis quests that integrate concepts

---

## 9. Implementation Checklist

### Core Infrastructure (Complete)

- [x] Migration 041: State vectors, meta dimensions, v2 items/responses
- [x] `forge-evaluator.ts`: LLM evaluation service
- [x] `app/api/hyro/state/route.ts`: State vector API
- [x] 6 seed meta probes (2 per type)
- [x] Evaluation criteria table with scoring anchors

### Integration (Complete)

- [x] v2 Diagnostic API: Meta probe administration (Rule 3 enforcement)
- [x] State vector updates from evaluation results (session completion)
- [x] Meta dimension aggregation across sessions
- [x] ZPD integration with state vectors (`getEnhancedZPDState`, `getManifoldZPDRecommendation`)
- [x] Quest generator targeting state vector weaknesses (`getWeakestStats` uses C/E/G)

### Frontend (Pending)

- [ ] State vector visualization (3D or radar chart)
- [ ] Meta dimension progress display
- [ ] Meta probe response interface
- [ ] Confidence calibration UI

---

## 10. Philosophy: Why This Matters

The traditional education system optimizes for **convergent thinking**: finding the one right answer.

The Manifold optimizes for **divergent capacity**: the ability to navigate uncertain terrain, synthesize across boundaries, and create value in novel situations.

In an age of AI, the students who will thrive are not those who can memorize and retrieve. They are those who can:

1. **Frame-shift**: See problems from multiple angles
2. **Handle entropy**: Navigate uncertainty without paralysis
3. **Generate**: Create novel solutions, not just reproduce known ones
4. **Meta-cognize**: Understand their own learning process

The Manifold doesn't just measure learning—it measures the **capacity to learn what hasn't been taught yet**.

---

## Appendix A: GTC Score Calculation

The Generative Transfer Capacity score is a weighted composite:

```typescript
function calculateGTCScore(scores: CoreScores): number {
  return (
    scores.validity * 0.15 +      // Base relevance
    scores.coherence * 0.20 +     // Logical consistency
    scores.transfer * 0.30 +      // Application ability (highest weight)
    scores.utility * 0.25 +       // Practical value
    scores.efficiency * 0.10      // Parsimony
  );
}
```

**Why these weights?**

Transfer (0.30) and utility (0.25) are weighted highest because they are the most predictive of generative capacity. A student who can transfer knowledge to new contexts and produce practically useful output demonstrates the core Manifold competencies.

---

## Appendix B: Seed Meta Probes

### Frame Shift: Pattern Bridge (probe_fs_01)

> Consider the Pythagorean theorem (a² + b² = c²) and the relationship between musical harmony intervals. Both involve specific numerical relationships that create "completeness" or "resolution."
>
> Explore this connection:
> 1. What patterns do you notice in how both work?
> 2. Can you think of another domain where similar patterns appear?
> 3. What might this tell us about how the universe organizes itself?

### Entropy Compression: Signal in Noise (probe_ec_01)

> Here is a list of numbers that seem random but actually follow a hidden pattern:
> 2, 3, 5, 9, 17, 33, ...
>
> Questions:
> 1. Can you find what pattern the sequence follows?
> 2. What strategy did you use to look for patterns?
> 3. Create your own "hidden pattern" sequence.

### Non-Dual Synthesis: Both True (probe_nd_01)

> Consider these pairs of statements. Both sides seem true, yet they seem to contradict:
>
> A) "Practice makes perfect" vs. "If you need to practice too much, maybe it's not your talent"
> B) "Be yourself" vs. "Always be learning and growing into someone new"
>
> How can both be true at the same time? Is it possible the contradiction itself teaches us something?

---

*Document Version: 1.0*
*Created: 2025-12-04*
*Architecture Owner: HYRO Forge Team*
