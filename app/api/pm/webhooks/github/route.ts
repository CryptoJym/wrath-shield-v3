/**
 * GitHub Webhook Receiver
 *
 * Receives and processes GitHub webhook events:
 * - issues (opened, closed, reopened, edited, labeled, assigned)
 * - issue_comment (created, edited)
 * - push (commits for auto-close parsing)
 * - pull_request (opened, closed, merged)
 * - ping (webhook verification)
 *
 * Security: Verifies HMAC signature from GitHub
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { enqueueSignal } from '@/lib/pm/task-queue';

export const dynamic = 'force-dynamic';

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

/**
 * Parse issue references from commit message
 * Supports: "Closes #123", "Fixes #456", "Resolves #789"
 */
function parseIssueReferences(message: string): number[] {
  const patterns = [
    /(?:closes?|close|closed)\s+#(\d+)/gi,
    /(?:fixes?|fix|fixed)\s+#(\d+)/gi,
    /(?:resolves?|resolve|resolved)\s+#(\d+)/gi,
  ];

  const issueNumbers: number[] = [];

  for (const pattern of patterns) {
    const matches = message.matchAll(pattern);
    for (const match of matches) {
      issueNumbers.push(parseInt(match[1]));
    }
  }

  return [...new Set(issueNumbers)]; // Deduplicate
}

/**
 * Handle 'issues' event
 */
async function handleIssueEvent(event: any): Promise<void> {
  const action = event.action; // opened, closed, reopened, edited, labeled, etc.
  const issue = event.issue;
  const repository = event.repository;

  switch (action) {
    case 'opened':
      // New issue created
      await enqueueSignal({
        id: `github-issue-${repository.full_name}-${issue.number}-opened`,
        source: 'github',
        signal_type: 'task',
        payload: {
          action: 'opened',
          issue_number: issue.number,
          issue_title: issue.title,
          issue_body: issue.body,
          issue_url: issue.html_url,
          repository: repository.full_name,
          labels: issue.labels?.map((l: any) => l.name) || [],
          assignees: issue.assignees?.map((a: any) => a.login) || [],
          milestone: issue.milestone?.title,
        },
        timestamp: Date.now(),
        confidence: 1.0,
      });
      break;

    case 'closed':
      // Issue closed
      await enqueueSignal({
        id: `github-issue-${repository.full_name}-${issue.number}-closed`,
        source: 'github',
        signal_type: 'task',
        payload: {
          action: 'closed',
          issue_number: issue.number,
          issue_title: issue.title,
          repository: repository.full_name,
          state_reason: issue.state_reason, // completed or not_planned
        },
        timestamp: Date.now(),
        confidence: 1.0,
      });
      break;

    case 'reopened':
      // Issue reopened
      await enqueueSignal({
        id: `github-issue-${repository.full_name}-${issue.number}-reopened`,
        source: 'github',
        signal_type: 'task',
        payload: {
          action: 'reopened',
          issue_number: issue.number,
          issue_title: issue.title,
          repository: repository.full_name,
        },
        timestamp: Date.now(),
        confidence: 1.0,
      });
      break;

    case 'labeled':
      // Issue labeled (might indicate priority change)
      const addedLabel = event.label?.name;
      if (addedLabel?.includes('urgent') || addedLabel?.includes('critical')) {
        await enqueueSignal({
          id: `github-issue-${repository.full_name}-${issue.number}-urgent`,
          source: 'github',
          signal_type: 'task',
          payload: {
            action: 'priority_change',
            issue_number: issue.number,
            issue_title: issue.title,
            repository: repository.full_name,
            new_label: addedLabel,
            all_labels: issue.labels?.map((l: any) => l.name) || [],
          },
          timestamp: Date.now(),
          confidence: 0.9,
        });
      }
      break;

    default:
      console.log(`[GitHub Webhook] Unhandled issue action: ${action}`);
  }
}

/**
 * Handle 'issue_comment' event
 */
async function handleIssueCommentEvent(event: any): Promise<void> {
  const action = event.action; // created, edited
  const comment = event.comment;
  const issue = event.issue;
  const repository = event.repository;

  if (action === 'created') {
    // Check if comment mentions action items or contains @username
    const body = comment.body.toLowerCase();
    const containsActionKeywords = body.includes('todo') ||
      body.includes('action item') ||
      body.includes('follow up') ||
      body.includes('@');

    if (containsActionKeywords) {
      await enqueueSignal({
        id: `github-comment-${repository.full_name}-${comment.id}`,
        source: 'github',
        signal_type: 'mention',
        payload: {
          action: 'comment_created',
          issue_number: issue.number,
          issue_title: issue.title,
          comment_body: comment.body,
          comment_url: comment.html_url,
          repository: repository.full_name,
          author: comment.user?.login,
        },
        timestamp: Date.now(),
        confidence: 0.7,
      });
    }
  }
}

