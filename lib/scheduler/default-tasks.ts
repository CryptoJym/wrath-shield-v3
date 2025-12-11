/**
 * Default Scheduled Tasks
 * Pre-configured tasks for Life OS automation
 *
 * Tasks include:
 * - Daily briefing (morning agenda)
 * - Inbox sweep (periodic message processing)
 * - Health reminders (breaks, hydration)
 * - Weekly planning (Sunday evening)
 */

import { ScheduledTask } from './index';
import { getEAAgent } from '@/lib/agents/ea-agent';
import { getEventBus, createNotificationEvent, createTaskEvent } from '@/lib/agents/life-os-event-bus';

/**
 * Default scheduled tasks for Life OS
 * Configure these based on user preferences
 */
export const DEFAULT_TASKS: ScheduledTask[] = [
  // =============================================================================
  // DAILY BRIEFING - Morning Agenda
  // =============================================================================
  {
    id: 'daily-briefing',
    name: 'Daily Briefing',
    description: 'Generate and send daily agenda every morning',
    cronExpression: '0 7 * * *',  // 7 AM daily
    enabled: true,
    handler: async () => {
      console.log('[Task: Daily Briefing] Generating daily agenda...');

      try {
        const ea = getEAAgent();
        const agenda = await ea.generateDailyAgenda();

        const eventBus = getEventBus();
        await eventBus.publish(createNotificationEvent({
          source: 'scheduler.daily-briefing',
          domain: 'work',
          payload: {
            type: 'daily-briefing',
            agenda,
            message: `Good morning! Here's your agenda:\n\n${agenda.summary}`
          },
          priority: 'normal'
        }));

        console.log('[Task: Daily Briefing] Agenda sent successfully');
      } catch (error) {
        console.error('[Task: Daily Briefing] Failed to generate agenda:', error);
        throw error;
      }
    }
  },

  // =============================================================================
  // INBOX SWEEP - Process Messages
  // =============================================================================
  {
    id: 'inbox-sweep',
    name: 'Inbox Sweep',
    description: 'Process and classify incoming messages every 30 minutes',
    cronExpression: '*/30 * * * *',  // Every 30 minutes
    enabled: true,
    handler: async () => {
      console.log('[Task: Inbox Sweep] Processing inbox...');

      try {
        const eventBus = getEventBus();

        // Trigger inbox processing via event bus
        await eventBus.publish(createTaskEvent({
          source: 'scheduler.inbox-sweep',
          domain: 'work',
          payload: {
            action: 'process-inbox',
            timestamp: new Date().toISOString()
          },
          priority: 'normal'
        }));

        console.log('[Task: Inbox Sweep] Inbox processing triggered');
      } catch (error) {
        console.error('[Task: Inbox Sweep] Failed to trigger inbox processing:', error);
        throw error;
      }
    }
  },

  // =============================================================================
  // HEALTH REMINDER - Breaks & Hydration
  // =============================================================================
  {
    id: 'health-reminder',
    name: 'Health Reminder',
    description: 'Remind to take breaks and stay healthy every 2 hours',
    cronExpression: '0 */2 * * *',  // Every 2 hours
    enabled: true,
    handler: async () => {
      console.log('[Task: Health Reminder] Sending health reminder...');

      try {
        const eventBus = getEventBus();

        // Random health tip
        const healthTips = [
          'Time for a break! Stand up, stretch, and hydrate.',
          'Quick reminder: Move your body and drink some water.',
          'Health check: Have you taken a break in the last 2 hours?',
          'Stretch break! Your body will thank you.',
          'Hydration reminder: Drink a glass of water.'
        ];

        const randomTip = healthTips[Math.floor(Math.random() * healthTips.length)];

        await eventBus.publish(createNotificationEvent({
          source: 'scheduler.health-reminder',
          domain: 'health',
          payload: {
            type: 'health-reminder',
            message: randomTip,
            timestamp: new Date().toISOString()
          },
          priority: 'low'
        }));

        console.log('[Task: Health Reminder] Reminder sent');
      } catch (error) {
        console.error('[Task: Health Reminder] Failed to send reminder:', error);
        throw error;
      }
    }
  },

  // =============================================================================
  // WEEKLY PLANNING - Sunday Evening Review
  // =============================================================================
  {
    id: 'weekly-planning',
    name: 'Weekly Planning',
    description: 'Generate weekly review and planning session every Sunday at 6 PM',
    cronExpression: '0 18 * * 0',  // Sunday 6 PM
    enabled: false,  // Disabled by default - user can enable
    handler: async () => {
      console.log('[Task: Weekly Planning] Generating weekly review...');

      try {
        const eventBus = getEventBus();

        await eventBus.publish(createNotificationEvent({
          source: 'scheduler.weekly-planning',
          domain: 'work',
          payload: {
            type: 'weekly-planning',
            message: 'Time for your weekly review! Reflect on the past week and plan for the next.',
            timestamp: new Date().toISOString()
          },
          priority: 'normal'
        }));

        // Could trigger more sophisticated weekly review here
        // - Pull tasks from PM system
        // - Analyze calendar events
        // - Review goals and metrics

        console.log('[Task: Weekly Planning] Review notification sent');
      } catch (error) {
        console.error('[Task: Weekly Planning] Failed to send review:', error);
        throw error;
      }
    }
  },

  // =============================================================================
  // EVENING WIND-DOWN - Prepare for Tomorrow
  // =============================================================================
  {
    id: 'evening-wind-down',
    name: 'Evening Wind-Down',
    description: 'Generate tomorrow\'s preview and wind-down checklist at 8 PM',
    cronExpression: '0 20 * * *',  // 8 PM daily
    enabled: false,  // Disabled by default - user can enable
    handler: async () => {
      console.log('[Task: Evening Wind-Down] Generating wind-down checklist...');

      try {
        const eventBus = getEventBus();
        const ea = getEAAgent();

        // Get tomorrow's events
        const upcomingEvents = await ea.getUpcomingEvents(1);

        await eventBus.publish(createNotificationEvent({
          source: 'scheduler.evening-wind-down',
          domain: 'health',
          payload: {
            type: 'evening-wind-down',
            message: 'Time to wind down for the day. Review tomorrow\'s schedule and prepare.',
            tomorrowEvents: upcomingEvents.length,
            timestamp: new Date().toISOString()
          },
          priority: 'low'
        }));

        console.log('[Task: Evening Wind-Down] Wind-down notification sent');
      } catch (error) {
        console.error('[Task: Evening Wind-Down] Failed to send wind-down:', error);
        throw error;
      }
    }
  },

  // =============================================================================
  // FOCUS TIME BLOCKER - Protect Deep Work
  // =============================================================================
  {
    id: 'focus-time-blocker',
    name: 'Focus Time Blocker',
    description: 'Automatically block focus time slots for deep work',
    cronExpression: '0 9 * * *',  // 9 AM daily
    enabled: false,  // Disabled by default - user can enable
    handler: async () => {
      console.log('[Task: Focus Time Blocker] Checking for focus time opportunities...');

      try {
        const ea = getEAAgent();

        // Check today's calendar
        const agenda = await ea.generateDailyAgenda();

        // Find 2+ hour free slots
        const focusSlots = agenda.freeSlots.filter(slot => {
          const duration = (slot.end.getTime() - slot.start.getTime()) / (60 * 1000);
          return duration >= 120; // 2+ hours
        });

        if (focusSlots.length > 0) {
          const eventBus = getEventBus();

          await eventBus.publish(createNotificationEvent({
            source: 'scheduler.focus-time-blocker',
            domain: 'work',
            payload: {
              type: 'focus-opportunity',
              message: `Found ${focusSlots.length} opportunity(ies) for deep work today. Block them on your calendar?`,
              slots: focusSlots,
              timestamp: new Date().toISOString()
            },
            priority: 'normal'
          }));

          console.log(`[Task: Focus Time Blocker] Found ${focusSlots.length} focus opportunities`);
        } else {
          console.log('[Task: Focus Time Blocker] No focus time opportunities found');
        }
      } catch (error) {
        console.error('[Task: Focus Time Blocker] Failed to check focus time:', error);
        throw error;
      }
    }
  }
];

/**
 * Initialize all default tasks
 * Call this on server startup to register tasks with the scheduler
 */
export function initializeDefaultTasks(scheduler: any): void {
  console.log('[Default Tasks] Registering default scheduled tasks...');

  for (const task of DEFAULT_TASKS) {
    scheduler.registerTask(task);
  }

  console.log(`[Default Tasks] Registered ${DEFAULT_TASKS.length} tasks`);
}
