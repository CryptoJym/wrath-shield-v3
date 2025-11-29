import { NextResponse } from 'next/server';
import { getAllAgentsStatus } from '@/lib/agents/registry';

export const revalidate = 60; // Cache for 1 minute

export async function GET() {
    try {
        const agents = await getAllAgentsStatus();
        return NextResponse.json(agents);
    } catch (error) {
        console.error('Failed to fetch agent status:', error);
        return NextResponse.json({ error: 'Failed to fetch agent status' }, { status: 500 });
    }
}
