/**
 * Unified Orchestration Summary API
 *
 * Returns aggregated data about the orchestration system including:
 * - Signal source distribution
 * - Escalation level breakdown
 * - Priority distribution
 * - Recent decisions
 * - VIP activity
 * - Domain distribution
 *
 * Database Schema Reference (from lib/pm/task-queue.ts):
 * - id: TEXT PRIMARY KEY
 * - signal_id: TEXT
 * - signal_source: TEXT (comms, inbox, legal, finance, eeg, github, calendar)
 * - signal_type: TEXT (task, deadline, follow_up, energy_window, commit, mention)
 * - signal_payload: TEXT (JSON)
 * - signal_timestamp: INTEGER
 * - signal_confidence: REAL
 * - triage_action: TEXT
 * - triage_rationale: TEXT
 * - triage_priority: TEXT (critical, high, medium, low)
 * - triage_escalation_level: TEXT (auto, propose, critical)
 * - triage_due_date: TEXT
 * - triage_assigned_project: TEXT
 * - triage_suggested_title: TEXT
 * - triage_suggested_labels: TEXT (JSON array)
 * - triage_metadata: TEXT (JSON with ai_powered, rule_id, etc.)
 * - status: TEXT (pending, processing, completed, failed, deferred)
 * - created_at: INTEGER (Unix timestamp)
 * - processed_at: INTEGER
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/Database';

// Prevent static generation - this route requires database access
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDatabase();
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

    // Get signal source distribution (last 7 days)
    // Note: ai_powered is stored in triage_metadata JSON
    const sourceDistribution = db.prepare(`
      SELECT
        signal_source as source,
        COUNT(*) as count,
        SUM(CASE
          WHEN json_extract(triage_metadata, '$.ai_powered') = 1
            OR json_extract(triage_metadata, '$.ai_powered') = true
          THEN 1
          ELSE 0
        END) as ai_processed
      FROM pm_queue
      WHERE created_at > ?
      GROUP BY signal_source
      ORDER BY count DESC
    `).all(sevenDaysAgo) as Array<{ source: string; count: number; ai_processed: number }>;

    // Get escalation level breakdown (last 7 days)
    // Note: values are lowercase (auto, propose, critical)
    const escalationBreakdown = db.prepare(`
      SELECT
        triage_escalation_level as level,
        COUNT(*) as count
      FROM pm_queue
      WHERE created_at > ?
      GROUP BY triage_escalation_level
    `).all(sevenDaysAgo) as Array<{ level: string; count: number }>;

    // Get priority distribution
    const priorityDistribution = db.prepare(`
      SELECT
        triage_priority as priority,
        COUNT(*) as count
      FROM pm_queue
      WHERE created_at > ?
      GROUP BY triage_priority
      ORDER BY
        CASE triage_priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END
    `).all(sevenDaysAgo) as Array<{ priority: string; count: number }>;

    // Get recent decisions (last 20)
    const recentDecisions = db.prepare(`
      SELECT
        id,
        signal_id,
        signal_source as source,
        signal_type,
        signal_payload as payload,
        signal_confidence,
        status,
        created_at,
        triage_action,
        triage_priority,
        triage_escalation_level,
        triage_rationale,
        triage_metadata
      FROM pm_queue
      ORDER BY created_at DESC
      LIMIT 20
    `).all() as Array<{
      id: string;
      signal_id: string;
      source: string;
      signal_type: string;
      payload: string;
      signal_confidence: number;
      status: string;
      created_at: number;
      triage_action: string;
      triage_priority: string;
      triage_escalation_level: string;
      triage_rationale: string;
      triage_metadata: string;
    }>;

    // Parse payload for title/content and extract metadata
    const decisionsWithDetails = recentDecisions.map(d => {
      let title = 'Unknown';
      let content = '';
      let contactName = '';
      let domainId = '';
      let isVip = false;
      let aiPowered = false;

      // Parse signal payload
      try {
        const payload = JSON.parse(d.payload || '{}');
        title = payload.title || payload.subject || payload.triage_suggested_title || 'Unknown';
        content = payload.content || payload.body || payload.preview || '';
        contactName = payload.contact_name || '';
        domainId = payload.domain_id || '';
        isVip = payload.is_vip || false;
      } catch {
        // Ignore parse errors
      }

      // Parse triage metadata for decision source
      try {
        const metadata = JSON.parse(d.triage_metadata || '{}');
        aiPowered = metadata.ai_powered === true;
      } catch {
        // Ignore parse errors
      }

      return {
        id: d.id,
        signal_id: d.signal_id,
        source: d.source,
        signal_type: d.signal_type,
        status: d.status,
        timestamp: new Date(d.created_at * 1000).toISOString(),
        triage_action: d.triage_action,
        triage_priority: d.triage_priority,
        triage_escalation_level: d.triage_escalation_level,
        triage_rationale: d.triage_rationale,
        triage_decision_source: aiPowered ? 'ai' : 'rules',
        triage_confidence: d.signal_confidence,
        title,
        content: content.slice(0, 100),
        contact_name: contactName,
        domain_id: domainId,
        is_vip: isVip,
      };
    });

    // Get pending review items (need human decision)
    // Escalation levels are lowercase: 'critical', 'propose'
    const pendingReview = db.prepare(`
      SELECT COUNT(*) as count
      FROM pm_queue
      WHERE status = 'pending'
      AND (
        triage_escalation_level = 'critical'
        OR triage_escalation_level = 'propose'
        OR signal_confidence < 0.6
      )
    `).get() as { count: number };

    // Get auto-executed count (last 24h)
    // Escalation level is lowercase: 'auto'
    const autoExecuted = db.prepare(`
      SELECT COUNT(*) as count
      FROM pm_queue
      WHERE created_at > ?
      AND triage_escalation_level = 'auto'
      AND status IN ('completed', 'processing')
    `).get(oneDayAgo) as { count: number };

    // Get VIP contact activity (if contacts table exists)
    let vipActivity: Array<{ name: string; count: number }> = [];
    try {
      vipActivity = db.prepare(`
        SELECT
          c.display_name as name,
          COUNT(*) as count
        FROM pm_queue pq
        JOIN contacts c ON json_extract(pq.signal_payload, '$.contact_handle') = c.handle
        WHERE c.message_count >= 50
        AND pq.created_at > ?
        GROUP BY c.id
        ORDER BY count DESC
        LIMIT 5
      `).all(sevenDaysAgo) as Array<{ name: string; count: number }>;
    } catch {
      // Contacts table might not exist
    }

    // Get domain distribution from signal_payload
    let domainDistribution: Array<{ domain: string; count: number }> = [];
    try {
      domainDistribution = db.prepare(`
        SELECT
          json_extract(signal_payload, '$.domain_id') as domain,
          COUNT(*) as count
        FROM pm_queue
        WHERE created_at > ?
        AND json_extract(signal_payload, '$.domain_id') IS NOT NULL
        GROUP BY domain
        ORDER BY count DESC
      `).all(sevenDaysAgo) as Array<{ domain: string; count: number }>;
    } catch {
      // Handle if domain_id not available
    }

    // Calculate totals
    const total = sourceDistribution.reduce((sum, s) => sum + s.count, 0);
    const totalAiProcessed = sourceDistribution.reduce((sum, s) => sum + (s.ai_processed || 0), 0);

    return NextResponse.json({
      summary: {
        total_signals_7d: total,
        ai_processed: totalAiProcessed,
        ai_processing_rate: total > 0 ? Math.round((totalAiProcessed / total) * 100) : 0,
        pending_review: pendingReview.count,
        auto_executed_24h: autoExecuted.count,
      },
      source_distribution: sourceDistribution,
      escalation_breakdown: escalationBreakdown,
      priority_distribution: priorityDistribution,
      recent_decisions: decisionsWithDetails,
      vip_activity: vipActivity,
      domain_distribution: domainDistribution,
    });
  } catch (error) {
    console.error('[orchestration/summary] Error:', error);
    return NextResponse.json({
      summary: {
        total_signals_7d: 0,
        ai_processed: 0,
        ai_processing_rate: 0,
        pending_review: 0,
        auto_executed_24h: 0,
      },
      source_distribution: [],
      escalation_breakdown: [],
      priority_distribution: [],
      recent_decisions: [],
      vip_activity: [],
      domain_distribution: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
