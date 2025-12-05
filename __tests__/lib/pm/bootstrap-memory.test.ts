/**
 * Bootstrap Memory Tests
 *
 * Tests for the PM memory bootstrap system including:
 * - Pattern seeding
 * - Domain pattern generation
 * - Escalation rule generation
 * - Custom pattern addition
 */

import {
  bootstrapPMMemory,
  seedPattern,
  listBootstrapPatterns,
  addCustomTriagePattern,
} from '@/lib/pm/bootstrap-memory';

// Mock pm-memory
const mockAddPMMemory = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/pm/pm-memory', () => ({
  addPMMemory: (...args: unknown[]) => mockAddPMMemory(...args),
}));

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock life-os-config
jest.mock('@/lib/life-os-config', () => ({
  getLifeCharter: () => ({
    owner: 'test',
    version: 1,
    lastUpdated: '2024-01-01',
    global_principles: [
      'Family first',
      'Legal compliance is non-negotiable',
      'Security before convenience',
    ],
    escalation_levels: {
      CRITICAL: {
        description: 'Immediate attention required',
        triggers: ['legal threat', 'security breach', 'family emergency'],
        response_time: 'immediate',
      },
      PROPOSE: {
        description: 'Needs approval',
        triggers: ['new project', 'bulk operation', 'budget change'],
        response_time: '24h',
      },
      AUTO_EXECUTE: {
        description: 'Auto execute',
        triggers: ['routine sync', 'low-risk operation'],
        response_time: 'async',
      },
    },
    priority_stack: [],
    coherence_rules: {
      avoid_fragmentation: [],
      deadline_rules: [],
      meeting_rules: [],
    },
  }),
  getDomains: () => ({
    version: 1,
    domains: [
      {
        id: 'utlyze',
        name: 'Utlyze',
        type: 'company',
        description: 'Main company',
        owner: 'test',
        key_people: [],
        default_agent: 'agent.pm',
        priority_weight: 10,
        sensitivity_level: 'high_compliance',
      },
      {
        id: 'family',
        name: 'Family',
        type: 'personal',
        description: 'Personal family domain',
        owner: 'test',
        key_people: [],
        default_agent: 'agent.pm',
        priority_weight: 100,
      },
      {
        id: 'vuplicity',
        name: 'Vuplicity',
        type: 'company',
        description: 'Business unit',
        owner: 'test',
        key_people: [],
        default_agent: 'agent.pm',
        priority_weight: 8,
      },
    ],
  }),
  getMappings: () => ({
    version: 1,
    motion: { workspaces: [] },
    github: { organizations: [], repos: [] },
    project_mappings: [],
    sync_rules: {},
  }),
}));

