import { NextResponse } from 'next/server';
import { getAllAgentsStatus } from '@/lib/agents/registry';
import {
    Agent,
    AgentStatus,
    NodeType,
    AGENTS_MOCK,
    INTEGRATIONS_MOCK,
    LLM_PROVIDERS_MOCK,
    MEMORY_SYSTEMS_MOCK,
    CRON_JOBS_MOCK,
    ALL_NODES_MOCK
} from '@/app/agents/agents.mock';

export const revalidate = 30; // Cache for 30 seconds

export interface GraphNode {
    id: string;
    name: string;
    type: string;
    status: AgentStatus;
    lastSeen: string;
    hp: number;
    mp: number;
    openItems: number;
    position: { x: number; y: number };
    capabilities?: string[];
    link?: string;
    nodeType?: NodeType;
    category?: string;
}

export interface GraphEdge {
    from: string;
    to: string;
    type: 'data' | 'control' | 'bidirectional' | 'cron' | 'llm' | 'memory';
    healthy: boolean;
    label?: string;
    lastRun?: string;
    errorLog?: string;
    bandwidth?: number;
    volume?: number;
}

export interface AgentGraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    timestamp: string;
    stats: {
        totalAgents: number;
        totalIntegrations: number;
        totalConnections: number;
        healthyConnections: number;
        activeDataFlows: number;
    };
}

/**
 * Complete system topology - maps ALL data flows between:
 * - Core agents (inter-agent communication)
 * - Integrations → Agents (data ingestion)
 * - Agents → LLMs (inference requests)
 * - Agents → Memory (persistence)
 * - Crons → Integrations (scheduled syncs)
 */
const AGENT_TOPOLOGY: Record<string, { connections: string[], type?: GraphEdge['type'], bidirectional?: boolean }> = {
    // ===== CORE AGENT CONNECTIONS =====
    // Central Intelligence (Grok) - orchestrates all agents
    'grok': {
        connections: ['legal', 'finance', 'pm', 'comms', 'ea', 'relationships', 'eeg', 'hyro', 'family', 'architect', 'inbox', 'personalization'],
        bidirectional: true
    },
    // PM agent coordinates projects across agents
    'pm': {
        connections: ['legal', 'finance', 'comms', 'ea', 'architect']
    },
    // Legal agent for case management
    'legal': {
        connections: ['comms', 'pm']
    },
    // Finance agent for transaction processing
    'finance': {
        connections: ['pm', 'comms']
    },
    // EA coordinates calendar and scheduling
    'ea': {
        connections: ['comms', 'pm', 'relationships', 'family']
    },
    // Comms handles all messaging
    'comms': {
        connections: ['relationships', 'inbox']
    },
    // Relationships manages contacts
    'relationships': {
        connections: ['ea', 'comms']
    },
    // EEG/Bio-data analysis
    'eeg': {
        connections: ['grok']
    },
    // Hyro - parenting co-pilot
    'hyro': {
        connections: ['family', 'ea', 'grok']
    },
    // Family hub
    'family': {
        connections: ['hyro', 'ea', 'grok']
    },
    // Architect - code generation
    'architect': {
        connections: ['pm', 'grok']
    },
    // Inbox zero
    'inbox': {
        connections: ['comms', 'grok']
    },
    // Personalization engine
    'personalization': {
        connections: ['grok']
    },

    // ===== INTEGRATION → AGENT DATA FLOWS =====
    // Health data flows
    'whoop': {
        connections: ['eeg'],
        type: 'data'
    },
    'limitless': {
        connections: ['eeg', 'comms'],
        type: 'data'
    },
    // Finance data flows
    'plaid': {
        connections: ['finance'],
        type: 'data'
    },
    // Development data flows
    'github': {
        connections: ['pm', 'architect'],
        type: 'data'
    },
    // Communication data flows
    'gmail': {
        connections: ['comms', 'inbox', 'legal'],
        type: 'data'
    },
    'outlook': {
        connections: ['comms', 'inbox'],
        type: 'data'
    },
    // Calendar data flows
    'google-calendar': {
        connections: ['ea', 'family'],
        type: 'data'
    },
    // Legal data flows
    'mycase': {
        connections: ['legal'],
        type: 'data'
    },
    // Education data flows
    'zearn': {
        connections: ['hyro'],
        type: 'data'
    },
    // Messaging data flows
    'twilio': {
        connections: ['comms', 'legal'],
        type: 'data'
    },

    // ===== LLM PROVIDER CONNECTIONS =====
    'openrouter': {
        connections: ['grok', 'legal', 'finance', 'pm', 'architect', 'personalization'],
        type: 'llm'
    },
    'ollama': {
        connections: ['grok', 'architect'],
        type: 'llm'
    },
    'openai': {
        connections: ['grok', 'personalization'],
        type: 'llm'
    },

    // ===== MEMORY SYSTEM CONNECTIONS =====
    'zep': {
        connections: ['grok', 'legal', 'relationships', 'personalization'],
        type: 'memory',
        bidirectional: true
    },
    'sqlite': {
        connections: ['finance', 'eeg', 'comms', 'pm'],
        type: 'memory',
        bidirectional: true
    },

    // ===== CRON JOB TRIGGERS =====
    'cron-whoop': {
        connections: ['whoop'],
        type: 'cron'
    },
    'cron-plaid': {
        connections: ['plaid'],
        type: 'cron'
    },
    'cron-limitless': {
        connections: ['limitless'],
        type: 'cron'
    },
    'cron-zearn': {
        connections: ['zearn'],
        type: 'cron'
    }
};

