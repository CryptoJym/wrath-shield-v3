/**
 * Repository Hierarchy API
 *
 * Manages repository hierarchy mapping for the GitHub-native PM system.
 * Supports subprojects, domains, and organizational structure.
 *
 * GET /api/pm/repos/hierarchy - List all repository hierarchy
 * GET /api/pm/repos/hierarchy?action=by-org&orgId=X - Get repos by organization
 * GET /api/pm/repos/hierarchy?action=by-domain&domain=X - Get repos by domain
 * GET /api/pm/repos/hierarchy?action=subprojects&parentId=X - Get subprojects
 * GET /api/pm/repos/hierarchy?action=roots - Get root projects
 *
 * POST /api/pm/repos/hierarchy
 *   - create: Create a new repo hierarchy entry
 *   - update: Update a repo hierarchy entry
 *   - delete: Delete a repo hierarchy entry
 *   - set-parent: Set parent relationship (make subproject)
 *   - set-domain: Set business domain
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllRepoHierarchy,
  getRepoHierarchy,
  getRepoHierarchyByName,
  getReposByOrg,
  getReposByDomain,
  getSubprojects,
  getRootProjects,
  createRepoHierarchy,
  updateRepoHierarchy,
  deleteRepoHierarchy,
} from '@/lib/pm/github-org-config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Default: List all repository hierarchy
    if (!action) {
      const repos = getAllRepoHierarchy();
      return NextResponse.json({
        ok: true,
        count: repos.length,
        repos,
        timestamp: new Date().toISOString(),
      });
    }

    switch (action) {
      case 'by-org': {
        const orgId = searchParams.get('orgId');
        if (!orgId) {
          return NextResponse.json(
            { ok: false, error: 'Missing orgId parameter' },
            { status: 400 }
          );
        }

        const repos = getReposByOrg(orgId);
        return NextResponse.json({
          ok: true,
          action: 'by-org',
          orgId,
          count: repos.length,
          repos,
          timestamp: new Date().toISOString(),
        });
      }

      case 'by-domain': {
        const domain = searchParams.get('domain');
        if (!domain) {
          return NextResponse.json(
            { ok: false, error: 'Missing domain parameter' },
            { status: 400 }
          );
        }

        const repos = getReposByDomain(domain);
        return NextResponse.json({
          ok: true,
          action: 'by-domain',
          domain,
          count: repos.length,
          repos,
          timestamp: new Date().toISOString(),
        });
      }

      case 'subprojects': {
        const parentId = searchParams.get('parentId');
        if (!parentId) {
          return NextResponse.json(
            { ok: false, error: 'Missing parentId parameter' },
            { status: 400 }
          );
        }

        const repos = getSubprojects(parentId);
        return NextResponse.json({
          ok: true,
          action: 'subprojects',
          parentId,
          count: repos.length,
          repos,
          timestamp: new Date().toISOString(),
        });
      }

      case 'roots': {
        const repos = getRootProjects();
        return NextResponse.json({
          ok: true,
          action: 'roots',
          count: repos.length,
          repos,
          timestamp: new Date().toISOString(),
        });
      }

      case 'get': {
        const repoId = searchParams.get('repoId');
        const repoName = searchParams.get('repoName');

        if (!repoId && !repoName) {
          return NextResponse.json(
            { ok: false, error: 'Missing repoId or repoName parameter' },
            { status: 400 }
          );
        }

        const repo = repoId ? getRepoHierarchy(repoId) : getRepoHierarchyByName(repoName!);
        if (!repo) {
          return NextResponse.json(
            { ok: false, error: 'Repository not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'get',
          repo,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Repo Hierarchy API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { ok: false, error: 'Missing action in request body' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'create': {
        const { repo_full_name, org_id, parent_repo_id, hierarchy_type, domain, project_name, settings } = body;

        if (!repo_full_name || !org_id) {
          return NextResponse.json(
            { ok: false, error: 'Missing required fields: repo_full_name, org_id' },
            { status: 400 }
          );
        }

        const repo = createRepoHierarchy({
          repo_full_name,
          org_id,
          parent_repo_id,
          hierarchy_type,
          domain,
          project_name,
          settings,
        });

        return NextResponse.json({
          ok: true,
          action: 'create',
          repo,
          timestamp: new Date().toISOString(),
        });
      }

      case 'update': {
        const { repoId, ...updates } = body;
        delete updates.action;

        if (!repoId) {
          return NextResponse.json(
            { ok: false, error: 'Missing repoId' },
            { status: 400 }
          );
        }

        const repo = updateRepoHierarchy(repoId, updates);
        if (!repo) {
          return NextResponse.json(
            { ok: false, error: 'Repository not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'update',
          repo,
          timestamp: new Date().toISOString(),
        });
      }

      case 'delete': {
        const { repoId } = body;

        if (!repoId) {
          return NextResponse.json(
            { ok: false, error: 'Missing repoId' },
            { status: 400 }
          );
        }

        const success = deleteRepoHierarchy(repoId);
        if (!success) {
          return NextResponse.json(
            { ok: false, error: 'Repository not found or could not be deleted' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'delete',
          deleted: repoId,
          timestamp: new Date().toISOString(),
        });
      }

      case 'set-parent': {
        const { repoId, parentRepoId } = body;

        if (!repoId) {
          return NextResponse.json(
            { ok: false, error: 'Missing repoId' },
            { status: 400 }
          );
        }

        const repo = updateRepoHierarchy(repoId, {
          parent_repo_id: parentRepoId || null,
          hierarchy_type: parentRepoId ? 'subproject' : 'standalone',
        });

        if (!repo) {
          return NextResponse.json(
            { ok: false, error: 'Repository not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'set-parent',
          repo,
          timestamp: new Date().toISOString(),
        });
      }

      case 'set-domain': {
        const { repoId, domain } = body;

        if (!repoId) {
          return NextResponse.json(
            { ok: false, error: 'Missing repoId' },
            { status: 400 }
          );
        }

        const repo = updateRepoHierarchy(repoId, { domain });
        if (!repo) {
          return NextResponse.json(
            { ok: false, error: 'Repository not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'set-domain',
          repo,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Repo Hierarchy API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
