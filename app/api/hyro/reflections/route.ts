/**
 * HYRO FORGE: Reflections/Metacognition Journal API
 * Learning reflections and growth tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  startReflection,
  submitReflection,
  getReflection,
  getTodayReflection,
  getReflectionHistory,
  getReflectionStats,
  getQuestReflections,
  getGrowthReport,
  getRandomPrompt,
  getPromptsByType,
  createPrompt,
  ReflectionType,
} from '@/lib/hyro/forge-reflections';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const reflectionId = searchParams.get('id');
    const type = searchParams.get('type') as ReflectionType | null;

    // Get specific reflection
    if (reflectionId) {
      const reflection = getReflection(reflectionId);
      if (!reflection) {
        return NextResponse.json({ error: 'Reflection not found' }, { status: 404 });
      }
      return NextResponse.json({ reflection });
    }

    // Get reflection stats
    if (action === 'stats') {
      const stats = getReflectionStats();
      return NextResponse.json(stats);
    }

    // Get growth report
    if (action === 'growth-report') {
      const days = parseInt(searchParams.get('days') || '30');
      const report = getGrowthReport(days);
      return NextResponse.json(report);
    }

    // Get today's reflection
    if (action === 'today') {
      const reflection = getTodayReflection(type || undefined);
      return NextResponse.json({
        reflection,
        has_reflected_today: reflection !== null && reflection.response !== null,
      });
    }

    // Get prompts for a type
    if (action === 'prompts') {
      if (!type) {
        return NextResponse.json({ error: 'type is required' }, { status: 400 });
      }
      const prompts = getPromptsByType(type);
      return NextResponse.json({ prompts, type });
    }

    // Get random prompt
    if (action === 'random-prompt') {
      if (!type) {
        return NextResponse.json({ error: 'type is required' }, { status: 400 });
      }
      const difficulty = searchParams.get('difficulty') as 'easy' | 'medium' | 'deep' | null;
      const prompt = getRandomPrompt(type, difficulty || undefined);
      return NextResponse.json({ prompt });
    }

    // Get quest reflections
    if (action === 'quest') {
      const questId = searchParams.get('questId');
      if (!questId) {
        return NextResponse.json({ error: 'questId is required' }, { status: 400 });
      }
      const reflections = getQuestReflections(questId);
      return NextResponse.json({ reflections, quest_id: questId });
    }

    // Default: get reflection history
    const limit = parseInt(searchParams.get('limit') || '30');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const reflections = getReflectionHistory({
      limit,
      type: type || undefined,
      startDate,
      endDate,
    });

    return NextResponse.json({ reflections, count: reflections.length });
  } catch (error) {
    console.error('Reflections GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reflections' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Start a new reflection
    if (action === 'start') {
      const { reflection_type, prompt_id, quest_id, achievement_id, stat_name } = body;
      if (!reflection_type) {
        return NextResponse.json(
          { error: 'reflection_type is required' },
          { status: 400 }
        );
      }

      const validTypes: ReflectionType[] = ['daily', 'weekly', 'quest_complete', 'achievement', 'milestone'];
      if (!validTypes.includes(reflection_type)) {
        return NextResponse.json(
          { error: `Invalid reflection_type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }

      const result = startReflection({
        reflection_type,
        prompt_id,
        quest_id,
        achievement_id,
        stat_name,
      });

      return NextResponse.json({
        ...result,
        message: result.prompt
          ? `Reflection started: "${result.prompt.prompt_text}"`
          : 'Reflection started',
      });
    }

    // Submit reflection response
    if (action === 'submit') {
      const { reflection_id, response, time_spent_seconds } = body;
      if (!reflection_id || !response) {
        return NextResponse.json(
          { error: 'reflection_id and response are required' },
          { status: 400 }
        );
      }

      if (response.trim().length < 10) {
        return NextResponse.json(
          { error: 'Response must be at least 10 characters' },
          { status: 400 }
        );
      }

      const result = submitReflection(reflection_id, response, time_spent_seconds);

      return NextResponse.json({
        ...result,
        message: `Reflection saved! +${result.xp_earned} XP`,
      });
    }

    // Create custom prompt
    if (action === 'create-prompt') {
      const { prompt_type, prompt_text, subject, difficulty_level } = body;
      if (!prompt_type || !prompt_text) {
        return NextResponse.json(
          { error: 'prompt_type and prompt_text are required' },
          { status: 400 }
        );
      }

      const prompt = createPrompt({
        prompt_type,
        prompt_text,
        subject,
        difficulty_level,
      });

      return NextResponse.json({ prompt, message: 'Prompt created' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Reflections POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process reflection' },
      { status: 500 }
    );
  }
}
