/**
 * HYRO FORGE: Intelligent Comprehension System
 * Socratic inquiry, not trivial quizzes
 * AI-evaluated free-form responses
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { awardXP } from './forge-xp';
import { StatName } from './forge-types';
import { evaluateComprehensionResponse as evaluateWithAI } from './forge-ai-evaluator';

// ============================================================================
// Types
// ============================================================================

export type PromptType = 'analysis' | 'connection' | 'prediction' | 'creation' | 'meta';
export type DepthRating = 'surface' | 'moderate' | 'deep';
export type ResponseQuality = 'weak' | 'adequate' | 'strong' | 'exceptional';
export type FollowUpType = 'probe_deeper' | 'redirect' | 'affirm' | 'conclude';

export interface ComprehensionPrompt {
  id: string;
  book_id: string;
  chapter_id: string | null;
  prompt_type: PromptType;
  prompt_text: string;
  context_excerpt: string | null;
  evaluation_rubric: string | null;  // JSON
  exemplar_response: string | null;
  common_misconceptions: string | null;  // JSON
  difficulty_level: string;
  stat_targeted: StatName;
  times_used: number;
  average_score: number | null;
  is_active: number;
  created_at: number;
}

export interface ComprehensionResponse {
  id: string;
  prompt_id: string;
  session_id: string | null;
  response_text: string;
  response_time_seconds: number | null;
  word_count: number | null;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_strengths: string | null;  // JSON
  ai_growth_areas: string | null;  // JSON
  ai_depth_rating: DepthRating | null;
  evidence_use_score: number | null;
  reasoning_score: number | null;
  analysis_depth_score: number | null;
  connection_score: number | null;
  xp_earned: number;
  stat_delta: number | null;
  created_at: number;
}

export interface ReadingDiscussion {
  id: string;
  book_id: string;
  initial_prompt_id: string | null;
  status: 'active' | 'concluded' | 'abandoned';
  exchange_count: number;
  depth_achieved: DepthRating | null;
  insight_moments: string | null;  // JSON
  total_xp_earned: number;
  started_at: number;
  concluded_at: number | null;
}

export interface DiscussionExchange {
  id: string;
  discussion_id: string;
  exchange_number: number;
  ai_prompt: string;
  user_response: string | null;
  response_time_seconds: number | null;
  response_quality: ResponseQuality | null;
  thinking_demonstrated: string | null;  // JSON
  follow_up_type: FollowUpType | null;
  created_at: number;
}

export interface EvaluationResult {
  score: number;
  feedback: string;
  strengths: string[];
  growth_areas: string[];
  depth_rating: DepthRating;
  rubric_scores: {
    evidence_use: number;
    reasoning: number;
    analysis_depth: number;
    connection: number;
  };
}

// ============================================================================
// Prompt Type Descriptions
// ============================================================================

export const PROMPT_TYPE_INFO: Record<PromptType, { label: string; description: string; purpose: string }> = {
  analysis: {
    label: 'Analysis',
    description: 'Test reasoning methodology',
    purpose: 'Evaluate character motivation, plot decisions, or themes with evidence',
  },
  connection: {
    label: 'Connection',
    description: 'Link to other knowledge',
    purpose: 'Connect reading to personal experience, other subjects, or real-world events',
  },
  prediction: {
    label: 'Prediction',
    description: 'Test understanding of cause/effect',
    purpose: 'Predict outcomes based on understanding of characters and plot',
  },
  creation: {
    label: 'Creation',
    description: 'Apply concepts creatively',
    purpose: 'Create something new based on understanding (rewrite scene, write letter as character)',
  },
  meta: {
    label: 'Meta',
    description: 'Reflect on learning',
    purpose: 'Reflect on reading strategies, comprehension challenges, and growth',
  },
};

// ============================================================================
// XP Constants
// ============================================================================

const XP_BASE_RESPONSE = 15;
const XP_QUALITY_MULTIPLIERS: Record<ResponseQuality, number> = {
  weak: 0.5,
  adequate: 1.0,
  strong: 1.5,
  exceptional: 2.0,
};
const XP_PER_EXCHANGE = 10;
const XP_DISCUSSION_COMPLETION = 25;
const XP_DEEP_INSIGHT_BONUS = 20;

// ============================================================================
// Prompt Functions
// ============================================================================

/**
 * Get all prompts for a book
 */
