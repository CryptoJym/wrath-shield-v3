import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../lib/auth/user';
import { upsertTransactionsFromRows, TxnRow } from '../../../../lib/finance/store';
import { classify } from '../../../../lib/finance/rules';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const IMPORT_DIR = path.resolve(process.cwd(), '.data', 'finance', 'import');

// Cutoff date - only import transactions BEFORE this date to avoid Plaid duplicates
const CUTOFF_DATE = '2025-09-01';

type ParsedRow = {
  date: string; // YYYY-MM-DD
  amount: number; // positive = expense, negative = credit/payment
  description: string;
  account: string;
  raw: Record<string, string>;
};

/**
 * Generate a unique ID for a CSV transaction based on content
 */
function generateTxnId(account: string, date: string, amount: number, desc: string): string {
  const hash = crypto.createHash('md5')
    .update(`${account}|${date}|${amount.toFixed(2)}|${desc.substring(0, 50)}`)
    .digest('hex')
    .substring(0, 16);
  return `csv_${hash}`;
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): string | null {
  // Format: MM/DD/YYYY (AFCU, Wells Fargo)
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Format: YYYY-MM-DD (US Bank)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return dateStr;
  }

  return null;
}

/**
 * Parse AFCU CSV format
 * Headers: Date,No.,Description,Debit,Credit
 *
 * Two variants:
 * - Visa: Debit has positive values (25.42), Credit has negative ("-43.4")
 * - Checking: Debit has negative values (-100), Credit has positive (5000)
 */
