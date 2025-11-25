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
    link: "/legal/actions"
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
    link: "/finance"
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
    link: "/pm"
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
    link: "/inbox"
  }
];
