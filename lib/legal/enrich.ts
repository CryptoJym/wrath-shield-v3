import { LegalContextRequest, updateLegalContextRequest } from './store';

// Payload the legal agent (or UI) can send to resolve a legal context request.
export type LegalContextPayload = {
  id: string;
  summary: string;
  confidence?: number;
  action?: string;
  due_date?: string;
  rationale?: string;
  attachments?: string[];
  status?: 'pending' | 'resolved';
};

export function applyLegalResolution(reqId: string, payload: LegalContextPayload): LegalContextRequest | null {
  const status = payload.status || 'resolved';
  return updateLegalContextRequest(reqId, {
    status,
    summary: payload.summary,
    confidence: payload.confidence ?? 0.8,
    action: payload.action,
    due_date: payload.due_date,
    rationale: payload.rationale,
    attachments: payload.attachments,
  });
}
