/**
 * Hyro Education Memory Module
 *
 * Provides specialized memory operations for Hyro's education tracking:
 * - Learning patterns and preferences
 * - Lesson plan history
 * - Assignment context
 * - Educational progress tracking
 *
 * Uses a dedicated Zep graph: wrath-shield-hyro-education-agent
 * Note: This is separate from the general hyro-agent graph for
 * education-specific context.
 */

import { ensureServerOnly } from '../server-only-guard';
import {
  addAgentMemory,
  searchAgentMemory,
  type AgentId,
  type ZepSearchResult,
} from '../memory/zep';

// Prevent client-side imports
ensureServerOnly('lib/hyro/education-memory');

// Use hyro-agent for education memory (could create separate graph if needed)
const HYRO_EDUCATION_AGENT_ID: AgentId = 'hyro-agent';

export interface LessonPlan {
  id: string;
  subject: string;
  topic: string;
  objectives: string[];
  activities: Activity[];
  duration: number; // minutes
  grade_level?: string;
  date?: string;
  status: 'draft' | 'scheduled' | 'completed' | 'archived';
  notes?: string;
  resources?: Resource[];
}

export interface Activity {
  name: string;
  duration: number;
  type: 'instruction' | 'practice' | 'assessment' | 'discussion' | 'project' | 'break';
  description?: string;
  materials?: string[];
}

export interface Resource {
  title: string;
  type: 'video' | 'worksheet' | 'website' | 'book' | 'game' | 'other';
  url?: string;
  notes?: string;
}

export interface LearningPattern {
  category: 'strength' | 'weakness' | 'preference' | 'style' | 'interest';
  subject?: string;
  observation: string;
  confidence: number; // 0-1
  source: 'observed' | 'reported' | 'inferred';
}

export interface AssignmentContext {
  platform: string;
  subject: string;
  title: string;
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  notes?: string;
}

/**
 * Search education-related memories
 */
export async function searchEducationMemory(
  query: string,
  limit: number = 10
): Promise<ZepSearchResult[]> {
  return searchAgentMemory(HYRO_EDUCATION_AGENT_ID, query, limit);
}

/**
 * Add education-related memory
 */
export async function addEducationMemory(
  text: string,
  category: 'lesson_plan' | 'progress' | 'pattern' | 'assignment' | 'resource' | 'note',
  metadata?: Record<string, any>
): Promise<void> {
  const prefixedText = `[EDUCATION - ${category.toUpperCase()}] ${text}`;

  await addAgentMemory(HYRO_EDUCATION_AGENT_ID, prefixedText, {
    domain: 'education',
    category,
    ...metadata,
  });

  console.log(`[EducationMemory] Added ${category}: ${text.substring(0, 50)}...`);
}

/**
 * Record a completed lesson plan
 */
export async function recordLessonPlan(plan: LessonPlan): Promise<string> {
  const text = `Lesson Plan: ${plan.subject} - ${plan.topic}
Objectives: ${plan.objectives.join('; ')}
Duration: ${plan.duration} minutes
Activities: ${plan.activities.map(a => a.name).join(', ')}
Status: ${plan.status}
${plan.notes ? `Notes: ${plan.notes}` : ''}`;

  await addEducationMemory(text, 'lesson_plan', {
    lesson_plan_id: plan.id,
    subject: plan.subject,
    topic: plan.topic,
    duration: plan.duration,
    status: plan.status,
    objectives: plan.objectives,
    activity_count: plan.activities.length,
  });

  console.log(`[EducationMemory] Recorded lesson plan: ${plan.id}`);
  return plan.id;
}

/**
 * Record a learning pattern observation
 */
export async function recordLearningPattern(pattern: LearningPattern): Promise<void> {
  const text = `Learning Pattern: ${pattern.observation}
Category: ${pattern.category}
${pattern.subject ? `Subject: ${pattern.subject}` : ''}
Confidence: ${(pattern.confidence * 100).toFixed(0)}%
Source: ${pattern.source}`;

  await addEducationMemory(text, 'pattern', {
    pattern_category: pattern.category,
    subject: pattern.subject,
    confidence: pattern.confidence,
    source: pattern.source,
  });

  console.log(`[EducationMemory] Recorded pattern: ${pattern.category}`);
}

/**
 * Record assignment context for future reference
 */
export async function recordAssignment(assignment: AssignmentContext): Promise<void> {
  const text = `Assignment: ${assignment.title}
Platform: ${assignment.platform}
Subject: ${assignment.subject}
${assignment.dueDate ? `Due: ${assignment.dueDate}` : ''}
Status: ${assignment.status}
${assignment.notes ? `Notes: ${assignment.notes}` : ''}`;

  await addEducationMemory(text, 'assignment', {
    platform: assignment.platform,
    subject: assignment.subject,
    title: assignment.title,
    due_date: assignment.dueDate,
    status: assignment.status,
  });

  console.log(`[EducationMemory] Recorded assignment: ${assignment.title}`);
}

/**
 * Record progress update
 */
