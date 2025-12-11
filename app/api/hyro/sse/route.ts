/**
 * HYRO FORGE: SSE Endpoint
 * Server-Sent Events endpoint for real-time learner state updates
 */

import { NextRequest } from 'next/server';
import { getSSEManager } from '@/lib/hyro/forge-ws-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const learnerId = searchParams.get('learnerId');

  if (!learnerId) {
    return new Response(
      JSON.stringify({ error: 'learnerId query parameter required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Create a readable stream for SSE
  let connectionId: string | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Register this connection with the SSE manager
      const manager = getSSEManager();
      connectionId = manager.addConnection(learnerId, controller);

      console.log(
        `[SSE] Connection started for learner ${learnerId}: ${connectionId}`
      );
    },
    cancel() {
      // Clean up when client disconnects
      if (connectionId) {
        const manager = getSSEManager();
        manager.removeConnection(connectionId);
        console.log(
          `[SSE] Connection closed for learner ${learnerId}: ${connectionId}`
        );
      }
    },
  });

  // Return SSE response with proper headers
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
