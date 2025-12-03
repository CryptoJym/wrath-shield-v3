/**
 * PM Actions Tests
 *
 * Validates the organizational hierarchy and action execution
 * to prevent drift from the canonical taxonomy.
 */

import {
  executePMAction,
  executePMActionBatch,
  parseActionFromResponse,
  getPendingClarityTasks,
  type PMAction,
} from '@/lib/pm/pm-actions';

// Mock the database and GitHub client
jest.mock('@/lib/db/Database', () => ({
  getDatabase: () => ({
    getRawDb: () => ({
      exec: jest.fn(),
      prepare: jest.fn(() => ({
        run: jest.fn(() => ({ changes: 1 })),
        get: jest.fn(),
        all: jest.fn(() => []),
      })),
    }),
  }),
}));

jest.mock('@/lib/integrations/GitHubClient', () => ({
  __esModule: true,
  default: {
    getRepoMappings: jest.fn(() => []),
    setRepoMapping: jest.fn(),
  },
}));

jest.mock('@/lib/pm/github-org-config', () => ({
  getOrgByName: jest.fn((name: string) => {
    if (['utlyze', 'vuplicity', 'newreward', 'hdws', 'rd', 'kahoa', 'solutionstream', 'cryptojym'].includes(name)) {
      return { id: `org_${name}`, name };
    }
    return null;
  }),
  createOrg: jest.fn((params) => ({ id: `org_${params.name}`, ...params })),
  getAllOrgs: jest.fn(() => [{ id: 'org_utlyze', name: 'utlyze' }]),
  getRepoHierarchyByName: jest.fn(() => null),
  createRepoHierarchy: jest.fn(),
  updateRepoHierarchy: jest.fn(),
}));

describe('PM Actions - Organizational Hierarchy Validation', () => {
  describe('Valid Assignment Targets', () => {
    const VALID_TARGETS = [
      'utlyze',       // Umbrella org
      'vuplicity',    // Business unit
      'newreward',    // Business unit
      'hdws',         // Business unit (under Utlyze)
      'kahoa',        // Partner company
      'solutionstream', // Partner company
      'rd',           // R&D division (NOT a business unit)
      'cryptojym',    // Legacy/personal (NOT a business unit)
    ];

    test.each(VALID_TARGETS)('should accept valid target: %s', async (target) => {
      const action: PMAction = {
        action: 'assign_business_unit',
        repo_full_name: 'test/repo',
        params: { business_unit: target },
      };

      const result = await executePMAction(action);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    const INVALID_TARGETS = [
      'eeg_symbiosis',  // WRONG - should be 'rd'
      'eeg',            // WRONG - not a valid target
      'symbiosis',      // WRONG - not a valid target
      'crypto',         // WRONG - should be 'cryptojym'
      'random',         // Invalid
      '',               // Empty
    ];

    test.each(INVALID_TARGETS)('should reject invalid target: %s', async (target) => {
      const action: PMAction = {
        action: 'assign_business_unit',
        repo_full_name: 'test/repo',
        params: { business_unit: target },
      };

      const result = await executePMAction(action);
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_TARGET');
    });
  });

  describe('Business Unit Hierarchy Rules', () => {
    test('HDWS should be valid (it is a business unit under Utlyze)', async () => {
      const action: PMAction = {
        action: 'assign_business_unit',
        repo_full_name: 'test/hdws-automation',
        params: { business_unit: 'hdws' },
      };

      const result = await executePMAction(action);
      expect(result.success).toBe(true);
    });

    test('R&D (rd) is valid but NOT a business unit - used for orphans/research', async () => {
      const action: PMAction = {
        action: 'assign_business_unit',
        repo_full_name: 'test/consciousness-experiment',
        params: { business_unit: 'rd' },
      };

      const result = await executePMAction(action);
      expect(result.success).toBe(true);
    });

    test('CryptoJym is valid but NOT a business unit - used for legacy/personal', async () => {
      const action: PMAction = {
        action: 'assign_business_unit',
        repo_full_name: 'CryptoJym/old-project',
        params: { business_unit: 'cryptojym' },
      };

      const result = await executePMAction(action);
      expect(result.success).toBe(true);
    });
  });

  describe('Domain Classification', () => {
    const VALID_DOMAINS = [
      'product-core',
      'infrastructure',
      'internal-tools',
      'client-delivery',
      'research-experiments',
      'growth-marketing',
      'operations',
      'personal',
      'archived',
    ];

    test.each(VALID_DOMAINS)('should accept valid domain: %s', async (domain) => {
      const action: PMAction = {
        action: 'set_domain',
        repo_full_name: 'test/repo',
        params: { domain },
      };

      const result = await executePMAction(action);
      expect(result.success).toBe(true);
    });

    test('should reject invalid domain', async () => {
      const action: PMAction = {
        action: 'set_domain',
        repo_full_name: 'test/repo',
        params: { domain: 'invalid-domain' },
      };

      const result = await executePMAction(action);
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_DOMAIN');
    });
  });

  describe('Orphan Handling', () => {
    test('mark_as_orphan should place repo in R&D division (not eeg_symbiosis)', async () => {
      const { getOrgByName, createOrg } = require('@/lib/pm/github-org-config');

      const action: PMAction = {
        action: 'mark_as_orphan',
        repo_full_name: 'unknown/experiment',
      };

      await executePMAction(action);

      // Should look for 'rd' org, not 'eeg_symbiosis'
      expect(getOrgByName).toHaveBeenCalledWith('rd');
    });

    test('orphans should get research-experiments domain', async () => {
      const { createRepoHierarchy } = require('@/lib/pm/github-org-config');

      const action: PMAction = {
        action: 'mark_as_orphan',
        repo_full_name: 'unknown/experiment',
      };

      await executePMAction(action);

      expect(createRepoHierarchy).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'research-experiments',
        })
      );
    });
  });
});

