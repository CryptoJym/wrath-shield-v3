import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'deprecated',
      message: 'The eeg-tokenizer service has been archived and this endpoint is no longer available.',
      deprecated_at: '2024-11-01',
      alternative: 'EEG data processing has been integrated into the main application. Please contact support for migration assistance.',
    },
    { status: 410 }
  );
}

