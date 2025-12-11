import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'deprecated',
      message: 'The agentic-grok service has been archived and this endpoint is no longer available.',
      deprecated_at: '2024-11-01',
      alternative: 'Please use /api/cortex/health for system health checks or /api/agentic/status for agentic action status.',
    },
    { status: 410 }
  );
}

