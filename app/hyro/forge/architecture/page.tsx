'use client';

/**
 * HYRO FORGE: Architecture & Pedagogy Visualization
 * Interactive visual representation of the complete FORGE system
 * Shows curricula, agents, dimensions, and how everything connects
 */

import React, { useState } from 'react';
import Link from 'next/link';

type ViewMode = 'system' | 'curricula' | 'agents' | 'dimensions' | 'flow';

const VIEW_TABS: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'system', label: 'System Overview', icon: '🏗️' },
  { id: 'curricula', label: 'Curricula', icon: '📚' },
  { id: 'agents', label: 'AI Agents', icon: '🤖' },
  { id: 'dimensions', label: 'Manifold Dimensions', icon: '🌀' },
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
  {
    name: 'Forge Orchestrator',
    files: ['forge-orchestrator.ts', 'forge-session-orchestrator.ts'],
    desc: 'Multi-agent coordination with IRT-based assessment',
    status: 'built',
  },
  {
    name: 'ZPD Engine',
    files: ['forge-zpd-engine.ts'],
    desc: 'Zone of Proximal Development challenge calibration',
    status: 'built',
  },
  {
    name: 'Proficiency System',
    files: ['forge-proficiency.ts', 'forge-proficiency-types.ts'],
    desc: 'Stat tracking and competency estimation',
    status: 'built',
  },
  {
    name: 'AI Tutor (Sage)',
    files: ['forge-ai-tutor.ts'],
    desc: 'Socratic tutoring with Zep memory integration',
    status: 'built',
  },
  {
    name: 'Diagnostics',
    files: ['forge-diagnostics.ts', 'forge-ai-evaluator.ts'],
    desc: 'Adaptive assessment with convergence detection',
    status: 'built',
  },
  {
    name: 'Generative Engine',
    files: ['forge-generative-engine.ts'],
    desc: 'Dynamic content and quest generation',
    status: 'built',
  },
  {
    name: 'Memory Architecture',
    files: ['forge-memory-architecture.ts'],
    desc: 'Long-term learning state persistence',
    status: 'built',
  },
  {
    name: 'Analytics',
    files: ['forge-analytics.ts'],
    desc: 'Learning analytics and parent reporting',
    status: 'built',
  },
  {
    name: 'Sphere Grid',
    files: ['app/hyro/forge/sphere-grid/page.tsx'],
    desc: 'FFX-style competency visualization',
    status: 'ui-only',
    note: 'UI built, uses demo data',
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
              54 Core Files
            </span>
            <span className="text-xs text-green-300/60 bg-green-500/20 px-2 py-1 rounded">
              17+ Pages Built
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
        {activeView === 'flow' && <LearningFlowView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-indigo-500/20 bg-black/20 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-indigo-300/60 text-sm">
          HYRO FORGE Architecture - Built with 54 core library files, 3 comprehensive curricula, and 4 AI agents
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
          multi-agent orchestration, and three interconnected curricula.
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
          <div className="text-center text-indigo-300 font-bold mb-4">Core Systems (54 files)</div>
          <div className="grid grid-cols-4 gap-3">
            {CORE_SYSTEMS.slice(0, 8).map((system) => (
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

        {/* Bottom Layer - Curricula */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">🧠</div>
            <div className="text-white font-bold">Behavioral Economics</div>
            <div className="text-amber-100/80 text-sm">15 Biases + WRAP</div>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">🎯</div>
            <div className="text-white font-bold">Decision Science</div>
            <div className="text-blue-100/80 text-sm">Pre-mortem + 12 Nudges</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">🔬</div>
            <div className="text-white font-bold">Neuroscience</div>
            <div className="text-purple-100/80 text-sm">7+ Learning Principles</div>
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
        <StatCard label="Library Files" value="54" detail="forge-*.ts" icon="📁" />
        <StatCard label="Pages Built" value="17+" detail="UI Components" icon="📄" />
        <StatCard label="Curricula" value="3" detail="Complete" icon="📚" />
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
          Three Comprehensive Curricula
        </h2>
        <p className="text-indigo-200/80 max-w-3xl mx-auto">
          FORGE is built on three interconnected curricula, each with complete standards,
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

      {/* Curricula Integration Diagram */}
      <div className="bg-black/40 rounded-2xl p-6 border border-indigo-500/30">
        <h3 className="text-xl font-bold text-white mb-6 text-center">Curricula Integration</h3>
        <div className="flex items-center justify-center gap-4">
          <div className="bg-amber-600/30 rounded-lg p-4 text-center border border-amber-500/50">
            <div className="text-3xl mb-2">🧠</div>
            <div className="text-white font-bold">Behavioral Economics</div>
            <div className="text-amber-200/60 text-xs">Understand biases</div>
          </div>
          <div className="text-4xl text-indigo-400">→</div>
          <div className="bg-blue-600/30 rounded-lg p-4 text-center border border-blue-500/50">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-white font-bold">Decision Science</div>
            <div className="text-blue-200/60 text-xs">Apply frameworks</div>
          </div>
          <div className="text-4xl text-indigo-400">→</div>
          <div className="bg-purple-600/30 rounded-lg p-4 text-center border border-purple-500/50">
            <div className="text-3xl mb-2">🔬</div>
            <div className="text-white font-bold">Neuroscience</div>
            <div className="text-purple-200/60 text-xs">Optimize learning</div>
          </div>
        </div>
        <div className="text-center mt-6 text-indigo-200/60 text-sm">
          All curricula feed into Manifold Dimensions (C/E/G) for holistic assessment
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
