// @ts-nocheck
/**
 * Wrath Shield v3 - Agent Registry Tests
 *
 * Tests for the agent registry that tracks status of all agents
 * in the Life OS system (Legal, Finance, PM, Comms, EA, Health, Hyro, etc.)
 */

import { getAllAgentsStatus } from '@/lib/agents/registry';

// Mock Database
jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: jest.fn().mockReturnValue({
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue({ count: 3 }),
        all: jest.fn().mockReturnValue([]),
      }),
    }),
  }),
}));

// Mock relationshipDb
jest.mock('@/lib/relationshipDb', () => ({
  getRelationshipDb: jest.fn().mockReturnValue({
    prepare: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue({ count: 2, last_ts: 1704067200 }),
    }),
  }),
}));

// Mock life-os-config
jest.mock('@/lib/life-os-config', () => ({
  getAgents: jest.fn().mockReturnValue({
    agents: [
      {
        id: 'agent.orchestrator',
        name: 'Orchestrator',
        tools: ['memory', 'cortex'],
        domains: ['*'],
      },
      {
        id: 'agent.legal',
        name: 'Legal Advocate',
        tools: ['mycase', 'gmail'],
        domains: ['legal', 'vuplicity'],
      },
      {
        id: 'agent.finance',
        name: 'Finance Analyst',
        tools: ['plaid'],
        domains: ['personal_finance'],
      },
      {
        id: 'agent.pm',
        name: 'Project Maestro',
        tools: ['github', 'linear'],
        domains: ['utlyze_core', 'kahoa'],
      },
    ],
  }),
}));

// Mock AgentInvoker
jest.mock('@/lib/agents/AgentInvoker', () => ({
  agentInvoker: {
    getRecentActivity: jest.fn().mockReturnValue([
      {
        agentId: 'agent.orchestrator',
        timestamp: Date.now(),
        wasExecuted: true,
        tokensUsed: 500,
        escalationLevel: 'AUTO_EXECUTE',
      },
      {
        agentId: 'agent.legal',
        timestamp: Date.now() - 1000,
        wasExecuted: true,
        tokensUsed: 300,
        escalationLevel: 'PROPOSE',
      },
      {
        agentId: 'agent.legal',
        timestamp: Date.now() - 2000,
        wasExecuted: false,
        tokensUsed: 100,
        escalationLevel: 'CRITICAL',
      },
    ]),
  },
}));

// Mock fetch for EA status
global.fetch = jest.fn().mockImplementation((url: string) => {
  if (url.includes('/api/ea/status')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        stats: { upcomingEvents: 5, todayEvents: 2 },
      }),
    });
  }
  if (url.includes('/api/hyro/status')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        health_score: 85,
        pending_items: 3,
        items_completed_today: 4,
        last_sync: '2025-01-31T10:00:00Z',
      }),
    });
  }
  if (url.includes('/api/db/status')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        eeg_tokens: { has_data: true, row_count: 500 },
      }),
    });
  }
  return Promise.reject(new Error('Not found'));
});

