/**
 * Wrath Shield v3 - Tweak API Route
 *
 * POST /api/tweak - Log confidence rewrites and resolve manipulation flags
 *
 * Supports:
 * - Rewrite actions with assured text
 * - Dismiss false positives
 * - Escalate for review
 */

import { NextRequest, NextResponse } from 'next/server';
import { insertTweaks, updateFlagStatus, getFlag } from '@/lib/db/queries';
import { v4 as uuidv4 } from 'uuid';

interface TweakRequest {
  flag_id: string;
  assured_text: string | null;
  action_type: 'rewrite' | 'dismiss' | 'escalate';
  context: string | null;
  user_notes: string | null;
}

/**
 * Calculate UIX delta based on action type and assured text quality
 *
 * UIX (User Interface Experience) score represents the improvement
 * in communication confidence and assertiveness.
 *
 * Formula:
 * - Rewrite with assured text: +10 to +30 points (based on length/quality)
 * - Dismiss: 0 points (no change)
 * - Escalate: +5 points (awareness without resolution)
 */
function calculateDeltaUIX(
  actionType: 'rewrite' | 'dismiss' | 'escalate',
  assuredText: string | null,
  severity: number
): number {
  switch (actionType) {
    case 'rewrite':
      if (!assuredText) return 0;

      // Base score: 10 points for taking action
      let delta = 10;

      // Length bonus: up to +10 points for detailed rewrites
      const wordCount = assuredText.trim().split(/\s+/).length;
      if (wordCount > 20) {
        delta += 10;
      } else if (wordCount > 10) {
        delta += 5;
      }

      // Severity multiplier: higher severity flags yield more improvement
      // Severity 1-5 scale
      delta += severity * 2;

      return Math.min(delta, 30); // Cap at +30

    case 'dismiss':
      // No improvement for dismissing flags
      return 0;

    case 'escalate':
      // Small improvement for awareness and escalation
      return 5;

    default:
      return 0;
  }
}

/**
 * POST /api/tweak
 * Log tweak, update flag status, and return UIX metrics
 */
export async function POST(request: NextRequest) {
  try {
    const body: TweakRequest = await request.json();

    // Validate request structure
    if (!body.flag_id || !body.action_type) {
      return NextResponse.json(
        { error: 'Missing required fields: flag_id, action_type' },
        { status: 400 }
      );
    }

    // Validate action_type
    if (!['rewrite', 'dismiss', 'escalate'].includes(body.action_type)) {
      return NextResponse.json(
        { error: 'Invalid action_type. Must be: rewrite, dismiss, or escalate' },
        { status: 400 }
      );
    }

    // Validate assured_text for rewrite action
    if (body.action_type === 'rewrite' && (!body.assured_text || !body.assured_text.trim())) {
      return NextResponse.json(
        { error: 'assured_text is required for rewrite action' },
        { status: 400 }
      );
    }

    // Verify flag exists
    const flag = getFlag(body.flag_id);
    if (!flag) {
      return NextResponse.json(
        { error: `Flag not found: ${body.flag_id}` },
        { status: 404 }
      );
    }

    // Check if flag is already resolved
    if (flag.status === 'resolved') {
      return NextResponse.json(
        {
          error: 'Flag is already resolved',
          flag_id: body.flag_id,
          current_status: flag.status
        },
        { status: 409 } // Conflict
      );
    }

    // Calculate UIX delta
    const deltaUIX = calculateDeltaUIX(
      body.action_type,
      body.assured_text,
      flag.severity
    );

    // Generate tweak ID
    const tweakId = uuidv4();

    // Insert tweak record
    insertTweaks([
      {
        id: tweakId,
        flag_id: body.flag_id,
        assured_text: body.assured_text || '',
        action_type: body.action_type,
        context: body.context,
        delta_uix: deltaUIX,
        user_notes: body.user_notes,
      },
    ]);

    // Update flag status
    // - rewrite or escalate → resolved
    // - dismiss → dismissed
    const newStatus = body.action_type === 'dismiss' ? 'dismissed' : 'resolved';
    updateFlagStatus(body.flag_id, newStatus);

    // Return success with metrics
    return NextResponse.json(
      {
        success: true,
        tweak_id: tweakId,
        flag_id: body.flag_id,
        flag_status: newStatus,
        delta_uix: deltaUIX,
        action_type: body.action_type,
        message: `Tweak logged successfully. UIX improvement: +${deltaUIX} points`,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=0' }
      }
    );
  } catch (error) {
    console.error('[Tweak API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing tweak' },
      { status: 500 }
    );
  }
}
