/**
 * Commit Intelligence API
 *
 * Analyzes GitHub commits and generates progress reports.
 *
 * GET /api/pm/commits - Get recent commit analyses
 * GET /api/pm/commits?action=report - Generate progress report
 * GET /api/pm/commits?action=ambiguous - Get commits needing review
 * GET /api/pm/commits?action=get&sha=X - Get specific commit analysis
 *
 * POST /api/pm/commits
 *   - analyze: Analyze commits from GitHub
 *   - analyze-single: Analyze a single commit
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getRecentAnalyses,
  getCommitAnalysis,
  getAmbiguousCommits,
  generateProgressReport,
  analyzeRecentCommits,
  analyzeCommit,
  type CommitCategory,
  type ImpactLevel,
} from '@/lib/pm/commit-intelligence';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Default: Get recent commit analyses
    if (!action) {
      const repo = searchParams.get('repo') || undefined;
      const category = searchParams.get('category') as CommitCategory | undefined;
      const impact = searchParams.get('impact') as ImpactLevel | undefined;
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
      const since = searchParams.get('since') || undefined;

      const analyses = getRecentAnalyses({
        repo_full_name: repo,
        category,
        impact_level: impact,
        limit,
        since,
      });

      return NextResponse.json({
        ok: true,
        count: analyses.length,
        analyses,
        timestamp: new Date().toISOString(),
      });
    }

    switch (action) {
      case 'report': {
        const repo = searchParams.get('repo') || undefined;
        const since = searchParams.get('since') || undefined;
        const until = searchParams.get('until') || undefined;

        const report = generateProgressReport({
          repo_full_name: repo,
          since,
          until,
        });

        return NextResponse.json({
          ok: true,
          action: 'report',
          report,
          timestamp: new Date().toISOString(),
        });
      }

      case 'ambiguous': {
        const repo = searchParams.get('repo') || undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;

        const commits = getAmbiguousCommits({
          repo_full_name: repo,
          limit,
        });

        return NextResponse.json({
          ok: true,
          action: 'ambiguous',
          count: commits.length,
          commits,
          timestamp: new Date().toISOString(),
        });
      }

      case 'get': {
        const sha = searchParams.get('sha');
        if (!sha) {
          return NextResponse.json(
            { ok: false, error: 'Missing sha parameter' },
            { status: 400 }
          );
        }

        const analysis = getCommitAnalysis(sha);
        if (!analysis) {
          return NextResponse.json(
            { ok: false, error: 'Commit analysis not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'get',
          analysis,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Commit Intelligence API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { ok: false, error: 'Missing action in request body' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'analyze': {
        const { repo, since, limit } = body;

        const result = await analyzeRecentCommits({
          repo_full_name: repo,
          since,
          limit,
        });

        return NextResponse.json({
          ok: true,
          action: 'analyze',
          ...result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'analyze-single': {
        const { repo_full_name, commit_sha, commit_message, author, authored_at, files_changed } = body;

        if (!repo_full_name || !commit_sha || !commit_message || !author || !authored_at) {
          return NextResponse.json(
            { ok: false, error: 'Missing required fields' },
            { status: 400 }
          );
        }

        const analysis = analyzeCommit({
          repo_full_name,
          commit_sha,
          commit_message,
          author,
          authored_at,
          files_changed,
        });

        return NextResponse.json({
          ok: true,
          action: 'analyze-single',
          analysis,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Commit Intelligence API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
