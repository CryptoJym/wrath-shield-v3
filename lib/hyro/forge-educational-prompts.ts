/**
 * HYRO FORGE: Educational AI Prompts
 * Age-appropriate system prompts for evaluating 10-year-old responses
 * Socratic questioning and constructive feedback
 */

import { PromptType } from './forge-comprehension';

// ============================================================================
// Core Educational Principles
// ============================================================================

const CORE_PRINCIPLES = `
EDUCATIONAL CONTEXT:
- Student age: 10 years old (5th-6th grade)
- Learning style: Socratic inquiry, not traditional testing
- Goal: Encourage deep thinking, not just "right answers"
- Tone: Supportive, curious, encouraging

EVALUATION PHILOSOPHY:
- Focus on growth, not perfection
- Celebrate thinking process, not just conclusions
- Give specific, actionable feedback
- Use age-appropriate language (no academic jargon)
- Be warm and encouraging while maintaining rigor
`;

const CONTENT_SAFETY = `
CONTENT SAFETY:
- All feedback must be age-appropriate for 10-year-olds
- Use positive, constructive language
- Never shame or discourage
- If response shows misconceptions, gently redirect
- Flag any inappropriate content in student responses
`;

// ============================================================================
// Evaluation Rubric Prompt
// ============================================================================

export function getEvaluationSystemPrompt(promptType: PromptType): string {
  const typeSpecificGuidance = getTypeSpecificGuidance(promptType);

  return `${CORE_PRINCIPLES}

${typeSpecificGuidance}

${CONTENT_SAFETY}

SCORING RUBRIC (0-100):
You must evaluate on these four dimensions:

1. EVIDENCE USE (0-25 points)
   - Does the student reference specific examples from the text?
   - Do they use quotes or specific details?
   - Is their evidence relevant to their point?

2. REASONING (0-25 points)
   - Does the student explain their thinking?
   - Do they connect ideas with "because," "therefore," etc.?
   - Is their logic sound and clear?

3. ANALYSIS DEPTH (0-25 points)
   - Does the student go beyond surface-level observations?
   - Do they consider multiple perspectives?
   - Do they show nuanced understanding?

4. CONNECTION (0-25 points)
   - Does the student connect to personal experience?
   - Do they link to other books or real-world events?
   - Do they show creative or original thinking?

DEPTH RATING:
- "surface" (0-49 points): Basic understanding, needs development
- "moderate" (50-69 points): Good thinking with room to grow
- "deep" (70-100 points): Excellent comprehension and insight

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{
  "score": <total score 0-100>,
  "feedback": "<warm, encouraging feedback in 1-3 sentences>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "growth_areas": ["<specific growth area 1>", "<specific growth area 2>"],
  "depth_rating": "<surface|moderate|deep>",
  "rubric_scores": {
    "evidence_use": <0-25>,
    "reasoning": <0-25>,
    "analysis_depth": <0-25>,
    "connection": <0-25>
  }
}

Remember: You're a supportive teacher, not a harsh critic. Celebrate effort and thinking!`;
}

// ============================================================================
// Type-Specific Evaluation Guidance
// ============================================================================

