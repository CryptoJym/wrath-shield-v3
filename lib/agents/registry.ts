import { getDatabase } from '../db/Database';
import { getRelationshipDb } from '../relationshipDb';
import { Agent, AgentStatus } from '../../app/agents/agents.mock';
import { getAgents, type AgentDefinition } from '../life-os-config';
import { agentInvoker } from './AgentInvoker';

// Re-export types
export type { Agent, AgentStatus };

/**
 * Map Life OS agent IDs to registry IDs
 */
const LIFE_OS_TO_REGISTRY: Record<string, string> = {
  'agent.orchestrator': 'orchestrator',
  'agent.legal': 'legal',
  'agent.finance': 'finance',
  'agent.pm': 'pm',
  'agent.comms': 'comms',
  'agent.health': 'health',
  'agent.coaching': 'coaching',
  'agent.hyro': 'hyro',
  'agent.grok': 'grok',
};

/**
 * Real Agent Registry
 * Aggregates status from various DB tables and external APIs.
 * Now loads agent definitions from Life OS config.
 */

export async function getAllAgentsStatus(): Promise<Agent[]> {
    const agents: Agent[] = [];

    // Load agents from Life OS config
    const lifeOsAgents = getAgents();

    // Get recent activity from AgentInvoker for status
    const recentActivity = agentInvoker.getRecentActivity(100);
    const activityByAgent: Record<string, typeof recentActivity> = {};
    for (const activity of recentActivity) {
      if (!activityByAgent[activity.agentId]) {
        activityByAgent[activity.agentId] = [];
      }
      activityByAgent[activity.agentId].push(activity);
    }

    // Create status for each Life OS agent
    for (const agentDef of lifeOsAgents.agents) {
      const registryId = LIFE_OS_TO_REGISTRY[agentDef.id];
      if (!registryId) continue;

      const agentActivity = activityByAgent[agentDef.id] || [];
      const lastActivity = agentActivity[0];

      // Calculate HP based on recent execution success
      const successCount = agentActivity.filter(a => a.wasExecuted).length;
      const hp = agentActivity.length > 0 ? Math.round((successCount / agentActivity.length) * 100) : 80;

      // Calculate MP based on token usage efficiency
      const totalTokens = agentActivity.reduce((sum, a) => sum + a.tokensUsed, 0);
      const avgTokens = agentActivity.length > 0 ? totalTokens / agentActivity.length : 0;
      const mp = Math.max(0, 100 - Math.round(avgTokens / 50)); // Lower tokens = higher MP

      agents.push({
        id: registryId,
        name: agentDef.name,
        icon: getAgentIcon(registryId),
        status: calculateAgentStatus(agentActivity),
        hp,
        mp,
        last_sync: lastActivity ? new Date(lastActivity.timestamp).toISOString() : new Date().toISOString(),
        open_items: agentActivity.filter(a => !a.wasExecuted).length,
        capabilities: extractCapabilities(agentDef),
        link: `/${registryId}`,
        avatar: `/assets/agents/${registryId}.png`,
      });
    }

    // Add any legacy agents not in Life OS config
    if (!agents.find(a => a.id === 'legal')) agents.push(await getLegalStatus());
    if (!agents.find(a => a.id === 'finance')) agents.push(await getFinanceStatus());
    if (!agents.find(a => a.id === 'pm')) agents.push(await getPMStatus());
    if (!agents.find(a => a.id === 'comms')) agents.push(await getCommsStatus());
    if (!agents.find(a => a.id === 'ea')) agents.push(await getEAStatus());
    if (!agents.find(a => a.id === 'relationships')) agents.push(await getRelationshipsStatus());
    if (!agents.find(a => a.id === 'grok')) agents.push(await getGrokStatus());
    if (!agents.find(a => a.id === 'eeg')) agents.push(await getEEGStatus());
    if (!agents.find(a => a.id === 'hyro')) agents.push(await getHyroStatus());
    if (!agents.find(a => a.id === 'scheduler')) agents.push(await getSchedulerStatus());
    if (!agents.find(a => a.id === 'saturation')) agents.push(await getSaturationStatus());

    return agents;
}

