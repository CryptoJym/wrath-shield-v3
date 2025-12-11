#!/usr/bin/env tsx
/**
 * EA Weekly Report Generation
 *
 * Runs every Sunday at 6:00 PM to prepare the week-ahead view.
 * Called by PM2 cron or internal scheduler.
 *
 * Responsibilities:
 * - Review past week's activity
 * - Prepare week-ahead calendar view
 * - Identify potential conflicts
 * - Surface upcoming deadlines
 * - Generate weekly summary
 */

import { addMemory, searchMemories } from '../lib/MemoryWrapper';
import { getEventBus, createNotificationEvent } from '../lib/agents/life-os-event-bus';

const USER_ID = process.env.MEMORY_USER_ID || 'james';

interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  pastWeek: {
    tasksCompleted: number;
    meetingsAttended: number;
    keyHighlights: string[];
  };
  upcomingWeek: {
    scheduledEvents: number;
    deadlines: number;
    potentialConflicts: number;
    focusAreas: string[];
  };
}

async function generateWeeklySummary(): Promise<WeeklySummary> {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1); // Next Monday

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  console.log(`[EA Weekly] Generating report for week of ${weekStart.toISOString().slice(0, 10)}...`);

  // TODO: Implement actual data fetching
  const summary: WeeklySummary = {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    pastWeek: {
      tasksCompleted: 0,
      meetingsAttended: 0,
      keyHighlights: [],
    },
    upcomingWeek: {
      scheduledEvents: 0,
      deadlines: 0,
      potentialConflicts: 0,
      focusAreas: ['Deep work on priority projects', 'Team coordination', 'Strategic planning'],
    },
  };

  return summary;
}

async function storeWeeklyReport(summary: WeeklySummary): Promise<void> {
  const reportText = [
    `Weekly Report for ${summary.weekStart} to ${summary.weekEnd}`,
    '',
    '## Past Week',
    `- Tasks Completed: ${summary.pastWeek.tasksCompleted}`,
    `- Meetings Attended: ${summary.pastWeek.meetingsAttended}`,
    summary.pastWeek.keyHighlights.length > 0 ? '- Key Highlights:' : '',
    ...summary.pastWeek.keyHighlights.map(h => `  - ${h}`),
    '',
    '## Upcoming Week',
    `- Scheduled Events: ${summary.upcomingWeek.scheduledEvents}`,
    `- Deadlines: ${summary.upcomingWeek.deadlines}`,
    `- Potential Conflicts: ${summary.upcomingWeek.potentialConflicts}`,
    summary.upcomingWeek.focusAreas.length > 0 ? '- Focus Areas:' : '',
    ...summary.upcomingWeek.focusAreas.map(f => `  - ${f}`),
  ].join('\n');

  await addMemory(reportText, USER_ID, {
    type: 'anchor',
    category: 'weekly_report',
    weekStart: summary.weekStart,
    weekEnd: summary.weekEnd,
    agent: 'agent.ea',
  });

  console.log('[EA Weekly] Stored weekly report in memory');
}

async function publishWeeklyNotification(summary: WeeklySummary): Promise<void> {
  const eventBus = getEventBus();

  await eventBus.publish(createNotificationEvent({
    source: 'agent.ea',
    payload: {
      type: 'weekly_report',
      summary,
      timestamp: new Date().toISOString(),
    },
    priority: 'normal',
  }));

  console.log('[EA Weekly] Published weekly report notification');
}

async function main() {
  try {
    console.log('[EA Weekly] Starting weekly report generation...');

    const summary = await generateWeeklySummary();

    await storeWeeklyReport(summary);
    await publishWeeklyNotification(summary);

    console.log('[EA Weekly] Successfully generated weekly report');
  } catch (error) {
    console.error('[EA Weekly] Error:', error);
    process.exitCode = 1;
  }
}

main();
