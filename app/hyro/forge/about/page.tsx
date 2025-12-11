'use client';

/**
 * HYRO FORGE: About Page
 * Comprehensive documentation for parents, educators, and students
 * Explains the pedagogical foundations, system architecture, and learning pathway
 */

import React, { useState } from 'react';
import Link from 'next/link';

type TabId = 'overview' | 'pedagogy' | 'stats' | 'progression' | 'journey' | 'research';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '🎯' },
  { id: 'pedagogy', label: 'Pedagogy', icon: '📚' },
  { id: 'stats', label: '8 Core Stats', icon: '📊' },
  { id: 'progression', label: 'XP & Levels', icon: '⬆️' },
  { id: 'journey', label: 'Student Journey', icon: '🗺️' },
  { id: 'research', label: 'Research Basis', icon: '🔬' },
];

const STATS_DATA = [
  { name: 'Mathematics', icon: '📐', description: 'Quantitative reasoning, problem-solving, algebraic thinking', standards: 'CCSS.MATH' },
  { name: 'Reading & Language Arts', icon: '📚', description: 'Literacy, comprehension, communication, writing', standards: 'CCSS.ELA-LITERACY' },
  { name: 'Science', icon: '🔬', description: 'Scientific method, inquiry, analysis, experimentation', standards: 'NGSS' },
  { name: 'Coding & Logic', icon: '💻', description: 'Computational thinking, algorithms, programming', standards: 'CSTA' },
  { name: 'Study Skills', icon: '📓', description: 'Organization, time management, note-taking, self-regulation', standards: 'SEL/EF' },
  { name: 'Critical Thinking', icon: '🧠', description: 'Analysis, evaluation, synthesis, argumentation', standards: "Bloom's Taxonomy" },
  { name: 'Technology', icon: '🖥️', description: 'Digital citizenship, information literacy, tool proficiency', standards: 'ISTE' },
  { name: 'Problem Solving', icon: '🧩', description: 'Novel approaches, pattern recognition, transfer skills', standards: 'Cross-cutting' },
];

const LEVEL_PROGRESSION = [
  { level: 1, xp: 100, cumulative: 100, title: 'Apprentice Forger' },
  { level: 5, xp: 1118, cumulative: 2821, title: 'Apprentice Forger' },
  { level: 10, xp: 3162, cumulative: 15000, title: 'Journeyman Scholar' },
  { level: 20, xp: 8944, cumulative: 80000, title: 'Adept Thinker' },
  { level: 30, xp: 16432, cumulative: 220000, title: 'Specialist' },
  { level: 40, xp: 25298, cumulative: 450000, title: 'Expert' },
  { level: 50, xp: 35355, cumulative: 800000, title: 'Master Forger' },
];

const XP_SOURCES = [
  { source: 'Quest Completion', xp: '50-500', description: 'Complete assignments and projects' },
  { source: 'SRS Review', xp: '10/card', description: 'Practice flashcards with spaced repetition' },
  { source: 'Reading Session', xp: '30-100', description: 'Complete book chapters with comprehension' },
  { source: 'Diagnostic Test', xp: '25/question', description: 'Take assessments to calibrate skills' },
  { source: 'Daily Streak', xp: 'streak × 2', description: 'Maintain consistent daily engagement' },
  { source: 'Reflection', xp: '15-50', description: 'Write metacognitive journal entries' },
  { source: 'Discussion', xp: '15/exchange', description: 'Engage in Socratic dialogue about reading' },
  { source: 'Achievement', xp: 'varies', description: 'Unlock milestone achievements' },
];

