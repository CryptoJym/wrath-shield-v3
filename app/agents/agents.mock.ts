export type AgentStatus = 'green' | 'yellow' | 'red';

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
}

export const AGENTS_MOCK: Agent[] = [
  {
    id: "legal",
    name: "Legal Advocate",
    icon: "gavel",
    status: "green",
    hp: 92,
    mp: 78,
    last_sync: "2025-11-24T19:00:00Z",
    open_items: 3,
    capabilities: ["MyCase ingest", "Gmail Zack/Destiny", "iMessage Destiny", "Strategic brief", "Draft reply"],
    link: "/legal/actions",
    avatar: "/assets/agents/legal.png"
  },
  {
    id: "finance",
    name: "Finance Analyst",
    icon: "coins",
    status: "yellow",
    hp: 80,
    mp: 65,
    last_sync: "2025-11-24T18:00:00Z",
    open_items: 5,
    capabilities: ["Transaction ingest", "Auto-enrich", "Cycle reports", "Disposition editor"],
    link: "/finance",
    avatar: "/assets/agents/finance.png"
  },
  {
    id: "pm",
    name: "Project Maestro",
    icon: "clipboard-list",
    status: "green",
    hp: 88,
    mp: 90,
    last_sync: "2025-11-24T17:30:00Z",
    open_items: 2,
    capabilities: ["Motion↔GitHub sync", "Project inventory", "Cron scheduler"],
    link: "/pm",
    avatar: "/assets/agents/pm.png"
  },
  {
    id: "comms",
    name: "Comms Scout",
    icon: "mail",
    status: "red",
    hp: 60,
    mp: 50,
    last_sync: "2025-11-24T10:00:00Z",
    open_items: 4,
    capabilities: ["Email/iMessage ingest", "Classification", "Lifelogs"],
    link: "/inbox",
    avatar: "/assets/agents/comms.png"
  },
  {
    id: "ea",
    name: "Executive Assistant",
    icon: "calendar",
    status: "green",
    hp: 95,
    mp: 85,
    last_sync: "2025-11-24T20:15:00Z",
    open_items: 1,
    capabilities: ["Calendar management", "Travel booking", "Gatekeeping"],
    link: "/ea",
    avatar: "/assets/agents/ea.png"
  },
  {
    id: "relationships",
    name: "Relationship Manager",
    icon: "users",
    status: "yellow",
    hp: 75,
    mp: 60,
    last_sync: "2025-11-24T16:45:00Z",
    open_items: 6,
    capabilities: ["CRM sync", "Birthday reminders", "Outreach drafting"],
    link: "/relationships",
    avatar: "/assets/agents/relationships.png"
  },
  {
    id: "grok",
    name: "Research Agent (Grok)",
    icon: "brain",
    status: "green",
    hp: 100,
    mp: 100,
    last_sync: "2025-11-24T21:00:00Z",
    open_items: 0,
    capabilities: ["Deep research", "Fact checking", "Synthesis"],
    link: "/chat",
    avatar: "/assets/agents/grok.png"
  },
  {
    id: "eeg",
    name: "Bio-Data Analyst",
    icon: "activity",
    status: "red",
    hp: 45,
    mp: 30,
    last_sync: "2025-11-23T09:00:00Z",
    open_items: 8,
    capabilities: ["Brainwave analysis", "Focus tracking", "Flow state optimization"],
    link: "/eeg",
    avatar: "/assets/agents/eeg.png"
  }
];
