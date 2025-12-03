/**
 * PM Agent Autonomous Operation Integration Tests
 *
 * These tests verify that the PM system can operate independently:
 * 1. Classification patterns produce correct assignments
 * 2. Decisions persist to memory (Zep)
 * 3. Agent can recall past decisions
 * 4. System correctly prevents drift
 */

import * as fs from 'fs';
import * as path from 'path';

// Mock the external dependencies
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
    const validOrgs = ['utlyze', 'vuplicity', 'newreward', 'hdws', 'rd', 'kahoa', 'solutionstream', 'cryptojym'];
    if (validOrgs.includes(name)) {
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

// Track memory calls for verification
const memoryRecords: Array<{ text: string; category: string; metadata: any }> = [];

jest.mock('@/lib/pm/pm-memory', () => ({
  recordRepoAssignment: jest.fn((assignment) => {
    memoryRecords.push({
      text: `Assignment: ${assignment.repoFullName} -> ${assignment.projectName}`,
      category: 'assignment',
      metadata: assignment,
    });
    return Promise.resolve();
  }),
  addPMMemory: jest.fn((text, category, metadata) => {
    memoryRecords.push({ text, category, metadata });
    return Promise.resolve();
  }),
  learnFromCorrection: jest.fn(() => Promise.resolve()),
  searchPMMemory: jest.fn((query) => {
    // Return relevant memories based on query
    return Promise.resolve(
      memoryRecords
        .filter(m => m.text.toLowerCase().includes(query.toLowerCase()))
        .map(m => ({
          memory: { text: m.text, metadata: m.metadata },
          score: 0.8,
        }))
    );
  }),
  suggestProjectForRepo: jest.fn(async (repoName) => {
    // Look for previous assignments
    const relevant = memoryRecords.filter(m =>
      m.category === 'assignment' &&
      m.text.toLowerCase().includes(repoName.toLowerCase().split('-')[0])
    );

    if (relevant.length > 0) {
      return {
        suggestions: [{
          project: relevant[0].metadata.projectName,
          confidence: 0.9,
          rationale: 'Similar repo previously assigned',
        }],
        memories: relevant.map(r => ({ memory: { text: r.text, metadata: r.metadata }, score: 0.9 })),
      };
    }

    return { suggestions: [], memories: [] };
  }),
}));

// Import after mocks
import {
  executePMAction,
  executePMActionBatch,
  type PMAction,
} from '@/lib/pm/pm-actions';
import { suggestProjectForRepo, searchPMMemory } from '@/lib/pm/pm-memory';

const TAXONOMY_PATH = path.join(process.cwd(), 'config', 'project-taxonomy.json');

describe('PM Autonomous Operation - Classification', () => {
  let taxonomy: any;

  beforeAll(() => {
    const content = fs.readFileSync(TAXONOMY_PATH, 'utf-8');
    taxonomy = JSON.parse(content);
  });

  beforeEach(() => {
    memoryRecords.length = 0; // Clear memory between tests
  });

  describe('Pattern-based Classification', () => {
    test('should classify EEG repos to R&D division', async () => {
      const action: PMAction = {
        action: 'assign_business_unit',
        repo_full_name: 'CryptoJym/eeg-meditation-analysis',
        params: { business_unit: 'rd' },
        rationale: 'Matched EEG pattern for R&D',
      };

      const result = await executePMAction(action);

      expect(result.success).toBe(true);
      expect(result.changes?.target).toBe('rd');
    });

    test('should classify FCRA repos to Vuplicity', async () => {
      const action: PMAction = {
        action: 'assign_business_unit',
        repo_full_name: 'vuplicity/fcra-compliance-checker',
        params: { business_unit: 'vuplicity' },
        rationale: 'Matched FCRA pattern for Vuplicity',
      };

      const result = await executePMAction(action);

      expect(result.success).toBe(true);
      expect(result.changes?.target).toBe('vuplicity');
    });

    test('should reject invalid business unit assignments', async () => {
      const action: PMAction = {
        action: 'assign_business_unit',
        repo_full_name: 'test/repo',
        params: { business_unit: 'eeg_symbiosis' }, // INVALID - should be 'rd'
      };

      const result = await executePMAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_TARGET');
    });

    test('taxonomy patterns should match expected repos', () => {
      const patterns = taxonomy.classification_patterns;

      // EEG should match rd patterns
      expect(patterns.rd).toContain('eeg');
      expect(patterns.rd).toContain('consciousness');

      // FCRA should match vuplicity patterns
      expect(patterns.vuplicity).toContain('fcra');
      expect(patterns.vuplicity).toContain('screening');

      // Lead-gen should match newreward patterns
      expect(patterns.newreward).toContain('lead-gen');
    });
  });

  describe('Domain Classification', () => {
    test('should accept valid domains', async () => {
      const validDomains = [
        'product-core',
        'research-experiments',
        'internal-tools',
        'client-delivery',
      ];

      for (const domain of validDomains) {
        const result = await executePMAction({
          action: 'set_domain',
          repo_full_name: `test/${domain}-repo`,
          params: { domain },
        });

        expect(result.success).toBe(true);
        expect(result.changes?.domain).toBe(domain);
      }
    });

    test('should reject invalid domains', async () => {
      const result = await executePMAction({
        action: 'set_domain',
        repo_full_name: 'test/repo',
        params: { domain: 'invalid-domain' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_DOMAIN');
    });
  });

  describe('Orphan Handling', () => {
    test('should place orphans in R&D division', async () => {
      const { getOrgByName } = require('@/lib/pm/github-org-config');

      const result = await executePMAction({
        action: 'mark_as_orphan',
        repo_full_name: 'unknown/mystery-repo',
        rationale: 'No clear business unit match',
      });

      expect(result.success).toBe(true);
      expect(getOrgByName).toHaveBeenCalledWith('rd');
      expect(result.changes?.domain).toBe('research-experiments');
    });
  });
});

describe('PM Autonomous Operation - Memory Persistence', () => {
  beforeEach(() => {
    memoryRecords.length = 0;
  });

  test('should persist business unit assignments to memory', async () => {
    await executePMAction({
      action: 'assign_business_unit',
      repo_full_name: 'CryptoJym/test-repo',
      params: { business_unit: 'utlyze' },
      rationale: 'Test assignment',
    });

    // Verify memory was recorded
    expect(memoryRecords.length).toBeGreaterThan(0);
    const assignment = memoryRecords.find(m => m.category === 'assignment');
    expect(assignment).toBeDefined();
    expect(assignment?.metadata.projectName).toBe('utlyze');
  });

  test('should persist domain classifications to memory', async () => {
    await executePMAction({
      action: 'set_domain',
      repo_full_name: 'test/domain-test',
      params: { domain: 'product-core' },
      rationale: 'Core product',
    });

    const domainRecord = memoryRecords.find(m => m.category === 'pattern');
    expect(domainRecord).toBeDefined();
    expect(domainRecord?.metadata.domain).toBe('product-core');
  });

  test('should persist orphan decisions to memory', async () => {
    await executePMAction({
      action: 'mark_as_orphan',
      repo_full_name: 'unknown/orphan-repo',
    });

    const orphanRecord = memoryRecords.find(m => m.category === 'decision');
    expect(orphanRecord).toBeDefined();
    expect(orphanRecord?.metadata.placement).toBe('rd');
  });
});

describe('PM Autonomous Operation - Memory Recall', () => {
  beforeEach(() => {
    memoryRecords.length = 0;
  });

  test('should recall past assignments for similar repos', async () => {
    // First, create an assignment
    await executePMAction({
      action: 'assign_business_unit',
      repo_full_name: 'CryptoJym/vuplicity-api',
      params: { business_unit: 'vuplicity' },
      rationale: 'Vuplicity product repo',
    });

    // Now ask for suggestions for a similar repo
    const suggestions = await suggestProjectForRepo('vuplicity-web');

    expect(suggestions.suggestions.length).toBeGreaterThan(0);
    expect(suggestions.suggestions[0].project).toBe('vuplicity');
  });

  test('should search memory for past decisions', async () => {
    // Create some assignments
    await executePMAction({
      action: 'assign_business_unit',
      repo_full_name: 'test/eeg-experiment',
      params: { business_unit: 'rd' },
      rationale: 'EEG research',
    });

    const results = await searchPMMemory('eeg');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].memory.text.toLowerCase()).toContain('eeg');
  });
});

describe('PM Autonomous Operation - Batch Processing', () => {
  beforeEach(() => {
    memoryRecords.length = 0;
  });

  test('should process multiple classifications in batch', async () => {
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
      {
        action: 'assign_business_unit',
        repo_full_name: 'test/repo2',
        params: { business_unit: 'rd' },
      },
      {
        action: 'set_domain',
        repo_full_name: 'test/repo2',
        params: { domain: 'research-experiments' },
      },
    ];

    const results = await executePMActionBatch(actions);

    expect(results.length).toBe(4);
    expect(results.filter(r => r.success).length).toBe(4);

    // Should have persisted to memory
    expect(memoryRecords.length).toBeGreaterThan(0);
  });

  test('should stop batch on critical failure', async () => {
    const actions: PMAction[] = [
      {
        action: 'assign_business_unit',
        repo_full_name: 'test/repo1',
        params: { business_unit: 'vuplicity' },
        escalation_level: 'auto',
      },
      {
        action: 'assign_business_unit',
        repo_full_name: 'test/repo2',
        params: { business_unit: 'invalid_unit' }, // This will fail
        escalation_level: 'critical',
      },
      {
        action: 'assign_business_unit',
        repo_full_name: 'test/repo3',
        params: { business_unit: 'utlyze' },
      },
    ];

    const results = await executePMActionBatch(actions);

    // Should stop after critical failure
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });
});

describe('PM Autonomous Operation - Drift Prevention', () => {
  let taxonomy: any;

  beforeAll(() => {
    const content = fs.readFileSync(TAXONOMY_PATH, 'utf-8');
    taxonomy = JSON.parse(content);
  });

  test('eeg_symbiosis should NOT be a valid target', async () => {
    const result = await executePMAction({
      action: 'assign_business_unit',
      repo_full_name: 'test/repo',
      params: { business_unit: 'eeg_symbiosis' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_TARGET');
  });

  test('taxonomy should define rd as orphan holding pen', () => {
    expect(taxonomy.organization.rd_division.orphan_holding_pen).toBe(true);
    expect(taxonomy.hierarchy_types.orphan.default_placement).toBe('rd');
  });

  test('only 3 business units should exist', () => {
    const units = taxonomy.organization.business_units;
    expect(units.length).toBe(3);

    const unitIds = units.map((u: any) => u.id);
    expect(unitIds).toContain('vuplicity');
    expect(unitIds).toContain('newreward');
    expect(unitIds).toContain('hdws');

    // These should NOT be business units
    expect(unitIds).not.toContain('rd');
    expect(unitIds).not.toContain('cryptojym');
    expect(unitIds).not.toContain('eeg_symbiosis');
  });
});
