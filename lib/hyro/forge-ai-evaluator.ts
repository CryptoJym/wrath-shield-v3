/**
 * HYRO FORGE: AI-Powered Response Evaluator
 *
 * Cascading evaluation strategy (inspired by finance/smart-classify):
 * 1. Check evaluation rubric rules (if provided)
 * 2. Check historical similar responses for this prompt
 * 3. Fall back to LLM evaluation with full educational context
 *
 * Uses OpenRouterClient for LLM calls
 */

import { ensureServerOnly } from '../server-only-guard';
import { getOpenRouterClient } from '../OpenRouterClient';
import { getDatabase } from '../db/Database';
import {
  ComprehensionPrompt,
  EvaluationResult,
  DepthRating,
  PromptType,
} from './forge-comprehension';
import {
  getEvaluationSystemPrompt,
  buildEducationalContext,
  EducationalEvaluationRequest,
} from './forge-educational-prompts';
import { searchEducationMemory, addEducationMemory } from './education-memory';

// Prevent client-side imports
ensureServerOnly('lib/hyro/forge-ai-evaluator');

// ============================================================================
// Types
// ============================================================================

interface HistoricalResponse {
  id: string;
  response_text: string;
  ai_score: number;
  ai_feedback: string;
  evidence_use_score: number;
  reasoning_score: number;
  analysis_depth_score: number;
  connection_score: number;
  ai_depth_rating: DepthRating;
}

interface RubricMatch {
  matched: boolean;
  score?: number;
  feedback?: string;
  reason?: string;
}

// ============================================================================
// Step 1: Rubric Rule Matching
// ============================================================================

/**
 * Check if response matches explicit rubric rules
 * Returns early evaluation if clear rubric match found
 */
function checkRubricRules(
  prompt: ComprehensionPrompt,
  response: string
): RubricMatch {
  // If no rubric provided, skip this step
  if (!prompt.evaluation_rubric) {
    return { matched: false };
  }

  try {
    const rubric = JSON.parse(prompt.evaluation_rubric) as Record<string, string>;
    const lowerResponse = response.toLowerCase();

    // Check for must-have keywords (if specified in rubric)
    if (rubric.required_keywords) {
      const keywords = rubric.required_keywords.toLowerCase().split(',').map(k => k.trim());
      const hasAllKeywords = keywords.every(kw => lowerResponse.includes(kw));

      if (hasAllKeywords) {
        return {
          matched: true,
          score: 85,
          feedback: 'Excellent! You included all the key points from the reading.',
          reason: 'All required keywords present',
        };
      }
    }

    // Check for exemplar match (exact or very similar response)
    if (prompt.exemplar_response) {
      const exemplarLower = prompt.exemplar_response.toLowerCase();
      const similarity = calculateSimilarity(lowerResponse, exemplarLower);

      if (similarity > 0.8) {
        return {
          matched: true,
          score: 90,
          feedback: 'Outstanding response! You captured the key ideas very well.',
          reason: 'Very similar to exemplar response',
        };
      }
    }

    // Check for common misconceptions (if specified)
    if (prompt.common_misconceptions) {
      const misconceptions = JSON.parse(prompt.common_misconceptions) as string[];
      for (const misconception of misconceptions) {
        const misconceptionLower = misconception.toLowerCase();
        const similarity = calculateSimilarity(lowerResponse, misconceptionLower);

        if (similarity > 0.6) {
          return {
            matched: true,
            score: 35,
            feedback: "You're on the right track, but let's think about this differently. Consider what the text actually says about this.",
            reason: 'Matches common misconception',
          };
        }
      }
    }
  } catch (e) {
    console.error('[AI Evaluator] Error parsing rubric:', e);
  }

  return { matched: false };
}

/**
 * Simple similarity calculation using word overlap
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/).filter(Boolean);
  const words2 = text2.toLowerCase().split(/\s+/).filter(Boolean);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
  const union = new Set([...Array.from(set1), ...Array.from(set2)]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ============================================================================
// Step 2: Historical Response Matching
// ============================================================================

/**
 * Check database for similar historical responses to this prompt
 * If we find 3+ responses with similar text and consistent scoring, use that
 */
