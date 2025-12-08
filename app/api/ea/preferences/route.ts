import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ea/preferences
 * Returns James's current preference model from Zep memory.
 */
export async function GET() {
  try {
    // Verify user is authenticated
    currentUserOrThrow();

    // Try to load preferences from Zep
    let preferences = null;
    try {
      const { loadPreferences } = await import('@/lib/ea/preference-model');
      preferences = await loadPreferences();
    } catch (e) {
      console.warn('[EA Preferences] Failed to load from preference-model, using defaults');
      // Return default preferences if module not ready
      preferences = {
        urgency_triggers: ['lawsuit', 'court', 'deadline', 'urgent', 'emergency', 'FCRA', 'custody'],
        auto_archive_patterns: ['unsubscribe', 'newsletter', 'promotional', 'no-reply'],
        priority_contacts: ['Destiny', 'Zach Start', 'attorney'],
        domain_sensitivity: {
          legal: 'high',
          finance: 'high',
          health: 'medium',
          work: 'medium',
          personal: 'low',
        },
        batch_frequency_preference: 'on_demand',
        current_focus_domain: null,
        cognitive_load_limit: 10,
      };
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('[EA Preferences] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences', preferences: null },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ea/preferences
 * Updates James's preference model.
 */
export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    currentUserOrThrow();
    const body = await request.json();

    const { savePreferences } = await import('@/lib/ea/preference-model');
    await savePreferences(body.preferences);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[EA Preferences] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
