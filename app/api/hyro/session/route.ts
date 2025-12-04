/**
 * HYRO FORGE: Session Orchestrator API
 *
 * GET  /api/hyro/session - Get today's session or session context
 * POST /api/hyro/session - Plan session, start, complete activity, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { StatName, STAT_NAMES } from '@/lib/hyro/forge-types';
import {
  getSessionContext,
  planSession,
  getTodaySession,
  getSession,
  getRecentSessions,
  startSession,
  completeActivity,
  skipActivity,
  abandonSession,
  getSessionAnalytics,
} from '@/lib/hyro/forge-session-orchestrator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'today';
    const sessionId = searchParams.get('session_id');

    switch (action) {
      case 'today': {
        // Get today's session plan
        const session = getTodaySession();
        return NextResponse.json({
          success: true,
          data: session,
        });
      }

      case 'session': {
        // Get specific session by ID
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'session_id required' },
            { status: 400 }
          );
        }

        const session = getSession(sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: session });
      }

      case 'context': {
        // Get full session planning context
        const context = getSessionContext();
        return NextResponse.json({ success: true, data: context });
      }

      case 'recent': {
        // Get recent sessions
        const limit = parseInt(searchParams.get('limit') || '7', 10);
        const sessions = getRecentSessions(limit);
        return NextResponse.json({ success: true, data: sessions });
      }

      case 'analytics': {
        // Get session analytics
        const analytics = getSessionAnalytics();
        return NextResponse.json({ success: true, data: analytics });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Session API] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'plan': {
        // Plan a new session
        const { available_minutes, energy_level, include_diagnostics, focus_stat } = body;

        // Validate focus_stat if provided
        if (focus_stat && !STAT_NAMES.includes(focus_stat)) {
          return NextResponse.json(
            { success: false, error: 'Invalid focus_stat' },
            { status: 400 }
          );
        }

        const session = planSession({
          available_minutes,
          energy_level,
          include_diagnostics,
          focus_stat,
        });

        return NextResponse.json({
          success: true,
          data: session,
        });
      }

      case 'start': {
        // Start a session
        const { session_id } = body;

        if (!session_id) {
          return NextResponse.json(
            { success: false, error: 'session_id required' },
            { status: 400 }
          );
        }

        const session = startSession(session_id);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: session });
      }

      case 'complete_activity': {
        // Complete an activity
        const { session_id, activity_id, xp_earned } = body;

        if (!session_id || !activity_id) {
          return NextResponse.json(
            { success: false, error: 'session_id and activity_id required' },
            { status: 400 }
          );
        }

        const session = completeActivity(session_id, activity_id, xp_earned || 0);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: session });
      }

      case 'skip_activity': {
        // Skip an activity
        const { session_id, activity_id } = body;

        if (!session_id || !activity_id) {
          return NextResponse.json(
            { success: false, error: 'session_id and activity_id required' },
            { status: 400 }
          );
        }

        const session = skipActivity(session_id, activity_id);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: session });
      }

      case 'abandon': {
        // Abandon a session
        const { session_id } = body;

        if (!session_id) {
          return NextResponse.json(
            { success: false, error: 'session_id required' },
            { status: 400 }
          );
        }

        const session = abandonSession(session_id);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: session });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Session API] POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
