/**
 * Wrath Shield v3 - Burst API Route
 *
 * Handles PRIME (morning) and LOCK (evening) ritual flows.
 *
 * PRIME: Preemptive morning ritual (assured line + micro-action + no-permission toggle)
 * LOCK: Evening closing ritual (proof logging + undermine rewriting + tomorrow's preempt)
 *
 * Combined completion target: ≤5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  insertFlags,
  insertTweaks,
  updateFlagStatus,
  getFlag,
  getPendingFlags,
  getSetting,
  insertSettings,
} from '@/lib/db/queries';
import type { FlagInput, TweakInput } from '@/lib/db/types';

/**
 * Request body for burst rituals
 */
interface BurstRequest {
  ritual_type: 'PRIME' | 'LOCK';

  // PRIME fields
  assured_line?: string;
  micro_action?: string;
  no_permission_enabled?: boolean;

  // LOCK fields
  proof_text?: string;
  rewrite_flag_id?: string;
  rewrite_assured_text?: string;
  tomorrow_preempt?: string;
}

/**
 * Response structure for burst rituals
 */
interface BurstResponse {
  success: boolean;
  ritual_type: 'PRIME' | 'LOCK';
  completed_at: number;

  // PRIME results
  assured_line?: string;
  micro_action_logged?: boolean;
  no_permission_active?: boolean;

  // LOCK results
  proof_logged?: boolean;
  rewrite_completed?: boolean;
  tomorrow_preempt_set?: boolean;
  delta_uix?: number;

  message: string;
}

/**
 * GET /api/burst
 * Returns current ritual state and pending flags for rituals
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get current ritual states from settings
    const lastPrime = getSetting('last_prime_completed');
    const lastLock = getSetting('last_lock_completed');
    const noPermissionSetting = getSetting('no_permission_enabled');
    const tomorrowPreempt = getSetting('tomorrow_preempt');

    // Get pending flags for LOCK rewrite selection
    const pendingFlags = getPendingFlags();

    // Calculate if rituals are due
    const now = Math.floor(Date.now() / 1000);
    const today = new Date().toISOString().split('T')[0];

    let primeCompleted = false;
    let lockCompleted = false;

    if (lastPrime) {
      const primeDate = new Date(parseInt(lastPrime.value_enc) * 1000).toISOString().split('T')[0];
      primeCompleted = primeDate === today;
    }

    if (lastLock) {
      const lockDate = new Date(parseInt(lastLock.value_enc) * 1000).toISOString().split('T')[0];
      lockCompleted = lockDate === today;
    }

    return NextResponse.json({
      prime_completed: primeCompleted,
      lock_completed: lockCompleted,
      no_permission_enabled: noPermissionSetting?.value_enc === 'true',
      tomorrow_preempt: tomorrowPreempt?.value_enc || null,
      pending_flags: pendingFlags.map(f => ({
        id: f.id,
        original_text: f.original_text,
        severity: f.severity,
        manipulation_type: f.manipulation_type,
      })),
    }, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=0' },
    });
  } catch (error) {
    console.error('[Burst API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve ritual state' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/burst
 * Executes PRIME or LOCK ritual
 */
