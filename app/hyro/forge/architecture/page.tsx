'use client';

/**
 * HYRO FORGE: Architecture & Pedagogy Visualization
 * Interactive visual representation of the complete FORGE system
 * Shows curricula, agents, dimensions, and how everything connects
 */

import React, { useState } from 'react';
import Link from 'next/link';

type ViewMode = 'system' | 'curricula' | 'agents' | 'dimensions' | 'flow' | 'spheregrid' | 'meta';

const VIEW_TABS: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'system', label: 'System Overview', icon: '🏗️' },
  { id: 'curricula', label: 'Curricula (5)', icon: '📚' },
  { id: 'agents', label: 'AI Agents', icon: '🤖' },
  { id: 'dimensions', label: 'Manifold Dimensions', icon: '🌀' },
  { id: 'spheregrid', label: 'Sphere Grid', icon: '🔮' },
  { id: 'meta', label: 'Meta-Learning', icon: '🧬' },
  { id: 'flow', label: 'Learning Flow', icon: '🔄' },
];

// ============================================================================
// CURRICULA DATA - What's Actually Built
// ============================================================================

const CURRICULA_DATA = {
  behavioralEconomics: {
    name: 'Behavioral Economics',
    icon: '🧠',
    status: 'complete',
    standards: 'BE-1.1 through BE-4.4',
    biasCount: 15,
    biases: [
      'Anchoring', 'Availability Heuristic', 'Bandwagon Effect', 'Confirmation Bias',
      'Dunning-Kruger Effect', 'Endowment Effect', 'Framing Effect', 'Halo Effect',
      'Hindsight Bias', 'Loss Aversion', 'Optimism Bias', 'Planning Fallacy',
      'Recency Bias', 'Status Quo Bias', 'Sunk Cost Fallacy'
    ],
    framework: 'WRAP Framework (Heath Brothers)',
    wrapSteps: [
      { letter: 'W', name: 'Widen Your Options', desc: 'Avoid narrow framing' },
      { letter: 'R', name: 'Reality-Test Assumptions', desc: 'Seek disconfirming evidence' },
      { letter: 'A', name: 'Attain Distance', desc: 'Overcome short-term emotion' },
      { letter: 'P', name: 'Prepare to Be Wrong', desc: 'Plan for uncertainty' },
    ],
    keyResearchers: ['Kahneman & Tversky', 'Thaler', 'Ariely', 'Heath Brothers'],
    color: 'from-amber-500 to-orange-500',
  },
  decisionFramework: {
    name: 'Decision Science',
    icon: '🎯',
    status: 'complete',
    standards: 'DS-1.1 through DS-4.4',
    components: [
      {
        name: 'Pre-Mortem Analysis',
        researcher: 'Gary Klein',
        steps: 6,
        desc: 'Imagine failure, identify causes, create tripwires'
      },
      {
        name: 'Nudge/Choice Architecture',
        researcher: 'Thaler & Sunstein',
        types: 12,
        desc: '12 nudge types for ethical choice design'
      },
      {
        name: 'Probabilistic Thinking',
        researcher: 'Annie Duke',
        desc: 'Calibrated uncertainty and decision quality'
      },
    ],
    nudgeTypes: [
      'Default Option', 'Feedback Loop', 'Simplification', 'Social Proof',
      'Salience', 'Commitment Device', 'Implementation Intention', 'Cooling-Off Period',
      'Structured Choice', 'Mapping', 'Error Expected', 'Incentive Alignment'
    ],
    color: 'from-blue-500 to-cyan-500',
  },
  neuroscience: {
    name: 'Learning Neuroscience',
    icon: '🔬',
    status: 'complete',
    principles: [
      { name: 'Spacing Effect', category: 'memory', effect: 'Distributed practice > massed practice' },
      { name: 'Retrieval Practice', category: 'memory', effect: 'Testing > re-reading' },
      { name: 'Interleaving', category: 'memory', effect: 'Mixed practice > blocked practice' },
      { name: 'Sleep Consolidation', category: 'memory', effect: 'Memory consolidation during sleep' },
      { name: 'Cognitive Load', category: 'attention', effect: 'Optimize working memory limits' },
      { name: 'Focused/Diffuse Modes', category: 'attention', effect: 'Alternate between modes' },
      { name: 'Yerkes-Dodson Law', category: 'motivation', effect: 'Optimal arousal for performance' },
    ],
    keyResearchers: ['Gazzaniga', 'Eagleman', 'LeDoux', 'Sapolsky', 'Dehaene', 'Oakley'],
    cegIntegration: true,
    color: 'from-purple-500 to-pink-500',
  },
  patternRecognition: {
    name: 'Pattern Recognition & Medici Effect',
    icon: '🔗',
    status: 'complete',
    standards: 'PR-1.* through PR-4.*',
    patternTypes: [
      'Proportional Relationship', 'Exponential Growth/Decay', 'Feedback Loops',
      'Threshold Effects', 'Trade-offs', 'Network Effects', 'Emergence',
      'Equilibrium', 'Cycles/Oscillations', 'Power Laws'
    ],
    abstractionLevels: ['surface', 'structural', 'deep', 'meta'],
    keyResearchers: ['Frans Johansson (Medici Effect)', 'Herbert Simon', 'Douglas Hofstadter'],
    color: 'from-teal-500 to-emerald-500',
  },
  testoutConfidence: {
    name: 'Testout Confidence Engine',
    icon: '🎓',
    status: 'complete',
    standards: 'CC-TEST-1.* through CC-TEST-3.*',
    confidenceCategories: [
      'not_ready', 'needs_more_prep', 'approaching_ready',
      'likely_ready', 'highly_confident', 'recommend_now'
    ],
    factors: {
      masteryBased: ['averageMastery', 'lowestMastery', 'coreStandardsMastery', 'masteredStandardsRatio'],
      performanceBased: ['practiceTestAverage', 'recentTrend', 'consistencyScore', 'highStakesPerformance'],
      behavioral: ['studyTimeLastWeek', 'practiceProblemsLastWeek', 'engagementScore', 'selfEfficacyScore'],
    },
    purpose: 'Canyon Grove competency testing readiness',
    color: 'from-rose-500 to-red-500',
  },
};

// ============================================================================
// AGENTS DATA - The 4 Hyro Agents
// ============================================================================

const AGENTS_DATA = [
  {
    id: 'agent.hyro.assessment',
    name: 'Assessment Agent',
    icon: '📊',
    role: 'Analyzes current proficiency and knowledge state',
    capabilities: [
      'IRT-based ability estimation',
      'Standard error calculation',
      'Gap identification',
      'Misconception detection',
    ],
    phase: 'parallel',
    color: 'bg-blue-500',
  },
  {
    id: 'agent.hyro.content',
    name: 'Content Agent',
    icon: '📚',
    role: 'Selects optimal learning materials',
    capabilities: [
      'ZPD-calibrated content selection',
      'Difficulty matching',
      'Prerequisites checking',
      'Resource recommendation',
    ],
    phase: 'parallel',
    color: 'bg-green-500',
  },
  {
    id: 'agent.hyro.tutor',
    name: 'Tutor Agent (Sage)',
    icon: '🧙',
    role: 'Synthesizes and delivers Socratic instruction',
    capabilities: [
      'Socratic questioning',
      'Growth mindset messaging',
      'Personalized explanations',
      'Quest generation',
    ],
    phase: 'sequential',
    color: 'bg-purple-500',
  },
  {
    id: 'agent.hyro.progress',
    name: 'Progress Agent',
    icon: '📈',
    role: 'Background tracking and analytics',
    capabilities: [
      'XP calculation',
      'Streak tracking',
      'Achievement detection',
      'Parent report generation',
    ],
    phase: 'fire_and_forget',
    color: 'bg-orange-500',
  },
];

const WORKFLOWS = [
  {
    name: 'Tutoring Session',
    id: 'TUTORING_SESSION_WORKFLOW',
    phases: [
      { type: 'parallel', agents: ['Assessment', 'Content'] },
      { type: 'sequential', agents: ['Tutor (Sage)'], dependsOn: 'Phase 1' },
      { type: 'fire_and_forget', agents: ['Progress'] },
    ],
  },
  {
    name: 'Quick Check-in',
    id: 'QUICK_CHECKIN_WORKFLOW',
    phases: [
      { type: 'sequential', agents: ['Assessment'] },
      { type: 'sequential', agents: ['Tutor (Sage)'] },
    ],
  },
  {
    name: 'Deep Diagnostic',
    id: 'DEEP_DIAGNOSTIC_WORKFLOW',
    phases: [
      { type: 'parallel', agents: ['Assessment', 'Content'] },
      { type: 'sequential', agents: ['Assessment (deep)'], dependsOn: 'Phase 1' },
      { type: 'sequential', agents: ['Tutor (Sage)'] },
      { type: 'fire_and_forget', agents: ['Progress'] },
    ],
  },
];

