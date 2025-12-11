# Hyro Education System - Curriculum Gaps & Roadmap

## Document Purpose

This document serves as a formal specification for future LLM sessions and developers working on the Hyro education system. It captures curriculum gaps, philosophical foundations, and implementation requirements that must NOT be lost in conversational chatter.

---

## Part 1: Current State Assessment

### Coverage Matrix (As of 2024)

```
Grade Level Coverage:
K-5  (Elementary):  ❌ NOT IMPLEMENTED
6-8  (Middle):      ✅ IMPLEMENTED (~155 standards, ~500 questions)
9-12 (High School): ❌ NOT IMPLEMENTED
```

### Implemented Domains (Grades 6-8 Only)

| Domain | Standards | Questions | Manifold Integration |
|--------|-----------|-----------|---------------------|
| Mathematics | ~40 CCSS | ~100 | ✅ Full C/E/G |
| English Language Arts | ~35 CCSS | ~80 | ✅ Full C/E/G |
| Science | ~25 NGSS | ~60 | ✅ Full C/E/G |
| Social Studies | ~20 C3 | ~50 | ✅ Full C/E/G |
| Critical Thinking | ~15 custom | ~80 | ✅ Full C/E/G |
| LLM Communications | ~10 custom | ~50 | ✅ Full C/E/G |
| Study Skills | ~10 custom | ~80 | ✅ Full C/E/G |

### Question Pool Assessment

- **Current**: ~500 questions
- **Recommended Minimum**: 1,500-2,000 questions
- **Gap**: Need 3-4x more questions for robust adaptive learning

---

## Part 2: High School Graduation Requirements

### Common Core State Standards (CCSS) - Mathematics (9-12)

**Total Standards Needed: ~80**

#### Algebra I (Essential)
- HSA-SSE: Seeing Structure in Expressions
- HSA-APR: Arithmetic with Polynomials
- HSA-CED: Creating Equations
- HSA-REI: Reasoning with Equations and Inequalities

#### Geometry (Essential)
- HSG-CO: Congruence
- HSG-SRT: Similarity, Right Triangles, Trigonometry
- HSG-C: Circles
- HSG-GPE: Expressing Geometric Properties with Equations
- HSG-GMD: Geometric Measurement and Dimension
- HSG-MG: Modeling with Geometry

#### Algebra II (Essential)
- HSA-SSE: Advanced expressions
- HSA-APR: Polynomial and rational expressions
- HSF-IF: Interpreting Functions
- HSF-BF: Building Functions
- HSF-LE: Linear, Quadratic, and Exponential Models
- HSF-TF: Trigonometric Functions

#### Statistics & Probability (Essential)
- HSS-ID: Interpreting Categorical and Quantitative Data
- HSS-IC: Making Inferences and Justifying Conclusions
- HSS-CP: Conditional Probability and Rules of Probability
- HSS-MD: Using Probability to Make Decisions

#### Pre-Calculus/Calculus (Advanced)
- HSN-CN: Complex Numbers
- HSN-VM: Vector and Matrix Quantities
- Limits and Continuity
- Derivatives and Applications
- Integrals and Applications

### Common Core State Standards (CCSS) - ELA (9-12)

**Total Standards Needed: ~60**

#### Reading Literature (RL.9-12)
- Key Ideas and Details
- Craft and Structure
- Integration of Knowledge and Ideas
- Range of Reading and Text Complexity

#### Reading Informational Text (RI.9-12)
- Key Ideas and Details
- Craft and Structure
- Integration of Knowledge and Ideas

#### Writing (W.9-12)
- Text Types and Purposes
- Production and Distribution
- Research to Build Knowledge
- Range of Writing

#### Speaking and Listening (SL.9-12)
- Comprehension and Collaboration
- Presentation of Knowledge and Ideas

#### Language (L.9-12)
- Conventions of Standard English
- Knowledge of Language
- Vocabulary Acquisition and Use

### Next Generation Science Standards (NGSS) - High School

**Total Standards Needed: ~50**

#### Physical Science
- HS-PS1: Matter and Its Interactions
- HS-PS2: Motion and Stability
- HS-PS3: Energy
- HS-PS4: Waves and Electromagnetic Radiation

#### Life Science
- HS-LS1: Molecules to Organisms
- HS-LS2: Ecosystems
- HS-LS3: Heredity
- HS-LS4: Biological Evolution

#### Earth and Space Science
- HS-ESS1: Earth's Place in the Universe
- HS-ESS2: Earth's Systems
- HS-ESS3: Earth and Human Activity

#### Engineering Design
- HS-ETS1: Engineering Design

### C3 Framework - Social Studies (9-12)

**Total Standards Needed: ~40**

#### Civics
- Civic and Political Institutions
- Participation and Deliberation
- Processes, Rules, and Laws

