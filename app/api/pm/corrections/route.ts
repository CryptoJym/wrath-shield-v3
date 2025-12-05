/**
 * PM Corrections API
 *
 * POST /api/pm/corrections - Record a user correction
 * GET /api/pm/corrections - Get correction history
 * GET /api/pm/corrections/accuracy - Get accuracy metrics
 *
 * Corrections are user feedback when the AI makes wrong suggestions.
 * They are used to improve future predictions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/utils/server-only';
import {
  recordCorrection,
  getRecentCorrections,
  getAccuracyMetrics,
  learnFromCorrections,
  type CorrectionType,
} from '@/lib/pm/correction-feedback';

export const dynamic = 'force-dynamic';

interface CorrectionInput {
  entity_type: CorrectionType;
  entity_id: string;
  original_value: unknown;
  corrected_value: unknown;
  reason?: string;
}

export async function GET(req: NextRequest) {
  ensureServerOnly('api/pm/corrections');

  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entity_type');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 50;

    // Get correction history
    const corrections = getRecentCorrections(
      limit,
      entityType as CorrectionType | undefined
    );

    return NextResponse.json({
      ok: true,
      corrections,
      total: corrections.length,
    });
  } catch (error) {
    console.error('[PM Corrections API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureServerOnly('api/pm/corrections');

  try {
    const body: CorrectionInput = await req.json();
    const { entity_type, entity_id, original_value, corrected_value, reason } = body;

    if (!entity_type || !entity_id || original_value === undefined || corrected_value === undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required fields: entity_type, entity_id, original_value, corrected_value',
        },
        { status: 400 }
      );
    }

    const validTypes: CorrectionType[] = ['priority', 'assignment', 'routing', 'suggestion', 'pattern'];
    if (!validTypes.includes(entity_type as CorrectionType)) {
      return NextResponse.json(
        { ok: false, error: `Invalid entity_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Record the correction
    const correctionId = await recordCorrection({
      correction_type: entity_type as CorrectionType,
      original_entity_type: entity_type,
      original_entity_id: entity_id,
      original_value,
      corrected_value,
      context: {}, // Could extract context from original_value
      reason: reason || 'User correction',
    });

    // Trigger learning from corrections
    let learningResult;
    try {
      learningResult = await learnFromCorrections();
    } catch (learningError) {
      console.warn('[PM Corrections API] Learning failed:', learningError);
      // Don't fail the request if learning fails
      learningResult = { patterns_adjusted: 0, features_learned: 0, counter_patterns_created: 0 };
    }

    return NextResponse.json({
      ok: true,
      correction_id: correctionId,
      learning_triggered: true,
      patterns_adjusted: learningResult.patterns_adjusted,
      features_learned: learningResult.features_learned,
      counter_patterns_created: learningResult.counter_patterns_created,
    });
  } catch (error) {
    console.error('[PM Corrections API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
