import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const from = (form.get('From') as string) || '';
  const to = (form.get('To') as string) || '';
  const body = (form.get('Body') as string) || '';

  // TODO: optionally write to relationships DB or agentic_actions
  const line = JSON.stringify({ ts: new Date().toISOString(), from, to, body });
  console.log('[twilio webhook]', line);

  const twiml = `<Response></Response>`;
  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
