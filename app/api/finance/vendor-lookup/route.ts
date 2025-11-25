import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });
  try {
    const resp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`, {
      headers: { 'User-Agent': 'wrath-shield-finance/1.0' },
    });
    const data = await resp.json();
    return NextResponse.json({
      heading: data?.Heading || null,
      abstract: data?.Abstract || null,
      url: data?.AbstractURL || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'lookup failed' }, { status: 500 });
  }
}
