/**
 * Personalization Detection and Neutral Stance Coach
 * SECURITY: Server-only for LLM calls. Detection can be used anywhere.
 */
import { ensureServerOnly } from './server-only-guard';
import { analyzeText, AnalysisResult } from './speechMiner';
import { getOpenRouterClient } from './OpenRouterClient';
import type { ConstructedPrompt, ChatMessage } from './PromptBuilder';

export interface PersonalizationCue {
  phrase: string;
  snippet: string;
  severity: 1 | 2 | 3 | 4 | 5;
  position: number;
}

export interface PersonalizationDetection {
  hasPersonalization: boolean;
  cues: PersonalizationCue[];
  density: number;
  averageSeverity: number;
  analysis: Pick<AnalysisResult, 'flagCount' | 'averageSeverity' | 'processingTime'>;
}

export function detectPersonalization(text: string): PersonalizationDetection {
  const result = analyzeText(text);
  const cues = result.flags
    .filter((f) => f.category === 'personalization')
    .map<PersonalizationCue>((f) => ({
      phrase: f.phrase,
      snippet: f.snippet,
      severity: f.severity,
      position: f.position,
    }));
  const wordCount = Math.max(1, text.split(/\s+/).filter(Boolean).length);
  const density = (cues.length / wordCount) * 100;
  const avg = cues.length ? cues.reduce((s, c) => s + c.severity, 0) / cues.length : 0;
  return {
    hasPersonalization: cues.length > 0,
    cues,
    density,
    averageSeverity: avg,
    analysis: {
      flagCount: result.flagCount,
      averageSeverity: result.averageSeverity,
      processingTime: result.processingTime,
    },
  };
}

export function buildSecondAgreementPrompt(userText: string, cues: PersonalizationCue[]): ConstructedPrompt {
  ensureServerOnly('lib/personalization SECOND_AGREEMENT_CHECK');
  const system: ChatMessage = {
    role: 'system',
    content:
      'You are a neutral-stance coach running a SECOND_AGREEMENT_CHECK. '
      + 'Transform personalized phrasing into neutral, objective lines that maintain assertive boundaries. '
      + 'Rules: (1) Avoid I/me/my. (2) Remove emotional framing. (3) Return 3-5 short bullet lines (<20 words). '
      + '(4) No platitudes; be specific. (5) Tone steady, direct, non-apologetic.',
  };
  const cuesSection = cues.length
    ? cues.map((c, i) => `- ${i + 1}. "${c.phrase}" (sev ${c.severity}) → ${c.snippet}`).join('\n')
    : '- None detected';
  const user: ChatMessage = {
    role: 'user',
    content:
      '# SECOND_AGREEMENT_CHECK\n\n'
      + '**Original Text:**\n'
      + userText.trim()
      + '\n\n**Detected Personalization Cues:**\n'
      + cuesSection
      + '\n\n**Task:**\nGenerate neutral stance lines (3-5 bullets). Focus on action and boundaries. '
      + 'Return only the bullet lines.',
  };
  return {
    messages: [system, user],
    temperature: 0.2,
    max_tokens: 240,
    metadata: {
      date: new Date().toISOString().slice(0, 10),
      has_whoop_data: false,
      has_manipulations: false,
      wrath_deployed: false,
      memory_count: 0,
      anchor_count: 0,
    },
  };
}

export async function generateNeutralStanceLines(
  userText: string
): Promise<{ lines: string[]; cues: PersonalizationCue[] }> {
  ensureServerOnly('lib/personalization generateNeutralStanceLines');
  const detection = detectPersonalization(userText);
  const prompt = buildSecondAgreementPrompt(userText, detection.cues);
  const client = getOpenRouterClient();
  const response = await client.getCoachingResponse(prompt);
  const lines = response.content
    .split(/\r?\n+/)
    .map((l) => l.replace(/^[-•\d\.\)\s]+/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 5);
  return { lines, cues: detection.cues };
}

