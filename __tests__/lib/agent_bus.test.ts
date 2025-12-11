// @ts-nocheck
/**
 * Wrath Shield v3 - Agent Bus Tests
 *
 * Tests for inter-agent communication message bus with adaptive triggers
 * and domain-aware routing via Life OS config.
 */

import {
  shouldEmit,
  calculatePriority,
  generateMessageId,
  createMessage,
  emit,
  emitMessage,
  markRead,
  acknowledge,
  markAllRead,
  getMessagesFor,
  getMessagesFrom,
  getAllMessages,
  getMessage,
  getStats,
  getUnreadCount,
  loadBusStore,
  saveBusStore,
  clearMessages,
  detectDomain,
  routeToAgents,
  smartEmit,
  getRecommendedAgents,
  type AgentMessage,
  type AgentId,
} from '@/lib/agent_bus';

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock life-os-config
jest.mock('@/lib/life-os-config', () => ({
  getAgentsForDomain: jest.fn().mockReturnValue([]),
  getDomain: jest.fn().mockReturnValue(null),
  determineEscalationLevel: jest.fn().mockReturnValue('AUTO_EXECUTE'),
}));

const fs = require('fs');
const lifeOsConfig = require('@/lib/life-os-config');

describe('Agent Bus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no existing store
    fs.existsSync.mockReturnValue(false);
  });

  describe('shouldEmit', () => {
    it('should emit when confidence is low (< 0.8)', () => {
      expect(shouldEmit({ confidence: 0.5 })).toBe(true);
      expect(shouldEmit({ confidence: 0.79 })).toBe(true);
    });

    it('should NOT emit when confidence is high (>= 0.8) and no other triggers', () => {
      expect(shouldEmit({
        confidence: 0.9,
        impact: 'low',
        priority: 'low',
        category: 'status',
        context: { action_required: false },
      })).toBe(false);
    });

    it('should emit when impact is high', () => {
      expect(shouldEmit({ confidence: 0.95, impact: 'high' })).toBe(true);
    });

    it('should emit when priority is critical', () => {
      expect(shouldEmit({ confidence: 0.95, impact: 'low', priority: 'critical' })).toBe(true);
    });

    it('should emit when category is escalation', () => {
      expect(shouldEmit({ confidence: 0.95, impact: 'low', category: 'escalation' })).toBe(true);
    });

    it('should emit when category is decision', () => {
      expect(shouldEmit({ confidence: 0.95, impact: 'low', category: 'decision' })).toBe(true);
    });

    it('should emit when action_required is true', () => {
      expect(shouldEmit({
        confidence: 0.95,
        impact: 'low',
        context: { action_required: true },
      })).toBe(true);
    });

    it('should default confidence to 1 (high) if not provided', () => {
      expect(shouldEmit({ impact: 'low' })).toBe(false);
    });
  });

  describe('calculatePriority', () => {
    it('should return critical for high impact + low confidence', () => {
      expect(calculatePriority(0.4, 'high')).toBe('critical');
    });

    it('should return high for high impact', () => {
      expect(calculatePriority(0.7, 'high')).toBe('high');
    });

    it('should return high for low confidence', () => {
      expect(calculatePriority(0.5, 'medium')).toBe('high');
    });

    it('should return normal for medium confidence/impact', () => {
      expect(calculatePriority(0.75, 'medium')).toBe('normal');
    });

    it('should return low for high confidence + low impact', () => {
      expect(calculatePriority(0.9, 'low')).toBe('low');
    });
  });

  describe('generateMessageId', () => {
    it('should generate unique 16-character hex IDs', () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();

      expect(id1).toMatch(/^[a-f0-9]{16}$/);
      expect(id2).toMatch(/^[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('createMessage', () => {
    it('should create a message with all required fields', () => {
      const msg = createMessage({
        from: 'pm-agent',
        to: 'user',
        category: 'alert',
        subject: 'Test Alert',
        body: 'This is a test.',
        confidence: 0.85,
        impact: 'medium',
      });

      expect(msg.from).toBe('pm-agent');
      expect(msg.to).toBe('user');
      expect(msg.category).toBe('alert');
      expect(msg.subject).toBe('Test Alert');
      expect(msg.body).toBe('This is a test.');
      expect(msg.confidence).toBe(0.85);
      expect(msg.impact).toBe('medium');
      expect(msg.priority).toBe('normal');
      expect(msg.status).toBe('pending');
      expect(msg.read).toBe(false);
      expect(msg.acknowledged).toBe(false);
      expect(msg.id).toBeDefined();
      expect(msg.timestamp).toBeDefined();
    });

    it('should calculate priority automatically', () => {
      const msg = createMessage({
        from: 'finance-agent',
        to: 'user',
        category: 'decision',
        subject: 'Urgent',
        body: 'High impact low confidence',
        confidence: 0.3,
        impact: 'high',
      });

      expect(msg.priority).toBe('critical');
    });

    it('should include optional context and metadata', () => {
      const msg = createMessage({
        from: 'legal-agent',
        to: 'pm-agent',
        category: 'request',
        subject: 'Timeline request',
        body: 'Need project timeline',
        confidence: 0.9,
        impact: 'low',
        context: {
          project: 'TestProject',
          domain: 'legal',
          action_required: true,
        },
        metadata: { source: 'test' },
        response_to: 'prev-msg-id',
      });

      expect(msg.context?.project).toBe('TestProject');
      expect(msg.context?.domain).toBe('legal');
      expect(msg.metadata?.source).toBe('test');
      expect(msg.response_to).toBe('prev-msg-id');
    });
  });

  describe('emit', () => {
    it('should emit message when shouldEmit returns true', () => {
      fs.existsSync.mockReturnValue(false);

      const msg = createMessage({
        from: 'pm-agent',
        to: 'user',
        category: 'escalation',
        subject: 'Critical issue',
        body: 'Needs attention',
        confidence: 0.5,
        impact: 'high',
      });

      const result = emit(msg);

      expect(result).toBe(msg);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should suppress message when shouldEmit returns false', () => {
      const msg = createMessage({
        from: 'pm-agent',
        to: 'orchestrator',
        category: 'status',
        subject: 'Routine status',
        body: 'All good',
        confidence: 0.95,
        impact: 'low',
      });
      // Override action_required to false
      msg.context = { action_required: false };

      const result = emit(msg);

      expect(result).toBeNull();
    });

    it('should force emit even when shouldEmit returns false', () => {
      fs.existsSync.mockReturnValue(false);

      const msg = createMessage({
        from: 'pm-agent',
        to: 'orchestrator',
        category: 'status',
        subject: 'Routine status',
        body: 'All good',
        confidence: 0.95,
        impact: 'low',
      });
      msg.context = { action_required: false };

      const result = emit(msg, true);

      expect(result).toBe(msg);
    });
  });

  describe('emitMessage', () => {
    it('should create and emit message in one call', () => {
      fs.existsSync.mockReturnValue(false);

      const result = emitMessage({
        from: 'finance-agent',
        to: 'user',
        category: 'decision',
        subject: 'Transaction review',
        body: 'Please review',
        confidence: 0.6,
        impact: 'medium',
      });

      expect(result).toBeDefined();
      expect(result?.from).toBe('finance-agent');
    });
  });

  describe('Message retrieval', () => {
    const mockStore = {
      version: '1.0',
      updated_at: 1704067200,
      messages: [
        {
          id: 'msg1',
          timestamp: 1704067200,
          from: 'pm-agent' as AgentId,
          to: 'user' as AgentId,
          category: 'alert' as const,
          priority: 'high' as const,
          subject: 'Alert 1',
          body: 'Body 1',
          confidence: 0.7,
          impact: 'high' as const,
          status: 'pending' as const,
          read: false,
          acknowledged: false,
        },
        {
          id: 'msg2',
          timestamp: 1704067100,
          from: 'finance-agent' as AgentId,
          to: 'pm-agent' as AgentId,
          category: 'request' as const,
          priority: 'normal' as const,
          subject: 'Request 1',
          body: 'Body 2',
          confidence: 0.9,
          impact: 'low' as const,
          status: 'completed' as const,
          read: true,
          acknowledged: true,
        },
        {
          id: 'msg3',
          timestamp: 1704067050,
          from: 'legal-agent' as AgentId,
          to: 'broadcast' as const,
          category: 'status' as const,
          priority: 'low' as const,
          subject: 'Status 1',
          body: 'Body 3',
          confidence: 0.95,
          impact: 'low' as const,
          status: 'completed' as const,
          read: false,
          acknowledged: false,
        },
      ],
      stats: {
        total_messages: 3,
        unread_count: 2,
        by_agent: {},
        by_category: {},
      },
    };

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockStore));
    });

    describe('getMessagesFor', () => {
      it('should get messages for specific agent', () => {
        const messages = getMessagesFor('user');
        expect(messages.length).toBe(1);
        expect(messages[0].id).toBe('msg1');
      });

      it('should include broadcast messages', () => {
        const messages = getMessagesFor('pm-agent');
        expect(messages.length).toBe(2); // msg2 + msg3 (broadcast)
      });

      it('should filter unread only', () => {
        const messages = getMessagesFor('pm-agent', { unreadOnly: true });
        expect(messages.length).toBe(1);
        expect(messages[0].id).toBe('msg3'); // Only unread broadcast
      });

      it('should limit results', () => {
        const messages = getMessagesFor('pm-agent', { limit: 1 });
        expect(messages.length).toBe(1);
      });
    });

    describe('getMessagesFrom', () => {
      it('should get messages from specific agent', () => {
        const messages = getMessagesFrom('pm-agent');
        expect(messages.length).toBe(1);
        expect(messages[0].id).toBe('msg1');
      });

      it('should limit results', () => {
        const messages = getMessagesFrom('legal-agent', { limit: 1 });
        expect(messages.length).toBe(1);
      });
    });

    describe('getAllMessages', () => {
      it('should get all messages', () => {
        const messages = getAllMessages();
        expect(messages.length).toBe(3);
      });

      it('should filter by category', () => {
        const messages = getAllMessages({ category: 'alert' });
        expect(messages.length).toBe(1);
        expect(messages[0].category).toBe('alert');
      });

      it('should filter by priority', () => {
        const messages = getAllMessages({ priority: 'high' });
        expect(messages.length).toBe(1);
        expect(messages[0].priority).toBe('high');
      });

      it('should limit results', () => {
        const messages = getAllMessages({ limit: 2 });
        expect(messages.length).toBe(2);
      });
    });

    describe('getMessage', () => {
      it('should get message by ID', () => {
        const message = getMessage('msg2');
        expect(message?.id).toBe('msg2');
        expect(message?.from).toBe('finance-agent');
      });

      it('should return undefined for non-existent ID', () => {
        const message = getMessage('nonexistent');
        expect(message).toBeUndefined();
      });
    });

    describe('getStats', () => {
      it('should return bus stats', () => {
        const stats = getStats();
        expect(stats.total_messages).toBe(3);
        expect(stats.unread_count).toBe(2);
      });
    });

    describe('getUnreadCount', () => {
      it('should return total unread count', () => {
        const count = getUnreadCount();
        expect(count).toBe(2);
      });

      it('should return unread count for specific agent', () => {
        const count = getUnreadCount('user');
        expect(count).toBe(1);
      });
    });
  });

  describe('Message management', () => {
    const mockStore = {
      version: '1.0',
      updated_at: 1704067200,
      messages: [
        {
          id: 'msg1',
          timestamp: 1704067200,
          from: 'pm-agent',
          to: 'user',
          category: 'alert',
          priority: 'high',
          subject: 'Alert',
          body: 'Body',
          confidence: 0.7,
          impact: 'high',
          status: 'pending',
          read: false,
          acknowledged: false,
        },
        {
          id: 'msg2',
          timestamp: 1704067100,
          from: 'finance-agent',
          to: 'user',
          category: 'request',
          priority: 'normal',
          subject: 'Request',
          body: 'Body 2',
          confidence: 0.9,
          impact: 'low',
          status: 'pending',
          read: false,
          acknowledged: false,
        },
      ],
      stats: {
        total_messages: 2,
        unread_count: 2,
        by_agent: {},
        by_category: {},
      },
    };

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockStore));
    });

    describe('markRead', () => {
      it('should mark message as read', () => {
        const result = markRead('msg1');
        expect(result).toBe(true);
        expect(fs.writeFileSync).toHaveBeenCalled();
      });

      it('should return false for non-existent message', () => {
        const result = markRead('nonexistent');
        expect(result).toBe(false);
      });
    });

    describe('acknowledge', () => {
      it('should acknowledge message and mark as read', () => {
        const result = acknowledge('msg1');
        expect(result).toBe(true);
        expect(fs.writeFileSync).toHaveBeenCalled();
      });

      it('should return false for non-existent message', () => {
        const result = acknowledge('nonexistent');
        expect(result).toBe(false);
      });
    });

    describe('markAllRead', () => {
      it('should mark all messages as read and return count', () => {
        const count = markAllRead();
        expect(count).toBe(2);
        expect(fs.writeFileSync).toHaveBeenCalled();
      });
    });

    describe('clearMessages', () => {
      it('should clear all messages', () => {
        clearMessages();
        expect(fs.writeFileSync).toHaveBeenCalled();
      });
    });
  });

  describe('Domain Detection', () => {
    describe('detectDomain', () => {
      it('should detect family domain', () => {
        expect(detectDomain('Meeting about kids schedule')).toBe('family');
        expect(detectDomain('Custody arrangement discussion')).toBe('family');
        expect(detectDomain('Hiro needs help with homework')).toBe('family');
      });

      it('should detect legal domain', () => {
        expect(detectDomain('Review the lawsuit documents')).toBe('legal');
        expect(detectDomain('Court filing deadline')).toBe('legal');
        expect(detectDomain('Attorney fee review')).toBe('legal');
      });

      it('should detect health domain', () => {
        expect(detectDomain('WHOOP recovery score')).toBe('health');
        expect(detectDomain('Workout plan for tomorrow')).toBe('health');
        expect(detectDomain('Sleep quality analysis')).toBe('health');
      });

      it('should detect finance domain', () => {
        expect(detectDomain('Budget for next month')).toBe('personal_finance');
        expect(detectDomain('Tax preparation notes')).toBe('personal_finance');
        expect(detectDomain('Investment portfolio review')).toBe('personal_finance');
      });

      it('should detect vuplicity domain', () => {
        expect(detectDomain('Vuplicity FCRA compliance')).toBe('vuplicity');
        expect(detectDomain('Background check dispute')).toBe('vuplicity');
        expect(detectDomain('Consumer report error')).toBe('vuplicity');
      });

      it('should return null for unrecognized content', () => {
        expect(detectDomain('Random text about nothing specific')).toBeNull();
      });
    });

    describe('routeToAgents', () => {
      it('should route to pm-agent by default', () => {
        lifeOsConfig.getAgentsForDomain.mockReturnValue([]);
        const agents = routeToAgents({ subject: 'Unknown task', body: 'Do something' });
        expect(agents).toEqual(['pm-agent']);
      });

      it('should route based on detected domain', () => {
        lifeOsConfig.getAgentsForDomain.mockReturnValue([
          { id: 'agent.legal', name: 'Legal Agent' },
        ]);
        lifeOsConfig.getDomain.mockReturnValue({ priority_weight: 9 });

        const agents = routeToAgents({ subject: 'Court filing', body: 'Lawsuit details' });
        expect(agents).toContain('legal-agent');
      });

      it('should use explicit domain from context', () => {
        lifeOsConfig.getAgentsForDomain.mockReturnValue([
          { id: 'agent.finance', name: 'Finance Agent' },
        ]);
        lifeOsConfig.getDomain.mockReturnValue({ priority_weight: 7 });

        const agents = routeToAgents({
          subject: 'Task',
          body: 'Body',
          context: { domain: 'personal_finance' },
        });
        expect(agents).toContain('finance-agent');
      });
    });

    describe('getRecommendedAgents', () => {
      it('should return recommended agents for domain', () => {
        lifeOsConfig.getAgentsForDomain.mockReturnValue([
          { id: 'agent.legal', name: 'Legal Agent' },
        ]);
        lifeOsConfig.getDomain.mockReturnValue({ name: 'Legal', priority_weight: 9 });

        const agents = getRecommendedAgents('legal');
        expect(agents.length).toBe(1);
        expect(agents[0].agentId).toBe('legal-agent');
        expect(agents[0].name).toBe('Legal Agent');
      });

      it('should return pm-agent as default fallback', () => {
        lifeOsConfig.getAgentsForDomain.mockImplementation(() => {
          throw new Error('Domain not found');
        });

        const agents = getRecommendedAgents('unknown');
        expect(agents.length).toBe(1);
        expect(agents[0].agentId).toBe('pm-agent');
      });
    });
  });

  describe('smartEmit', () => {
    it('should detect domain and route message', () => {
      fs.existsSync.mockReturnValue(false);
      lifeOsConfig.getAgentsForDomain.mockReturnValue([
        { id: 'agent.health', name: 'Health Agent' },
      ]);
      lifeOsConfig.getDomain.mockReturnValue({ priority_weight: 8 });
      lifeOsConfig.determineEscalationLevel.mockReturnValue('AUTO_EXECUTE');

      const result = smartEmit({
        from: 'orchestrator',
        category: 'alert',
        subject: 'WHOOP alert',
        body: 'Low recovery score',
        confidence: 0.6,
        impact: 'medium',
      });

      expect(result).toBeDefined();
      expect(result?.metadata?.escalation_level).toBe('AUTO_EXECUTE');
      expect(result?.metadata?.routed_via).toBe('life-os');
    });

    it('should adjust impact for CRITICAL escalation', () => {
      fs.existsSync.mockReturnValue(false);
      lifeOsConfig.getAgentsForDomain.mockReturnValue([]);
      lifeOsConfig.determineEscalationLevel.mockReturnValue('CRITICAL');

      const result = smartEmit({
        from: 'legal-agent',
        category: 'escalation',
        subject: 'Court deadline',
        body: 'Filing due tomorrow',
        confidence: 0.3,
        impact: 'medium',
      });

      expect(result?.impact).toBe('high');
    });
  });
});