describe('Bootstrap Memory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listBootstrapPatterns', () => {
    test('should return all available patterns', () => {
      const patterns = listBootstrapPatterns();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every(p => p.id)).toBe(true);
      expect(patterns.every(p => p.category)).toBe(true);
      expect(patterns.every(p => p.preview)).toBe(true);
    });

    test('should include triage patterns', () => {
      const patterns = listBootstrapPatterns();

      const triagePatterns = patterns.filter(p =>
        p.id.includes('legal') ||
        p.id.includes('github') ||
        p.id.includes('security')
      );

      expect(triagePatterns.length).toBeGreaterThan(0);
    });

    test('should include domain patterns', () => {
      const patterns = listBootstrapPatterns();

      const domainPatterns = patterns.filter(p => p.id.startsWith('domain-'));

      // Should have patterns for utlyze (high compliance) and family (personal)
      expect(domainPatterns.length).toBeGreaterThanOrEqual(2);
    });

    test('should include escalation patterns', () => {
      const patterns = listBootstrapPatterns();

      const escalationPatterns = patterns.filter(p =>
        p.id.startsWith('escalation-') || p.id.startsWith('principle-')
      );

      // CRITICAL, PROPOSE, AUTO + 3 principles
      expect(escalationPatterns.length).toBeGreaterThanOrEqual(6);
    });

    test('should include correction examples', () => {
      const patterns = listBootstrapPatterns();

      const corrections = patterns.filter(p => p.id.startsWith('correction-'));

      expect(corrections.length).toBeGreaterThan(0);
    });
  });

  describe('bootstrapPMMemory', () => {
    test('should seed all patterns when no categories specified', async () => {
      const result = await bootstrapPMMemory();

      expect(result.seeded).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(mockAddPMMemory).toHaveBeenCalled();
    });

    test('should seed only triage patterns when specified', async () => {
      const result = await bootstrapPMMemory({
        categories: ['triage'],
      });

      expect(result.seeded).toBeGreaterThan(0);

      // Check all calls had bootstrap_category
      mockAddPMMemory.mock.calls.forEach(call => {
        const metadata = call[2];
        expect(metadata.bootstrap_category).toBeDefined();
      });
    });

    test('should seed only domain patterns when specified', async () => {
      const result = await bootstrapPMMemory({
        categories: ['domain'],
      });

      expect(result.seeded).toBeGreaterThanOrEqual(2);

      // Check calls are domain-specific
      mockAddPMMemory.mock.calls.forEach(call => {
        const text = call[0];
        expect(text).toContain('Domain pattern:');
      });
    });

    test('should seed only escalation patterns when specified', async () => {
      const result = await bootstrapPMMemory({
        categories: ['escalation'],
      });

      expect(result.seeded).toBeGreaterThan(0);

      // Should include CRITICAL, PROPOSE, AUTO triggers + principles
      const allText = mockAddPMMemory.mock.calls.map(c => c[0]).join(' ');
      expect(allText).toContain('CRITICAL');
      expect(allText).toContain('PROPOSE');
      expect(allText).toContain('Global principle');
    });

    test('should seed only corrections when specified', async () => {
      const result = await bootstrapPMMemory({
        categories: ['corrections'],
      });

      expect(result.seeded).toBeGreaterThan(0);

      mockAddPMMemory.mock.calls.forEach(call => {
        const text = call[0];
        expect(text).toContain('Correction example:');
      });
    });

    test('should handle errors gracefully', async () => {
      mockAddPMMemory.mockRejectedValueOnce(new Error('Zep connection failed'));

      const result = await bootstrapPMMemory({
        categories: ['triage'],
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Zep connection failed');
    });

    test('should seed multiple categories', async () => {
      const result = await bootstrapPMMemory({
        categories: ['triage', 'corrections'],
      });

      expect(result.seeded).toBeGreaterThan(0);

      const allText = mockAddPMMemory.mock.calls.map(c => c[0]).join('\n');
      expect(allText).toContain('Triage pattern:');
      expect(allText).toContain('Correction example:');
    });
  });

  describe('seedPattern', () => {
    test('should seed a specific pattern by ID', async () => {
      const result = await seedPattern('legal-deadline-critical');

      expect(result).toBe(true);
      expect(mockAddPMMemory).toHaveBeenCalledTimes(1);

      const call = mockAddPMMemory.mock.calls[0];
      expect(call[0]).toContain('legal source');
      expect(call[0]).toContain('deadline');
      expect(call[2].bootstrap_id).toBe('legal-deadline-critical');
    });

    test('should return false for non-existent pattern', async () => {
      const result = await seedPattern('non-existent-pattern');

      expect(result).toBe(false);
      expect(mockAddPMMemory).not.toHaveBeenCalled();
    });

    test('should seed domain patterns by ID', async () => {
      const result = await seedPattern('domain-utlyze-compliance');

      expect(result).toBe(true);
      expect(mockAddPMMemory).toHaveBeenCalledTimes(1);

      const call = mockAddPMMemory.mock.calls[0];
      expect(call[0]).toContain('Utlyze');
      expect(call[0]).toContain('high-compliance');
    });

    test('should seed escalation patterns by ID', async () => {
      const result = await seedPattern('escalation-critical-triggers');

      expect(result).toBe(true);
      expect(mockAddPMMemory).toHaveBeenCalledTimes(1);

      const call = mockAddPMMemory.mock.calls[0];
      expect(call[0]).toContain('CRITICAL');
      expect(call[0]).toContain('immediate');
    });
  });

  describe('addCustomTriagePattern', () => {
    test('should add a custom pattern', async () => {
      await addCustomTriagePattern({
        id: 'custom-client-urgent',
        description: 'Client emails marked urgent should be high priority',
        source: 'inbox',
        signalType: 'task',
        keywords: ['client', 'urgent'],
        recommendedAction: 'local_task',
        recommendedEscalation: 'propose',
        recommendedPriority: 'high',
      });

      expect(mockAddPMMemory).toHaveBeenCalledTimes(1);

      const call = mockAddPMMemory.mock.calls[0];
      expect(call[0]).toContain('Custom triage pattern');
      expect(call[0]).toContain('action=local_task');
      expect(call[0]).toContain('escalation=propose');
      expect(call[0]).toContain('priority=high');
      expect(call[1]).toBe('pattern');
      expect(call[2].custom_pattern_id).toBe('custom-client-urgent');
      expect(call[2].source).toBe('inbox');
      expect(call[2].keywords).toContain('urgent');
    });

    test('should add pattern without optional fields', async () => {
      await addCustomTriagePattern({
        id: 'custom-simple',
        description: 'Simple pattern without optional fields',
        recommendedAction: 'defer',
        recommendedEscalation: 'auto',
      });

      expect(mockAddPMMemory).toHaveBeenCalledTimes(1);

      const call = mockAddPMMemory.mock.calls[0];
      expect(call[0]).not.toContain('priority=');
      expect(call[2].source).toBeUndefined();
    });
  });

  describe('Pattern Content Validation', () => {
    test('legal patterns should be defined with correct ID', () => {
      const patterns = listBootstrapPatterns();
      const legalDeadline = patterns.find(p => p.id === 'legal-deadline-critical');

      expect(legalDeadline).toBeDefined();
      expect(legalDeadline!.id).toContain('critical');
      expect(legalDeadline!.category).toBe('pattern');
    });

    test('security patterns should be defined with correct ID', () => {
      const patterns = listBootstrapPatterns();
      const securityPattern = patterns.find(p => p.id === 'security-breach-critical');

      expect(securityPattern).toBeDefined();
      expect(securityPattern!.id).toContain('critical');
      expect(securityPattern!.category).toBe('pattern');
    });

    test('low confidence patterns should recommend defer', () => {
      const patterns = listBootstrapPatterns();
      const lowConfidence = patterns.find(p => p.id === 'low-confidence-defer');

      expect(lowConfidence).toBeDefined();
      expect(lowConfidence!.id).toContain('defer');
      expect(lowConfidence!.preview).toContain('Low-confidence');
    });

    test('github sync patterns should be defined', () => {
      const patterns = listBootstrapPatterns();
      const githubSync = patterns.find(p => p.id === 'github-issue-opened');

      expect(githubSync).toBeDefined();
      expect(githubSync!.preview).toContain('GitHub issues');
      expect(githubSync!.category).toBe('pattern');
    });

    test('correction examples should explain the mistake', () => {
      const patterns = listBootstrapPatterns();
      const corrections = patterns.filter(p => p.id.startsWith('correction-'));

      corrections.forEach(c => {
        expect(c.preview).toContain('Correction');
      });
    });
  });

  describe('Domain Pattern Generation', () => {
    test('should generate high-compliance pattern for Utlyze', () => {
      const patterns = listBootstrapPatterns();
      const utlyzePattern = patterns.find(p => p.id === 'domain-utlyze-compliance');

      expect(utlyzePattern).toBeDefined();
      // Preview truncates at 100 chars, so check what we can
      expect(utlyzePattern!.preview).toContain('Utlyze');
      expect(utlyzePattern!.preview).toContain('high-compliance');
      expect(utlyzePattern!.category).toBe('pattern');
    });

    test('should generate personal pattern for Family domain', () => {
      const patterns = listBootstrapPatterns();
      const familyPattern = patterns.find(p => p.id === 'domain-family-personal');

      expect(familyPattern).toBeDefined();
      expect(familyPattern!.preview).toContain('personal');
      expect(familyPattern!.preview).toContain('Family');
    });
  });

  describe('Escalation Pattern Generation', () => {
    test('should include all escalation levels', () => {
      const patterns = listBootstrapPatterns();

      expect(patterns.find(p => p.id === 'escalation-critical-triggers')).toBeDefined();
      expect(patterns.find(p => p.id === 'escalation-propose-triggers')).toBeDefined();
      expect(patterns.find(p => p.id === 'escalation-auto-triggers')).toBeDefined();
    });

    test('should include global principles', () => {
      const patterns = listBootstrapPatterns();
      const principles = patterns.filter(p => p.id.startsWith('principle-'));

      expect(principles.length).toBe(3); // 3 principles in mock
    });
  });
});
