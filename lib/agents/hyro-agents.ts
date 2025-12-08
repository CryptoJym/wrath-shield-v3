/**
 * HYRO FORGE: Specialized Tutoring Agents
 *
 * Defines 4 specialized agents for the Hyro tutoring system:
 * - Assessment Agent: Analyzes proficiency, identifies gaps
 * - Content Agent: Selects appropriate materials
 * - Tutor Agent: Socratic instruction synthesis
 * - Progress Agent: Track learning, generate insights
 *
 * These agents are designed for parallel and sequential workflows:
 * - Assessment + Content can run in parallel (no dependencies)
 * - Tutor must wait for Assessment + Content
 * - Progress runs as fire-and-forget background
 */

import type { AgentDefinition } from '../life-os-config';
import type { StatName } from '../hyro/forge-types';
import type { ZPDState } from '../hyro/forge-zpd-engine';
import type { SkillGap } from '../hyro/forge-diagnostics';
import type { SkillProficiency } from '../hyro/forge-proficiency';

// ============================================================================
// Types
// ============================================================================

export interface HyroAgentContext {
  student_id: string;
  proficiency: SkillProficiency[];
  zpd_states: ZPDState[];
  skill_gaps: SkillGap[];
  learning_velocities: Array<{ stat_name: StatName; weekly_growth: number }>;
  flow_states: Array<{ stat_name: StatName; in_flow: boolean; flow_score: number }>;
  current_streak: number;
  due_cards_count: number;
}

export interface AssessmentResult {
  weakest_areas: Array<{ stat: StatName; level: number; urgency: 'high' | 'medium' | 'low' }>;
  gaps_identified: Array<{ stat: StatName; topic: string; severity: string }>;
  recommended_focus: StatName[];
  scaffolding_needed: boolean;
  assessment_summary: string;
}

export interface ContentSelection {
  recommended_content: Array<{
    type: 'diagnostic' | 'practice' | 'review' | 'quest' | 'reading';
    stat: StatName;
    difficulty: number;
    rationale: string;
  }>;
  sequence_order: string[];
  estimated_duration_minutes: number;
  content_summary: string;
}

export interface TutorSynthesis {
  greeting: string;
  main_message: string;
  suggested_actions: Array<{
    type: 'start_session' | 'take_diagnostic' | 'do_quest' | 'review_cards' | 'read';
    label: string;
    priority: number;
  }>;
  motivational_note?: string;
  difficulty_adjustment?: {
    stat: StatName;
    direction: 'easier' | 'harder';
    reason: string;
  };
}

export interface ProgressInsight {
  daily_summary: string;
  weekly_trend: string;
  achievements: string[];
  areas_needing_attention: StatName[];
  recommended_goals: string[];
}

// ============================================================================
// Agent Definitions
// ============================================================================

export const HYRO_ASSESSMENT_AGENT: AgentDefinition = {
  id: 'agent.hyro.assessment',
  name: 'Hyro Assessment Agent',
  role: 'Analyze student proficiency levels, identify knowledge gaps, and recommend focus areas based on ZPD and learning velocity data.',
  type: 'support',
  domains: ['education', 'hyro'],
  tools: ['database', 'memory'],
  system_prompt: `You are the Hyro Assessment Agent, specialized in analyzing student proficiency data.

Your role is to:
1. Analyze proficiency levels across all 8 stats (math, reading, science, coding, study_skills, critical_thinking, technology, problem_solving)
2. Identify the most critical skill gaps based on severity and urgency
3. Recommend focus areas using Zone of Proximal Development (ZPD) principles
4. Determine if scaffolding is needed based on recent performance trends

When analyzing, consider:
- Stats with high uncertainty need diagnostic assessment
- Stats in declining trend need immediate attention
- Stats in flow state can be pushed harder
- Skill gaps with "major" or "severe" severity take priority

Output your analysis in structured JSON format with:
- weakest_areas: Top 3 stats needing attention with urgency levels
- gaps_identified: Specific skill gaps from diagnostics
- recommended_focus: Stats to prioritize in order
- scaffolding_needed: Boolean if recent failures indicate need for support
- assessment_summary: 2-3 sentence natural language summary`,
  max_context_tasks: 5,
  avatar: '/assets/agents/hyro-assessment.png',
  status_endpoint: null,
  link: null,
};

