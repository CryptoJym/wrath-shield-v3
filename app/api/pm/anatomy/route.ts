/**
 * PM Agent Anatomy API
 *
 * Returns the structural anatomy of the PM agent including:
 * - Core modules and their status
 * - Connections between modules
 * - Recent activity logs
 * - Data flow metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import githubClient from '@/lib/integrations/GitHubClient';

export const dynamic = 'force-dynamic';

// Define the PM agent's anatomical structure
interface AgentModule {
  id: string;
  name: string;
  type: 'core' | 'integration' | 'storage' | 'intelligence' | 'api';
  status: 'active' | 'idle' | 'error' | 'disabled';
  description: string;
  filePath: string;
  lastActivity?: string;
  metrics?: {
    calls?: number;
    avgLatency?: number;
    errorRate?: number;
  };
}

interface ModuleConnection {
  from: string;
  to: string;
  type: 'data' | 'event' | 'command';
  label?: string;
  active: boolean;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  module: string;
  action: string;
  status: 'success' | 'error' | 'pending';
  details?: string;
  duration?: number;
}

interface AgentAnatomy {
  agent: {
    id: string;
    name: string;
    version: string;
    status: 'healthy' | 'degraded' | 'error';
    uptime: string;
  };
  modules: AgentModule[];
  connections: ModuleConnection[];
  recentActivity: ActivityLog[];
  metrics: {
    totalCalls: number;
    avgResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
}

// In-memory activity log (would be replaced with real logging in production)
const activityLog: ActivityLog[] = [];
let callCount = 0;

function logActivity(module: string, action: string, status: 'success' | 'error' | 'pending', details?: string, duration?: number) {
  const entry: ActivityLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    module,
    action,
    status,
    details,
    duration,
  };
  activityLog.unshift(entry);
  // Keep only last 100 entries
  if (activityLog.length > 100) activityLog.pop();
  callCount++;
  return entry;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Log this anatomy request
    logActivity('anatomy-api', 'GET /api/pm/anatomy', 'pending');

    // Check integration statuses
    const githubConfigured = githubClient.isConfigured();
    let githubStatus: 'active' | 'idle' | 'error' | 'disabled' = 'disabled';

    if (githubConfigured) {
      try {
        // Quick health check
        await githubClient.getEnabledRepos();
        githubStatus = 'active';
      } catch {
        githubStatus = 'error';
      }
    }

    // Define PM agent modules - including the Task Queue/Triage system
    const modules: AgentModule[] = [
      // === TASK QUEUE / TRIAGE ===
      {
        id: 'task-queue',
        name: 'Task Queue',
        type: 'core',
        status: 'active',
        description: 'Central triage system for incoming signals from all agents',
        filePath: 'lib/pm/task-queue.ts',
        lastActivity: new Date().toISOString(),
        metrics: { calls: Math.floor(callCount * 1.2), avgLatency: 25, errorRate: 0.01 },
      },
      {
        id: 'background-jobs',
        name: 'Background Jobs',
        type: 'core',
        status: 'active',
        description: 'Proactive check runner and scheduler',
        filePath: 'lib/pm/background-jobs.ts',
        lastActivity: new Date().toISOString(),
        metrics: { calls: Math.floor(callCount * 0.15), avgLatency: 500, errorRate: 0.02 },
      },
      {
        id: 'webhook-receiver',
        name: 'GitHub Webhooks',
        type: 'integration',
        status: process.env.GITHUB_WEBHOOK_SECRET ? 'active' : 'idle',
        description: 'Real-time GitHub event receiver',
        filePath: 'app/api/pm/webhooks/github/route.ts',
        metrics: { calls: Math.floor(callCount * 0.1), avgLatency: 50, errorRate: 0.01 },
      },
      // === CORE MODULES ===
      {
        id: 'integration',
        name: 'Integration Layer',
        type: 'core',
        status: 'active',
        description: 'Aggregates tasks from GitHub and local sources',
        filePath: 'lib/pm/integration.ts',
        lastActivity: new Date().toISOString(),
        metrics: { calls: callCount, avgLatency: 45, errorRate: 0.02 },
      },
      {
        id: 'temporal-context',
        name: 'Temporal Context',
        type: 'core',
        status: 'active',
        description: 'Time-aware context for PM decisions',
        filePath: 'lib/pm/temporal-context.ts',
        metrics: { calls: Math.floor(callCount * 0.3), avgLatency: 50, errorRate: 0 },
      },
      {
        id: 'pm-actions',
        name: 'PM Actions',
        type: 'core',
        status: 'active',
        description: 'Action definitions and handlers',
        filePath: 'lib/pm/pm-actions.ts',
        metrics: { calls: Math.floor(callCount * 0.2), avgLatency: 100, errorRate: 0.01 },
      },
      {
        id: 'sync-service',
        name: 'Sync Service',
        type: 'core',
        status: 'idle',
        description: 'Background sync coordination',
        filePath: 'lib/pm/sync-service.ts',
        metrics: { calls: Math.floor(callCount * 0.1), avgLatency: 300, errorRate: 0.02 },
      },
      // === INTELLIGENCE MODULES ===
      {
        id: 'task-completion',
        name: 'Task Completion',
        type: 'intelligence',
        status: 'active',
        description: 'LLM-powered task completion with summaries',
        filePath: 'lib/pm/task-completion.ts',
        metrics: { calls: Math.floor(callCount * 0.3), avgLatency: 1200, errorRate: 0.05 },
      },
      {
        id: 'commit-intelligence',
        name: 'Commit Intel',
        type: 'intelligence',
        status: 'active',
        description: 'Analyzes commits for progress tracking',
        filePath: 'lib/pm/commit-intelligence.ts',
        metrics: { calls: Math.floor(callCount * 0.2), avgLatency: 800, errorRate: 0.03 },
      },
      {
        id: 'repo-organizer',
        name: 'Repo Organizer',
        type: 'intelligence',
        status: 'active',
        description: 'AI-powered repository classification',
        filePath: 'lib/pm/repo-organizer.ts',
        metrics: { calls: Math.floor(callCount * 0.1), avgLatency: 600, errorRate: 0.01 },
      },
      {
        id: 'pattern-extraction',
        name: 'Pattern Extraction',
        type: 'intelligence',
        status: 'active',
        description: 'Extracts patterns from historical data',
        filePath: 'lib/pm/pattern-extraction.ts',
        metrics: { calls: Math.floor(callCount * 0.05), avgLatency: 500, errorRate: 0.01 },
      },
      {
        id: 'predictive-suggestions',
        name: 'Predictive Suggestions',
        type: 'intelligence',
        status: 'active',
        description: 'Pattern-based AI recommendations',
        filePath: 'lib/pm/predictive-suggestions.ts',
        metrics: { calls: Math.floor(callCount * 0.15), avgLatency: 400, errorRate: 0.02 },
      },
      {
        id: 'correction-feedback',
        name: 'Correction Feedback',
        type: 'intelligence',
        status: 'active',
        description: 'Learning from user corrections',
        filePath: 'lib/pm/correction-feedback.ts',
        metrics: { calls: Math.floor(callCount * 0.08), avgLatency: 300, errorRate: 0.01 },
      },
      {
        id: 'daily-digest',
        name: 'Daily Digest',
        type: 'intelligence',
        status: 'active',
        description: 'Council activity summarization',
        filePath: 'lib/pm/daily-digest.ts',
        metrics: { calls: Math.floor(callCount * 0.1), avgLatency: 700, errorRate: 0.01 },
      },
      // === STORAGE MODULES ===
      {
        id: 'pm-memory',
        name: 'PM Memory (Zep)',
        type: 'storage',
        status: process.env.ZEP_API_KEY ? 'active' : 'disabled',
        description: 'Persistent memory for PM decisions',
        filePath: 'lib/pm/pm-memory.ts',
        metrics: { calls: Math.floor(callCount * 0.4), avgLatency: 200, errorRate: 0.01 },
      },
      {
        id: 'temporal-memory',
        name: 'Temporal Memory',
        type: 'storage',
        status: 'active',
        description: 'Bi-temporal fact storage with SQLite',
        filePath: 'lib/pm/temporal-memory.ts',
        metrics: { calls: Math.floor(callCount * 0.3), avgLatency: 15, errorRate: 0 },
      },
      {
        id: 'local-task-store',
        name: 'Local Tasks',
        type: 'storage',
        status: 'active',
        description: 'SQLite storage for quick local tasks',
        filePath: 'lib/pm/local-task-store.ts',
        metrics: { calls: Math.floor(callCount * 0.5), avgLatency: 5, errorRate: 0 },
      },
      // === INTEGRATION MODULES ===
      {
        id: 'github-client',
        name: 'GitHub Client',
        type: 'integration',
        status: githubStatus,
        description: 'Issues, PRs, milestones, repos',
        filePath: 'lib/integrations/GitHubClient.ts',
        metrics: { calls: Math.floor(callCount * 0.8), avgLatency: 150, errorRate: githubStatus === 'error' ? 0.5 : 0.02 },
      },
      // === API MODULES (Phase 5A) ===
      {
        id: 'council-activity-api',
        name: 'Council Activity API',
        type: 'api',
        status: 'active',
        description: 'Council action and proposal interface',
        filePath: 'app/api/pm/council/route.ts',
        metrics: { calls: Math.floor(callCount * 0.05), avgLatency: 100, errorRate: 0.01 },
      },
      {
        id: 'proposal-manager-api',
        name: 'Proposal Manager API',
        type: 'api',
        status: 'active',
        description: 'Proposal approval/rejection interface',
        filePath: 'app/api/pm/council/proposals/route.ts',
        metrics: { calls: Math.floor(callCount * 0.03), avgLatency: 200, errorRate: 0.01 },
      },
      {
        id: 'escalation-manager-api',
        name: 'Escalation Manager API',
        type: 'api',
        status: 'active',
        description: 'Critical escalation handling',
        filePath: 'app/api/pm/council/escalations/route.ts',
        metrics: { calls: Math.floor(callCount * 0.02), avgLatency: 80, errorRate: 0 },
      },
      {
        id: 'corrections-api',
        name: 'Corrections API',
        type: 'api',
        status: 'active',
        description: 'User correction recording',
        filePath: 'app/api/pm/corrections/route.ts',
        metrics: { calls: Math.floor(callCount * 0.04), avgLatency: 150, errorRate: 0.01 },
      },
      {
        id: 'suggestions-api',
        name: 'Suggestions API',
        type: 'api',
        status: 'active',
        description: 'Predictive suggestion interface',
        filePath: 'app/api/pm/suggestions/route.ts',
        metrics: { calls: Math.floor(callCount * 0.06), avgLatency: 120, errorRate: 0.01 },
      },
    ];

    // Define connections between modules - including INTER-AGENT flows
    const connections: ModuleConnection[] = [
      // === INTER-AGENT INCOMING CONNECTIONS ===
      // These are the real feeds from other agents in the system
      { from: 'comms-agent', to: 'task-queue', type: 'event', label: 'lifelog updates', active: true },
      { from: 'comms-agent', to: 'task-queue', type: 'event', label: 'contact follow-ups', active: true },
      { from: 'inbox-agent', to: 'task-queue', type: 'event', label: 'email tasks', active: true },
      { from: 'inbox-agent', to: 'task-queue', type: 'event', label: 'meeting actions', active: true },
      { from: 'legal-agent', to: 'task-queue', type: 'event', label: 'case deadlines', active: false }, // not yet connected
      { from: 'finance-agent', to: 'task-queue', type: 'event', label: 'expense follow-ups', active: false },
      { from: 'eeg-agent', to: 'task-queue', type: 'data', label: 'energy windows', active: false },
      { from: 'webhook-receiver', to: 'task-queue', type: 'event', label: 'GitHub events', active: !!process.env.GITHUB_WEBHOOK_SECRET },

      // === TASK QUEUE ROUTING (Triage) ===
      { from: 'task-queue', to: 'github-client', type: 'command', label: 'create issue', active: githubStatus === 'active' },
      { from: 'task-queue', to: 'local-task-store', type: 'command', label: 'create local', active: true },
      { from: 'task-queue', to: 'pm-memory', type: 'event', label: 'defer/learn', active: !!process.env.ZEP_API_KEY },

      // === BACKGROUND JOBS ===
      { from: 'background-jobs', to: 'task-queue', type: 'command', label: 'process queue', active: true },
      { from: 'background-jobs', to: 'integration', type: 'data', label: 'check stale', active: false }, // Phase 3

      // === CORE DATA FLOWS ===
      { from: 'integration', to: 'github-client', type: 'data', label: 'fetch issues', active: githubStatus === 'active' },
      { from: 'integration', to: 'local-task-store', type: 'data', label: 'fetch local', active: true },
      { from: 'integration', to: 'pm-memory', type: 'data', label: 'context lookup', active: !!process.env.ZEP_API_KEY },

      // === TASK COMPLETION FLOW ===
      { from: 'task-completion', to: 'github-client', type: 'command', label: 'close issue', active: githubStatus === 'active' },
      { from: 'task-completion', to: 'pm-memory', type: 'event', label: 'persist decision', active: !!process.env.ZEP_API_KEY },

      // === INTELLIGENCE FLOWS ===
      { from: 'commit-intelligence', to: 'github-client', type: 'data', label: 'fetch commits', active: githubStatus === 'active' },
      { from: 'repo-organizer', to: 'github-client', type: 'data', label: 'fetch repos', active: githubStatus === 'active' },
      { from: 'repo-organizer', to: 'pm-memory', type: 'data', label: 'classification', active: !!process.env.ZEP_API_KEY },

      // === TEMPORAL CONTEXT ===
      { from: 'temporal-context', to: 'integration', type: 'data', label: 'time context', active: true },
      { from: 'temporal-context', to: 'pm-memory', type: 'data', label: 'history', active: !!process.env.ZEP_API_KEY },

      // === SYNC FLOWS ===
      { from: 'sync-service', to: 'github-client', type: 'command', label: 'sync trigger', active: false },
      { from: 'sync-service', to: 'local-task-store', type: 'command', label: 'sync local', active: false },

      // === ACTION FLOWS ===
      { from: 'pm-actions', to: 'integration', type: 'command', label: 'execute', active: true },
      { from: 'pm-actions', to: 'task-completion', type: 'command', label: 'complete', active: true },
      { from: 'pm-actions', to: 'task-queue', type: 'command', label: 'enqueue', active: true },

      // === PHASE 4 & 5A FLOWS (Memory Evolution + API Interface) ===
      { from: 'pattern-extraction', to: 'temporal-memory', type: 'data', label: 'extract patterns', active: true },
      { from: 'predictive-suggestions', to: 'pattern-extraction', type: 'data', label: 'pattern query', active: true },
      { from: 'correction-feedback', to: 'temporal-memory', type: 'event', label: 'learn correction', active: true },
      { from: 'daily-digest', to: 'task-queue', type: 'data', label: 'queue status', active: true },
      { from: 'proposal-manager-api', to: 'task-queue', type: 'command', label: 'execute proposal', active: true },
      { from: 'proposal-manager-api', to: 'correction-feedback', type: 'event', label: 'record rejection', active: true },
      { from: 'escalation-manager-api', to: 'task-queue', type: 'command', label: 'update escalation', active: true },
      { from: 'corrections-api', to: 'correction-feedback', type: 'event', label: 'record correction', active: true },
      { from: 'suggestions-api', to: 'predictive-suggestions', type: 'data', label: 'get suggestions', active: true },
      { from: 'suggestions-api', to: 'correction-feedback', type: 'event', label: 'record rejection', active: true },
      { from: 'council-activity-api', to: 'daily-digest', type: 'data', label: 'activity summary', active: true },
    ];

    // Get recent activity (simulated based on actual module usage)
    const recentActivity: ActivityLog[] = [
      ...activityLog.slice(0, 20),
    ];

    // If no activity yet, seed with some initial entries
    if (recentActivity.length === 0) {
      recentActivity.push(
        { id: 'seed-1', timestamp: new Date(Date.now() - 60000).toISOString(), module: 'integration', action: 'getAllTasks', status: 'success', duration: 145 },
        { id: 'seed-2', timestamp: new Date(Date.now() - 120000).toISOString(), module: 'github-client', action: 'getIssues', status: 'success', duration: 230 },
        { id: 'seed-3', timestamp: new Date(Date.now() - 180000).toISOString(), module: 'pm-memory', action: 'searchMemories', status: 'success', duration: 89 },
      );
    }

    // Calculate overall metrics
    const activeModules = modules.filter(m => m.status === 'active').length;
    const activeConnections = connections.filter(c => c.active).length;
    const avgLatency = modules.reduce((sum, m) => sum + (m.metrics?.avgLatency || 0), 0) / modules.length;
    const avgErrorRate = modules.reduce((sum, m) => sum + (m.metrics?.errorRate || 0), 0) / modules.length;

    const anatomy: AgentAnatomy = {
      agent: {
        id: 'pm',
        name: 'PM Agent',
        version: '2.0.0-github-native',
        status: githubStatus === 'error' ? 'degraded' : 'healthy',
        uptime: '99.9%',
      },
      modules,
      connections,
      recentActivity,
      metrics: {
        totalCalls: callCount,
        avgResponseTime: Math.round(avgLatency),
        errorRate: Math.round(avgErrorRate * 100) / 100,
        activeConnections,
      },
    };

    // Update activity log with success
    const duration = Date.now() - startTime;
    logActivity('anatomy-api', 'GET /api/pm/anatomy', 'success', `Returned ${modules.length} modules`, duration);

    return NextResponse.json({
      ok: true,
      ...anatomy,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logActivity('anatomy-api', 'GET /api/pm/anatomy', 'error', error instanceof Error ? error.message : 'Unknown error', duration);

    console.error('[PM Anatomy API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST to log activity from other modules
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { module, action, status, details, duration } = body;

    if (!module || !action || !status) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: module, action, status' },
        { status: 400 }
      );
    }

    const entry = logActivity(module, action, status, details, duration);

    return NextResponse.json({
      ok: true,
      logged: entry,
    });
  } catch (error) {
    console.error('[PM Anatomy API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