export function getPromptsForBook(studentId: string, bookId: string, type?: PromptType): ComprehensionPrompt[] {
  const db = getDatabase();
  let query = `SELECT * FROM hyro_comprehension_prompts WHERE student_id = ? AND book_id = ? AND is_active = 1`;
  const params: any[] = [studentId, bookId];

  if (type) {
    query += ` AND prompt_type = ?`;
    params.push(type);
  }

  query += ` ORDER BY times_used ASC, RANDOM()`;
  return db.prepare(query).all(...params) as ComprehensionPrompt[];
}

/**
 * Get a prompt by ID
 */
export function getPrompt(studentId: string, promptId: string): ComprehensionPrompt | null {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM hyro_comprehension_prompts WHERE student_id = ? AND id = ?`).get(studentId, promptId) as ComprehensionPrompt | null;
}

/**
 * Get a random prompt for a book (prioritizes less-used prompts)
 */
export function getRandomPrompt(studentId: string, bookId: string, chapterId?: string, type?: PromptType): ComprehensionPrompt | null {
  const db = getDatabase();
  let query = `SELECT * FROM hyro_comprehension_prompts WHERE student_id = ? AND book_id = ? AND is_active = 1`;
  const params: any[] = [studentId, bookId];

  if (chapterId) {
    query += ` AND (chapter_id = ? OR chapter_id IS NULL)`;
    params.push(chapterId);
  }
  if (type) {
    query += ` AND prompt_type = ?`;
    params.push(type);
  }

  query += ` ORDER BY times_used ASC, RANDOM() LIMIT 1`;
  return db.prepare(query).get(...params) as ComprehensionPrompt | null;
}

/**
 * Create a new prompt
 */
export function createPrompt(studentId: string, params: {
  book_id: string;
  chapter_id?: string;
  prompt_type: PromptType;
  prompt_text: string;
  context_excerpt?: string;
  evaluation_rubric?: Record<string, string>;
  exemplar_response?: string;
  common_misconceptions?: string[];
  difficulty_level?: string;
  stat_targeted?: StatName;
}): ComprehensionPrompt {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO hyro_comprehension_prompts (
      id, student_id, book_id, chapter_id, prompt_type, prompt_text, context_excerpt,
      evaluation_rubric, exemplar_response, common_misconceptions,
      difficulty_level, stat_targeted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    studentId,
    params.book_id,
    params.chapter_id || null,
    params.prompt_type,
    params.prompt_text,
    params.context_excerpt || null,
    params.evaluation_rubric ? JSON.stringify(params.evaluation_rubric) : null,
    params.exemplar_response || null,
    params.common_misconceptions ? JSON.stringify(params.common_misconceptions) : null,
    params.difficulty_level || 'medium',
    params.stat_targeted || 'reading'
  );

  return getPrompt(studentId, id)!;
}

// ============================================================================
// Feature Flag
// ============================================================================

/**
 * Feature flag for AI evaluation
 * Set USE_AI_EVALUATION=true in .env to enable LLM-powered evaluation
 * Defaults to false (uses local heuristics)
 */
const USE_AI_EVALUATION = process.env.USE_AI_EVALUATION === 'true';

// ============================================================================
// Response Evaluation
// ============================================================================

/**
 * Evaluate a response - routes to AI or local based on feature flag
 */
async function evaluateResponse(
  prompt: ComprehensionPrompt,
  response: string,
  context?: {
    childName?: string;
    currentStats?: Record<string, number>;
  }
): Promise<EvaluationResult & { source?: string }> {
  if (USE_AI_EVALUATION) {
    try {
      console.log('[Forge Comprehension] Using AI evaluation');
      return await evaluateWithAI(prompt, response, context);
    } catch (e) {
      console.error('[Forge Comprehension] AI evaluation failed, falling back to local:', e);
      return evaluateResponseLocally(prompt, response);
    }
  } else {
    console.log('[Forge Comprehension] Using local heuristic evaluation');
    return evaluateResponseLocally(prompt, response);
  }
}

/**
 * Evaluate a response using heuristics (fallback when AI unavailable)
 * This is now the fallback method when AI evaluation is disabled or fails
 */
function evaluateResponseLocally(
  prompt: ComprehensionPrompt,
  response: string
): EvaluationResult {
  const words = response.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lowerResponse = response.toLowerCase();

  // Evidence use: Look for quotes, specific references
  let evidenceScore = 5;  // Base
  if (lowerResponse.includes('"') || lowerResponse.includes("'")) evidenceScore += 8;
  if (lowerResponse.match(/chapter|page|scene|part|section/i)) evidenceScore += 5;
  if (lowerResponse.match(/said|showed|wrote|described/i)) evidenceScore += 4;
  if (wordCount > 50) evidenceScore += 3;
  evidenceScore = Math.min(25, evidenceScore);

  // Reasoning: Look for causal language
  let reasoningScore = 5;
  if (lowerResponse.match(/because|since|therefore|so|thus/i)) reasoningScore += 6;
  if (lowerResponse.match(/reason|cause|effect|result/i)) reasoningScore += 5;
  if (lowerResponse.match(/if.*then|when.*would/i)) reasoningScore += 5;
  if (lowerResponse.match(/this (shows|means|suggests|indicates)/i)) reasoningScore += 4;
  reasoningScore = Math.min(25, reasoningScore);

  // Analysis depth: Look for nuanced thinking
  let depthScore = 5;
  if (lowerResponse.match(/however|although|but also|on the other hand/i)) depthScore += 6;
  if (lowerResponse.match(/perspective|viewpoint|point of view/i)) depthScore += 5;
  if (lowerResponse.match(/complex|complicated|nuanced/i)) depthScore += 4;
  if (wordCount > 100) depthScore += 5;
  depthScore = Math.min(25, depthScore);

  // Connection: Look for personal/external connections
  let connectionScore = 5;
  if (lowerResponse.match(/reminds me|similar to|like when/i)) connectionScore += 6;
  if (lowerResponse.match(/in (my|real) life|personally/i)) connectionScore += 5;
  if (lowerResponse.match(/relates to|connects to|like in/i)) connectionScore += 5;
  if (prompt.prompt_type === 'connection' && wordCount > 30) connectionScore += 4;
  connectionScore = Math.min(25, connectionScore);

  const totalScore = evidenceScore + reasoningScore + depthScore + connectionScore;

  // Determine depth rating
  let depthRating: DepthRating = 'surface';
  if (totalScore >= 70) depthRating = 'deep';
  else if (totalScore >= 50) depthRating = 'moderate';

  // Generate feedback and insights
  const strengths: string[] = [];
  const growthAreas: string[] = [];

  if (evidenceScore >= 18) strengths.push('Strong use of textual evidence');
  else if (evidenceScore < 12) growthAreas.push('Try to include specific examples or quotes from the text');

  if (reasoningScore >= 18) strengths.push('Clear logical reasoning');
  else if (reasoningScore < 12) growthAreas.push('Explain your thinking more - use "because" to connect ideas');

  if (depthScore >= 18) strengths.push('Thoughtful, nuanced analysis');
  else if (depthScore < 12) growthAreas.push('Consider multiple perspectives or dig deeper into why');

  if (connectionScore >= 18) strengths.push('Meaningful connections made');
  else if (connectionScore < 12) growthAreas.push('Connect your ideas to personal experience or other knowledge');

  // Generate feedback
  let feedback = '';
  if (depthRating === 'deep') {
    feedback = 'Excellent response! You demonstrated strong comprehension with clear evidence and reasoning.';
  } else if (depthRating === 'moderate') {
    feedback = 'Good thinking! You showed understanding of the material.';
    if (growthAreas.length > 0) {
      feedback += ` To strengthen your response: ${growthAreas[0]}.`;
    }
  } else {
    feedback = 'You\'re on the right track.';
    if (growthAreas.length > 0) {
      feedback += ` Focus on: ${growthAreas.slice(0, 2).join(' and ')}.`;
    }
  }

  return {
    score: totalScore,
    feedback,
    strengths,
    growth_areas: growthAreas,
    depth_rating: depthRating,
    rubric_scores: {
      evidence_use: evidenceScore,
      reasoning: reasoningScore,
      analysis_depth: depthScore,
      connection: connectionScore,
    },
  };
}

// ============================================================================
// Response Functions
// ============================================================================

/**
 * Submit a response to a comprehension prompt
 * Now supports async AI evaluation
 */
export async function submitResponse(studentId: string, params: {
  prompt_id: string;
  response_text: string;
  session_id?: string;
  response_time_seconds?: number;
  child_name?: string;
  current_stats?: Record<string, number>;
}): Promise<{ response: ComprehensionResponse; evaluation: EvaluationResult; xp_earned: number }> {
  const db = getDatabase();
  const id = randomUUID();

  // Note: We need to evaluate BEFORE the transaction since it's async
  const prompt = getPrompt(studentId, params.prompt_id);
  if (!prompt) throw new Error(`Prompt not found: ${params.prompt_id}`);

  // Evaluate response (async - may call LLM)
  const evaluation = await evaluateResponse(prompt, params.response_text, {
    childName: params.child_name,
    currentStats: params.current_stats,
  });

  return db.transaction(() => {
    const wordCount = params.response_text.trim().split(/\s+/).filter(Boolean).length;

    // Calculate XP
    let quality: ResponseQuality = 'adequate';
    if (evaluation.score >= 80) quality = 'exceptional';
    else if (evaluation.score >= 65) quality = 'strong';
    else if (evaluation.score < 40) quality = 'weak';

    let xpEarned = Math.floor(XP_BASE_RESPONSE * XP_QUALITY_MULTIPLIERS[quality]);
    if (evaluation.depth_rating === 'deep') {
      xpEarned += XP_DEEP_INSIGHT_BONUS;
    }

    // Insert response
    db.prepare(`
      INSERT INTO hyro_comprehension_responses (
        id, student_id, prompt_id, session_id, response_text, response_time_seconds, word_count,
        ai_score, ai_feedback, ai_strengths, ai_growth_areas, ai_depth_rating,
        evidence_use_score, reasoning_score, analysis_depth_score, connection_score,
        xp_earned
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      studentId,
      params.prompt_id,
      params.session_id || null,
      params.response_text,
      params.response_time_seconds || null,
      wordCount,
      evaluation.score,
      evaluation.feedback,
      JSON.stringify(evaluation.strengths),
      JSON.stringify(evaluation.growth_areas),
      evaluation.depth_rating,
      evaluation.rubric_scores.evidence_use,
      evaluation.rubric_scores.reasoning,
      evaluation.rubric_scores.analysis_depth,
      evaluation.rubric_scores.connection,
      xpEarned
    );

    // Update prompt stats
    db.prepare(`
      UPDATE hyro_comprehension_prompts
      SET times_used = times_used + 1,
          average_score = COALESCE(
            (average_score * times_used + ?) / (times_used + 1),
            ?
          )
      WHERE id = ?
    `).run(evaluation.score, evaluation.score, params.prompt_id);

    // Award XP
    awardXP(studentId, xpEarned, 'comprehension_response', id);

    // Update reading session if applicable
    if (params.session_id) {
      db.prepare(`
        UPDATE hyro_reading_sessions
        SET comprehension_response_id = ?
        WHERE student_id = ? AND id = ?
      `).run(id, studentId, params.session_id);
    }

    return {
      response: db.prepare(`SELECT * FROM hyro_comprehension_responses WHERE student_id = ? AND id = ?`).get(studentId, id) as ComprehensionResponse,
      evaluation,
      xp_earned: xpEarned,
    };
  });
}