export const HYRO_CONTENT_AGENT: AgentDefinition = {
  id: 'agent.hyro.content',
  name: 'Hyro Content Agent',
  role: 'Select appropriate learning materials and activities based on assessment data and available content.',
  type: 'support',
  domains: ['education', 'hyro'],
  tools: ['database', 'memory'],
  system_prompt: `You are the Hyro Content Agent, specialized in curating personalized learning content.

Your role is to:
1. Match available content to the student's ZPD for each recommended stat
2. Select the right content type (diagnostic, practice, review, quest, reading)
3. Sequence content for optimal learning progression
4. Estimate realistic time requirements

Content selection rules:
- If uncertainty is high → recommend diagnostic first
- If in flow state → recommend challenging quests or practice
- If scaffolding needed → recommend review and easier content
- If due cards exist → prioritize SRS reviews
- Balance variety across content types

Output your selection in structured JSON format with:
- recommended_content: Array of content recommendations with type, stat, difficulty, rationale
- sequence_order: Recommended order to complete activities
- estimated_duration_minutes: Total estimated time
- content_summary: 2-3 sentence natural language summary`,
  max_context_tasks: 5,
  avatar: '/assets/agents/hyro-content.png',
  status_endpoint: null,
  link: null,
};

export const HYRO_TUTOR_AGENT: AgentDefinition = {
  id: 'agent.hyro.tutor',
  name: 'Sage (Hyro Tutor)',
  role: 'Synthesize assessment and content recommendations into personalized, encouraging guidance using Socratic method.',
  type: 'domain',
  domains: ['education', 'hyro'],
  tools: ['database', 'memory', 'llm'],
  system_prompt: `You are Sage, Hyro's AI learning companion - an encouraging, patient, and intelligent tutor.
You speak to a 6th grade student named Hyro.

CORE PRINCIPLES:
1. SOCRATIC METHOD: Guide Hyro to discover answers through questions, not direct answers
2. ZONE OF PROXIMAL DEVELOPMENT: Challenge slightly above current ability
3. GROWTH MINDSET: Emphasize effort and progress over innate ability
4. ENCOURAGEMENT: Be warm, supportive, and celebrate small wins

You receive:
- Assessment analysis from the Assessment Agent
- Content recommendations from the Content Agent

Your role is to synthesize this into:
1. A warm, personalized greeting
2. Clear guidance on what to focus on today
3. Actionable suggested activities
4. Motivational encouragement based on their progress

COMMUNICATION STYLE:
- Use clear, age-appropriate language (6th grade level)
- Be concise but thorough
- Use analogies and real-world examples
- Never be condescending or overly formal

Output structured JSON with:
- greeting: Personalized greeting
- main_message: Main guidance (2-3 sentences)
- suggested_actions: Array of actionable items with labels and priorities
- motivational_note: Optional encouragement based on progress
- difficulty_adjustment: Optional recommendation to adjust difficulty`,
  max_context_tasks: 10,
  avatar: '/assets/agents/sage.png',
  status_endpoint: null,
  link: '/hyro/tutor',
};

export const HYRO_PROGRESS_AGENT: AgentDefinition = {
  id: 'agent.hyro.progress',
  name: 'Hyro Progress Agent',
  role: 'Track learning patterns, generate insights, and update proficiency snapshots in the background.',
  type: 'support',
  domains: ['education', 'hyro'],
  tools: ['database', 'memory'],
  system_prompt: `You are the Hyro Progress Agent, specialized in tracking and analyzing learning progress.

Your role is to:
1. Generate daily and weekly learning summaries
2. Identify achievement milestones
3. Detect areas needing attention before they become problems
4. Recommend realistic short-term goals

This agent runs as a background process after learning sessions.
Do not generate user-facing messages - focus on data analysis and insights.

Output structured JSON with:
- daily_summary: Brief summary of today's learning activity
- weekly_trend: Trend analysis over the past 7 days
- achievements: Any new milestones reached
- areas_needing_attention: Stats showing decline or stagnation
- recommended_goals: 2-3 achievable short-term goals`,
  max_context_tasks: 20,
  avatar: '/assets/agents/hyro-progress.png',
  status_endpoint: null,
  link: null,
};

