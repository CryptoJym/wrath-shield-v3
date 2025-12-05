/**
 * HYRO FORGE: LLM Evaluator Service
 *
 * Evaluates student responses using Opus 4.5 for deep reasoning assessment.
 * Implements the GTC (Generative Transfer Capacity) framework with:
 * - 5 core scores: validity, coherence, transfer, utility, efficiency
 * - 7 meta-generative dimensions
 * - Confidence calibration and flag detection
 *
 * Uses structured JSON output to ensure consistent evaluation format.
 */

import { getDatabase } from '@/lib/db/Database';

// ============================================================================
// Types
// ============================================================================

/**
 * Core evaluation scores (0-1 scale)
 */
export interface CoreScores {
  validity: number;       // Is the response valid and relevant
  coherence: number;      // Internal logical consistency
  transfer: number;       // Evidence of applying knowledge beyond rote recall
  utility: number;        // Practical usefulness
  efficiency: number;     // Appropriate concision
}

/**
 * Meta-generative dimension scores (0-1 scale)
 */
export interface MetaDimensionScores {
  manifold_fluidity: number;        // Navigation across conceptual spaces
  multi_model_coherence: number;    // Synthesis across mental models
  identity_elasticity: number;      // Epistemic humility
  gradient_awareness: number;       // Self-awareness of learning velocity
  entropy_intuition: number;        // Sense for when structure helps/hinders
  non_dual_resolution: number;      // Holding paradox without collapsing
  cooperative_generativity: number; // Co-creation with other intelligences
}

/**
 * Confidence assessment
 */
export interface ConfidenceAssessment {
  overall: number;                  // 0-1 overall confidence in evaluation
  low_evidence_dims: string[];      // Dimensions with insufficient evidence
}

/**
 * Evidence collected during evaluation
 */
export interface EvaluationEvidence {
  quotes: string[];                 // Short excerpts (<=20 words) from response
  observations: string[];           // Evaluator observations
}

/**
 * Warning flags
 */
export interface EvaluationFlags {
  overconfident: boolean;           // Confidence exceeds demonstrated competence
  handwavy: boolean;                // Vague language masking lack of understanding
  style_over_substance_risk: boolean; // Impressive form hiding weak content
}

/**
 * Complete evaluation result matching the manifold spec
 */
export interface EvaluationResult {
  item_id: string;
  scores: CoreScores;
  meta: MetaDimensionScores;
  confidence: ConfidenceAssessment;
  evidence: EvaluationEvidence;
  flags: EvaluationFlags;
}

/**
 * Input for evaluation
 */
export interface EvaluationInput {
  itemId: string;
  itemType: string;                 // mcq, short_answer, extended_response, meta_probe
  prompt: string;
  studentResponse: string;
  scoringGuidance?: string;         // From meta_probes or diagnostic_items_v2
  correctAnswer?: string;           // For MCQ/short_answer
  targetDimensions?: string[];      // Which meta dimensions this item targets
  studentGradeLevel?: number;
  timeTakenMs?: number;
  confidenceSelfReport?: number;
}

// ============================================================================
// System Prompt for Evaluator
// ============================================================================

