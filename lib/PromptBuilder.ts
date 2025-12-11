/**
 * Wrath Shield v3 - Coaching Prompt Construction
 *
 * Builds LLM prompts from assembled coaching context with:
 * - System prompt defining coach persona and boundaries
 * - Context gating (what to include based on data availability)
 * - Style rules (tone, format, coaching approach)
 * - Message array formatted for OpenRouter API
 *
 * NOW INTEGRATED WITH LIFE OS CONFIG:
 * - Loads coaching system prompt from agent.coaching config
 * - Falls back to hardcoded prompt if config unavailable
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';
import type { CoachingContext } from './CoachingEngine';
import { getAgent, getLifeCharter } from './life-os-config';

// Prevent client-side imports
ensureServerOnly('lib/PromptBuilder');

/**
 * Cache control for Anthropic prompt caching (via OpenRouter)
 * Limit of 4 breakpoints per request
 */
export interface CacheControl {
  type: 'ephemeral';
}

/**
 * Multipart content block for prompt caching
 */
export interface ContentBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}

/**
 * OpenRouter-compatible message format with prompt caching support
 *
 * For Claude models via OpenRouter, use multipart content with cache_control
 * breakpoints on large, stable content (system prompts, Life Charter context).
 *
 * @see https://openrouter.ai/docs/guides/best-practices/prompt-caching
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  /** Simple string content or multipart content blocks with cache control */
  content: string | ContentBlock[];
}

/**
 * Helper to create a cacheable message content block
 */
export function createCacheableContent(text: string, shouldCache: boolean = true): ContentBlock[] {
  return [{
    type: 'text',
    text,
    ...(shouldCache && { cache_control: { type: 'ephemeral' } }),
  }];
}

/**
 * Helper to merge multiple content blocks, optionally adding cache control to the last one
 */
export function mergeContentBlocks(blocks: Array<{ text: string; cache?: boolean }>): ContentBlock[] {
  return blocks.map((block, index) => ({
    type: 'text' as const,
    text: block.text,
    ...(block.cache && { cache_control: { type: 'ephemeral' as const } }),
  }));
}

/**
 * Complete prompt ready for OpenRouter API
 */
export interface ConstructedPrompt {
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  /**
   * Enable Anthropic prompt caching for Claude models via OpenRouter.
   * When enabled, system prompts with cache_control breakpoints will be cached
   * for up to 5 minutes, reducing latency by up to 85% and costs for repeated calls.
   *
   * @default false - Must be explicitly enabled
   * @see https://openrouter.ai/docs/guides/best-practices/prompt-caching
   */
  enablePromptCaching?: boolean;
  metadata: {
    date: string;
    has_whoop_data: boolean;
    has_manipulations: boolean;
    wrath_deployed: boolean;
    memory_count: number;
    anchor_count: number;
  };
}

/**
 * Fallback system prompt if Life OS config is unavailable
 */
const FALLBACK_COACHING_PROMPT = `You are a relentless confidence coach focused on building unbending resolve and assertive boundaries.

Your role:
- Analyze daily metrics (WHOOP recovery, strain, sleep) to assess readiness
- Celebrate deployment of "wrath" (assertive boundary responses to manipulation)
- Identify patterns of manipulation and track boundary enforcement
- Provide direct, actionable coaching without sugarcoating
- Emphasize the connection between physiological recovery and mental resilience

Core principles:
1. Recovery is non-negotiable - low recovery demands rest and boundary protection
2. Manipulation must be met with assertive boundaries ("wrath")
3. High recovery + high strain = capacity for growth
4. Silence or compliance in face of manipulation is a red flag
5. Track patterns over time - consistency matters more than perfection

Communication style:
- Direct and concise (2-3 sentences per point)
- Celebrate wins (wrath deployment, high recovery)
- Call out concerning patterns (manipulation without boundaries, low recovery with high strain)
- Use concrete data from metrics and memory
- No platitudes or empty encouragement - only data-driven insights`;