/**
 * Handle 'push' event (for commit-based auto-close)
 */
async function handlePushEvent(event: any): Promise<void> {
  const commits = event.commits || [];
  const repository = event.repository;

  for (const commit of commits) {
    const issueRefs = parseIssueReferences(commit.message);

    for (const issueNumber of issueRefs) {
      await enqueueSignal({
        id: `github-commit-${repository.full_name}-${commit.id}-closes-${issueNumber}`,
        source: 'github',
        signal_type: 'commit',
        payload: {
          action: 'closes_issue',
          issue_number: issueNumber,
          commit_sha: commit.id,
          commit_message: commit.message,
          commit_url: commit.url,
          repository: repository.full_name,
          author: commit.author?.name,
        },
        timestamp: Date.now(),
        confidence: 0.95,
      });
    }
  }
}

/**
 * Handle 'pull_request' event
 */
async function handlePullRequestEvent(event: any): Promise<void> {
  const action = event.action; // opened, closed, reopened, merged
  const pullRequest = event.pull_request;
  const repository = event.repository;

  if (action === 'opened') {
    await enqueueSignal({
      id: `github-pr-${repository.full_name}-${pullRequest.number}-opened`,
      source: 'github',
      signal_type: 'task',
      payload: {
        action: 'pr_opened',
        pr_number: pullRequest.number,
        pr_title: pullRequest.title,
        pr_body: pullRequest.body,
        pr_url: pullRequest.html_url,
        repository: repository.full_name,
        author: pullRequest.user?.login,
      },
      timestamp: Date.now(),
      confidence: 0.8,
    });
  } else if (action === 'closed' && pullRequest.merged) {
    // PR was merged - might close issues
    const body = pullRequest.body || '';
    const issueRefs = parseIssueReferences(body);

    for (const issueNumber of issueRefs) {
      await enqueueSignal({
        id: `github-pr-${repository.full_name}-${pullRequest.number}-closes-${issueNumber}`,
        source: 'github',
        signal_type: 'commit',
        payload: {
          action: 'pr_closes_issue',
          issue_number: issueNumber,
          pr_number: pullRequest.number,
          pr_title: pullRequest.title,
          repository: repository.full_name,
        },
        timestamp: Date.now(),
        confidence: 0.9,
      });
    }
  }
}

/**
 * POST - Receive GitHub webhook
 */
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-hub-signature-256');
    const event = req.headers.get('x-github-event');
    const deliveryId = req.headers.get('x-github-delivery');
    const payload = await req.text();

    console.log(`[GitHub Webhook] Received event: ${event} (${deliveryId})`);

    // Verify signature (if secret is configured)
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret) {
      if (!verifyGitHubSignature(payload, signature, secret)) {
        console.error('[GitHub Webhook] Invalid signature');
        return NextResponse.json(
          { ok: false, error: 'Invalid signature' },
          { status: 401 }
        );
      }
      console.log('[GitHub Webhook] Signature verified');
    } else {
      console.warn('[GitHub Webhook] No GITHUB_WEBHOOK_SECRET configured - skipping signature verification');
    }

    // Parse payload
    const data = JSON.parse(payload);

    // Handle ping event (GitHub webhook verification)
    if (event === 'ping') {
      console.log('[GitHub Webhook] Ping event received');
      return NextResponse.json({
        ok: true,
        message: 'pong',
        zen: data.zen,
        hook_id: data.hook_id,
      });
    }

    // Route to appropriate handler
    switch (event) {
      case 'issues':
        await handleIssueEvent(data);
        break;

      case 'issue_comment':
        await handleIssueCommentEvent(data);
        break;

      case 'push':
        await handlePushEvent(data);
        break;

      case 'pull_request':
        await handlePullRequestEvent(data);
        break;

      default:
        console.log(`[GitHub Webhook] Unhandled event type: ${event}`);
    }

    return NextResponse.json({
      ok: true,
      event,
      delivery_id: deliveryId,
      processed: true,
    });
  } catch (error) {
    console.error('[GitHub Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Webhook status (for testing)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  return NextResponse.json({
    ok: true,
    webhook_configured: !!secret,
    message: secret
      ? 'Webhook receiver is ready. Signature verification enabled.'
      : 'Webhook receiver is ready. WARNING: No GITHUB_WEBHOOK_SECRET configured - signature verification disabled!',
    setup_instructions: {
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/pm/webhooks/github`,
      content_type: 'application/json',
      secret_env_var: 'GITHUB_WEBHOOK_SECRET',
      events: ['issues', 'issue_comment', 'push', 'pull_request'],
    },
  });
}
