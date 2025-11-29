import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Attachment = {
  id: string;
  name: string;
  type: 'pdf' | 'screenshot' | 'json' | 'text' | 'other';
  source: string;
  path: string;
  size: number;
  createdAt: string;
};

function getScrapersPath() {
  return path.resolve(process.cwd(), 'packages', 'legal-scrapers');
}

function getScrapedDataPath() {
  return path.resolve(getScrapersPath(), 'scraped_data');
}

export async function GET() {
  const scrapedData = getScrapedDataPath();
  const attachments: Attachment[] = [];

  if (!fs.existsSync(scrapedData)) {
    return NextResponse.json({ attachments });
  }

  // Scan for screenshots
  const screenshotsDir = path.join(scrapedData, 'screenshots');
  if (fs.existsSync(screenshotsDir)) {
    const files = fs.readdirSync(screenshotsDir);
    for (const file of files) {
      if (/\.(png|jpg|jpeg|gif)$/i.test(file)) {
        const filePath = path.join(screenshotsDir, file);
        const stat = fs.statSync(filePath);
        attachments.push({
          id: `screenshot-${file}`,
          name: file,
          type: 'screenshot',
          source: 'MyCase Scraper',
          path: `/api/legal/attachments/file?path=${encodeURIComponent(filePath)}`,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        });
      }
    }
  }

  // Scan for PDFs in downloads or scraped data
  const pdfDirs = [scrapedData, path.join(scrapedData, 'downloads')];
  for (const dir of pdfDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (/\.pdf$/i.test(file)) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          attachments.push({
            id: `pdf-${file}`,
            name: file,
            type: 'pdf',
            source: 'Court Filing',
            path: `/api/legal/attachments/file?path=${encodeURIComponent(filePath)}`,
            size: stat.size,
            createdAt: stat.mtime.toISOString(),
          });
        }
      }
    }
  }

  // Scan for MyCase JSON data files
  const dataFiles = fs.readdirSync(scrapedData).filter(f =>
    f.startsWith('mycase_data_') && f.endsWith('.json')
  );
  for (const file of dataFiles) {
    const filePath = path.join(scrapedData, file);
    const stat = fs.statSync(filePath);
    attachments.push({
      id: `json-${file}`,
      name: file,
      type: 'json',
      source: 'Utah Courts',
      path: `/api/legal/attachments/file?path=${encodeURIComponent(filePath)}`,
      size: stat.size,
      createdAt: stat.mtime.toISOString(),
    });
  }

  // Sort by most recent first
  attachments.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ attachments });
}
