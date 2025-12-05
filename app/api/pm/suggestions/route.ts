/**
 * PM Suggestions API
 *
 * GET /api/pm/suggestions - Get predictive suggestions
 * POST /api/pm/suggestions/:id/accept - Accept a suggestion
 * POST /api/pm/suggestions/:id/reject - Reject a suggestion
 *
 * Suggestions are AI-generated recommendations based on patterns
 * extracted from historical data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/utils/server-only';
import { generateDailySuggestions } from '@/lib/pm/predictive-suggestions';
import { recordCorrection } from '@/lib/pm/correction-feedback';
import { updateTask } from '@/lib/pm/integration';
import type { TaskPriority } from '@/lib/pm/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  ensureServerOnly('api/pm/suggestions');

  try {
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type');
    const activeOnlyParam = searchParams.get('active_only');
    const activeOnly = activeOnlyParam !== 'false'; // Default to true

    // Get daily suggestions
    const suggestions = await generateDailySuggestions();

    // Filter by type if specified
    let filteredSuggestions = suggestions;
    if (typeFilter && ['priority', 'action', 'completion', 'assignment'].includes(typeFilter)) {
      filteredSuggestions = suggestions.filter(s => s.suggestion_type === typeFilter);
    }

    // Filter by active status
    if (activeOnly) {
      const now = new Date();
      filteredSuggestions = filteredSuggestions.filter(s => {
        // Check if suggestion has expired
        if (s.metadata?.expires_at) {
          const expiresAt = new Date(s.metadata.expires_at);
          return expiresAt > now;
        }
        return true; // No expiry = always active
      });
    }

    return NextResponse.json({
      ok: true,
      suggestions: filteredSuggestions,
      total: filteredSuggestions.length,
    });
  } catch (error) {
    console.error('[PM Suggestions API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureServerOnly('api/pm/suggestions');

  try {
    const body = await req.json();
    const { suggestion_id, action, reason, correct_value } = body;

    if (!suggestion_id || !action) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: suggestion_id, action' },
        { status: 400 }
      );
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Must be: accept or reject' },
        { status: 400 }
      );
    }

    // Parse suggestion ID to extract target entity
    // Format: suggest_{type}_{entity_id}_{timestamp}
    const parts = suggestion_id.split('_');
    if (parts.length < 4 || parts[0] !== 'suggest') {
      return NextResponse.json(
        { ok: false, error: 'Invalid suggestion_id format' },
        { status: 400 }
      );
    }

    const suggestionType = parts[1]; // priority, action, completion, assignment
    const entityIdParts = parts.slice(2, -1); // Everything between type and timestamp
    const entityId = entityIdParts.join('_');

    // Get the actual suggestion to know what to execute
    const allSuggestions = await generateDailySuggestions();
    const suggestion = allSuggestions.find(s => s.id === suggestion_id);

    if (!suggestion) {
      return NextResponse.json(
        { ok: false, error: 'Suggestion not found or expired' },
        { status: 404 }
      );
    }

    let result: Record<string, unknown> = {};

    if (action === 'accept') {
      // Execute the suggestion
      if (suggestionType === 'priority' && suggestion.metadata?.suggested_priority) {
        // Update task priority
        const task = await updateTask(entityId, {
          priority: suggestion.metadata.suggested_priority as TaskPriority,
        });

        if (task) {
          result = {
            executed: true,
            task_updated: true,
            new_priority: suggestion.metadata.suggested_priority,
          };
        } else {
          result = {
            executed: false,
            error: 'Failed to update task',
          };
        }
      } else if (suggestionType === 'assignment' && suggestion.metadata?.suggested_assignee) {
        // Update task assignee
        const task = await updateTask(entityId, {
          assignee: suggestion.metadata.suggested_assignee as string,
        });

        if (task) {
          result = {
            executed: true,
            task_updated: true,
            new_assignee: suggestion.metadata.suggested_assignee,
          };
        } else {
          result = {
            executed: false,
            error: 'Failed to update task',
          };
        }
      } else {
        // For action and completion suggestions, just mark as accepted
        // (these are informational, not executable)
        result = {
          accepted: true,
          informational: true,
        };
      }
    } else if (action === 'reject') {
      // Record as correction
      const originalValue = suggestion.metadata || {};
      const correctedValue = correct_value || { rejected: true };

      await recordCorrection({
        correction_type: 'suggestion',
        original_entity_type: suggestion.target_entity.type,
        original_entity_id: suggestion.target_entity.id,
        original_value: originalValue,
        corrected_value: correctedValue,
        context: { suggestion_id, suggestion_type: suggestionType },
        reason: reason || 'User rejected suggestion',
      });

      result = {
        rejected: true,
        correction_recorded: true,
      };
    }

    return NextResponse.json({
      ok: true,
      suggestion_id,
      action,
      ...result,
    });
  } catch (error) {
    console.error('[PM Suggestions API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
