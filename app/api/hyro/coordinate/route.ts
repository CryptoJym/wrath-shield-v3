/**
 * HYRO FORGE: Multi-Agent Coordination API
 *
 * Orchestrates specialized tutoring agents with parallel execution:
 * - Phase 1 (Parallel): Assessment + Content agents
 * - Phase 2 (Sequential): Tutor agent (needs Phase 1)
 * - Phase 3 (Background): Progress agent (fire-and-forget)
 *
 * Expected performance: ~100ms total vs ~500ms sequential (5x improvement)
 *
 * GET  /api/hyro/coordinate - Get workflow status or available workflows
 * POST /api/hyro/coordinate - Execute a coordination workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  buildTutorContextAsync,
  buildTutorContextSafe,
  type TutorContext,
} from '@/lib/hyro/forge-ai-tutor';
import { getSessionContextAsync } from '@/lib/hyro/forge-session-orchestrator';
import { getProficiencyProfileAsync } from '@/lib/hyro/forge-proficiency';
import { getAllZPDStatesAsync, getAllLearningVelocitiesAsync, getAllFlowStatesAsync } from '@/lib/hyro/forge-zpd-engine';
import { getActiveSkillGaps } from '@/lib/hyro/forge-diagnostics';
import {
  HYRO_AGENTS,
  TUTORING_SESSION_WORKFLOW,
  QUICK_CHECKIN_WORKFLOW,
  DEEP_DIAGNOSTIC_WORKFLOW,
  type AssessmentResult,
  type ContentSelection,
  type TutorSynthesis,
  type ProgressInsight,
} from '@/lib/agents/hyro-agents';
import type { StatName } from '@/lib/hyro/forge-types';

// =============================================================================
// Types
// =============================================================================

interface CoordinateRequest {
  workflow: 'tutoring_session' | 'quick_checkin' | 'deep_diagnostic' | 'custom';
  message?: string;
  context?: Record<string, any>;
  timeout_ms?: number;
}

interface PhaseResult {
  phase_id: string;
  type: 'parallel' | 'sequential' | 'fire_and_forget';
  agents: string[];
  results: AgentPhaseResult[];
  latency_ms: number;
  status: 'completed' | 'partial' | 'failed';
}

interface AgentPhaseResult {
  agent_id: string;
  agent_name: string;
  response: any;
  latency_ms: number;
  error?: string;
}

interface CoordinateResponse {
  success: boolean;
  workflow_id: string;
  workflow: string;
  status: 'completed' | 'partial' | 'failed';
  phases: PhaseResult[];
  final_output?: TutorSynthesis;
  context_latency_ms: number;
  total_latency_ms: number;
  performance_metrics: {
    context_gather_ms: number;
    phase_1_parallel_ms: number;
    phase_2_synthesis_ms: number;
    phase_3_background_ms: number;
  };
}

// =============================================================================
// Context Cache (simple in-memory cache)
// =============================================================================

interface CachedContext {
  context: TutorContext;
  timestamp: number;
}

let contextCache: CachedContext | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedContext(): TutorContext | null {
  if (!contextCache) return null;
  if (Date.now() - contextCache.timestamp > CACHE_TTL_MS) {
    contextCache = null;
    return null;
  }
  return contextCache.context;
}

function setCachedContext(context: TutorContext): void {
  contextCache = {
    context,
    timestamp: Date.now(),
  };
}

// =============================================================================
// Agent Execution (Mock - replace with AgentInvoker integration)
// =============================================================================

/**
 * Execute the Assessment Agent
 * Analyzes proficiency and identifies gaps
 */
