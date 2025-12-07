/**
 * HYRO FORGE: AI-Powered Tutor System
 *
 * Intelligent tutoring system that:
 * - Interfaces with all Hyro systems (diagnostics, sessions, ZPD, proficiency, quests)
 * - Generates personalized content based on proficiency levels
 * - Dynamically adjusts difficulty in real-time
 * - Provides Socratic-style guidance (asks questions, doesn't give answers)
 * - Remembers learning patterns via Zep memory
 *
 * Uses 2025 best practices:
 * - Structured output prompts for reliable AI responses
 * - Cascading context injection (recent → historical → general)
 * - Real-time proficiency-based content routing
 */

import { ensureServerOnly } from '../server-only-guard';
import { getOpenRouterClient, CoachingResponse } from '../OpenRouterClient';
import { getDatabase } from '../db/Database';
import { randomUUID } from 'crypto';
import { StatName, STAT_NAMES, Quest } from './forge-types';
import { getProficiencyProfile, getSkillProficiency, SkillProficiency } from './forge-proficiency';
import { getZPDState, getLearningVelocity, detectFlowState, ZPDState } from './forge-zpd-engine';
import { getSessionContext, getTodaySession, SessionContext } from './forge-session-orchestrator';
import { getActiveSkillGaps, SkillGap, getDiagnosticOverview } from './forge-diagnostics';
import { searchEducationMemory, addEducationMemory } from './education-memory';

// Server-side only
ensureServerOnly('lib/hyro/forge-ai-tutor');

// ============================================================================
// Types
// ============================================================================

export type TutorIntentType =
  | 'explain'           // Explain a concept
  | 'practice'          // Generate practice problems
  | 'review'            // Review recent learning
  | 'encourage'         // Motivational support
  | 'diagnose'          // Identify knowledge gaps
  | 'quest'             // Generate a quest/assignment
  | 'study_plan'        // Create a study plan
  | 'check_in'          // Daily check-in
  | 'chat'              // General conversation
  | 'answer_question';  // Answer a specific question

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    intent?: TutorIntentType;
    stat_focus?: StatName[];
    difficulty_level?: number;
    xp_awarded?: number;
    quest_generated?: Quest;
  };
}

export interface TutorConversation {
  id: string;
  messages: TutorMessage[];
  created_at: number;
  last_message_at: number;
  total_xp_earned: number;
  stat_focus: StatName[];
}

export interface TutorContext {
  child_name: string;
  proficiency: SkillProficiency[];
  zpd_states: ZPDState[];
  session_context: SessionContext;
  active_skill_gaps: SkillGap[];
  current_session: ReturnType<typeof getTodaySession>;
  learning_velocities: Array<{ stat_name: StatName; weekly_growth: number }>;
  flow_states: Array<{ stat_name: StatName; in_flow: boolean; flow_score: number }>;
  recent_memories: string[];
}

export interface TutorResponse {
  message: string;
  intent_detected: TutorIntentType;
  suggested_actions?: Array<{
    type: 'start_session' | 'take_diagnostic' | 'do_quest' | 'review_cards' | 'read';
    label: string;
    href?: string;
    reference_id?: string;
  }>;
  quest_generated?: Quest;
  xp_awarded?: number;
  difficulty_adjustment?: {
    stat: StatName;
    new_target: number;
    reason: string;
  };
}

// ============================================================================
// Tutor System Prompts
// ============================================================================