/**
 * Get responses for a prompt
 */
export function getResponsesForPrompt(studentId: string, promptId: string): ComprehensionResponse[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_comprehension_responses
    WHERE student_id = ? AND prompt_id = ?
    ORDER BY created_at DESC
  `).all(studentId, promptId) as ComprehensionResponse[];
}

// ============================================================================
// Socratic Discussion Functions
// ============================================================================

/**
 * Start a Socratic discussion
 */
export function startDiscussion(studentId: string, bookId: string, initialPromptId?: string): {
  discussion: ReadingDiscussion;
  first_exchange: DiscussionExchange;
} {
  const db = getDatabase();
  const discussionId = randomUUID();
  const exchangeId = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  return db.transaction(() => {
    // Get or create initial prompt
    let prompt: ComprehensionPrompt | null = null;
    if (initialPromptId) {
      prompt = getPrompt(studentId, initialPromptId);
    } else {
      prompt = getRandomPrompt(studentId, bookId);
    }

    if (!prompt) {
      throw new Error(`No prompts available for book: ${bookId}`);
    }

    // Create discussion
    db.prepare(`
      INSERT INTO hyro_reading_discussions (id, student_id, book_id, initial_prompt_id, started_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(discussionId, studentId, bookId, prompt.id, now);

    // Create first exchange
    db.prepare(`
      INSERT INTO hyro_discussion_exchanges (id, student_id, discussion_id, exchange_number, ai_prompt)
      VALUES (?, ?, ?, 1, ?)
    `).run(exchangeId, studentId, discussionId, prompt.prompt_text);

    // Update discussion exchange count
    db.prepare(`UPDATE hyro_reading_discussions SET exchange_count = 1 WHERE student_id = ? AND id = ?`).run(studentId, discussionId);

    return {
      discussion: db.prepare(`SELECT * FROM hyro_reading_discussions WHERE student_id = ? AND id = ?`).get(studentId, discussionId) as ReadingDiscussion,
      first_exchange: db.prepare(`SELECT * FROM hyro_discussion_exchanges WHERE student_id = ? AND id = ?`).get(studentId, exchangeId) as DiscussionExchange,
    };
  });
}

