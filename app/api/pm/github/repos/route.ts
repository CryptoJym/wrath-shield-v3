/**
 * GitHub Repos API
 *
 * GET /api/pm/github/repos - List all repos for configured user
 * POST /api/pm/github/repos - Update repo-to-project mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import githubClient from '@/lib/integrations/GitHubClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!githubClient.isConfigured()) {
      return NextResponse.json({
        ok: false,
        error: 'GitHub not configured. Set GITHUB_ACCESS_TOKEN and GITHUB_USERNAME in .env.local',
        configured: false,
      });
    }

    const searchParams = req.nextUrl.searchParams;
    const unmappedOnly = searchParams.get('unmapped') === 'true';

    let repos;
    if (unmappedOnly) {
      repos = await githubClient.getUnmappedRepos();
    } else {
      repos = await githubClient.getRepos();
    }

    const mappings = githubClient.getRepoMappings();
    const mappingMap = new Map(mappings.map(m => [m.repo_full_name, m]));

    // Enrich repos with mapping info
    const enrichedRepos = repos.map(repo => ({
      ...repo,
      mapping: mappingMap.get(repo.full_name) || null,
    }));

    return NextResponse.json({
      ok: true,
      username: githubClient.getUsername(),
      repos: enrichedRepos,
      mappings,
      unmapped_count: repos.filter(r => !mappingMap.has(r.full_name)).length,
    });
  } catch (error) {
    console.error('[GitHub Repos API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repo_full_name, project_id, project_name, enabled } = body;

    if (!repo_full_name) {
      return NextResponse.json(
        { ok: false, error: 'repo_full_name required' },
        { status: 400 }
      );
    }

    githubClient.setRepoMapping({
      repo_full_name,
      project_id: project_id || null,
      project_name: project_name || null,
      enabled: enabled !== false,
      last_synced_at: null,
    });

    return NextResponse.json({
      ok: true,
      message: `Mapping updated for ${repo_full_name}`,
    });
  } catch (error) {
    console.error('[GitHub Repos API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