/**
 * Calculate node positions in a layered radial layout
 * Organized by node type: Core at center, agents in inner ring,
 * integrations in outer ring, LLMs/Memory/Crons at edges
 */
function calculateNodePositions(agents: Agent[]): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};
    const centerX = 600;
    const centerY = 400;

    // Layer 0: Central Intelligence (Grok) at center
    positions['grok'] = { x: centerX, y: centerY };

    // Layer 1: Core agents in inner ring (radius 180)
    const coreAgents = agents.filter(a =>
        a.nodeType === 'agent' && a.category === 'core' && a.id !== 'grok'
    );
    const coreRadius = 180;
    coreAgents.forEach((agent, index) => {
        const angle = (index / coreAgents.length) * 2 * Math.PI - Math.PI / 2;
        positions[agent.id] = {
            x: centerX + coreRadius * Math.cos(angle),
            y: centerY + coreRadius * Math.sin(angle)
        };
    });

    // Layer 2: Specialized agents in second ring (radius 300)
    const specializedAgents = agents.filter(a =>
        a.nodeType === 'agent' && a.category === 'specialized'
    );
    const specRadius = 300;
    specializedAgents.forEach((agent, index) => {
        const angle = (index / specializedAgents.length) * 2 * Math.PI - Math.PI / 4;
        positions[agent.id] = {
            x: centerX + specRadius * Math.cos(angle),
            y: centerY + specRadius * Math.sin(angle)
        };
    });

    // Layer 3: Integrations on left side (x: 50-150)
    const integrations = agents.filter(a => a.nodeType === 'integration');
    const intStartY = 80;
    const intSpacing = 70;
    integrations.forEach((agent, index) => {
        positions[agent.id] = {
            x: 80 + (index % 2) * 80,
            y: intStartY + Math.floor(index / 2) * intSpacing
        };
    });

    // Layer 4: LLM providers on right side (x: 1050-1150)
    const llms = agents.filter(a => a.nodeType === 'llm');
    llms.forEach((agent, index) => {
        positions[agent.id] = {
            x: 1100,
            y: 150 + index * 120
        };
    });

    // Layer 5: Memory systems on bottom right
    const memory = agents.filter(a => a.nodeType === 'memory');
    memory.forEach((agent, index) => {
        positions[agent.id] = {
            x: 1000 + index * 120,
            y: 650
        };
    });

    // Layer 6: Cron jobs on top
    const crons = agents.filter(a => a.nodeType === 'cron');
    const cronStartX = 300;
    const cronSpacing = 150;
    crons.forEach((agent, index) => {
        positions[agent.id] = {
            x: cronStartX + index * cronSpacing,
            y: 50
        };
    });

    return positions;
}