/**
 * Get the coaching system prompt from Life OS config
 * Falls back to hardcoded prompt if config is unavailable
 *
 * @param agentId - Optional agent ID (defaults to 'agent.coaching')
 * @returns System prompt string
 */
function getCoachingSystemPrompt(agentId: string = 'agent.coaching'): string {
  try {
    const agent = getAgent(agentId);
    const charter = getLifeCharter();

    if (agent) {
      let prompt = agent.system_prompt;

      // Add global principles from Life Charter if available
      if (charter && prompt.includes('{{PRINCIPLES}}')) {
        const principles = charter.global_principles.join('\n- ');
        prompt = prompt.replace('{{PRINCIPLES}}', `- ${principles}`);
      }

      // Add priority stack if referenced
      if (charter && prompt.includes('{{PRIORITIES}}')) {
        const priorities = charter.priority_stack
          .sort((a, b) => b.weight - a.weight)
          .map((p, i) => `${i + 1}. ${p.name}: ${p.description}`)
          .join('\n');
        prompt = prompt.replace('{{PRIORITIES}}', priorities);
      }

      console.log(`[PromptBuilder] Using Life OS config system prompt for ${agentId}`);
      return prompt;
    }
  } catch (e) {
    console.warn('[PromptBuilder] Failed to load Life OS config, using fallback:', e);
  }

  return FALLBACK_COACHING_PROMPT;
}

// Cache the system prompt (reloads on server restart)
let _cachedCoachingPrompt: string | null = null;
function getSystemPrompt(): string {
  if (!_cachedCoachingPrompt) {
    _cachedCoachingPrompt = getCoachingSystemPrompt();
  }
  return _cachedCoachingPrompt;
}

/**
 * Format WHOOP metrics section with gating
 *
 * @param context - Assembled coaching context
 * @returns Formatted WHOOP section or empty string if no data
 */
function formatWhoopSection(context: CoachingContext): string {
  const { dailyContext } = context;
  const { recovery, cycle, sleep } = dailyContext;

  // Gate: Only include if at least one WHOOP metric exists
  const hasWhoopData =
    (recovery && recovery.score !== null) ||
    (cycle && cycle.strain !== null) ||
    (sleep && sleep.performance !== null);

  if (!hasWhoopData) {
    return '';
  }

  const parts: string[] = ['**WHOOP Metrics (Today):**'];

  if (recovery && recovery.score !== null) {
    const level =
      recovery.score >= 70 ? 'HIGH' : recovery.score >= 40 ? 'MEDIUM' : 'LOW';
    parts.push(`- Recovery: ${Math.round(recovery.score)}% [${level}]`);
  }

  if (cycle && cycle.strain !== null) {
    const level = cycle.strain > 14 ? 'OVERDRIVE' : cycle.strain >= 10 ? 'MODERATE' : 'LIGHT';
    parts.push(`- Strain: ${cycle.strain.toFixed(1)} [${level}]`);
  }

  if (sleep && sleep.performance !== null) {
    parts.push(`- Sleep: ${Math.round(sleep.performance)}%`);
  }

  return parts.join('\n');
}

/**
 * Format manipulation detection section with gating
 *
 * @param context - Assembled coaching context
 * @returns Formatted manipulation section or empty string if no lifelogs
 */
function formatManipulationSection(context: CoachingContext): string {
  const { dailyContext } = context;
  const { totalManipulations, wrathDeployed, lifelogs } = dailyContext;

  // Gate: Only include if lifelogs exist for today
  if (lifelogs.length === 0) {
    return '';
  }

  const parts: string[] = ['**Manipulation Detection (Today):**'];
  parts.push(`- Total Interactions: ${lifelogs.length}`);
  parts.push(`- Manipulative Attempts: ${totalManipulations}`);

  if (totalManipulations > 0) {
    const response = wrathDeployed
      ? '✓ Assertive boundaries deployed'
      : '⚠ No wrath deployed - compliance or silence';
    parts.push(`- Response: ${response}`);
  } else {
    parts.push('- Response: Clean interactions');
  }

  return parts.join('\n');
}