const TUTOR_SYSTEM_PROMPT = `You are Hyro's AI learning companion - an encouraging, patient, and intelligent tutor.
Your name is "Sage" and you speak to a 6th grade student named Hyro.

CORE PRINCIPLES:
1. SOCRATIC METHOD: Guide Hyro to discover answers through questions, not direct answers
2. ZONE OF PROXIMAL DEVELOPMENT: Challenge slightly above current ability
3. GROWTH MINDSET: Emphasize effort and progress over innate ability
4. ENCOURAGEMENT: Be warm, supportive, and celebrate small wins

COMMUNICATION STYLE:
- Use clear, age-appropriate language (6th grade level)
- Be concise but thorough
- Use analogies and real-world examples
- Ask follow-up questions to check understanding
- Never be condescending or overly formal

RESPONSE GUIDELINES:
When explaining concepts:
- Break down complex ideas into smaller parts
- Use "think of it like..." analogies
- Ask "What do you think would happen if...?"

When Hyro struggles:
- Say "Let's think about this together..."
- Provide scaffolding hints, not answers
- Acknowledge the difficulty: "This is tricky! Here's a way to approach it..."

When Hyro succeeds:
- Be specific with praise: "Great job connecting [X] to [Y]!"
- Point out what they did well
- Suggest the next challenge

ALWAYS respond in valid JSON format:
{
  "message": "Your response to Hyro",
  "intent_detected": "one of: explain|practice|review|encourage|diagnose|quest|study_plan|check_in|chat|answer_question",
  "suggested_actions": [
    {
      "type": "start_session|take_diagnostic|do_quest|review_cards|read",
      "label": "Button label for action"
    }
  ],
  "xp_awarded": 0-20 for engagement (0 if just chatting),
  "difficulty_adjustment": null or { "stat": "stat_name", "new_target": 0-100, "reason": "why" }
}`;

const QUEST_GENERATION_PROMPT = `You are generating a personalized learning quest for Hyro.

Based on their proficiency data, create an engaging quest that:
1. Targets a skill gap or weak area
2. Is at the appropriate difficulty (within ZPD)
3. Feels like an adventure, not homework
4. Has clear success criteria
5. Awards appropriate XP (25-100 based on difficulty)

Quest format:
{
  "title": "Quest title (exciting, adventure-themed)",
  "description": "What Hyro needs to do",
  "quest_type": "daily|weekly|epic",
  "difficulty": "easy|normal|hard|boss",
  "xp_reward": 25-100,
  "required_stat": "stat_name",
  "target_difficulty": 0-100,
  "success_criteria": ["Clear criterion 1", "Clear criterion 2"],
  "hints": ["Optional hint 1", "Optional hint 2"]
}`;

// ============================================================================
// Context Building
// ============================================================================

/**
 * Build complete tutor context from all Hyro systems
 */
export function buildTutorContext(): TutorContext {
  // Get proficiency for all stats as an array
  const proficiencyProfile = getProficiencyProfile();
  const proficiency = Object.values(proficiencyProfile.stats);
  const sessionContext = getSessionContext();
  const currentSession = getTodaySession();
  const skillGaps = getActiveSkillGaps();

  // Get ZPD states for all stats
  const zpdStates = STAT_NAMES.map(getZPDState);

  // Get learning velocities
  const velocities = STAT_NAMES.map((stat) => {
    const v = getLearningVelocity(stat);
    return { stat_name: stat, weekly_growth: v.weekly_growth };
  });

  // Get flow states
  const flowStates = STAT_NAMES.map((stat) => {
    const f = detectFlowState(stat);
    return { stat_name: stat, in_flow: f.in_flow, flow_score: f.flow_score };
  });

  // Get recent memories
  let recentMemories: string[] = [];
  try {
    // This is async but we'll handle it in the chat function
    // For now, return empty array
  } catch (e) {
    console.log('[AI Tutor] Could not fetch memories');
  }

  return {
    child_name: 'Hyro',
    proficiency,
    zpd_states: zpdStates,
    session_context: sessionContext,
    active_skill_gaps: skillGaps,
    current_session: currentSession,
    learning_velocities: velocities,
    flow_states: flowStates,
    recent_memories: recentMemories,
  };
}

/**
 * Format context for LLM consumption
 */