describe('Agent Registry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllAgentsStatus', () => {
    it('should return array of agents', async () => {
      const agents = await getAllAgentsStatus();

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should include Life OS agents', async () => {
      const agents = await getAllAgentsStatus();

      const orchestrator = agents.find(a => a.id === 'orchestrator');
      expect(orchestrator).toBeDefined();
      expect(orchestrator?.name).toBe('Orchestrator');
    });

    it('should include legacy fallback agents', async () => {
      const agents = await getAllAgentsStatus();

      // These should be added as fallbacks
      const scheduler = agents.find(a => a.id === 'scheduler');
      const saturation = agents.find(a => a.id === 'saturation');
      const relationships = agents.find(a => a.id === 'relationships');

      expect(scheduler).toBeDefined();
      expect(saturation).toBeDefined();
      expect(relationships).toBeDefined();
    });

    it('should calculate HP from activity success rate', async () => {
      const agents = await getAllAgentsStatus();

      const legal = agents.find(a => a.id === 'legal');
      // Legal has 2 activities: 1 executed, 1 not executed = 50% HP
      expect(legal?.hp).toBeDefined();
    });

    it('should calculate MP from token efficiency', async () => {
      const agents = await getAllAgentsStatus();

      const orchestrator = agents.find(a => a.id === 'orchestrator');
      expect(orchestrator?.mp).toBeDefined();
    });

    it('should set status based on activity', async () => {
      const agents = await getAllAgentsStatus();

      // Agents with CRITICAL escalations should be red
      const legal = agents.find(a => a.id === 'legal');
      expect(legal?.status).toBe('red');
    });

    it('should include capabilities from agent definition', async () => {
      const agents = await getAllAgentsStatus();

      const pm = agents.find(a => a.id === 'pm');
      expect(pm?.capabilities).toBeDefined();
      expect(pm?.capabilities.length).toBeGreaterThan(0);
    });

    it('should generate correct links', async () => {
      const agents = await getAllAgentsStatus();

      const finance = agents.find(a => a.id === 'finance');
      expect(finance?.link).toBe('/finance');
    });

    it('should handle empty activity gracefully', async () => {
      const { agentInvoker } = require('@/lib/agents/AgentInvoker');
      agentInvoker.getRecentActivity.mockReturnValueOnce([]);

      const agents = await getAllAgentsStatus();

      // Should still return agents with default values
      expect(agents.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Status Calculation', () => {
    it('should return yellow when no activity', async () => {
      const { agentInvoker } = require('@/lib/agents/AgentInvoker');
      agentInvoker.getRecentActivity.mockReturnValueOnce([]);

      const agents = await getAllAgentsStatus();

      const orchestrator = agents.find(a => a.id === 'orchestrator');
      expect(orchestrator?.status).toBe('yellow');
    });

    it('should return red when critical escalations present', async () => {
      const { agentInvoker } = require('@/lib/agents/AgentInvoker');
      agentInvoker.getRecentActivity.mockReturnValueOnce([
        {
          agentId: 'agent.finance',
          timestamp: Date.now(),
          wasExecuted: false,
          tokensUsed: 100,
          escalationLevel: 'CRITICAL',
        },
      ]);

      const agents = await getAllAgentsStatus();

      const finance = agents.find(a => a.id === 'finance');
      expect(finance?.status).toBe('red');
    });

    it('should return yellow when execution rate below 50%', async () => {
      const { agentInvoker } = require('@/lib/agents/AgentInvoker');
      agentInvoker.getRecentActivity.mockReturnValueOnce([
        { agentId: 'agent.pm', wasExecuted: false, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE' },
        { agentId: 'agent.pm', wasExecuted: false, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE' },
        { agentId: 'agent.pm', wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE' },
      ]);

      const agents = await getAllAgentsStatus();

      const pm = agents.find(a => a.id === 'pm');
      // 1/3 executed = 33% < 50%
      expect(pm?.status).toBe('yellow');
    });

    it('should return green when healthy', async () => {
      const { agentInvoker } = require('@/lib/agents/AgentInvoker');
      agentInvoker.getRecentActivity.mockReturnValueOnce([
        { agentId: 'agent.orchestrator', wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE' },
        { agentId: 'agent.orchestrator', wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE' },
        { agentId: 'agent.orchestrator', wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE' },
      ]);

      const agents = await getAllAgentsStatus();

      const orchestrator = agents.find(a => a.id === 'orchestrator');
      expect(orchestrator?.status).toBe('green');
    });
  });

  describe('Individual Agent Status', () => {
    describe('EA Agent', () => {
      it('should fetch status from EA API', async () => {
        const agents = await getAllAgentsStatus();

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/ea/status'),
          expect.any(Object)
        );
      });

      it('should set open_items from todayEvents', async () => {
        const agents = await getAllAgentsStatus();

        const ea = agents.find(a => a.id === 'ea');
        expect(ea?.open_items).toBe(2);
      });
    });

    describe('Hyro Agent', () => {
      it('should fetch status from Hyro API', async () => {
        const agents = await getAllAgentsStatus();

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/hyro/status'),
          expect.any(Object)
        );
      });

      it('should handle Hyro API failure gracefully', async () => {
        (global.fetch as jest.Mock).mockImplementation((url: string) => {
          if (url.includes('/api/hyro/status')) {
            return Promise.reject(new Error('Network error'));
          }
          if (url.includes('/api/ea/status')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                stats: { upcomingEvents: 5, todayEvents: 2 },
              }),
            });
          }
          if (url.includes('/api/db/status')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                eeg_tokens: { has_data: true, row_count: 500 },
              }),
            });
          }
          return Promise.reject(new Error('Not found'));
        });

        const agents = await getAllAgentsStatus();

        const hyro = agents.find(a => a.id === 'hyro');
        expect(hyro?.status).toBe('red');
        expect(hyro?.hp).toBe(0);
      });
    });

    describe('EEG Agent', () => {
      it('should show green when connected', async () => {
        const agents = await getAllAgentsStatus();

        const eeg = agents.find(a => a.id === 'eeg');
        expect(eeg?.status).toBe('green');
        expect(eeg?.hp).toBe(100);
      });

      it('should show red when disconnected', async () => {
        (global.fetch as jest.Mock).mockImplementation((url: string) => {
          if (url.includes('/api/db/status')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                eeg_tokens: { has_data: false, row_count: 0 },
              }),
            });
          }
          // Return defaults for other URLs
          return Promise.resolve({ ok: false });
        });

        const agents = await getAllAgentsStatus();

        const eeg = agents.find(a => a.id === 'eeg');
        expect(eeg?.status).toBe('red');
      });
    });

    describe('Scheduler Agent', () => {
      it('should show as not implemented', async () => {
        const agents = await getAllAgentsStatus();

        const scheduler = agents.find(a => a.id === 'scheduler');
        expect(scheduler?.status).toBe('red');
        expect(scheduler?.capabilities[0]).toContain('[Not Implemented]');
      });
    });

    describe('Saturation Agent', () => {
      it('should show as not implemented', async () => {
        const agents = await getAllAgentsStatus();

        const saturation = agents.find(a => a.id === 'saturation');
        expect(saturation?.status).toBe('red');
        expect(saturation?.capabilities[0]).toContain('[Not Implemented]');
      });
    });

    describe('Relationships Agent', () => {
      it('should count follow-up suggestions', async () => {
        const agents = await getAllAgentsStatus();

        const relationships = agents.find(a => a.id === 'relationships');
        expect(relationships).toBeDefined();
        expect(relationships?.capabilities).toContain('Follow-up suggestions');
      });
    });
  });

  describe('Agent Icon Mapping', () => {
    it('should assign correct icons', async () => {
      const agents = await getAllAgentsStatus();

      expect(agents.find(a => a.id === 'legal')?.icon).toBe('gavel');
      expect(agents.find(a => a.id === 'finance')?.icon).toBe('coins');
      expect(agents.find(a => a.id === 'pm')?.icon).toBe('clipboard-list');
      expect(agents.find(a => a.id === 'comms')?.icon).toBe('mail');
    });
  });

  describe('Capability Extraction', () => {
    it('should include tool-based capabilities', async () => {
      const agents = await getAllAgentsStatus();

      const legal = agents.find(a => a.id === 'legal');
      // Should have mycase and gmail tools
      expect(legal?.capabilities).toEqual(
        expect.arrayContaining([
          expect.stringContaining('integration')
        ])
      );
    });

    it('should include cross-domain capability for orchestrator', async () => {
      const agents = await getAllAgentsStatus();

      const orchestrator = agents.find(a => a.id === 'orchestrator');
      expect(orchestrator?.capabilities).toContain('Cross-domain orchestration');
    });
  });
});
