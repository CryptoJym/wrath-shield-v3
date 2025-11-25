/**
 * PM Relationships API
 *
 * GET /api/pm/relationships - List all persons with roles/projects/orgs
 * POST /api/pm/relationships/import - Import from comms sources
 * POST /api/pm/relationships/seed - Seed mock data for testing
 */

import { NextResponse } from 'next/server';
import {
  loadRelationshipsMap,
  getPersonsByRecency,
  importFromRelationshipDb,
  seedMockData,
} from '../../../../packages/pm-agent/relationships';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const map = loadRelationshipsMap();
    const persons = getPersonsByRecency(map, limit);

    return NextResponse.json({
      success: true,
      count: persons.length,
      total: map.persons.length,
      updated_at: map.updated_at,
      persons,
    });
  } catch (error) {
    console.error('[PM Relationships API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    if (action === 'import') {
      // Import from existing relationshipDb (iMessage contacts)
      const imported = await importFromRelationshipDb();
      return NextResponse.json({
        success: true,
        message: `Imported ${imported} contacts from relationshipDb`,
        imported,
      });
    }

    if (action === 'seed') {
      // Seed mock data for testing
      seedMockData();
      const map = loadRelationshipsMap();
      return NextResponse.json({
        success: true,
        message: 'Seeded mock data',
        count: map.persons.length,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "import" or "seed".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[PM Relationships API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
