/**
 * AI Triage Metrics API
 *
 * GET /api/pm/ai-metrics - Get comprehensive AI triage metrics
 * POST /api/pm/ai-metrics/feedback - Record human feedback on triage decisions
 * POST /api/pm/ai-metrics/bootstrap - Seed bootstrap patterns into memory
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDisagreementSummary,
  getConfidenceDistribution,
  getPerformanceMetrics,
  getRecentDisagreements,
  getPendingReviewDecisions,
  analyzeOptimalThreshold,
  recordHumanFeedback,
} from '@/lib/pm/ai-observability';
import {
  bootstrapPMMemory,
  listBootstrapPatterns,
  addCustomTriagePattern,
} from '@/lib/pm/bootstrap-memory';

/**
 * GET /api/pm/ai-metrics
 *
 * Query params:
 * - view: 'summary' | 'confidence' | 'performance' | 'disagreements' | 'pending' | 'threshold' | 'all'
 * - start: Unix timestamp for start of period
 * - end: Unix timestamp for end of period
 * - limit: Number of items for list views
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'all';
    const start = searchParams.get('start') ? parseInt(searchParams.get('start')!) : undefined;
    const end = searchParams.get('end') ? parseInt(searchParams.get('end')!) : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;

    const response: Record<string, unknown> = {};

    // Build response based on requested view
    if (view === 'summary' || view === 'all') {
      response.disagreement_summary = getDisagreementSummary(start, end);
    }

    if (view === 'confidence' || view === 'all') {
      response.confidence_distribution = getConfidenceDistribution(start, end);
    }

    if (view === 'performance' || view === 'all') {
      response.performance_metrics = getPerformanceMetrics(start, end);
    }

    if (view === 'disagreements' || view === 'all') {
      response.recent_disagreements = getRecentDisagreements(limit);
    }

    if (view === 'pending' || view === 'all') {
      response.pending_review = getPendingReviewDecisions(limit);
    }

    if (view === 'threshold' || view === 'all') {
      response.threshold_analysis = analyzeOptimalThreshold();
    }

    // Add metadata
    response.metadata = {
      timestamp: Date.now(),
      view,
      period: {
        start: start ?? 'all_time',
        end: end ?? 'now',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AI Metrics API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI metrics', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pm/ai-metrics
 *
 * Actions:
 * - action: 'feedback' - Record human feedback on a triage decision
 * - action: 'bootstrap' - Seed bootstrap patterns into memory
 * - action: 'add_pattern' - Add a custom triage pattern
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'feedback': {
        const { decision_id, human_action, human_escalation, human_priority, feedback } = body;

        if (!decision_id) {
          return NextResponse.json(
            { error: 'decision_id is required' },
            { status: 400 }
          );
        }

        const success = await recordHumanFeedback({
          decisionId: decision_id,
          humanAction: human_action,
          humanEscalation: human_escalation,
          humanPriority: human_priority,
          feedback,
        });

        return NextResponse.json({
          success,
          message: success ? 'Feedback recorded' : 'Decision not found',
        });
      }

      case 'bootstrap': {
        const { categories } = body;

        const result = await bootstrapPMMemory({
          categories: categories ?? ['triage', 'domain', 'escalation', 'corrections'],
        });

        return NextResponse.json({
          success: result.errors.length === 0,
          seeded: result.seeded,
          skipped: result.skipped,
          errors: result.errors,
        });
      }

      case 'add_pattern': {
        const {
          id,
          description,
          source,
          signal_type,
          keywords,
          recommended_action,
          recommended_escalation,
          recommended_priority,
        } = body;

        if (!id || !description || !recommended_action || !recommended_escalation) {
          return NextResponse.json(
            { error: 'id, description, recommended_action, and recommended_escalation are required' },
            { status: 400 }
          );
        }

        await addCustomTriagePattern({
          id,
          description,
          source,
          signalType: signal_type,
          keywords,
          recommendedAction: recommended_action,
          recommendedEscalation: recommended_escalation,
          recommendedPriority: recommended_priority,
        });

        return NextResponse.json({
          success: true,
          message: `Pattern ${id} added`,
        });
      }

      case 'list_patterns': {
        const patterns = listBootstrapPatterns();
        return NextResponse.json({
          patterns,
          count: patterns.length,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: feedback, bootstrap, add_pattern, list_patterns` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[AI Metrics API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
