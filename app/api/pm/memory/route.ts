import { NextRequest, NextResponse } from 'next/server';
import {
  searchPMMemory,
  getPMContext,
  addPMMemory,
  recordRepoAssignment,
  recordProjectContext,
  recordOrganizationRule,
  getOrganizationStructure,
  getOrganizationalPolicies,
  getRepoOrganizationContext,
  proposeOrganizationPolicy,
} from '@/lib/pm/pm-memory';

/**
 * PM Memory API
 *
 * GET /api/pm/memory?action=...
 *   - search: Search PM memories
 *   - context: Get combined PM + org context
 *   - structure: Get organization structure from memory
 *   - policies: Get organizational policies
 *   - repo-context: Get context for a specific repo
 *
 * POST /api/pm/memory
 *   - add: Add PM memory
 *   - record-assignment: Record repo assignment
 *   - record-project: Record project context
 *   - record-rule: Record organization rule
 *   - propose-policy: Propose organizational policy
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'search';

    switch (action) {
      case 'search': {
        const query = searchParams.get('query');
        if (!query) {
          return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
        }

        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
        const results = await searchPMMemory(query, limit);

        return NextResponse.json({
          action: 'search',
          query,
          count: results.length,
          results: results.map(r => ({
            text: r.memory.text.substring(0, 500),
            score: r.score,
            metadata: r.memory.metadata,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'context': {
        const query = searchParams.get('query');
        if (!query) {
          return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
        }

        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 5;
        const context = await getPMContext(query, limit);

        return NextResponse.json({
          action: 'context',
          query,
          private: context.private.map(r => ({
            text: r.memory.text.substring(0, 500),
            score: r.score,
            metadata: r.memory.metadata,
          })),
          org: context.org.map(r => ({
            text: r.memory.text.substring(0, 500),
            score: r.score,
            metadata: r.memory.metadata,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'structure': {
        const structure = await getOrganizationStructure();

        return NextResponse.json({
          action: 'structure',
          projects: Object.fromEntries(structure.projects),
          rulesCount: structure.rules.length,
          rules: structure.rules.map(r => ({
            text: r.memory.text.split('\n')[0],
            metadata: r.memory.metadata,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'policies': {
        const query = searchParams.get('query') || 'organization policy';
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
        const policies = await getOrganizationalPolicies(query, limit);

        return NextResponse.json({
          action: 'policies',
          count: policies.length,
          policies: policies.map(p => ({
            text: p.memory.text.substring(0, 500),
            score: p.score,
            metadata: p.memory.metadata,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'repo-context': {
        const repoName = searchParams.get('repoName');
        if (!repoName) {
          return NextResponse.json({ error: 'Missing repoName parameter' }, { status: 400 });
        }

        const context = await getRepoOrganizationContext(repoName);

        return NextResponse.json({
          action: 'repo-context',
          repoName,
          context,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[PMMemoryAPI] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get PM memory data', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'add': {
        const { text, category, metadata } = body;
        if (!text || !category) {
          return NextResponse.json(
            { error: 'Missing required fields: text, category' },
            { status: 400 }
          );
        }

        await addPMMemory(text, category, metadata);

        return NextResponse.json({
          action: 'add',
          added: true,
          category,
          timestamp: new Date().toISOString(),
        });
      }

      case 'record-assignment': {
        const { repoName, repoFullName, projectId, projectName, rationale, confidence, source, assignedBy } = body;
        if (!repoName || !repoFullName || !projectName || !rationale) {
          return NextResponse.json(
            { error: 'Missing required fields: repoName, repoFullName, projectName, rationale' },
            { status: 400 }
          );
        }

        await recordRepoAssignment({
          repoName,
          repoFullName,
          projectId: projectId || '',
          projectName,
          rationale,
          confidence: confidence || 1.0,
          source: source || 'manual',
          assignedAt: new Date().toISOString(),
          assignedBy,
        });

        return NextResponse.json({
          action: 'record-assignment',
          recorded: true,
          timestamp: new Date().toISOString(),
        });
      }

      case 'record-project': {
        const { projectId, projectName, description, domain, repos, primaryLanguages, teamMembers } = body;
        if (!projectId || !projectName || !repos) {
          return NextResponse.json(
            { error: 'Missing required fields: projectId, projectName, repos' },
            { status: 400 }
          );
        }

        await recordProjectContext({
          projectId,
          projectName,
          description,
          domain,
          repos,
          primaryLanguages,
          teamMembers,
        });

        return NextResponse.json({
          action: 'record-project',
          recorded: true,
          timestamp: new Date().toISOString(),
        });
      }

      case 'record-rule': {
        const { pattern, targetProject, confidence, examples } = body;
        if (!pattern || !targetProject) {
          return NextResponse.json(
            { error: 'Missing required fields: pattern, targetProject' },
            { status: 400 }
          );
        }

        await recordOrganizationRule({
          id: `rule-${Date.now()}`,
          pattern,
          targetProject,
          confidence: confidence || 0.7,
          examples: examples || [],
          createdAt: new Date().toISOString(),
        });

        return NextResponse.json({
          action: 'record-rule',
          recorded: true,
          timestamp: new Date().toISOString(),
        });
      }

      case 'propose-policy': {
        const { policy, rationale, affectedProjects } = body;
        if (!policy || !rationale || !affectedProjects) {
          return NextResponse.json(
            { error: 'Missing required fields: policy, rationale, affectedProjects' },
            { status: 400 }
          );
        }

        const proposal = await proposeOrganizationPolicy(policy, rationale, affectedProjects);

        return NextResponse.json({
          action: 'propose-policy',
          proposalId: proposal.id,
          status: proposal.status,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[PMMemoryAPI] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to execute PM memory action', details: String(error) },
      { status: 500 }
    );
  }
}
