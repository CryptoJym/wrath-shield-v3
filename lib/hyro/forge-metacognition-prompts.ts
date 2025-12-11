/**
 * HYRO FORGE: PMRE Metacognition Prompts
 * Planning, Monitoring, Regulation, Evaluation prompts by attractor state
 */

import type { AttractorType } from './forge-types';

// ============================================================================
// Types
// ============================================================================

export type PMREDimension = 'planning' | 'monitoring' | 'regulation' | 'evaluation';

export interface PMREPrompt {
  id: string;
  dimension: PMREDimension;
  attractorStates: AttractorType[];
  text: string;
  followUp?: string;
  priority: 'low' | 'medium' | 'high';
  cooldownMinutes: number;
}

interface CooldownRecord {
  promptId: string;
  shownAt: number;
}

// ============================================================================
// Prompt Database
// ============================================================================

const PMRE_PROMPTS: PMREPrompt[] = [
  // PLANNING - Flow
  {
    id: 'plan_flow_1',
    dimension: 'planning',
    attractorStates: ['flow'],
    text: "You're in the zone! What's your strategy for the next challenge?",
    priority: 'low',
    cooldownMinutes: 30,
  },
  {
    id: 'plan_flow_2',
    dimension: 'planning',
    attractorStates: ['flow'],
    text: 'How will you build on this momentum?',
    priority: 'low',
    cooldownMinutes: 45,
  },

  // PLANNING - Confusion
  {
    id: 'plan_confusion_1',
    dimension: 'planning',
    attractorStates: ['confusion'],
    text: "Let's break this down. What part do you understand so far?",
    followUp: 'What specific part is unclear?',
    priority: 'high',
    cooldownMinutes: 10,
  },
  {
    id: 'plan_confusion_2',
    dimension: 'planning',
    attractorStates: ['confusion'],
    text: 'What would help you understand this better?',
    priority: 'high',
    cooldownMinutes: 15,
  },

  // PLANNING - Boredom
  {
    id: 'plan_boredom_1',
    dimension: 'planning',
    attractorStates: ['boredom'],
    text: 'Ready for a bigger challenge? What level would excite you?',
    priority: 'medium',
    cooldownMinutes: 20,
  },
  {
    id: 'plan_boredom_2',
    dimension: 'planning',
    attractorStates: ['boredom'],
    text: 'What would make this more interesting for you?',
    priority: 'medium',
    cooldownMinutes: 25,
  },

  // PLANNING - Frustration
  {
    id: 'plan_frustration_1',
    dimension: 'planning',
    attractorStates: ['frustration'],
    text: "Let's try a different approach. What haven't you tried yet?",
    priority: 'high',
    cooldownMinutes: 10,
  },
  {
    id: 'plan_frustration_2',
    dimension: 'planning',
    attractorStates: ['frustration'],
    text: 'Would you like to step back and review the basics?',
    priority: 'high',
    cooldownMinutes: 15,
  },

  // PLANNING - Discovery
  {
    id: 'plan_discovery_1',
    dimension: 'planning',
    attractorStates: ['discovery'],
    text: 'Great insight! How can you apply this to other problems?',
    priority: 'medium',
    cooldownMinutes: 20,
  },

  // MONITORING - All states
  {
    id: 'mon_general_1',
    dimension: 'monitoring',
    attractorStates: ['flow', 'confusion', 'boredom', 'frustration', 'discovery'],
    text: 'How confident do you feel about your answer?',
    priority: 'medium',
    cooldownMinutes: 15,
  },
  {
    id: 'mon_confusion_1',
    dimension: 'monitoring',
    attractorStates: ['confusion'],
    text: 'On a scale of 1-5, how clear is your understanding right now?',
    priority: 'high',
    cooldownMinutes: 10,
  },
  {
    id: 'mon_frustration_1',
    dimension: 'monitoring',
    attractorStates: ['frustration'],
    text: "Let's check in: Are you feeling stuck or making progress?",
    priority: 'high',
    cooldownMinutes: 10,
  },
  {
    id: 'mon_flow_1',
    dimension: 'monitoring',
    attractorStates: ['flow'],
    text: 'Quick check: Is this difficulty level still right for you?',
    priority: 'low',
    cooldownMinutes: 45,
  },

  // REGULATION - Confusion/Frustration
  {
    id: 'reg_confusion_1',
    dimension: 'regulation',
    attractorStates: ['confusion'],
    text: 'Would a hint help right now, or do you want to keep trying?',
    priority: 'high',
    cooldownMinutes: 10,
  },
  {
    id: 'reg_frustration_1',
    dimension: 'regulation',
    attractorStates: ['frustration'],
    text: 'Sometimes a short break helps. Want to pause for a moment?',
    priority: 'high',
    cooldownMinutes: 15,
  },
  {
    id: 'reg_frustration_2',
    dimension: 'regulation',
    attractorStates: ['frustration'],
    text: "Let's try an easier problem to rebuild momentum.",
    priority: 'high',
    cooldownMinutes: 20,
  },
  {
    id: 'reg_boredom_1',
    dimension: 'regulation',
    attractorStates: ['boredom'],
    text: 'Want to skip ahead to more challenging material?',
    priority: 'medium',
    cooldownMinutes: 20,
  },

  // EVALUATION - All states
  {
    id: 'eval_general_1',
    dimension: 'evaluation',
    attractorStates: ['flow', 'confusion', 'boredom', 'frustration', 'discovery'],
    text: 'What did you learn from this problem?',
    priority: 'medium',
    cooldownMinutes: 30,
  },
  {
    id: 'eval_discovery_1',
    dimension: 'evaluation',
    attractorStates: ['discovery'],
    text: "That's a breakthrough! Can you explain what clicked?",
    priority: 'medium',
    cooldownMinutes: 20,
  },
  {
    id: 'eval_flow_1',
    dimension: 'evaluation',
    attractorStates: ['flow'],
    text: 'Great work! What strategy worked best for you?',
    priority: 'low',
    cooldownMinutes: 45,
  },
  {
    id: 'eval_confusion_1',
    dimension: 'evaluation',
    attractorStates: ['confusion'],
    text: 'After seeing the answer, does it make more sense now?',
    priority: 'high',
    cooldownMinutes: 10,
  },
];