/**
 * Calculate agent status from recent activity
 */
function calculateAgentStatus(activity: any[]): AgentStatus {
  if (activity.length === 0) return 'yellow';

  const recentActivity = activity.slice(0, 10);
  const executedCount = recentActivity.filter(a => a.wasExecuted).length;
  const criticalCount = recentActivity.filter(a => a.escalationLevel === 'CRITICAL').length;

  if (criticalCount > 0) return 'red';
  if (executedCount / recentActivity.length < 0.5) return 'yellow';
  return 'green';
}

/**
 * Get icon for agent
 */
function getAgentIcon(agentId: string): string {
  const icons: Record<string, string> = {
    orchestrator: 'brain',
    legal: 'gavel',
    finance: 'coins',
    pm: 'clipboard-list',
    comms: 'mail',
    health: 'heart',
    coaching: 'target',
    hyro: 'brain',
    grok: 'brain',
  };
  return icons[agentId] || 'bot';
}

/**
 * Extract capabilities from agent definition
 */
function extractCapabilities(agent: AgentDefinition): string[] {
  const capabilities: string[] = [];

  // Add tool-based capabilities
  for (const tool of agent.tools) {
    capabilities.push(`${tool} integration`);
  }

  // Add domain-based capabilities
  if (agent.domains.includes('*')) {
    capabilities.push('Cross-domain orchestration');
  } else {
    for (const domain of agent.domains.slice(0, 2)) {
      capabilities.push(`${domain} domain handling`);
    }
  }

  return capabilities;
}

async function getSchedulerStatus(): Promise<Agent> {
    return {
        id: "scheduler",
        name: "Scheduler",
        icon: "calendar", // Fallback
        status: "red", // Offline/Construction
        hp: 0,
        mp: 0,
        last_sync: "",
        open_items: 0,
        // Verified: Scaffolding only - not implemented
        capabilities: ["[Not Implemented] Cron management", "[Not Implemented] Task automation"],
        link: "#",
        avatar: "/assets/agents/scheduler_placeholder.png" // Placeholder
    };
}

async function getSaturationStatus(): Promise<Agent> {
    return {
        id: "saturation",
        name: "Saturation Learner",
        icon: "brain", // Fallback
        status: "red", // Offline/Planned
        hp: 0,
        mp: 0,
        last_sync: "",
        open_items: 0,
        // Verified: Scaffolding only - not implemented
        capabilities: ["[Not Implemented] Knowledge intake", "[Not Implemented] Learning tracking"],
        link: "#",
        avatar: "/assets/agents/saturation_placeholder.png" // Placeholder
    };
}

// --- Individual Status Fetchers ---

async function getLegalStatus(): Promise<Agent> {
    // Check 'legal_actions' or 'legal_cases' if they exist.
    // For now, we'll check 'agentic_actions' with type 'legal' or similar if specific table missing.
    // Fallback to mock-like behavior if table not found, but try to read DB.
    let openItems = 0;
    let lastSync = new Date().toISOString();
    let status: AgentStatus = 'green';

    try {
        const db = getDatabase().getRawDb();
        // Hypothetical table check
        const row = db.prepare("SELECT COUNT(*) as count FROM agentic_actions WHERE domain = 'legal' AND status IN ('proposed', 'queued')").get() as any;
        if (row) openItems = row.count;

        const lastRow = db.prepare("SELECT created_at FROM agentic_actions WHERE domain = 'legal' ORDER BY created_at DESC LIMIT 1").get() as any;
        if (lastRow) lastSync = new Date(lastRow.created_at).toISOString();
    } catch (e) {
        // Table might not exist yet
        status = 'yellow';
    }

    return {
        id: "legal",
        name: "Legal Advocate",
        icon: "gavel",
        status: openItems > 5 ? 'red' : (openItems > 0 ? 'yellow' : 'green'),
        hp: 92, // TODO: Calculate from success rate
        mp: 78,
        last_sync: lastSync,
        open_items: openItems,
        // Verified capabilities from codebase audit
        capabilities: ["MyCase data ingest", "Gmail scrape (Zack/Destiny)", "Strategic brief generation", "LLM-assisted reply drafting"],
        link: "/legal/actions",
        avatar: "/assets/agents/legal.png"
    };
}

