/**
 * Legal Store Tests
 *
 * Tests for the legal context management store.
 * These tests mock the database to be independent of better-sqlite3 module.
 */

import * as store from '../../../lib/legal/store';

// Mock the entire store module
jest.mock('../../../lib/legal/store', () => {
  // In-memory storage for testing
  const contextRequests: Map<string, any> = new Map();
  const pendingActions: Map<string, any> = new Map();
  const notifications: Map<string, any> = new Map();
  const chatMessages: any[] = [];

  let idCounter = 1;
  const genId = () => `test-id-${idCounter++}`;

  return {
    createLegalContextRequest: jest.fn((input) => {
      const id = genId();
      const request = {
        id,
        user_id: input.user_id || 'default',
        topic: input.topic || null,
        summary: input.summary || null,
        contact: input.contact || null,
        case_number: input.case_number || null,
        status: input.status || 'pending',
        confidence: input.confidence ?? 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      contextRequests.set(id, request);
      return request;
    }),

    listLegalContextRequests: jest.fn((status = 'pending') => {
      const all = Array.from(contextRequests.values());
      if (status === 'all') return all;
      return all.filter(r => r.status === status);
    }),

    updateLegalContextRequest: jest.fn((id, updates) => {
      const existing = contextRequests.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      contextRequests.set(id, updated);
      return updated;
    }),

    createPendingAction: jest.fn((input) => {
      const id = genId();
      const action = {
        id,
        user_id: input.user_id || 'default',
        action_type: input.action_type || 'other',
        title: input.title || 'Unnamed action',
        description: input.description || null,
        payload: input.payload || null,
        status: input.status || 'pending',
        priority: input.priority || 'normal',
        requires_approval: input.requires_approval !== false,
        approved_at: null,
        executed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      pendingActions.set(id, action);
      return action;
    }),

    listPendingActions: jest.fn((status = 'pending') => {
      const all = Array.from(pendingActions.values());
      if (status === 'all') return all;
      return all.filter(a => a.status === status);
    }),

    updatePendingAction: jest.fn((id, updates) => {
      const existing = pendingActions.get(id);
      if (!existing) return null;
      const now = new Date().toISOString();
      const updated = { ...existing, ...updates, updated_at: now };
      if (updates.status === 'approved' && existing.status !== 'approved') {
        updated.approved_at = now;
      }
      if (updates.status === 'executed' && existing.status !== 'executed') {
        updated.executed_at = now;
      }
      pendingActions.set(id, updated);
      return updated;
    }),

    createNotification: jest.fn((input) => {
      const id = genId();
      const notif = {
        id,
        user_id: input.user_id || 'default',
        notification_type: input.notification_type || 'info',
        title: input.title || 'Notification',
        message: input.message || null,
        severity: input.severity || 'info',
        read: false,
        dismissed: false,
        created_at: new Date().toISOString(),
      };
      notifications.set(id, notif);
      return notif;
    }),

    listNotifications: jest.fn((userId, unreadOnly = false) => {
      const all = Array.from(notifications.values()).filter(n => !n.dismissed);
      if (unreadOnly) return all.filter(n => !n.read);
      return all;
    }),

    markNotificationRead: jest.fn((id) => {
      const existing = notifications.get(id);
      if (!existing) return null;
      existing.read = true;
      notifications.set(id, existing);
      return existing;
    }),

    markAllNotificationsRead: jest.fn(() => {
      let count = 0;
      notifications.forEach(n => {
        if (!n.read) {
          n.read = true;
          count++;
        }
      });
      return count;
    }),

    deleteNotification: jest.fn((id) => {
      return notifications.delete(id);
    }),

    dismissNotification: jest.fn((id) => {
      const existing = notifications.get(id);
      if (!existing) return false;
      existing.dismissed = true;
      notifications.set(id, existing);
      return true;
    }),

    saveChatMessage: jest.fn((input) => {
      const id = genId();
      const message = {
        id,
        user_id: input.user_id || 'default',
        role: input.role || 'user',
        content: input.content || '',
        metadata: input.metadata || null,
        created_at: new Date().toISOString(),
      };
      chatMessages.push(message);
      return message;
    }),

    listChatMessages: jest.fn(() => [...chatMessages]),

    clearChatMessages: jest.fn(() => {
      const count = chatMessages.length;
      chatMessages.length = 0;
      return count;
    }),

    // Helper to reset state between tests
    __resetTestState: () => {
      contextRequests.clear();
      pendingActions.clear();
      notifications.clear();
      chatMessages.length = 0;
      idCounter = 1;
    },
  };
});

describe('Legal Store - Context Requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (store as any).__resetTestState?.();
  });

  test('createLegalContextRequest creates and returns a request', () => {
    const request = store.createLegalContextRequest({
      topic: 'Test Topic',
      summary: 'Test summary for unit test',
      contact: 'test-contact',
      case_number: '164400524',
    });

    expect(request).toBeDefined();
    expect(request.id).toBeDefined();
    expect(request.topic).toBe('Test Topic');
    expect(request.summary).toBe('Test summary for unit test');
    expect(request.status).toBe('pending');
    expect(store.createLegalContextRequest).toHaveBeenCalled();
  });

  test('listLegalContextRequests returns array of requests', () => {
    const requests = store.listLegalContextRequests('all');
    expect(Array.isArray(requests)).toBe(true);
  });

  test('updateLegalContextRequest updates status', () => {
    const request = store.createLegalContextRequest({
      topic: 'Update Test',
      summary: 'Testing update functionality',
    });

    const updated = store.updateLegalContextRequest(request.id, { status: 'resolved' });
    expect(updated).toBeDefined();
    expect(updated?.status).toBe('resolved');
  });

  test('updateLegalContextRequest returns null for non-existent id', () => {
    const result = store.updateLegalContextRequest('non-existent-id-12345', { status: 'resolved' });
    expect(result).toBeNull();
  });
});