export async function recordProgress(
  subject: string,
  description: string,
  metrics?: Record<string, any>
): Promise<void> {
  const text = `Progress Update - ${subject}: ${description}`;

  await addEducationMemory(text, 'progress', {
    subject,
    ...metrics,
  });

  console.log(`[EducationMemory] Recorded progress: ${subject}`);
}

/**
 * Record a useful educational resource
 */
export async function recordResource(resource: Resource, subject?: string): Promise<void> {
  const text = `Educational Resource: ${resource.title}
Type: ${resource.type}
${resource.url ? `URL: ${resource.url}` : ''}
${subject ? `Subject: ${subject}` : ''}
${resource.notes ? `Notes: ${resource.notes}` : ''}`;

  await addEducationMemory(text, 'resource', {
    resource_type: resource.type,
    subject,
    url: resource.url,
  });

  console.log(`[EducationMemory] Recorded resource: ${resource.title}`);
}

/**
 * Get learning patterns for a subject
 */
export async function getSubjectPatterns(
  subject: string,
  limit: number = 5
): Promise<ZepSearchResult[]> {
  const results = await searchEducationMemory(`learning pattern ${subject}`, limit * 2);
  return results.filter(r =>
    r.memory.metadata?.category === 'pattern' &&
    (!r.memory.metadata?.subject || r.memory.metadata.subject === subject)
  ).slice(0, limit);
}

/**
 * Get recent lesson plans
 */
export async function getRecentLessonPlans(limit: number = 10): Promise<ZepSearchResult[]> {
  const results = await searchEducationMemory('lesson plan', limit * 2);
  return results.filter(r =>
    r.memory.metadata?.category === 'lesson_plan'
  ).slice(0, limit);
}

/**
 * Get context for lesson planning AI
 */
export async function getLessonPlanningContext(
  subject: string,
  topic: string
): Promise<string> {
  const [patterns, recentPlans, resources] = await Promise.all([
    getSubjectPatterns(subject, 3),
    searchEducationMemory(`${subject} lesson`, 3),
    searchEducationMemory(`${subject} resource`, 3),
  ]);

  const parts: string[] = [];

  parts.push(`### Lesson Planning Context for ${subject}: ${topic}\n`);

  if (patterns.length > 0) {
    parts.push('#### Learning Patterns:');
    patterns.forEach((p, i) => {
      parts.push(`${i + 1}. ${p.memory.text.split('\n')[0].replace('[EDUCATION - PATTERN]', '').trim()}`);
    });
  }

  if (recentPlans.length > 0) {
    parts.push('\n#### Recent Related Lessons:');
    recentPlans.forEach((p, i) => {
      const title = p.memory.text.split('\n')[0].replace('[EDUCATION - LESSON_PLAN]', '').trim();
      parts.push(`${i + 1}. ${title}`);
    });
  }

  if (resources.length > 0) {
    parts.push('\n#### Available Resources:');
    resources.forEach((r, i) => {
      const title = r.memory.text.split('\n')[0].replace('[EDUCATION - RESOURCE]', '').trim();
      parts.push(`${i + 1}. ${title}`);
    });
  }

  return parts.join('\n');
}

/**
 * Get weekly context for calendar display
 */
export async function getWeeklyContext(
  weekStart: string,
  weekEnd: string
): Promise<{
  assignments: ZepSearchResult[];
  lessonPlans: ZepSearchResult[];
  patterns: ZepSearchResult[];
}> {
  const [assignments, lessonPlans, patterns] = await Promise.all([
    searchEducationMemory(`assignment ${weekStart}`, 20),
    searchEducationMemory(`lesson plan scheduled`, 10),
    searchEducationMemory('learning pattern', 5),
  ]);

  return {
    assignments: assignments.filter(a =>
      a.memory.metadata?.category === 'assignment'
    ),
    lessonPlans: lessonPlans.filter(l =>
      l.memory.metadata?.category === 'lesson_plan'
    ),
    patterns: patterns.filter(p =>
      p.memory.metadata?.category === 'pattern'
    ),
  };
}

/**
 * Learn from teaching feedback
 */
export async function learnFromFeedback(
  lessonPlanId: string,
  feedback: string,
  effectiveness: 'very_effective' | 'effective' | 'neutral' | 'ineffective',
  adjustments?: string
): Promise<void> {
  const text = `Lesson Feedback for ${lessonPlanId}
Effectiveness: ${effectiveness}
Feedback: ${feedback}
${adjustments ? `Suggested Adjustments: ${adjustments}` : ''}`;

  await addEducationMemory(text, 'note', {
    lesson_plan_id: lessonPlanId,
    effectiveness,
    type: 'feedback',
  });

  // If feedback indicates pattern, record it
  if (effectiveness === 'very_effective' || effectiveness === 'ineffective') {
    await recordLearningPattern({
      category: effectiveness === 'very_effective' ? 'strength' : 'weakness',
      observation: feedback,
      confidence: 0.7,
      source: 'observed',
    });
  }
}

export {
  HYRO_EDUCATION_AGENT_ID,
};
