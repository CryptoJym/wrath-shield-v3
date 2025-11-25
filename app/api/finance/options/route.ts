import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../lib/auth/user';
import { listDistinctValues } from '../../../../lib/finance/store';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { userId } = currentUserOrThrow();
  const buckets = listDistinctValues('bucket', userId);
  const projects = new Set<string>(listDistinctValues('project', userId));
  const mappingPath = path.resolve(process.cwd(), 'motion_github_mappings.json');
  if (fs.existsSync(mappingPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
      Object.values<any>(data || {}).forEach((v) => {
        if (v && typeof v === 'object') {
          ['project', 'motionProjectName', 'githubRepo'].forEach((k) => {
            if (v[k]) projects.add(String(v[k]));
          });
        }
      });
    } catch (e) {
      // ignore
    }
  }

  // add projects from docs/PROJECT_INVENTORY.json if present
  try {
    const invPath = path.resolve(process.cwd(), 'docs', 'PROJECT_INVENTORY.json');
    if (fs.existsSync(invPath)) {
      const inv = JSON.parse(fs.readFileSync(invPath, 'utf-8'));
      if (Array.isArray(inv?.projects)) {
        inv.projects.forEach((p: any) => {
          if (typeof p === 'string') projects.add(p);
          if (p?.name) projects.add(p.name);
        });
      }
    }
  } catch (e) {
    // ignore
  }
  return NextResponse.json({ buckets, projects: Array.from(projects).filter(Boolean) });
}
