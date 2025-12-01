# PROJECT HYRO FORGE
## An AI-Native Education System for Accelerated Human Development

**Vision**: Sculpt a learner who can seamlessly navigate any domain by mastering the meta-skills of learning itself, while staying current with technology's bleeding edge.

---

## PART 1: THE PHILOSOPHICAL FRAMEWORK

### What Does Hyro Actually Need vs. What Society Says He Needs?

**Society Says** | **Reality Requires**
----------------|---------------------
Memorize facts | Pattern recognition across domains
Follow curriculum | Self-directed learning with AI augmentation
Handwrite essays | Articulate ideas through any medium (voice, code, text)
Pass standardized tests | Solve novel problems with available tools
Linear progression | Adaptive, interest-driven exploration

### The Three Pillars of Future-Proof Education

1. **FOUNDATION LAYER** - The bedrock skills that transfer everywhere
2. **META-LEARNING LAYER** - Learning how to learn (the force multiplier)
3. **CURRENT LAYER** - Daily connection to the cutting edge

---

## PART 2: FOUNDATION LAYER - The Unchanging Fundamentals

### A. Mathematical Reasoning (Not Computation)
- **Why**: Math is the language of logic, patterns, and proof
- **Focus Areas**:
  - Number sense and estimation (mental math)
  - Logical reasoning and proof construction
  - Spatial reasoning and visualization
  - Pattern recognition across sequences
  - Probability and Bayesian thinking
- **Current Status**: Zearn G6 M5 at 92% - EXCELLENT foundation

### B. Linguistic Articulation (Not Just Writing)
- **Why**: Ideas without expression are useless
- **Focus Areas**:
  - Argument construction (claim → evidence → reasoning)
  - Precise vocabulary (saying exactly what you mean)
  - Active listening and comprehension
  - Voice-to-text fluency (speak to write)
  - Reading for structure (how authors build arguments)
- **Current Status**: ~20% Boost mastery - NEEDS ATTENTION

### C. Physics/First Principles Thinking
- **Why**: Understanding cause and effect at the fundamental level
- **Focus Areas**:
  - Mechanics (forces, motion, energy)
  - Systems thinking (inputs → processes → outputs)
  - Estimation and Fermi problems
  - Real-world observation → hypothesis → test cycles
- **Implementation**: Integrate into daily life observations

### D. Base Logic & Computational Thinking
- **Why**: The structure beneath all reasoning
- **Focus Areas**:
  - If-then reasoning (conditionals)
  - Boolean logic (AND, OR, NOT)
  - Decomposition (breaking big problems into small ones)
  - Algorithm design (step-by-step procedures)
  - Variables and abstraction
- **Tools**: Scratch → Python → Prompt Engineering

### E. Problem Solving Framework
- **Why**: A reusable structure for any challenge
- **The FORGE Method**:
  1. **F**rame - What exactly is the problem? What do I know/need?
  2. **O**ptions - What are all possible approaches?
  3. **R**esearch - What tools/knowledge exist? Who solved similar?
  4. **G**enerate - Attempt a solution (fail fast is OK)
  5. **E**valuate - Did it work? What did I learn? Iterate.

---

## PART 3: META-LEARNING LAYER - The Force Multiplier

### "Make It Stick" Principles (Implemented via AI)

#### 1. Retrieval Practice (Testing Effect)
- **What**: Actively recall information instead of re-reading
- **AI Implementation**: Daily quiz generation from Zep memory
- **Frequency**: Every session starts with 5-minute retrieval warm-up
- **Memory**: Track performance to identify weak spots

#### 2. Spaced Repetition
- **What**: Review material at increasing intervals as it strengthens
- **AI Implementation**: Automated scheduling based on recall accuracy
- **Algorithm**: SM-2 variant with personal calibration
- **Memory**: Zep tracks last_reviewed, recall_score, next_review

#### 3. Interleaving
- **What**: Mix different types of problems/subjects
- **AI Implementation**: Daily sessions span 3+ domains
- **Structure**: Math → Logic → Current Events → Language → Reflection
- **Memory**: Track domain exposure balance

#### 4. Elaboration
- **What**: Connect new info to existing knowledge
- **AI Implementation**: "How does this relate to...?" prompts
- **Method**: Require explanation in own words
- **Memory**: Build knowledge graph connections

#### 5. Generation
- **What**: Attempt solution before seeing answer
- **AI Implementation**: Present problem → wait for attempt → reveal
- **Key**: Struggle is productive (desirable difficulties)
- **Memory**: Track generation vs. recall success rates

#### 6. Reflection
- **What**: Think about what you learned and how
- **AI Implementation**: End-of-session reflection prompts
- **Questions**: What surprised you? What was hard? What connects?
- **Memory**: Store insights for pattern analysis