function checkHistoricalResponses(
  promptId: string,
  response: string
): EvaluationResult | null {
  const db = getDatabase();

  // Get all previous responses for this prompt with evaluations
  const historical = db.prepare(`
    SELECT
      id, response_text, ai_score, ai_feedback,
      evidence_use_score, reasoning_score,
      analysis_depth_score, connection_score,
      ai_depth_rating
    FROM hyro_comprehension_responses
    WHERE prompt_id = ?
      AND ai_score IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 20
  `).all(promptId) as HistoricalResponse[];

  if (historical.length < 3) {
    return null; // Need at least 3 historical responses to be confident
  }

  // Find similar responses
  const similarResponses = historical.filter(h => {
    const similarity = calculateSimilarity(response, h.response_text);
    return similarity > 0.7; // 70% similarity threshold
  });

  if (similarResponses.length < 2) {
    return null; // Need at least 2 similar responses
  }

  // Calculate average scores from similar responses
  const avgScore = Math.round(
    similarResponses.reduce((sum, r) => sum + (r.ai_score || 0), 0) / similarResponses.length
  );
  const avgEvidence = Math.round(
    similarResponses.reduce((sum, r) => sum + (r.evidence_use_score || 0), 0) / similarResponses.length
  );
  const avgReasoning = Math.round(
    similarResponses.reduce((sum, r) => sum + (r.reasoning_score || 0), 0) / similarResponses.length
  );
  const avgDepth = Math.round(
    similarResponses.reduce((sum, r) => sum + (r.analysis_depth_score || 0), 0) / similarResponses.length
  );
  const avgConnection = Math.round(
    similarResponses.reduce((sum, r) => sum + (r.connection_score || 0), 0) / similarResponses.length
  );

  // Most common depth rating
  const depthRatings = similarResponses.map(r => r.ai_depth_rating).filter(Boolean);
  const depthRating: DepthRating = getMostCommon(depthRatings) || 'moderate';

  // Generate feedback acknowledging consistent pattern
  const feedback = generateHistoricalFeedback(avgScore, similarResponses.length);

  return {
    score: avgScore,
    feedback,
    strengths: extractStrengths(avgEvidence, avgReasoning, avgDepth, avgConnection),
    growth_areas: extractGrowthAreas(avgEvidence, avgReasoning, avgDepth, avgConnection),
    depth_rating: depthRating,
    rubric_scores: {
      evidence_use: avgEvidence,
      reasoning: avgReasoning,
      analysis_depth: avgDepth,
      connection: avgConnection,
    },
  };
}

function getMostCommon<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  let maxCount = 0;
  let mostCommon: T | null = null;
  for (const [item, count] of Array.from(counts.entries())) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = item;
    }
  }
  return mostCommon;
}

function generateHistoricalFeedback(score: number, matchCount: number): string {
  if (score >= 80) {
    return `Excellent work! This shows the strong understanding you've been developing.`;
  } else if (score >= 65) {
    return `Good thinking! You're building consistent comprehension skills.`;
  } else if (score >= 50) {
    return `You're making progress! Keep working on deepening your analysis.`;
  } else {
    return `Keep trying! Let's work together on strengthening your response.`;
  }
}

function extractStrengths(evidence: number, reasoning: number, depth: number, connection: number): string[] {
  const strengths: string[] = [];
  if (evidence >= 18) strengths.push('Strong use of textual evidence');
  if (reasoning >= 18) strengths.push('Clear logical reasoning');
  if (depth >= 18) strengths.push('Thoughtful, nuanced analysis');
  if (connection >= 18) strengths.push('Meaningful connections made');
  return strengths;
}

function extractGrowthAreas(evidence: number, reasoning: number, depth: number, connection: number): string[] {
  const areas: string[] = [];
  if (evidence < 12) areas.push('Try to include specific examples or quotes from the text');
  if (reasoning < 12) areas.push('Explain your thinking more - use "because" to connect ideas');
  if (depth < 12) areas.push('Consider multiple perspectives or dig deeper into why');
  if (connection < 12) areas.push('Connect your ideas to personal experience or other knowledge');
  return areas;
}

// ============================================================================
// Step 3: LLM Evaluation with Educational Context
// ============================================================================

/**
 * Use LLM to evaluate response with full educational context
 */
