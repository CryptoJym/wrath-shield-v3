import { ContextRequest, updateContextRequest, updateTransaction } from './store';

// This module defines the expected payload for comms-agent responses.
// The comms agent (with Gmail/Outlook access) can POST summaries to /api/finance/context-requests.

export type CommsContextPayload = {
  id: string; // context request id
  summary: string; // short text, e.g., "Receipt: OpenAI API Nov 2025, $21.48, reimbursable"
  confidence?: number; // 0-1
  bucket?: string;
  project?: string;
  reimbursable?: boolean;
  note?: string;
  rationale?: string;
};

export function applyCommsContext(reqId: string, payload: CommsContextPayload) {
  const updated = updateContextRequest(reqId, {
    status: 'resolved',
    summary: payload.summary,
    confidence: payload.confidence ?? 0.8,
    bucket: payload.bucket,
    project: payload.project,
    reimbursable: payload.reimbursable,
    note: payload.note,
    rationale: payload.rationale,
  });
  if (updated?.txn_id) {
    updateTransaction(updated.txn_id, {
      bucket: payload.bucket ?? updated.bucket ?? undefined,
      project: payload.project ?? updated.project ?? undefined,
      reimbursable:
        payload.reimbursable === undefined ? (updated.reimbursable as any) : payload.reimbursable,
      status: 'confirmed',
      confidence: payload.confidence ?? updated?.confidence ?? 0.8,
      meta: {
        ...(updated?.summary ? { context_summary: updated.summary } : {}),
        ...(payload.note ? { context_note: payload.note } : {}),
        ...(payload.rationale ? { reimbursement_rationale: payload.rationale } : {}),
      },
    });
  }
  return updated;
}