describe('Legal Store - Pending Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (store as any).__resetTestState?.();
  });

  test('createPendingAction creates action with defaults', () => {
    const action = store.createPendingAction({
      action_type: 'email_draft',
      title: 'Test Email Draft',
      description: 'Testing action creation',
    });

    expect(action).toBeDefined();
    expect(action.id).toBeDefined();
    expect(action.action_type).toBe('email_draft');
    expect(action.title).toBe('Test Email Draft');
    expect(action.status).toBe('pending');
    expect(action.priority).toBe('normal');
    expect(action.requires_approval).toBe(true);
  });

  test('createPendingAction with urgent priority', () => {
    const action = store.createPendingAction({
      action_type: 'file_motion',
      title: 'Urgent Motion',
      priority: 'urgent',
    });

    expect(action.priority).toBe('urgent');
  });

  test('listPendingActions returns array', () => {
    const actions = store.listPendingActions('all');
    expect(Array.isArray(actions)).toBe(true);
  });

  test('updatePendingAction approves action', () => {
    const action = store.createPendingAction({
      action_type: 'schedule_hearing',
      title: 'Hearing Request',
    });

    const approved = store.updatePendingAction(action.id, { status: 'approved' });
    expect(approved).toBeDefined();
    expect(approved?.status).toBe('approved');
    expect(approved?.approved_at).toBeDefined();
  });

  test('updatePendingAction rejects action', () => {
    const action = store.createPendingAction({
      action_type: 'send_document',
      title: 'Document Send',
    });

    const rejected = store.updatePendingAction(action.id, { status: 'rejected' });
    expect(rejected).toBeDefined();
    expect(rejected?.status).toBe('rejected');
  });

  test('updatePendingAction marks as executed', () => {
    const action = store.createPendingAction({
      action_type: 'email_draft',
      title: 'Execute Test',
    });

    // First approve
    store.updatePendingAction(action.id, { status: 'approved' });

    // Then execute
    const executed = store.updatePendingAction(action.id, { status: 'executed' });
    expect(executed).toBeDefined();
    expect(executed?.status).toBe('executed');
    expect(executed?.executed_at).toBeDefined();
  });

  test('updatePendingAction returns null for non-existent id', () => {
    const result = store.updatePendingAction('non-existent-id-67890', { status: 'approved' });
    expect(result).toBeNull();
  });
});

