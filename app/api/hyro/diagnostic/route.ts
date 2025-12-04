/**
 * HYRO FORGE: Diagnostic Assessment API
 *
 * GET  /api/hyro/diagnostic - Get diagnostic overview/status
 * POST /api/hyro/diagnostic - Start session, answer question, complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { StatName, STAT_NAMES } from '@/lib/hyro/forge-types';
import {
  getAvailableTests,
  getStatsNeedingDiagnostic,
  hasCompletedInitialDiagnostics,
  getDiagnosticOverview,
  startDiagnosticSession,
  getCurrentSession,
  getSession,
  getNextQuestion,
  getSessionQuestions,
  recordAnswer,
  completeDiagnosticSession,
  getLatestResult,
  getAllResults,
  getActiveSkillGaps,
} from '@/lib/hyro/forge-diagnostics';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';
    const statName = searchParams.get('stat') as StatName | null;
    const sessionId = searchParams.get('session_id');

    switch (action) {
      case 'overview': {
        // Get full diagnostic overview
        const overview = getDiagnosticOverview();
        const needsDiagnostic = getStatsNeedingDiagnostic();
        const hasCompleted = hasCompletedInitialDiagnostics();

        return NextResponse.json({
          success: true,
          data: {
            overview,
            stats_needing_diagnostic: needsDiagnostic,
            has_completed_initial: hasCompleted,
          },
        });
      }

      case 'tests': {
        // Get available tests
        const tests = getAvailableTests();
        return NextResponse.json({ success: true, data: tests });
      }

      case 'session': {
        // Get current session for a stat or by ID
        if (sessionId) {
          const session = getSession(sessionId);
          if (!session) {
            return NextResponse.json(
              { success: false, error: 'Session not found' },
              { status: 404 }
            );
          }
          return NextResponse.json({ success: true, data: session });
        }

        if (statName && STAT_NAMES.includes(statName)) {
          const session = getCurrentSession(statName);
          return NextResponse.json({ success: true, data: session });
        }

        return NextResponse.json(
          { success: false, error: 'Stat name or session_id required' },
          { status: 400 }
        );
      }

      case 'next-question': {
        // Get next question for a session
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

        const question = getNextQuestion(sessionId);

        // Don't send the correct answer to the client
        if (question) {
          const { correct_answer, ...questionWithoutAnswer } = question;
          return NextResponse.json({
            success: true,
            data: {
              question: questionWithoutAnswer,
              progress: {
                answered: session.questions_answered,
                total: session.questions_total,
                current_difficulty: session.current_difficulty,
              },
            },
          });
        }

        // No more questions - session might be complete
        return NextResponse.json({
          success: true,
          data: {
            question: null,
            progress: {
              answered: session.questions_answered,
              total: session.questions_total,
              current_difficulty: session.current_difficulty,
            },
            complete: session.questions_answered >= session.questions_total,
          },
        });
      }

      case 'session-questions': {
        // Get all questions answered in a session (for review)
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'session_id required' },
            { status: 400 }
          );
        }

        const questions = getSessionQuestions(sessionId);
        return NextResponse.json({ success: true, data: questions });
      }

      case 'result': {
        // Get result for a stat
        if (!statName || !STAT_NAMES.includes(statName)) {
          return NextResponse.json(
            { success: false, error: 'Valid stat name required' },
            { status: 400 }
          );
        }

        const result = getLatestResult(statName);
        return NextResponse.json({ success: true, data: result });
      }

      case 'all-results': {
        const results = getAllResults();
        return NextResponse.json({ success: true, data: results });
      }

      case 'skill-gaps': {
        const gaps = getActiveSkillGaps(statName || undefined);
        return NextResponse.json({ success: true, data: gaps });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Diagnostic API] GET Error:', error);
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
      case 'start': {
        // Start a diagnostic session
        const { stat_name } = body;

        if (!stat_name || !STAT_NAMES.includes(stat_name)) {
          return NextResponse.json(
            { success: false, error: 'Valid stat_name required' },
            { status: 400 }
          );
        }

        const session = startDiagnosticSession(stat_name);

        // Get the first question
        const question = getNextQuestion(session.id);
        const questionWithoutAnswer = question
          ? (() => {
              const { correct_answer, ...rest } = question;
              return rest;
            })()
          : null;

        return NextResponse.json({
          success: true,
          data: {
            session,
            question: questionWithoutAnswer,
          },
        });
      }

      case 'answer': {
        // Record an answer
        const { session_id, question_id, user_answer, time_spent_seconds, confidence_before } = body;

        if (!session_id || !question_id || user_answer === undefined) {
          return NextResponse.json(
            { success: false, error: 'session_id, question_id, and user_answer required' },
            { status: 400 }
          );
        }

        const result = recordAnswer({
          session_id,
          question_id,
          user_answer,
          time_spent_seconds,
          confidence_before,
        });

        // Get next question if session not complete
        let nextQuestion = null;
        if (result.questions_remaining > 0) {
          const q = getNextQuestion(session_id);
          if (q) {
            const { correct_answer, ...rest } = q;
            nextQuestion = rest;
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            ...result,
            next_question: nextQuestion,
          },
        });
      }

      case 'complete': {
        // Complete a diagnostic session
        const { session_id } = body;

        if (!session_id) {
          return NextResponse.json(
            { success: false, error: 'session_id required' },
            { status: 400 }
          );
        }

        const result = completeDiagnosticSession(session_id);

        return NextResponse.json({
          success: true,
          data: result,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Diagnostic API] POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