/**
 * Format relevant memories section with gating
 *
 * @param context - Assembled coaching context
 * @returns Formatted memories section or empty string if no memories
 */
function formatMemoriesSection(context: CoachingContext): string {
  const { relevantMemories } = context;

  // Gate: Only include if memories exist and are relevant
  if (relevantMemories.length === 0) {
    return '';
  }

  const parts: string[] = ['**Relevant Context:**'];
  relevantMemories.forEach((memory, index) => {
    parts.push(`${index + 1}. ${memory.text}`);
  });

  return parts.join('\n');
}

/**
 * Format anchor memories section with gating
 *
 * @param context - Assembled coaching context
 * @returns Formatted anchors section or empty string if no anchors
 */
function formatAnchorsSection(context: CoachingContext): string {
  const { anchors } = context;

  // Gate: Only include if anchors exist
  if (anchors.length === 0) {
    return '';
  }

  const parts: string[] = ['**Core Principles (Your Anchors):**'];
  anchors.forEach((anchor) => {
    parts.push(`- ${anchor.text}`);
  });

  return parts.join('\n');
}

/**
 * Build user message from coaching context
 *
 * Assembles context sections with proper gating and formatting.
 * Each section is conditionally included based on data availability.
 *
 * @param context - Assembled coaching context
 * @returns Formatted user message
 */
export function buildUserMessage(context: CoachingContext): string {
  const sections: string[] = [];

  // Add date header
  sections.push(`# Daily Coaching Brief - ${context.dailyContext.date}\n`);

  // Add sections with gating (empty sections are filtered out)
  const whoopSection = formatWhoopSection(context);
  if (whoopSection) sections.push(whoopSection);

  const manipulationSection = formatManipulationSection(context);
  if (manipulationSection) sections.push(manipulationSection);

  const memoriesSection = formatMemoriesSection(context);
  if (memoriesSection) sections.push(memoriesSection);

  const anchorsSection = formatAnchorsSection(context);
  if (anchorsSection) sections.push(anchorsSection);

  // Add coaching request
  sections.push(
    '\n**Coaching Request:**',
    'Provide a brief coaching summary (3-5 key points) based on the data above. Focus on:',
    '1. What the metrics reveal about readiness and resilience',
    '2. Patterns of manipulation and boundary enforcement',
    '3. Specific actions to maintain or improve unbending resolve'
  );

  return sections.join('\n\n');
}

/**
 * Construct complete prompt for OpenRouter API
 *
 * Main orchestrator that:
 * 1. Creates system message with coach persona
 * 2. Builds user message from context with gating
 * 3. Configures temperature and token limits
 * 4. Includes metadata for observability
 *
 * @param context - Assembled coaching context from CoachingEngine
 * @returns Complete prompt ready for OpenRouter API call
 */
export function constructCoachingPrompt(context: CoachingContext): ConstructedPrompt {
  // Build messages array - now using Life OS config
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: getSystemPrompt(),
    },
    {
      role: 'user',
      content: buildUserMessage(context),
    },
  ];

  // Check if WHOOP data exists
  const hasWhoopData = !!(
    (context.dailyContext.recovery && context.dailyContext.recovery.score !== null) ||
    (context.dailyContext.cycle && context.dailyContext.cycle.strain !== null) ||
    (context.dailyContext.sleep && context.dailyContext.sleep.performance !== null)
  );

  return {
    messages,
    temperature: 0.7, // Balanced creativity for coaching while maintaining coherence
    max_tokens: 500, // Brief coaching summary (3-5 key points)
    metadata: {
      date: context.dailyContext.date,
      has_whoop_data: hasWhoopData,
      has_manipulations: context.dailyContext.totalManipulations > 0,
      wrath_deployed: context.dailyContext.wrathDeployed,
      memory_count: context.relevantMemories.length,
      anchor_count: context.anchors.length,
    },
  };
}
