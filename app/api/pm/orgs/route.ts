/**
 * GitHub Organizations API
 *
 * Manages multi-organization configuration for the GitHub-native PM system.
 *
 * GET /api/pm/orgs - List all organizations
 * GET /api/pm/orgs?action=stats - Get organization statistics
 * GET /api/pm/orgs?action=hierarchy&orgId=X - Get org hierarchy tree
 *
 * POST /api/pm/orgs
 *   - create-org: Create a new organization
 *   - update-org: Update an organization
 *   - delete-org: Delete an organization
 *   - init-defaults: Initialize default organizations
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllOrgs,
  getOrg,
  createOrg,
  updateOrg,
  deleteOrg,
  getOrgStats,
  getOrgHierarchyTree,
  initializeDefaultOrgs,
} from '@/lib/pm/github-org-config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Default: List all organizations
    if (!action) {
      const orgs = getAllOrgs();
      return NextResponse.json({
        ok: true,
        count: orgs.length,
        orgs,
        timestamp: new Date().toISOString(),
      });
    }

    switch (action) {
      case 'stats': {
        const stats = getOrgStats();
        return NextResponse.json({
          ok: true,
          action: 'stats',
          stats,
          timestamp: new Date().toISOString(),
        });
      }

      case 'hierarchy': {
        const orgId = searchParams.get('orgId');
        if (!orgId) {
          return NextResponse.json(
            { ok: false, error: 'Missing orgId parameter' },
            { status: 400 }
          );
        }

        const hierarchy = getOrgHierarchyTree(orgId);
        if (!hierarchy) {
          return NextResponse.json(
            { ok: false, error: 'Organization not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'hierarchy',
          ...hierarchy,
          timestamp: new Date().toISOString(),
        });
      }

      case 'get': {
        const orgId = searchParams.get('orgId');
        if (!orgId) {
          return NextResponse.json(
            { ok: false, error: 'Missing orgId parameter' },
            { status: 400 }
          );
        }

        const org = getOrg(orgId);
        if (!org) {
          return NextResponse.json(
            { ok: false, error: 'Organization not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'get',
          org,
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
    console.error('[PM Orgs API] GET Error:', error);
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
      case 'create-org': {
        const { name, display_name, description, parent_org_id, is_primary, settings } = body;

        if (!name || !display_name) {
          return NextResponse.json(
            { ok: false, error: 'Missing required fields: name, display_name' },
            { status: 400 }
          );
        }

        const org = createOrg({
          name,
          display_name,
          description,
          parent_org_id,
          is_primary,
          settings,
        });

        return NextResponse.json({
          ok: true,
          action: 'create-org',
          org,
          timestamp: new Date().toISOString(),
        });
      }

      case 'update-org': {
        const { orgId, ...updates } = body;
        delete updates.action;

        if (!orgId) {
          return NextResponse.json(
            { ok: false, error: 'Missing orgId' },
            { status: 400 }
          );
        }

        const org = updateOrg(orgId, updates);
        if (!org) {
          return NextResponse.json(
            { ok: false, error: 'Organization not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'update-org',
          org,
          timestamp: new Date().toISOString(),
        });
      }

      case 'delete-org': {
        const { orgId } = body;

        if (!orgId) {
          return NextResponse.json(
            { ok: false, error: 'Missing orgId' },
            { status: 400 }
          );
        }

        const success = deleteOrg(orgId);
        if (!success) {
          return NextResponse.json(
            { ok: false, error: 'Organization not found or could not be deleted' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'delete-org',
          deleted: orgId,
          timestamp: new Date().toISOString(),
        });
      }

      case 'init-defaults': {
        initializeDefaultOrgs();
        const orgs = getAllOrgs();

        return NextResponse.json({
          ok: true,
          action: 'init-defaults',
          message: 'Default organizations initialized',
          orgs,
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
    console.error('[PM Orgs API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
