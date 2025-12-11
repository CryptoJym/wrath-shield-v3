#!/usr/bin/env tsx
/**
 * EA Daily Agenda Generation
 *
 * Runs every morning at 6:30 AM to prepare the day's agenda.
 * Called by PM2 cron or internal scheduler.
 *
 * Responsibilities:
 * - Compile calendar events for today
 * - Surface high-priority tasks
 * - Check for scheduling conflicts
 * - Generate agenda and store in memory
 */

import { addMemory } from '../lib/MemoryWrapper';
import { getEventBus, createNotificationEvent } from '../lib/agents/life-os-event-bus';

const USER_ID = process.env.MEMORY_USER_ID || 'james';

interface AgendaItem {
  time: string;
  title: string;
  type: 'event' | 'task' | 'block';
  priority?: 'high' | 'medium' | 'low';
  duration?: number;
}

async function generateDailyAgenda(): Promise<AgendaItem[]> {
  const agenda: AgendaItem[] = [];
  const today = new Date().toISOString().slice(0, 10);

  console.log(`[EA Agenda] Generating agenda for ${today}...`);

  // TODO: Implement calendar event fetching
  // const calendarEvents = await fetchCalendarEvents(today);
  // agenda.push(...calendarEvents);

  // TODO: Implement high-priority task fetching
  // const highPriorityTasks = await fetchHighPriorityTasks(today);
  // agenda.push(...highPriorityTasks);

  // TODO: Check for scheduling conflicts
  // const conflicts = detectConflicts(agenda);
  // if (conflicts.length > 0) {
  //   await notifyConflicts(conflicts);
  // }

  // Placeholder agenda
  agenda.push({
    time: '07:00',
    title: 'Morning Review',
    type: 'block',
    priority: 'high',
    duration: 30,
  });

  agenda.push({
    time: '09:00',
    title: 'Focus Block',
    type: 'block',
    priority: 'high',
    duration: 120,
  });

  return agenda;
}

async function storeAgendaInMemory(agenda: AgendaItem[]): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const agendaText = [
    `Daily Agenda for ${today}:`,
    '',
    ...agenda.map(item => {
      const priority = item.priority ? ` [${item.priority.toUpperCase()}]` : '';
      const duration = item.duration ? ` (${item.duration}m)` : '';
      return `${item.time} - ${item.title}${priority}${duration}`;
    }),
  ].join('\n');

  await addMemory(agendaText, USER_ID, {
    type: 'anchor',
    category: 'agenda',
    date: today,
    agent: 'agent.ea',
  });

  console.log('[EA Agenda] Stored agenda in memory');
}

async function publishAgendaNotification(agenda: AgendaItem[]): Promise<void> {
  const eventBus = getEventBus();

  await eventBus.publish(createNotificationEvent({
    source: 'agent.ea',
    payload: {
      type: 'daily_agenda',
      agenda,
      timestamp: new Date().toISOString(),
    },
    priority: 'normal',
  }));

  console.log('[EA Agenda] Published agenda notification');
}

async function main() {
  try {
    console.log('[EA Agenda] Starting daily agenda generation...');

    const agenda = await generateDailyAgenda();

    await storeAgendaInMemory(agenda);
    await publishAgendaNotification(agenda);

    console.log(`[EA Agenda] Successfully generated agenda with ${agenda.length} items`);
  } catch (error) {
    console.error('[EA Agenda] Error:', error);
    process.exitCode = 1;
  }
}

main();
