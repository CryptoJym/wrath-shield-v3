# HYRO FORGE INVENTORY

*Last Updated: 2025-01-09*  
*Canonical Source of Truth for the Hyro Forge Educational RPG System*

---

## Table of Contents
- [Quick Reference](#quick-reference)
- [File Inventory](#file-inventory)
- [Database Schema](#database-schema)
- [Architectural Patterns](#architectural-patterns)

---

## Quick Reference

### 8-Stat System
`math` | `reading` | `science` | `coding` | `study_skills` | `critical_thinking` | `technology` | `problem_solving`

### Key Formulas
| Formula | Value |
|---------|-------|
| XP for Level n | `100 × n^1.5` |
| SM-2 Min Easiness | 1.3 |
| SM-2 Default Easiness | 2.5 |
| Bayesian Prior Mean | 50 |
| Bayesian Prior Variance | 400 |
| Recency Half-Life | 30 days |
| ZPD Optimal Offset | 0.12 |

### Level Progression
| Level | Title |
|-------|-------|
| 1 | Apprentice Forger |
| 5 | Journeyman Scholar |
| 10 | Adept Thinker |
| 15 | Master Learner |
| 20 | Sage of Knowledge |
| 25 | Grandmaster |
| 30 | Legendary Forger |

---

## File Inventory (26 files)

### Core Type System
| File | Lines | Purpose |
|------|-------|---------|
| forge-types.ts | ~357 | Core type definitions, constants |

**Key Exports:** `StatName`, `STAT_NAMES`, `LEVEL_TITLES`, `XPSource`, `QuestType`, `Character`, `Quest`, `Achievement`

### Experience & Progression
| File | Lines | Purpose |
|------|-------|---------|
| forge-xp.ts | ~378 | XP calculation, leveling |
| forge-stats.ts | ~300 | Character stats management |

**Tables:** `hyro_xp_log`, `hyro_characters`, `hyro_stat_values`  
**Key Functions:** `awardXP()`, `getXPProgress()`, `xpForLevel()`, `getOrCreateCharacter()`

### Learning Science
| File | Lines | Purpose |
|------|-------|---------|
| forge-srs.ts | ~511 | SM-2 Spaced Repetition |
| forge-zpd-engine.ts | ~822 | Zone of Proximal Development |
| forge-proficiency.ts | ~804 | Bayesian proficiency estimation |

**Tables:** `hyro_srs_decks`, `hyro_srs_cards`, `hyro_srs_reviews`, `hyro_skill_evidence`, `hyro_proficiency_snapshots`, `hyro_calibration_history`  
**Key Functions:** `createDeck()`, `reviewCard()`, `getDueCards()`, `getZPDState()`, `calculateBayesianProficiency()`

### Assessment
| File | Lines | Purpose |
|------|-------|---------|
| forge-diagnostics.ts | ~400 | Diagnostic assessments |
| forge-comprehension.ts | ~350 | Reading comprehension |
| forge-visual-assessment.ts | ~300 | Multi-modal assessment |
| forge-metacognition-scoring.ts | ~250 | PMRE scoring |

**Tables:** `hyro_diagnostic_sessions`, `hyro_diagnostic_responses`, `hyro_comprehension_assessments`, `hyro_visual_assessments`

### AI & Evaluation
| File | Lines | Purpose |
|------|-------|---------|
| forge-ai-tutor.ts | ~1101 | AI tutoring with parallel context |
| forge-evaluator.ts | ~596 | GTC Framework evaluation |
| forge-ai-evaluator.ts | ~300 | Cascading evaluation |
| forge-educational-prompts.ts | ~200 | Prompt templates |

**Tables:** `hyro_tutor_conversations`  
**Key Functions:** `chatAsync()`, `buildTutorContextAsync()`, `evaluateWithGTC()`

### Session & Planning
| File | Lines | Purpose |
|------|-------|---------|
| forge-session-orchestrator.ts | ~1018 | Session planning |
| forge-curriculum-planner.ts | ~600 | Curriculum planning |

**Tables:** `hyro_session_plans`, `hyro_curriculum_plans`, `hyro_learning_objectives`  
**Constants:** `DEFAULT_SESSION_MINUTES=45`, `MAX_SRS_CARDS_PER_SESSION=20`

### Quests & Gamification
| File | Lines | Purpose |
|------|-------|---------|
| forge-quest-generator.ts | ~1058 | Quest generation |

**Tables:** `hyro_quest_generators`, `hyro_quest_pool`, `hyro_quests`  
**Platforms:** Zearn, Boost, Lexia, Canyon Grove, Google Classroom

### Analytics & Dashboards
| File | Lines | Purpose |
|------|-------|---------|
| forge-analytics.ts | ~400 | Behavioral analytics |
| forge-parent-dashboard.ts | ~350 | Parent dashboard |
| forge-chart-space.ts | ~681 | Pareto/Attractors |

**Tables:** `hyro_analytics_events`, `hyro_state_history`, `hyro_attractor_assignments`, `hyro_pareto_selections`

### Content & Reflection
| File | Lines | Purpose |
|------|-------|---------|
| forge-reading.ts | ~450 | Reading management |
| forge-reflections.ts | ~300 | Reflection journal |

**Tables:** `hyro_books`, `hyro_reading_sessions`, `hyro_reflections`

### Communication
| File | Lines | Purpose |
|------|-------|---------|
| forge-alerts.ts | ~250 | Alert system |
| forge-email-templates.ts | ~200 | Email templates |
| forge-intel.ts | ~350 | Daily intel feed |

**Tables:** `hyro_alerts`, `hyro_intel_items`, `hyro_intel_feed`

### Experimentation
| File | Lines | Purpose |
|------|-------|---------|
| forge-metaproductivity.ts | ~400 | A/B testing |

**Tables:** `hyro_experiments`, `hyro_experiment_assignments`, `hyro_experiment_results`

---

## Database Schema (50+ Tables)

### Character & Identity
- `hyro_characters` - Player profiles
- `hyro_stat_values` - Current stat values
- `hyro_stat_history` - Stat change history

### XP & Achievements
- `hyro_xp_log` - XP transactions
- `hyro_achievements` - Unlocked achievements
- `hyro_streaks` - Streak tracking

### Spaced Repetition
- `hyro_srs_decks` - Card decks
- `hyro_srs_cards` - Individual cards
- `hyro_srs_reviews` - Review history

### Proficiency & ZPD
- `hyro_skill_evidence` - Evidence records
- `hyro_proficiency_snapshots` - Point-in-time snapshots
- `hyro_calibration_history` - Calibration data
- `hyro_state_history` - C/E/G state vectors

### Assessment
- `hyro_diagnostic_sessions` - Diagnostic sessions
- `hyro_diagnostic_responses` - Diagnostic responses
- `hyro_comprehension_assessments` - Comprehension tests
- `hyro_comprehension_responses` - Comprehension answers
- `hyro_visual_assessments` - Visual assessments
- `hyro_visual_responses` - Visual responses

### Quests
- `hyro_quest_generators` - Quest templates
- `hyro_quest_pool` - Available quests
- `hyro_quests` - Active/completed quests

### Analytics
- `hyro_analytics_events` - Event log
- `hyro_engagement_metrics` - Engagement data
- `hyro_pareto_selections` - Pareto decisions
- `hyro_attractor_assignments` - Attractor states

### Content
- `hyro_books` - Reading library
- `hyro_reading_sessions` - Reading sessions
- `hyro_reading_progress` - Reading progress
- `hyro_reflections` - Journal entries
- `hyro_reflection_prompts` - Reflection prompts

### AI/Tutor
- `hyro_tutor_conversations` - Tutor chat history

### Curriculum
- `hyro_curriculum_plans` - Curriculum plans
- `hyro_learning_objectives` - Learning goals
- `hyro_session_plans` - Session plans

### Communication
- `hyro_alerts` - Alert queue
- `hyro_alert_preferences` - Alert settings
- `hyro_intel_items` - Intel content
- `hyro_intel_feed` - Daily feed

### Experimentation
- `hyro_experiments` - A/B tests
- `hyro_experiment_assignments` - User assignments
- `hyro_experiment_results` - Test results

---

## Architectural Patterns

### 1. 8-Stat System
```typescript
type StatName = 'math' | 'reading' | 'science' | 'coding' 
  | 'study_skills' | 'critical_thinking' | 'technology' | 'problem_solving';
```

### 2. XP Progression Formula
```typescript
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}
// Level 1: 100 XP, Level 10: 3,162 XP, Level 30: 16,432 XP
```

### 3. SM-2 Spaced Repetition
```typescript
const SM2_MIN_EASINESS = 1.3;
const SM2_DEFAULT_EASINESS = 2.5;
// Easiness adjustment: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
// Interval: n=1 → 1 day, n=2 → 6 days, n>2 → I(n-1) × EF
```

### 4. Bayesian Proficiency Estimation
```typescript
const PRIOR_MEAN = 50;
const PRIOR_VARIANCE = 400;
const RECENCY_HALF_LIFE_DAYS = 30;
// Conjugate normal updates with exponential recency decay
```

### 5. ZPD Engine (C/E/G Manifold)
```typescript
interface StateVector {
  coherence: number;   // 0-1: Understanding consistency
  entropy: number;     // 0-1: Uncertainty/variability
  generativity: number; // 0-1: Creative application ability
}
const OPTIMAL_OFFSET = 0.12; // Challenge = proficiency + 12%
```

### 6. GTC Evaluation Framework
```typescript
// 5 Core Scores
const GTC_WEIGHTS = {
  transfer: 0.30,    // Can apply to new contexts
  utility: 0.25,     // Practical value
  coherence: 0.20,   // Internal consistency
  validity: 0.15,    // Factual accuracy
  efficiency: 0.10   // Resource optimization
};
// + 7 Meta-generative dimensions
```

### 7. Pareto Optimization
Multi-objective content selection optimizing across:
- Skill development
- Engagement
- Time efficiency
- Learning objectives alignment

### 8. Attractor Fields
```typescript
type AttractorState = 'flow' | 'confusion' | 'boredom' | 'frustration' | 'discovery';
// Each state maps to specific intervention strategies
```

---

*This document is the canonical source of truth for the Hyro Forge implementation.*  
*For updates, regenerate from source files in `/lib/hyro/`.*