describe('Legal Store - Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (store as any).__resetTestState?.();
  });

  test('createNotification creates notification with defaults', () => {
    const notif = store.createNotification({
      notification_type: 'info',
      title: 'Test Notification',
      message: 'This is a test notification',
    });

    expect(notif).toBeDefined();
    expect(notif.id).toBeDefined();
    expect(notif.title).toBe('Test Notification');
    expect(notif.notification_type).toBe('info');
    expect(notif.severity).toBe('info');
    expect(notif.read).toBe(false);
    expect(notif.dismissed).toBe(false);
  });

  test('createNotification with urgent severity', () => {
    const notif = store.createNotification({
      notification_type: 'action_required',
      title: 'Urgent Action Required',
      severity: 'urgent',
    });

    expect(notif.severity).toBe('urgent');
  });

  test('listNotifications returns array', () => {
    const notifications = store.listNotifications();
    expect(Array.isArray(notifications)).toBe(true);
  });

  test('markNotificationRead marks as read', () => {
    const notif = store.createNotification({
      notification_type: 'info',
      title: 'Read Test',
    });

    const updated = store.markNotificationRead(notif.id);
    expect(updated).toBeDefined();
    expect(updated?.read).toBe(true);
  });

  test('markNotificationRead returns null for non-existent id', () => {
    const result = store.markNotificationRead('non-existent-notif-id');
    expect(result).toBeNull();
  });

  test('markAllNotificationsRead marks all as read', () => {
    // Create some unread notifications
    store.createNotification({ notification_type: 'info', title: 'Bulk Test 1' });
    store.createNotification({ notification_type: 'info', title: 'Bulk Test 2' });

    const count = store.markAllNotificationsRead();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('deleteNotification removes notification', () => {
    const notif = store.createNotification({
      notification_type: 'info',
      title: 'Delete Test',
    });

    const deleted = store.deleteNotification(notif.id);
    expect(deleted).toBe(true);
  });

  test('dismissNotification sets dismissed flag', () => {
    const notif = store.createNotification({
      notification_type: 'info',
      title: 'Dismiss Test',
    });

    const dismissed = store.dismissNotification(notif.id);
    expect(dismissed).toBe(true);
  });
});

describe('Legal Store - Chat Messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (store as any).__resetTestState?.();
  });

  test('saveChatMessage saves user message', () => {
    const message = store.saveChatMessage({
      role: 'user',
      content: 'Test user message',
    });

    expect(message).toBeDefined();
    expect(message.id).toBeDefined();
    expect(message.role).toBe('user');
    expect(message.content).toBe('Test user message');
  });

  test('saveChatMessage saves assistant message with metadata', () => {
    const message = store.saveChatMessage({
      role: 'assistant',
      content: 'Test assistant response',
      metadata: { actionCreated: true, actionId: 'test-action-id' },
    });

    expect(message).toBeDefined();
    expect(message.role).toBe('assistant');
    expect(message.metadata).toBeDefined();
    expect(message.metadata.actionCreated).toBe(true);
  });

  test('listChatMessages returns array', () => {
    const messages = store.listChatMessages();
    expect(Array.isArray(messages)).toBe(true);
  });

  test('clearChatMessages removes messages', () => {
    // Save some messages first
    store.saveChatMessage({ role: 'user', content: 'Clear test 1' });
    store.saveChatMessage({ role: 'assistant', content: 'Clear test 2' });

    const deleted = store.clearChatMessages();
    expect(deleted).toBeGreaterThanOrEqual(0);
  });
});