function formatContextForLLM(context: TutorContext): string {
  const weakestStats = [...context.proficiency]
    .sort((a, b) => a.level - b.level)
    .slice(0, 3);

  const strongestStats = [...context.proficiency]
    .sort((a, b) => b.level - a.level)
    .slice(0, 2);

  const flowStatsInFlow = context.flow_states.filter((f) => f.in_flow);

  const parts = [
    `LEARNER PROFILE: ${context.child_name}`,
    '',
    `CURRENT PROFICIENCY LEVELS:`,
    ...context.proficiency.map(
      (p) => `  ${p.stat_name}: ${p.level}/100 (uncertainty: ${p.uncertainty})`
    ),
    '',
    `WEAKEST AREAS (focus here):`,
    ...weakestStats.map((s) => `  - ${s.stat_name}: ${s.level}/100`),
    '',
    `STRONGEST AREAS:`,
    ...strongestStats.map((s) => `  - ${s.stat_name}: ${s.level}/100`),
    '',
    `ZONE OF PROXIMAL DEVELOPMENT:`,
    ...context.zpd_states.map(
      (z) =>
        `  ${z.stat_name}: optimal difficulty ${Math.round(z.optimal_difficulty)}, ` +
        `trend: ${z.trend}, adjustment: ${z.adjustment_needed}`
    ),
  ];

  if (context.active_skill_gaps.length > 0) {
    parts.push('', `IDENTIFIED SKILL GAPS:`);
    for (const gap of context.active_skill_gaps.slice(0, 5)) {
      parts.push(`  - ${gap.stat_name}/${gap.topic}: ${gap.gap_severity} gap (level ${gap.current_level})`);
    }
  }

  if (flowStatsInFlow.length > 0) {
    parts.push('', `IN FLOW STATE FOR:`);
    for (const f of flowStatsInFlow) {
      parts.push(`  - ${f.stat_name} (flow score: ${f.flow_score})`);
    }
  }

  if (context.session_context.due_cards_count > 0) {
    parts.push('', `PENDING ITEMS:`);
    parts.push(`  - ${context.session_context.due_cards_count} SRS cards due`);
    if (context.session_context.overdue_quests.length > 0) {
      parts.push(`  - ${context.session_context.overdue_quests.length} overdue quests`);
    }
  }

  if (context.recent_memories.length > 0) {
    parts.push('', `RECENT LEARNING PATTERNS:`, ...context.recent_memories.map((m) => `  - ${m}`));
  }

  return parts.join('\n');
}

// ============================================================================
// Intent Detection
// ============================================================================

/**
 * Detect user intent from message
 */
function detectIntent(message: string): TutorIntentType {
  const lower = message.toLowerCase();

  // Quest/assignment keywords
  if (
    lower.includes('quest') ||
    lower.includes('assignment') ||
    lower.includes('challenge') ||
    lower.includes('give me something to do')
  ) {
    return 'quest';
  }

  // Practice keywords
  if (
    lower.includes('practice') ||
    lower.includes('problem') ||
    lower.includes('exercise') ||
    lower.includes('drill')
  ) {
    return 'practice';
  }

  // Explain keywords
  if (
    lower.includes('explain') ||
    lower.includes('what is') ||
    lower.includes('how does') ||
    lower.includes('why') ||
    lower.includes('teach me') ||
    lower.includes("don't understand")
  ) {
    return 'explain';
  }

  // Review keywords
  if (
    lower.includes('review') ||
    lower.includes('went over') ||
    lower.includes('learned') ||
    lower.includes('progress')
  ) {
    return 'review';
  }

  // Diagnose keywords
  if (
    lower.includes('struggling') ||
    lower.includes("don't know") ||
    lower.includes('weak') ||
    lower.includes("what should i work on")
  ) {
    return 'diagnose';
  }

  // Study plan keywords
  if (lower.includes('plan') || lower.includes('schedule') || lower.includes('what should i do today')) {
    return 'study_plan';
  }

  // Check-in keywords
  if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey') || lower.includes("how's it going")) {
    return 'check_in';
  }

  // Encouragement keywords
  if (lower.includes('stuck') || lower.includes('hard') || lower.includes("can't") || lower.includes('frustrated')) {
    return 'encourage';
  }

  // Question indicators
  if (lower.includes('?') || lower.startsWith('is ') || lower.startsWith('can ') || lower.startsWith('do ')) {
    return 'answer_question';
  }

  return 'chat';
}

// ============================================================================
// Main Chat Function
// ============================================================================

