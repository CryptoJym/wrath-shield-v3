/**
 * PM Projects API - GitHub Native
 *
 * GET /api/pm/projects - Returns aggregated projects from GitHub
 * GET /api/pm/projects?action=v2-list - List GitHub Projects v2
 * GET /api/pm/projects?action=v2-get&projectId=X - Get specific project
 * GET /api/pm/projects?action=v2-items&projectId=X - Get project items
 * GET /api/pm/projects?action=v2-summary&projectId=X - Get project summary
 *
 * POST /api/pm/projects
 *   - add-item: Add issue/PR to project
 *   - remove-item: Remove item from project
 *   - update-field: Update item field value
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/pm/integration';
import githubProjectsClient from '@/lib/integrations/GitHubProjectsClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Default behavior - return aggregated projects
    if (!action) {
      const projects = await getAllProjects();

      return NextResponse.json({
        ok: true,
        count: projects.length,
        projects,
        sources: {
          github: projects.filter(p => p.source === 'github').length,
          local: projects.filter(p => p.source === 'local').length,
        },
      });
    }

    // GitHub Projects v2 actions
    switch (action) {
      case 'v2-list': {
        if (!githubProjectsClient.isConfigured()) {
          return NextResponse.json(
            { ok: false, error: 'GitHub not configured' },
            { status: 503 }
          );
        }

        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
        const result = await githubProjectsClient.getUserProjects({ limit });

        return NextResponse.json({
          ok: true,
          action: 'v2-list',
          totalCount: result.totalCount,
          projects: result.projects,
          hasNextPage: result.hasNextPage,
          timestamp: new Date().toISOString(),
        });
      }

      case 'v2-list-all': {
        if (!githubProjectsClient.isConfigured()) {
          return NextResponse.json(
            { ok: false, error: 'GitHub not configured' },
            { status: 503 }
          );
        }

        const projects = await githubProjectsClient.getAllProjects();

        return NextResponse.json({
          ok: true,
          action: 'v2-list-all',
          count: projects.length,
          projects,
          timestamp: new Date().toISOString(),
        });
      }

      case 'v2-get': {
        const projectId = searchParams.get('projectId');
        if (!projectId) {
          return NextResponse.json({ ok: false, error: 'Missing projectId' }, { status: 400 });
        }

        const project = await githubProjectsClient.getProject(projectId);

        return NextResponse.json({
          ok: true,
          action: 'v2-get',
          project,
          timestamp: new Date().toISOString(),
        });
      }

      case 'v2-items': {
        const projectId = searchParams.get('projectId');
        if (!projectId) {
          return NextResponse.json({ ok: false, error: 'Missing projectId' }, { status: 400 });
        }

        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
        const after = searchParams.get('after') || undefined;

        const result = await githubProjectsClient.getProjectItems(projectId, { limit, after });

        return NextResponse.json({
          ok: true,
          action: 'v2-items',
          projectId,
          totalCount: result.totalCount,
          items: result.items,
          hasNextPage: result.hasNextPage,
          timestamp: new Date().toISOString(),
        });
      }

      case 'v2-all-items': {
        const projectId = searchParams.get('projectId');
        if (!projectId) {
          return NextResponse.json({ ok: false, error: 'Missing projectId' }, { status: 400 });
        }

        const items = await githubProjectsClient.getAllProjectItems(projectId);

        return NextResponse.json({
          ok: true,
          action: 'v2-all-items',
          projectId,
          count: items.length,
          items,
          timestamp: new Date().toISOString(),
        });
      }

      case 'v2-summary': {
        const projectId = searchParams.get('projectId');
        if (!projectId) {
          return NextResponse.json({ ok: false, error: 'Missing projectId' }, { status: 400 });
        }

        const summary = await githubProjectsClient.getProjectSummary(projectId);

        return NextResponse.json({
          ok: true,
          action: 'v2-summary',
          projectId,
          summary,
          timestamp: new Date().toISOString(),
        });
      }

      case 'v2-find': {
        const title = searchParams.get('title');
        if (!title) {
          return NextResponse.json({ ok: false, error: 'Missing title' }, { status: 400 });
        }

        const project = await githubProjectsClient.findProjectByTitle(title);

        return NextResponse.json({
          ok: true,
          action: 'v2-find',
          title,
          found: !!project,
          project,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[PM Projects API] Error:', error);
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
      return NextResponse.json({ ok: false, error: 'Missing action' }, { status: 400 });
    }

    if (!githubProjectsClient.isConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'GitHub not configured' },
        { status: 503 }
      );
    }

    switch (action) {
      case 'add-item': {
        const { projectId, contentId } = body;
        if (!projectId || !contentId) {
          return NextResponse.json(
            { ok: false, error: 'Missing projectId or contentId' },
            { status: 400 }
          );
        }

        const result = await githubProjectsClient.addItemToProject(projectId, contentId);

        return NextResponse.json({
          ok: true,
          action: 'add-item',
          projectId,
          itemId: result.itemId,
          timestamp: new Date().toISOString(),
        });
      }

      case 'remove-item': {
        const { projectId, itemId } = body;
        if (!projectId || !itemId) {
          return NextResponse.json(
            { ok: false, error: 'Missing projectId or itemId' },
            { status: 400 }
          );
        }

        const result = await githubProjectsClient.removeItemFromProject(projectId, itemId);

        return NextResponse.json({
          ok: true,
          action: 'remove-item',
          deletedItemId: result.deletedItemId,
          timestamp: new Date().toISOString(),
        });
      }

      case 'update-field': {
        const { projectId, itemId, fieldId, value } = body;
        if (!projectId || !itemId || !fieldId || !value) {
          return NextResponse.json(
            { ok: false, error: 'Missing required fields' },
            { status: 400 }
          );
        }

        await githubProjectsClient.updateItemField(projectId, itemId, fieldId, value);

        return NextResponse.json({
          ok: true,
          action: 'update-field',
          updated: true,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[PM Projects API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