async function getFinanceStatus(): Promise<Agent> {
    let openItems = 0;
    let lastSync = new Date().toISOString();

    try {
        const db = getDatabase().getRawDb();
        // Check finance_transactions for 'pending_classification'
        // Assuming table 'finance_transactions' exists based on file structure
        try {
            const row = db.prepare("SELECT COUNT(*) as count FROM finance_transactions WHERE status = 'pending'").get() as any;
            if (row) openItems = row.count;

            const lastRow = db.prepare("SELECT date FROM finance_transactions ORDER BY date DESC LIMIT 1").get() as any;
            if (lastRow) lastSync = new Date(lastRow.date).toISOString();
        } catch {
            // Fallback if table doesn't exist
        }
    } catch (e) { }

    return {
        id: "finance",
        name: "Finance Analyst",
        icon: "coins",
        status: openItems > 10 ? 'red' : (openItems > 0 ? 'yellow' : 'green'),
        hp: 80,
        mp: 65,
        last_sync: lastSync,
        open_items: openItems,
        // Verified capabilities from codebase audit (no cycle reports - that's not implemented)
        capabilities: ["Transaction ingest (Plaid)", "Context enrichment", "Classification requests"],
        link: "/finance",
        avatar: "/assets/agents/finance.png"
    };
}

async function getPMStatus(): Promise<Agent> {
    // Project Maestro - check 'events' or 'tasks'
    return {
        id: "pm",
        name: "Project Maestro",
        icon: "clipboard-list",
        status: "green",
        hp: 88,
        mp: 90,
        last_sync: new Date().toISOString(),
        open_items: 2,
        // Verified: Motion↔GitHub sync exists, project inventory partial, cron scheduler partial
        capabilities: ["Motion↔GitHub sync", "Project tracking", "Task orchestration"],
        link: "/pm",
        avatar: "/assets/agents/pm.png"
    };
}

async function getCommsStatus(): Promise<Agent> {
    // Comms - check 'gmail_messages' or similar
    return {
        id: "comms",
        name: "Comms Scout",
        icon: "mail",
        status: "red",
        hp: 60,
        mp: 50,
        last_sync: new Date().toISOString(),
        open_items: 4,
        capabilities: ["Email/iMessage ingest", "Classification", "Lifelogs"],
        link: "/inbox",
        avatar: "/assets/agents/comms.png"
    };
}

async function getEAStatus(): Promise<Agent> {
    // Audit: Calendar/Travel/Gatekeeping are NOT implemented - only stubs exist
    return {
        id: "ea",
        name: "Executive Assistant",
        icon: "calendar",
        status: "yellow", // Changed to yellow - capabilities not fully implemented
        hp: 30,
        mp: 20,
        last_sync: new Date().toISOString(),
        open_items: 1,
        // Verified: These are PLANNED features, not implemented
        capabilities: ["[Planned] Calendar management", "[Planned] Meeting scheduling"],
        link: "/ea",
        avatar: "/assets/agents/ea.png"
    };
}

async function getRelationshipsStatus(): Promise<Agent> {
    let openItems = 0;
    let lastSync = new Date().toISOString();

    try {
        const db = getRelationshipDb();
        if (!db) {
            return {
                id: "relationships",
                name: "Relationship Manager",
                icon: "users",
                status: 'yellow',
                hp: 70,
                mp: 60,
                last_sync: lastSync,
                open_items: openItems,
                // Verified: Contact DB exists, follow-up suggestions exist, no CRM sync or birthday reminders
                capabilities: ["Contact database", "Follow-up suggestions", "Relationship summaries"],
                link: "/relationships",
                avatar: "/assets/agents/relationships.png"
            };
        }
        // Check contacts that need follow up
        const row = db.prepare("SELECT COUNT(*) as count FROM relationship_summaries WHERE suggested_follow_up IS NOT NULL").get() as any;
        if (row) openItems = row.count;

        const lastRow = db.prepare("SELECT last_ts FROM contacts ORDER BY last_ts DESC LIMIT 1").get() as any;
        if (lastRow && lastRow.last_ts) lastSync = new Date(lastRow.last_ts * 1000).toISOString();
    } catch (e) {
        console.error("RelDB error", e);
    }

    return {
        id: "relationships",
        name: "Relationship Manager",
        icon: "users",
        status: openItems > 5 ? 'yellow' : 'green',
        hp: 75,
        mp: 60,
        last_sync: lastSync,
        open_items: openItems,
        // Verified: Contact DB exists, follow-up suggestions exist, no CRM sync or birthday reminders
        capabilities: ["Contact database", "Follow-up suggestions", "Relationship summaries"],
        link: "/relationships",
        avatar: "/assets/agents/relationships.png"
    };
}

