import { NextRequest, NextResponse } from 'next/server';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/lib/legal/store';

// GET - List all notifications
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    // listNotifications signature: (user_id?, unreadOnly?, limit?)
    const notifications = listNotifications(undefined, unreadOnly);
    const unreadCount = notifications.filter(n => !n.read).length;

    return NextResponse.json({
      notifications,
      unread: unreadCount,
    });
  } catch (error) {
    console.error('Failed to list notifications:', error);
    return NextResponse.json({ notifications: [], unread: 0 });
  }
}

// POST - Mark notification(s) as read
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, markAllRead } = body;

    if (markAllRead) {
      const count = markAllNotificationsRead();
      return NextResponse.json({ success: true, markedRead: count });
    }

    if (!id) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }

    const updated = markNotificationRead(id);

    if (!updated) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ notification: updated });
  } catch (error) {
    console.error('Failed to update notification:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

// DELETE - Delete a notification
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }

    const deleted = deleteNotification(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete notification:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