/**
 * Build graph edges based on topology and agent health
 */
function buildEdges(agents: Agent[]): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const agentIds = new Set(agents.map(a => a.id));

    Object.entries(AGENT_TOPOLOGY).forEach(([fromId, config]) => {
        if (!agentIds.has(fromId)) return;

        const fromAgent = agents.find(a => a.id === fromId);
        if (!fromAgent) return;

        config.connections.forEach(toId => {
            if (!agentIds.has(toId)) return;

            const toAgent = agents.find(a => a.id === toId);
            if (!toAgent) return;

            // Edge is healthy if both agents are green or yellow
            const healthy =
                (fromAgent.status === 'green' || fromAgent.status === 'yellow') &&
                (toAgent.status === 'green' || toAgent.status === 'yellow');

            // Generate telemetry data
            const lastRun = new Date(Math.max(
                new Date(fromAgent.last_sync).getTime(),
                new Date(toAgent.last_sync).getTime()
            )).toISOString();

            // Generate error log for unhealthy connections
            const errorLog = !healthy
                ? `Connection degraded: ${fromAgent.status === 'red' ? `${fromAgent.name} is offline` : ''} ${toAgent.status === 'red' ? `${toAgent.name} is offline` : ''}`.trim()
                : undefined;

            // Calculate bandwidth/volume metrics based on agent activity
            const bandwidth = Math.floor(Math.random() * 1000 + 100); // Mock data: 100-1100 KB/s
            const volume = (fromAgent.open_items + toAgent.open_items) * 10; // Items * 10 = approx volume

            // Determine edge type based on topology config or node types
            let edgeType: GraphEdge['type'] = config.type || 'data';
            if (!config.type) {
                if (config.bidirectional) {
                    edgeType = 'bidirectional';
                }
            }

            // Generate contextual labels
            let label: string | undefined;
            if (config.bidirectional) {
                label = 'sync';
            } else if (config.type === 'cron') {
                label = 'trigger';
            } else if (config.type === 'llm') {
                label = 'inference';
            } else if (config.type === 'memory') {
                label = 'persist';
            }

            edges.push({
                from: fromId,
                to: toId,
                type: edgeType,
                healthy,
                label,
                lastRun,
                errorLog,
                bandwidth,
                volume
            });
        });
    });

    return edges;
}

export async function GET() {
    try {
        // Get live agent status from registry, fall back to mock data
        let agents: Agent[];
        try {
            agents = await getAllAgentsStatus();
            // Merge with full node list to include integrations, LLMs, memory, crons
            const liveAgentIds = new Set(agents.map(a => a.id));
            const additionalNodes = ALL_NODES_MOCK.filter(n => !liveAgentIds.has(n.id));
            agents = [...agents, ...additionalNodes];
        } catch {
            // Use complete mock data if registry fails
            agents = ALL_NODES_MOCK;
        }

        const positions = calculateNodePositions(agents);

        const nodes: GraphNode[] = agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            type: agent.icon,
            status: agent.status,
            lastSeen: agent.last_sync,
            hp: agent.hp,
            mp: agent.mp,
            openItems: agent.open_items,
            position: positions[agent.id] || { x: 0, y: 0 },
            capabilities: agent.capabilities,
            link: agent.link,
            nodeType: agent.nodeType,
            category: agent.category
        }));

        const edges = buildEdges(agents);

        // Calculate stats
        const healthyEdges = edges.filter(e => e.healthy);
        const stats = {
            totalAgents: agents.filter(a => a.nodeType === 'agent').length,
            totalIntegrations: agents.filter(a => a.nodeType === 'integration').length,
            totalConnections: edges.length,
            healthyConnections: healthyEdges.length,
            activeDataFlows: edges.filter(e => e.type === 'data' && e.healthy).length
        };

        const graphData: AgentGraphData = {
            nodes,
            edges,
            timestamp: new Date().toISOString(),
            stats
        };

        return NextResponse.json(graphData);
    } catch (error) {
        console.error('Failed to fetch agent graph:', error);
        return NextResponse.json(
            { error: 'Failed to fetch agent graph' },
            { status: 500 }
        );
    }
}