function parseAfcuCsv(content: string, accountName: string): ParsedRow[] {
  const lines = content.split('\n');
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV with quoted fields
    const parts = parseCsvLine(line);
    if (parts.length < 5) continue;

    const [dateStr, , description, debitStr, creditStr] = parts;
    const date = parseDate(dateStr);
    if (!date) continue;

    // Skip if after cutoff
    if (date >= CUTOFF_DATE) continue;

    // Parse amounts (handle negative numbers, remove quotes/commas)
    const debit = parseFloat(debitStr.replace(/[,$"]/g, '')) || 0;
    const credit = parseFloat(creditStr.replace(/[,$"]/g, '')) || 0;

    // Handle both AFCU export formats:
    // Visa: debit=positive expense, credit=negative refund → amount = debit - credit
    // Checking: debit=negative expense, credit=positive deposit → amount = -debit - credit
    //
    // We want: positive = expense, negative = income/credit
    let amount: number;
    if (debit < 0 || credit > 0) {
      // Checking format: debit is negative, credit is positive
      amount = -debit - credit; // Expense (was -100) → +100, Credit (was 5000) → -5000
    } else {
      // Visa format: debit is positive expense, credit is negative refund
      amount = debit + credit; // Expense stays positive, credit (negative) becomes negative
    }

    if (amount === 0) continue;

    rows.push({
      date,
      amount,
      description: description.trim(),
      account: accountName,
      raw: { Date: dateStr, Description: description, Debit: debitStr, Credit: creditStr },
    });
  }

  return rows;
}

/**
 * Parse US Bank CSV format
 * Headers: Date,Transaction,Name,Memo,Amount
 * Amount: negative = expense, positive = payment
 */
function parseUsBankCsv(content: string): ParsedRow[] {
  const lines = content.split('\n');
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCsvLine(line);
    if (parts.length < 5) continue;

    const [dateStr, , name, memo, amountStr] = parts;
    const date = parseDate(dateStr);
    if (!date) continue;

    if (date >= CUTOFF_DATE) continue;

    // US Bank: negative = expense, positive = payment
    const rawAmount = parseFloat(amountStr.replace(/[,$]/g, '')) || 0;
    const amount = -rawAmount; // Flip sign: expenses become positive

    if (amount === 0) continue;

    rows.push({
      date,
      amount,
      description: `${name} ${memo}`.trim(),
      account: 'US Bank',
      raw: { Date: dateStr, Name: name, Memo: memo, Amount: amountStr },
    });
  }

  return rows;
}

/**
 * Parse Wells Fargo CSV format
 * No headers: Date,Amount,*,,Description
 */
function parseWellsFargoCsv(content: string): ParsedRow[] {
  const lines = content.split('\n');
  const rows: ParsedRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCsvLine(line);
    if (parts.length < 5) continue;

    const [dateStr, amountStr, , , description] = parts;
    const date = parseDate(dateStr);
    if (!date) continue;

    if (date >= CUTOFF_DATE) continue;

    // Wells Fargo: positive = payment, negative = expense
    const rawAmount = parseFloat(amountStr.replace(/[,$]/g, '')) || 0;
    const amount = -rawAmount; // Flip sign

    if (amount === 0) continue;

    rows.push({
      date,
      amount,
      description: description.trim(),
      account: 'Wells Fargo',
      raw: { Date: dateStr, Amount: amountStr, Description: description },
    });
  }

  return rows;
}

/**
 * Parse AMEX CSV format
 * Headers: Date,Receipt,Description,Amount,...
 * Or: Date,Description,Amount,...
 * Amount: positive = expense, negative = payment
 */
function parseAmexCsv(content: string, accountName: string): ParsedRow[] {
  const lines = content.split('\n');
  const rows: ParsedRow[] = [];

  // Detect format from header
  const header = lines[0]?.toLowerCase() || '';
  const hasReceipt = header.includes('receipt');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCsvLine(line);
    if (parts.length < 3) continue;

    let dateStr: string, description: string, amountStr: string;

    if (hasReceipt) {
      // Date,Receipt,Description,Amount,...
      dateStr = parts[0];
      description = parts[2];
      amountStr = parts[3];
    } else {
      // Date,Description,Amount,...
      dateStr = parts[0];
      description = parts[1];
      amountStr = parts[2];
    }

    const date = parseDate(dateStr);
    if (!date) continue;

    if (date >= CUTOFF_DATE) continue;

    // AMEX: positive = expense, negative = payment/credit
    const amount = parseFloat(amountStr.replace(/[,$]/g, '')) || 0;

    if (amount === 0) continue;

    rows.push({
      date,
      amount,
      description: description.trim(),
      account: accountName,
      raw: { Date: dateStr, Description: description, Amount: amountStr },
    });
  }

  return rows;
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Convert parsed rows to TxnRows
 */
function toTxnRows(parsed: ParsedRow[], userId: string): TxnRow[] {
  return parsed.map(p => {
    const row: TxnRow = {
      id: generateTxnId(p.account, p.date, p.amount, p.description),
      user_id: userId,
      account: p.account,
      amount: p.amount,
      iso_currency_code: 'USD',
      date: p.date,
      vendor: extractVendor(p.description),
      raw_desc: JSON.stringify(p.raw),
      bucket: undefined,
      project: undefined,
      reimbursable: false,
      source: 'csv',
      status: 'pending_review',
    };
    return classify(row);
  });
}

/**
 * Extract vendor name from description
 */
function extractVendor(desc: string): string {
  // Remove common prefixes
  let vendor = desc
    .replace(/^VISA - \d{2}\/\d{2}\s+/i, '')
    .replace(/^AUTOMATIC (WITHDRAWAL|DEPOSIT),?\s*/i, '')
    .replace(/^(DEBIT|CREDIT)\s*/i, '')
    .replace(/^MOBILE BANKING PAYMENT\s*/i, '')
    .replace(/^PURCHASE RETURN VISA CREDIT - \d{2}\/\d{2}\s*/i, '')
    .trim();

  // Take first meaningful part (before location/phone)
  const parts = vendor.split(/\s{2,}/);
  return parts[0]?.trim() || vendor;
}

/**
 * POST /api/finance/csv-import
 * Body: { files?: string[], beforeDate?: string }
 *
 * Imports CSV files from the import directory
 * Only imports transactions BEFORE the cutoff date (default: Sept 1, 2025)
 */
export async function POST(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json().catch(() => ({}));

    const cutoff = body.beforeDate || CUTOFF_DATE;

    if (!fs.existsSync(IMPORT_DIR)) {
      return NextResponse.json({ error: 'Import directory not found' }, { status: 404 });
    }

    const files = fs.readdirSync(IMPORT_DIR).filter(f => f.endsWith('.csv'));
    const results: Record<string, { imported: number; skipped: number; error?: string }> = {};
    const allRows: TxnRow[] = [];

    for (const file of files) {
      const filePath = path.join(IMPORT_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');

      let parsed: ParsedRow[] = [];

      try {
        // Detect format and parse
        if (file.includes('afcu') && file.includes('export')) {
          // AFCU Visa
          parsed = parseAfcuCsv(content, 'AFCU Visa');
        } else if (file.includes('checking')) {
          // AFCU Checking
          parsed = parseAfcuCsv(content, 'AFCU Checking');
        } else if (file.includes('usbank')) {
          parsed = parseUsBankCsv(content);
        } else if (file.includes('wells-fargo')) {
          parsed = parseWellsFargoCsv(content);
        } else if (file.includes('activity') || file.includes('amex')) {
          // AMEX files - detect which card from content
          const isBusinessPrime = content.includes('APOLLO') || content.includes('INSTANTLY') || content.includes('CURSOR');
          const accountName = isBusinessPrime ? 'AMEX Business Prime' : 'AMEX Delta SkyMiles';
          parsed = parseAmexCsv(content, accountName);
        } else if (file.includes('rewrite')) {
          // Skip Rewrite LLC - business account not needed
          results[file] = { imported: 0, skipped: 0, error: 'Skipped (business account)' };
          continue;
        } else {
          results[file] = { imported: 0, skipped: 0, error: 'Unknown format' };
          continue;
        }

        // Filter by cutoff date and convert
        const beforeCutoff = parsed.filter(p => p.date < cutoff);
        const txnRows = toTxnRows(beforeCutoff, userId);

        allRows.push(...txnRows);
        results[file] = {
          imported: txnRows.length,
          skipped: parsed.length - beforeCutoff.length,
        };
      } catch (e: any) {
        results[file] = { imported: 0, skipped: 0, error: e.message };
      }
    }

    // Upsert all rows
    if (allRows.length > 0) {
      await upsertTransactionsFromRows(allRows, userId);
    }

    // Summarize by account
    const byAccount: Record<string, number> = {};
    for (const row of allRows) {
      byAccount[row.account] = (byAccount[row.account] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      cutoffDate: cutoff,
      totalImported: allRows.length,
      byAccount,
      byFile: results,
      message: `Imported ${allRows.length} transactions from ${Object.keys(results).filter(f => (results[f]?.imported || 0) > 0).length} files (before ${cutoff})`,
    });
  } catch (e: any) {
    console.error('[csv-import] Error:', e);
    return NextResponse.json({ error: e.message || 'Import failed' }, { status: 500 });
  }
}

/**
 * GET /api/finance/csv-import
 * Returns list of available CSV files and their detected formats
 */
export async function GET() {
  try {
    currentUserOrThrow();

    if (!fs.existsSync(IMPORT_DIR)) {
      return NextResponse.json({ files: [], message: 'Import directory not found' });
    }

    const files = fs.readdirSync(IMPORT_DIR)
      .filter(f => f.endsWith('.csv'))
      .map(f => {
        const stat = fs.statSync(path.join(IMPORT_DIR, f));
        let format = 'unknown';

        if (f.includes('afcu') || f.includes('checking')) format = 'afcu';
        else if (f.includes('usbank')) format = 'usbank';
        else if (f.includes('wells-fargo')) format = 'wellsfargo';
        else if (f.includes('activity') || f.includes('amex')) format = 'amex';
        else if (f.includes('rewrite')) format = 'rewrite (skipped)';

        return {
          name: f,
          format,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        };
      });

    return NextResponse.json({
      files,
      importDir: IMPORT_DIR,
      cutoffDate: CUTOFF_DATE,
      message: `Found ${files.length} CSV files. Import will only include transactions before ${CUTOFF_DATE}.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
