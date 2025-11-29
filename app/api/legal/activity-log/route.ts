import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ActivityEntry = {
  id: string;
  type: 'ingest' | 'analyze' | 'draft' | 'refresh';
  action: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
  details?: string;
};

function getScrapersPath() {
  return path.resolve(process.cwd(), 'packages', 'legal-scrapers');
}

function getScrapedDataPath() {
  return path.resolve(getScrapersPath(), 'scraped_data');
}

function findAllFiles(dir: string, pattern: RegExp, maxFiles = 20): Array<{ name: string; path: string; mtime: Date }> {
  if (!fs.existsSync(dir)) return [];

  const results: Array<{ name: string; path: string; mtime: Date }> = [];

  function scan(currentDir: string) {
    try {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        if (results.length >= maxFiles) return;
        const itemPath = path.join(currentDir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory() && !item.startsWith('.')) {
          scan(itemPath);
        } else if (stat.isFile() && pattern.test(item)) {
          results.push({ name: item, path: itemPath, mtime: stat.mtime });
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  scan(dir);
  return results.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

export async function GET() {
  const scrapersPath = getScrapersPath();
  const scrapedData = getScrapedDataPath();
  const activities: ActivityEntry[] = [];

  // Find MyCase scrapes
  const mycaseFiles = findAllFiles(scrapedData, /mycase_data_.*\.json$/);
  for (const file of mycaseFiles.slice(0, 5)) {
    activities.push({
      id: `mycase-${file.name}`,
      type: 'ingest',
      action: 'Utah Courts scrape',
      timestamp: file.mtime.toISOString(),
      status: 'success',
      details: file.name,
    });
  }

  // Find strategic briefs
  const briefFiles = findAllFiles(path.join(scrapedData, 'analysis'), /strategic_brief_.*\.json$/);
  for (const file of briefFiles.slice(0, 5)) {
    activities.push({
      id: `brief-${file.name}`,
      type: 'analyze',
      action: 'Strategic brief generated',
      timestamp: file.mtime.toISOString(),
      status: 'success',
      details: file.name,
    });
  }

  // Find summaries
  const summaryFiles = findAllFiles(path.join(scrapedData, 'analysis'), /summary_.*\.txt$/);
  for (const file of summaryFiles.slice(0, 5)) {
    activities.push({
      id: `summary-${file.name}`,
      type: 'analyze',
      action: 'Case summary generated',
      timestamp: file.mtime.toISOString(),
      status: 'success',
      details: file.name,
    });
  }

  // Find email exports
  const emailFiles = findAllFiles(scrapersPath, /.*emails.*\.json$/i);
  for (const file of emailFiles.slice(0, 3)) {
    activities.push({
      id: `email-${file.name}`,
      type: 'ingest',
      action: 'Gmail export',
      timestamp: file.mtime.toISOString(),
      status: 'success',
      details: file.name,
    });
  }

  // Find iMessage exports
  const imessageFiles = findAllFiles(scrapersPath, /.*imessages.*\.jsonl?$/i);
  for (const file of imessageFiles.slice(0, 3)) {
    activities.push({
      id: `imessage-${file.name}`,
      type: 'ingest',
      action: 'iMessage export',
      timestamp: file.mtime.toISOString(),
      status: 'success',
      details: file.name,
    });
  }

  // Sort all activities by timestamp
  activities.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json({ activities: activities.slice(0, 20) });
}
