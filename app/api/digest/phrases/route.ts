/**
 * GET/POST /api/digest/phrases
 * GET: Returns current phrase mappings (merged) and sensitivity setting
 * POST: Toggle mapping or update sensitivity
 *   - { canonical: string, enabled: boolean }
 *   - { sensitivity: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAssuredWordEngine } from '@/lib/assuredWordEngine';
import { getSetting, insertSettings } from '@/lib/db/queries';

type ToggleBody = { canonical?: string; enabled?: boolean; sensitivity?: number };

function readToggles(): Record<string, boolean> {
  const s = getSetting('digest_phrase_toggles');
  if (!s || !s.value_enc) return {};
  try { return JSON.parse(s.value_enc); } catch { return {}; }
}

function writeToggles(map: Record<string, boolean>) {
  insertSettings([{ key: 'digest_phrase_toggles', value_enc: JSON.stringify(map) }]);
}

function readSensitivity(): number {
  const s = getSetting('digest_sensitivity');
  if (!s || !s.value_enc) return 0.5;
  const n = Number(s.value_enc);
  return Number.isFinite(n) ? n : 0.5;
}

function writeSensitivity(value: number) {
  const v = Math.max(0, Math.min(1, value));
  insertSettings([{ key: 'digest_sensitivity', value_enc: String(v) }]);
}

export async function GET() {
  try {
    const awe = getAssuredWordEngine();
    const mappings = awe.getAllMappings();
    const toggles = readToggles();
    const sensitivity = readSensitivity();

    const list = mappings.map((m) => ({
      canonical: m.canonical,
      phrase: m.phrase,
      category: m.category,
      assured_alt: m.assured_alt,
      options: m.options,
      lift_score: m.lift_score,
      enabled: toggles.hasOwnProperty(m.canonical) ? !!toggles[m.canonical] : m.enabled,
      context_tags: m.context_tags,
    }));

    return NextResponse.json({ success: true, sensitivity, phrases: list }, { status: 200 });
  } catch (error) {
    console.error('[digest/phrases] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load phrases' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ToggleBody;
    const awe = getAssuredWordEngine();

    if (typeof body.sensitivity === 'number') {
      writeSensitivity(body.sensitivity);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (typeof body.canonical === 'string' && typeof body.enabled === 'boolean') {
      const toggles = readToggles();
      toggles[body.canonical] = body.enabled;
      writeToggles(toggles);

      // Best-effort live update: find mapping by canonical and apply enabled state
      const list = awe.getAllMappings();
      const match = list.find((m) => m.canonical === body.canonical);
      if (match) {
        awe.setMappingEnabled(match.phrase, body.enabled);
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
  } catch (error) {
    console.error('[digest/phrases] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}

