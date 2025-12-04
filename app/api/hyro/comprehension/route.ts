/**
 * HYRO FORGE: Comprehension System API
 * Intelligent questions and Socratic discussions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPromptsForBook,
  getPrompt,
  getRandomPrompt,
  createPrompt,
  submitResponse,
  getResponsesForPrompt,
  startDiscussion,
  continueDiscussion,
  concludeDiscussion,
  getDiscussion,
  getDiscussionExchanges,
  getRecentDiscussions,
  PROMPT_TYPE_INFO,
} from '@/lib/hyro/forge-comprehension';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const bookId = searchParams.get('bookId');
    const promptId = searchParams.get('promptId');
    const discussionId = searchParams.get('discussionId');
    const promptType = searchParams.get('type');

    // Get prompt types info
    if (action === 'types') {
      return NextResponse.json({ types: PROMPT_TYPE_INFO });
    }

    // Get prompts for a book
    if (bookId && action === 'prompts') {
      const prompts = getPromptsForBook(bookId, promptType as any);
      return NextResponse.json({ prompts, count: prompts.length });
    }

    // Get random prompt for a book
    if (bookId && action === 'random-prompt') {
      const chapterId = searchParams.get('chapterId') || undefined;
      const prompt = getRandomPrompt(bookId, chapterId, promptType as any);
      if (!prompt) {
        return NextResponse.json({ error: 'No prompts available for this book' }, { status: 404 });
      }
      return NextResponse.json({ prompt });
    }

    // Get specific prompt
    if (promptId) {
      const prompt = getPrompt(promptId);
      if (!prompt) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
      }
      const responses = getResponsesForPrompt(promptId);
      return NextResponse.json({ prompt, responses });
    }

    // Get discussion
    if (discussionId) {
      const discussion = getDiscussion(discussionId);
      if (!discussion) {
        return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
      }
      const exchanges = getDiscussionExchanges(discussionId);
      return NextResponse.json({ discussion, exchanges });
    }

    // Get recent discussions for a book
    if (bookId && action === 'discussions') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const discussions = getRecentDiscussions(bookId, limit);
      return NextResponse.json({ discussions, count: discussions.length });
    }

    return NextResponse.json({ error: 'bookId, promptId, or discussionId required' }, { status: 400 });
  } catch (error) {
    console.error('Comprehension GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch comprehension data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Create new prompt
    if (action === 'create-prompt') {
      const { book_id, chapter_id, prompt_type, prompt_text, context_excerpt, evaluation_rubric, exemplar_response, common_misconceptions, difficulty_level, stat_targeted } = body;
      if (!book_id || !prompt_type || !prompt_text) {
        return NextResponse.json({ error: 'book_id, prompt_type, and prompt_text are required' }, { status: 400 });
      }

      const prompt = createPrompt({
        book_id, chapter_id, prompt_type, prompt_text, context_excerpt,
        evaluation_rubric, exemplar_response, common_misconceptions,
        difficulty_level, stat_targeted,
      });

      return NextResponse.json({ prompt, message: 'Prompt created' });
    }

    // Submit response to prompt
    if (action === 'submit-response') {
      const { prompt_id, response_text, session_id, response_time_seconds, child_name, current_stats } = body;
      if (!prompt_id || !response_text) {
        return NextResponse.json({ error: 'prompt_id and response_text are required' }, { status: 400 });
      }

      const result = await submitResponse({
        prompt_id,
        response_text,
        session_id,
        response_time_seconds,
        child_name,
        current_stats,
      });
      return NextResponse.json({
        ...result,
        message: `Response evaluated! +${result.xp_earned} XP (${result.evaluation.depth_rating} depth)`,
      });
    }

    // Start Socratic discussion
    if (action === 'start-discussion') {
      const { book_id, initial_prompt_id } = body;
      if (!book_id) {
        return NextResponse.json({ error: 'book_id is required' }, { status: 400 });
      }

      const result = startDiscussion(book_id, initial_prompt_id);
      return NextResponse.json({
        ...result,
        message: 'Discussion started! Answer the prompt to continue.',
      });
    }

    // Continue discussion
    if (action === 'continue-discussion') {
      const { discussion_id, response, response_time_seconds } = body;
      if (!discussion_id || !response) {
        return NextResponse.json({ error: 'discussion_id and response are required' }, { status: 400 });
      }

      const result = continueDiscussion(discussion_id, response, response_time_seconds);
      return NextResponse.json({
        ...result,
        message: result.should_conclude
          ? `+${result.xp_earned} XP. Discussion wrapping up...`
          : `+${result.xp_earned} XP. Continue the dialogue!`,
      });
    }

    // Conclude discussion
    if (action === 'conclude-discussion') {
      const { discussion_id } = body;
      if (!discussion_id) {
        return NextResponse.json({ error: 'discussion_id is required' }, { status: 400 });
      }

      const result = concludeDiscussion(discussion_id);
      return NextResponse.json({
        ...result,
        message: `Discussion complete! +${result.xp_earned} XP. Depth: ${result.summary.depth_achieved}`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Comprehension POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process comprehension action' },
      { status: 500 }
    );
  }
}
