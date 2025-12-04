/**
 * API Route: /api/hyro/alerts
 *
 * GET - List alerts (with filters)
 * POST - Generate/check alerts or mark as read
 * PATCH - Mark alert as read/dismissed
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkAndGenerateAlerts,
  getAlerts,
  getUnreadAlerts,
  getUnreadAlertCount,
  markAlertRead,
  markAllAlertsRead,
  dismissAlert,
  type AlertType,
} from '@/lib/hyro/forge-alerts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/hyro/alerts
 * List alerts with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as AlertType | null;
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const countOnly = searchParams.get('count_only') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    // If only count is requested
    if (countOnly) {
      const count = await getUnreadAlertCount();
      return NextResponse.json({ count });
    }

    // Get alerts with filters
    const alerts = await getAlerts({
      type: type || undefined,
      unreadOnly,
      limit,
    });

    return NextResponse.json({
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error('[Alerts API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hyro/alerts
 * Generate new alerts or perform batch actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'generate':
        // Check and generate all applicable alerts
        const newAlerts = await checkAndGenerateAlerts();
        return NextResponse.json({
          success: true,
          alerts: newAlerts,
          count: newAlerts.length,
        });

      case 'mark_all_read':
        // Mark all alerts as read
        const changedCount = await markAllAlertsRead();
        return NextResponse.json({
          success: true,
          marked_read: changedCount,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Alerts API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hyro/alerts
 * Update an alert (mark as read or dismissed)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'read':
        await markAlertRead(id);
        return NextResponse.json({ success: true });

      case 'dismiss':
        await dismissAlert(id);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Alerts API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}