// ============================================================================
// MANIFOLD DIMENSIONS DATA
// ============================================================================

const DIMENSIONS_DATA = [
  {
    name: 'Coherence',
    abbrev: 'C',
    icon: '🔗',
    color: 'from-blue-500 to-blue-600',
    description: 'How well concepts connect and integrate',
    metrics: ['Knowledge integration', 'Cross-domain connections', 'Mental model accuracy'],
    highSignals: ['Explains connections between concepts', 'Transfers knowledge to new domains'],
    lowSignals: ['Isolated facts', 'Unable to see relationships'],
  },
  {
    name: 'Entropy',
    abbrev: 'E',
    icon: '🌊',
    color: 'from-purple-500 to-purple-600',
    description: 'Uncertainty and knowledge gaps',
    metrics: ['Standard error', 'Confidence intervals', 'Knowledge boundary clarity'],
    highSignals: ['Many unknowns', 'Inconsistent performance', 'Unclear mastery boundaries'],
    lowSignals: ['Stable performance', 'Clear understanding boundaries'],
    inverted: true,
  },
  {
    name: 'Generativity',
    abbrev: 'G',
    icon: '✨',
    color: 'from-green-500 to-green-600',
    description: 'Ability to produce novel insights and solutions',
    metrics: ['Creative problem-solving', 'Novel approaches', 'Original thinking'],
    highSignals: ['Creates new solutions', 'Asks insightful questions', 'Extends concepts'],
    lowSignals: ['Rote application only', 'Follows templates exactly'],
  },
];

// ============================================================================
// STATS DATA
// ============================================================================

const STATS_DATA = [
  { name: 'Mathematics', icon: '📐', abbrev: 'math', standards: 'CCSS.MATH' },
  { name: 'Reading', icon: '📚', abbrev: 'reading', standards: 'CCSS.ELA' },
  { name: 'Science', icon: '🔬', abbrev: 'science', standards: 'NGSS' },
  { name: 'Coding', icon: '💻', abbrev: 'coding', standards: 'CSTA' },
  { name: 'Study Skills', icon: '📓', abbrev: 'study_skills', standards: 'SEL/EF' },
  { name: 'Critical Thinking', icon: '🧠', abbrev: 'critical_thinking', standards: 'Bloom\'s' },
  { name: 'Technology', icon: '🖥️', abbrev: 'technology', standards: 'ISTE' },
  { name: 'Problem Solving', icon: '🧩', abbrev: 'problem_solving', standards: 'Cross-cutting' },
];

// ============================================================================
// CORE SYSTEMS DATA
// ============================================================================