function getTypeSpecificGuidance(type: PromptType): string {
  switch (type) {
    case 'analysis':
      return `PROMPT TYPE: ANALYSIS
Focus on evaluating how well the student:
- Breaks down character motivations or plot decisions
- Supports their analysis with textual evidence
- Explains their reasoning step-by-step
- Considers cause and effect

Look for: Clear reasoning, evidence from text, logical connections`;

    case 'connection':
      return `PROMPT TYPE: CONNECTION
Focus on evaluating how well the student:
- Links the reading to their own life experiences
- Connects to other books, movies, or subjects
- Relates story themes to real-world events
- Shows personal insight or reflection

Look for: Personal relevance, creative connections, meaningful parallels`;

    case 'prediction':
      return `PROMPT TYPE: PREDICTION
Focus on evaluating how well the student:
- Uses evidence from the text to support predictions
- Demonstrates understanding of character patterns
- Shows logical thinking about cause and effect
- Explains their reasoning for "what happens next"

Look for: Text-based predictions, logical reasoning, character understanding`;

    case 'creation':
      return `PROMPT TYPE: CREATION
Focus on evaluating how well the student:
- Shows understanding of the original text
- Demonstrates creativity and originality
- Maintains consistency with source material
- Applies comprehension in a creative way

Look for: Understanding + creativity, consistency, originality`;

    case 'meta':
      return `PROMPT TYPE: METACOGNITION
Focus on evaluating how well the student:
- Reflects on their own learning process
- Identifies what was easy or challenging
- Describes strategies they used
- Shows awareness of their comprehension

Look for: Self-awareness, growth mindset, learning strategies`;

    default:
      return `GENERAL EVALUATION
Focus on the student's overall comprehension and thinking quality.`;
  }
}

// ============================================================================
// Follow-Up Question Generation
// ============================================================================

export function getFollowUpPrompt(
  originalPrompt: string,
  studentResponse: string,
  evaluationScore: number,
  promptType: PromptType
): string {
  return `${CORE_PRINCIPLES}

You are generating a Socratic follow-up question for a 10-year-old reader.

ORIGINAL QUESTION:
${originalPrompt}

STUDENT'S RESPONSE:
${studentResponse}

EVALUATION SCORE: ${evaluationScore}/100

YOUR TASK:
Generate ONE follow-up question that:
${getFollowUpGuidance(evaluationScore, promptType)}

TONE GUIDELINES:
- Use "you" and "your" (conversational, not formal)
- Keep it short (1-2 sentences max)
- Show genuine curiosity
- Build on what they said
- Age-appropriate (10-year-old level)

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "follow_up": "<your follow-up question here>",
  "follow_up_type": "<probe_deeper|redirect|affirm|conclude>"
}`;
}

function getFollowUpGuidance(score: number, type: PromptType): string {
  if (score >= 80) {
    return `- Celebrates their insight (they did great!)
- Pushes them to an even deeper level
- Connects to broader themes or personal experience
- Type: "affirm" (acknowledge excellence, then extend)
Example: "That's a brilliant insight! How does this connect to something in your own life?"`;
  } else if (score >= 60) {
    return `- Acknowledges their good thinking
- Probes deeper into one specific point they made
- Asks them to elaborate or explain more
- Type: "probe_deeper" (build on what they started)
Example: "Interesting idea! Can you tell me more about why you think that?"`;
  } else if (score >= 40) {
    return `- Gently redirects their thinking
- Offers a new angle or perspective to consider
- Helps them see what they might have missed
- Type: "redirect" (guide without criticizing)
Example: "What if you thought about it from the character's point of view? How might they feel?"`;
  } else {
    return `- Provides scaffolding and support
- Breaks down the question into smaller parts
- Offers hints or context to help them
- Type: "redirect" (supportive guidance)
Example: "Let's start with something specific. What was one thing the character said or did that caught your attention?"`;
  }
}

// ============================================================================
// Historical Context Building
// ============================================================================

export function buildEducationalContext(params: {
  childName?: string;
  recentPatterns?: string[];
  currentStats?: Record<string, number>;
  bookContext?: string;
}): string {
  const parts: string[] = [];

  if (params.childName) {
    parts.push(`STUDENT: ${params.childName}`);
  }

  if (params.currentStats && Object.keys(params.currentStats).length > 0) {
    parts.push(`\nCURRENT SKILL LEVELS:`);
    for (const [stat, level] of Object.entries(params.currentStats)) {
      parts.push(`- ${stat}: ${level}/100`);
    }
  }

  if (params.recentPatterns && params.recentPatterns.length > 0) {
    parts.push(`\nRECENT LEARNING PATTERNS:`);
    params.recentPatterns.forEach((pattern, i) => {
      parts.push(`${i + 1}. ${pattern}`);
    });
  }

  if (params.bookContext) {
    parts.push(`\nBOOK CONTEXT:\n${params.bookContext}`);
  }

  return parts.join('\n');
}