async function executeAssessmentAgent(context: TutorContext): Promise<AssessmentResult> {
  const startTime = Date.now();

  // Sort proficiency by level to find weakest areas
  const sortedProficiency = [...context.proficiency].sort((a, b) => a.level - b.level);
  const weakestAreas = sortedProficiency.slice(0, 3).map(p => ({
    stat: p.stat_name,
    level: p.level,
    urgency: (p.level < 30 ? 'high' : p.level < 50 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
  }));

  // Get gaps from skill gaps
  const gapsIdentified = context.active_skill_gaps.slice(0, 5).map(g => ({
    stat: g.stat_name,
    topic: g.topic,
    severity: g.gap_severity,
  }));

  // Determine recommended focus based on ZPD
  const recommendedFocus = context.zpd_states
    .filter(z => z.adjustment_needed !== 'maintain' || z.scaffolding_recommended)
    .slice(0, 3)
    .map(z => z.stat_name);

  // Check if scaffolding is needed
  const scaffoldingNeeded = context.zpd_states.some(z => z.scaffolding_recommended);

  return {
    weakest_areas: weakestAreas,
    gaps_identified: gapsIdentified,
    recommended_focus: recommendedFocus.length > 0 ? recommendedFocus : [weakestAreas[0]?.stat || 'math'],
    scaffolding_needed: scaffoldingNeeded,
    assessment_summary: `Analysis complete. ${weakestAreas.length} areas need attention. ${gapsIdentified.length} skill gaps identified. ${scaffoldingNeeded ? 'Scaffolding recommended.' : 'Ready for challenge.'}`,
  };
}

/**
 * Execute the Content Agent
 * Selects appropriate learning materials
 */
async function executeContentAgent(
  context: TutorContext,
  assessment?: AssessmentResult
): Promise<ContentSelection> {
  const recommendedContent: ContentSelection['recommended_content'] = [];

  // If assessment provided, use its recommendations
  const focusStats = assessment?.recommended_focus ||
    context.zpd_states.filter(z => z.adjustment_needed !== 'maintain').map(z => z.stat_name).slice(0, 3);

  // Check for due cards first
  if (context.session_context.due_cards_count > 0) {
    recommendedContent.push({
      type: 'review',
      stat: 'reading' as StatName, // SRS spans multiple stats
      difficulty: 50,
      rationale: `${context.session_context.due_cards_count} cards due for review. Complete these to maintain retention.`,
    });
  }

  // Add content for focus stats
  for (const stat of focusStats) {
    const zpd = context.zpd_states.find(z => z.stat_name === stat);
    const flow = context.flow_states.find(f => f.stat_name === stat);

    if (!zpd) continue;

    // Determine content type based on state
    if (assessment?.scaffolding_needed) {
      recommendedContent.push({
        type: 'practice',
        stat,
        difficulty: Math.max(zpd.zpd_lower, zpd.current_level - 10),
        rationale: `Scaffolded practice for ${stat} at comfortable difficulty.`,
      });
    } else if (flow?.in_flow) {
      recommendedContent.push({
        type: 'quest',
        stat,
        difficulty: zpd.zpd_upper,
        rationale: `In flow state - ready for a challenging ${stat} quest!`,
      });
    } else {
      recommendedContent.push({
        type: 'practice',
        stat,
        difficulty: zpd.optimal_difficulty,
        rationale: `Optimal difficulty practice for ${stat}.`,
      });
    }
  }

  // Calculate estimated duration
  const estimatedDuration = recommendedContent.length * 10; // ~10 min per activity

  return {
    recommended_content: recommendedContent.slice(0, 5),
    sequence_order: recommendedContent.map(c => `${c.type}_${c.stat}`),
    estimated_duration_minutes: estimatedDuration,
    content_summary: `Selected ${recommendedContent.length} activities targeting ${focusStats.join(', ')}. Estimated time: ${estimatedDuration} minutes.`,
  };
}

/**
 * Execute the Tutor Agent
 * Synthesizes assessment and content into personalized guidance
 */
async function executeTutorAgent(
  context: TutorContext,
  assessment: AssessmentResult,
  content: ContentSelection,
  userMessage?: string
): Promise<TutorSynthesis> {
  // Build personalized greeting
  const streak = context.session_context.current_streak || 0;
  const greeting = streak > 0
    ? `Hey Hyro! You're on a ${streak}-day streak! 🔥`
    : `Hey Hyro! Ready to learn something awesome today?`;

  // Build main message based on assessment
  let mainMessage: string;
  if (assessment.scaffolding_needed) {
    mainMessage = `I noticed some tricky spots in ${assessment.weakest_areas[0]?.stat || 'your learning'}. Let's work through them together step by step - you've got this!`;
  } else if (context.flow_states.some(f => f.in_flow)) {
    const flowStat = context.flow_states.find(f => f.in_flow)?.stat_name;
    mainMessage = `You're crushing it in ${flowStat}! 🚀 Let's keep that momentum going with a fun challenge.`;
  } else {
    mainMessage = `I've got some great activities lined up for you. ${content.content_summary}`;
  }

  // Build suggested actions
  const suggestedActions: TutorSynthesis['suggested_actions'] = content.recommended_content.map((c, i) => ({
    type: c.type === 'quest' ? 'do_quest' : c.type === 'review' ? 'review_cards' : 'start_session',
    label: c.type === 'review'
      ? `Review ${context.session_context.due_cards_count} cards`
      : c.type === 'quest'
        ? `Take on a ${c.stat} quest!`
        : `Practice ${c.stat}`,
    priority: i + 1,
  }));

  // Add diagnostic if needed
  if (assessment.gaps_identified.length > 0) {
    suggestedActions.push({
      type: 'take_diagnostic',
      label: `Check your ${assessment.gaps_identified[0].stat} skills`,
      priority: suggestedActions.length + 1,
    });
  }

  // Build motivational note
  let motivationalNote: string | undefined;
  const velocity = context.learning_velocities.find(v => v.weekly_growth > 0);
  if (velocity) {
    motivationalNote = `Your ${velocity.stat_name} skills grew ${velocity.weekly_growth.toFixed(1)} points this week! Keep it up! 💪`;
  }

  return {
    greeting,
    main_message: mainMessage,
    suggested_actions: suggestedActions.slice(0, 4),
    motivational_note: motivationalNote,
    difficulty_adjustment: assessment.scaffolding_needed
      ? {
          stat: assessment.weakest_areas[0]?.stat || 'math',
          direction: 'easier',
          reason: 'Recent challenges suggest building up foundational skills first.',
        }
      : undefined,
  };
}

/**
 * Execute the Progress Agent (fire-and-forget)
 * Runs in background, doesn't block response
 */
function executeProgressAgentBackground(context: TutorContext): void {
  // Fire and forget - don't await
  (async () => {
    try {
      const insights = await executeProgressAgentSync(context);
      // Could store insights in database or send to Cortex
      console.log('[Progress Agent] Generated insights:', insights.daily_summary);
    } catch (error) {
      console.error('[Progress Agent] Background error:', error);
    }
  })();
}

async function executeProgressAgentSync(context: TutorContext): Promise<ProgressInsight> {
  // Calculate weekly trends
  const weeklyTrends = context.learning_velocities.filter(v => v.weekly_growth !== 0);
  const improving = weeklyTrends.filter(v => v.weekly_growth > 0);
  const declining = weeklyTrends.filter(v => v.weekly_growth < 0);

  const weeklyTrend = improving.length > declining.length
    ? 'Positive momentum! Most stats improving.'
    : declining.length > improving.length
      ? 'Some areas need attention - growth has slowed.'
      : 'Steady progress across all areas.';

  // Identify achievements
  const achievements: string[] = [];
  for (const p of context.proficiency) {
    if (p.level >= 80) achievements.push(`Mastery in ${p.stat_name}!`);
    else if (p.level >= 60) achievements.push(`Proficient in ${p.stat_name}`);
  }

  // Areas needing attention
  const needsAttention = context.zpd_states
    .filter(z => z.scaffolding_recommended || z.trend === 'declining')
    .map(z => z.stat_name);

  return {
    daily_summary: `Session context gathered. ${context.session_context.due_cards_count} cards due, ${context.session_context.active_quests.length} active quests.`,
    weekly_trend: weeklyTrend,
    achievements,
    areas_needing_attention: needsAttention,
    recommended_goals: [
      improving.length > 0 ? `Keep momentum in ${improving[0].stat_name}` : 'Start a new learning session',
      context.session_context.due_cards_count > 0 ? 'Complete daily reviews' : 'Explore new topics',
    ],
  };
}

// =============================================================================
// Workflow Execution
// =============================================================================

/**
 * Execute the tutoring session workflow with parallel phases
 */
async function executeTutoringSessionWorkflow(
  message?: string,
  additionalContext?: Record<string, any>
): Promise<CoordinateResponse> {
  const workflowId = randomUUID();
  const startTime = Date.now();
  const phases: PhaseResult[] = [];

  // Phase 0: Gather context (parallel)
  const contextStartTime = Date.now();
  let context: TutorContext;
  try {
    context = await buildTutorContextAsync();
    setCachedContext(context);
  } catch (error) {
    context = await buildTutorContextSafe();
  }
  const contextLatencyMs = Date.now() - contextStartTime;

  // Phase 1: Parallel Assessment + Content
  const phase1StartTime = Date.now();
  const [assessmentResult, contentResult] = await Promise.all([
    executeAssessmentAgent(context).then(result => ({
      agent_id: 'agent.hyro.assessment',
      agent_name: 'Hyro Assessment Agent',
      response: result,
      latency_ms: Date.now() - phase1StartTime,
    })),
    executeContentAgent(context).then(result => ({
      agent_id: 'agent.hyro.content',
      agent_name: 'Hyro Content Agent',
      response: result,
      latency_ms: Date.now() - phase1StartTime,
    })),
  ]);
  const phase1LatencyMs = Date.now() - phase1StartTime;

  phases.push({
    phase_id: 'phase_1_parallel',
    type: 'parallel',
    agents: ['agent.hyro.assessment', 'agent.hyro.content'],
    results: [assessmentResult, contentResult],
    latency_ms: phase1LatencyMs,
    status: 'completed',
  });

  // Phase 2: Sequential Tutor Synthesis
  const phase2StartTime = Date.now();
  const tutorResult = await executeTutorAgent(
    context,
    assessmentResult.response as AssessmentResult,
    contentResult.response as ContentSelection,
    message
  );
  const phase2LatencyMs = Date.now() - phase2StartTime;

  phases.push({
    phase_id: 'phase_2_synthesis',
    type: 'sequential',
    agents: ['agent.hyro.tutor'],
    results: [{
      agent_id: 'agent.hyro.tutor',
      agent_name: 'Sage (Hyro Tutor)',
      response: tutorResult,
      latency_ms: phase2LatencyMs,
    }],
    latency_ms: phase2LatencyMs,
    status: 'completed',
  });

  // Phase 3: Fire-and-forget Progress
  const phase3StartTime = Date.now();
  executeProgressAgentBackground(context);
  const phase3LatencyMs = Date.now() - phase3StartTime;

  phases.push({
    phase_id: 'phase_3_background',
    type: 'fire_and_forget',
    agents: ['agent.hyro.progress'],
    results: [{
      agent_id: 'agent.hyro.progress',
      agent_name: 'Hyro Progress Agent',
      response: { status: 'running_in_background' },
      latency_ms: phase3LatencyMs,
    }],
    latency_ms: phase3LatencyMs,
    status: 'completed',
  });

  const totalLatencyMs = Date.now() - startTime;

  return {
    success: true,
    workflow_id: workflowId,
    workflow: 'tutoring_session',
    status: 'completed',
    phases,
    final_output: tutorResult,
    context_latency_ms: contextLatencyMs,
    total_latency_ms: totalLatencyMs,
    performance_metrics: {
      context_gather_ms: contextLatencyMs,
      phase_1_parallel_ms: phase1LatencyMs,
      phase_2_synthesis_ms: phase2LatencyMs,
      phase_3_background_ms: phase3LatencyMs,
    },
  };
}

/**
 * Execute quick check-in workflow using cached context
 */
async function executeQuickCheckinWorkflow(
  message?: string
): Promise<CoordinateResponse> {
  const workflowId = randomUUID();
  const startTime = Date.now();
  const phases: PhaseResult[] = [];

  // Try to use cached context
  let context = getCachedContext();
  let contextLatencyMs = 0;

  if (!context) {
    const contextStartTime = Date.now();
    context = await buildTutorContextAsync();
    setCachedContext(context);
    contextLatencyMs = Date.now() - contextStartTime;
  }

  // Quick assessment (simplified)
  const assessment: AssessmentResult = {
    weakest_areas: context.proficiency
      .sort((a, b) => a.level - b.level)
      .slice(0, 2)
      .map(p => ({ stat: p.stat_name, level: p.level, urgency: 'medium' as const })),
    gaps_identified: [],
    recommended_focus: [context.proficiency[0]?.stat_name || 'math'],
    scaffolding_needed: false,
    assessment_summary: 'Quick check-in assessment.',
  };

  // Quick content (simplified)
  const content: ContentSelection = {
    recommended_content: context.session_context.due_cards_count > 0
      ? [{ type: 'review', stat: 'reading' as StatName, difficulty: 50, rationale: 'Daily reviews' }]
      : [{ type: 'practice', stat: assessment.recommended_focus[0], difficulty: 50, rationale: 'Quick practice' }],
    sequence_order: ['review_or_practice'],
    estimated_duration_minutes: 15,
    content_summary: 'Quick check-in activities.',
  };

  // Execute tutor
  const phase1StartTime = Date.now();
  const tutorResult = await executeTutorAgent(context, assessment, content, message);
  const phase1LatencyMs = Date.now() - phase1StartTime;

  phases.push({
    phase_id: 'phase_1_tutor',
    type: 'sequential',
    agents: ['agent.hyro.tutor'],
    results: [{
      agent_id: 'agent.hyro.tutor',
      agent_name: 'Sage (Hyro Tutor)',
      response: tutorResult,
      latency_ms: phase1LatencyMs,
    }],
    latency_ms: phase1LatencyMs,
    status: 'completed',
  });

  const totalLatencyMs = Date.now() - startTime;

  return {
    success: true,
    workflow_id: workflowId,
    workflow: 'quick_checkin',
    status: 'completed',
    phases,
    final_output: tutorResult,
    context_latency_ms: contextLatencyMs,
    total_latency_ms: totalLatencyMs,
    performance_metrics: {
      context_gather_ms: contextLatencyMs,
      phase_1_parallel_ms: 0,
      phase_2_synthesis_ms: phase1LatencyMs,
      phase_3_background_ms: 0,
    },
  };
}

// =============================================================================
// API Routes
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'workflows';

    switch (action) {
      case 'workflows': {
        // List available workflows
        return NextResponse.json({
          success: true,
          data: {
            workflows: [
              {
                id: TUTORING_SESSION_WORKFLOW.id,
                name: TUTORING_SESSION_WORKFLOW.name,
                description: TUTORING_SESSION_WORKFLOW.description,
                phases: TUTORING_SESSION_WORKFLOW.phases.length,
              },
              {
                id: QUICK_CHECKIN_WORKFLOW.id,
                name: QUICK_CHECKIN_WORKFLOW.name,
                description: QUICK_CHECKIN_WORKFLOW.description,
                phases: QUICK_CHECKIN_WORKFLOW.phases.length,
              },
              {
                id: DEEP_DIAGNOSTIC_WORKFLOW.id,
                name: DEEP_DIAGNOSTIC_WORKFLOW.name,
                description: DEEP_DIAGNOSTIC_WORKFLOW.description,
                phases: DEEP_DIAGNOSTIC_WORKFLOW.phases.length,
              },
            ],
            agents: HYRO_AGENTS.map(a => ({
              id: a.id,
              name: a.name,
              role: a.role,
              type: a.type,
            })),
          },
        });
      }

      case 'agents': {
        // List Hyro agents
        return NextResponse.json({
          success: true,
          data: HYRO_AGENTS.map(a => ({
            id: a.id,
            name: a.name,
            role: a.role,
            type: a.type,
            domains: a.domains,
            tools: a.tools,
          })),
        });
      }

      case 'cache_status': {
        // Check context cache status
        const cached = getCachedContext();
        return NextResponse.json({
          success: true,
          data: {
            has_cached_context: !!cached,
            cache_age_ms: cached ? Date.now() - (contextCache?.timestamp || 0) : null,
            cache_ttl_ms: CACHE_TTL_MS,
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Coordinate API] GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CoordinateRequest = await request.json();
    const { workflow, message, context, timeout_ms } = body;

    switch (workflow) {
      case 'tutoring_session': {
        const result = await executeTutoringSessionWorkflow(message, context);
        return NextResponse.json(result);
      }

      case 'quick_checkin': {
        const result = await executeQuickCheckinWorkflow(message);
        return NextResponse.json(result);
      }

      case 'deep_diagnostic': {
        // TODO: Implement deep diagnostic workflow
        return NextResponse.json(
          { success: false, error: 'Deep diagnostic workflow not yet implemented' },
          { status: 501 }
        );
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown workflow: ${workflow}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Coordinate API] POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
