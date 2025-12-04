/**
 * Proactive Webhook Endpoint
 *
 * Receives events from external services and routes them to triggers.
 *
 * Supported Event Sources:
 * - Gmail (email_received)
 * - Google Calendar (calendar_event, deadline_approaching)
 * - Twilio (sms_received, message_received)
 * - Custom webhooks (custom_webhook)
 *
 * Usage:
 *   POST /api/proactive/webhook
 *   Body: { source: "gmail", type: "email_received", data: {...} }
 *
 * Or with source in path:
 *   POST /api/proactive/webhook?source=gmail
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProactiveEnablement, type ProactiveEvent, type TriggerType } from '@/lib/agents/ProactiveEnablement';

// Map external source names to internal trigger types
const SOURCE_TO_TRIGGER_TYPE: Record<string, TriggerType> = {
  gmail: 'email_received',
  email: 'email_received',
  calendar: 'calendar_event',
  google_calendar: 'calendar_event',
  twilio: 'message_received',
  sms: 'message_received',
  imessage: 'message_received',
  deadline: 'deadline_approaching',
  agent: 'agent_state_change',
  memory: 'memory_threshold',
  health: 'health_alert',
  whoop: 'health_alert',
  finance: 'financial_alert',
  custom: 'custom_webhook',
};

// Validate webhook signature (for production use)
function validateWebhookSignature(
  request: NextRequest,
  source: string,
  body: string
): boolean {
  // In development, skip validation
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Get expected secret for this source
  const secretEnvName = `WEBHOOK_SECRET_${source.toUpperCase()}`;
  const expectedSecret = process.env[secretEnvName];

  if (!expectedSecret) {
    console.warn(`[ProactiveWebhook] No secret configured for source: ${source}`);
    return true; // Allow if no secret configured
  }

  // Check signature header
  const signature = request.headers.get('X-Webhook-Signature') ||
                    request.headers.get('X-Hub-Signature-256') ||
                    request.headers.get('X-Twilio-Signature');

  if (!signature) {
    return false;
  }

  // TODO: Implement proper HMAC validation per source
  // For now, simple comparison
  return signature === expectedSecret;
}

// Parse event from various webhook formats
function parseWebhookEvent(
  source: string,
  body: any
): ProactiveEvent | null {
  const triggerType = SOURCE_TO_TRIGGER_TYPE[source.toLowerCase()] || 'custom_webhook';

  // Generate event ID
  const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Gmail webhook format
  if (source === 'gmail' || source === 'email') {
    return {
      id: eventId,
      type: 'email_received',
      timestamp: new Date().toISOString(),
      source: 'gmail',
      data: {
        from: body.from || body.sender || body.envelope?.from,
        to: body.to || body.recipient || body.envelope?.to,
        subject: body.subject || body.headers?.subject,
        snippet: body.snippet || body.preview,
        messageId: body.messageId || body.id,
        threadId: body.threadId,
        labels: body.labels || body.labelIds,
        ...body,
      },
    };
  }

  // Calendar webhook format
  if (source === 'calendar' || source === 'google_calendar') {
    return {
      id: eventId,
      type: body.isDeadline ? 'deadline_approaching' : 'calendar_event',
      timestamp: new Date().toISOString(),
      source: 'calendar',
      data: {
        eventId: body.id || body.eventId,
        title: body.summary || body.title,
        start: body.start?.dateTime || body.start,
        end: body.end?.dateTime || body.end,
        location: body.location,
        minutesUntil: body.minutesUntil,
        daysUntil: body.daysUntil,
        attendees: body.attendees,
        ...body,
      },
    };
  }

  // Twilio/SMS webhook format
  if (source === 'twilio' || source === 'sms') {
    return {
      id: eventId,
      type: 'message_received',
      timestamp: new Date().toISOString(),
      source: 'twilio',
      data: {
        from: body.From || body.from,
        to: body.To || body.to,
        body: body.Body || body.body || body.text,
        messageSid: body.MessageSid || body.sid,
        ...body,
      },
    };
  }

  // WHOOP/Health webhook format
  if (source === 'whoop' || source === 'health') {
    return {
      id: eventId,
      type: 'health_alert',
      timestamp: new Date().toISOString(),
      source: 'whoop',
      data: {
        metric: body.metric || body.type,
        value: body.value || body.score,
        threshold: body.threshold,
        direction: body.direction,
        ...body,
      },
    };
  }

  // Generic format - pass through
  return {
    id: eventId,
    type: triggerType,
    timestamp: new Date().toISOString(),
    source: source,
    data: body,
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get source from query or body
    const { searchParams } = new URL(request.url);
    const querySource = searchParams.get('source');

    // Parse body
    const bodyText = await request.text();
    let body: any;

    try {
      body = JSON.parse(bodyText);
    } catch {
      // Try URL-encoded (Twilio format)
      body = Object.fromEntries(new URLSearchParams(bodyText));
    }

    const source = querySource || body.source || 'custom';

    // Validate signature
    if (!validateWebhookSignature(request, source, bodyText)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse event
    const event = parseWebhookEvent(source, body);
    if (!event) {
      return NextResponse.json(
        { error: 'Could not parse webhook event' },
        { status: 400 }
      );
    }

    // Process event through ProactiveEnablement
    const proactive = getProactiveEnablement();
    await proactive.initialize();

    const results = await proactive.processEvent(event);

    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      eventId: event.id,
      eventType: event.type,
      source: event.source,
      triggersMatched: results.length,
      results: results.map(r => ({
        success: r.success,
        wasExecuted: r.wasExecuted,
        escalationLevel: r.escalationLevel,
        error: r.error,
      })),
      executionTimeMs: executionTime,
    });

  } catch (error) {
    console.error('[ProactiveWebhook] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Support GET for webhook verification (some services require this)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Google Calendar subscription verification
  const challenge = searchParams.get('hub.challenge');
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Generic health check
  return NextResponse.json({
    status: 'ok',
    endpoint: 'proactive-webhook',
    supportedSources: Object.keys(SOURCE_TO_TRIGGER_TYPE),
  });
}
