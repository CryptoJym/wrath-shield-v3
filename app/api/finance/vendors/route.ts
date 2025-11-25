import { NextResponse } from 'next/server';
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { currentUserOrThrow } from '../../../../lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = {
  searchParams: URLSearchParams;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { userId } = currentUserOrThrow();
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const limit = Number(url.searchParams.get('limit') || 30);
  const minCount = Number(url.searchParams.get('minCount') || 0);

  const db = new BetterSqlite3(path.resolve(process.cwd(), '.data', 'finance', 'finance.db'));

  const where: string[] = [];
  const params: any[] = [];
  if (start && end) {
    where.push('date >= ? AND date < ?');
    params.push(start, end);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const minCountSql = minCount > 0 ? `HAVING count >= ${minCount}` : '';

  const userClause = " AND (user_id = ? OR user_id IS NULL OR user_id = 'default')";
  params.push(userId);
  const rows = db
    .prepare(
      `SELECT vendor, COUNT(*) as count, SUM(amount) as total
       FROM finance_transactions
       ${whereSql}${whereSql ? userClause : userClause.replace(' AND ', ' WHERE ')}
       GROUP BY vendor
       ${minCountSql}
       ORDER BY total DESC
       LIMIT ${limit}`
    )
    .all(...params) as any[];
  db.close();
  return NextResponse.json({ vendors: rows });
}
