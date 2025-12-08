/**
 * Contacts API
 *
 * GET /api/contacts - List contacts with optional search
 * POST /api/contacts - Resolve a contact from a raw handle
 * PATCH /api/contacts - Update a contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { topContacts, getRelationshipDb, type ContactRow } from '@/lib/relationshipDb';
import {
  resolveContact,
  getContactById,
  calculateSimilarity,
  normalizeName,
  type ContactMatch,
} from '@/lib/contacts/resolver';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contacts
 * List contacts with optional search
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const contactId = searchParams.get('id');

    // If ID is provided, return single contact
    if (contactId) {
      const contact = getContactById(contactId);
      if (!contact) {
        return NextResponse.json(
          { ok: false, error: 'Contact not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, contact });
    }

    // If search query is provided
    if (query) {
      const db = getRelationshipDb();
      if (!db) {
        return NextResponse.json({ ok: true, contacts: [], count: 0 });
      }

      // Search by display_name or handle
      const normalizedQuery = normalizeName(query);
      const all = db.prepare(`
        SELECT * FROM contacts
        WHERE display_name IS NOT NULL OR handle IS NOT NULL
        ORDER BY last_ts DESC
        LIMIT 500
      `).all() as ContactRow[];

      const matches = all
        .map((contact) => {
          const nameSim = calculateSimilarity(
            normalizeName(contact.display_name || ''),
            normalizedQuery
          );
          const handleSim = calculateSimilarity(
            (contact.handle || '').toLowerCase(),
            query.toLowerCase()
          );
          return {
            ...contact,
            similarity: Math.max(nameSim, handleSim),
          };
        })
        .filter((c) => c.similarity >= 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return NextResponse.json({
        ok: true,
        contacts: matches,
        count: matches.length,
      });
    }

    // Default: list recent contacts
    const contacts = topContacts(limit);
    return NextResponse.json({
      ok: true,
      contacts,
      count: contacts.length,
    });
  } catch (error) {
    console.error('[Contacts API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts
 * Resolve a contact from a raw handle
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { handle, displayName, autoCreate = true, minConfidence = 0.7 } = body;

    if (!handle) {
      return NextResponse.json(
        { ok: false, error: 'handle is required' },
        { status: 400 }
      );
    }

    const match = resolveContact(handle, displayName, {
      autoCreate,
      minConfidence,
    });

    if (!match) {
      return NextResponse.json({
        ok: true,
        resolved: false,
        message: 'No matching contact found',
      });
    }

    return NextResponse.json({
      ok: true,
      resolved: true,
      match,
    });
  } catch (error) {
    console.error('[Contacts API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/contacts
 * Update a contact
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, displayName, handle, canonicalHandle } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const db = getRelationshipDb();
    if (!db) {
      return NextResponse.json(
        { ok: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      params.push(displayName);
    }
    if (handle !== undefined) {
      updates.push('handle = ?');
      params.push(handle);
    }
    if (canonicalHandle !== undefined) {
      updates.push('canonical_handle = ?');
      params.push(canonicalHandle);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    updates.push("updated_at = strftime('%s', 'now')");
    params.push(id);

    const stmt = db.prepare(`
      UPDATE contacts SET ${updates.join(', ')} WHERE id = ?
    `);
    stmt.run(...params);

    // Fetch updated contact
    const updated = getContactById(id);

    return NextResponse.json({
      ok: true,
      contact: updated,
    });
  } catch (error) {
    console.error('[Contacts API] PATCH Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