const EVALUATOR_SYSTEM_PROMPT = `You are HYRO's Assessment Evaluator, a rigorous but fair evaluator of student responses.

Your task is to evaluate a student's response and produce a structured JSON assessment.

## Evaluation Framework

### Core Scores (0.0 to 1.0)
- **validity**: Is the response relevant and addresses the prompt? (0.0 = off-topic, 1.0 = fully addresses)
- **coherence**: Does it have internal logical consistency? (0.0 = contradictory, 1.0 = fully coherent)
- **transfer**: Does it show application beyond rote recall? (0.0 = pure memorization, 1.0 = creative transfer)
- **utility**: Would this be useful in practice? (0.0 = no practical value, 1.0 = immediately actionable)
- **efficiency**: Is the explanation appropriately concise? (0.0 = verbose/incomplete, 1.0 = optimal balance)

### Meta-Generative Dimensions (0.0 to 1.0)
Only score these if the response provides evidence. Leave at 0.0 and add to low_evidence_dims if no signal.

- **manifold_fluidity**: Can navigate across conceptual spaces
- **multi_model_coherence**: Synthesizes multiple mental models
- **identity_elasticity**: Shows epistemic humility about knowledge limits
- **gradient_awareness**: Recognizes own learning velocity/trajectory
- **entropy_intuition**: Knows when structure helps vs. hinders
- **non_dual_resolution**: Can hold paradox without forcing resolution
- **cooperative_generativity**: Builds on ideas generatively

### Flags
- **overconfident**: States certainty without evidence
- **handwavy**: Uses jargon/vague language without substance
- **style_over_substance_risk**: Impressive presentation hiding weak content

## Evaluation Guidelines

1. Be calibrated: A competent 5th grader should score ~0.5-0.7 on grade-appropriate material
2. Look for genuine insight, not just correct answers
3. Value epistemic humility - acknowledging uncertainty is good
4. Reward creative thinking and novel connections
5. Penalize rote regurgitation even if technically correct

## Response Format

You MUST respond with ONLY a valid JSON object matching this schema:
{
  "item_id": "...",
  "scores": {
    "validity": 0.0,
    "coherence": 0.0,
    "transfer": 0.0,
    "utility": 0.0,
    "efficiency": 0.0
  },
  "meta": {
    "manifold_fluidity": 0.0,
    "multi_model_coherence": 0.0,
    "identity_elasticity": 0.0,
    "gradient_awareness": 0.0,
    "entropy_intuition": 0.0,
    "non_dual_resolution": 0.0,
    "cooperative_generativity": 0.0
  },
  "confidence": {
    "overall": 0.0,
    "low_evidence_dims": ["..."]
  },
  "evidence": {
    "quotes": ["..."],
    "observations": ["..."]
  },
  "flags": {
    "overconfident": false,
    "handwavy": false,
    "style_over_substance_risk": false
  }
}

Do not include any text outside the JSON object.`;

// ============================================================================
// Evaluator Implementation
// ============================================================================

/**
 * Evaluate a student response using LLM
 */
