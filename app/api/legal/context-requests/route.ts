import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../lib/auth/user';
import {
  createLegalContextRequest,
  listLegalContextRequests,
  updateLegalContextRequest,
} from '../../../../lib/legal/store';
import { applyLegalResolution } from '../../../../lib/legal/enrich';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { userId } = currentUserOrThrow();
  const rows = listLegalContextRequests('pending', userId);
  return NextResponse.json({ requests: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { userId } = currentUserOrThrow();

  // Legal agent resolution payload (parity with comms agent pattern)
  if (body.legal === true && body.id && body.summary) {
    const updated = applyLegalResolution(body.id, {
      id: body.id,
      summary: body.summary,
      confidence: body.confidence,
      action: body.action,
      due_date: body.due_date,
      rationale: body.rationale,
      attachments: body.attachments,
      status: body.status,
    });
    return NextResponse.json({ request: updated });
  }

  // Manual update
  if (body.id && body.status) {
    const updated = updateLegalContextRequest(body.id, {
      status: body.status,
      summary: body.summary,
      confidence: body.confidence,
      action: body.action,
      due_date: body.due_date,
      rationale: body.rationale,
      attachments: body.attachments,
    });
    return NextResponse.json({ request: updated });
  }

  // Create new context request
  const created = createLegalContextRequest({
    user_id: userId,
    case_number: body.case_number,
    contact: body.contact,
    topic: body.topic,
    source: body.source,
    summary: body.summary,
    confidence: body.confidence,
    status: body.status || 'pending',
    due_date: body.due_date,
    action: body.action,
    rationale: body.rationale,
    attachments: body.attachments,
  });
  return NextResponse.json({ request: created });
}