const CORE_SYSTEMS = [
  // Orchestration Layer
  {
    name: 'Forge Orchestrator',
    files: ['forge-orchestrator.ts (90KB)', 'forge-session-orchestrator.ts'],
    desc: 'Multi-agent coordination with IRT-based assessment',
    status: 'built',
    category: 'orchestration',
  },
  {
    name: 'Domain Agents',
    files: ['forge-domain-agents.ts', 'hyro-agents.ts'],
    desc: 'Specialized AI agents for tutoring workflows',
    status: 'built',
    category: 'orchestration',
  },
  // Learning Engine Layer
  {
    name: 'ZPD Engine',
    files: ['forge-zpd-engine.ts'],
    desc: 'Zone of Proximal Development challenge calibration',
    status: 'built',
    category: 'engine',
  },
  {
    name: 'Proficiency System',
    files: ['forge-proficiency.ts', 'forge-stats.ts'],
    desc: 'Stat tracking and competency estimation',
    status: 'built',
    category: 'engine',
  },
  {
    name: 'AI Tutor (Sage)',
    files: ['forge-ai-tutor.ts'],
    desc: 'Socratic tutoring with Zep memory integration',
    status: 'built',
    category: 'engine',
  },
  {
    name: 'Diagnostics',
    files: ['forge-diagnostics.ts', 'forge-ai-evaluator.ts'],
    desc: 'Adaptive assessment with convergence detection',
    status: 'built',
    category: 'engine',
  },
  {
    name: 'Generative Engine',
    files: ['forge-generative-engine.ts', 'forge-quest-generator.ts'],
    desc: 'Dynamic content and quest generation',
    status: 'built',
    category: 'engine',
  },
  // Meta-Learning Layer
  {
    name: 'Meta-Learner',
    files: ['forge-meta-learner.ts'],
    desc: '"Ultimate Level Up Machine" - Trajectory pattern learning',
    status: 'built',
    category: 'meta',
  },
  {
    name: 'Meta-Dimensions',
    files: ['forge-meta-dimensions.ts'],
    desc: 'Higher-order learning capabilities tracking',
    status: 'built',
    category: 'meta',
  },
  {
    name: 'Metacognition Scoring',
    files: ['forge-metacognition-scoring.ts', 'forge-metacognition-prompts.ts'],
    desc: '4 dimensions: planning, monitoring, evaluation, regulation',
    status: 'built',
    category: 'meta',
  },
  {
    name: 'HGM Optimizer',
    files: ['forge-hgm-optimizer.ts'],
    desc: 'Parameter safety checks for meta-learning',
    status: 'built',
    category: 'meta',
  },
  // Curriculum Layer
  {
    name: 'Standards Taxonomy',
    files: ['forge-standards-taxonomy.ts (83KB)', 'forge-standards-mapping.ts'],
    desc: 'Complete CCSS/NGSS standards with C/E/G mapping',
    status: 'built',
    category: 'curriculum',
  },
  {
    name: 'Grade Benchmarks',
    files: ['forge-grade-benchmarks.ts'],
    desc: 'Grade-level expectations and progressions',
    status: 'built',
    category: 'curriculum',
  },
  {
    name: 'Curriculum Planner',
    files: ['forge-curriculum-planner.ts'],
    desc: 'Personalized learning path generation',
    status: 'built',
    category: 'curriculum',
  },
  // Memory & State Layer
  {
    name: 'Memory Architecture',
    files: ['forge-memory-architecture.ts', 'forge-memory-client.ts', 'forge-memory-integration.ts'],
    desc: 'Long-term learning state with Zep integration',
    status: 'built',
    category: 'memory',
  },
  {
    name: 'Learner State',
    files: ['forge-learner-state.ts', 'forge-student-profile.ts'],
    desc: 'Student profile and current learning state',
    status: 'built',
    category: 'memory',
  },
  {
    name: 'Knowledge Graph',
    files: ['forge-knowledge-graph-schema.ts', 'forge-graph-queries.ts'],
    desc: 'Neo4j-based knowledge graph for concept relationships',
    status: 'built',
    category: 'memory',
  },
  // Event & Realtime Layer
  {
    name: 'Event System',
    files: ['forge-event-bus.ts', 'forge-event-schemas.ts'],
    desc: 'Real-time learning event processing',
    status: 'built',
    category: 'realtime',
  },
  {
    name: 'Update Equations',
    files: ['forge-update-equations.ts'],
    desc: 'Mathematical models for C/E/G state updates',
    status: 'built',
    category: 'realtime',
  },
  {
    name: 'Realtime Sync',
    files: ['forge-ws-manager.ts', 'forge-sse-client.ts', 'use-hyro-realtime.ts'],
    desc: 'WebSocket/SSE for live updates',
    status: 'built',
    category: 'realtime',
  },
  // Visualization Layer
  {
    name: 'Sphere Grid System',
    files: ['sphere-grid-taxonomy.ts', 'sphere-grid-generator.ts', 'sphere-grid-integration.ts', 'sphere-grid-types.ts'],
    desc: 'FFX-style competency grid with full taxonomy',
    status: 'built',
    category: 'viz',
  },
  {
    name: 'Chart Space',
    files: ['forge-chart-space.ts'],
    desc: 'Learning analytics visualizations',
    status: 'built',
    category: 'viz',
  },
  {
    name: 'Visual Assessment',
    files: ['forge-visual-assessment.ts'],
    desc: 'Visual diagnostic tools',
    status: 'built',
    category: 'viz',
  },
  // Content Layer
  {
    name: 'Reading System',
    files: ['forge-reading.ts', 'forge-comprehension.ts'],
    desc: 'Reading tracking with comprehension assessment',
    status: 'built',
    category: 'content',
  },
  {
    name: 'SRS System',
    files: ['forge-srs.ts'],
    desc: 'Spaced repetition flashcard system',
    status: 'built',
    category: 'content',
  },
  {
    name: 'Reflections',
    files: ['forge-reflections.ts'],
    desc: 'Metacognitive reflection prompts',
    status: 'built',
    category: 'content',
  },
  {
    name: 'Intel System',
    files: ['forge-intel.ts'],
    desc: 'Daily learning intelligence feed',
    status: 'built',
    category: 'content',
  },
  // Support Layer
  {
    name: 'Analytics & Reporting',
    files: ['forge-analytics.ts', 'forge-parent-dashboard.ts'],
    desc: 'Learning analytics and parent reports',
    status: 'built',
    category: 'support',
  },
  {
    name: 'Alerts & Email',
    files: ['forge-alerts.ts', 'forge-email-templates.ts'],
    desc: 'Notifications and email communication',
    status: 'built',
    category: 'support',
  },
  {
    name: 'XP & Gamification',
    files: ['forge-xp.ts', 'forge-blueprints.ts'],
    desc: 'Experience points and achievement system',
    status: 'built',
    category: 'support',
  },
  // Organization Layer
  {
    name: 'Organization Management',
    files: ['organization-management.ts', 'organization-types.ts', 'organization-integration.ts'],
    desc: 'Multi-tenant support for families/schools/districts',
    status: 'built',
    category: 'org',
  },
  // External Connectors
  {
    name: 'LMS Connectors',
    files: ['connectors/zearn.ts', 'connectors/manual.ts', 'canyon-grove-scraper.ts'],
    desc: 'Integration with Zearn, Canyon Grove, etc.',
    status: 'built',
    category: 'connectors',
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ForgeArchitecturePage() {
  const [activeView, setActiveView] = useState<ViewMode>('system');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-indigo-500/30 bg-black/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hyro/forge" className="text-indigo-400 hover:text-indigo-300 transition">
              ← Back to FORGE
            </Link>
            <div className="h-6 w-px bg-indigo-500/30" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              System Architecture
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-300/60 bg-indigo-500/20 px-2 py-1 rounded">
              89 Library Files
            </span>
            <span className="text-xs text-purple-300/60 bg-purple-500/20 px-2 py-1 rounded">
              5 Curricula
            </span>
            <span className="text-xs text-green-300/60 bg-green-500/20 px-2 py-1 rounded">
              18+ Pages Built
            </span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-indigo-500/20 bg-black/20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                  activeView === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-indigo-300 hover:bg-indigo-500/20'
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
        {activeView === 'system' && <SystemOverviewView />}
        {activeView === 'curricula' && <CurriculaView />}
        {activeView === 'agents' && <AgentsView />}
        {activeView === 'dimensions' && <DimensionsView />}
        {activeView === 'spheregrid' && <SphereGridView />}
        {activeView === 'meta' && <MetaLearningView />}
        {activeView === 'flow' && <LearningFlowView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-indigo-500/20 bg-black/20 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-indigo-300/60 text-sm">
          HYRO FORGE Architecture - Built with 89 library files, 5 comprehensive curricula, 4 AI agents, and 30+ subsystems
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// VIEW COMPONENTS
// ============================================================================

function SystemOverviewView() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-white mb-4">
          HYRO FORGE System Architecture
        </h2>
        <p className="text-xl text-indigo-200/80 max-w-3xl mx-auto">
          A comprehensive AI-powered adaptive learning system built on evidence-based pedagogy,
          multi-agent orchestration, and five interconnected curricula.
        </p>
      </div>

      {/* Architecture Diagram */}
      <div className="bg-black/40 rounded-2xl p-8 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-6 text-center">System Architecture</h3>

        {/* Top Layer - Student Interface */}
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl p-4 text-center min-w-[300px]">
            <div className="text-2xl mb-1">👤</div>
            <div className="text-white font-bold">Student Interface</div>
            <div className="text-cyan-100/80 text-sm">Sphere Grid, Quests, SRS, Reading, Reflections</div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center mb-4">
          <div className="text-indigo-400 text-2xl">↕️</div>
        </div>

        {/* Middle Layer - AI Agents */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {AGENTS_DATA.map((agent) => (
            <div key={agent.id} className={`${agent.color} rounded-lg p-3 text-center`}>
              <div className="text-xl mb-1">{agent.icon}</div>
              <div className="text-white text-sm font-bold">{agent.name.replace(' Agent', '')}</div>
            </div>
          ))}
        </div>

        {/* Arrow */}
        <div className="flex justify-center mb-4">
          <div className="text-indigo-400 text-2xl">↕️</div>
        </div>

        {/* Core Systems */}
        <div className="bg-indigo-900/30 rounded-xl p-4 mb-6">
          <div className="text-center text-indigo-300 font-bold mb-4">Core Systems (89 library files, 30+ subsystems)</div>
          <div className="grid grid-cols-4 gap-3">
            {CORE_SYSTEMS.slice(0, 12).map((system) => (
              <div
                key={system.name}
                className={`rounded-lg p-2 text-center text-xs ${
                  system.status === 'built'
                    ? 'bg-green-900/40 border border-green-500/30'
                    : 'bg-yellow-900/40 border border-yellow-500/30'
                }`}
              >
                <div className="text-white font-medium">{system.name}</div>
                {system.status === 'ui-only' && (
                  <div className="text-yellow-400 text-[10px]">UI only</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center mb-4">
          <div className="text-indigo-400 text-2xl">↕️</div>
        </div>

        {/* Bottom Layer - 5 Curricula */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <div className="bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl p-3 text-center">
            <div className="text-xl mb-1">🧠</div>
            <div className="text-white font-bold text-sm">Behavioral Economics</div>
            <div className="text-amber-100/80 text-xs">15 Biases + WRAP</div>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-3 text-center">
            <div className="text-xl mb-1">🎯</div>
            <div className="text-white font-bold text-sm">Decision Science</div>
            <div className="text-blue-100/80 text-xs">Pre-mortem + 12 Nudges</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-3 text-center">
            <div className="text-xl mb-1">🔬</div>
            <div className="text-white font-bold text-sm">Neuroscience</div>
            <div className="text-purple-100/80 text-xs">7+ Learning Principles</div>
          </div>
          <div className="bg-gradient-to-br from-teal-600 to-emerald-600 rounded-xl p-3 text-center">
            <div className="text-xl mb-1">🔗</div>
            <div className="text-white font-bold text-sm">Pattern Recognition</div>
            <div className="text-teal-100/80 text-xs">Medici Effect</div>
          </div>
          <div className="bg-gradient-to-br from-rose-600 to-red-600 rounded-xl p-3 text-center">
            <div className="text-xl mb-1">🎓</div>
            <div className="text-white font-bold text-sm">Testout Confidence</div>
            <div className="text-rose-100/80 text-xs">Canyon Grove</div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center mb-4">
          <div className="text-indigo-400 text-2xl">↕️</div>
        </div>

        {/* Foundation - Dimensions & Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-indigo-800 to-purple-800 rounded-xl p-4">
            <div className="text-center text-white font-bold mb-3">Manifold Dimensions (C/E/G)</div>
            <div className="flex justify-center gap-3">
              {DIMENSIONS_DATA.map((dim) => (
                <div key={dim.abbrev} className={`bg-gradient-to-br ${dim.color} rounded-lg p-2 text-center`}>
                  <div className="text-lg">{dim.icon}</div>
                  <div className="text-white text-xs font-bold">{dim.abbrev}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4">
            <div className="text-center text-white font-bold mb-3">8 Core Stats</div>
            <div className="flex flex-wrap justify-center gap-2">
              {STATS_DATA.map((stat) => (
                <div key={stat.abbrev} className="bg-black/30 rounded px-2 py-1 text-xs text-white">
                  {stat.icon} {stat.abbrev}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Library Files" value="89" detail="lib/hyro/*.ts" icon="📁" />
        <StatCard label="Pages Built" value="18+" detail="UI Components" icon="📄" />
        <StatCard label="Curricula" value="5" detail="Complete" icon="📚" />
        <StatCard label="AI Agents" value="4" detail="Specialized" icon="🤖" />
      </div>

      {/* Core Systems Detail */}
      <div className="bg-black/30 rounded-xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Core Systems (Built)</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {CORE_SYSTEMS.map((system) => (
            <div
              key={system.name}
              className={`rounded-lg p-4 border ${
                system.status === 'built'
                  ? 'bg-green-900/20 border-green-500/30'
                  : 'bg-yellow-900/20 border-yellow-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold">{system.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    system.status === 'built'
                      ? 'bg-green-500/30 text-green-300'
                      : 'bg-yellow-500/30 text-yellow-300'
                  }`}
                >
                  {system.status === 'built' ? 'Complete' : 'UI Only'}
                </span>
              </div>
              <p className="text-indigo-200/70 text-sm mb-2">{system.desc}</p>
              <div className="text-xs text-indigo-400/60 font-mono">
                {system.files.join(', ')}
              </div>
              {system.note && (
                <div className="text-xs text-yellow-400/80 mt-1">Note: {system.note}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CurriculaView() {
  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-white mb-4">
          Five Comprehensive Curricula
        </h2>
        <p className="text-indigo-200/80 max-w-3xl mx-auto">
          FORGE is built on five interconnected curricula, each with complete standards,
          detailed content, and integration with the Manifold Dimensions (C/E/G).
        </p>
      </div>

      {/* Behavioral Economics */}
      <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-2xl p-6 border border-amber-500/30">
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl">{CURRICULA_DATA.behavioralEconomics.icon}</div>
          <div>
            <h3 className="text-2xl font-bold text-white">
              {CURRICULA_DATA.behavioralEconomics.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">
                Complete
              </span>
              <span className="text-amber-300/80 text-sm">
                {CURRICULA_DATA.behavioralEconomics.standards}
              </span>
            </div>
          </div>
        </div>

        {/* Biases Grid */}
        <div className="mb-6">
          <h4 className="text-white font-bold mb-3">15 Cognitive Biases</h4>
          <div className="grid grid-cols-5 gap-2">
            {CURRICULA_DATA.behavioralEconomics.biases.map((bias) => (
              <div key={bias} className="bg-black/30 rounded px-3 py-2 text-sm text-amber-100/80 text-center">
                {bias}
              </div>
            ))}
          </div>
        </div>

        {/* WRAP Framework */}
        <div className="bg-black/30 rounded-xl p-4">
          <h4 className="text-white font-bold mb-3">WRAP Framework (Heath Brothers)</h4>
          <div className="grid grid-cols-4 gap-4">
            {CURRICULA_DATA.behavioralEconomics.wrapSteps.map((step) => (
              <div key={step.letter} className="text-center">
                <div className="w-12 h-12 rounded-full bg-amber-500 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-2">
                  {step.letter}
                </div>
                <div className="text-white font-medium text-sm">{step.name}</div>
                <div className="text-amber-200/60 text-xs">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-amber-200/60 text-sm">
          Key Researchers: {CURRICULA_DATA.behavioralEconomics.keyResearchers.join(' • ')}
        </div>
      </div>

      {/* Decision Science */}
      <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-2xl p-6 border border-blue-500/30">
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl">{CURRICULA_DATA.decisionFramework.icon}</div>
          <div>
            <h3 className="text-2xl font-bold text-white">
              {CURRICULA_DATA.decisionFramework.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">
                Complete
              </span>
              <span className="text-blue-300/80 text-sm">
                {CURRICULA_DATA.decisionFramework.standards}
              </span>
            </div>
          </div>
        </div>

        {/* Components */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {CURRICULA_DATA.decisionFramework.components.map((comp) => (
            <div key={comp.name} className="bg-black/30 rounded-xl p-4">
              <h4 className="text-white font-bold mb-1">{comp.name}</h4>
              <div className="text-cyan-400 text-sm mb-2">{comp.researcher}</div>
              <p className="text-blue-200/70 text-sm">{comp.desc}</p>
            </div>
          ))}
        </div>

        {/* 12 Nudge Types */}
        <div className="bg-black/30 rounded-xl p-4">
          <h4 className="text-white font-bold mb-3">12 Nudge Types (Choice Architecture)</h4>
          <div className="grid grid-cols-4 gap-2">
            {CURRICULA_DATA.decisionFramework.nudgeTypes.map((nudge) => (
              <div key={nudge} className="bg-blue-900/30 rounded px-3 py-2 text-sm text-blue-100/80 text-center">
                {nudge}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Neuroscience */}
      <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl p-6 border border-purple-500/30">
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl">{CURRICULA_DATA.neuroscience.icon}</div>
          <div>
            <h3 className="text-2xl font-bold text-white">
              {CURRICULA_DATA.neuroscience.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">
                Complete
              </span>
              <span className="text-purple-300/80 text-sm">
                Evidence-Based Learning Principles
              </span>
            </div>
          </div>
        </div>

        {/* Principles */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {CURRICULA_DATA.neuroscience.principles.map((principle) => (
            <div key={principle.name} className="bg-black/30 rounded-lg p-4 flex items-start gap-4">
              <div className={`text-xs px-2 py-1 rounded ${
                principle.category === 'memory' ? 'bg-blue-500/30 text-blue-300' :
                principle.category === 'attention' ? 'bg-purple-500/30 text-purple-300' :
                'bg-green-500/30 text-green-300'
              }`}>
                {principle.category}
              </div>
              <div>
                <div className="text-white font-medium">{principle.name}</div>
                <div className="text-purple-200/70 text-sm">{principle.effect}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-black/30 rounded-xl p-4">
          <h4 className="text-white font-bold mb-2">C/E/G Integration</h4>
          <p className="text-purple-200/70 text-sm">
            Each neuroscience principle includes CEG effects (Coherence, Entropy, Generativity)
            that modify the student&apos;s Manifold Dimensions based on learning activities.
          </p>
        </div>

        <div className="mt-4 text-purple-200/60 text-sm">
          Key Researchers: {CURRICULA_DATA.neuroscience.keyResearchers.join(' • ')}
        </div>
      </div>

      {/* Pattern Recognition & Medici Effect */}
      <div className="bg-gradient-to-br from-teal-900/30 to-emerald-900/30 rounded-2xl p-6 border border-teal-500/30">
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl">{CURRICULA_DATA.patternRecognition.icon}</div>
          <div>
            <h3 className="text-2xl font-bold text-white">
              {CURRICULA_DATA.patternRecognition.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">
                Complete
              </span>
              <span className="text-teal-300/80 text-sm">
                {CURRICULA_DATA.patternRecognition.standards}
              </span>
            </div>
          </div>
        </div>

        {/* Pattern Types Grid */}
        <div className="mb-6">
          <h4 className="text-white font-bold mb-3">10 Cross-Domain Pattern Types</h4>
          <div className="grid grid-cols-5 gap-2">
            {CURRICULA_DATA.patternRecognition.patternTypes.map((pattern) => (
              <div key={pattern} className="bg-black/30 rounded px-3 py-2 text-sm text-teal-100/80 text-center">
                {pattern}
              </div>
            ))}
          </div>
        </div>

        {/* Abstraction Levels */}
        <div className="bg-black/30 rounded-xl p-4 mb-4">
          <h4 className="text-white font-bold mb-3">Abstraction Levels (Medici Effect)</h4>
          <div className="grid grid-cols-4 gap-4">
            {CURRICULA_DATA.patternRecognition.abstractionLevels.map((level, i) => (
              <div key={level} className="text-center">
                <div className="w-12 h-12 rounded-full bg-teal-500 text-white text-xl font-bold flex items-center justify-center mx-auto mb-2">
                  {i + 1}
                </div>
                <div className="text-white font-medium text-sm capitalize">{level}</div>
                <div className="text-teal-200/60 text-xs">
                  {level === 'surface' && 'Similar appearances'}
                  {level === 'structural' && 'Similar relationships'}
                  {level === 'deep' && 'Underlying principles'}
                  {level === 'meta' && 'Pattern of patterns'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-teal-200/60 text-sm">
          Key Researchers: {CURRICULA_DATA.patternRecognition.keyResearchers.join(' • ')}
        </div>
      </div>

      {/* Testout Confidence Engine */}
      <div className="bg-gradient-to-br from-rose-900/30 to-red-900/30 rounded-2xl p-6 border border-rose-500/30">
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl">{CURRICULA_DATA.testoutConfidence.icon}</div>
          <div>
            <h3 className="text-2xl font-bold text-white">
              {CURRICULA_DATA.testoutConfidence.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">
                Complete
              </span>
              <span className="text-rose-300/80 text-sm">
                {CURRICULA_DATA.testoutConfidence.standards}
              </span>
            </div>
          </div>
        </div>

        <div className="text-rose-200/70 mb-4 text-sm">
          Purpose: {CURRICULA_DATA.testoutConfidence.purpose}
        </div>

        {/* Confidence Categories */}
        <div className="mb-6">
          <h4 className="text-white font-bold mb-3">6 Confidence Categories</h4>
          <div className="grid grid-cols-6 gap-2">
            {CURRICULA_DATA.testoutConfidence.confidenceCategories.map((cat, i) => (
              <div key={cat} className={`rounded px-2 py-2 text-xs text-center ${
                i < 2 ? 'bg-red-900/40 text-red-200' :
                i < 4 ? 'bg-yellow-900/40 text-yellow-200' :
                'bg-green-900/40 text-green-200'
              }`}>
                {cat.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>

        {/* Factor Categories */}
        <div className="bg-black/30 rounded-xl p-4">
          <h4 className="text-white font-bold mb-3">Confidence Factors</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-rose-300 font-medium text-sm mb-2">Mastery-Based</div>
              <ul className="space-y-1">
                {CURRICULA_DATA.testoutConfidence.factors.masteryBased.map((f) => (
                  <li key={f} className="text-rose-200/70 text-xs">{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-rose-300 font-medium text-sm mb-2">Performance-Based</div>
              <ul className="space-y-1">
                {CURRICULA_DATA.testoutConfidence.factors.performanceBased.map((f) => (
                  <li key={f} className="text-rose-200/70 text-xs">{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-rose-300 font-medium text-sm mb-2">Behavioral</div>
              <ul className="space-y-1">
                {CURRICULA_DATA.testoutConfidence.factors.behavioral.map((f) => (
                  <li key={f} className="text-rose-200/70 text-xs">{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Curricula Integration Diagram */}
      <div className="bg-black/40 rounded-2xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-6 text-center">Curricula Integration</h3>

        {/* Top row - Core Learning */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="bg-amber-600/30 rounded-lg p-3 text-center border border-amber-500/50 w-36">
            <div className="text-2xl mb-1">🧠</div>
            <div className="text-white font-bold text-sm">Behavioral Economics</div>
            <div className="text-amber-200/60 text-xs">Understand biases</div>
          </div>
          <div className="text-2xl text-indigo-400">→</div>
          <div className="bg-blue-600/30 rounded-lg p-3 text-center border border-blue-500/50 w-36">
            <div className="text-2xl mb-1">🎯</div>
            <div className="text-white font-bold text-sm">Decision Science</div>
            <div className="text-blue-200/60 text-xs">Apply frameworks</div>
          </div>
          <div className="text-2xl text-indigo-400">→</div>
          <div className="bg-purple-600/30 rounded-lg p-3 text-center border border-purple-500/50 w-36">
            <div className="text-2xl mb-1">🔬</div>
            <div className="text-white font-bold text-sm">Neuroscience</div>
            <div className="text-purple-200/60 text-xs">Optimize learning</div>
          </div>
        </div>

        {/* Center connector */}
        <div className="flex justify-center mb-4">
          <div className="text-2xl text-indigo-400">↓</div>
        </div>

        {/* Bottom row - Transfer & Assessment */}
        <div className="flex items-center justify-center gap-3">
          <div className="bg-teal-600/30 rounded-lg p-3 text-center border border-teal-500/50 w-44">
            <div className="text-2xl mb-1">🔗</div>
            <div className="text-white font-bold text-sm">Pattern Recognition</div>
            <div className="text-teal-200/60 text-xs">Cross-domain transfer</div>
          </div>
          <div className="text-2xl text-indigo-400">→</div>
          <div className="bg-rose-600/30 rounded-lg p-3 text-center border border-rose-500/50 w-44">
            <div className="text-2xl mb-1">🎓</div>
            <div className="text-white font-bold text-sm">Testout Confidence</div>
            <div className="text-rose-200/60 text-xs">Readiness assessment</div>
          </div>
        </div>

        <div className="text-center mt-6 text-indigo-200/60 text-sm">
          All 5 curricula feed into Manifold Dimensions (C/E/G) for holistic assessment
        </div>
      </div>
    </div>
  );
}

function AgentsView() {
  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-white mb-4">
          4 Specialized AI Agents
        </h2>
        <p className="text-indigo-200/80 max-w-3xl mx-auto">
          FORGE uses a multi-agent architecture where specialized AI agents work together
          in parallel and sequential workflows to provide personalized tutoring.
        </p>
      </div>

      {/* Agents Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {AGENTS_DATA.map((agent) => (
          <div
            key={agent.id}
            className="bg-black/40 rounded-2xl p-6 border border-indigo-500/30 hover:border-indigo-400/50 transition"
          >
            <div className="flex items-start gap-4">
              <div className={`${agent.color} rounded-xl p-3 text-3xl`}>
                {agent.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{agent.name}</h3>
                <code className="text-xs text-indigo-400/60 font-mono">{agent.id}</code>
                <p className="text-indigo-200/70 text-sm mt-2">{agent.role}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-white font-medium text-sm mb-2">Capabilities:</div>
              <ul className="space-y-1">
                {agent.capabilities.map((cap) => (
                  <li key={cap} className="text-indigo-200/70 text-sm flex items-center gap-2">
                    <span className="text-indigo-400">•</span>
                    {cap}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-indigo-500/20">
              <span className={`text-xs px-2 py-1 rounded ${
                agent.phase === 'parallel' ? 'bg-blue-500/30 text-blue-300' :
                agent.phase === 'sequential' ? 'bg-purple-500/30 text-purple-300' :
                'bg-orange-500/30 text-orange-300'
              }`}>
                {agent.phase === 'parallel' ? 'Runs in Parallel' :
                 agent.phase === 'sequential' ? 'Runs Sequentially' :
                 'Fire & Forget'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Workflows */}
      <div className="bg-black/40 rounded-2xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-6">Agent Workflows</h3>
        <div className="space-y-6">
          {WORKFLOWS.map((workflow) => (
            <div key={workflow.id} className="bg-black/30 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <h4 className="text-white font-bold">{workflow.name}</h4>
                <code className="text-xs text-indigo-400/60 font-mono bg-black/40 px-2 py-1 rounded">
                  {workflow.id}
                </code>
              </div>
              <div className="flex items-center gap-4">
                {workflow.phases.map((phase, i) => (
                  <React.Fragment key={i}>
                    <div className={`rounded-lg p-3 ${
                      phase.type === 'parallel' ? 'bg-blue-900/40 border border-blue-500/30' :
                      phase.type === 'sequential' ? 'bg-purple-900/40 border border-purple-500/30' :
                      'bg-orange-900/40 border border-orange-500/30'
                    }`}>
                      <div className="text-xs text-indigo-300/60 mb-1">Phase {i + 1}: {phase.type}</div>
                      <div className="flex gap-2">
                        {phase.agents.map((agent) => (
                          <span key={agent} className="text-white text-sm bg-black/40 px-2 py-1 rounded">
                            {agent}
                          </span>
                        ))}
                      </div>
                      {phase.dependsOn && (
                        <div className="text-xs text-indigo-400/60 mt-1">depends on: {phase.dependsOn}</div>
                      )}
                    </div>
                    {i < workflow.phases.length - 1 && (
                      <div className="text-indigo-400 text-xl">→</div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sage Detail */}
      <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl p-6 border border-purple-500/30">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-5xl">🧙</div>
          <div>
            <h3 className="text-2xl font-bold text-white">Meet Sage</h3>
            <p className="text-purple-200/80">The AI Tutor at the heart of FORGE</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-white font-bold mb-3">Core Principles</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-purple-200/80">
                <span className="text-purple-400">1.</span>
                <span><strong>Socratic Method:</strong> Guide through questions, not answers</span>
              </li>
              <li className="flex items-start gap-2 text-purple-200/80">
                <span className="text-purple-400">2.</span>
                <span><strong>ZPD:</strong> Challenge slightly above current ability</span>
              </li>
              <li className="flex items-start gap-2 text-purple-200/80">
                <span className="text-purple-400">3.</span>
                <span><strong>Growth Mindset:</strong> Emphasize effort over innate ability</span>
              </li>
              <li className="flex items-start gap-2 text-purple-200/80">
                <span className="text-purple-400">4.</span>
                <span><strong>Encouragement:</strong> Warm, supportive, celebrate small wins</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3">Integrations</h4>
            <div className="flex flex-wrap gap-2">
              <span className="bg-black/40 text-purple-200/80 px-3 py-1 rounded text-sm">Zep Memory</span>
              <span className="bg-black/40 text-purple-200/80 px-3 py-1 rounded text-sm">ZPD Engine</span>
              <span className="bg-black/40 text-purple-200/80 px-3 py-1 rounded text-sm">Proficiency System</span>
              <span className="bg-black/40 text-purple-200/80 px-3 py-1 rounded text-sm">Quest Generator</span>
              <span className="bg-black/40 text-purple-200/80 px-3 py-1 rounded text-sm">Diagnostics</span>
              <span className="bg-black/40 text-purple-200/80 px-3 py-1 rounded text-sm">All 3 Curricula</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DimensionsView() {
  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-white mb-4">
          Manifold Dimensions (C/E/G)
        </h2>
        <p className="text-indigo-200/80 max-w-3xl mx-auto">
          Beyond traditional grades, FORGE tracks three meta-dimensions that capture
          the quality and nature of understanding.
        </p>
      </div>

      {/* Dimensions Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {DIMENSIONS_DATA.map((dim) => (
          <div
            key={dim.abbrev}
            className={`bg-gradient-to-br ${dim.color} rounded-2xl p-6 text-white`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">{dim.icon}</div>
              <div>
                <h3 className="text-2xl font-bold">{dim.name}</h3>
                <div className="text-white/60 text-sm">({dim.abbrev})</div>
              </div>
            </div>
            <p className="text-white/80 mb-4">{dim.description}</p>

            <div className="space-y-4">
              <div>
                <div className="text-white/60 text-sm mb-1">Metrics:</div>
                <ul className="space-y-1">
                  {dim.metrics.map((m) => (
                    <li key={m} className="text-white/80 text-sm flex items-center gap-2">
                      <span className="text-white/40">•</span> {m}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/20 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">
                    {dim.inverted ? 'High (concerning)' : 'High (positive)'}
                  </div>
                  <ul className="space-y-1">
                    {dim.highSignals.map((s) => (
                      <li key={s} className="text-white/80 text-xs">{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-black/20 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">
                    {dim.inverted ? 'Low (positive)' : 'Low (concerning)'}
                  </div>
                  <ul className="space-y-1">
                    {dim.lowSignals.map((s) => (
                      <li key={s} className="text-white/80 text-xs">{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CEG Visualization */}
      <div className="bg-black/40 rounded-2xl p-8 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-6 text-center">C/E/G Interaction Model</h3>
        <div className="flex items-center justify-center">
          <div className="relative w-80 h-80">
            {/* Triangle visualization */}
            <svg viewBox="0 0 200 180" className="w-full h-full">
              {/* Triangle */}
              <polygon
                points="100,10 10,170 190,170"
                fill="none"
                stroke="url(#cegGradient)"
                strokeWidth="2"
              />
              {/* Gradient definition */}
              <defs>
                <linearGradient id="cegGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="50%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#22C55E" />
                </linearGradient>
              </defs>
              {/* Center */}
              <circle cx="100" cy="117" r="30" fill="rgba(139, 92, 246, 0.3)" stroke="#8B5CF6" strokeWidth="1" />
              <text x="100" y="122" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">Student</text>
            </svg>
            {/* Dimension labels */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
              <div className="text-2xl">🔗</div>
              <div className="text-blue-400 font-bold text-sm">Coherence</div>
            </div>
            <div className="absolute bottom-0 left-0 text-center">
              <div className="text-2xl">🌊</div>
              <div className="text-purple-400 font-bold text-sm">Entropy</div>
            </div>
            <div className="absolute bottom-0 right-0 text-center">
              <div className="text-2xl">✨</div>
              <div className="text-green-400 font-bold text-sm">Generativity</div>
            </div>
          </div>
        </div>
        <div className="text-center mt-6 text-indigo-200/60 text-sm max-w-lg mx-auto">
          The ideal student state has high Coherence (integrated knowledge),
          low Entropy (clear understanding), and high Generativity (creative application).
        </div>
      </div>

      {/* 8 Stats Connection */}
      <div className="bg-black/30 rounded-xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Connection to 8 Core Stats</h3>
        <p className="text-indigo-200/70 mb-4">
          Each stat is tracked independently, but C/E/G dimensions apply across all stats to capture meta-cognitive growth.
        </p>
        <div className="grid grid-cols-4 gap-3">
          {STATS_DATA.map((stat) => (
            <div key={stat.abbrev} className="bg-black/40 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-white font-medium text-sm">{stat.name}</div>
              <div className="text-indigo-400/60 text-xs">{stat.standards}</div>
              <div className="flex justify-center gap-1 mt-2">
                <span className="bg-blue-500/30 text-blue-300 text-[10px] px-1 rounded">C</span>
                <span className="bg-purple-500/30 text-purple-300 text-[10px] px-1 rounded">E</span>
                <span className="bg-green-500/30 text-green-300 text-[10px] px-1 rounded">G</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SphereGridView() {
  const taxonomyLevels = [
    {
      name: 'Realm',
      icon: '🌌',
      color: 'from-purple-600 to-indigo-600',
      description: 'Broadest category (e.g., Mathematics, Language Arts)',
      example: 'MATH, ELA, SCIENCE',
      count: '8 Realms',
    },
    {
      name: 'Domain',
      icon: '🏛️',
      color: 'from-blue-600 to-cyan-600',
      description: 'Major subdivision within a realm',
      example: 'Number & Operations, Geometry, Algebra',
      count: '~24 Domains',
    },
    {
      name: 'Cluster',
      icon: '🔷',
      color: 'from-teal-600 to-green-600',
      description: 'Related group of standards',
      example: 'Operations with Fractions, Quadratic Functions',
      count: '~100+ Clusters',
    },
    {
      name: 'Strand',
      icon: '🧵',
      color: 'from-green-600 to-emerald-600',
      description: 'Specific skill thread',
      example: 'Adding Fractions, Factoring Quadratics',
      count: '~400+ Strands',
    },
    {
      name: 'Standard',
      icon: '📍',
      color: 'from-amber-600 to-orange-600',
      description: 'Individual learning objective (CCSS aligned)',
      example: 'CCSS.MATH.4.NF.B.3a',
      count: '1000+ Standards',
    },
    {
      name: 'Substandard',
      icon: '🔹',
      color: 'from-rose-600 to-pink-600',
      description: 'Granular skill component',
      example: 'Find common denominators for unlike fractions',
      count: '3000+ Substandards',
    },
  ];

  const nodeStates = [
    { state: 'locked', color: 'bg-slate-700', icon: '🔒', desc: 'Prerequisites not met' },
    { state: 'available', color: 'bg-blue-600', icon: '🔵', desc: 'Ready to learn' },
    { state: 'in_progress', color: 'bg-yellow-600', icon: '🟡', desc: 'Currently working on' },
    { state: 'approaching', color: 'bg-orange-500', icon: '🟠', desc: 'Close to mastery' },
    { state: 'mastered', color: 'bg-green-600', icon: '🟢', desc: 'Skill achieved' },
    { state: 'test_ready', color: 'bg-purple-600', icon: '🟣', desc: 'Ready for assessment' },
    { state: 'legendary', color: 'bg-gradient-to-r from-yellow-400 to-amber-500', icon: '⭐', desc: 'Exceptional mastery' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-white mb-4">
          Sphere Grid Taxonomy
        </h2>
        <p className="text-indigo-200/80 max-w-3xl mx-auto">
          FFX-style skill visualization with a complete 6-level hierarchy from Realms to Substandards.
          Each node represents a learnable skill with prerequisites, connections, and mastery states.
        </p>
      </div>

      {/* Taxonomy Hierarchy */}
      <div className="bg-black/40 rounded-2xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-6 text-center">6-Level Taxonomy Hierarchy</h3>
        <div className="space-y-3">
          {taxonomyLevels.map((level, i) => (
            <div key={level.name} className="flex items-center gap-4">
              <div className={`bg-gradient-to-r ${level.color} rounded-xl p-4 w-32 text-center flex-shrink-0`}>
                <div className="text-2xl mb-1">{level.icon}</div>
                <div className="text-white font-bold text-sm">{level.name}</div>
              </div>
              {i < taxonomyLevels.length - 1 && (
                <div className="text-indigo-400 text-xl">→</div>
              )}
              <div className="flex-1 bg-black/30 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-white font-medium">{level.description}</div>
                    <div className="text-indigo-300/70 text-sm mt-1">Example: {level.example}</div>
                  </div>
                  <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-1 rounded">
                    {level.count}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Node States */}
      <div className="bg-black/30 rounded-xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Node States</h3>
        <p className="text-indigo-200/70 mb-4">
          Each node in the Sphere Grid has a visual state indicating the student&apos;s progress:
        </p>
        <div className="grid grid-cols-7 gap-3">
          {nodeStates.map((node) => (
            <div key={node.state} className="text-center">
              <div className={`${node.color} w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 text-xl`}>
                {node.icon}
              </div>
              <div className="text-white font-medium text-xs capitalize">{node.state.replace('_', ' ')}</div>
              <div className="text-indigo-300/60 text-[10px]">{node.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sphere Grid Features */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-xl p-6 border border-purple-500/30">
          <h3 className="text-xl font-bold text-white mb-4">Grid Structure</h3>
          <ul className="space-y-3">
            {[
              { icon: '🔗', text: 'Prerequisites define node connections' },
              { icon: '🎯', text: 'Multiple paths to same destination' },
              { icon: '⚡', text: 'Optional bonus nodes for depth' },
              { icon: '🏆', text: 'Milestone nodes mark major achievements' },
              { icon: '🌀', text: 'Spiral curriculum reinforces earlier skills' },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-purple-200/80">
                <span className="text-xl">{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-xl p-6 border border-blue-500/30">
          <h3 className="text-xl font-bold text-white mb-4">Integration Points</h3>
          <ul className="space-y-3">
            {[
              { icon: '📊', text: 'Proficiency System updates node states' },
              { icon: '🧮', text: 'ZPD Engine determines available nodes' },
              { icon: '📐', text: 'C/E/G Dimensions affect unlock paths' },
              { icon: '🎲', text: 'Quest Generator uses node context' },
              { icon: '📈', text: 'Analytics track grid progression' },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-blue-200/80">
                <span className="text-xl">{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Files */}
      <div className="bg-black/30 rounded-xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Sphere Grid Files</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { file: 'sphere-grid-taxonomy.ts', desc: 'Complete 6-level taxonomy interfaces' },
            { file: 'sphere-grid-generator.ts', desc: 'Dynamic grid generation' },
            { file: 'sphere-grid-integration.ts', desc: 'System integration layer' },
            { file: 'sphere-grid-types.ts', desc: 'TypeScript type definitions' },
          ].map((f) => (
            <div key={f.file} className="bg-black/40 rounded-lg p-3 border border-indigo-500/20">
              <code className="text-indigo-400 text-sm">{f.file}</code>
              <div className="text-indigo-200/60 text-xs mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Link to Grid */}
      <div className="text-center">
        <Link
          href="/hyro/forge/sphere-grid"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:from-purple-500 hover:to-indigo-500 transition"
        >
          <span className="text-xl">🔮</span>
          View Live Sphere Grid →
        </Link>
      </div>
    </div>
  );
}

function MetaLearningView() {
  const metacognitionDimensions = [
    {
      name: 'Planning',
      icon: '📋',
      color: 'from-blue-500 to-blue-600',
      description: 'Goal-setting and strategy selection',
      signals: ['Sets clear learning goals', 'Chooses appropriate strategies', 'Estimates time requirements'],
    },
    {
      name: 'Monitoring',
      icon: '👁️',
      color: 'from-purple-500 to-purple-600',
      description: 'Real-time awareness of comprehension',
      signals: ['Notices confusion early', 'Checks understanding', 'Adjusts pace as needed'],
    },
    {
      name: 'Evaluation',
      icon: '⚖️',
      color: 'from-green-500 to-green-600',
      description: 'Assessing learning outcomes',
      signals: ['Accurately judges mastery', 'Identifies knowledge gaps', 'Calibrated confidence'],
    },
    {
      name: 'Regulation',
      icon: '🎛️',
      color: 'from-orange-500 to-orange-600',
      description: 'Adapting strategies based on feedback',
      signals: ['Changes approach when stuck', 'Seeks appropriate help', 'Persists through difficulty'],
    },
  ];

  const metaLearnerFeatures = [
    { name: 'Trajectory Recording', icon: '📈', desc: 'Records learning paths through Sphere Grid' },
    { name: 'Pattern Learning', icon: '🔍', desc: 'Identifies successful learning patterns' },
    { name: 'Path Recommendation', icon: '🧭', desc: 'Suggests optimal routes based on similar learners' },
    { name: 'Difficulty Prediction', icon: '🎯', desc: 'Anticipates challenging nodes' },
    { name: 'Time Estimation', icon: '⏱️', desc: 'Predicts mastery timelines' },
    { name: 'Intervention Triggers', icon: '🚨', desc: 'Detects when support is needed' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-white mb-4">
          Meta-Learning Systems
        </h2>
        <p className="text-indigo-200/80 max-w-3xl mx-auto">
          FORGE learns how students learn, tracking metacognitive skills and optimizing the learning experience
          through pattern recognition and trajectory analysis.
        </p>
      </div>

      {/* Meta-Learner: Ultimate Level Up Machine */}
      <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-2xl p-6 border border-indigo-500/30">
        <div className="flex items-center gap-4 mb-6">
          <div className="text-5xl">🧬</div>
          <div>
            <h3 className="text-2xl font-bold text-white">The Ultimate Level Up Machine</h3>
            <p className="text-indigo-200/70">Meta-Learner System (forge-meta-learner.ts)</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {metaLearnerFeatures.map((feature) => (
            <div key={feature.name} className="bg-black/30 rounded-lg p-4">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="text-white font-medium">{feature.name}</div>
              <div className="text-indigo-200/60 text-sm">{feature.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-black/30 rounded-xl p-4">
          <h4 className="text-white font-bold mb-3">How It Works</h4>
          <div className="flex items-center justify-between gap-4">
            <div className="text-center flex-1">
              <div className="bg-blue-600 rounded-lg p-3 mb-2">
                <div className="text-2xl">📊</div>
              </div>
              <div className="text-white text-sm">Record Trajectory</div>
            </div>
            <div className="text-indigo-400 text-xl">→</div>
            <div className="text-center flex-1">
              <div className="bg-purple-600 rounded-lg p-3 mb-2">
                <div className="text-2xl">🔍</div>
              </div>
              <div className="text-white text-sm">Learn Patterns</div>
            </div>
            <div className="text-indigo-400 text-xl">→</div>
            <div className="text-center flex-1">
              <div className="bg-green-600 rounded-lg p-3 mb-2">
                <div className="text-2xl">🧭</div>
              </div>
              <div className="text-white text-sm">Recommend Paths</div>
            </div>
            <div className="text-indigo-400 text-xl">→</div>
            <div className="text-center flex-1">
              <div className="bg-amber-600 rounded-lg p-3 mb-2">
                <div className="text-2xl">🚀</div>
              </div>
              <div className="text-white text-sm">Optimize Learning</div>
            </div>
          </div>
        </div>
      </div>

      {/* Metacognition Scoring */}
      <div className="bg-black/40 rounded-2xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-6 text-center">4 Metacognitive Dimensions</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {metacognitionDimensions.map((dim) => (
            <div
              key={dim.name}
              className={`bg-gradient-to-br ${dim.color} rounded-xl p-5`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="text-3xl">{dim.icon}</div>
                <div>
                  <h4 className="text-xl font-bold text-white">{dim.name}</h4>
                  <p className="text-white/70 text-sm">{dim.description}</p>
                </div>
              </div>
              <ul className="space-y-2">
                {dim.signals.map((signal) => (
                  <li key={signal} className="text-white/80 text-sm flex items-center gap-2">
                    <span className="text-white/40">•</span>
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Calibration & Accuracy */}
      <div className="bg-black/30 rounded-xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Calibration Tracking</h3>
        <p className="text-indigo-200/70 mb-4">
          The system tracks how well students estimate their own knowledge, measuring the gap between
          predicted and actual performance to improve metacognitive accuracy.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-black/40 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-white font-medium">Prediction Accuracy</div>
            <div className="text-indigo-200/60 text-sm">How well self-estimates match results</div>
          </div>
          <div className="bg-black/40 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-white font-medium">Confidence Calibration</div>
            <div className="text-indigo-200/60 text-sm">Matching confidence to actual mastery</div>
          </div>
          <div className="bg-black/40 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">📈</div>
            <div className="text-white font-medium">Growth Tracking</div>
            <div className="text-indigo-200/60 text-sm">Improvement in self-awareness over time</div>
          </div>
        </div>
      </div>

      {/* Meta-Dimensions */}
      <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-xl p-6 border border-cyan-500/30">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl">🌀</div>
          <div>
            <h3 className="text-xl font-bold text-white">Higher-Order Dimensions</h3>
            <p className="text-cyan-200/70 text-sm">forge-meta-dimensions.ts</p>
          </div>
        </div>
        <p className="text-cyan-200/80 mb-4">
          Beyond individual metacognitive skills, the Meta-Dimensions system tracks higher-order learning
          capabilities that emerge from combinations of C/E/G dimensions across time.
        </p>
        <div className="flex flex-wrap gap-2">
          {['Learning Velocity', 'Transfer Capacity', 'Self-Correction Speed', 'Pattern Abstraction', 'Adaptive Flexibility'].map((dim) => (
            <span key={dim} className="bg-cyan-500/20 text-cyan-200 px-3 py-1 rounded-full text-sm">
              {dim}
            </span>
          ))}
        </div>
      </div>

      {/* HGM Optimizer */}
      <div className="bg-black/30 rounded-xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-4">HGM Optimizer</h3>
        <p className="text-indigo-200/70 mb-4">
          The Hyro Growth Model (HGM) Optimizer ensures safe parameter updates for meta-learning systems,
          preventing unstable or harmful adjustments to the learning model.
        </p>
        <div className="grid grid-cols-4 gap-3">
          {['Parameter Validation', 'Safety Bounds', 'Gradual Updates', 'Rollback Capability'].map((feature) => (
            <div key={feature} className="bg-black/40 rounded-lg p-3 text-center">
              <div className="text-white text-sm">{feature}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LearningFlowView() {
  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-white mb-4">
          The Learning Flow
        </h2>
        <p className="text-indigo-200/80 max-w-3xl mx-auto">
          How all the pieces connect in a student&apos;s learning journey.
        </p>
      </div>

      {/* Main Flow Diagram */}
      <div className="bg-black/40 rounded-2xl p-8 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-6 text-center">Student Learning Cycle</h3>

        <div className="grid grid-cols-5 gap-4 items-center">
          {/* Step 1 */}
          <div className="text-center">
            <div className="bg-blue-600 rounded-xl p-4 mb-2">
              <div className="text-3xl mb-1">📊</div>
              <div className="text-white font-bold text-sm">Diagnostic</div>
            </div>
            <div className="text-indigo-200/60 text-xs">Assessment Agent</div>
          </div>

          <div className="text-indigo-400 text-2xl text-center">→</div>

          {/* Step 2 */}
          <div className="text-center">
            <div className="bg-green-600 rounded-xl p-4 mb-2">
              <div className="text-3xl mb-1">📚</div>
              <div className="text-white font-bold text-sm">Content</div>
            </div>
            <div className="text-indigo-200/60 text-xs">Content Agent + ZPD</div>
          </div>

          <div className="text-indigo-400 text-2xl text-center">→</div>

          {/* Step 3 */}
          <div className="text-center">
            <div className="bg-purple-600 rounded-xl p-4 mb-2">
              <div className="text-3xl mb-1">🧙</div>
              <div className="text-white font-bold text-sm">Tutoring</div>
            </div>
            <div className="text-indigo-200/60 text-xs">Sage (Tutor Agent)</div>
          </div>
        </div>

        {/* Return arrow */}
        <div className="flex justify-center my-6">
          <div className="flex items-center gap-4">
            <div className="h-px w-32 bg-indigo-500/30" />
            <div className="bg-orange-600 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">📈</div>
              <div className="text-white font-bold text-sm">Progress</div>
              <div className="text-orange-200/60 text-xs">Update Stats & C/E/G</div>
            </div>
            <div className="h-px w-32 bg-indigo-500/30" />
          </div>
        </div>

        {/* Activities */}
        <div className="grid grid-cols-6 gap-3">
          {[
            { icon: '🎴', name: 'SRS Cards', desc: 'Spaced repetition' },
            { icon: '📖', name: 'Reading', desc: 'Comprehension' },
            { icon: '🎯', name: 'Quests', desc: 'Applied learning' },
            { icon: '🪞', name: 'Reflections', desc: 'Metacognition' },
            { icon: '💬', name: 'Discussions', desc: 'Socratic dialogue' },
            { icon: '🏆', name: 'Achievements', desc: 'Motivation' },
          ].map((activity) => (
            <div key={activity.name} className="bg-black/30 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">{activity.icon}</div>
              <div className="text-white font-medium text-xs">{activity.name}</div>
              <div className="text-indigo-300/50 text-[10px]">{activity.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Flow */}
      <div className="bg-black/30 rounded-xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Data Flow</h3>
        <div className="space-y-4">
          <FlowStep
            step={1}
            title="Student Activity"
            desc="Completes quest, SRS review, reading, or diagnostic"
            systems={['Sphere Grid', 'Quest System', 'SRS', 'Reading']}
          />
          <FlowStep
            step={2}
            title="AI Evaluation"
            desc="Response evaluated by AI Evaluator with curriculum context"
            systems={['AI Evaluator', 'BE Curriculum', 'DS Curriculum', 'Neuro Curriculum']}
          />
          <FlowStep
            step={3}
            title="Proficiency Update"
            desc="Stats and C/E/G dimensions adjusted based on performance"
            systems={['Proficiency System', 'Manifold Dimensions', 'ZPD Engine']}
          />
          <FlowStep
            step={4}
            title="Memory Persistence"
            desc="Learning state saved to Zep memory for continuity"
            systems={['Memory Architecture', 'Zep Integration']}
          />
          <FlowStep
            step={5}
            title="Content Adaptation"
            desc="Next content calibrated to updated ability level"
            systems={['Content Agent', 'Generative Engine', 'Quest Generator']}
          />
        </div>
      </div>

      {/* Sphere Grid Status */}
      <div className="bg-gradient-to-r from-yellow-900/30 to-amber-900/30 rounded-xl p-6 border border-yellow-500/30">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl">🌐</div>
          <div>
            <h3 className="text-xl font-bold text-white">Sphere Grid Status</h3>
            <span className="text-xs bg-yellow-500/30 text-yellow-300 px-2 py-0.5 rounded">
              UI Built - Demo Data
            </span>
          </div>
        </div>
        <p className="text-yellow-200/70 mb-4">
          The FFX-style sphere grid visualization is fully built but currently uses demo data.
          Node states include: locked, available, in_progress, approaching, mastered, test_ready, legendary.
        </p>
        <Link
          href="/hyro/forge/sphere-grid"
          className="inline-flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-500 transition"
        >
          View Sphere Grid →
        </Link>
      </div>

      {/* Page Summary */}
      <div className="bg-indigo-900/30 rounded-xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Built Pages</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { name: 'Main Dashboard', path: '/hyro/forge' },
            { name: 'Sphere Grid', path: '/hyro/forge/sphere-grid' },
            { name: 'Diagnostic', path: '/hyro/forge/diagnostic' },
            { name: 'Session', path: '/hyro/forge/session' },
            { name: 'Tutor', path: '/hyro/forge/tutor' },
            { name: 'Proficiency', path: '/hyro/forge/proficiency' },
            { name: 'Analytics', path: '/hyro/forge/analytics' },
            { name: 'Quests', path: '/hyro/forge/quests' },
            { name: 'Reading', path: '/hyro/forge/reading' },
            { name: 'SRS', path: '/hyro/forge/srs' },
            { name: 'Comprehension', path: '/hyro/forge/comprehension' },
            { name: 'Reflections', path: '/hyro/forge/reflections' },
            { name: 'Intel', path: '/hyro/forge/intel' },
            { name: 'Parent', path: '/hyro/forge/parent' },
            { name: 'Onboarding', path: '/hyro/forge/onboarding' },
            { name: 'About', path: '/hyro/forge/about' },
          ].map((page) => (
            <Link
              key={page.path}
              href={page.path}
              className="bg-black/30 rounded-lg p-2 text-center text-sm text-indigo-200/80 hover:bg-indigo-500/20 hover:text-white transition"
            >
              {page.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) {
  return (
    <div className="bg-black/30 rounded-xl p-4 border border-indigo-500/30 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-indigo-200/80">{label}</div>
      <div className="text-indigo-400/60 text-sm">{detail}</div>
    </div>
  );
}

function FlowStep({ step, title, desc, systems }: { step: number; title: string; desc: string; systems: string[] }) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0">
        {step}
      </div>
      <div className="flex-1">
        <div className="text-white font-bold">{title}</div>
        <div className="text-indigo-200/70 text-sm mb-2">{desc}</div>
        <div className="flex flex-wrap gap-2">
          {systems.map((sys) => (
            <span key={sys} className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded">
              {sys}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
