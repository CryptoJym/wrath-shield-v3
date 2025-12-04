import { NextRequest, NextResponse } from 'next/server';
import githubClient from '@/lib/integrations/GitHubClient';
import {
  getOrganizationSuggestions,
  applyOrganizationActions,
  autoOrganizeRepos,
  learnFromUserCorrection,
  getOrganizationStatus,
  syncProjectsToMemory,
  type OrganizationAction,
} from '@/lib/pm/repo-organizer';

/**
 * Repository Organization API
 *
 * GET /api/pm/repos?action=...
 *   - list: List all repos
 *   - unmapped: List unmapped repos
 *   - mappings: List repo-to-project mappings
 *   - suggestions: Get organization suggestions
 *   - status: Get organization status
 *
 * POST /api/pm/repos
 *   - set-mapping: Set repo-to-project mapping
 *   - apply-actions: Apply organization actions
 *   - auto-organize: Auto-organize high-confidence repos
 *   - learn-correction: Learn from user correction
 *   - sync-projects: Sync projects to memory
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    // Check if GitHub is configured
    if (!githubClient.isConfigured()) {
      return NextResponse.json(
        {
          error: 'GitHub not configured',
          message: 'Set GITHUB_ACCESS_TOKEN and GITHUB_USERNAME environment variables',
        },
        { status: 503 }
      );
    }

    switch (action) {
      case 'list': {
        const type = searchParams.get('type') as any || 'all';
        const sort = searchParams.get('sort') as any || 'updated';
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;

        const repos = await githubClient.getRepos({ type, sort, limit });

        return NextResponse.json({
          action: 'list',
          count: repos.length,
          repos,
          timestamp: new Date().toISOString(),
        });
      }

      case 'unmapped': {
        const repos = await githubClient.getUnmappedRepos();

        return NextResponse.json({
          action: 'unmapped',
          count: repos.length,
          repos,
          timestamp: new Date().toISOString(),
        });
      }

      case 'mappings': {
        const mappings = githubClient.getRepoMappings();

        return NextResponse.json({
          action: 'mappings',
          count: mappings.length,
          mappings,
          timestamp: new Date().toISOString(),
        });
      }

      case 'suggestions': {
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
        const suggestions = await getOrganizationSuggestions(limit);

        return NextResponse.json({
          action: 'suggestions',
          count: suggestions.length,
          autoAssignable: suggestions.filter(s => s.autoAssignable).length,
          suggestions: suggestions.map(s => ({
            repo: {
              name: s.repo.name,
              full_name: s.repo.full_name,
              description: s.repo.description,
              language: s.repo.language,
              updated_at: s.repo.updated_at,
            },
            suggestions: s.suggestions.map(sug => ({
              projectTitle: (sug.project as any).title || sug.project,
              projectId: (sug.project as any).id || null,
              confidence: sug.confidence,
              rationale: sug.rationale,
              source: sug.source,
            })),
            autoAssignable: s.autoAssignable,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'status': {
        const status = await getOrganizationStatus();

        return NextResponse.json({
          action: 'status',
          status,
          timestamp: new Date().toISOString(),
        });
      }

      case 'enabled': {
        const enabled = githubClient.getEnabledRepos();

        return NextResponse.json({
          action: 'enabled',
          count: enabled.length,
          repos: enabled,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[ReposAPI] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get repo data', details: String(error) },
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

    // Check if GitHub is configured
    if (!githubClient.isConfigured()) {
      return NextResponse.json(
        {
          error: 'GitHub not configured',
          message: 'Set GITHUB_ACCESS_TOKEN and GITHUB_USERNAME environment variables',
        },
        { status: 503 }
      );
    }

    switch (action) {
      case 'set-mapping': {
        const { repoFullName, projectId, projectName, enabled } = body;
        if (!repoFullName) {
          return NextResponse.json({ error: 'Missing repoFullName' }, { status: 400 });
        }

        githubClient.setRepoMapping({
          repo_full_name: repoFullName,
          project_id: projectId || null,
          project_name: projectName || null,
          enabled: enabled !== false,
          last_synced_at: Math.floor(Date.now() / 1000),
        });

        return NextResponse.json({
          action: 'set-mapping',
          success: true,
          mapping: {
            repo_full_name: repoFullName,
            project_id: projectId,
            project_name: projectName,
            enabled: enabled !== false,
          },
          timestamp: new Date().toISOString(),
        });
      }

      case 'apply-actions': {
        const { actions: orgActions } = body;
        if (!orgActions || !Array.isArray(orgActions)) {
          return NextResponse.json({ error: 'Missing or invalid actions array' }, { status: 400 });
        }

        const result = await applyOrganizationActions(orgActions as OrganizationAction[]);

        return NextResponse.json({
          action: 'apply-actions',
          result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'auto-organize': {
        const result = await autoOrganizeRepos();

        return NextResponse.json({
          action: 'auto-organize',
          result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'learn-correction': {
        const { repoFullName, wrongProjectName, correctProjectName, reason } = body;
        if (!repoFullName || !wrongProjectName || !correctProjectName) {
          return NextResponse.json(
            { error: 'Missing required fields: repoFullName, wrongProjectName, correctProjectName' },
            { status: 400 }
          );
        }

        await learnFromUserCorrection(repoFullName, wrongProjectName, correctProjectName, reason);

        return NextResponse.json({
          action: 'learn-correction',
          learned: true,
          timestamp: new Date().toISOString(),
        });
      }

      case 'sync-projects': {
        await syncProjectsToMemory();

        return NextResponse.json({
          action: 'sync-projects',
          synced: true,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[ReposAPI] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to execute repo action', details: String(error) },
      { status: 500 }
    );
  }
}
