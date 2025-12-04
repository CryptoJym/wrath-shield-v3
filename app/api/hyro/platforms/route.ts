import { NextRequest, NextResponse } from 'next/server';
import {
  connectorManager,
  type ManualEntry,
  type ScreenshotInput,
} from '@/lib/hyro/connectors';

/**
 * HYRO FORGE: Unified Platform Connector API
 *
 * GET /api/hyro/platforms
 * - Fetch all platform progress and connector status
 * - Query params:
 *   - ?status=true - Include connector health status
 *   - ?progress=true - Include platform progress
 *
 * POST /api/hyro/platforms
 * - Trigger sync for platforms
 * - Body options:
 *   {
 *     "action": "sync_all" | "sync_platform" | "manual_entry",
 *     "platformId"?: string,  // For sync_platform
 *     "screenshot"?: ScreenshotInput,  // For Zearn screenshot sync
 *     "entry"?: ManualEntry  // For manual_entry
 *   }
 */

// ============================================================================
// GET: Fetch Platform Data
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeStatus = searchParams.get('status') !== 'false';
    const includeProgress = searchParams.get('progress') !== 'false';

    const response: any = {
      timestamp: new Date().toISOString(),
    };

    // Get connector status
    if (includeStatus) {
      response.status = connectorManager.getConnectorStatus();
    }

    // Get platform progress
    if (includeProgress) {
      const progressMap = await connectorManager.getAllProgress();
      response.progress = Object.fromEntries(progressMap);
    }

    // Get platform IDs
    response.platforms = connectorManager.getPlatformIds();

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[PlatformsAPI] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch platform data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Trigger Sync or Manual Entry
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, platformId, screenshot, entry } = body;

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: action',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // Action: Sync All Platforms
    // ========================================================================

    if (action === 'sync_all') {
      console.log('[PlatformsAPI] Syncing all platforms...');
      const results = await connectorManager.syncAll();

      const summary = {
        total: results.size,
        successful: Array.from(results.values()).filter((r) => r.success).length,
        failed: Array.from(results.values()).filter((r) => !r.success).length,
        totalItems: Array.from(results.values()).reduce(
          (sum, r) => sum + r.itemsSynced,
          0
        ),
      };

      return NextResponse.json({
        success: true,
        data: {
          action: 'sync_all',
          summary,
          results: Object.fromEntries(results),
        },
      });
    }

    // ========================================================================
    // Action: Sync Single Platform
    // ========================================================================

    if (action === 'sync_platform') {
      if (!platformId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required field: platformId',
          },
          { status: 400 }
        );
      }

      console.log(`[PlatformsAPI] Syncing platform: ${platformId}...`);

      const options = screenshot ? { screenshot } : undefined;
      const result = await connectorManager.syncPlatform(platformId, options);

      return NextResponse.json({
        success: result.success,
        data: {
          action: 'sync_platform',
          platformId,
          result,
        },
      });
    }

    // ========================================================================
    // Action: Manual Entry
    // ========================================================================

    if (action === 'manual_entry') {
      if (!entry) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required field: entry',
          },
          { status: 400 }
        );
      }

      console.log('[PlatformsAPI] Processing manual entry...');
      const result = await connectorManager.processManualEntry(
        entry as ManualEntry
      );

      return NextResponse.json({
        success: result.success,
        data: {
          action: 'manual_entry',
          result,
        },
      });
    }

    // ========================================================================
    // Unknown Action
    // ========================================================================

    return NextResponse.json(
      {
        success: false,
        error: `Unknown action: ${action}`,
        validActions: ['sync_all', 'sync_platform', 'manual_entry'],
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[PlatformsAPI] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT: Update Connector Settings
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { platformId, action, enabled } = body;

    if (!platformId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: platformId, action',
        },
        { status: 400 }
      );
    }

    // Reset errors
    if (action === 'reset_errors') {
      const success = connectorManager.resetErrors(platformId);
      return NextResponse.json({
        success,
        data: {
          action: 'reset_errors',
          platformId,
        },
      });
    }

    // Enable/disable connector
    if (action === 'set_enabled') {
      if (enabled === undefined) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required field: enabled',
          },
          { status: 400 }
        );
      }

      const success = connectorManager.setEnabled(platformId, enabled);
      return NextResponse.json({
        success,
        data: {
          action: 'set_enabled',
          platformId,
          enabled,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Unknown action: ${action}`,
        validActions: ['reset_errors', 'set_enabled'],
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[PlatformsAPI] PUT error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update connector',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
