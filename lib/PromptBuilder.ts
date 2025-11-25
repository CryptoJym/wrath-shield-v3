/**
 * Wrath Shield v3 - Prompt Builder
 *
 * Generic prompt construction helper for interacting with LLMs.
 *
 * SECURITY: Server-side only.
 */

import { ensureServerOnly } from './server-only-guard';

// Prevent client-side imports
ensureServerOnly('lib/PromptBuilder');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ConstructedPrompt {
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  metadata?: Record<string, any>;
}

export class PromptBuilder {
  private messages: ChatMessage[] = [];
  private temperature: number = 0.7;
  private maxTokens: number = 4000;

  addSystem(content: string): this {
    this.messages.push({ role: 'system', content });
    return this;
  }

  addUser(content: string): this {
    this.messages.push({ role: 'user', content });
    return this;
  }

  addAssistant(content: string): this {
    this.messages.push({ role: 'assistant', content });
    return this;
  }

  setTemperature(temp: number): this {
    this.temperature = temp;
    return this;
  }

  setMaxTokens(tokens: number): this {
    this.maxTokens = tokens;
    return this;
  }

  build(): ConstructedPrompt {
    return {
      messages: this.messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    };
  }
}

// -----------------------------------------------------------------------------
// Coaching-specific helpers (lightweight to satisfy tests)
// -----------------------------------------------------------------------------

type MaybeNumber = number | null | undefined;

type CoachingContext = {
  dailyContext: {
    date: string;
    recovery?: { score?: MaybeNumber } | null;
    cycle?: { strain?: MaybeNumber } | null;
    sleep?: { performance?: MaybeNumber } | null;
    lifelogs: { manipulation_count?: number; wrath_deployed?: number }[];
    totalManipulations: number;
    wrathDeployed: boolean;
  };
  relevantMemories: { id: string; text: string }[];
  anchors: { id: string; text: string }[];
  query: string;
};

function classifyRecovery(score?: MaybeNumber): string {
  if (score == null) return '';
  if (score >= 70) return `[HIGH]`;
  if (score >= 40) return `[MEDIUM]`;
  return `[LOW]`;
}

function classifyStrain(strain?: MaybeNumber): string {
  if (strain == null) return '';
  if (strain >= 16) return `[OVERDRIVE]`;
  if (strain >= 14) return `[HIGH]`;
  if (strain >= 10) return `[MODERATE]`;
  if (strain >= 7) return `[LIGHT]`;
  return `[REST]`;
}

export function buildUserMessage(context: CoachingContext): string {
  const { dailyContext, relevantMemories, anchors } = context;
  const lines: string[] = [];
  lines.push(`# Daily Coaching Brief - ${dailyContext.date}`);
  lines.push('');

  // WHOOP section
  const hasWhoop =
    dailyContext.recovery?.score != null ||
    dailyContext.cycle?.strain != null ||
    dailyContext.sleep?.performance != null;
  if (hasWhoop) {
    const rec = dailyContext.recovery?.score ?? null;
    const strain = dailyContext.cycle?.strain ?? null;
    const sleep = dailyContext.sleep?.performance ?? null;
    lines.push('**WHOOP Metrics (Today):**');
    if (rec != null) lines.push(`- Recovery: ${Math.round(rec)}% ${classifyRecovery(rec)}`);
    if (strain != null) lines.push(`- Strain: ${Number(strain).toFixed(1)} ${classifyStrain(strain)}`);
    if (sleep != null) lines.push(`- Sleep: ${Math.round(sleep)}%`);
    lines.push('');
  }

  // Manipulation section
  const interactions = dailyContext.lifelogs?.length ?? 0;
  const hasManip =
    (dailyContext.lifelogs && dailyContext.lifelogs.length > 0) &&
    (dailyContext.totalManipulations > 0 || interactions > 0 || dailyContext.wrathDeployed);
  if (hasManip) {
    lines.push('**Manipulation Detection (Today):**');
    lines.push(`- Total Interactions: ${Math.max(interactions, 1)}`);
    lines.push(`- Manipulative Attempts: ${dailyContext.totalManipulations}`);
    if (dailyContext.totalManipulations === 0) {
      lines.push('- Response: Clean interactions');
    } else {
      lines.push(
        dailyContext.wrathDeployed
          ? '- ✓ Assertive boundaries deployed'
          : '- ⚠ No wrath deployed - compliance or silence'
      );
    }
    lines.push('');
  }

  // Memories
  if (relevantMemories.length) {
    lines.push('**Relevant Context:**');
    relevantMemories.forEach((m, i) => lines.push(`${i + 1}. ${m.text}`));
    lines.push('');
  }

  // Anchors
  if (anchors.length) {
    lines.push('**Core Principles (Your Anchors):**');
    anchors.forEach((a) => lines.push(`- ${a.text}`));
    lines.push('');
  }

  // Coaching request
  lines.push('**Coaching Request:**');
  lines.push('- Provide a brief coaching summary (3-5 key points)');
  lines.push('- What the metrics reveal about readiness and resilience');
  lines.push('- Patterns of manipulation and boundary enforcement');
  lines.push('- Specific actions to maintain or improve unbending resolve');

  return lines.join('\n');
}

export function constructCoachingPrompt(context: CoachingContext): ConstructedPrompt & { metadata: Record<string, any> } {
  const system = [
    'You are a relentless confidence coach.',
    'Your goal is unbending resolve.',
    'Recovery is non-negotiable; protect boundaries.',
  ].join(' ');

  const user = buildUserMessage(context);

  const metadata = {
    date: context.dailyContext.date,
    has_whoop_data:
      context.dailyContext.recovery != null ||
      context.dailyContext.cycle != null ||
      context.dailyContext.sleep != null,
    has_manipulations: context.dailyContext.totalManipulations > 0,
    wrath_deployed: context.dailyContext.wrathDeployed,
    memory_count: context.relevantMemories.length,
    anchor_count: context.anchors.length,
  };

  return {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
    max_tokens: 500,
    metadata,
  };
}