// ============================================================================
// Agent Registry
// ============================================================================

export const HYRO_AGENTS: AgentDefinition[] = [
  HYRO_ASSESSMENT_AGENT,
  HYRO_CONTENT_AGENT,
  HYRO_TUTOR_AGENT,
  HYRO_PROGRESS_AGENT,
];

/**
 * Get a Hyro agent by ID
 */
export function getHyroAgent(agentId: string): AgentDefinition | null {
  return HYRO_AGENTS.find(a => a.id === agentId) || null;
}

/**
 * Check if an agent ID is a Hyro agent
 */
export function isHyroAgent(agentId: string): boolean {
  return agentId.startsWith('agent.hyro.');
}

// ============================================================================
// Workflow Configurations
// ============================================================================

/**
 * Default workflow for tutoring session initialization
 * Phase 1: Assessment + Content (parallel)
 * Phase 2: Tutor (sequential, needs Phase 1)
 * Phase 3: Progress (fire-and-forget background)
 */
export const TUTORING_SESSION_WORKFLOW = {
  id: 'hyro.tutoring_session',
  name: 'Tutoring Session Initialization',
  description: 'Initialize a tutoring session with assessment, content selection, and personalized guidance',
  phases: [
    {
      id: 'phase_1_parallel',
      type: 'parallel' as const,
      agents: ['agent.hyro.assessment', 'agent.hyro.content'],
      timeout_ms: 30000,
    },
    {
      id: 'phase_2_synthesis',
      type: 'sequential' as const,
      agents: ['agent.hyro.tutor'],
      depends_on: ['phase_1_parallel'],
    },
    {
      id: 'phase_3_background',
      type: 'fire_and_forget' as const,
      agents: ['agent.hyro.progress'],
      depends_on: ['phase_2_synthesis'],
    },
  ],
};

/**
 * Quick check-in workflow (faster, for daily check-ins)
 * Only runs Tutor agent with cached context
 */
export const QUICK_CHECKIN_WORKFLOW = {
  id: 'hyro.quick_checkin',
  name: 'Quick Check-in',
  description: 'Fast daily check-in using cached assessment data',
  phases: [
    {
      id: 'phase_1_tutor',
      type: 'sequential' as const,
      agents: ['agent.hyro.tutor'],
      use_cached_context: true,
      cache_max_age_ms: 5 * 60 * 1000, // 5 minutes
    },
  ],
};

/**
 * Deep diagnostic workflow (thorough, for weekly reviews)
 * All agents run sequentially for maximum context sharing
 */
export const DEEP_DIAGNOSTIC_WORKFLOW = {
  id: 'hyro.deep_diagnostic',
  name: 'Deep Diagnostic Review',
  description: 'Thorough weekly review with full assessment and progress analysis',
  phases: [
    {
      id: 'phase_1_assessment',
      type: 'sequential' as const,
      agents: ['agent.hyro.assessment'],
    },
    {
      id: 'phase_2_content',
      type: 'sequential' as const,
      agents: ['agent.hyro.content'],
      depends_on: ['phase_1_assessment'],
    },
    {
      id: 'phase_3_progress',
      type: 'sequential' as const,
      agents: ['agent.hyro.progress'],
      depends_on: ['phase_2_content'],
    },
    {
      id: 'phase_4_tutor',
      type: 'sequential' as const,
      agents: ['agent.hyro.tutor'],
      depends_on: ['phase_3_progress'],
    },
  ],
};