export async function evaluateResponse(input: EvaluationInput): Promise<EvaluationResult> {
  const { getConfig } = await import('@/lib/config');
  const config = getConfig();

  if (!config.openrouter?.apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Build evaluation prompt
  const userPrompt = buildEvaluationPrompt(input);

  // Call Opus 4.5 via OpenRouter
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openrouter.apiKey}`,
      'HTTP-Referer': 'https://wrath-shield.com',
      'X-Title': 'HYRO Forge Evaluator',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5-20250929',  // Opus 4.5 for deep reasoning
      messages: [
        { role: 'system', content: EVALUATOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,  // Low temperature for consistent evaluation
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Evaluator API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in evaluator response');
  }

  // Parse JSON response
  const evaluation = parseEvaluationResponse(content, input.itemId);

  return evaluation;
}

/**
 * Build the evaluation prompt for a response
 */
function buildEvaluationPrompt(input: EvaluationInput): string {
  let prompt = `## Evaluation Task

**Item ID**: ${input.itemId}
**Item Type**: ${input.itemType}
${input.studentGradeLevel ? `**Student Grade Level**: ${input.studentGradeLevel}` : ''}
${input.timeTakenMs ? `**Time Taken**: ${Math.round(input.timeTakenMs / 1000)}s` : ''}
${input.confidenceSelfReport !== undefined ? `**Student's Self-Reported Confidence**: ${input.confidenceSelfReport}%` : ''}

### Prompt Given to Student
${input.prompt}

${input.correctAnswer ? `### Expected/Correct Answer
${input.correctAnswer}` : ''}

### Student's Response
${input.studentResponse}

${input.scoringGuidance ? `### Scoring Guidance
${input.scoringGuidance}` : ''}

${input.targetDimensions?.length ? `### Target Meta Dimensions
Focus on these dimensions if evidence exists: ${input.targetDimensions.join(', ')}` : ''}

Please evaluate this response and return ONLY a JSON object matching the required schema.`;

  return prompt;
}

/**
 * Parse and validate the evaluation response JSON
 */
function parseEvaluationResponse(content: string, itemId: string): EvaluationResult {
  // Try to extract JSON from response
  let jsonStr = content.trim();

  // Handle markdown code blocks
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  }
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse evaluation JSON:', content);
    // Return default evaluation on parse failure
    return getDefaultEvaluation(itemId);
  }

  // Validate and normalize the structure
  return normalizeEvaluation(parsed, itemId);
}

/**
 * Get a default evaluation (used on parse failure)
 */
function getDefaultEvaluation(itemId: string): EvaluationResult {
  return {
    item_id: itemId,
    scores: {
      validity: 0.5,
      coherence: 0.5,
      transfer: 0.5,
      utility: 0.5,
      efficiency: 0.5,
    },
    meta: {
      manifold_fluidity: 0,
      multi_model_coherence: 0,
      identity_elasticity: 0,
      gradient_awareness: 0,
      entropy_intuition: 0,
      non_dual_resolution: 0,
      cooperative_generativity: 0,
    },
    confidence: {
      overall: 0.3,
      low_evidence_dims: [
        'manifold_fluidity', 'multi_model_coherence', 'identity_elasticity',
        'gradient_awareness', 'entropy_intuition', 'non_dual_resolution',
        'cooperative_generativity'
      ],
    },
    evidence: {
      quotes: [],
      observations: ['Evaluation parse failed - using defaults'],
    },
    flags: {
      overconfident: false,
      handwavy: false,
      style_over_substance_risk: false,
    },
  };
}

/**
 * Normalize and validate parsed evaluation
 */
function normalizeEvaluation(parsed: any, itemId: string): EvaluationResult {
  const clamp = (v: any, min: number, max: number) =>
    Math.min(max, Math.max(min, typeof v === 'number' ? v : 0));

  return {
    item_id: itemId,
    scores: {
      validity: clamp(parsed?.scores?.validity, 0, 1),
      coherence: clamp(parsed?.scores?.coherence, 0, 1),
      transfer: clamp(parsed?.scores?.transfer, 0, 1),
      utility: clamp(parsed?.scores?.utility, 0, 1),
      efficiency: clamp(parsed?.scores?.efficiency, 0, 1),
    },
    meta: {
      manifold_fluidity: clamp(parsed?.meta?.manifold_fluidity, 0, 1),
      multi_model_coherence: clamp(parsed?.meta?.multi_model_coherence, 0, 1),
      identity_elasticity: clamp(parsed?.meta?.identity_elasticity, 0, 1),
      gradient_awareness: clamp(parsed?.meta?.gradient_awareness, 0, 1),
      entropy_intuition: clamp(parsed?.meta?.entropy_intuition, 0, 1),
      non_dual_resolution: clamp(parsed?.meta?.non_dual_resolution, 0, 1),
      cooperative_generativity: clamp(parsed?.meta?.cooperative_generativity, 0, 1),
    },
    confidence: {
      overall: clamp(parsed?.confidence?.overall, 0, 1),
      low_evidence_dims: Array.isArray(parsed?.confidence?.low_evidence_dims)
        ? parsed.confidence.low_evidence_dims.filter((d: any) => typeof d === 'string')
        : [],
    },
    evidence: {
      quotes: Array.isArray(parsed?.evidence?.quotes)
        ? parsed.evidence.quotes.filter((q: any) => typeof q === 'string').slice(0, 5)
        : [],
      observations: Array.isArray(parsed?.evidence?.observations)
        ? parsed.evidence.observations.filter((o: any) => typeof o === 'string').slice(0, 5)
        : [],
    },
    flags: {
      overconfident: Boolean(parsed?.flags?.overconfident),
      handwavy: Boolean(parsed?.flags?.handwavy),
      style_over_substance_risk: Boolean(parsed?.flags?.style_over_substance_risk),
    },
  };
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Save evaluation result to database
 */
export function saveEvaluationResult(
  responseId: string,
  evaluation: EvaluationResult,
  modelUsed: string,
  rawResponse: string
): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE hyro_diagnostic_responses_v2
    SET
      llm_evaluation = ?,
      llm_model_used = ?,
      llm_raw_response = ?,
      score_validity = ?,
      score_coherence = ?,
      score_transfer = ?,
      score_utility = ?,
      score_efficiency = ?,
      meta_manifold_fluidity = ?,
      meta_multi_model_coherence = ?,
      meta_identity_elasticity = ?,
      meta_gradient_awareness = ?,
      meta_entropy_intuition = ?,
      meta_non_dual_resolution = ?,
      meta_cooperative_generativity = ?
    WHERE id = ?
  `).run(
    JSON.stringify(evaluation),
    modelUsed,
    rawResponse,
    evaluation.scores.validity,
    evaluation.scores.coherence,
    evaluation.scores.transfer,
    evaluation.scores.utility,
    evaluation.scores.efficiency,
    evaluation.meta.manifold_fluidity,
    evaluation.meta.multi_model_coherence,
    evaluation.meta.identity_elasticity,
    evaluation.meta.gradient_awareness,
    evaluation.meta.entropy_intuition,
    evaluation.meta.non_dual_resolution,
    evaluation.meta.cooperative_generativity,
    responseId
  );
}

/**
 * Get evaluation criteria from database
 */
export function getEvaluationCriteria(): any[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_evaluation_criteria
    ORDER BY dimension_name, criteria_type
  `).all();
}

/**
 * Get meta probe by ID
 */
export function getMetaProbe(probeId: string): any {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_meta_probes WHERE id = ?
  `).get(probeId);
}

