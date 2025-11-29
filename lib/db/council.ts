/**
 * Council Proposals Database Layer
 *
 * Provides persistent storage for org-council memory proposals.
 * Works alongside Zep for the actual knowledge graph storage.
 */

import { getDatabase } from './Database';
import { ensureServerOnly } from '../server-only-guard';

ensureServerOnly('lib/db/council');

export type ProposalStatus = 'pending' | 'approved' | 'rejected';

export interface CouncilProposal {
  id: string;
  proposed_by: string;
  text: string;
  metadata?: Record<string, any>;
  status: ProposalStatus;
  reviewed_by?: string;
  reviewed_at?: number;
  created_at: number;
  updated_at: number;
}

export interface CouncilNotification {
  id: number;
  proposal_id: string;
  notification_type: 'new_proposal' | 'approved' | 'rejected';
  recipient: string;
  read_at?: number;
  created_at: number;
}

/**
 * Create a new council proposal
 */
export function createProposal(
  id: string,
  proposedBy: string,
  text: string,
  metadata?: Record<string, any>
): CouncilProposal {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    INSERT INTO council_proposals (id, proposed_by, text, metadata, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `);

  stmt.run(id, proposedBy, text, metadata ? JSON.stringify(metadata) : null, now, now);

  // Create notification for council
  createNotification(id, 'new_proposal', 'council');

  return {
    id,
    proposed_by: proposedBy,
    text,
    metadata,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };
}

/**
 * Get a proposal by ID
 */
export function getProposal(id: string): CouncilProposal | null {
  const db = getDatabase();
  const stmt = db.prepare(`SELECT * FROM council_proposals WHERE id = ?`);
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

/**
 * Get all pending proposals
 */
export function getPendingProposals(): CouncilProposal[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM council_proposals
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `);
  const rows = stmt.all() as any[];

  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

/**
 * Get proposals by status
 */
export function getProposalsByStatus(status: ProposalStatus, limit = 50): CouncilProposal[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM council_proposals
    WHERE status = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `);
  const rows = stmt.all(status, limit) as any[];

  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

/**
 * Get all proposals (with pagination)
 */
export function getAllProposals(limit = 50, offset = 0): CouncilProposal[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM council_proposals
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(limit, offset) as any[];

  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

/**
 * Approve a proposal
 */
export function approveProposal(id: string, reviewedBy: string): boolean {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    UPDATE council_proposals
    SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ? AND status = 'pending'
  `);

  const result = stmt.run(reviewedBy, now, now, id);

  if (result.changes > 0) {
    createNotification(id, 'approved', 'council');
    return true;
  }
  return false;
}

/**
 * Reject a proposal
 */
export function rejectProposal(id: string, reviewedBy: string): boolean {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    UPDATE council_proposals
    SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ? AND status = 'pending'
  `);

  const result = stmt.run(reviewedBy, now, now, id);

  if (result.changes > 0) {
    createNotification(id, 'rejected', 'council');
    return true;
  }
  return false;
}

/**
 * Get proposal counts by status
 */
export function getProposalCounts(): Record<ProposalStatus, number> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM council_proposals
    GROUP BY status
  `);
  const rows = stmt.all() as { status: ProposalStatus; count: number }[];

  const counts: Record<ProposalStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  for (const row of rows) {
    counts[row.status] = row.count;
  }

  return counts;
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Create a notification
 */
export function createNotification(
  proposalId: string,
  type: 'new_proposal' | 'approved' | 'rejected',
  recipient: string
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO council_notifications (proposal_id, notification_type, recipient)
    VALUES (?, ?, ?)
  `);
  stmt.run(proposalId, type, recipient);
}

/**
 * Get unread notifications for a recipient
 */
export function getUnreadNotifications(recipient: string): (CouncilNotification & { proposal: CouncilProposal })[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT n.*, p.proposed_by, p.text, p.metadata, p.status, p.reviewed_by, p.reviewed_at, p.created_at as proposal_created_at, p.updated_at as proposal_updated_at
    FROM council_notifications n
    JOIN council_proposals p ON n.proposal_id = p.id
    WHERE n.recipient = ? AND n.read_at IS NULL
    ORDER BY n.created_at DESC
  `);
  const rows = stmt.all(recipient) as any[];

  return rows.map(row => ({
    id: row.id,
    proposal_id: row.proposal_id,
    notification_type: row.notification_type,
    recipient: row.recipient,
    read_at: row.read_at,
    created_at: row.created_at,
    proposal: {
      id: row.proposal_id,
      proposed_by: row.proposed_by,
      text: row.text,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      status: row.status,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      created_at: row.proposal_created_at,
      updated_at: row.proposal_updated_at,
    },
  }));
}

/**
 * Mark notifications as read
 */
export function markNotificationsRead(recipient: string, proposalIds?: string[]): number {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  if (proposalIds && proposalIds.length > 0) {
    const placeholders = proposalIds.map(() => '?').join(',');
    const stmt = db.prepare(`
      UPDATE council_notifications
      SET read_at = ?
      WHERE recipient = ? AND proposal_id IN (${placeholders}) AND read_at IS NULL
    `);
    const result = stmt.run(now, recipient, ...proposalIds);
    return result.changes;
  } else {
    const stmt = db.prepare(`
      UPDATE council_notifications
      SET read_at = ?
      WHERE recipient = ? AND read_at IS NULL
    `);
    const result = stmt.run(now, recipient);
    return result.changes;
  }
}

/**
 * Get notification count for a recipient
 */
export function getUnreadNotificationCount(recipient: string): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM council_notifications
    WHERE recipient = ? AND read_at IS NULL
  `);
  const row = stmt.get(recipient) as { count: number };
  return row.count;
}