async function evaluateWithLLM(
  prompt: ComprehensionPrompt,
  response: string,
  childName?: string,
  currentStats?: Record<string, number>
): Promise<EvaluationResult> {
  // Search for recent learning patterns in Zep memory
  const recentPatterns: string[] = [];
  try {
    const memoryResults = await searchEducationMemory('learning pattern', 5);
    recentPatterns.push(...memoryResults.map(r => r.memory.text.substring(0, 100)));
  } catch (e) {
    console.log('[AI Evaluator] Could not fetch learning patterns from memory:', e);
  }

  // Build educational context
  const educationalContext = buildEducationalContext({
    childName,
    recentPatterns: recentPatterns.length > 0 ? recentPatterns : undefined,
    currentStats,
    bookContext: prompt.context_excerpt || undefined,
  });

  // Build system prompt
  const systemPrompt = getEvaluationSystemPrompt(prompt.prompt_type);

  // Build user prompt
  const userPrompt = `${educationalContext}

PROMPT FOR STUDENT:
${prompt.prompt_text}

STUDENT'S RESPONSE:
${response}

Please evaluate this response according to the rubric and return the JSON format specified.`;

  // Get OpenRouter client
  const client = getOpenRouterClient();

  try {
    // Make LLM call
    const result = await client.getCoachingResponse({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Low temperature for consistent evaluation
      max_tokens: 1000,
      metadata: {
        date: new Date().toISOString(),
        has_whoop_data: false,
        has_manipulations: false,
        wrath_deployed: false,
        memory_count: 0,
        anchor_count: 0,
        // Custom fields for educational context
        prompt_id: prompt.id,
        prompt_type: prompt.prompt_type,
        evaluation_type: 'comprehension',
      } as any, // Extended metadata for educational use
    });

    // Parse JSON response
    const evaluation = JSON.parse(result.content);

    // Validate structure
    if (!evaluation.score || !evaluation.feedback || !evaluation.rubric_scores) {
      throw new Error('Invalid evaluation structure from LLM');
    }

    // Store evaluation in memory for future reference
    await addEducationMemory(
      `Evaluated response to prompt "${prompt.prompt_text.substring(0, 50)}...": Score ${evaluation.score}/100, Depth: ${evaluation.depth_rating}`,
      'progress',
      {
        prompt_id: prompt.id,
        score: evaluation.score,
        depth_rating: evaluation.depth_rating,
        evaluation_source: 'llm',
      }
    );

    return evaluation as EvaluationResult;
  } catch (e) {
    console.error('[AI Evaluator] LLM evaluation failed:', e);
    throw new Error(`LLM evaluation failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Main Evaluation Function
// ============================================================================

/**
 * Evaluate a comprehension response using cascading strategy
 *
 * Strategy:
 * 1. Check rubric rules (instant evaluation if clear match)
 * 2. Check historical similar responses (use if 2+ matches found)
 * 3. Fall back to LLM with full context
 *
 * @param prompt - The comprehension prompt
 * @param response - Student's response text
 * @param context - Optional educational context (child name, stats, etc.)
 * @returns Evaluation result with scores and feedback
 */
export async function evaluateComprehensionResponse(
  prompt: ComprehensionPrompt,
  response: string,
  context?: {
    childName?: string;
    currentStats?: Record<string, number>;
  }
): Promise<EvaluationResult & { source: 'rubric' | 'history' | 'llm' }> {
  console.log(`[AI Evaluator] Evaluating response for prompt: ${prompt.id}`);

  // Step 1: Check rubric rules
  const rubricMatch = checkRubricRules(prompt, response);
  if (rubricMatch.matched && rubricMatch.score !== undefined) {
    console.log(`[AI Evaluator] ✓ Rubric match found (score: ${rubricMatch.score})`);

    // Convert to full evaluation result
    const rubricEval: EvaluationResult = {
      score: rubricMatch.score,
      feedback: rubricMatch.feedback || 'Good work!',
      strengths: rubricMatch.score >= 70 ? ['Followed prompt requirements well'] : [],
      growth_areas: rubricMatch.score < 70 ? ['Review the key points from the reading'] : [],
      depth_rating: rubricMatch.score >= 80 ? 'deep' : rubricMatch.score >= 60 ? 'moderate' : 'surface',
      rubric_scores: distributeScore(rubricMatch.score),
    };

    return { ...rubricEval, source: 'rubric' };
  }

  // Step 2: Check historical responses
  const historicalEval = checkHistoricalResponses(prompt.id, response);
  if (historicalEval) {
    console.log(`[AI Evaluator] ✓ Historical match found (score: ${historicalEval.score})`);
    return { ...historicalEval, source: 'history' };
  }

  // Step 3: LLM evaluation (with retries)
  console.log(`[AI Evaluator] → Requesting LLM evaluation...`);
  try {
    const llmEval = await evaluateWithLLM(
      prompt,
      response,
      context?.childName,
      context?.currentStats
    );
    console.log(`[AI Evaluator] ✓ LLM evaluation complete (score: ${llmEval.score})`);
    return { ...llmEval, source: 'llm' };
  } catch (e) {
    console.error('[AI Evaluator] All evaluation methods failed:', e);
    throw e;
  }
}

/**
 * Distribute a total score across rubric dimensions
 */
function distributeScore(totalScore: number): {
  evidence_use: number;
  reasoning: number;
  analysis_depth: number;
  connection: number;
} {
  const base = Math.floor(totalScore / 4);
  const remainder = totalScore % 4;

  return {
    evidence_use: base + (remainder > 0 ? 1 : 0),
    reasoning: base + (remainder > 1 ? 1 : 0),
    analysis_depth: base + (remainder > 2 ? 1 : 0),
    connection: base,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { EducationalEvaluationRequest };
