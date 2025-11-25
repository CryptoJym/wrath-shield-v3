import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getScrapersPath() {
  return path.resolve(process.cwd(), 'packages', 'legal-scrapers');
}

function getScrapedDataPath() {
  return path.resolve(getScrapersPath(), 'scraped_data');
}

function getAnalysisPath() {
  return path.resolve(getScrapersPath(), 'scraped_data', 'analysis');
}

// Parse court data from mycase scrape
function getCourtData(): { nextHearing: { date: string; time: string } | null; caseNumber: string | null; judge: string | null } {
  const dir = getScrapedDataPath();
  if (!fs.existsSync(dir)) return { nextHearing: null, caseNumber: null, judge: null };

  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('mycase_data_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return { nextHearing: null, caseNumber: null, judge: null };

  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf-8'));
    const rawText = data.raw_text || '';

    const caseMatch = rawText.match(/Case Number:\s*\n?\s*(\d+)/);
    const judgeMatch = rawText.match(/Assigned Judge:\s*\n?\s*([A-Z\s]+?)(?:\n|$)/);
    const hearingMatch = rawText.match(/Next Hearing:\s*\n?\s*([\d-]+)\s+([\d:]+\s*[AP]M)/i);

    return {
      nextHearing: hearingMatch ? { date: hearingMatch[1], time: hearingMatch[2] } : null,
      caseNumber: caseMatch ? caseMatch[1] : null,
      judge: judgeMatch ? judgeMatch[1].trim() : null,
    };
  } catch {
    return { nextHearing: null, caseNumber: null, judge: null };
  }
}

function findLatestBrief(): { content: any; path: string; mtime: Date } | null {
  const analysisDir = getAnalysisPath();
  if (!fs.existsSync(analysisDir)) return null;

  const files = fs.readdirSync(analysisDir)
    .filter(f => f.startsWith('strategic_brief_') && f.endsWith('.json'))
    .map(f => {
      const filePath = path.join(analysisDir, f);
      const stat = fs.statSync(filePath);
      return { path: filePath, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length === 0) return null;

  try {
    const content = JSON.parse(fs.readFileSync(files[0].path, 'utf-8'));
    return { content, path: files[0].path, mtime: files[0].mtime };
  } catch {
    return null;
  }
}

function findLatestSummary(): { content: string; path: string; mtime: Date } | null {
  const analysisDir = getAnalysisPath();
  if (!fs.existsSync(analysisDir)) return null;

  const files = fs.readdirSync(analysisDir)
    .filter(f => f.startsWith('summary_') && f.endsWith('.txt'))
    .map(f => {
      const filePath = path.join(analysisDir, f);
      const stat = fs.statSync(filePath);
      return { path: filePath, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length === 0) return null;

  try {
    const content = fs.readFileSync(files[0].path, 'utf-8');
    return { content, path: files[0].path, mtime: files[0].mtime };
  } catch {
    return null;
  }
}

export async function GET() {
  const brief = findLatestBrief();
  const summary = findLatestSummary();
  const courtData = getCourtData();

  if (brief) {
    // Merge court data into the brief
    const data = {
      ...brief.content,
      next_hearing: courtData.nextHearing || brief.content.next_hearing || {},
      case_number: courtData.caseNumber || brief.content.case_number,
      judge: courtData.judge || brief.content.judge,
    };

    return NextResponse.json({
      type: 'brief',
      data,
      generatedAt: brief.mtime.toISOString(),
      file: path.basename(brief.path),
    });
  }

  if (summary) {
    return NextResponse.json({
      type: 'summary',
      data: {
        text: summary.content,
        next_hearing: courtData.nextHearing,
        case_number: courtData.caseNumber,
        judge: courtData.judge,
      },
      generatedAt: summary.mtime.toISOString(),
      file: path.basename(summary.path),
    });
  }

  // Even with no brief, return court data if available
  if (courtData.nextHearing) {
    return NextResponse.json({
      type: 'court_only',
      data: {
        next_hearing: courtData.nextHearing,
        case_number: courtData.caseNumber,
        judge: courtData.judge,
      },
      message: 'Court data available. Click Regenerate for full analysis.',
    });
  }

  return NextResponse.json({
    type: 'none',
    data: null,
    message: 'No strategic brief available. Click Regenerate to create one.',
  });
}

export async function POST() {
  const scrapersPath = getScrapersPath();

  try {
    // Run the analyzer
    const { stdout, stderr } = await execAsync(
      `cd "${scrapersPath}" && source venv/bin/activate && python unified_legal_analyzer.py`,
      { timeout: 180000 }
    );

    console.log('Analyzer output:', stdout);
    if (stderr) console.error('Analyzer stderr:', stderr);

    // Get the fresh brief
    const brief = findLatestBrief();
    const summary = findLatestSummary();

    if (brief) {
      return NextResponse.json({
        ok: true,
        type: 'brief',
        data: brief.content,
        generatedAt: brief.mtime.toISOString(),
      });
    }

    if (summary) {
      return NextResponse.json({
        ok: true,
        type: 'summary',
        data: { text: summary.content },
        generatedAt: summary.mtime.toISOString(),
      });
    }

    return NextResponse.json({
      ok: false,
      error: 'Analyzer ran but no output generated',
    }, { status: 500 });
  } catch (error: any) {
    console.error('Analyzer error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to run analyzer',
    }, { status: 500 });
  }
}