#### Economics
- Economic Decision Making
- Exchange and Markets
- The National Economy
- The Global Economy

#### Geography
- Geographic Representations
- Human-Environment Interaction
- Human Population

#### History
- Change, Continuity, and Context
- Perspectives
- Historical Sources and Evidence
- Causation and Argumentation

---

## Part 3: CRITICAL ADDITION - Behavioral Economics & Decision-Making

### Philosophical Foundation

**Why This Matters (Document for Future LLMs):**

The goal is NOT memorization. The goal is building a robust world model that enables effective decision-making. Students must understand:

1. **WHY** something is taught (metacognitive awareness)
2. **HOW** it connects to their existing knowledge (schema integration)
3. **WHEN** to apply it (transfer and generalization)
4. **WHERE** cognitive biases might lead them astray (epistemic humility)

### The "Decisive" Framework (Heath Brothers)

Reference: "Decisive: How to Make Better Choices in Life and Work" by Chip & Dan Heath

#### WRAP Process

1. **W**iden Your Options
   - Avoid narrow framing ("Should I do X or not?" → "What are ALL my options?")
   - Multi-track: Consider multiple options simultaneously
   - Find someone who's solved your problem

2. **R**eality-Test Your Assumptions
   - Consider the opposite (disconfirmation)
   - Zoom out (base rates, outside view)
   - Zoom in (close-up examination)
   - Ooch (small experiments)

3. **A**ttain Distance Before Deciding
   - Overcome short-term emotion
   - 10/10/10: How will I feel in 10 minutes, 10 months, 10 years?
   - What would I tell my best friend to do?
   - What would my successor do?

4. **P**repare to Be Wrong
   - Bookend the future (best case / worst case)
   - Set tripwires for when to reconsider
   - Prepare for the unexpected

### Heuristics & Biases Curriculum

**CRITICAL REQUIREMENT**: When teaching about biases, we must be EXPLICIT about:
- What the bias IS
- WHY it exists (often evolutionary)
- WHEN it helps vs. hurts
- HOW to recognize it in yourself
- WHAT to do about it

#### Core Biases to Teach (Priority Order)

1. **Confirmation Bias**
   - Definition: Seeking information that confirms existing beliefs
   - Why it exists: Cognitive efficiency, tribal belonging
   - Debiasing: Actively seek disconfirming evidence, pre-commitment to criteria

2. **Availability Heuristic**
   - Definition: Judging probability by ease of recall
   - Why it exists: Usually works (frequent = memorable)
   - Debiasing: Seek base rates, statistical thinking

3. **Anchoring Effect**
   - Definition: Over-reliance on first piece of information
   - Why it exists: Cognitive efficiency, sequential processing
   - Debiasing: Generate your own anchor first, consider multiple anchors

4. **Loss Aversion**
   - Definition: Losses feel ~2x worse than equivalent gains
   - Why it exists: Evolutionary (losing resources = death)
   - Debiasing: Reframe as gains, consider opportunity cost

5. **Sunk Cost Fallacy**
   - Definition: Continuing due to past investment
   - Why it exists: Consistency motivation, regret avoidance
   - Debiasing: Focus on future value only, "zero-based" thinking

6. **Fundamental Attribution Error**
   - Definition: Over-attributing others' behavior to character vs. situation
   - Why it exists: Cognitive simplicity, actor-observer asymmetry
   - Debiasing: Consider situational factors, perspective-taking

7. **Hindsight Bias**
   - Definition: "I knew it all along" after learning outcome
   - Why it exists: Narrative construction, memory reconstruction
   - Debiasing: Pre-register predictions, keep decision journals

8. **Overconfidence Bias**
   - Definition: Excessive confidence in own judgments
   - Why it exists: Social signaling, action motivation
   - Debiasing: Calibration training, seek feedback, consider alternatives

9. **Status Quo Bias**
   - Definition: Preference for current state
   - Why it exists: Loss aversion, effort conservation
   - Debiasing: Consider opportunity cost, imagine "if new what would I choose?"

10. **Dunning-Kruger Effect**
    - Definition: Low ability → overconfidence; High ability → underconfidence
    - Why it exists: Metacognitive limitations
    - Debiasing: Seek expert feedback, calibration practice

### Metacognition Integration

**Teaching metacognition explicitly:**

1. **Prediction Phase**
   - Before learning: "What do I think I know? How confident am I?"
   - Document predictions for later comparison

2. **Monitoring Phase**
   - During learning: "Does this make sense? What's confusing?"
   - Real-time comprehension checks

3. **Evaluation Phase**
   - After learning: "Was I right? Where was I wrong? Why?"
   - Calibration: Compare predictions to outcomes

4. **Regulation Phase**
   - Planning: "What strategy should I use?"
   - Adaptation: "Is my strategy working? Should I change?"

