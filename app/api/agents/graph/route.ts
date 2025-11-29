import { NextResponse } from 'next/server';
import { getAllAgentsStatus } from '@/lib/agents/registry';
import { Agent, AgentStatus } from '@/app/agents/agents.mock';

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
}

export interface GraphEdge {
    from: string;
    to: string;
    type: 'data' | 'control' | 'bidirectional';
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
}

/**
 * Define the agent network topology
 * This maps the data flows and API connections between agents
 */
const AGENT_TOPOLOGY: Record<string, { connections: string[], bidirectional?: boolean }> = {
    // Memory agent - central hub for all agents
    'grok': {
        connections: ['legal', 'finance', 'pm', 'comms', 'ea', 'relationships', 'eeg'],
        bidirectional: true
    },
    // PM agent coordinates with most agents
    'pm': {
        connections: ['legal', 'finance', 'comms', 'ea', 'grok']
    },
    // Legal agent communicates with PM and Comms
    'legal': {
        connections: ['comms', 'pm']
    },
    // Finance agent reports to PM
    'finance': {
        connections: ['pm', 'comms']
    },
    // EA coordinates calendar and communications
    'ea': {
        connections: ['comms', 'pm', 'relationships']
    },
    // Comms receives from many agents
    'comms': {
        connections: ['relationships']
    },
    // Relationships agent works with EA and Comms
    'relationships': {
        connections: ['ea', 'comms']
    },
    // EEG feeds data to memory/research agent
    'eeg': {
        connections: ['grok']
    }
};

/**
 * Calculate node positions in a circular layout
 */
function calculateNodePositions(agents: Agent[]): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};

    // Put Grok (Memory/Research) in the center
    const centerAgent = agents.find(a => a.id === 'grok');
    if (centerAgent) {
        positions['grok'] = { x: 500, y: 300 };
    }

    // Arrange other agents in a circle around Grok
    const otherAgents = agents.filter(a => a.id !== 'grok');
    const radius = 250;
    const angleStep = (2 * Math.PI) / otherAgents.length;

    otherAgents.forEach((agent, index) => {
        const angle = index * angleStep - Math.PI / 2; // Start from top
        positions[agent.id] = {
            x: 500 + radius * Math.cos(angle),
            y: 300 + radius * Math.sin(angle)
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

            edges.push({
                from: fromId,
                to: toId,
                type: config.bidirectional ? 'bidirectional' : 'data',
                healthy,
                label: config.bidirectional ? 'sync' : undefined,
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
        const agents = await getAllAgentsStatus();
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
            link: agent.link
        }));

        const edges = buildEdges(agents);

        const graphData: AgentGraphData = {
            nodes,
            edges,
            timestamp: new Date().toISOString()
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