export async function POST(request: NextRequest): Promise<NextResponse<BurstResponse>> {
  try {
    const body: BurstRequest = await request.json();

    // Validate ritual type
    if (!body.ritual_type || !['PRIME', 'LOCK'].includes(body.ritual_type)) {
      return NextResponse.json({
        success: false,
        ritual_type: body.ritual_type || 'PRIME',
        completed_at: 0,
        message: 'Invalid ritual_type. Must be PRIME or LOCK.',
      } as BurstResponse, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);

    if (body.ritual_type === 'PRIME') {
      return handlePrimeRitual(body, now);
    } else {
      return handleLockRitual(body, now);
    }
  } catch (error) {
    console.error('[Burst API] POST Error:', error);
    return NextResponse.json({
      success: false,
      ritual_type: 'PRIME',
      completed_at: 0,
      message: 'Internal server error during ritual execution',
    } as BurstResponse, { status: 500 });
  }
}

/**
 * Handle PRIME (morning) ritual
 * - Set assured line for the day
 * - Log micro-action
 * - Enable/disable no-permission mode
 */
function handlePrimeRitual(body: BurstRequest, timestamp: number): NextResponse<BurstResponse> {
  // Validate PRIME fields
  if (!body.assured_line || body.assured_line.trim().length === 0) {
    return NextResponse.json({
      success: false,
      ritual_type: 'PRIME',
      completed_at: timestamp,
      message: 'assured_line is required for PRIME ritual',
    } as BurstResponse, { status: 400 });
  }

  // Collect all settings to batch insert
  const settings = [];

  // Store assured line
  settings.push({
    key: 'today_assured_line',
    value_enc: body.assured_line.trim(),
  });

  // Log micro-action if provided
  let microActionLogged = false;
  if (body.micro_action && body.micro_action.trim().length > 0) {
    settings.push({
      key: 'prime_micro_action',
      value_enc: body.micro_action.trim(),
    });
    microActionLogged = true;
  }

  // Set no-permission mode
  const noPermissionActive = body.no_permission_enabled === true;
  settings.push({
    key: 'no_permission_enabled',
    value_enc: noPermissionActive ? 'true' : 'false',
  });

  // Record PRIME completion timestamp
  settings.push({
    key: 'last_prime_completed',
    value_enc: timestamp.toString(),
  });

  // Batch insert all settings
  insertSettings(settings);

  return NextResponse.json({
    success: true,
    ritual_type: 'PRIME',
    completed_at: timestamp,
    assured_line: body.assured_line.trim(),
    micro_action_logged: microActionLogged,
    no_permission_active: noPermissionActive,
    message: 'PRIME ritual completed successfully',
  } as BurstResponse, {
    status: 200,
    headers: { 'Cache-Control': 'private, max-age=0' },
  });
}

/**
 * Handle LOCK (evening) ritual
 * - Log proof of the day
 * - Rewrite one undermine (flag)
 * - Set tomorrow's preempt (assured line)
 */
function handleLockRitual(body: BurstRequest, timestamp: number): NextResponse<BurstResponse> {
  let proofLogged = false;
  let rewriteCompleted = false;
  let tomorrowPreemptSet = false;
  let deltaUIX = 0;

  // Collect all settings to batch insert
  const settings = [];

  // 1. Log proof (optional but recommended)
  if (body.proof_text && body.proof_text.trim().length > 0) {
    settings.push({
      key: 'lock_proof',
      value_enc: body.proof_text.trim(),
    });
    proofLogged = true;
  }

  // 2. Rewrite one undermine (flag)
  if (body.rewrite_flag_id && body.rewrite_assured_text) {
    // Validate flag exists
    const flag = getFlag(body.rewrite_flag_id);
    if (!flag) {
      return NextResponse.json({
        success: false,
        ritual_type: 'LOCK',
        completed_at: timestamp,
        message: `Flag ${body.rewrite_flag_id} not found`,
      } as BurstResponse, { status: 404 });
    }

    if (flag.status !== 'pending') {
      return NextResponse.json({
        success: false,
        ritual_type: 'LOCK',
        completed_at: timestamp,
        message: `Flag ${body.rewrite_flag_id} is not pending (current status: ${flag.status})`,
      } as BurstResponse, { status: 400 });
    }

    // Calculate delta UIX (using same logic as tweak API)
    deltaUIX = calculateDeltaUIX('rewrite', body.rewrite_assured_text, flag.severity);

    // Create tweak
    const tweakId = uuidv4();
    const tweak: TweakInput = {
      id: tweakId,
      flag_id: body.rewrite_flag_id,
      assured_text: body.rewrite_assured_text.trim(),
      action_type: 'rewrite',
      context: 'LOCK ritual',
      delta_uix: deltaUIX,
      user_notes: null,
    };

    insertTweaks([tweak]);
    updateFlagStatus(body.rewrite_flag_id, 'resolved');
    rewriteCompleted = true;
  }

  // 3. Set tomorrow's preempt (assured line for next day)
  if (body.tomorrow_preempt && body.tomorrow_preempt.trim().length > 0) {
    settings.push({
      key: 'tomorrow_preempt',
      value_enc: body.tomorrow_preempt.trim(),
    });
    tomorrowPreemptSet = true;
  }

  // Record LOCK completion timestamp
  settings.push({
    key: 'last_lock_completed',
    value_enc: timestamp.toString(),
  });

  // Batch insert all settings
  insertSettings(settings);

  return NextResponse.json({
    success: true,
    ritual_type: 'LOCK',
    completed_at: timestamp,
    proof_logged: proofLogged,
    rewrite_completed: rewriteCompleted,
    tomorrow_preempt_set: tomorrowPreemptSet,
    delta_uix: deltaUIX,
    message: 'LOCK ritual completed successfully',
  } as BurstResponse, {
    status: 200,
    headers: { 'Cache-Control': 'private, max-age=0' },
  });
}

/**
 * Calculate delta UIX for rewrite action
 * Based on tweak API logic
 */
function calculateDeltaUIX(
  actionType: 'rewrite' | 'dismiss' | 'escalate',
  assuredText: string,
  severity: number
): number {
  if (actionType !== 'rewrite') return 0;

  let delta = 10; // base score for rewrite

  // Bonus for longer, more thoughtful rewrites
  const wordCount = assuredText.trim().split(/\s+/).length;
  if (wordCount > 20) {
    delta += 10;
  } else if (wordCount > 10) {
    delta += 5;
  }

  // Severity multiplier (higher severity = more UIX gain)
  delta += severity * 2;

  // Cap at +30 points per rewrite
  return Math.min(delta, 30);
}