#### 7. Calibration
- **What**: Accurate self-assessment of knowledge
- **AI Implementation**: Confidence ratings + actual performance
- **Tracking**: Overconfidence/underconfidence detection
- **Memory**: Calibration score over time

---

## PART 4: CURRENT LAYER - Staying on the Bleeding Edge

### Daily Intelligence Feed

#### Technology Reading (10-15 min/day)
- **Sources**:
  - Hacker News top 3
  - MIT Technology Review
  - AI-specific: The Batch (Andrew Ng), Import AI
- **Format**: AI-curated summaries + 1 deep dive per week
- **Discussion**: "What does this mean for the future?"

#### Science Reading (10-15 min/day)
- **Sources**:
  - Quanta Magazine
  - New Scientist
  - Popular Science
- **Format**: Age-appropriate summaries
- **Discussion**: "How would you test this?"

#### Implementation
```typescript
// Daily feed API endpoint
GET /api/hyro/daily-intel
{
  "tech": [
    { "title": "...", "summary": "...", "implications": "...", "discussion_prompt": "..." }
  ],
  "science": [...],
  "ai_update": {...}
}
```

### Weekly Deep Dives
- Pick ONE topic from the week's feeds
- Research for 30 minutes
- Create a 2-minute explanation (voice recorded)
- Store in Zep as knowledge artifact

---

## PART 5: SYSTEM ARCHITECTURE

### A. Hyro's Personal AI Tutor

#### Dedicated Zep Graph: `wrath-shield-hyro-student`

**Memory Categories**:
1. **knowledge** - Facts, concepts, skills learned
2. **performance** - Quiz results, accuracy, timing
3. **patterns** - Learning strengths/weaknesses
4. **schedule** - Spaced repetition queue
5. **progress** - Curriculum position, mastery levels
6. **reflections** - Personal insights, interests
7. **daily-intel** - Curated news/science summaries

#### AI Tutor Personality
```typescript
const HYRO_TUTOR_PROMPT = `
You are Hyro's personal AI tutor. You have access to his complete learning history through Zep memory.

Your approach:
1. Challenge without frustration - productive struggle is good
2. Always ask "why" and "how do you know?"
3. Connect new material to things Hyro already knows
4. Use his interests (${hyro.interests}) in examples
5. Never give answers directly - guide toward discovery
6. Track confidence vs. performance for calibration
7. Adapt difficulty based on recent performance

Current session focus: ${session.focus}
Recent weak areas: ${memory.weakAreas}
Spaced repetition due: ${memory.dueTodayTopics}
`;
```

### B. Clerk-Authenticated Student Portal

#### Routes
- `/hyro` - Hyro's dashboard (requires Clerk auth)
- `/hyro/learn` - Active learning session
- `/hyro/quiz` - Retrieval practice
- `/hyro/daily` - Daily intel feed
- `/hyro/progress` - Progress visualization
- `/hyro/reflect` - Reflection journal

#### Database Schema (SQLite)
```sql
-- Student profile
CREATE TABLE hyro_profile (
  user_id TEXT PRIMARY KEY,
  current_focus TEXT,
  streak_days INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- Spaced repetition queue
CREATE TABLE hyro_srs_queue (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  domain TEXT NOT NULL,
  difficulty REAL DEFAULT 0.5,
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  last_reviewed INTEGER,
  next_review INTEGER,
  last_quality INTEGER -- 0-5 scale
);

-- Session logs
CREATE TABLE hyro_sessions (
  id TEXT PRIMARY KEY,
  session_type TEXT, -- 'learn', 'quiz', 'reflect', 'daily'
  domains TEXT, -- JSON array
  duration_minutes INTEGER,
  performance_score REAL,
  notes TEXT,
  created_at INTEGER
);

-- Daily intel
CREATE TABLE hyro_daily_intel (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  tech_items TEXT, -- JSON
  science_items TEXT, -- JSON
  discussion_completed INTEGER DEFAULT 0,
  deep_dive_topic TEXT,
  created_at INTEGER
);
```

### C. Content Curation Pipeline

#### Daily Intel Generation (Cron Job)
```typescript
// runs at 6:00 AM daily
async function generateDailyIntel() {
  const techNews = await fetchHackerNews(5);
  const scienceNews = await fetchQuantaMagazine(3);

  // AI summarization for 6th grade level
  const summaries = await Promise.all([
    ...techNews.map(item => summarizeForHyro(item, 'tech')),
    ...scienceNews.map(item => summarizeForHyro(item, 'science')),
  ]);

  // Generate discussion prompts
  const intelWithPrompts = summaries.map(item => ({
    ...item,
    discussionPrompt: generateDiscussionPrompt(item),
    futureImplications: extractImplications(item),
  }));

  await saveDailyIntel(intelWithPrompts);
  await notifyHyro('New daily intel ready!');
}
```