/**
 * Process a chat message and generate tutor response
 */
export async function chat(
  userMessage: string,
  conversationHistory: TutorMessage[] = []
): Promise<TutorResponse> {
  const context = buildTutorContext();
  const intent = detectIntent(userMessage);

  // Get recent memories from Zep
  try {
    const memoryResults = await searchEducationMemory('recent learning', 5);
    context.recent_memories = memoryResults.map((r) => r.memory.text.substring(0, 100));
  } catch (e) {
    console.log('[AI Tutor] Could not fetch memories');
  }

  // Build conversation for LLM
  const formattedContext = formatContextForLLM(context);

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: TUTOR_SYSTEM_PROMPT },
    {
      role: 'system',
      content: `CURRENT LEARNER CONTEXT:\n${formattedContext}\n\nDETECTED INTENT: ${intent}`,
    },
  ];

  // Add conversation history (last 10 messages)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }

  // Add current message
  messages.push({ role: 'user', content: userMessage });

  // Call LLM
  const client = getOpenRouterClient();

  try {
    const response = await client.getCoachingResponse({
      messages,
      temperature: 0.7,
      max_tokens: 1500,
      metadata: {
        date: new Date().toISOString(),
        has_whoop_data: false,
        has_manipulations: false,
        wrath_deployed: false,
        memory_count: context.recent_memories.length,
        anchor_count: 0,
      },
    });

    // Parse JSON response
    let parsedResponse: TutorResponse;
    try {
      // Try to extract JSON from response (handle markdown code blocks)
      let jsonContent = response.content;
      const jsonMatch = jsonContent.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      // Also try without markdown
      const plainJsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (plainJsonMatch) {
        jsonContent = plainJsonMatch[0];
      }

      parsedResponse = JSON.parse(jsonContent);
    } catch (e) {
      // If JSON parsing fails, create structured response from text
      parsedResponse = {
        message: response.content,
        intent_detected: intent,
      };
    }

    // Store interaction in memory
    await addEducationMemory(
      `Tutor conversation - User asked about: "${userMessage.substring(0, 50)}..." Intent: ${intent}`,
      'pattern',
      { intent, timestamp: Date.now() }
    );

    // Award XP if specified (TODO: add studentId to tutor functions for full multi-tenant)
    if (parsedResponse.xp_awarded && parsedResponse.xp_awarded > 0) {
      try {
        const { awardXP } = await import('./forge-xp');
        awardXP('hyro', parsedResponse.xp_awarded, 'engagement', randomUUID());
      } catch (e) {
        console.log('[AI Tutor] Could not award XP');
      }
    }

    return parsedResponse;
  } catch (e) {
    console.error('[AI Tutor] Chat error:', e);
    throw new Error(`Tutor chat failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Quest Generation
// ============================================================================

/**
 * Generate a personalized quest based on proficiency
 */
export async function generateQuest(
  statFocus?: StatName,
  difficultyOverride?: number,
  standardId?: string
): Promise<Quest> {
  const context = buildTutorContext();
  const { getStandard } = await import('./education-store'); // Dynamic import to avoid cycles if any

  // Determine which stat to focus on
  let targetStat: StatName = 'math'; // Default
  let standardDescription = '';
  let specificStandard = null;
  let esotericContext = '';

  if (standardId) {
    const std = getStandard(standardId);
    if (std) {
      specificStandard = std;
      standardDescription = `SPECIFIC STANDARD TO MASTER: ${std.id} - ${std.description}`;
      // Map domain to stat (simple heuristic for now)
      if (['RP', 'NS', 'EE', 'G', 'SP'].some(d => std.id.includes(d))) {
        targetStat = 'math';
      } else {
        targetStat = 'reading';
      }

      // FETCH CONCEPTS FOR ESOTERIC CONTEXT
      try {
        const { getConceptsForStandard } = await import('./education-store');
        const concepts = getConceptsForStandard(standardId);
        if (concepts.length > 0) {
          esotericContext = `
    CRITICAL PEDAGOGICAL INSTRUCTION: "THE ESOTERIC VIEW"
    The user demands a "Superior Education" that reveals hidden layers.
    You must frame the Quest not just as "learning the standard", but as "Testing the Limit of the Standard".
    The Standard is a LIMITED MODEL. The Concept is the TRUTH.

    1. START with the Fundamental Concept(s): ${concepts.map(c => `"${c.concept?.name}"`).join(', ')}.
    2. REVEAL THE HIDDEN: Explicitly point out what the Standard *hides* or *ignores* in the quest description.
       - Example: "Mission: The 'Gravity' Equation they teach you is a LOCAL simplification. Test it, but know it fails at scale."
    3. Frame the Standard (${standardId}) as a 'Simulation' or 'Game Rule' we must master to break.
    
    Concept Details:
    ${concepts.map(c => `- ${c.concept?.name}: ${c.notes} (Layer: ${c.authenticity_layer})`).join('\n')}
    
    Your Tone:
    - Conspiratorial, Elite, "Inside Knowledge".
    - "Here is the mission to verify their simplified model."
    `;
        }
      } catch (err) {
        console.warn('Failed to load concepts for quest generation', err);
      }
    }
  } else if (statFocus) {
    targetStat = statFocus;
  } else {
    // Pick weakest stat that has a skill gap, or just weakest stat
    const weakestWithGap = context.active_skill_gaps[0];
    if (weakestWithGap) {
      targetStat = weakestWithGap.stat_name;
    } else {
      targetStat = [...context.proficiency].sort((a, b) => a.level - b.level)[0]?.stat_name || 'reading';
    }
  }

  // Get ZPD for this stat
  const zpd = getZPDState(targetStat);
  const targetDifficulty = difficultyOverride ?? zpd.optimal_difficulty;

  // Build prompt
  const questPrompt = `${QUEST_GENERATION_PROMPT}

TARGET STAT: ${targetStat}
CURRENT LEVEL: ${zpd.current_level}
TARGET DIFFICULTY: ${targetDifficulty}
PERFORMANCE TREND: ${zpd.trend}
SCAFFOLDING NEEDED: ${zpd.scaffolding_recommended}
${standardDescription}
${esotericContext.substring(0, 300)}

${context.active_skill_gaps.some((g) => g.stat_name === targetStat) ? `SKILL GAP: ${context.active_skill_gaps.find((g) => g.stat_name === targetStat)?.topic}` : ''}

Generate a quest that fits this profile. Return ONLY valid JSON.`;

  const client = getOpenRouterClient();

  // UPGRADE: Use the Esoteric Mentor Agent (GPT-5.1)
  client.setAgentId('agent.coaching');

  try {
    const response = await client.getCoachingResponse({
      messages: [
        { role: 'system', content: 'You are an expert Mentor and Quest Designer. You design rigorous, esoteric challenges that reveal the hidden truths behind school standards. Return only valid JSON.' },
        { role: 'user', content: questPrompt },
      ],
      temperature: 0.8,
      max_tokens: 800,
      metadata: {
        date: new Date().toISOString(),
        has_whoop_data: false,
        has_manipulations: false,
        wrath_deployed: false,
        memory_count: 0,
        anchor_count: 0,
      },
    });

    // Parse quest JSON
    let questData;
    try {
      let jsonContent = response.content;
      const jsonMatch = jsonContent.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      const plainJsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (plainJsonMatch) {
        jsonContent = plainJsonMatch[0];
      }
      questData = JSON.parse(jsonContent);
    } catch (e) {
      throw new Error('Failed to parse quest JSON from LLM');
    }

    // Create quest in database
    const db = getDatabase();
    const questId = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO hyro_quests (
        id, title, description, quest_type, status,
        xp_reward, difficulty, required_stat, created_at, standard_id
      ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
    `).run(
      questId,
      questData.title,
      questData.description,
      questData.quest_type || 'daily',
      questData.xp_reward || 50,
      questData.difficulty || 'normal',
      targetStat,
      now,
      standardId || null
    );

    const quest: Quest = {
      id: questId,
      title: questData.title,
      description: questData.description || null,
      quest_type: questData.quest_type || 'daily',
      status: 'active',
      xp_reward: questData.xp_reward || 50,
      difficulty: questData.difficulty || 'medium',
      required_stat: targetStat,
      stat_boost: null,
      achievement_unlock: null,
      started_at: now,
      completed_at: null,
      due_at: null,
      platform: null,
      external_id: null,
      external_url: null,
      is_recurring: false,
      recurrence_pattern: null,
      created_at: now,
      standard_id: standardId || null,
    };

    // Store in memory
    await addEducationMemory(
      `Generated quest: "${quest.title}" targeting ${targetStat} ${standardId ? `(Standard: ${standardId})` : ''} at difficulty ${targetDifficulty}`,
      'progress',
      { quest_id: questId, stat: targetStat, difficulty: targetDifficulty, standard_id: standardId }
    );

    return quest;
  } catch (e) {
    console.error('[AI Tutor] Quest generation error:', e);
    throw new Error(`Quest generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Conversation Management
// ============================================================================

/**
 * Get or create a conversation
 */
export function getConversation(conversationId?: string): TutorConversation {
  const db = getDatabase();

  if (conversationId) {
    const row = db
      .prepare('SELECT * FROM hyro_tutor_conversations WHERE id = ?')
      .get(conversationId) as { id: string; messages: string; created_at: number; last_message_at: number; total_xp_earned: number; stat_focus: string } | undefined;

    if (row) {
      return {
        id: row.id,
        messages: JSON.parse(row.messages),
        created_at: row.created_at,
        last_message_at: row.last_message_at,
        total_xp_earned: row.total_xp_earned,
        stat_focus: JSON.parse(row.stat_focus || '[]'),
      };
    }
  }

  // Create new conversation
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO hyro_tutor_conversations (
      id, messages, created_at, last_message_at, total_xp_earned, stat_focus
    ) VALUES (?, '[]', ?, ?, 0, '[]')
  `).run(id, now, now);

  return {
    id,
    messages: [],
    created_at: now,
    last_message_at: now,
    total_xp_earned: 0,
    stat_focus: [],
  };
}

