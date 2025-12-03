/**
 * PM Actions API
 *
 * POST /api/pm/actions - Execute a PM action (classification, hierarchy, maintenance)
 * GET /api/pm/actions - Get pending clarity tasks
 *
 * This endpoint allows the PM Chat widget and other interfaces to
 * directly mutate the project/repo organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  executePMAction,
  executePMActionBatch,
  getPendingClarityTasks,
  resolveClarityTask,
  parseActionFromResponse,
  type PMAction,
  type PMActionType,
} from '@/lib/pm/pm-actions';

export const dynamic = 'force-dynamic';

// Valid action types for validation
const VALID_ACTIONS: PMActionType[] = [
  'assign_business_unit',
  'classify_as_root_project',
  'classify_as_sub_project',
  'mark_as_orphan',
  'set_domain',
  'reclassify_domain',
  'set_parent',
  'remove_parent',
  'promote_orphan_to_project',
  'demote_root_to_subproject',
  'merge_projects',
  'archive_project',
  'unarchive_project',
  'create_clarity_task',
  'update_project_dashboard',
  'set_purpose',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a batch request
    if (Array.isArray(body.actions)) {
      const actions: PMAction[] = body.actions;

      // Validate all actions
      for (const action of actions) {
        if (!VALID_ACTIONS.includes(action.action)) {
          return NextResponse.json(
            { ok: false, error: `Invalid action type: ${action.action}` },
            { status: 400 }
          );
        }
        if (!action.repo_full_name) {
          return NextResponse.json(
            { ok: false, error: 'repo_full_name is required for all actions' },
            { status: 400 }
          );
        }
      }

      const results = await executePMActionBatch(actions);

      return NextResponse.json({
        ok: true,
        results,
        summary: {
          total: results.length,
          success: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          requires_approval: results.filter(r => r.requires_approval).length,
        },
      });
    }

    // Single action request
    const { action, repo_full_name, params, rationale, confidence, escalation_level } = body;

    if (!action) {
      return NextResponse.json(
        { ok: false, error: 'action is required' },
        { status: 400 }
      );
    }

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { ok: false, error: `Invalid action type: ${action}. Valid: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!repo_full_name) {
      return NextResponse.json(
        { ok: false, error: 'repo_full_name is required' },
        { status: 400 }
      );
    }

    const pmAction: PMAction = {
      action,
      repo_full_name,
      params,
      rationale,
      confidence,
      escalation_level,
    };

    const result = await executePMAction(pmAction);

    return NextResponse.json({
      ok: result.success,
      result,
    });
  } catch (error) {
    console.error('[PM Actions API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'clarity_tasks') {
      const tasks = getPendingClarityTasks();
      return NextResponse.json({
        ok: true,
        tasks,
        count: tasks.length,
      });
    }

    if (action === 'resolve_clarity') {
      const taskId = searchParams.get('task_id');
      const answer = searchParams.get('answer');

      if (!taskId || !answer) {
        return NextResponse.json(
          { ok: false, error: 'task_id and answer are required' },
          { status: 400 }
        );
      }

      const resolved = resolveClarityTask(taskId, answer);
      return NextResponse.json({
        ok: resolved,
        message: resolved ? 'Task resolved' : 'Task not found',
      });
    }

    // Default: return available actions and their descriptions
    return NextResponse.json({
      ok: true,
      available_actions: [
        {
          action: 'assign_business_unit',
          description: 'Assign repo to a business unit (utlyze, vuplicity, newreward, etc.)',
          params: ['business_unit'],
        },
        {
          action: 'classify_as_root_project',
          description: 'Classify repo as a root/standalone project',
          params: [],
        },
        {
          action: 'classify_as_sub_project',
          description: 'Classify repo as a sub-project of another repo',
          params: ['parent_repo'],
        },
        {
          action: 'mark_as_orphan',
          description: 'Mark repo as orphan (goes to R&D holding pen)',
          params: [],
        },
        {
          action: 'set_domain',
          description: 'Set the domain type for a repo',
          params: ['domain'],
        },
        {
          action: 'set_parent',
          description: 'Set parent for a repo',
          params: ['parent_id'],
        },
        {
          action: 'archive_project',
          description: 'Archive a project',
          params: [],
        },
        {
          action: 'set_purpose',
          description: 'Set the purpose/goal description for a repo',
          params: ['purpose'],
        },
        {
          action: 'create_clarity_task',
          description: 'Create a task asking for clarification about a repo',
          params: ['question'],
        },
      ],
      valid_targets: {
        umbrella: ['utlyze'],
        business_units: ['vuplicity', 'newreward', 'hdws'],
        partner_companies: ['kahoa', 'solutionstream'],
        rd_division: ['rd'],
        legacy_personal: ['cryptojym'],
        note: 'EEG/Symbiosis is R&D (not a business unit). CryptoJym is legacy/personal (not a business unit). HDWS is under Utlyze.',
      },
      valid_domains: [
        'product-core',
        'infrastructure',
        'internal-tools',
        'client-delivery',
        'research-experiments',
        'growth-marketing',
        'operations',
        'personal',
        'archived',
      ],
    });
  } catch (error) {
    console.error('[PM Actions API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Special endpoint for parsing and executing actions from agent responses
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_response, auto_execute } = body;

    if (!agent_response) {
      return NextResponse.json(
        { ok: false, error: 'agent_response is required' },
        { status: 400 }
      );
    }

    // Parse action from agent response
    const parsedAction = parseActionFromResponse(agent_response);

    if (!parsedAction) {
      return NextResponse.json({
        ok: true,
        action_found: false,
        message: 'No executable action found in response',
      });
    }

    // If auto_execute is false, just return the parsed action
    if (!auto_execute) {
      return NextResponse.json({
        ok: true,
        action_found: true,
        parsed_action: parsedAction,
        message: 'Action parsed but not executed (auto_execute=false)',
      });
    }

    // Execute the action
    const result = await executePMAction(parsedAction);

    return NextResponse.json({
      ok: result.success,
      action_found: true,
      parsed_action: parsedAction,
      result,
    });
  } catch (error) {
    console.error('[PM Actions API] PUT Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
