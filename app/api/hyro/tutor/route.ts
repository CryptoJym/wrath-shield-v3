/**
 * HYRO FORGE: AI Tutor API
 *
 * GET  /api/hyro/tutor - Get conversation or context
 * POST /api/hyro/tutor - Send chat message, generate quest
 */

import { NextRequest, NextResponse } from 'next/server';
import { StatName, STAT_NAMES } from '@/lib/hyro/forge-types';
import {
  chat,
  generateQuest,
  getConversation,
  saveConversation,
  addMessage,
  buildTutorContext,
  TutorMessage,
  TutorConversation,
} from '@/lib/hyro/forge-ai-tutor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'context';
    const conversationId = searchParams.get('conversation_id');

    switch (action) {
      case 'context': {
        // Get current learner context
        const context = buildTutorContext();
        return NextResponse.json({
          success: true,
          data: {
            child_name: context.child_name,
            proficiency: context.proficiency.map((p) => ({
              stat_name: p.stat_name,
              level: p.level,
              uncertainty: p.uncertainty,
            })),
            zpd_summary: context.zpd_states.map((z) => ({
              stat_name: z.stat_name,
              optimal_difficulty: Math.round(z.optimal_difficulty),
              trend: z.trend,
              in_flow: context.flow_states.find((f) => f.stat_name === z.stat_name)?.in_flow || false,
            })),
            active_skill_gaps: context.active_skill_gaps.slice(0, 5),
            session_context: {
              due_cards: context.session_context.due_cards_count,
              active_quests: context.session_context.active_quests.length,
              streak_days: context.session_context.streak_days,
            },
          },
        });
      }

      case 'conversation': {
        // Get or create a conversation
        const conversation = getConversation(conversationId || undefined);
        return NextResponse.json({
          success: true,
          data: {
            id: conversation.id,
            messages: conversation.messages,
            total_xp_earned: conversation.total_xp_earned,
            stat_focus: conversation.stat_focus,
            created_at: conversation.created_at,
            last_message_at: conversation.last_message_at,
          },
        });
      }

      case 'recent': {
        // Get recent conversations
        const { getDatabase } = await import('@/lib/db/Database');
        const db = getDatabase();
        const rows = db
          .prepare(
            `SELECT id, created_at, last_message_at, total_xp_earned, stat_focus
             FROM hyro_tutor_conversations
             ORDER BY last_message_at DESC
             LIMIT 10`
          )
          .all() as Array<{
          id: string;
          created_at: number;
          last_message_at: number;
          total_xp_earned: number;
          stat_focus: string;
        }>;

        return NextResponse.json({
          success: true,
          data: rows.map((r) => ({
            id: r.id,
            created_at: r.created_at,
            last_message_at: r.last_message_at,
            total_xp_earned: r.total_xp_earned,
            stat_focus: JSON.parse(r.stat_focus || '[]'),
          })),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Tutor API] GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'chat';

    switch (action) {
      case 'chat': {
        // Process a chat message
        const { message, conversation_id } = body;

        if (!message || typeof message !== 'string') {
          return NextResponse.json(
            { success: false, error: 'message is required' },
            { status: 400 }
          );
        }

        // Get or create conversation
        const conversation = getConversation(conversation_id || undefined);

        // Add user message
        addMessage(conversation, 'user', message);

        // Get AI response
        const response = await chat(message, conversation.messages);

        // Add assistant message
        addMessage(conversation, 'assistant', response.message, {
          intent: response.intent_detected,
          xp_awarded: response.xp_awarded,
          quest_generated: response.quest_generated,
        });

        return NextResponse.json({
          success: true,
          data: {
            response: response.message,
            intent: response.intent_detected,
            suggested_actions: response.suggested_actions,
            quest_generated: response.quest_generated,
            xp_awarded: response.xp_awarded,
            difficulty_adjustment: response.difficulty_adjustment,
            conversation_id: conversation.id,
            total_xp_earned: conversation.total_xp_earned,
          },
        });
      }

      case 'generate_quest': {
        // Generate a personalized quest
        const { stat_focus, difficulty_override } = body;

        let statFocus: StatName | undefined;
        if (stat_focus && STAT_NAMES.includes(stat_focus as StatName)) {
          statFocus = stat_focus as StatName;
        }

        const quest = await generateQuest(statFocus, difficulty_override);

        return NextResponse.json({
          success: true,
          data: quest,
        });
      }

      case 'clear_conversation': {
        // Start a new conversation
        const newConversation = getConversation();
        return NextResponse.json({
          success: true,
          data: {
            conversation_id: newConversation.id,
            message: 'New conversation started',
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Tutor API] POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
