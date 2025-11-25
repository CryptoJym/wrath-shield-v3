/**
 * Legal Notifications API Route Tests
 *
 * Tests for the /api/legal/notifications endpoint.
 */

// Store for mock data
const mockNotifications = new Map<string, any>();

// Mock the store before importing the routes
jest.mock('../../../../lib/legal/store', () => ({
  listNotifications: jest.fn((userId, unreadOnly = false) => {
    const all = Array.from(mockNotifications.values()).filter(n => !n.dismissed);
    if (unreadOnly) return all.filter(n => !n.read);
    return all;
  }),
  markNotificationRead: jest.fn((id) => {
    const existing = mockNotifications.get(id);
    if (!existing) return null;
    existing.read = true;
    mockNotifications.set(id, existing);
    return existing;
  }),
  markAllNotificationsRead: jest.fn(() => {
    let count = 0;
    mockNotifications.forEach(n => {
      if (!n.read) {
        n.read = true;
        count++;
      }
    });
    return count;
  }),
  deleteNotification: jest.fn((id) => {
    return mockNotifications.delete(id);
  }),
  createNotification: jest.fn((input) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notif = {
      id,
      notification_type: input.notification_type || 'info',
      title: input.title || 'Notification',
      message: input.message || null,
      severity: input.severity || 'info',
      read: false,
      dismissed: false,
      created_at: new Date().toISOString(),
    };
    mockNotifications.set(id, notif);
    return notif;
  }),
}));

import { GET, POST, DELETE } from '../../../../app/api/legal/notifications/route';
import { createNotification } from '../../../../lib/legal/store';

describe('/api/legal/notifications route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifications.clear();
  });

  test('GET returns notifications array and unread count', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await GET({ url: 'http://localhost/api/legal/notifications' });
    const data = await res.json();
    expect(data.notifications).toBeDefined();
    expect(Array.isArray(data.notifications)).toBe(true);
    expect(typeof data.unread).toBe('number');
  });

  test('GET returns all notifications by default', async () => {
    createNotification({ notification_type: 'info', title: 'Test 1' });
    const notif2 = createNotification({ notification_type: 'warning', title: 'Test 2' });
    // Mark second one as read
    notif2.read = true;
    mockNotifications.set(notif2.id, notif2);

    // @ts-ignore - emulate NextRequest
    const res = await GET({ url: 'http://localhost/api/legal/notifications' });
    const data = await res.json();
    expect(data.notifications.length).toBe(2);
    expect(data.unread).toBe(1);
  });

  test('GET filters unread notifications only', async () => {
    createNotification({ notification_type: 'info', title: 'Unread' });
    const readNotif = createNotification({ notification_type: 'info', title: 'Read' });
    readNotif.read = true;
    mockNotifications.set(readNotif.id, readNotif);

    // @ts-ignore - emulate NextRequest
    const res = await GET({ url: 'http://localhost/api/legal/notifications?unread=true' });
    const data = await res.json();
    expect(data.notifications.every((n: any) => !n.read)).toBe(true);
  });

  test('POST validates notification ID when not marking all', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await POST({ json: async () => ({}) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Notification ID required');
  });

  test('POST marks notification as read', async () => {
    const notif = createNotification({
      notification_type: 'info',
      title: 'Mark Read Test',
    });

    // @ts-ignore - emulate NextRequest
    const res = await POST({
      json: async () => ({ id: notif.id }),
    });
    const data = await res.json();
    expect(data.notification).toBeDefined();
    expect(data.notification.read).toBe(true);
  });

  test('POST returns 404 for non-existent notification', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await POST({
      json: async () => ({ id: 'non-existent-notification-id' }),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Notification not found');
  });

  test('POST marks all notifications as read', async () => {
    createNotification({ notification_type: 'info', title: 'Bulk Mark 1' });
    createNotification({ notification_type: 'info', title: 'Bulk Mark 2' });
    createNotification({ notification_type: 'warning', title: 'Bulk Mark 3' });

    // @ts-ignore - emulate NextRequest
    const res = await POST({
      json: async () => ({ markAllRead: true }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.markedRead).toBe('number');
    expect(data.markedRead).toBe(3);
  });

  test('POST markAllRead with no unread returns 0', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await POST({
      json: async () => ({ markAllRead: true }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.markedRead).toBe(0);
  });

  test('DELETE validates notification ID', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await DELETE({ url: 'http://localhost/api/legal/notifications' });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Notification ID required');
  });

  test('DELETE removes notification', async () => {
    const notif = createNotification({
      notification_type: 'info',
      title: 'Delete Route Test',
    });

    // @ts-ignore - emulate NextRequest
    const res = await DELETE({
      url: `http://localhost/api/legal/notifications?id=${notif.id}`,
    });
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test('DELETE returns 404 for non-existent notification', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await DELETE({
      url: 'http://localhost/api/legal/notifications?id=non-existent-delete-id',
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Notification not found');
  });
});

describe('/api/legal/notifications - Notification Severity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifications.clear();
  });

  test('Notifications with different severities are created correctly', async () => {
    createNotification({ notification_type: 'info', title: 'Info', severity: 'info' });
    createNotification({ notification_type: 'warning', title: 'Warning', severity: 'warning' });
    createNotification({ notification_type: 'action_required', title: 'Urgent', severity: 'urgent' });
    createNotification({ notification_type: 'deadline', title: 'Critical', severity: 'critical' });

    // @ts-ignore - emulate NextRequest
    const res = await GET({ url: 'http://localhost/api/legal/notifications' });
    const data = await res.json();

    expect(data.notifications.length).toBe(4);
    const severities = data.notifications.map((n: any) => n.severity);
    expect(severities).toContain('info');
    expect(severities).toContain('warning');
    expect(severities).toContain('urgent');
    expect(severities).toContain('critical');
  });
});
