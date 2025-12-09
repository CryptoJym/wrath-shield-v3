export type AgentStatus = 'green' | 'yellow' | 'red';
export type NodeType = 'agent' | 'integration' | 'llm' | 'memory' | 'cron';

export interface Agent {
  id: string;
  name: string;
  icon: string;
  status: AgentStatus;
  hp: number;
  mp: number;
  last_sync: string;
  open_items: number;
  capabilities: string[];
  link: string;
  avatar: string;
  nodeType?: NodeType;
  category?: string;
}

// Core agents that power the system
export const AGENTS_MOCK: Agent[] = [
  // ===== CORE AGENTS =====
  {
    id: "grok",
    name: "Central Intelligence (Grok)",
    icon: "brain",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Deep research", "Fact checking", "Synthesis", "Multi-agent orchestration", "Memory graph queries"],
    link: "/chat",
    avatar: "/assets/agents/grok.png",
    nodeType: "agent",
    category: "core"
  },
  {
    id: "legal",
    name: "Legal Advocate",
    icon: "gavel",
    status: "green",
    hp: 92,
    mp: 78,
    last_sync: new Date().toISOString(),
    open_items: 3,
    capabilities: ["MyCase ingest", "Gmail Zack/Destiny", "iMessage Destiny", "Strategic brief", "Draft reply", "Court deadline tracking"],
    link: "/legal/actions",
    avatar: "/assets/agents/legal.png",
    nodeType: "agent",
    category: "core"
  },
  {
    id: "finance",
    name: "Finance Analyst",
    icon: "coins",
    status: "green",
    hp: 85,
    mp: 80,
    last_sync: new Date().toISOString(),
    open_items: 5,
    capabilities: ["Plaid transaction ingest", "Auto-enrich categories", "Cycle reports", "Disposition editor", "Budget tracking"],
    link: "/finance",
    avatar: "/assets/agents/finance.png",
    nodeType: "agent",
    category: "core"
  },
  {
    id: "pm",
    name: "Project Maestro",
    icon: "clipboard-list",
    status: "green",
    hp: 88,
    mp: 90,
    last_sync: new Date().toISOString(),
    open_items: 2,
    capabilities: ["GitHub issue sync", "Project inventory", "Cron scheduler", "Sprint planning", "Dependency tracking"],
    link: "/pm",
    avatar: "/assets/agents/pm.png",
    nodeType: "agent",
    category: "core"
  },
  {
    id: "comms",
    name: "Comms Scout",
    icon: "mail",
    status: "green",
    hp: 82,
    mp: 75,
    last_sync: new Date().toISOString(),
    open_items: 4,
    capabilities: ["Gmail ingest", "Outlook sync", "iMessage bridge", "Classification", "Draft responses"],
    link: "/inbox",
    avatar: "/assets/agents/comms.png",
    nodeType: "agent",
    category: "core"
  },
  {
    id: "ea",
    name: "Executive Assistant",
    icon: "calendar",
    status: "green",
    hp: 95,
    mp: 85,
    last_sync: new Date().toISOString(),
    open_items: 1,
    capabilities: ["Google Calendar sync", "Travel booking", "Gatekeeping", "Meeting prep", "Daily briefings"],
    link: "/ea",
    avatar: "/assets/agents/ea.png",
    nodeType: "agent",
    category: "core"
  },
  {
    id: "relationships",
    name: "Relationship Manager",
    icon: "users",
    status: "yellow",
    hp: 75,
    mp: 60,
    last_sync: new Date().toISOString(),
    open_items: 6,
    capabilities: ["CRM sync", "Birthday reminders", "Outreach drafting", "Contact enrichment"],
    link: "/relationships",
    avatar: "/assets/agents/relationships.png",
    nodeType: "agent",
    category: "core"
  },
  {
    id: "eeg",
    name: "Bio-Data Analyst",
    icon: "activity",
    status: "green",
    hp: 88,
    mp: 82,
    last_sync: new Date().toISOString(),
    open_items: 2,
    capabilities: ["WHOOP data ingest", "Limitless lifelogs", "Sleep analysis", "Recovery tracking", "Focus optimization"],
    link: "/eeg",
    avatar: "/assets/agents/eeg.png",
    nodeType: "agent",
    category: "core"
  },

  // ===== SPECIALIZED AGENTS =====
  {
    id: "hyro",
    name: "Hyro (Parenting Co-Pilot)",
    icon: "baby",
    status: "green",
    hp: 90,
    mp: 85,
    last_sync: new Date().toISOString(),
    open_items: 1,
    capabilities: ["Zearn progress tracking", "School schedule sync", "Activity planning", "Milestone tracking"],
    link: "/hyro",
    avatar: "/assets/agents/hyro.png",
    nodeType: "agent",
    category: "specialized"
  },
  {
    id: "family",
    name: "Family Hub",
    icon: "home",
    status: "green",
    hp: 85,
    mp: 80,
    last_sync: new Date().toISOString(),
    open_items: 2,
    capabilities: ["Shared calendar", "Meal planning", "Chore tracking", "Family events"],
    link: "/family",
    avatar: "/assets/agents/family.png",
    nodeType: "agent",
    category: "specialized"
  },
  {
    id: "architect",
    name: "System Architect",
    icon: "cpu",
    status: "green",
    hp: 95,
    mp: 95,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Code generation", "Architecture planning", "API design", "Database schema", "System optimization"],
    link: "/architect",
    avatar: "/assets/agents/architect.png",
    nodeType: "agent",
    category: "specialized"
  },
  {
    id: "inbox",
    name: "Inbox Zero Agent",
    icon: "inbox",
    status: "green",
    hp: 78,
    mp: 70,
    last_sync: new Date().toISOString(),
    open_items: 12,
    capabilities: ["Email triage", "Priority sorting", "Auto-archive", "Follow-up reminders"],
    link: "/inbox",
    avatar: "/assets/agents/inbox.png",
    nodeType: "agent",
    category: "specialized"
  },
  {
    id: "personalization",
    name: "Personalization Engine",
    icon: "sliders",
    status: "green",
    hp: 92,
    mp: 88,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Bias detection", "Neutral stance generation", "Second agreement check", "Communication style adaptation"],
    link: "/settings",
    avatar: "/assets/agents/personalization.png",
    nodeType: "agent",
    category: "specialized"
  }
];