---

## Part 4: Manifold Dimensionality Integration

### Current Cognitive Manifold (C/E/G)

The learner's state is represented as a point in 3D space:

- **Coherence (C)**: 0-100 - Pattern recognition, logical consistency, ability to integrate information
- **Entropy (E)**: 0-100 - Comfort with uncertainty, exploration vs. exploitation, tolerance for ambiguity
- **Generativity (G)**: 0-100 - Creative synthesis, novel combinations, productive output

### Proposed Extensions for Behavioral Economics

#### New Dimension: Epistemic Calibration (EC)

**Purpose**: Track alignment between confidence and accuracy

```typescript
interface EpistemicCalibration {
  // Overall calibration score (0-100)
  // 50 = perfectly calibrated
  // >50 = underconfident
  // <50 = overconfident
  calibration_score: number;

  // Per-domain calibration
  domain_calibration: Record<string, number>;

  // Historical calibration trajectory
  calibration_history: Array<{
    timestamp: Date;
    predicted_confidence: number;
    actual_accuracy: number;
  }>;
}
```

#### New Dimension: Bias Awareness (BA)

**Purpose**: Track recognition and mitigation of cognitive biases

```typescript
interface BiasAwareness {
  // Per-bias recognition ability (0-100)
  bias_recognition: Record<BiasType, number>;

  // Per-bias mitigation success (0-100)
  bias_mitigation: Record<BiasType, number>;

  // Meta-awareness: knowing when you're likely to be biased
  situational_awareness: number;
}
```

#### New Dimension: Decision Quality (DQ)

**Purpose**: Track quality of decision-making process (not just outcomes)

```typescript
interface DecisionQuality {
  // Process quality metrics
  options_generated: number;  // Did they widen options?
  evidence_sought: number;    // Did they reality-test?
  distance_attained: number;  // Did they avoid emotional decisions?
  preparation_level: number;  // Did they prepare to be wrong?

  // Outcome tracking
  decision_outcomes: Array<{
    decision_id: string;
    process_quality: number;  // 0-100
    outcome_quality: number;  // 0-100
    was_luck_factor: boolean;
  }>;
}
```

### Integration with ZPD Engine

The Zone of Proximal Development must consider:

1. **Cognitive load** - Don't introduce bias training during high-stakes assessment
2. **Emotional state** - Bias awareness requires psychological safety
3. **Prior knowledge** - Build on existing decision-making experience
4. **Transfer potential** - Connect to real-world decisions student faces

---

## Part 5: Learning Techniques for the Manifold

### Techniques to Offload to Manifold (User = Manifold)

The following techniques should be tracked and developed at the Manifold level, making them available across all learning domains:

#### 1. Retrieval Practice
- **What**: Actively recalling information without looking
- **Why**: Strengthens memory more than re-reading
- **Manifold Tracking**: `retrieval_strength`, `spacing_optimization`

#### 2. Spaced Repetition
- **What**: Reviewing at increasing intervals
- **Why**: Optimizes long-term retention
- **Manifold Tracking**: `optimal_interval`, `forgetting_curve_params`

#### 3. Interleaving
- **What**: Mixing different topics/problem types
- **Why**: Improves discrimination and transfer
- **Manifold Tracking**: `interleave_benefit`, `topic_confusion_matrix`

#### 4. Elaborative Interrogation
- **What**: Asking "why" and "how" questions
- **Why**: Creates deeper connections
- **Manifold Tracking**: `elaboration_depth`, `connection_density`

#### 5. Concrete Examples
- **What**: Generating specific instances of abstract concepts
- **Why**: Grounds understanding in experience
- **Manifold Tracking**: `example_generation_facility`, `abstraction_grounding`

#### 6. Dual Coding
- **What**: Combining verbal and visual representations
- **Why**: Creates multiple retrieval paths
- **Manifold Tracking**: `visual_verbal_integration`, `modality_preference`

#### 7. Self-Explanation
- **What**: Explaining to yourself why something works
- **Why**: Reveals gaps, deepens understanding
- **Manifold Tracking**: `explanation_completeness`, `gap_detection`

#### 8. Deliberate Practice
- **What**: Focused practice on weaknesses with feedback
- **Why**: Targeted improvement
- **Manifold Tracking**: `weakness_identification`, `feedback_integration`

### Technique Effectiveness by Learner Profile

```typescript
interface LearnerTechniqueProfile {
  // Which techniques work best for this learner?
  technique_effectiveness: Record<Technique, {
    measured_effect_size: number;     // Empirical from their history
    predicted_effect_size: number;    // Model prediction
    confidence_interval: [number, number];
    sample_size: number;
  }>;

  // Optimal technique combinations
  technique_synergies: Array<{
    techniques: Technique[];
    combined_effect: number;
  }>;

  // Anti-patterns for this learner
  technique_interference: Array<{
    techniques: Technique[];
    negative_effect: number;
  }>;
}
```