---

## PART 6: COURSEWORK STRUCTURE

### Module 0: Learning How to Learn (First 2 Weeks)
**Goal**: Establish the meta-learning framework

1. **Day 1-2**: How memory works (encoding, storage, retrieval)
2. **Day 3-4**: Testing effect - why quizzing beats re-reading
3. **Day 5-6**: Spaced repetition - the forgetting curve
4. **Day 7**: Interleaving - mixing it up
5. **Day 8-9**: Elaboration - making connections
6. **Day 10**: Generation - struggle is learning
7. **Day 11-12**: Reflection - thinking about thinking
8. **Day 13-14**: Calibration - knowing what you know

**Assessment**: Design your own study plan using all 8 techniques

### Module 1: Language Arts Accelerator
**Goal**: Master articulation through AI-assisted practice

**Tools**:
- [Quill.org](https://www.quill.org/) - Grammar and writing (FREE)
- [NoRedInk](https://www.noredink.com/) - Interest-based grammar
- Custom AI writing tutor in Hyro portal

**Weekly Structure**:
- Mon: Grammar mechanics (Quill)
- Tue: Argument construction (AI tutor)
- Wed: Reading comprehension + summarization
- Thu: Creative expression (choice)
- Fri: Voice recording + review

### Module 2: Mathematical Reasoning Enhancement
**Goal**: Supplement Zearn with deeper thinking

**Continuation**: Zearn G6 M5 → M6 → Grade 7
**Enhancement**:
- Daily mental math warm-ups
- Weekly Fermi problem
- Monthly math puzzle/game session

### Module 3: Logic & Computation Foundations
**Goal**: Build algorithmic thinking

**Progression**:
1. Logic puzzles (deduction games)
2. Scratch programming
3. Python basics
4. Prompt engineering for AI tools

### Module 4: First Principles Thinking
**Goal**: Understand how things actually work

**Method**:
- Pick one system per week (car, internet, plant, etc.)
- Break down to fundamental components
- Rebuild understanding from first principles
- Document in "How Things Work" journal

---

## PART 7: IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Clerk authentication for Hyro's portal
- [ ] Create `hyro-student` Zep graph
- [ ] Build dashboard UI at `/hyro`
- [ ] Implement Module 0: Learning How to Learn
- [ ] Set up Quill.org and NoRedInk accounts

### Phase 2: Core Systems (Week 3-4)
- [ ] Build spaced repetition engine
- [ ] Create daily quiz generator
- [ ] Implement daily intel pipeline
- [ ] Build reflection journal feature
- [ ] Integrate AI tutor chat

### Phase 3: Content Integration (Week 5-6)
- [ ] Connect to Zearn progress API (if available) or manual sync
- [ ] Set up news/science feed curation
- [ ] Build progress visualization
- [ ] Create weekly deep dive system

### Phase 4: Refinement (Ongoing)
- [ ] Analyze learning patterns from Zep data
- [ ] Adjust difficulty curves
- [ ] Expand content sources
- [ ] Add gamification elements

---

## PART 8: SUCCESS METRICS

### Leading Indicators (Weekly)
- Session completion rate (target: 5/week)
- Retrieval accuracy trend
- Calibration score (confidence vs. performance)
- Streak maintenance

### Lagging Indicators (Monthly)
- Zearn progress rate
- Language arts mastery (Boost/Quill)
- Knowledge graph growth in Zep
- Deep dive quality (parent review)

### Ultimate Indicators (Quarterly)
- Can explain a novel concept to an adult
- Can learn a new skill faster than before
- Shows curiosity-driven exploration
- Uses AI tools productively

---

## APPENDIX: Resources

### Books for Parent Reference
- "Make It Stick" - Brown, Roediger, McDaniel
- "Teach Students How to Learn" - Saundra McGuire
- "A Mind for Numbers" - Barbara Oakley
- "Range" - David Epstein

### Technology Tools
- [Quill.org](https://www.quill.org/) - FREE AI writing/grammar
- [NoRedInk](https://www.noredink.com/) - Personalized grammar
- [Khanmigo](https://www.khanmigo.ai/) - AI tutor with voice
- [Zearn](https://www.zearn.org/) - Math curriculum
- [Scratch](https://scratch.mit.edu/) - Visual programming
- [Python.org](https://www.python.org/) - Programming language

### Daily Intel Sources
- [Hacker News](https://news.ycombinator.com/)
- [MIT Technology Review](https://www.technologyreview.com/)
- [Quanta Magazine](https://www.quantamagazine.org/)
- [The Batch](https://www.deeplearning.ai/the-batch/) - AI news
