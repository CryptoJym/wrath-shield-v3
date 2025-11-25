/**
 * Legal Actions API Route Tests
 *
 * Tests for /api/legal/actions and /api/legal/actions/execute endpoints.
 */

// Store for mock data
const mockActions = new Map<string, any>();

// Mock the store before importing the routes
jest.mock('../../../../lib/legal/store', () => ({
  listPendingActions: jest.fn((status = 'all') => {
    const all = Array.from(mockActions.values());
    if (status === 'all') return all;
    return all.filter(a => a.status === status);
  }),
  updatePendingAction: jest.fn((id, updates) => {
    const existing = mockActions.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated = { ...existing, ...updates, updated_at: now };
    if (updates.status === 'approved' && existing.status !== 'approved') {
      updated.approved_at = now;
    }
    if (updates.status === 'executed' && existing.status !== 'executed') {
      updated.executed_at = now;
    }
    mockActions.set(id, updated);
    return updated;
  }),
  createNotification: jest.fn(),
  createPendingAction: jest.fn((input) => {
    const id = `action-${Date.now()}`;
    const action = {
      id,
      action_type: input.action_type || 'other',
      title: input.title || 'Test Action',
      description: input.description || null,
      status: input.status || 'pending',
      priority: input.priority || 'normal',
      requires_approval: true,
      created_at: new Date().toISOString(),
    };
    mockActions.set(id, action);
    return action;
  }),
}));

import { GET, POST } from '../../../../app/api/legal/actions/route';
import { POST as ExecutePOST } from '../../../../app/api/legal/actions/execute/route';
import { createPendingAction, listPendingActions, updatePendingAction } from '../../../../lib/legal/store';

describe('/api/legal/actions route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActions.clear();
  });

  test('GET returns actions array', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await GET({ url: 'http://localhost/api/legal/actions' });
    const data = await res.json();
    expect(data.actions).toBeDefined();
    expect(Array.isArray(data.actions)).toBe(true);
  });

  test('GET returns all actions when status=all', async () => {
    // Create some test actions
    createPendingAction({ action_type: 'email_draft', title: 'Test 1', status: 'pending' });
    createPendingAction({ action_type: 'file_motion', title: 'Test 2', status: 'approved' });

    // @ts-ignore - emulate NextRequest
    const res = await GET({ url: 'http://localhost/api/legal/actions?status=all' });
    const data = await res.json();
    expect(data.actions.length).toBe(2);
  });

  test('GET filters by pending status', async () => {
    createPendingAction({ action_type: 'email_draft', title: 'Test 1', status: 'pending' });
    createPendingAction({ action_type: 'file_motion', title: 'Test 2', status: 'approved' });

    // @ts-ignore - emulate NextRequest
    const res = await GET({ url: 'http://localhost/api/legal/actions?status=pending' });
    const data = await res.json();
    expect(data.actions.every((a: any) => a.status === 'pending')).toBe(true);
  });

  test('POST validates action ID', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await POST({ json: async () => ({ status: 'approved' }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Action ID required');
  });

  test('POST validates status value', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await POST({ json: async () => ({ id: 'test-id', status: 'invalid' }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Valid status required');
  });

  test('POST approves action successfully', async () => {
    const action = createPendingAction({
      action_type: 'file_motion',
      title: 'Approve Test Action',
    });

    // @ts-ignore - emulate NextRequest
    const res = await POST({
      json: async () => ({ id: action.id, status: 'approved' }),
    });
    const data = await res.json();
    expect(data.action).toBeDefined();
    expect(data.action.status).toBe('approved');
    expect(data.action.approved_at).toBeDefined();
  });

  test('POST rejects action successfully', async () => {
    const action = createPendingAction({
      action_type: 'schedule_hearing',
      title: 'Reject Test Action',
    });

    // @ts-ignore - emulate NextRequest
    const res = await POST({
      json: async () => ({ id: action.id, status: 'rejected' }),
    });
    const data = await res.json();
    expect(data.action).toBeDefined();
    expect(data.action.status).toBe('rejected');
  });

  test('POST returns 404 for non-existent action', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await POST({
      json: async () => ({ id: 'non-existent-action-id', status: 'approved' }),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Action not found');
  });

  test('POST can reset action to pending', async () => {
    const action = createPendingAction({
      action_type: 'email_draft',
      title: 'Reset Test',
      status: 'approved',
    });

    // @ts-ignore - emulate NextRequest
    const res = await POST({
      json: async () => ({ id: action.id, status: 'pending' }),
    });
    const data = await res.json();
    expect(data.action.status).toBe('pending');
  });
});

describe('/api/legal/actions/execute route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActions.clear();
  });

  test('POST validates action ID', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await ExecutePOST({ json: async () => ({}) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Action ID required');
  });

  test('POST returns 404 for non-existent action', async () => {
    // @ts-ignore - emulate NextRequest
    const res = await ExecutePOST({
      json: async () => ({ id: 'non-existent-execute-id' }),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Action not found');
  });

  test('POST requires action to be approved first', async () => {
    const action = createPendingAction({
      action_type: 'email_draft',
      title: 'Not Approved Action',
      status: 'pending',
    });

    // @ts-ignore - emulate NextRequest
    const res = await ExecutePOST({
      json: async () => ({ id: action.id }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Action must be approved before execution');
  });

  test('POST executes approved email_draft action', async () => {
    const action = createPendingAction({
      action_type: 'email_draft',
      title: 'Execute Email Test',
      status: 'approved',
    });

    // @ts-ignore - emulate NextRequest
    const res = await ExecutePOST({
      json: async () => ({ id: action.id }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('Email draft');
  });

  test('POST executes approved file_motion action', async () => {
    const action = createPendingAction({
      action_type: 'file_motion',
      title: 'Execute Motion Test',
      status: 'approved',
    });

    // @ts-ignore - emulate NextRequest
    const res = await ExecutePOST({
      json: async () => ({ id: action.id }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('Motion');
  });

  test('POST executes approved schedule_hearing action', async () => {
    const action = createPendingAction({
      action_type: 'schedule_hearing',
      title: 'Execute Hearing Test',
      status: 'approved',
    });

    // @ts-ignore - emulate NextRequest
    const res = await ExecutePOST({
      json: async () => ({ id: action.id }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('Hearing');
  });

  test('POST executes approved send_document action', async () => {
    const action = createPendingAction({
      action_type: 'send_document',
      title: 'Execute Document Test',
      status: 'approved',
    });

    // @ts-ignore - emulate NextRequest
    const res = await ExecutePOST({
      json: async () => ({ id: action.id }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('Document');
  });

  test('POST executes approved other action type', async () => {
    const action = createPendingAction({
      action_type: 'other',
      title: 'Generic Action Test',
      status: 'approved',
    });

    // @ts-ignore - emulate NextRequest
    const res = await ExecutePOST({
      json: async () => ({ id: action.id }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('marked as executed');
  });
});
