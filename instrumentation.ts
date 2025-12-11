/**
 * Next.js Instrumentation
 * This file is automatically run on server startup (once per process)
 * Perfect for initializing singleton services like the event bus and scheduler
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server (not in Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing Life OS services...');

    // Import and initialize agent subscriptions
    const { initializeAgentSubscriptions } = await import('./lib/agents/agent-subscriptions');
    initializeAgentSubscriptions();

    console.log('[Instrumentation] Life OS Event Bus initialized successfully');

    // Initialize the internal scheduler
    const { getScheduler } = await import('./lib/scheduler');
    const { initializeDefaultTasks } = await import('./lib/scheduler/default-tasks');

    const scheduler = getScheduler();
    initializeDefaultTasks(scheduler);
    scheduler.start();

    console.log('[Instrumentation] Life OS Scheduler initialized successfully');

    // Initialize pattern recognition
    const { getPatternRecognizer } = await import('./lib/learning/pattern-recognizer');
    getPatternRecognizer();

    console.log('[Instrumentation] Pattern Recognition initialized successfully');
    console.log('[Instrumentation] All services ready');
  }
}
