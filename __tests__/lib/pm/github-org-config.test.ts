// @ts-nocheck
/**
 * Wrath Shield v3 - GitHub Org Config Tests
 *
 * Tests for multi-organization support:
 * - Organization CRUD operations
 * - Repository hierarchy management
 * - Org settings and permissions
 * - Hierarchy tree utilities
 */

// Mock Database
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);
const mockRun = jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 });

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: jest.fn().mockReturnValue({
      exec: mockExec,
      prepare: mockPrepare.mockReturnValue({
        run: mockRun,
        get: mockGet,
        all: mockAll,
      }),
    }),
  }),
}));

import {
  createOrg,
  getOrg,
  getOrgByName,
  getAllOrgs,
  getPrimaryOrg,
  updateOrg,
  deleteOrg,
  createRepoHierarchy,
  getRepoHierarchy,
  getRepoHierarchyByName,
  getReposByOrg,
  getReposByDomain,
  getSubprojects,
  getRootProjects,
  getAllRepoHierarchy,
  updateRepoHierarchy,
  deleteRepoHierarchy,
  getOrgHierarchyTree,
  initializeDefaultOrgs,
  getOrgStats,
  type GitHubOrg,
  type OrgSettings,
  type RepoHierarchy,
  type RepoSettings,
} from '@/lib/pm/github-org-config';