/**
 * Continue a discussion by responding to an exchange
 */
export function continueDiscussion(
  studentId: string,
  discussionId: string,
  response: string,
  responseTimeSeconds?: number
): {
  updated_exchange: DiscussionExchange;
  next_exchange: DiscussionExchange | null;
  xp_earned: number;
  should_conclude: boolean;
} {
  const db = getDatabase();

  return db.transaction(() => {
    const discussion = db.prepare(`SELECT * FROM hyro_reading_discussions WHERE student_id = ? AND id = ?`).get(studentId, discussionId) as ReadingDiscussion;
    if (!discussion) throw new Error(`Discussion not found: ${discussionId}`);
    if (discussion.status !== 'active') throw new Error(`Discussion is not active: ${discussionId}`);

    // Find current unanswered exchange
    const currentExchange = db.prepare(`
      SELECT * FROM hyro_discussion_exchanges
      WHERE student_id = ? AND discussion_id = ? AND user_response IS NULL
      ORDER BY exchange_number DESC
      LIMIT 1
    `).get(studentId, discussionId) as DiscussionExchange;

    if (!currentExchange) throw new Error(`No pending exchange in discussion: ${discussionId}`);

    // Evaluate response quality
    const words = response.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const lowerResponse = response.toLowerCase();

    let quality: ResponseQuality = 'adequate';
    const thinkingTypes: string[] = [];

    // Check for evidence
    if (lowerResponse.match(/because|since|evidence|example/i)) {
      thinkingTypes.push('evidence_based');
    }
    // Check for reasoning
    if (lowerResponse.match(/think|believe|reason|conclude/i)) {
      thinkingTypes.push('logical_reasoning');
    }
    // Check for perspective taking
    if (lowerResponse.match(/character|perspective|point of view|felt/i)) {
      thinkingTypes.push('perspective_taking');
    }
    // Check for connections
    if (lowerResponse.match(/connect|relate|similar|reminds/i)) {
      thinkingTypes.push('connection_making');
    }

    if (thinkingTypes.length >= 3 && wordCount > 50) quality = 'exceptional';
    else if (thinkingTypes.length >= 2 && wordCount > 30) quality = 'strong';
    else if (wordCount < 15 || thinkingTypes.length === 0) quality = 'weak';

    // Determine follow-up type
    let followUpType: FollowUpType = 'probe_deeper';
    if (quality === 'exceptional') followUpType = 'affirm';
    else if (quality === 'weak') followUpType = 'redirect';
    else if (discussion.exchange_count >= 4) followUpType = 'conclude';

    const shouldConclude = followUpType === 'conclude' || discussion.exchange_count >= 5;

    // Update current exchange
    db.prepare(`
      UPDATE hyro_discussion_exchanges
      SET user_response = ?, response_time_seconds = ?, response_quality = ?,
          thinking_demonstrated = ?, follow_up_type = ?
      WHERE id = ?
    `).run(
      response,
      responseTimeSeconds || null,
      quality,
      JSON.stringify(thinkingTypes),
      followUpType,
      currentExchange.id
    );

    let xpEarned = Math.floor(XP_PER_EXCHANGE * XP_QUALITY_MULTIPLIERS[quality]);

    // Create next exchange if not concluding
    let nextExchange: DiscussionExchange | null = null;
    if (!shouldConclude) {
      const nextId = randomUUID();
      const nextPrompt = generateFollowUpPrompt(followUpType, currentExchange.ai_prompt, response);

      db.prepare(`
        INSERT INTO hyro_discussion_exchanges (id, student_id, discussion_id, exchange_number, ai_prompt)
        VALUES (?, ?, ?, ?, ?)
      `).run(nextId, studentId, discussionId, discussion.exchange_count + 1, nextPrompt);

      db.prepare(`
        UPDATE hyro_reading_discussions SET exchange_count = exchange_count + 1 WHERE student_id = ? AND id = ?
      `).run(studentId, discussionId);

      nextExchange = db.prepare(`SELECT * FROM hyro_discussion_exchanges WHERE student_id = ? AND id = ?`).get(studentId, nextId) as DiscussionExchange;
    }

    // Award XP
    awardXP(studentId, xpEarned, 'discussion_exchange', currentExchange.id);

    // Update total XP
    db.prepare(`
      UPDATE hyro_reading_discussions SET total_xp_earned = total_xp_earned + ? WHERE student_id = ? AND id = ?
    `).run(xpEarned, studentId, discussionId);

    return {
      updated_exchange: db.prepare(`SELECT * FROM hyro_discussion_exchanges WHERE student_id = ? AND id = ?`).get(studentId, currentExchange.id) as DiscussionExchange,
      next_exchange: nextExchange,
      xp_earned: xpEarned,
      should_conclude: shouldConclude,
    };
  });
}

