/**
 * Cognitive Synthesis Engine - Pattern Management
 *
 * GET /api/cortex/patterns - List patterns with filters
 * Query params: ?type=consolidation&minSuccess=0.5&limit=50
 *
 * POST /api/cortex/patterns - Create manual pattern
 * Body: { patternType, description, triggerConditions, suggestedBehavior }
 *
 * PATCH /api/cortex/patterns - Update pattern (adjust success rate, etc)
 * Body: { patternId, updates }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/server-only-guard';
import { currentUserOrThrow } from '@/lib/auth/user';
import type { SynthesisPattern, SynthesisPatternType } from '@/lib/cortex/types';

ensureServerOnly('app/api/cortex/patterns/route');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// In-Memory Pattern Storage (TODO: Move to database)
// ============================================================================

const patterns: SynthesisPattern[] = [];

// ============================================================================
// GET - List Patterns
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const { searchParams } = new URL(request.url);

    // Filter by type
    const typeParam = searchParams.get('type') as SynthesisPatternType | null;
    const minSuccessParam = searchParams.get('minSuccess');
    const limitParam = searchParams.get('limit');

    let filtered = [...patterns];

    // Apply filters
    if (typeParam) {
      filtered = filtered.filter((p) => p.patternType === typeParam);
    }

    if (minSuccessParam) {
      const minSuccess = parseFloat(minSuccessParam);
      filtered = filtered.filter((p) => p.successRate >= minSuccess);
    }

    // Sort by success rate (descending)
    filtered.sort((a, b) => b.successRate - a.successRate);

    // Limit
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    filtered = filtered.slice(0, limit);

    return NextResponse.json({
      ok: true,
      patterns: filtered,
      total: patterns.length,
      filtered: filtered.length,
    });
  } catch (e) {
    console.error('[Cortex Patterns API] Error listing patterns:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to list patterns' }, { status });
  }
}

// ============================================================================
// POST - Create Manual Pattern
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const body = await request.json();
    const { patternType, description, triggerConditions, suggestedBehavior, exampleEvents } = body;

    // Validate required fields
    if (!patternType || !description || !triggerConditions || !suggestedBehavior) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Missing required fields: patternType, description, triggerConditions, suggestedBehavior',
        },
        { status: 400 }
      );
    }

    // Create pattern
    const pattern: SynthesisPattern = {
      id: `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      patternType,
      description,
      triggerConditions,
      suggestedBehavior,
      successRate: 0.5, // Start with neutral success rate
      usageCount: 0,
      learnedAt: new Date().toISOString(),
      exampleEvents,
    };

    patterns.push(pattern);

    return NextResponse.json({
      ok: true,
      pattern,
      message: 'Pattern created successfully',
    });
  } catch (e) {
    console.error('[Cortex Patterns API] Error creating pattern:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to create pattern' }, { status });
  }
}

// ============================================================================
// PATCH - Update Pattern
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const body = await request.json();
    const { patternId, updates } = body as {
      patternId: string;
      updates: Partial<SynthesisPattern>;
    };

    if (!patternId) {
      return NextResponse.json({ ok: false, error: 'Missing patternId' }, { status: 400 });
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ ok: false, error: 'Missing or invalid updates' }, { status: 400 });
    }

    // Find and update pattern
    const index = patterns.findIndex((p) => p.id === patternId);

    if (index === -1) {
      return NextResponse.json({ ok: false, error: 'Pattern not found' }, { status: 404 });
    }

    // Apply updates
    patterns[index] = {
      ...patterns[index],
      ...updates,
      id: patterns[index].id, // Prevent ID change
      learnedAt: patterns[index].learnedAt, // Prevent timestamp change
    };

    return NextResponse.json({
      ok: true,
      pattern: patterns[index],
      message: 'Pattern updated successfully',
    });
  } catch (e) {
    console.error('[Cortex Patterns API] Error updating pattern:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to update pattern' }, { status });
  }
}
