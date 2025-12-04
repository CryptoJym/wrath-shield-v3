# HYRO FORGE: Complete Adaptive Education System Architecture

## Executive Summary

After deep analysis of the existing codebase, Hyro Forge has a **solid foundation** with sophisticated components (Bayesian proficiency tracking, SM-2 SRS, AI evaluation). However, critical architectural gaps prevent it from functioning as a true **adaptive education system** that tests, identifies gaps, and systematically closes them.

---

## Part 1: What EXISTS (Strong Foundation)

### 1.1 Core Systems (Working)
| Component | Status | Location |
|-----------|--------|----------|
| Character/RPG System | Complete | `forge-types.ts` |
| 8 Stat Spider Graph | Complete | `forge-stats.ts` |
| XP/Leveling System | Complete | `forge-xp.ts` |
| Quest Generator | Complete | `forge-quest-generator.ts` |
| SM-2 SRS Flashcards | Complete | `forge-srs.ts` |
| Reading/Book Tracking | Complete | `forge-reading.ts` |
| Comprehension Prompts | Complete | `forge-comprehension.ts` |
| AI Response Evaluator | Complete | `forge-ai-evaluator.ts` |
| Parent Dashboard | Complete | `forge-parent-dashboard.ts` |
| Weekly Summaries | Complete | `forge-parent-dashboard.ts` |
| Daily Intel Feed | Complete | `forge-intel.ts` |
| Reflection Journal | Complete | `forge-reflections.ts` |
| Platform Connectors | Scaffolded | `connectors/` |
| Bayesian Proficiency | Complete | `forge-proficiency.ts` |
| Analytics/Behavior | Complete | `forge-analytics.ts` |

### 1.2 Sophisticated Features Already Built
- **Bayesian skill estimation** with confidence intervals and recency decay
- **Cascading AI evaluation** (rubric → history → LLM) like finance/smart-classify
- **Learning velocity tracking** (accelerating/steady/slowing)
- **Benchmark comparison** to 6th grade standards
- **Calibration tracking** (over/under confidence detection)

---

## Part 2: Critical GAPS (What's Missing)

### GAP 1: No Diagnostic Assessment System
**Problem**: System has `GRADE_6_BENCHMARKS` but no way to establish Hyro's actual baseline.
**Impact**: Can't identify gaps or measure growth.

**Solution**: Create `forge-diagnostics.ts`
```typescript
interface DiagnosticTest {
  id: string;
  stat_name: StatName;
  questions: DiagnosticQuestion[];
  time_limit_minutes: number;
  difficulty_curve: 'adaptive' | 'fixed';
}

interface DiagnosticResult {
  stat_name: StatName;
  estimated_level: number;
  confidence: number;
  identified_gaps: SkillGap[];
  recommended_focus: string[];
}
```

### GAP 2: No Zone of Proximal Development (ZPD) Engine
**Problem**: Proficiency is tracked but content isn't selected based on it.
**Impact**: Tasks may be too easy (boredom) or too hard (frustration).

**Solution**: Create `forge-zpd-engine.ts`
```typescript
function selectOptimalContent(params: {
  stat_name: StatName;
  current_level: number;
  confidence: number;
  recent_performance: number[];
}): ContentSelection {
  // Target ZPD: slightly above current ability
  // Optimal difficulty = current_level + (10 to 20 points)
  // Adjust based on recent performance trend
}
```

### GAP 3: No Skill-to-Content Mapping
**Problem**: Quests/SRS/Reading exist independently with no intelligent targeting.
**Impact**: Practice doesn't focus on actual weak areas.

**Solution**: Create `forge-content-mapper.ts`
```typescript
interface ContentMappedToSkill {
  content_id: string;
  content_type: 'quest' | 'srs_deck' | 'book_chapter' | 'comprehension';
  primary_stat: StatName;
  secondary_stats: StatName[];
  difficulty_level: number;
  prerequisite_skills: string[];
}
```

### GAP 4: No Mastery Detection
**Problem**: System tracks practice but not mastery thresholds.
**Impact**: May over-practice mastered concepts or abandon struggling ones.

**Solution**: Add mastery detection to proficiency
```typescript
interface MasteryState {
  concept_id: string;
  status: 'not_started' | 'learning' | 'approaching' | 'mastered';
  evidence_count: number;
  consecutive_success: number;
  confidence_threshold_met: boolean;
}

// Mastery = 3+ consecutive successes at 80%+ with confidence interval < 15
```

### GAP 5: No Learning Path Generator
**Problem**: No curriculum sequencing or "what next" recommendations.
**Impact**: Random practice instead of systematic skill building.