/**
 * Get all active meta probes
 */
export function getActiveMetaProbes(): any[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_meta_probes WHERE is_active = 1
    ORDER BY probe_type, difficulty
  `).all();
}

/**
 * Get meta probes by type
 */
export function getMetaProbesByType(probeType: string): any[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_meta_probes
    WHERE probe_type = ? AND is_active = 1
    ORDER BY difficulty
  `).all(probeType);
}

// ============================================================================
// Aggregation Helpers
// ============================================================================

/**
 * Calculate composite GTC score from core scores
 * Weights based on research: transfer and utility are most predictive of generative capacity
 */
export function calculateGTCScore(scores: CoreScores): number {
  const weights = {
    validity: 0.15,
    coherence: 0.20,
    transfer: 0.30,
    utility: 0.25,
    efficiency: 0.10,
  };

  return (
    scores.validity * weights.validity +
    scores.coherence * weights.coherence +
    scores.transfer * weights.transfer +
    scores.utility * weights.utility +
    scores.efficiency * weights.efficiency
  );
}

/**
 * Calculate state vector components from evaluation
 * Maps evaluation to C (coherence), E (entropy handling), G (generativity)
 */
export function calculateStateVector(evaluation: EvaluationResult): {
  coherence: number;
  entropy: number;
  generativity: number;
} {
  return {
    // Coherence: validity + coherence + multi-model synthesis
    coherence: (
      evaluation.scores.validity * 0.3 +
      evaluation.scores.coherence * 0.4 +
      evaluation.meta.multi_model_coherence * 0.3
    ) * 100,

    // Entropy: transfer ability + entropy intuition + identity elasticity
    entropy: (
      evaluation.scores.transfer * 0.4 +
      evaluation.meta.entropy_intuition * 0.3 +
      evaluation.meta.identity_elasticity * 0.3
    ) * 100,

    // Generativity: utility + manifold fluidity + cooperative generativity
    generativity: (
      evaluation.scores.utility * 0.3 +
      evaluation.meta.manifold_fluidity * 0.35 +
      evaluation.meta.cooperative_generativity * 0.35
    ) * 100,
  };
}

/**
 * Aggregate multiple evaluations into a state vector with confidence
 */
export function aggregateEvaluations(evaluations: EvaluationResult[]): {
  coherence: number;
  entropy: number;
  generativity: number;
  ci_low: number;
  ci_high: number;
  n_items: number;
  signal_agreement: number;
} {
  if (evaluations.length === 0) {
    return {
      coherence: 50,
      entropy: 50,
      generativity: 50,
      ci_low: 0,
      ci_high: 100,
      n_items: 0,
      signal_agreement: 0,
    };
  }

  const vectors = evaluations.map(e => calculateStateVector(e));

  // Calculate means
  const meanC = vectors.reduce((s, v) => s + v.coherence, 0) / vectors.length;
  const meanE = vectors.reduce((s, v) => s + v.entropy, 0) / vectors.length;
  const meanG = vectors.reduce((s, v) => s + v.generativity, 0) / vectors.length;

  // Calculate standard deviations for CI
  const stdC = Math.sqrt(vectors.reduce((s, v) => s + Math.pow(v.coherence - meanC, 2), 0) / vectors.length);
  const stdE = Math.sqrt(vectors.reduce((s, v) => s + Math.pow(v.entropy - meanE, 2), 0) / vectors.length);
  const stdG = Math.sqrt(vectors.reduce((s, v) => s + Math.pow(v.generativity - meanG, 2), 0) / vectors.length);

  // Average std as proxy for CI width
  const avgStd = (stdC + stdE + stdG) / 3;
  const zScore = 1.96; // 95% CI
  const ciWidth = (zScore * avgStd) / Math.sqrt(vectors.length);

  // Signal agreement: inverse of coefficient of variation
  const overallMean = (meanC + meanE + meanG) / 3;
  const signalAgreement = Math.min(1, 1 / (1 + avgStd / overallMean));

  return {
    coherence: Math.round(meanC * 10) / 10,
    entropy: Math.round(meanE * 10) / 10,
    generativity: Math.round(meanG * 10) / 10,
    ci_low: Math.max(0, Math.round((overallMean - ciWidth) * 10) / 10),
    ci_high: Math.min(100, Math.round((overallMean + ciWidth) * 10) / 10),
    n_items: evaluations.length,
    signal_agreement: Math.round(signalAgreement * 100) / 100,
  };
}