// External integrations that feed data to agents
export const INTEGRATIONS_MOCK: Agent[] = [
  // ===== DATA SOURCES =====
  {
    id: "whoop",
    name: "WHOOP",
    icon: "heart-pulse",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Sleep cycles", "Recovery scores", "Strain data", "HRV tracking"],
    link: "/api/whoop",
    avatar: "/assets/integrations/whoop.png",
    nodeType: "integration",
    category: "health"
  },
  {
    id: "limitless",
    name: "Limitless",
    icon: "mic",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Audio transcription", "Meeting notes", "Lifelogs", "Context capture"],
    link: "/api/limitless",
    avatar: "/assets/integrations/limitless.png",
    nodeType: "integration",
    category: "productivity"
  },
  {
    id: "plaid",
    name: "Plaid",
    icon: "credit-card",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Bank accounts", "Transaction sync", "Balance tracking", "Institution linking"],
    link: "/api/finance/plaid",
    avatar: "/assets/integrations/plaid.png",
    nodeType: "integration",
    category: "finance"
  },
  {
    id: "github",
    name: "GitHub",
    icon: "git-branch",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Issues", "Pull requests", "Repositories", "Actions", "Commits"],
    link: "/api/github",
    avatar: "/assets/integrations/github.png",
    nodeType: "integration",
    category: "development"
  },
  {
    id: "gmail",
    name: "Gmail",
    icon: "mail",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Email ingest", "Send emails", "Labels", "Thread management"],
    link: "/api/gmail",
    avatar: "/assets/integrations/gmail.png",
    nodeType: "integration",
    category: "communication"
  },
  {
    id: "outlook",
    name: "Outlook",
    icon: "mail",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Email sync", "Calendar events", "Contacts"],
    link: "/api/outlook",
    avatar: "/assets/integrations/outlook.png",
    nodeType: "integration",
    category: "communication"
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    icon: "calendar",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Event sync", "Availability check", "Meeting scheduling"],
    link: "/api/calendar",
    avatar: "/assets/integrations/google-calendar.png",
    nodeType: "integration",
    category: "productivity"
  },
  {
    id: "mycase",
    name: "MyCase",
    icon: "briefcase",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Case management", "Client portal", "Time tracking", "Billing"],
    link: "/api/legal/mycase",
    avatar: "/assets/integrations/mycase.png",
    nodeType: "integration",
    category: "legal"
  },
  {
    id: "zearn",
    name: "Zearn",
    icon: "graduation-cap",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Math progress", "Lesson completion", "Streaks", "Tower completions"],
    link: "/api/zearn",
    avatar: "/assets/integrations/zearn.png",
    nodeType: "integration",
    category: "education"
  },
  {
    id: "twilio",
    name: "Twilio",
    icon: "phone",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["SMS sending", "Voice calls", "WhatsApp", "Notifications"],
    link: "/api/twilio",
    avatar: "/assets/integrations/twilio.png",
    nodeType: "integration",
    category: "communication"
  }
];