const RESEARCH_BASIS = [
  { feature: 'Gamification', study: 'Hamari et al. (2014)', finding: '+14% motivation, +11% engagement in educational contexts' },
  { feature: 'Spaced Repetition', study: 'Karpicke & Roediger (2008)', finding: '2x retention vs. massed study over long term' },
  { feature: 'Immediate Feedback', study: 'Hattie (2009)', finding: 'Effect size 0.73 - among highest impact interventions' },
  { feature: 'Goal Setting', study: 'Locke & Latham (2002)', finding: 'Specific goals lead to higher performance than vague intentions' },
  { feature: 'Growth Mindset', study: 'Dweck (2006)', finding: 'Mastery framing correlates with resilience and persistence' },
  { feature: 'Self-Determination', study: 'Deci & Ryan (2000)', finding: 'Autonomy, competence, relatedness drive intrinsic motivation' },
  { feature: 'Metacognition', study: 'Zimmerman (2002)', finding: 'Self-regulated learners outperform peers academically' },
  { feature: 'Transfer Learning', study: 'Perkins & Salomon (1992)', finding: 'Cross-domain connections enhance application of knowledge' },
];

export default function ForgeAboutPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-purple-500/30 bg-black/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hyro/forge" className="text-purple-400 hover:text-purple-300 transition">
              ← Back to FORGE
            </Link>
            <div className="h-6 w-px bg-purple-500/30" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              About HYRO FORGE
            </h1>
          </div>
          <span className="text-sm text-purple-300/60">For Parents, Educators & Students</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-purple-500/20 bg-black/20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-purple-300 hover:bg-purple-500/20'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'pedagogy' && <PedagogyTab />}
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'progression' && <ProgressionTab />}
        {activeTab === 'journey' && <JourneyTab />}
        {activeTab === 'research' && <ResearchTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-purple-500/20 bg-black/20 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="text-purple-300/60 text-sm mb-3">
            HYRO FORGE - Evidence-Based Educational Gamification Platform
          </div>
          <Link
            href="/hyro/forge/architecture"
            className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition"
          >
            <span>🏗️</span>
            <span>View Technical Architecture & System Design</span>
            <span>→</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-8">
        <h2 className="text-4xl font-bold text-white mb-4">
          Transform Learning Into an Adventure
        </h2>
        <p className="text-xl text-purple-200/80 max-w-3xl mx-auto">
          HYRO FORGE combines proven educational science with game mechanics to create
          intrinsic motivation for K-12 students. Students don&apos;t just learn—they level up.
        </p>
      </div>

      {/* Key Features Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <FeatureCard
          icon="📊"
          title="8 Core Stats"
          description="Track growth across Mathematics, Reading, Science, Coding, Study Skills, Critical Thinking, Technology, and Problem Solving."
        />
        <FeatureCard
          icon="⬆️"
          title="XP & Leveling"
          description="Earn experience points through learning activities. Progress from Apprentice (Lv.1) to Master Forger (Lv.50+)."
        />
        <FeatureCard
          icon="🎴"
          title="Spaced Repetition"
          description="Built-in SRS flashcard system ensures long-term retention using scientifically-proven review intervals."
        />
        <FeatureCard
          icon="📖"
          title="Reading & Comprehension"
          description="Track reading progress, answer AI-evaluated comprehension prompts, and engage in Socratic discussions."
        />
        <FeatureCard
          icon="🔬"
          title="Adaptive Diagnostics"
          description="Periodic assessments identify skill gaps and calibrate stat values based on demonstrated competency."
        />
        <FeatureCard
          icon="🪞"
          title="Metacognitive Reflection"
          description="Journal prompts build self-awareness and self-regulated learning habits."
        />
      </div>

      {/* How It Works */}
      <div className="bg-black/30 rounded-xl p-8 border border-purple-500/30">
        <h3 className="text-2xl font-bold text-white mb-6 text-center">How It Works</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <StepCard number={1} title="Create Character" description="Sign up, choose goals, and initialize your 8 core stats at baseline level 20." />
          <StepCard number={2} title="Complete Activities" description="Do quests, review flashcards, read books, take diagnostics, and reflect." />
          <StepCard number={3} title="Earn XP & Level Up" description="Every activity earns XP. Accumulate enough to level up and earn new titles." />
          <StepCard number={4} title="Track Growth" description="Watch your stats grow over time. Parents and teachers see detailed progress reports." />
        </div>
      </div>

      {/* What Makes It Different */}
      <div className="bg-gradient-to-r from-purple-900/50 to-cyan-900/50 rounded-xl p-8 border border-purple-500/30">
        <h3 className="text-2xl font-bold text-white mb-6">What Makes FORGE Different?</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <DifferentiatorCard
            title="Not Extrinsic Rewards"
            wrong="Arbitrary points and badges disconnected from learning"
            right="XP tied directly to meaningful learning activities"
          />
          <DifferentiatorCard
            title="Not Punitive"
            wrong="Lose progress when you fail or miss days"
            right="Streaks encourage consistency; breaking one doesn't destroy progress"
          />
          <DifferentiatorCard
            title="Not Competitive Anxiety"
            wrong="Leaderboards that shame low performers"
            right="Personal progression by default; comparison is opt-in"
          />
          <DifferentiatorCard
            title="Not Content Gating"
            wrong="Lock students out until prerequisites complete"
            right="Recommendations guide, diagnostics unlock optimal paths"
          />
        </div>
      </div>
    </div>
  );
}

