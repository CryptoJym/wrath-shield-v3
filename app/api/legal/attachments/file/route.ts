import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_DIRS = [
  path.resolve(process.cwd(), 'packages', 'legal-scrapers', 'scraped_data'),
  path.resolve(process.cwd(), 'packages', 'legal-scrapers'),
];

function isPathAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return ALLOWED_DIRS.some(dir => resolved.startsWith(dir));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  const resolved = path.resolve(filePath);

  if (!isPathAllowed(resolved)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const stat = fs.statSync(resolved);
  const ext = path.extname(resolved).toLowerCase();

  let contentType = 'application/octet-stream';
  if (ext === '.pdf') contentType = 'application/pdf';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.json') contentType = 'application/json';
  else if (ext === '.txt') contentType = 'text/plain';

  const data = fs.readFileSync(resolved);

  return new NextResponse(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': stat.size.toString(),
      'Content-Disposition': `inline; filename="${path.basename(resolved)}"`,
    },
  });
}
