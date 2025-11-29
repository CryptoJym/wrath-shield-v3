import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CourtData = {
  caseNumber: string | null;
  fileDate: string | null;
  assignedJudge: string | null;
  nextHearing: {
    date: string | null;
    time: string | null;
    raw: string | null;
  };
  court: string | null;
  caseType: string | null;
  parties: Array<{
    type: string;
    name: string;
    attorney: string | null;
  }>;
  scrapedAt: string | null;
  rawText: string | null;
};

function getScrapedDataPath() {
  return path.resolve(process.cwd(), 'packages', 'legal-scrapers', 'scraped_data');
}

function findLatestMycaseFile(): string | null {
  const dir = getScrapedDataPath();
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('mycase_data_') && f.endsWith('.json'))
    .map(f => {
      const filePath = path.join(dir, f);
      const stat = fs.statSync(filePath);
      return { path: filePath, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files[0]?.path || null;
}

function parseRawText(rawText: string): Partial<CourtData> {
  const result: Partial<CourtData> = {
    parties: [],
  };

  // Extract case number
  const caseMatch = rawText.match(/Case Number:\s*\n?\s*(\d+)/);
  if (caseMatch) result.caseNumber = caseMatch[1];

  // Extract file date
  const fileDateMatch = rawText.match(/File Date:\s*\n?\s*([\d-]+)/);
  if (fileDateMatch) result.fileDate = fileDateMatch[1];

  // Extract judge
  const judgeMatch = rawText.match(/Assigned Judge:\s*\n?\s*([A-Z\s]+?)(?:\n|$)/);
  if (judgeMatch) result.assignedJudge = judgeMatch[1].trim();

  // Extract next hearing - this is the key field!
  const hearingMatch = rawText.match(/Next Hearing:\s*\n?\s*([\d-]+)\s+([\d:]+\s*[AP]M)/i);
  if (hearingMatch) {
    result.nextHearing = {
      date: hearingMatch[1],
      time: hearingMatch[2],
      raw: `${hearingMatch[1]} ${hearingMatch[2]}`,
    };
  }

  // Extract court
  const courtMatch = rawText.match(/(FOURTH JUDICIAL DISTRICT[^]*?COURT)/i);
  if (courtMatch) result.court = courtMatch[1].replace(/\n/g, ' ').trim();

  // Extract case type
  const typeMatch = rawText.match(/Divorce\/Annulment Case|Civil Case|Criminal Case/i);
  if (typeMatch) result.caseType = typeMatch[0];

  // Extract parties from table format
  const partyMatches = rawText.matchAll(/(?:Respondent|Petitioner|Plaintiff|Defendant)\s+([A-Z\s,]+?)\s+([A-Z\s]+?)(?:\n|$)/gi);
  for (const match of partyMatches) {
    // This is tricky - the table format varies
  }

  // Better party extraction from table_0 or raw patterns
  const respondentMatch = rawText.match(/Respondent\s+([A-Z\s]+)\s+([A-Z\s]+?)(?:\n|Petitioner)/i);
  if (respondentMatch) {
    result.parties?.push({
      type: 'Respondent',
      name: respondentMatch[1].trim(),
      attorney: respondentMatch[2].trim(),
    });
  }

  const petitionerMatches = [...rawText.matchAll(/Petitioner\s+([A-Z\s]+?)\s+([A-Z\s]+?)(?:\n|Petitioner|Account|$)/gi)];
  for (const match of petitionerMatches) {
    result.parties?.push({
      type: 'Petitioner',
      name: match[1].trim(),
      attorney: match[2].trim(),
    });
  }

  return result;
}

export async function GET() {
  const filePath = findLatestMycaseFile();

  if (!filePath) {
    return NextResponse.json({
      error: 'No court data found',
      data: null,
    });
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rawData = JSON.parse(fileContent);

    // Parse the raw text to extract structured data
    const parsed = parseRawText(rawData.raw_text || '');

    // Also try to get data from table_0 (parties table)
    const parties: CourtData['parties'] = [];
    if (rawData.table_0 && Array.isArray(rawData.table_0)) {
      for (let i = 1; i < rawData.table_0.length; i++) {
        const row = rawData.table_0[i];
        if (row && row.length >= 3) {
          parties.push({
            type: row[0] || '',
            name: row[1] || '',
            attorney: row[2] || null,
          });
        }
      }
    }

    const courtData: CourtData = {
      caseNumber: parsed.caseNumber || null,
      fileDate: parsed.fileDate || null,
      assignedJudge: parsed.assignedJudge || null,
      nextHearing: parsed.nextHearing || { date: null, time: null, raw: null },
      court: parsed.court || null,
      caseType: parsed.caseType || null,
      parties: parties.length > 0 ? parties : (parsed.parties || []),
      scrapedAt: rawData.scraped_at || null,
      rawText: rawData.raw_text || null,
    };

    return NextResponse.json({
      data: courtData,
      file: path.basename(filePath),
      scrapedAt: rawData.scraped_at,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Failed to parse court data',
      data: null,
    }, { status: 500 });
  }
}
