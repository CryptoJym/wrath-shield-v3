/**
 * Internal Cron Scheduler
 *
 * For Railway/serverless deployments where PM2 cron isn't available.
 * Call initScheduler() once at app startup.
 */

import { ensureServerOnly } from '../server-only-guard';

ensureServerOnly('lib/cron/scheduler');

// Only import node-cron in Node.js environment
let cron: typeof import('node-cron') | null = null;

interface ScheduledJob {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

const jobs: ScheduledJob[] = [
  {
    name: 'proactive-tick',
    schedule: '* * * * *', // every minute
    handler: async () => {
      const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${process.env.PORT || 3000}`;
      await fetch(`${baseUrl}/api/proactive/tick?secret=${process.env.PROACTIVE_SECRET}`);
    },
    enabled: true,
  },
  {
    name: 'legal-hourly',
    schedule: '20 * * * *', // hourly at :20
    handler: async () => {
      const { runLegalPipeline } = await import('../legal/pipeline');
      await runLegalPipeline();
    },
    enabled: true,
  },
  {
    name: 'lifelog-hourly',
    schedule: '0 4-23 * * *', // hourly 4am-11pm
    handler: async () => {
      const { syncLifelogs } = await import('../integrations/limitless');
      await syncLifelogs();
    },
    enabled: true,
  },
  {
    name: 'digest-morning',
    schedule: '5 7 * * *', // 7:05am daily
    handler: async () => {
      const { generateDailyDigest } = await import('../digest');
      await generateDailyDigest();
    },
    enabled: true,
  },
  {
    name: 'finance-daily',
    schedule: '30 6 * * *', // 6:30am daily
    handler: async () => {
      const { ingestTransactions, rollupFinance } = await import('../finance');
      await ingestTransactions();
      await rollupFinance();
    },
    enabled: true,
  },
  // =============================================================================
  // CORTEX SYNTHESIS - LLM Processing of Events
  // =============================================================================
  {
    name: 'cortex-synthesis',
    schedule: '*/5 * * * *', // every 5 minutes
    handler: async () => {
      const { getSynthesisLoop } = await import('../cortex/synthesis-loop');
      const synthesisLoop = getSynthesisLoop();
      const result = await synthesisLoop.runSynthesisPass();
      if (result) {
        console.log(`[Cortex] Synthesized ${result.unified_tasks.length} tasks, ${result.task_updates.length} updates`);
      }
    },
    enabled: true,
  },
  // =============================================================================
  // DECISION QUEUE MAINTENANCE - Auto-expire stale decisions
  // =============================================================================
  {
    name: 'decision-queue-maintenance',
    schedule: '0 3 * * *', // 3am daily
    handler: async () => {
      const { getDecisionQueue } = await import('../cortex/decision-queue');
      const queue = getDecisionQueue();
      const expired = await queue.autoResolveStale(7); // 7 days
      if (expired > 0) {
        console.log(`[DecisionQueue] Auto-expired ${expired} stale decisions`);
      }
    },
    enabled: true,
  },
  // =============================================================================
  // IMESSAGE SYNC - Process new messages
  // =============================================================================
  {
    name: 'imessage-sync',
    schedule: '*/15 * * * *', // every 15 minutes
    handler: async () => {
      const { syncIMessages } = await import('../integrations/imessage');
      await syncIMessages();
    },
    enabled: true,
  },
  // =============================================================================
  // SEMANTIC LEARNING - Cross-system pattern/preference learning
  // =============================================================================
  {
    name: 'semantic-learning',
    schedule: '30 */2 * * *', // every 2 hours at :30
    handler: async () => {
      const { triggerLearningCycle } = await import('../learning/semantic-learning-bridge');
      const insights = await triggerLearningCycle();
      if (insights.length > 0) {
        console.log(`[SemanticLearning] Generated ${insights.length} learning insights`);
      }
    },
    enabled: true,
  },
];

let initialized = false;

export async function initScheduler(): Promise<void> {
  if (initialized) return;

  // Skip in development or if PM2 is handling cron
  if (process.env.NODE_ENV === 'development' || process.env.USE_PM2_CRON === 'true') {
    console.log('[Scheduler] Skipping - using PM2 cron or development mode');
    return;
  }

  try {
    cron = await import('node-cron');
  } catch (e) {
    console.warn('[Scheduler] node-cron not available, skipping internal scheduler');
    return;
  }

  for (const job of jobs) {
    if (!job.enabled) continue;

    if (!cron.validate(job.schedule)) {
      console.error(`[Scheduler] Invalid cron expression for ${job.name}: ${job.schedule}`);
      continue;
    }

    cron.schedule(job.schedule, async () => {
      console.log(`[Scheduler] Running ${job.name}`);
      try {
        await job.handler();
        console.log(`[Scheduler] ${job.name} completed`);
      } catch (e) {
        console.error(`[Scheduler] ${job.name} failed:`, e);
      }
    });

    console.log(`[Scheduler] Registered: ${job.name} (${job.schedule})`);
  }

  initialized = true;
  console.log('[Scheduler] Internal cron scheduler initialized');
}

export function isSchedulerInitialized(): boolean {
  return initialized;
}