function PedagogyTab() {
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-white mb-4">Pedagogical Foundations</h2>
      <p className="text-purple-200/80 max-w-4xl">
        HYRO FORGE is built on decades of educational research. Every feature is designed
        with learning science in mind, not arbitrary game mechanics.
      </p>

      {/* Self-Determination Theory */}
      <TheoryCard
        title="Self-Determination Theory (Deci & Ryan)"
        description="SDT identifies three psychological needs that drive intrinsic motivation. FORGE addresses all three."
        points={[
          { need: 'Autonomy', implementation: 'Goal selection, quest choices, learning path freedom' },
          { need: 'Competence', implementation: 'Clear progression, leveling, stat growth, immediate feedback' },
          { need: 'Relatedness', implementation: 'Character identity, parent dashboards, future: peer connections' },
        ]}
      />

      {/* Flow State */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Flow State Optimization (Csikszentmihalyi)</h3>
        <p className="text-purple-200/80 mb-4">
          The nonlinear XP curve maintains challenge-skill balance:
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-red-900/30 rounded-lg p-4 border border-red-500/30">
            <div className="text-red-400 font-bold mb-2">Too Easy</div>
            <div className="text-sm text-red-200/60">Boredom → Disengage</div>
          </div>
          <div className="bg-green-900/30 rounded-lg p-4 border border-green-500/30">
            <div className="text-green-400 font-bold mb-2">Just Right</div>
            <div className="text-sm text-green-200/60">Flow → Intrinsic Motivation</div>
          </div>
          <div className="bg-orange-900/30 rounded-lg p-4 border border-orange-500/30">
            <div className="text-orange-400 font-bold mb-2">Too Hard</div>
            <div className="text-sm text-orange-200/60">Anxiety → Disengage</div>
          </div>
        </div>
      </div>

      {/* Bloom's Taxonomy */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Bloom&apos;s Taxonomy Integration</h3>
        <p className="text-purple-200/80 mb-4">
          Activities are designed to engage all cognitive levels:
        </p>
        <div className="space-y-2">
          {[
            { level: 'Remember', activity: 'SRS flashcard recognition', color: 'bg-blue-500' },
            { level: 'Understand', activity: 'Reading comprehension prompts', color: 'bg-green-500' },
            { level: 'Apply', activity: 'Quest problem-solving', color: 'bg-yellow-500' },
            { level: 'Analyze', activity: 'Discussion exchanges', color: 'bg-orange-500' },
            { level: 'Evaluate', activity: 'Critical thinking challenges', color: 'bg-red-500' },
            { level: 'Create', activity: 'Open-ended projects, reflections', color: 'bg-purple-500' },
          ].map((item) => (
            <div key={item.level} className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <span className="text-white font-medium w-28">{item.level}</span>
              <span className="text-purple-200/60">{item.activity}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Metacognition */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Metacognitive Scaffolding (Zimmerman)</h3>
        <p className="text-purple-200/80 mb-4">
          The reflection system prompts students to develop self-regulated learning:
        </p>
        <ul className="space-y-2 text-purple-200/80">
          <li className="flex items-start gap-2">
            <span className="text-purple-400">•</span>
            <span><strong>Evaluate</strong> what they learned today</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400">•</span>
            <span><strong>Identify</strong> confusion points and knowledge gaps</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400">•</span>
            <span><strong>Plan</strong> next steps and goals</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400">•</span>
            <span><strong>Monitor</strong> their own understanding over time</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function StatsTab() {
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-white mb-4">The 8 Core Stats</h2>
      <p className="text-purple-200/80 max-w-4xl">
        Rather than abstract grades, FORGE tracks 8 measurable competencies aligned with
        national educational standards. Each stat represents a domain of knowledge and skill.
      </p>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {STATS_DATA.map((stat) => (
          <div key={stat.name} className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{stat.icon}</span>
              <div>
                <h3 className="text-lg font-bold text-white">{stat.name}</h3>
                <span className="text-xs text-purple-400">{stat.standards}</span>
              </div>
            </div>
            <p className="text-purple-200/70 text-sm">{stat.description}</p>
          </div>
        ))}
      </div>

      {/* Stat Value Scale */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Stat Value Interpretation (0-100)</h3>
        <div className="space-y-4">
          {[
            { range: '0-19', label: 'Foundational', desc: 'Core concepts developing, needs significant support', color: 'bg-red-500' },
            { range: '20-39', label: 'Emerging', desc: 'Basic understanding, inconsistent application', color: 'bg-orange-500' },
            { range: '40-59', label: 'Developing', desc: 'Solid foundational skills, ready for enrichment', color: 'bg-yellow-500' },
            { range: '60-79', label: 'Proficient', desc: 'Strong command, can help peers', color: 'bg-green-500' },
            { range: '80-100', label: 'Advanced', desc: 'Expert-level understanding, ready for acceleration', color: 'bg-cyan-500' },
          ].map((level) => (
            <div key={level.range} className="flex items-center gap-4">
              <div className={`w-20 text-center py-1 rounded ${level.color} text-white text-sm font-bold`}>
                {level.range}
              </div>
              <div className="flex-1">
                <span className="text-white font-medium">{level.label}</span>
                <span className="text-purple-200/60 ml-2 text-sm">{level.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-purple-300/60 text-sm">
          Initial value: 20 (Emerging) for all stats. This assumes baseline competency with room to grow.
        </p>
      </div>

      {/* How Stats Change */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">How Stats Change</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-purple-400 border-b border-purple-500/30">
                <th className="pb-2">Event</th>
                <th className="pb-2">Stat Impact</th>
                <th className="pb-2">Notes</th>
              </tr>
            </thead>
            <tbody className="text-purple-200/80">
              <tr className="border-b border-purple-500/20">
                <td className="py-2">Quest Completion (80%+)</td>
                <td>+1 to +5</td>
                <td>Based on difficulty and score</td>
              </tr>
              <tr className="border-b border-purple-500/20">
                <td className="py-2">Diagnostic Assessment</td>
                <td>Recalibration</td>
                <td>Can go up OR down based on evidence</td>
              </tr>
              <tr className="border-b border-purple-500/20">
                <td className="py-2">SRS Card Mastered</td>
                <td>+0.5</td>
                <td>Per card reaching &quot;mastered&quot; status</td>
              </tr>
              <tr className="border-b border-purple-500/20">
                <td className="py-2">Reading Chapter Complete</td>
                <td>+1</td>
                <td>Requires 70%+ comprehension</td>
              </tr>
              <tr>
                <td className="py-2">Streak Milestone</td>
                <td>+0.5</td>
                <td>7-day, 30-day milestones boost Study Skills</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProgressionTab() {
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-white mb-4">XP & Leveling System</h2>
      <p className="text-purple-200/80 max-w-4xl">
        FORGE uses a nonlinear XP formula designed to maintain engagement over years of use.
        Early levels are achievable (quick wins), while later levels require deeper engagement.
      </p>

      {/* XP Formula */}
      <div className="bg-gradient-to-r from-purple-900/50 to-cyan-900/50 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">The XP Formula</h3>
        <div className="text-center py-4">
          <code className="text-2xl text-cyan-400 font-mono">
            XP_needed = 100 × (level ^ 1.5)
          </code>
        </div>
        <p className="text-purple-200/80 text-center mt-4">
          This creates exponential scaling that mirrors real learning curves—early progress is fast,
          mastery requires sustained effort.
        </p>
      </div>

      {/* Level Progression Table */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Level Progression</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-purple-400 border-b border-purple-500/30">
                <th className="pb-2">Level</th>
                <th className="pb-2">XP This Level</th>
                <th className="pb-2">Cumulative XP</th>
                <th className="pb-2">Title</th>
                <th className="pb-2">Typical Grade</th>
              </tr>
            </thead>
            <tbody className="text-purple-200/80">
              {LEVEL_PROGRESSION.map((row, i) => (
                <tr key={row.level} className={i < LEVEL_PROGRESSION.length - 1 ? 'border-b border-purple-500/20' : ''}>
                  <td className="py-2 font-bold text-white">{row.level}</td>
                  <td>{row.xp.toLocaleString()}</td>
                  <td>~{row.cumulative.toLocaleString()}</td>
                  <td className="text-cyan-400">{row.title}</td>
                  <td>{row.level <= 10 ? '3-4' : row.level <= 20 ? '5-6' : row.level <= 30 ? '7-8' : row.level <= 40 ? '9-10' : '11-12'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* XP Sources */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">How to Earn XP</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {XP_SOURCES.map((source) => (
            <div key={source.source} className="flex items-start gap-3 p-3 bg-black/20 rounded-lg">
              <div className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">
                {source.xp}
              </div>
              <div>
                <div className="text-white font-medium">{source.source}</div>
                <div className="text-purple-200/60 text-sm">{source.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pacing */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Expected Pacing</h3>
        <p className="text-purple-200/80 mb-4">
          With regular daily engagement (~500 XP/day average):
        </p>
        <ul className="space-y-2 text-purple-200/80">
          <li className="flex items-center gap-2">
            <span className="text-cyan-400">→</span>
            <strong className="text-white">Level 10:</strong> ~1 month
          </li>
          <li className="flex items-center gap-2">
            <span className="text-cyan-400">→</span>
            <strong className="text-white">Level 25:</strong> ~6 months
          </li>
          <li className="flex items-center gap-2">
            <span className="text-cyan-400">→</span>
            <strong className="text-white">Level 50:</strong> ~3-4 years (full K-12 journey)
          </li>
        </ul>
      </div>
    </div>
  );
}

function JourneyTab() {
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-white mb-4">The Student Journey</h2>
      <p className="text-purple-200/80 max-w-4xl">
        FORGE is designed to grow with students from grade school through graduation.
        Here&apos;s what a typical 9-year journey looks like.
      </p>

      {/* Journey Timeline */}
      <div className="space-y-6">
        <JourneyPhase
          grade="Grade 3-4"
          phase="Foundation"
          level="1-15"
          title="Apprentice Forger"
          color="bg-blue-500"
          activities={[
            'Complete onboarding and create character',
            'Take baseline diagnostic in all 8 stats',
            'Simple quests and guided reading',
            'Build first SRS decks',
            'Establish daily engagement habits',
          ]}
          outcomes={[
            'First achievements unlocked',
            'Parents receive weekly progress reports',
            'Core habits established',
          ]}
        />

        <JourneyPhase
          grade="Grade 5-6"
          phase="Skill Building"
          level="15-30"
          title="Journeyman Scholar"
          color="bg-green-500"
          activities={[
            'Strengthen weak stats through targeted quests',
            'Build comprehensive SRS decks',
            'Chapter books with comprehension prompts',
            'Begin daily reflections',
          ]}
          outcomes={[
            'Cross-domain connections emerge',
            '100-day streak achievement',
            'Can help younger peers',
          ]}
        />

        <JourneyPhase
          grade="Grade 7-8"
          phase="Deepening"
          level="25-40"
          title="Adept Thinker → Specialist"
          color="bg-yellow-500"
          activities={[
            'Pre-algebra → algebra progression',
            'Critical reading and analysis',
            'First coding projects',
            'Research quests with peer review',
          ]}
          outcomes={[
            'Stat specialization begins',
            'Advanced diagnostic unlocks',
            'Discussion excellence badges',
          ]}
        />

        <JourneyPhase
          grade="Grade 9-10"
          phase="Acceleration"
          level="35-45"
          title="Specialist → Expert"
          color="bg-orange-500"
          activities={[
            'Advanced courses integration',
            'SAT/ACT prep modules',
            'Complex multi-week projects',
            'AI tutor for challenging topics',
          ]}
          outcomes={[
            'College-ready benchmarks met',
            'Multiple stats at Proficient+',
            'Self-directed learning habits',
          ]}
        />

        <JourneyPhase
          grade="Grade 11-12"
          phase="Mastery"
          level="45-50+"
          title="Expert → Master Forger"
          color="bg-purple-500"
          activities={[
            'AP course integration',
            'Portfolio building',
            'Capstone projects',
            'Peer mentoring younger students',
          ]}
          outcomes={[
            'All stats 60+',
            'Master Forger title achieved',
            'Comprehensive learning portfolio for college',
          ]}
        />
      </div>

      {/* What Students Graduate With */}
      <div className="bg-gradient-to-r from-purple-900/50 to-cyan-900/50 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">What Students Graduate With</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-purple-200/80 flex items-start gap-2">
              <span className="text-green-400">✓</span>
              Comprehensive learning portfolio
            </div>
            <div className="text-purple-200/80 flex items-start gap-2">
              <span className="text-green-400">✓</span>
              Documented growth trajectory (stats over time)
            </div>
            <div className="text-purple-200/80 flex items-start gap-2">
              <span className="text-green-400">✓</span>
              College-ready skills validated by diagnostics
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-purple-200/80 flex items-start gap-2">
              <span className="text-green-400">✓</span>
              Self-regulation habits (reflection, SRS, goal-setting)
            </div>
            <div className="text-purple-200/80 flex items-start gap-2">
              <span className="text-green-400">✓</span>
              Intrinsic motivation patterns established
            </div>
            <div className="text-purple-200/80 flex items-start gap-2">
              <span className="text-green-400">✓</span>
              Years of achievement and progress data
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResearchTab() {
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-white mb-4">Research Foundation</h2>
      <p className="text-purple-200/80 max-w-4xl">
        Every feature in FORGE is backed by peer-reviewed educational research.
        This isn&apos;t gamification for its own sake—it&apos;s evidence-based design.
      </p>

      {/* Research Table */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Evidence Base</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-purple-400 border-b border-purple-500/30">
                <th className="pb-2">Feature</th>
                <th className="pb-2">Research</th>
                <th className="pb-2">Key Finding</th>
              </tr>
            </thead>
            <tbody className="text-purple-200/80">
              {RESEARCH_BASIS.map((row, i) => (
                <tr key={row.feature} className={i < RESEARCH_BASIS.length - 1 ? 'border-b border-purple-500/20' : ''}>
                  <td className="py-3 text-white font-medium">{row.feature}</td>
                  <td className="py-3 text-cyan-400">{row.study}</td>
                  <td className="py-3">{row.finding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Anti-Patterns */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Anti-Patterns We Avoid</h3>
        <p className="text-purple-200/80 mb-4">
          Research also shows what NOT to do. FORGE deliberately avoids these common mistakes:
        </p>
        <div className="space-y-4">
          <AntiPatternCard
            pattern="Over-reliance on extrinsic rewards"
            problem="Undermines intrinsic motivation (Deci, 1971)"
            solution="XP tied to meaningful learning, not arbitrary points"
          />
          <AntiPatternCard
            pattern="Punitive mechanics"
            problem="Creates anxiety and avoidance behavior"
            solution="Streaks encourage without punishing breaks"
          />
          <AntiPatternCard
            pattern="Social comparison pressure"
            problem="Can decrease motivation in lower performers (Dweck, 2006)"
            solution="Personal progression default; competitive features opt-in"
          />
          <AntiPatternCard
            pattern="Content gating"
            problem="Frustrates learners and limits exploration"
            solution="Recommendations guide; diagnostics unlock optimal paths"
          />
        </div>
      </div>

      {/* Standards Alignment */}
      <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Standards Alignment</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-black/20 rounded-lg">
            <div className="text-white font-bold mb-2">CCSS (Common Core)</div>
            <div className="text-purple-200/70 text-sm">Mathematics and ELA standards mapped to stats and curriculum</div>
          </div>
          <div className="p-4 bg-black/20 rounded-lg">
            <div className="text-white font-bold mb-2">NGSS (Next Generation Science)</div>
            <div className="text-purple-200/70 text-sm">Science practices and crosscutting concepts integrated</div>
          </div>
          <div className="p-4 bg-black/20 rounded-lg">
            <div className="text-white font-bold mb-2">CSTA (Computer Science)</div>
            <div className="text-purple-200/70 text-sm">Computational thinking and programming standards</div>
          </div>
          <div className="p-4 bg-black/20 rounded-lg">
            <div className="text-white font-bold mb-2">ISTE (Technology)</div>
            <div className="text-purple-200/70 text-sm">Digital citizenship and technology fluency</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component helpers
function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30 hover:border-purple-400/50 transition">
      <span className="text-3xl mb-3 block">{icon}</span>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-purple-200/70 text-sm">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center mx-auto mb-3">
        {number}
      </div>
      <h4 className="text-white font-bold mb-2">{title}</h4>
      <p className="text-purple-200/60 text-sm">{description}</p>
    </div>
  );
}

function DifferentiatorCard({ title, wrong, right }: { title: string; wrong: string; right: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-white font-bold">{title}</h4>
      <div className="flex items-start gap-2 text-sm">
        <span className="text-red-400">✗</span>
        <span className="text-red-200/70">{wrong}</span>
      </div>
      <div className="flex items-start gap-2 text-sm">
        <span className="text-green-400">✓</span>
        <span className="text-green-200/70">{right}</span>
      </div>
    </div>
  );
}

function TheoryCard({ title, description, points }: {
  title: string;
  description: string;
  points: { need: string; implementation: string }[]
}) {
  return (
    <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-purple-200/80 mb-4">{description}</p>
      <div className="space-y-3">
        {points.map((point) => (
          <div key={point.need} className="flex items-start gap-3">
            <div className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded min-w-[80px] text-center">
              {point.need}
            </div>
            <div className="text-purple-200/70 text-sm">{point.implementation}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyPhase({ grade, phase, level, title, color, activities, outcomes }: {
  grade: string;
  phase: string;
  level: string;
  title: string;
  color: string;
  activities: string[];
  outcomes: string[];
}) {
  return (
    <div className="bg-black/30 rounded-xl p-6 border border-purple-500/30">
      <div className="flex items-center gap-4 mb-4">
        <div className={`${color} text-white font-bold px-3 py-1 rounded`}>{grade}</div>
        <div className="text-white font-bold text-lg">{phase}</div>
        <div className="text-purple-400 text-sm">Level {level}</div>
        <div className="text-cyan-400 text-sm">{title}</div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-white font-medium mb-2">Key Activities</h4>
          <ul className="space-y-1">
            {activities.map((activity, i) => (
              <li key={i} className="text-purple-200/70 text-sm flex items-start gap-2">
                <span className="text-purple-400">•</span>
                {activity}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-white font-medium mb-2">Expected Outcomes</h4>
          <ul className="space-y-1">
            {outcomes.map((outcome, i) => (
              <li key={i} className="text-green-200/70 text-sm flex items-start gap-2">
                <span className="text-green-400">→</span>
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AntiPatternCard({ pattern, problem, solution }: { pattern: string; problem: string; solution: string }) {
  return (
    <div className="p-4 bg-black/20 rounded-lg">
      <div className="text-white font-medium mb-2">{pattern}</div>
      <div className="text-red-300/70 text-sm mb-1">Problem: {problem}</div>
      <div className="text-green-300/70 text-sm">Our approach: {solution}</div>
    </div>
  );
}