async function getGrokStatus(): Promise<Agent> {
    // Check agentic_actions
    let openItems = 0;
    try {
        const db = getDatabase().getRawDb();
        const row = db.prepare("SELECT COUNT(*) as count FROM agentic_actions WHERE status IN ('proposed', 'queued')").get() as any;
        if (row) openItems = row.count;
    } catch { }

    return {
        id: "grok",
        name: "Research Agent (Grok)",
        icon: "brain",
        status: "green",
        hp: 100,
        mp: 100,
        last_sync: new Date().toISOString(),
        open_items: openItems,
        // Verified: Deep research via Grok API, no dedicated fact-checking or synthesis modules
        capabilities: ["Deep research (Grok API)", "Web search", "Agentic action queue"],
        link: "/chat",
        avatar: "/assets/agents/grok.png"
    };
}

async function getEEGStatus(): Promise<Agent> {
    // Check EEG API
    let connected = false;
    let tokens = 0;
    try {
        const base = process.env.AGENTIC_GROK_URL || 'http://localhost:8001';
        const res = await fetch(`${base}/api/db/status`, { next: { revalidate: 60 } });
        if (res.ok) {
            const data = await res.json();
            connected = !!data?.eeg_tokens?.has_data;
            tokens = data?.eeg_tokens?.row_count || 0;
        }
    } catch { }

    return {
        id: "eeg",
        name: "Bio-Data Analyst",
        icon: "activity",
        status: connected ? 'green' : 'red',
        hp: connected ? 100 : 0,
        mp: Math.min(100, Math.floor(tokens / 100)),
        last_sync: new Date().toISOString(),
        open_items: connected ? 0 : 1, // 1 open item if disconnected
        // Verified: EEG token storage exists, basic brainwave data ingest, no focus/flow tracking implemented
        capabilities: ["EEG data ingest", "Brainwave token storage", "API status monitoring"],
        link: "/eeg",
        avatar: "/assets/agents/eeg.png"
    };
}

async function getHyroStatus(): Promise<Agent> {
    // Check Hyro API
    let status: AgentStatus = 'yellow';
    let hp = 0;
    let mp = 0;
    let openItems = 0;
    let lastSync = new Date().toISOString();

    try {
        const res = await fetch('http://localhost:3000/api/hyro/status', { next: { revalidate: 60 } });
        if (res.ok) {
            const data = await res.json();
            hp = data.health_score || 0;
            mp = Math.min(100, Math.floor((data.items_completed_today / 5) * 100)); // MP based on daily progress
            openItems = data.pending_items || 0;
            lastSync = data.last_sync || new Date().toISOString();

            // Status based on health score
            if (hp >= 75) status = 'green';
            else if (hp >= 40) status = 'yellow';
            else status = 'red';
        }
    } catch (error) {
        // Hyro not running or error - set to red
        status = 'red';
        hp = 0;
        mp = 0;
    }

    return {
        id: "hyro",
        name: "Hyro Education",
        icon: "brain",
        status,
        hp,
        mp,
        last_sync: lastSync,
        open_items: openItems,
        capabilities: ["Daily learning recommendations", "Source crawling", "Progress tracking", "Study scheduling"],
        link: "/hyro",
        avatar: "/assets/agents/hyro.png"
    };
}