// LLM providers
export const LLM_PROVIDERS_MOCK: Agent[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: "zap",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Claude 3.5", "GPT-4", "DeepSeek", "Multi-model routing"],
    link: "/api/llm",
    avatar: "/assets/llm/openrouter.png",
    nodeType: "llm",
    category: "ai"
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    icon: "server",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["DeepSeek R1", "Llama 3", "Local inference", "Privacy-first"],
    link: "/api/llm/ollama",
    avatar: "/assets/llm/ollama.png",
    nodeType: "llm",
    category: "ai"
  },
  {
    id: "openai",
    name: "OpenAI Direct",
    icon: "sparkles",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["GPT-4 Turbo", "Embeddings", "Function calling"],
    link: "/api/llm/openai",
    avatar: "/assets/llm/openai.png",
    nodeType: "llm",
    category: "ai"
  }
];

// Memory systems
export const MEMORY_SYSTEMS_MOCK: Agent[] = [
  {
    id: "zep",
    name: "Zep Cloud Memory",
    icon: "database",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Graph memory", "Fact extraction", "Entity relationships", "Session history"],
    link: "/api/memory",
    avatar: "/assets/memory/zep.png",
    nodeType: "memory",
    category: "storage"
  },
  {
    id: "sqlite",
    name: "SQLite (Local)",
    icon: "hard-drive",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Transaction store", "Cycle data", "Tokens", "Settings", "Fallback memory"],
    link: "/api/db",
    avatar: "/assets/memory/sqlite.png",
    nodeType: "memory",
    category: "storage"
  }
];

// Cron jobs
export const CRON_JOBS_MOCK: Agent[] = [
  {
    id: "cron-whoop",
    name: "WHOOP Sync",
    icon: "clock",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Every 6 hours", "Sleep/recovery/strain data"],
    link: "/api/cron/whoop",
    avatar: "/assets/cron/sync.png",
    nodeType: "cron",
    category: "automation"
  },
  {
    id: "cron-plaid",
    name: "Plaid Sync",
    icon: "clock",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Every 4 hours", "Transaction ingest"],
    link: "/api/cron/plaid",
    avatar: "/assets/cron/sync.png",
    nodeType: "cron",
    category: "automation"
  },
  {
    id: "cron-limitless",
    name: "Limitless Sync",
    icon: "clock",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Every hour", "Lifelog ingest"],
    link: "/api/cron/limitless",
    avatar: "/assets/cron/sync.png",
    nodeType: "cron",
    category: "automation"
  },
  {
    id: "cron-zearn",
    name: "Zearn Sync",
    icon: "clock",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: new Date().toISOString(),
    open_items: 0,
    capabilities: ["Daily 6PM", "Math progress updates"],
    link: "/api/cron/zearn",
    avatar: "/assets/cron/sync.png",
    nodeType: "cron",
    category: "automation"
  }
];

// Combined export for all nodes
export const ALL_NODES_MOCK: Agent[] = [
  ...AGENTS_MOCK,
  ...INTEGRATIONS_MOCK,
  ...LLM_PROVIDERS_MOCK,
  ...MEMORY_SYSTEMS_MOCK,
  ...CRON_JOBS_MOCK
];