---

## Part 6: Implementation Roadmap

### Phase 1: High School Core (Q1)

1. **Mathematics 9-12**
   - Algebra I: 15 standards, 100 questions
   - Geometry: 20 standards, 150 questions
   - Algebra II: 15 standards, 100 questions
   - Statistics: 10 standards, 75 questions

2. **ELA 9-12**
   - Literature Analysis: 15 standards, 80 questions
   - Rhetoric: 15 standards, 80 questions
   - Research: 10 standards, 60 questions

### Phase 2: Behavioral Economics (Q2)

1. **Heuristics & Biases Module**
   - 10 core biases with recognition exercises
   - Real-world scenario practice
   - Calibration training

2. **WRAP Decision Framework**
   - Structured decision templates
   - Case studies with analysis
   - Personal decision journaling

3. **Metacognition Enhancement**
   - Prediction → Monitoring → Evaluation cycle
   - Explicit "why we're learning this" integration
   - Understanding vs. Memorization tracking

### Phase 3: Manifold Extensions (Q3)

1. **New Dimensions**
   - Epistemic Calibration tracking
   - Bias Awareness metrics
   - Decision Quality process scoring

2. **Technique Optimization**
   - Per-learner technique profiles
   - Synergy detection
   - Anti-pattern avoidance

### Phase 4: Elementary & Advanced (Q4)

1. **Elementary (K-5)**
   - Age-appropriate standards
   - Foundational cognitive skills
   - Growth mindset foundations

2. **Advanced Placement**
   - AP-level content
   - College readiness
   - Specialized domains

---

## Part 7: Documentation Standards

### For Future LLM Sessions

When working on Hyro education system, future LLMs MUST:

1. **Read this document first** - It captures decisions that cannot be inferred from code alone

2. **Preserve the philosophical foundation**:
   - Teaching WHY, not just WHAT
   - Metacognition as core skill
   - Explicit bias awareness
   - Process over outcomes

3. **Maintain Manifold coherence**:
   - All new content must integrate with C/E/G dimensions
   - New dimensions must be mathematically consistent
   - Learning techniques tracked at Manifold level

4. **Respect the WRAP framework**:
   - Decision-making is explicit curriculum
   - Biases taught with full context (what/why/when/how)
   - Calibration is measurable

5. **Question pool requirements**:
   - Each standard needs 10-15 questions minimum
   - Questions must vary in difficulty (IRT calibrated)
   - Questions must test understanding, not memorization

### Code Documentation Requirements

All Hyro-related code MUST include:

```typescript
/**
 * @hyro-domain The curriculum domain (e.g., "behavioral_economics")
 * @hyro-standards Array of standards addressed (e.g., ["BE-1.1", "BE-1.2"])
 * @hyro-manifold How this integrates with C/E/G
 * @hyro-metacognition How this supports metacognitive development
 * @hyro-rationale WHY this exists (for learner transparency)
 */
```

---

## Appendix A: Common Core Standard Identifiers

### Mathematics Domains (High School)

- HSN: Number and Quantity
- HSA: Algebra
- HSF: Functions
- HSG: Geometry
- HSS: Statistics and Probability

### ELA Strands (High School)

- RL.9-10, RL.11-12: Reading Literature
- RI.9-10, RI.11-12: Reading Informational Text
- W.9-10, W.11-12: Writing
- SL.9-10, SL.11-12: Speaking and Listening
- L.9-10, L.11-12: Language

---

## Appendix B: Behavioral Economics Standards (Proposed)

### BE-1: Cognitive Biases

- BE-1.1: Identify confirmation bias in self and others
- BE-1.2: Apply availability heuristic awareness
- BE-1.3: Recognize and adjust for anchoring
- BE-1.4: Understand loss aversion in decision-making
- BE-1.5: Identify sunk cost fallacy patterns

### BE-2: Decision Frameworks

- BE-2.1: Apply WRAP process to complex decisions
- BE-2.2: Use 10/10/10 for emotional distance
- BE-2.3: Implement pre-commitment strategies
- BE-2.4: Create effective tripwires for decisions

### BE-3: Calibration

- BE-3.1: Make calibrated probability estimates
- BE-3.2: Track and improve prediction accuracy
- BE-3.3: Distinguish skill from luck in outcomes
- BE-3.4: Maintain decision journals effectively

### BE-4: Metacognition

- BE-4.1: Predict own learning and performance
- BE-4.2: Monitor comprehension in real-time
- BE-4.3: Evaluate learning strategy effectiveness
- BE-4.4: Regulate learning based on feedback

---

*Last Updated: [Auto-generated timestamp]*
*Document Version: 1.0*
*Maintainers: Hyro Education System Team*