**Solution**: Create `forge-learning-paths.ts`
```typescript
interface LearningPath {
  id: string;
  stat_name: StatName;
  target_level: number;
  current_position: number;
  milestones: Milestone[];
  estimated_sessions: number;
}

function generateLearningPath(statName: StatName, targetLevel: number): LearningPath {
  // 1. Get current proficiency
  // 2. Identify skill gaps
  // 3. Order by prerequisite chain
  // 4. Create milestone checkpoints
}
```

### GAP 6: No Session Orchestrator
**Problem**: No intelligent daily session flow.
**Impact**: User must self-direct instead of following optimal sequence.

**Solution**: Create `forge-session-orchestrator.ts`
```typescript
interface SessionPlan {
  id: string;
  date: string;
  estimated_minutes: number;
  activities: SessionActivity[];
  stat_focus: StatName[];
  xp_potential: number;
}

function planOptimalSession(params: {
  available_minutes: number;
  energy_level?: number;
  streak_days: number;
  due_srs_count: number;
  active_quests: number;
}): SessionPlan {
  // 1. Start with SRS review (if due cards exist)
  // 2. Add reading segment (if book in progress)
  // 3. Add comprehension prompt
  // 4. Add quest work targeting weak stat
  // 5. End with reflection
}
```

### GAP 7: Platform Data Sync Not Implemented
**Problem**: Zearn connector exists but doesn't actually pull data.
**Impact**: External platform progress not reflected.

**Solution**: Implement actual Zearn sync in `connectors/zearn.ts`
```typescript
// Use Playwright to:
// 1. Login to Zearn
// 2. Scrape progress data
// 3. Map to skill evidence
// 4. Generate quests from incomplete lessons
```

### GAP 8: No Assignment/Grade Import
**Problem**: No way to import school assignments or grades.
**Impact**: School progress invisible to system.

**Solution**: Create `forge-school-import.ts`
```typescript
interface ImportedAssignment {
  source: 'manual' | 'google_classroom' | 'pdf_scan';
  subject: string;
  title: string;
  due_date: string;
  grade?: number;
  feedback?: string;
}

function importFromPDF(pdfPath: string): ImportedAssignment[];
function importFromGoogleClassroom(token: string): ImportedAssignment[];
```

### GAP 9: No Misconception Tracking
**Problem**: `common_misconceptions` field exists but isn't used.
**Impact**: Same misconceptions repeat without targeted remediation.

**Solution**: Create `forge-misconceptions.ts`
```typescript
interface TrackedMisconception {
  id: string;
  stat_name: StatName;
  topic: string;
  misconception_text: string;
  occurrences: number;
  last_seen: number;
  remediation_attempts: number;
  resolved: boolean;
}

function trackMisconception(response: ComprehensionResponse, detected: string[]): void;
function generateRemediationContent(misconceptionId: string): Quest | SRSCard[];
```

### GAP 10: No Engagement/Flow Optimization
**Problem**: No consideration of engagement, optimal session length, break timing.
**Impact**: Burnout or disengagement from too long/boring sessions.

**Solution**: Add to `forge-analytics.ts`
```typescript
interface EngagementMetrics {
  session_id: string;
  focus_decay_rate: number; // Derived from response times
  optimal_session_length: number; // Learned from historical data
  suggested_break_point: number;
  flow_state_indicators: {
    challenge_skill_balance: number;
    clear_goals: boolean;
    immediate_feedback: boolean;
  };
}
```

---

## Part 3: Implementation Roadmap

### Phase 1: Core Loop Completion (High Priority)
**Goal**: Close the learning feedback loop

1. **Diagnostic System** (`forge-diagnostics.ts`)
   - Initial assessment for all 8 stats
   - Question bank by difficulty
   - Adaptive difficulty adjustment
   - Gap identification output

2. **Session Orchestrator** (`forge-session-orchestrator.ts`)
   - Daily session planning
   - Activity sequencing
   - Time estimation
   - XP projection

3. **Mastery Detection** (enhance `forge-proficiency.ts`)
   - Mastery thresholds
   - Progress state machine
   - Auto-advancement triggers

### Phase 2: Adaptive Content Selection
**Goal**: Right content at the right time

4. **ZPD Engine** (`forge-zpd-engine.ts`)
   - Difficulty targeting
   - Performance-based adjustment
   - Frustration/boredom detection

5. **Content Mapper** (`forge-content-mapper.ts`)
   - Map all content to skills
   - Prerequisite chains
   - Cross-content relationships

6. **Learning Path Generator** (`forge-learning-paths.ts`)
   - Path generation
   - Milestone setting
   - Progress tracking

### Phase 3: Data Completeness
**Goal**: Full picture of learning

7. **Platform Sync** (implement `connectors/zearn.ts`)
   - Automated Zearn scraping
   - Progress mapping
   - Quest generation

8. **School Import** (`forge-school-import.ts`)
   - Manual entry UI
   - PDF parsing (report cards)
   - Grade mapping

