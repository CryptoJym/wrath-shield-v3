/**
 * PM Projects API
 *
 * GET /api/pm/projects - Returns aggregated projects from GitHub and Motion
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/pm/integration';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const projects = await getAllProjects();

    return NextResponse.json({
      ok: true,
      count: projects.length,
      projects,
      sources: {
        github: projects.filter(p => p.source === 'github').length,
        motion: projects.filter(p => p.source === 'motion').length,
      },
    });
  } catch (error) {
    console.error('[PM Projects API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
