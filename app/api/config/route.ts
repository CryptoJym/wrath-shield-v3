/**
 * Config API Endpoint
 *
 * Serves Life OS configuration for frontend visualization
 * GET /api/config - Returns all config (charter, domains, agents, mappings)
 * GET /api/config?type=agents - Returns specific config type
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getLifeCharter,
  getDomains,
  getAgents,
  getMappings,
  getAgent,
  getDomain,
  getMappingForDomain,
  getAgentsForDomain,
} from '@/lib/life-os-config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    // Return specific config type
    if (type === 'charter') {
      return NextResponse.json(getLifeCharter());
    }

    if (type === 'domains') {
      if (id) {
        const domain = getDomain(id);
        if (!domain) {
          return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
        }
        // Enrich with related data
        const agents = getAgentsForDomain(id);
        const mapping = getMappingForDomain(id);
        return NextResponse.json({ domain, agents, mapping });
      }
      return NextResponse.json(getDomains());
    }

    if (type === 'agents') {
      if (id) {
        const agent = getAgent(id);
        if (!agent) {
          return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }
        return NextResponse.json(agent);
      }
      return NextResponse.json(getAgents());
    }

    if (type === 'mappings') {
      return NextResponse.json(getMappings());
    }

    // Return full config bundle for graph visualization
    const charter = getLifeCharter();
    const domains = getDomains();
    const agents = getAgents();
    const mappings = getMappings();

    // Build graph-friendly structure
    const graphData = buildGraphData(domains, agents, mappings);

    return NextResponse.json({
      charter,
      domains,
      agents,
      mappings,
      graph: graphData,
    });
  } catch (error) {
    console.error('[Config API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Build graph-compatible data structure for visualization
 */
function buildGraphData(
  domainsConfig: ReturnType<typeof getDomains>,
  agentsConfig: ReturnType<typeof getAgents>,
  mappingsConfig: ReturnType<typeof getMappings>
) {
  const nodes: any[] = [];
  const edges: any[] = [];

  // Add domain nodes
  for (const domain of domainsConfig.domains) {
    nodes.push({
      id: `domain-${domain.id}`,
      type: 'domain',
      label: domain.name,
      data: {
        ...domain,
        nodeType: 'domain',
      },
    });
  }

  // Add agent nodes
  for (const agent of agentsConfig.agents) {
    nodes.push({
      id: agent.id,
      type: 'agent',
      label: agent.name,
      data: {
        ...agent,
        nodeType: 'agent',
      },
    });

    // Add edges from agents to domains they handle
    for (const domainId of agent.domains) {
      if (domainId === '*') {
        // Connect to all domains
        for (const domain of domainsConfig.domains) {
          edges.push({
            id: `${agent.id}-to-domain-${domain.id}`,
            source: agent.id,
            target: `domain-${domain.id}`,
            type: 'handles',
            label: 'handles',
          });
        }
      } else {
        edges.push({
          id: `${agent.id}-to-domain-${domainId}`,
          source: agent.id,
          target: `domain-${domainId}`,
          type: 'handles',
          label: 'handles',
        });
      }
    }
  }

  // Add Motion workspace nodes
  for (const workspace of mappingsConfig.motion.workspaces) {
    nodes.push({
      id: `motion-${workspace.id}`,
      type: 'motion',
      label: workspace.name,
      data: {
        ...workspace,
        nodeType: 'motion',
      },
    });
  }

  // Add GitHub org nodes
  for (const org of mappingsConfig.github.organizations) {
    nodes.push({
      id: `github-org-${org.id}`,
      type: 'github_org',
      label: org.name,
      data: {
        ...org,
        nodeType: 'github_org',
      },
    });
  }

  // Add mapping edges
  for (const mapping of mappingsConfig.project_mappings) {
    // Domain to Motion workspace
    for (const domainId of mapping.domains) {
      edges.push({
        id: `domain-${domainId}-to-motion-${mapping.motion_workspace_id}`,
        source: `domain-${domainId}`,
        target: `motion-${mapping.motion_workspace_id}`,
        type: 'syncs_with',
        label: mapping.direction,
        data: {
          direction: mapping.direction,
          auto_create_issue: mapping.auto_create_issue,
          auto_create_task: mapping.auto_create_task,
        },
      });
    }

    // Domain to GitHub repos (via org)
    for (const repoId of mapping.github_repos) {
      const repo = mappingsConfig.github.repos.find((r: { id: string }) => r.id === repoId);
      if (repo) {
        const [orgName] = repo.full_name.split('/');
        const org = mappingsConfig.github.organizations.find((o: { name: string }) => o.name === orgName);
        if (org) {
          for (const domainId of mapping.domains) {
            edges.push({
              id: `domain-${domainId}-to-github-${repoId}`,
              source: `domain-${domainId}`,
              target: `github-org-${org.id}`,
              type: 'code_in',
              label: repo.full_name.split('/')[1],
              data: {
                repo: repo.full_name,
                sensitivity: repo.sensitivity,
              },
            });
          }
        }
      }
    }
  }

  // Add parent-child domain relationships
  for (const domain of domainsConfig.domains) {
    if (domain.parent_domain) {
      edges.push({
        id: `domain-${domain.id}-child-of-${domain.parent_domain}`,
        source: `domain-${domain.parent_domain}`,
        target: `domain-${domain.id}`,
        type: 'parent_of',
        label: 'owns',
      });
    }
  }

  return { nodes, edges };
}