9. **Misconception System** (`forge-misconceptions.ts`)
   - Detection from AI feedback
   - Tracking database
   - Remediation generation

### Phase 4: Engagement Optimization
**Goal**: Sustainable daily practice

10. **Engagement Analytics** (enhance `forge-analytics.ts`)
    - Focus decay detection
    - Optimal session length learning
    - Break recommendations

---

## Part 4: Database Schema Additions

```sql
-- Diagnostic tests and results
CREATE TABLE IF NOT EXISTS hyro_diagnostic_tests (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  question_count INTEGER,
  time_limit_minutes INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS hyro_diagnostic_results (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  estimated_level INTEGER,
  confidence REAL,
  identified_gaps TEXT, -- JSON
  raw_responses TEXT, -- JSON
  completed_at INTEGER,
  FOREIGN KEY (test_id) REFERENCES hyro_diagnostic_tests(id)
);

-- Learning paths
CREATE TABLE IF NOT EXISTS hyro_learning_paths (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,
  target_level INTEGER,
  current_milestone INTEGER DEFAULT 0,
  milestones TEXT, -- JSON
  status TEXT DEFAULT 'active',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Session plans
CREATE TABLE IF NOT EXISTS hyro_session_plans (
  id TEXT PRIMARY KEY,
  planned_date TEXT NOT NULL,
  activities TEXT, -- JSON
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  xp_potential INTEGER,
  xp_earned INTEGER,
  completion_rate REAL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Misconception tracking
CREATE TABLE IF NOT EXISTS hyro_misconceptions (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,
  topic TEXT NOT NULL,
  misconception_text TEXT,
  first_seen INTEGER,
  last_seen INTEGER,
  occurrence_count INTEGER DEFAULT 1,
  remediation_attempts INTEGER DEFAULT 0,
  resolved INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Content skill mapping
CREATE TABLE IF NOT EXISTS hyro_content_skill_map (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL, -- quest, srs_deck, book, chapter
  content_id TEXT NOT NULL,
  primary_stat TEXT NOT NULL,
  secondary_stats TEXT, -- JSON
  difficulty_level REAL,
  prerequisite_content TEXT, -- JSON
  created_at INTEGER DEFAULT (unixepoch())
);
```

---

## Part 5: Key Architectural Principles

### 5.1 The Learning Cycle
```
ASSESS → IDENTIFY GAPS → TARGET CONTENT → PRACTICE → EVALUATE → ADJUST
   ↑                                                              ↓
   └──────────────────────────────────────────────────────────────┘
```

### 5.2 Mastery-Based Progression
- Never advance until mastery confirmed
- Mastery = consistent performance + narrow confidence interval
- Spaced review after mastery to prevent decay

### 5.3 Zone of Proximal Development
- Content difficulty = current_level + 10-20%
- Too easy → increase difficulty
- Struggling → scaffold with easier content first

### 5.4 Evidence-Based Proficiency
- Every activity generates skill evidence
- Bayesian update after each evidence point
- Recency-weighted (recent performance matters more)

### 5.5 Engagement Sustainability
- Sessions capped at sustainable length
- Variety within sessions (don't do same thing for 30 min)
- Celebrate progress, not just completion

---

## Part 6: What to Build First

**If I could build only 3 things:**

1. **Diagnostic Assessment** - Can't improve what you can't measure
2. **Session Orchestrator** - Makes daily use seamless
3. **ZPD Engine** - Ensures content is appropriately challenging

These three create the minimal viable adaptive system:
- Assess where Hyro is
- Tell him what to do each day
- Make sure it's the right difficulty

---

## Part 7: Files to Create

```
lib/hyro/
├── forge-diagnostics.ts        # Diagnostic assessment system
├── forge-zpd-engine.ts         # Zone of Proximal Development
├── forge-content-mapper.ts     # Content-to-skill mapping
├── forge-mastery.ts            # Mastery detection
├── forge-learning-paths.ts     # Curriculum generation
├── forge-session-orchestrator.ts # Daily session planning
├── forge-school-import.ts      # Assignment/grade import
├── forge-misconceptions.ts     # Misconception tracking

app/hyro/forge/
├── diagnostic/page.tsx         # Take diagnostic test
├── session/page.tsx            # Daily session view
├── path/page.tsx               # Learning path view
└── import/page.tsx             # School data import
```

---

## Summary

**Hyro Forge has excellent components but lacks the ORCHESTRATION LAYER that makes it a true adaptive system.**

The existing proficiency system, SRS, reading tracker, and AI evaluator are sophisticated. But they operate independently without:
- Initial assessment to know where to start
- Intelligent content selection based on gaps
- Session planning to guide daily practice
- Mastery detection to know when to advance

**The gap is not the parts - it's the connective tissue that makes them work together as an adaptive learning system.**
