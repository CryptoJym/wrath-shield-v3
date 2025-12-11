/**
 * Meta-Dimensions History API
 *
 * GET /api/hyro/meta-dimensions/history - Get dimension change history
 * Query params: studentId, dimension, limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUserOptional } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';

interface DimensionHistoryEntry {
  id: string;
  student_id: string;
  dimension: string;
  old_value: number;
  new_value: number;
  change: number;
  trigger: string;  // What caused the change (e.g., 'art_performance', 'music_session')
  timestamp: number;
  metadata?: {
    subject?: string;
    performance?: number;
    duration_minutes?: number;
    [key: string]: unknown;
  };
}

interface HistoryResponse {
  student_id: string;
  dimension?: string;
  total_entries: number;
  entries: DimensionHistoryEntry[];
}

export async function GET(req: NextRequest) {
  try {
    const user_id = currentUserOptional()?.userId || 'default';
    const searchParams = req.nextUrl.searchParams;

    // Parse query parameters
    const student_id = searchParams.get('studentId') || user_id;
    const dimension = searchParams.get('dimension') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Validate limit
    if (limit < 1 || limit > 500) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 500' },
        { status: 400 }
      );
    }

    // Validate dimension if provided
    const validDimensions = [
      'manifold_fluidity',
      'multi_model_coherence',
      'identity_elasticity',
      'gradient_awareness',
      'entropy_intuition',
      'non_dual_resolution',
      'cooperative_generativity',
    ];

    if (dimension && !validDimensions.includes(dimension)) {
      return NextResponse.json(
        { error: `Invalid dimension. Must be one of: ${validDimensions.join(', ')}` },
        { status: 400 }
      );
    }

    // TODO: Implement actual history retrieval
    // This will call functions from @/lib/hyro/forge/forge-meta-dimensions.ts:
    // - getDimensionHistory(student_id, dimension?, limit)
    //
    // For now, return stub data

    const stubEntries: DimensionHistoryEntry[] = [
      {
        id: 'hist_001',
        student_id,
        dimension: 'manifold_fluidity',
        old_value: 0.60,
        new_value: 0.65,
        change: 0.05,
        trigger: 'art_performance',
        timestamp: Math.floor(Date.now() / 1000) - 3600,
        metadata: {
          subject: 'art',
          performance: 85,
          duration_minutes: 45,
        },
      },
      {
        id: 'hist_002',
        student_id,
        dimension: 'cooperative_generativity',
        old_value: 0.73,
        new_value: 0.77,
        change: 0.04,
        trigger: 'music_session',
        timestamp: Math.floor(Date.now() / 1000) - 7200,
        metadata: {
          subject: 'music',
          performance: 90,
          duration_minutes: 60,
        },
      },
      {
        id: 'hist_003',
        student_id,
        dimension: 'gradient_awareness',
        old_value: 0.78,
        new_value: 0.81,
        change: 0.03,
        trigger: 'physical_education',
        timestamp: Math.floor(Date.now() / 1000) - 86400,
        metadata: {
          subject: 'physical_education',
          performance: 88,
          duration_minutes: 50,
        },
      },
    ];

    // Filter by dimension if specified
    const filteredEntries = dimension
      ? stubEntries.filter(entry => entry.dimension === dimension)
      : stubEntries;

    // Apply limit
    const limitedEntries = filteredEntries.slice(0, limit);

    const response: HistoryResponse = {
      student_id,
      dimension,
      total_entries: filteredEntries.length,
      entries: limitedEntries,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Meta-Dimensions History API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
