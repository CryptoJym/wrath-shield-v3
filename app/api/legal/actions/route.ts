import { NextRequest, NextResponse } from 'next/server';
import {
  listPendingActions,
  updatePendingAction,
  createNotification,
} from '@/lib/legal/store';

// GET - List all actions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'executed' | 'all' || 'all';

    const actions = listPendingActions(status);
    return NextResponse.json({ actions });
  } catch (error) {
    console.error('Failed to list actions:', error);
    return NextResponse.json({ actions: [] });
  }
}

// POST - Update action status (approve/reject)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Action ID required' }, { status: 400 });
    }

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Valid status required (approved/rejected/pending)' }, { status: 400 });
    }

    const updated = updatePendingAction(id, { status });

    if (!updated) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Create notification for status change
    const notifType = status === 'approved' ? 'info' : 'warning';
    const notifSeverity = status === 'approved' ? 'info' : 'warning';
    createNotification({
      notification_type: notifType as any,
      title: `Action ${status}`,
      message: `"${updated.title}" has been ${status}`,
      severity: notifSeverity as any,
      related_id: id,
    });

    return NextResponse.json({ action: updated });
  } catch (error) {
    console.error('Failed to update action:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
