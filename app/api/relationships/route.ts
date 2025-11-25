import { NextResponse } from 'next/server';
import { topContacts, listRelationshipSummaries } from '@/lib/relationshipDb';

export const revalidate = 0;

export async function GET() {
  const contacts = topContacts(100);
  const summaries = listRelationshipSummaries();
  return NextResponse.json({ contacts, summaries });
}