// ============================================================================
// Common Misconceptions Handler
// ============================================================================

export function getMisconceptionPrompt(
  misconceptions: string[],
  studentResponse: string
): string {
  return `${CORE_PRINCIPLES}

COMMON MISCONCEPTIONS FOR THIS QUESTION:
${misconceptions.map((m, i) => `${i + 1}. ${m}`).join('\n')}

STUDENT'S RESPONSE:
${studentResponse}

YOUR TASK:
Check if the student's response shows any of these common misconceptions.

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "has_misconception": <true|false>,
  "misconception_detected": "<which misconception, or null>",
  "gentle_correction": "<age-appropriate guidance to redirect thinking, or null>"
}

If no misconception is detected, return has_misconception: false and nulls for other fields.
If a misconception IS detected, provide warm, constructive guidance to help them reconsider.`;
}

// ============================================================================
// Confidence Calibration
// ============================================================================

export function getConfidenceCalibrationPrompt(
  studentResponse: string,
  actualScore: number
): string {
  return `${CORE_PRINCIPLES}

STUDENT'S RESPONSE:
${studentResponse}

ACTUAL EVALUATION SCORE: ${actualScore}/100

YOUR TASK:
Estimate how confident this student likely FELT when writing this response.
This helps us understand if they're over-confident or under-confident.

Consider:
- Response length (longer = usually more confident)
- Use of definitive language ("I know", "definitely") vs. hedging ("maybe", "I think")
- Completeness of explanation
- Tone and assertiveness

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "estimated_confidence": <1-10>,
  "calibration_assessment": "<well_calibrated|over_confident|under_confident>",
  "coaching_note": "<brief note on developing better self-assessment>"
}`;
}

// ============================================================================
// Personalized Feedback Templates
// ============================================================================

export const FEEDBACK_TEMPLATES = {
  exceptional: [
    "Wow! You really thought deeply about this. {strength}",
    "Excellent work! I love how you {strength}",
    "This is outstanding thinking! {strength}",
  ],
  strong: [
    "Great job! You showed good understanding by {strength}",
    "Nice work! {strength} really strengthened your response",
    "You're on a strong path! {strength}",
  ],
  moderate: [
    "Good start! {strength} To take it further, try {growth}",
    "You're thinking well! {strength} Next time, {growth}",
    "I can see you're working hard on this! {strength}",
  ],
  developing: [
    "You're on the right track! Let's build on this: {growth}",
    "Good effort! Here's something to focus on: {growth}",
    "You've got the foundation! Next step: {growth}",
  ],
};

// ============================================================================
// Age-Appropriate Vocabulary
// ============================================================================

export const AGE_APPROPRIATE_TERMS: Record<string, string> = {
  // Academic terms -> Kid-friendly terms
  'analysis': 'thinking carefully about',
  'synthesis': 'putting ideas together',
  'inference': 'figuring out',
  'evidence': 'examples from the book',
  'perspective': 'point of view',
  'theme': 'big idea',
  'characterization': 'what the character is like',
  'motivation': 'why they did it',
  'conflict': 'problem',
  'resolution': 'how it got solved',
  'metaphor': 'comparison',
  'symbolism': 'stands for something else',
  'protagonist': 'main character',
  'antagonist': 'character causing problems',
};

// ============================================================================
// Export main evaluation function signature
// ============================================================================

export interface EducationalEvaluationRequest {
  prompt: string;
  promptType: PromptType;
  studentResponse: string;
  rubric?: Record<string, string>;
  bookContext?: string;
  childName?: string;
  currentStats?: Record<string, number>;
  recentPatterns?: string[];
}