describe('PM Actions - Action Parsing', () => {
  describe('parseActionFromResponse', () => {
    test('should parse assign_business_unit action', () => {
      const response = `Based on analysis, this repo belongs to Vuplicity.

      Action: assign_business_unit("CryptoJym/veri-api", "vuplicity")`;

      const action = parseActionFromResponse(response);

      expect(action).not.toBeNull();
      expect(action?.action).toBe('assign_business_unit');
      expect(action?.repo_full_name).toBe('CryptoJym/veri-api');
      expect(action?.params?.business_unit).toBe('vuplicity');
    });

    test('should parse mark_as_orphan action', () => {
      const response = `Purpose unclear, marking as orphan.

      Action: mark_as_orphan("test/unknown-repo")`;

      const action = parseActionFromResponse(response);

      expect(action).not.toBeNull();
      expect(action?.action).toBe('mark_as_orphan');
      expect(action?.repo_full_name).toBe('test/unknown-repo');
    });

    test('should parse set_domain action', () => {
      const response = `This is infrastructure code.

      Action: set_domain("vuplicity/ci-cd", "infrastructure")`;

      const action = parseActionFromResponse(response);

      expect(action).not.toBeNull();
      expect(action?.action).toBe('set_domain');
      expect(action?.repo_full_name).toBe('vuplicity/ci-cd');
      expect(action?.params?.domain).toBe('infrastructure');
    });

    test('should return null for response without action', () => {
      const response = `This repo looks interesting but I need more information.`;

      const action = parseActionFromResponse(response);

      expect(action).toBeNull();
    });
  });
});

describe('PM Actions - Batch Execution', () => {
  test('should execute multiple actions in sequence', async () => {
    const actions: PMAction[] = [
      {
        action: 'assign_business_unit',
        repo_full_name: 'test/repo1',
        params: { business_unit: 'vuplicity' },
      },
      {
        action: 'set_domain',
        repo_full_name: 'test/repo1',
        params: { domain: 'product-core' },
      },
    ];

    const results = await executePMActionBatch(actions);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });
});

describe('PM Actions - Escalation Handling', () => {
  test('should not execute actions with propose escalation level', async () => {
    const action: PMAction = {
      action: 'assign_business_unit',
      repo_full_name: 'test/repo',
      params: { business_unit: 'vuplicity' },
      escalation_level: 'propose',
    };

    const result = await executePMAction(action);

    expect(result.success).toBe(false);
    expect(result.requires_approval).toBe(true);
  });

  test('should not execute actions with critical escalation level', async () => {
    const action: PMAction = {
      action: 'assign_business_unit',
      repo_full_name: 'test/repo',
      params: { business_unit: 'vuplicity' },
      escalation_level: 'critical',
    };

    const result = await executePMAction(action);

    expect(result.success).toBe(false);
    expect(result.requires_approval).toBe(true);
  });

  test('should execute actions with auto escalation level', async () => {
    const action: PMAction = {
      action: 'assign_business_unit',
      repo_full_name: 'test/repo',
      params: { business_unit: 'vuplicity' },
      escalation_level: 'auto',
    };

    const result = await executePMAction(action);

    expect(result.success).toBe(true);
  });
});