// ============================================================================
// Cooldown Management
// ============================================================================

const learnerCooldowns: Map<string, CooldownRecord[]> = new Map();

function getCooldownKey(learnerId: string): string {
  return `pmre_cooldown_${learnerId}`;
}

function cleanExpiredCooldowns(learnerId: string): void {
  const records = learnerCooldowns.get(learnerId) || [];
  const now = Date.now();
  const maxCooldown = 90 * 60 * 1000; // 90 minutes max

  const validRecords = records.filter(
    (r) => now - r.shownAt < maxCooldown
  );

  learnerCooldowns.set(learnerId, validRecords);
}

export function shouldShowPrompt(
  learnerId: string,
  promptId: string
): boolean {
  cleanExpiredCooldowns(learnerId);

  const records = learnerCooldowns.get(learnerId) || [];
  const prompt = PMRE_PROMPTS.find((p) => p.id === promptId);

  if (!prompt) return false;

  const lastShown = records.find((r) => r.promptId === promptId);
  if (!lastShown) return true;

  const cooldownMs = prompt.cooldownMinutes * 60 * 1000;
  return Date.now() - lastShown.shownAt >= cooldownMs;
}

export function recordPromptShown(
  learnerId: string,
  promptId: string
): void {
  cleanExpiredCooldowns(learnerId);

  const records = learnerCooldowns.get(learnerId) || [];

  // Remove old record for this prompt if exists
  const filteredRecords = records.filter((r) => r.promptId !== promptId);

  // Add new record
  filteredRecords.push({
    promptId,
    shownAt: Date.now(),
  });

  learnerCooldowns.set(learnerId, filteredRecords);
}

// ============================================================================
// Prompt Selection
// ============================================================================

export function getPMREPrompt(
  dimension: PMREDimension,
  attractorState: AttractorType,
  learnerId?: string
): PMREPrompt | null {
  // Find matching prompts
  const matches = PMRE_PROMPTS.filter(
    (p) =>
      p.dimension === dimension &&
      p.attractorStates.includes(attractorState)
  );

  if (matches.length === 0) return null;

  // If no learner ID, return random match
  if (!learnerId) {
    return matches[Math.floor(Math.random() * matches.length)];
  }

  // Filter by cooldown
  const available = matches.filter((p) =>
    shouldShowPrompt(learnerId, p.id)
  );

  if (available.length === 0) return null;

  // Sort by priority (high first)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  available.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // Return highest priority prompt
  const selected = available[0];
  recordPromptShown(learnerId, selected.id);

  return selected;
}

export function getPromptById(promptId: string): PMREPrompt | null {
  return PMRE_PROMPTS.find((p) => p.id === promptId) || null;
}

export function getPromptsByDimension(
  dimension: PMREDimension
): PMREPrompt[] {
  return PMRE_PROMPTS.filter((p) => p.dimension === dimension);
}

export function getPromptsByAttractor(
  attractorState: AttractorType
): PMREPrompt[] {
  return PMRE_PROMPTS.filter((p) =>
    p.attractorStates.includes(attractorState)
  );
}

export function getPromptStats(learnerId: string): {
  totalShown: number;
  byDimension: Record<PMREDimension, number>;
} {
  const records = learnerCooldowns.get(learnerId) || [];

  const byDimension: Record<PMREDimension, number> = {
    planning: 0,
    monitoring: 0,
    regulation: 0,
    evaluation: 0,
  };

  for (const record of records) {
    const prompt = PMRE_PROMPTS.find((p) => p.id === record.promptId);
    if (prompt) {
      byDimension[prompt.dimension]++;
    }
  }

  return {
    totalShown: records.length,
    byDimension,
  };
}

export function clearLearnerCooldowns(learnerId: string): void {
  learnerCooldowns.delete(learnerId);
}

export { PMRE_PROMPTS };
