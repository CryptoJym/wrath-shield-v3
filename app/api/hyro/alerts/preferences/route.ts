/**
 * API Route: /api/hyro/alerts/preferences
 *
 * GET - Get alert preferences
 * PUT - Update alert preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAlertPreferences,
  updateAlertPreferences,
  type AlertType,
} from '@/lib/hyro/forge-alerts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/hyro/alerts/preferences
 * Get all alert preferences
 */
export async function GET(request: NextRequest) {
  try {
    const preferences = await getAlertPreferences();

    return NextResponse.json({
      preferences,
    });
  } catch (error) {
    console.error('[Alert Preferences API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/hyro/alerts/preferences
 * Update alert preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { alert_type, enabled, email_enabled, frequency } = body;

    if (!alert_type) {
      return NextResponse.json(
        { error: 'alert_type is required' },
        { status: 400 }
      );
    }

    const updates: any = { alert_type };

    if (enabled !== undefined) {
      updates.enabled = enabled;
    }

    if (email_enabled !== undefined) {
      updates.email_enabled = email_enabled;
    }

    if (frequency !== undefined) {
      if (!['immediate', 'hourly', 'daily', 'weekly'].includes(frequency)) {
        return NextResponse.json(
          { error: 'Invalid frequency value' },
          { status: 400 }
        );
      }
      updates.frequency = frequency;
    }

    await updateAlertPreferences(updates);

    return NextResponse.json({
      success: true,
      message: 'Preferences updated',
    });
  } catch (error) {
    console.error('[Alert Preferences API] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