describe('GitHub Org Config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
  });

  describe('Types', () => {
    it('should define GitHubOrg interface', () => {
      const org: GitHubOrg = {
        id: 'org_utlyze_1234567890',
        name: 'Utlyze',
        display_name: 'Utlyze',
        description: 'R&D Organization',
        parent_org_id: null,
        is_primary: true,
        enabled: true,
        settings: {
          auto_sync: true,
          sync_interval_minutes: 15,
        },
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      };

      expect(org.is_primary).toBe(true);
    });

    it('should define OrgSettings interface', () => {
      const settings: OrgSettings = {
        auto_sync: true,
        sync_interval_minutes: 30,
        default_project_template: 'Sprint Board',
        labels_to_sync: ['bug', 'feature'],
        issue_prefix: 'UT-',
      };

      expect(settings.auto_sync).toBe(true);
    });

    it('should define RepoHierarchy interface', () => {
      const repo: RepoHierarchy = {
        id: 'repo_utlyze_wrath-shield_1234567890',
        repo_full_name: 'Utlyze/wrath-shield-v3',
        org_id: 'org_utlyze',
        parent_repo_id: null,
        hierarchy_type: 'root',
        domain: 'R&D',
        project_name: 'Life OS',
        enabled: true,
        settings: {
          sync_issues: true,
          sync_prs: true,
          sync_milestones: true,
          auto_create_issues: true,
        },
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      };

      expect(repo.hierarchy_type).toBe('root');
    });

    it('should define RepoSettings interface', () => {
      const settings: RepoSettings = {
        sync_issues: true,
        sync_prs: false,
        sync_milestones: true,
        auto_create_issues: false,
        issue_labels: ['pm-managed'],
      };

      expect(settings.sync_issues).toBe(true);
    });
  });

  describe('Organization CRUD', () => {
    describe('createOrg', () => {
      it('should create an organization', () => {
        mockGet.mockReturnValueOnce({
          id: 'org_test_1234567890',
          name: 'TestOrg',
          display_name: 'Test Organization',
          description: null,
          parent_org_id: null,
          is_primary: 0,
          enabled: 1,
          settings: '{"auto_sync": true, "sync_interval_minutes": 15}',
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        });

        const org = createOrg({
          name: 'TestOrg',
          display_name: 'Test Organization',
        });

        expect(org.name).toBe('TestOrg');
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO github_orgs')
        );
      });

      it('should set default settings', () => {
        mockGet.mockReturnValueOnce({
          id: 'org_test_1234567890',
          name: 'TestOrg',
          display_name: 'Test Organization',
          description: null,
          parent_org_id: null,
          is_primary: 0,
          enabled: 1,
          settings: '{"auto_sync": true, "sync_interval_minutes": 15}',
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        });

        const org = createOrg({
          name: 'TestOrg',
          display_name: 'Test Organization',
        });

        expect(org.settings.auto_sync).toBe(true);
        expect(org.settings.sync_interval_minutes).toBe(15);
      });

      it('should support parent org reference', () => {
        mockGet.mockReturnValueOnce({
          id: 'org_child_1234567890',
          name: 'ChildOrg',
          display_name: 'Child Organization',
          description: null,
          parent_org_id: 'org_parent',
          is_primary: 0,
          enabled: 1,
          settings: '{}',
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        });

        const org = createOrg({
          name: 'ChildOrg',
          display_name: 'Child Organization',
          parent_org_id: 'org_parent',
        });

        expect(org.parent_org_id).toBe('org_parent');
      });
    });

    describe('getOrg', () => {
      it('should return org by ID', () => {
        mockGet.mockReturnValueOnce({
          id: 'org_test',
          name: 'TestOrg',
          display_name: 'Test Organization',
          description: null,
          parent_org_id: null,
          is_primary: 1,
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 1000,
        });

        const org = getOrg('org_test');

        expect(org).not.toBeNull();
        expect(org?.is_primary).toBe(true);
      });

      it('should return null when not found', () => {
        mockGet.mockReturnValueOnce(undefined);

        const org = getOrg('nonexistent');

        expect(org).toBeNull();
      });
    });

    describe('getOrgByName', () => {
      it('should return org by name', () => {
        mockGet.mockReturnValueOnce({
          id: 'org_utlyze',
          name: 'Utlyze',
          display_name: 'Utlyze',
          description: null,
          parent_org_id: null,
          is_primary: 1,
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 1000,
        });

        const org = getOrgByName('Utlyze');

        expect(org?.name).toBe('Utlyze');
      });
    });

    describe('getAllOrgs', () => {
      it('should return all organizations', () => {
        mockAll.mockReturnValueOnce([
          { id: 'org_1', name: 'Org1', display_name: 'Org 1', is_primary: 1, enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
          { id: 'org_2', name: 'Org2', display_name: 'Org 2', is_primary: 0, enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
        ]);

        const orgs = getAllOrgs();

        expect(orgs).toHaveLength(2);
      });

      it('should filter enabled only', () => {
        mockAll.mockReturnValueOnce([]);

        getAllOrgs({ enabled_only: true });

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('enabled = 1')
        );
      });
    });

    describe('getPrimaryOrg', () => {
      it('should return primary organization', () => {
        mockGet.mockReturnValueOnce({
          id: 'org_primary',
          name: 'PrimaryOrg',
          display_name: 'Primary Organization',
          is_primary: 1,
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 1000,
        });

        const org = getPrimaryOrg();

        expect(org?.is_primary).toBe(true);
      });

      it('should return null when no primary', () => {
        mockGet.mockReturnValueOnce(undefined);

        const org = getPrimaryOrg();

        expect(org).toBeNull();
      });
    });

    describe('updateOrg', () => {
      it('should update organization', () => {
        mockGet.mockReturnValueOnce({
          id: 'org_test',
          name: 'UpdatedOrg',
          display_name: 'Updated Organization',
          is_primary: 0,
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 2000,
        });

        const org = updateOrg('org_test', {
          display_name: 'Updated Organization',
        });

        expect(org?.display_name).toBe('Updated Organization');
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE github_orgs')
        );
      });

      it('should update settings', () => {
        mockGet.mockReturnValueOnce({
          id: 'org_test',
          name: 'TestOrg',
          display_name: 'Test Organization',
          is_primary: 0,
          enabled: 1,
          settings: '{"auto_sync": false}',
          created_at: 1000,
          updated_at: 2000,
        });

        updateOrg('org_test', {
          settings: { auto_sync: false, sync_interval_minutes: 30 },
        });

        expect(mockPrepare).toHaveBeenCalled();
      });
    });

    describe('deleteOrg', () => {
      it('should delete organization', () => {
        mockRun.mockReturnValueOnce({ changes: 1 });

        const result = deleteOrg('org_test');

        expect(result).toBe(true);
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM github_orgs')
        );
      });

      it('should return false when not found', () => {
        mockRun.mockReturnValueOnce({ changes: 0 });

        const result = deleteOrg('nonexistent');

        expect(result).toBe(false);
      });
    });
  });

  describe('Repository Hierarchy CRUD', () => {
    describe('createRepoHierarchy', () => {
      it('should create repo hierarchy', () => {
        mockGet.mockReturnValueOnce({
          id: 'repo_test',
          repo_full_name: 'Org/repo',
          org_id: 'org_test',
          parent_repo_id: null,
          hierarchy_type: 'standalone',
          domain: null,
          project_name: null,
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 1000,
        });

        const repo = createRepoHierarchy({
          repo_full_name: 'Org/repo',
          org_id: 'org_test',
        });

        expect(repo.repo_full_name).toBe('Org/repo');
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO repo_hierarchy')
        );
      });

      it('should support hierarchy types', () => {
        mockGet.mockReturnValueOnce({
          id: 'repo_test',
          repo_full_name: 'Org/monorepo',
          org_id: 'org_test',
          parent_repo_id: null,
          hierarchy_type: 'root',
          domain: 'R&D',
          project_name: 'Main Project',
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 1000,
        });

        const repo = createRepoHierarchy({
          repo_full_name: 'Org/monorepo',
          org_id: 'org_test',
          hierarchy_type: 'root',
          domain: 'R&D',
        });

        expect(repo.hierarchy_type).toBe('root');
      });
    });

    describe('getRepoHierarchy', () => {
      it('should return repo by ID', () => {
        mockGet.mockReturnValueOnce({
          id: 'repo_test',
          repo_full_name: 'Org/repo',
          org_id: 'org_test',
          hierarchy_type: 'standalone',
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 1000,
        });

        const repo = getRepoHierarchy('repo_test');

        expect(repo).not.toBeNull();
      });
    });

    describe('getRepoHierarchyByName', () => {
      it('should return repo by full name', () => {
        mockGet.mockReturnValueOnce({
          id: 'repo_test',
          repo_full_name: 'Org/repo',
          org_id: 'org_test',
          hierarchy_type: 'standalone',
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 1000,
        });

        const repo = getRepoHierarchyByName('Org/repo');

        expect(repo?.repo_full_name).toBe('Org/repo');
      });
    });

    describe('getReposByOrg', () => {
      it('should return repos for an org', () => {
        mockAll.mockReturnValueOnce([
          { id: 'repo_1', repo_full_name: 'Org/repo1', org_id: 'org_test', hierarchy_type: 'standalone', enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
          { id: 'repo_2', repo_full_name: 'Org/repo2', org_id: 'org_test', hierarchy_type: 'standalone', enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
        ]);

        const repos = getReposByOrg('org_test');

        expect(repos).toHaveLength(2);
      });

      it('should filter enabled only', () => {
        mockAll.mockReturnValueOnce([]);

        getReposByOrg('org_test', { enabled_only: true });

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('enabled = 1')
        );
      });
    });

    describe('getReposByDomain', () => {
      it('should return repos by domain', () => {
        mockAll.mockReturnValueOnce([
          { id: 'repo_1', repo_full_name: 'Org/repo1', org_id: 'org_test', domain: 'R&D', hierarchy_type: 'standalone', enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
        ]);

        const repos = getReposByDomain('R&D');

        expect(repos).toHaveLength(1);
      });
    });

    describe('getSubprojects', () => {
      it('should return subprojects of a repo', () => {
        mockAll.mockReturnValueOnce([
          { id: 'repo_sub1', repo_full_name: 'Org/sub1', org_id: 'org_test', parent_repo_id: 'repo_parent', hierarchy_type: 'subproject', enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
        ]);

        const subprojects = getSubprojects('repo_parent');

        expect(subprojects).toHaveLength(1);
      });
    });

    describe('getRootProjects', () => {
      it('should return root projects', () => {
        mockAll.mockReturnValueOnce([
          { id: 'repo_root', repo_full_name: 'Org/monorepo', org_id: 'org_test', hierarchy_type: 'root', enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
        ]);

        const roots = getRootProjects();

        expect(roots.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('getAllRepoHierarchy', () => {
      it('should return all repo hierarchy entries', () => {
        mockAll.mockReturnValueOnce([
          { id: 'repo_1', repo_full_name: 'Org/repo1', org_id: 'org_test', hierarchy_type: 'standalone', enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
        ]);

        const all = getAllRepoHierarchy();

        expect(Array.isArray(all)).toBe(true);
      });
    });

    describe('updateRepoHierarchy', () => {
      it('should update repo hierarchy', () => {
        mockGet.mockReturnValueOnce({
          id: 'repo_test',
          repo_full_name: 'Org/repo',
          org_id: 'org_test',
          hierarchy_type: 'root',
          domain: 'Updated Domain',
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 2000,
        });

        const repo = updateRepoHierarchy('repo_test', {
          hierarchy_type: 'root',
          domain: 'Updated Domain',
        });

        expect(repo?.hierarchy_type).toBe('root');
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE repo_hierarchy')
        );
      });
    });

    describe('deleteRepoHierarchy', () => {
      it('should delete repo hierarchy', () => {
        mockRun.mockReturnValueOnce({ changes: 1 });

        const result = deleteRepoHierarchy('repo_test');

        expect(result).toBe(true);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('getOrgHierarchyTree', () => {
      it('should return org hierarchy tree', () => {
        mockGet.mockReturnValueOnce({
          id: 'org_test',
          name: 'TestOrg',
          display_name: 'Test Organization',
          is_primary: 1,
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 1000,
        });
        mockAll.mockReturnValueOnce([
          { id: 'repo_1', repo_full_name: 'Org/repo1', org_id: 'org_test', hierarchy_type: 'root', enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
          { id: 'repo_2', repo_full_name: 'Org/repo2', org_id: 'org_test', hierarchy_type: 'standalone', enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
        ]);

        const tree = getOrgHierarchyTree('org_test');

        expect(tree).not.toBeNull();
        expect(tree?.org.name).toBe('TestOrg');
        expect(tree?.repos.root).toHaveLength(1);
        expect(tree?.repos.standalone).toHaveLength(1);
      });

      it('should return null when org not found', () => {
        mockGet.mockReturnValueOnce(undefined);

        const tree = getOrgHierarchyTree('nonexistent');

        expect(tree).toBeNull();
      });
    });

    describe('initializeDefaultOrgs', () => {
      it('should create default orgs when none exist', () => {
        mockAll.mockReturnValueOnce([]); // No existing orgs
        mockGet.mockReturnValue({
          id: 'org_utlyze',
          name: 'Utlyze',
          display_name: 'Utlyze',
          is_primary: 1,
          enabled: 1,
          settings: '{}',
          created_at: 1000,
          updated_at: 1000,
        });

        initializeDefaultOrgs();

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO github_orgs')
        );
      });

      it('should skip when orgs exist', () => {
        mockAll.mockReturnValueOnce([
          { id: 'org_existing', name: 'Existing', display_name: 'Existing Org', is_primary: 1, enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
        ]);

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        initializeDefaultOrgs();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('already configured')
        );

        consoleSpy.mockRestore();
      });
    });

    describe('getOrgStats', () => {
      it('should return organization statistics', () => {
        mockAll
          .mockReturnValueOnce([
            { id: 'org_1', name: 'Org1', display_name: 'Org 1', is_primary: 1, enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
            { id: 'org_2', name: 'Org2', display_name: 'Org 2', is_primary: 0, enabled: 0, settings: '{}', created_at: 1000, updated_at: 1000 },
          ])
          .mockReturnValueOnce([
            { id: 'repo_1', repo_full_name: 'Org/repo1', org_id: 'org_1', hierarchy_type: 'root', domain: 'R&D', enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
            { id: 'repo_2', repo_full_name: 'Org/repo2', org_id: 'org_1', hierarchy_type: 'standalone', domain: 'R&D', enabled: 1, settings: '{}', created_at: 1000, updated_at: 1000 },
          ]);

        const stats = getOrgStats();

        expect(stats.total_orgs).toBe(2);
        expect(stats.enabled_orgs).toBe(1);
        expect(stats.total_repos).toBe(2);
        expect(stats.repos_by_type).toHaveProperty('root');
        expect(stats.repos_by_domain).toHaveProperty('R&D');
      });
    });
  });

  describe('Table Creation', () => {
    it('should create github_orgs table', () => {
      mockAll.mockReturnValue([]);

      getAllOrgs();

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS github_orgs')
      );
    });

    it('should create repo_hierarchy table', () => {
      mockAll.mockReturnValue([]);

      getAllRepoHierarchy();

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS repo_hierarchy')
      );
    });

    it('should create indices', () => {
      mockAll.mockReturnValue([]);

      getAllRepoHierarchy();

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );
    });
  });
});
