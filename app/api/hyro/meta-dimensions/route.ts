/**
 * Meta-Dimensions API
 *
 * GET /api/hyro/meta-dimensions - Get student's meta-dimensions
 * POST /api/hyro/meta-dimensions - Update a meta-dimension
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUserOptional } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';

interface MetaDimensionsResponse {
  student_id: string;
  dimensions: {
    manifold_fluidity: number;
    multi_model_coherence: number;
    identity_elasticity: number;
    gradient_awareness: number;
    entropy_intuition: number;
    non_dual_resolution: number;
    cooperative_generativity: number;
  };
  meta_score: number;  // Overall score 0-1
  last_updated: number;
}

interface UpdateMetaDimensionRequest {
  student_id: string;
  subject: string;  // 'art' | 'music' | 'physical_education' etc.
  performance: number;  // 0-100
  duration_minutes: number;
}

export async function GET(req: NextRequest) {
  try {
    const user_id = currentUserOptional()?.userId || 'default';
    const searchParams = req.nextUrl.searchParams;

    // Get student ID from query params or use current user
    const student_id = searchParams.get('studentId') || user_id;

    // TODO: Implement actual meta-dimensions retrieval
    // This will call functions from @/lib/hyro/forge/forge-meta-dimensions.ts
    // For now, return stub data

    const response: MetaDimensionsResponse = {
      student_id,
      dimensions: {
        manifold_fluidity: 0.65,
        multi_model_coherence: 0.72,
        identity_elasticity: 0.58,
        gradient_awareness: 0.81,
        entropy_intuition: 0.69,
        non_dual_resolution: 0.54,
        cooperative_generativity: 0.77,
      },
      meta_score: 0.68,
      last_updated: Math.floor(Date.now() / 1000),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Meta-Dimensions API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user_id = currentUserOptional()?.userId || 'default';
    const body: UpdateMetaDimensionRequest = await req.json();

    // Validate request body
    if (!body.student_id || !body.subject || body.performance === undefined || !body.duration_minutes) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, subject, performance, duration_minutes' },
        { status: 400 }
      );
    }

    // Validate performance range
    if (body.performance < 0 || body.performance > 100) {
      return NextResponse.json(
        { error: 'Performance must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Validate duration
    if (body.duration_minutes <= 0) {
      return NextResponse.json(
        { error: 'Duration must be greater than 0' },
        { status: 400 }
      );
    }

    // TODO: Implement actual meta-dimension update logic
    // This will:
    // 1. Calculate dimension changes based on subject performance
    // 2. Update the student's meta-dimensions
    // 3. Record the change in history
    // 4. Recalculate meta_score
    //
    // Will call functions from @/lib/hyro/forge/forge-meta-dimensions.ts:
    // - updateMetaDimensionsFromPerformance(student_id, subject, performance, duration_minutes)
    // - recordDimensionChange(student_id, dimension, old_value, new_value, trigger)

    const response = {
      ok: true,
      student_id: body.student_id,
      subject: body.subject,
      dimensions_updated: ['manifold_fluidity', 'cooperative_generativity'],
      meta_score: 0.69,
      message: 'Meta-dimensions updated successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Meta-Dimensions API] POST Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
