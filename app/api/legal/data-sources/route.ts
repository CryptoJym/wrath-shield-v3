import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DataSourceStatus = {
  id: string;
  name: string;
  lastUpdated: string | null;
  status: 'ready' | 'stale' | 'error' | 'unknown';
  count?: number;
  error?: string;
};

function getScrapersPath() {
  return path.resolve(process.cwd(), 'packages', 'legal-scrapers');
}

function getScrapedDataPath() {
  return path.resolve(getScrapersPath(), 'scraped_data');
}

function findLatestFile(dir: string, pattern: RegExp): { path: string; mtime: Date } | null {
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir)
    .filter(f => pattern.test(f))
    .map(f => {
      const filePath = path.join(dir, f);
      const stat = fs.statSync(filePath);
      return { path: filePath, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files[0] || null;
}

export async function GET() {
  const scrapedData = getScrapedDataPath();
  const scrapersPath = getScrapersPath();

  const sources: DataSourceStatus[] = [];

  // MyCase Court Data
  const mycaseFile = findLatestFile(scrapedData, /mycase_data_.*\.json$/);
  if (mycaseFile) {
    try {
      const data = JSON.parse(fs.readFileSync(mycaseFile.path, 'utf-8'));
      sources.push({
        id: 'mycase',
        name: 'Utah Courts (MyCase)',
        lastUpdated: mycaseFile.mtime.toISOString(),
        status: isStale(mycaseFile.mtime, 24) ? 'stale' : 'ready',
        count: data.recent_critical_events?.length || 0,
      });
    } catch {
      sources.push({
        id: 'mycase',
        name: 'Utah Courts (MyCase)',
        lastUpdated: null,
        status: 'error',
        error: 'Failed to parse court data',
      });
    }
  } else {
    sources.push({
      id: 'mycase',
      name: 'Utah Courts (MyCase)',
      lastUpdated: null,
      status: 'unknown',
    });
  }

  // Gmail (Zack emails)
  const gmailZack = findLatestFile(scrapersPath, /zack_emails.*\.json$/);
  if (gmailZack) {
    try {
      const data = JSON.parse(fs.readFileSync(gmailZack.path, 'utf-8'));
      sources.push({
        id: 'gmail-zack',
        name: 'Gmail (Zack)',
        lastUpdated: gmailZack.mtime.toISOString(),
        status: isStale(gmailZack.mtime, 24) ? 'stale' : 'ready',
        count: Array.isArray(data) ? data.length : 0,
      });
    } catch {
      sources.push({
        id: 'gmail-zack',
        name: 'Gmail (Zack)',
        lastUpdated: null,
        status: 'error',
      });
    }
  } else {
    sources.push({
      id: 'gmail-zack',
      name: 'Gmail (Zack)',
      lastUpdated: null,
      status: 'unknown',
    });
  }

  // Gmail (Destiny emails)
  const gmailDestiny = findLatestFile(scrapersPath, /destiny_emails.*\.json$|gmail_current.*\.json$/);
  if (gmailDestiny) {
    try {
      const data = JSON.parse(fs.readFileSync(gmailDestiny.path, 'utf-8'));
      sources.push({
        id: 'gmail-destiny',
        name: 'Gmail (Destiny)',
        lastUpdated: gmailDestiny.mtime.toISOString(),
        status: isStale(gmailDestiny.mtime, 24) ? 'stale' : 'ready',
        count: Array.isArray(data) ? data.length : 0,
      });
    } catch {
      sources.push({
        id: 'gmail-destiny',
        name: 'Gmail (Destiny)',
        lastUpdated: null,
        status: 'error',
      });
    }
  } else {
    sources.push({
      id: 'gmail-destiny',
      name: 'Gmail (Destiny)',
      lastUpdated: null,
      status: 'unknown',
    });
  }

  // iMessages (Destiny)
  const imessages = findLatestFile(scrapersPath, /destiny.*imessages.*\.jsonl?$|messages.*destiny.*\.jsonl?$/i);
  if (imessages) {
    try {
      const content = fs.readFileSync(imessages.path, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());
      sources.push({
        id: 'imessages-destiny',
        name: 'iMessages (Destiny)',
        lastUpdated: imessages.mtime.toISOString(),
        status: isStale(imessages.mtime, 24) ? 'stale' : 'ready',
        count: lines.length,
      });
    } catch {
      sources.push({
        id: 'imessages-destiny',
        name: 'iMessages (Destiny)',
        lastUpdated: null,
        status: 'error',
      });
    }
  } else {
    sources.push({
      id: 'imessages-destiny',
      name: 'iMessages (Destiny)',
      lastUpdated: null,
      status: 'unknown',
    });
  }

  return NextResponse.json({ sources });
}

function isStale(date: Date, hoursThreshold: number): boolean {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return diff > hoursThreshold * 60 * 60 * 1000;
}

export async function POST(req: Request) {
  const { sourceId } = await req.json();
  const scrapersPath = getScrapersPath();

  try {
    let command = '';
    switch (sourceId) {
      case 'mycase':
        command = `cd "${scrapersPath}" && source venv/bin/activate && python mycase_scraper.py --visible`;
        break;
      case 'gmail-zack':
      case 'gmail-destiny':
        command = `cd "${scrapersPath}" && npm run ingest:gmail`;
        break;
      case 'imessages-destiny':
        command = `cd "${scrapersPath}" && npm run ingest:imessages`;
        break;
      default:
        return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
    }

    // Return immediately - refresh runs in background
    exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Refresh error for ${sourceId}:`, error);
      } else {
        console.log(`Refresh completed for ${sourceId}`);
      }
    });

    return NextResponse.json({ ok: true, message: `Refresh started for ${sourceId}` });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