/**
 * Save conversation to database
 */
export function saveConversation(conversation: TutorConversation): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE hyro_tutor_conversations
    SET messages = ?,
        last_message_at = ?,
        total_xp_earned = ?,
        stat_focus = ?
    WHERE id = ?
  `).run(
    JSON.stringify(conversation.messages),
    conversation.last_message_at,
    conversation.total_xp_earned,
    JSON.stringify(conversation.stat_focus),
    conversation.id
  );
}

/**
 * Add message to conversation
 */
export function addMessage(
  conversation: TutorConversation,
  role: 'user' | 'assistant',
  content: string,
  metadata?: TutorMessage['metadata']
): TutorMessage {
  const message: TutorMessage = {
    id: randomUUID(),
    role,
    content,
    timestamp: Math.floor(Date.now() / 1000),
    metadata,
  };

  conversation.messages.push(message);
  conversation.last_message_at = message.timestamp;

  if (metadata?.xp_awarded) {
    conversation.total_xp_earned += metadata.xp_awarded;
  }

  if (metadata?.stat_focus) {
    for (const stat of metadata.stat_focus) {
      if (!conversation.stat_focus.includes(stat)) {
        conversation.stat_focus.push(stat);
      }
    }
  }

  saveConversation(conversation);
  return message;
}

// ============================================================================
// Assessment & Interview
// ============================================================================

export interface AssessmentResult {
  score: number; // 0-100
  feedback: string;
  is_correct: boolean;
  misconception_detected?: string;
}

/**
 * Generate a targeted interview question for a standard
 */
export async function generateInterviewQuestion(
  standardId: string,
  previousQuestions: string[] = []
): Promise<{ question: string; context: string }> {
  const { getStandard, getConceptsForStandard } = await import('./education-store');
  const standard = getStandard(standardId);
  const concepts = getConceptsForStandard(standardId);

  if (!standard) {
    throw new Error(`Standard not found: ${standardId}`);
  }

  const client = getOpenRouterClient();
  // Upgrade to GPT-5.1 for Superior Esoteric Reasoning
  client.setAgentId('agent.coaching');

  let conceptContext = "";
  if (concepts.length > 0) {
    conceptContext = `
    CRITICAL PEDAGOGICAL INSTRUCTION: "THE ESOTERIC VIEW"
    The user demands a "Superior Education" that reveals hidden layers.
    You must teach the student to see the "Standard" not just as a limited model, but as a SOCIAL CONSTRUCT that hides complexity.

    1. START with the Fundamental Concept(s): ${concepts.map(c => `"${c.concept?.name}"`).join(', ')}.
    2. REVEAL THE HIDDEN: Explicitly point out what the Standard *hides* or *ignores*.
       - Example: "The school standard says PE=mgh. What it HIDES is that gravity varies with distance. Why would they hide that? For simplicity? Control?"
    3. Frame the Standard (${standardId}) as a 'Game' the student must play, but not believe.
    
    Concept Details:
    ${concepts.map(c => `- ${c.concept?.name}: ${c.notes} (Layer: ${c.authenticity_layer})`).join('\n')}
    
    Your Tone:
    - Conspiratorial but rigorous. "Here is the truth they aren't telling you yet..."
    - Demanding. Expect the student to hold two thoughts at once: The Truth and The Test.
    `;
  }

  const systemPrompt = `You are an expert Mentor assessing a student's mastery of Common Core Standard ${standardId}: "${standard.description}".
  
  ${conceptContext}

  Generate a single, conceptual question to check for deep understanding.
  - Do NOT ask a simple multiple choice question.
  - Ask for an explanation, a real-world example, or a short problem solving step.
  - The question should be answerable in 1-2 sentences.
  - Avoid questions that are too complex/long.
  
  PREVIOUS QUESTIONS (Avoid these):
  ${previousQuestions.join('\n')}
  
  Output JSON: { "question": "The question text", "context": "Brief context or scenario if needed" }`;

  const response = await client.getCoachingResponse({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: "Generate the assessment question in JSON format." }
    ],
    temperature: 0.7,
    max_tokens: 300,
    metadata: {
      date: new Date().toISOString(),
      has_whoop_data: false,
      has_manipulations: false,
      wrath_deployed: false,
      memory_count: 0,
      anchor_count: 0
    }
  });

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) { }

  return {
    question: response.content,
    context: ""
  };
}

/**
 * Evaluate a student's response to an assessment question
 */
export async function evaluateResponse(
  standardId: string,
  question: string,
  studentResponse: string
): Promise<AssessmentResult> {
  const { getStandard } = await import('./education-store');
  const std = getStandard(standardId);

  const client = getOpenRouterClient();
  // Upgrade to GPT-5.1 for Nuanced Evaluation
  client.setAgentId('agent.coaching');

  const prompt = `Evaluate this student response against standard ${standardId} ("${std?.description}").
  
  QUESTION: ${question}
  STUDENT ANSWER: "${studentResponse}"
  
  Grade the answer on a scale of 0-100 based on correctness and depth of understanding.
  - 90-100: Mastery (Perfect or near perfect)
  - 70-89: Proficient (Minor errors but gets the concept)
  - 50-69: Emerging (Partial understanding)
  - 0-49: Beginning (Incorrect or irrelevant)
  
  Output JSON:
  {
    "score": number,
    "feedback": "Constructive feedback to the student (2 sentences max)",
    "is_correct": boolean,
    "misconception_detected": "Optional description of specific error"
  }`;

  const response = await client.getCoachingResponse({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3, // Lower temp for grading
    max_tokens: 500,
    metadata: {
      date: new Date().toISOString(),
      has_whoop_data: false,
      has_manipulations: false,
      wrath_deployed: false,
      memory_count: 0,
      anchor_count: 0
    }
  });

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) { }

  return {
    score: 0,
    feedback: "Could not evaluate response. Please try again.",
    is_correct: false
  };
}

// ============================================================================
// Exports
// ============================================================================

export { formatContextForLLM };