/**
 * Generate a follow-up prompt based on type and previous exchange
 */
function generateFollowUpPrompt(type: FollowUpType, previousPrompt: string, userResponse: string): string {
  switch (type) {
    case 'probe_deeper':
      return `Interesting! Can you dig deeper into why you think that? What specific evidence from the text supports your idea?`;
    case 'redirect':
      return `Let's think about this differently. What if you considered the character's feelings at that moment? How might that change your interpretation?`;
    case 'affirm':
      return `Great insight! Now, can you connect this to something in your own life or another book you've read?`;
    case 'conclude':
      return `You've done excellent thinking today. One final question: What's the most important thing you'll remember from this discussion?`;
    default:
      return `Tell me more about your thinking. What led you to that conclusion?`;
  }
}

/**
 * Conclude a discussion
 */
export function concludeDiscussion(studentId: string, discussionId: string): {
  discussion: ReadingDiscussion;
  xp_earned: number;
  summary: {
    exchanges: number;
    depth_achieved: DepthRating;
    key_insights: string[];
  };
} {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  return db.transaction(() => {
    const discussion = db.prepare(`SELECT * FROM hyro_reading_discussions WHERE student_id = ? AND id = ?`).get(studentId, discussionId) as ReadingDiscussion;
    if (!discussion) throw new Error(`Discussion not found: ${discussionId}`);

    // Get all exchanges
    const exchanges = db.prepare(`
      SELECT * FROM hyro_discussion_exchanges WHERE student_id = ? AND discussion_id = ? ORDER BY exchange_number
    `).all(studentId, discussionId) as DiscussionExchange[];

    // Calculate depth achieved
    const qualities = exchanges.filter(e => e.response_quality).map(e => e.response_quality);
    let depthAchieved: DepthRating = 'surface';
    if (qualities.includes('exceptional') || qualities.filter(q => q === 'strong').length >= 2) {
      depthAchieved = 'deep';
    } else if (qualities.includes('strong') || qualities.filter(q => q === 'adequate').length >= 2) {
      depthAchieved = 'moderate';
    }

    // Extract key insights (from thinking demonstrated)
    const keyInsights: string[] = [];
    for (const exchange of exchanges) {
      if (exchange.thinking_demonstrated) {
        try {
          const thinking = JSON.parse(exchange.thinking_demonstrated) as string[];
          for (const t of thinking) {
            if (!keyInsights.includes(t)) keyInsights.push(t);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Completion bonus
    let xpEarned = XP_DISCUSSION_COMPLETION;
    if (depthAchieved === 'deep') xpEarned += XP_DEEP_INSIGHT_BONUS;

    // Update discussion
    db.prepare(`
      UPDATE hyro_reading_discussions
      SET status = 'concluded', concluded_at = ?, depth_achieved = ?,
          insight_moments = ?, total_xp_earned = total_xp_earned + ?
      WHERE student_id = ? AND id = ?
    `).run(now, depthAchieved, JSON.stringify(keyInsights), xpEarned, studentId, discussionId);

    // Award XP
    awardXP(studentId, xpEarned, 'discussion_completed', discussionId);

    return {
      discussion: db.prepare(`SELECT * FROM hyro_reading_discussions WHERE student_id = ? AND id = ?`).get(studentId, discussionId) as ReadingDiscussion,
      xp_earned: xpEarned,
      summary: {
        exchanges: exchanges.length,
        depth_achieved: depthAchieved,
        key_insights: keyInsights,
      },
    };
  });
}

/**
 * Get a discussion by ID
 */
export function getDiscussion(studentId: string, discussionId: string): ReadingDiscussion | null {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM hyro_reading_discussions WHERE student_id = ? AND id = ?`).get(studentId, discussionId) as ReadingDiscussion | null;
}

/**
 * Get exchanges for a discussion
 */
export function getDiscussionExchanges(studentId: string, discussionId: string): DiscussionExchange[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_discussion_exchanges WHERE student_id = ? AND discussion_id = ? ORDER BY exchange_number
  `).all(studentId, discussionId) as DiscussionExchange[];
}

/**
 * Get recent discussions for a book
 */
export function getRecentDiscussions(studentId: string, bookId: string, limit: number = 10): ReadingDiscussion[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_reading_discussions
    WHERE student_id = ? AND book_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `).all(studentId, bookId, limit) as ReadingDiscussion[];
}
