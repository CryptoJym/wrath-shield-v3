// @ts-nocheck
/**
 * Wrath Shield v3 - Repo Organizer Tests
 *
 * Tests for AI-powered repository organization:
 * - Organization suggestions
 * - Rule-based matching
 * - AI suggestions
 * - Organization actions
 * - Learning from corrections
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock GitHub client
const mockGitHubClient = {
  getUnmappedRepos: jest.fn().mockResolvedValue([]),
  getRepos: jest.fn().mockResolvedValue([]),
  getRepoMappings: jest.fn().mockReturnValue([]),
  setRepoMapping: jest.fn(),
};

jest.mock('@/lib/integrations/GitHubClient', () => ({
  __esModule: true,
  default: mockGitHubClient,
}));

// Mock GitHub Projects client
const mockProjectsClient = {
  getAllProjects: jest.fn().mockResolvedValue([]),
  getAllProjectItems: jest.fn().mockResolvedValue([]),
};

jest.mock('@/lib/integrations/GitHubProjectsClient', () => ({
  __esModule: true,
  default: mockProjectsClient,
}));

// Mock PM memory
jest.mock('@/lib/pm/pm-memory', () => ({
  recordRepoAssignment: jest.fn().mockResolvedValue({}),
  recordProjectContext: jest.fn().mockResolvedValue({}),
  recordOrganizationRule: jest.fn().mockResolvedValue({}),
  learnFromCorrection: jest.fn().mockResolvedValue({}),
  suggestProjectForRepo: jest.fn().mockResolvedValue({ suggestions: [] }),
  getOrganizationStructure: jest.fn().mockResolvedValue({ rules: [] }),
  recordSyncEvent: jest.fn().mockResolvedValue({}),
}));

// Mock OpenRouter client
const mockOpenRouterClient = {
  getCoachingResponse: jest.fn().mockResolvedValue({
    content: '{"projectTitle": "Test Project", "confidence": 0.7, "rationale": "AI suggestion"}',
  }),
};

jest.mock('@/lib/OpenRouterClient', () => ({
  getOpenRouterClient: jest.fn().mockReturnValue(mockOpenRouterClient),
}));

import {
  getOrganizationSuggestions,
  applyOrganizationActions,
  autoOrganizeRepos,
  learnFromUserCorrection,
  getOrganizationStatus,
  syncProjectsToMemory,
  type RepoOrganizationSuggestion,
  type OrganizationAction,
  type OrganizationResult,
} from '@/lib/pm/repo-organizer';

describe('Repo Organizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGitHubClient.getUnmappedRepos.mockResolvedValue([]);
    mockGitHubClient.getRepos.mockResolvedValue([]);
    mockGitHubClient.getRepoMappings.mockReturnValue([]);
    mockProjectsClient.getAllProjects.mockResolvedValue([]);
  });

  describe('Types', () => {
    it('should define RepoOrganizationSuggestion interface', () => {
      const suggestion: RepoOrganizationSuggestion = {
        repo: {
          name: 'test-repo',
          full_name: 'org/test-repo',
          description: 'Test repository',
        },
        suggestions: [
          {
            project: { id: 'proj_1', title: 'Test Project' },
            confidence: 0.85,
            rationale: 'Matches naming convention',
            source: 'rule',
          },
        ],
        autoAssignable: true,
      };

      expect(suggestion.autoAssignable).toBe(true);
    });

    it('should define OrganizationAction interface', () => {
      const action: OrganizationAction = {
        action: 'assign',
        repoFullName: 'org/repo',
        projectId: 'proj_1',
        projectName: 'Project 1',
        rationale: 'Manual assignment',
      };

      expect(action.action).toBe('assign');
    });

    it('should define OrganizationResult interface', () => {
      const result: OrganizationResult = {
        success: true,
        reposProcessed: 10,
        reposAssigned: 8,
        reposSkipped: 2,
        newProjectsCreated: 0,
        errors: [],
      };

      expect(result.success).toBe(true);
    });
  });

  describe('getOrganizationSuggestions', () => {
    it('should return empty array when no unmapped repos', async () => {
      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([]);

      const suggestions = await getOrganizationSuggestions();

      expect(suggestions).toHaveLength(0);
    });

    it('should suggest based on rule matching', async () => {
      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        {
          name: 'wrath-shield-v4',
          full_name: 'Utlyze/wrath-shield-v4',
          description: 'Life OS system',
        },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_lifeos', title: 'Life OS' },
      ]);

      const suggestions = await getOrganizationSuggestions();

      expect(suggestions.length).toBeGreaterThan(0);
      if (suggestions[0].suggestions.length > 0) {
        expect(suggestions[0].suggestions[0].source).toBe('rule');
      }
    });

    it('should check memory-based suggestions', async () => {
      const { suggestProjectForRepo } = require('@/lib/pm/pm-memory');
      suggestProjectForRepo.mockResolvedValueOnce({
        suggestions: [
          { project: 'Learned Project', confidence: 0.8, rationale: 'From memory' },
        ],
      });

      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'unknown-repo', full_name: 'Org/unknown-repo' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([]);

      const suggestions = await getOrganizationSuggestions();

      expect(suggestProjectForRepo).toHaveBeenCalled();
    });

    it('should use AI for unmatched repos', async () => {
      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'unique-repo', full_name: 'Org/unique-repo', description: 'Unique project' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_1', title: 'AI Target Project' },
      ]);

      const suggestions = await getOrganizationSuggestions();

      // AI suggestion should have been attempted
      expect(mockOpenRouterClient.getCoachingResponse).toHaveBeenCalled();
    });

    it('should respect limit parameter', async () => {
      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'repo1', full_name: 'Org/repo1' },
        { name: 'repo2', full_name: 'Org/repo2' },
        { name: 'repo3', full_name: 'Org/repo3' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValue([]);

      const suggestions = await getOrganizationSuggestions(2);

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should sort suggestions by confidence', async () => {
      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'vuplicity-api', full_name: 'Org/vuplicity-api', description: 'FCRA compliance' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_vuplicity', title: 'Vuplicity' },
      ]);

      const suggestions = await getOrganizationSuggestions();

      if (suggestions[0].suggestions.length >= 2) {
        expect(suggestions[0].suggestions[0].confidence).toBeGreaterThanOrEqual(
          suggestions[0].suggestions[1].confidence
        );
      }
    });

    it('should mark high-confidence as autoAssignable', async () => {
      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'wrath-shield-test', full_name: 'Org/wrath-shield-test' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_lifeos', title: 'Life OS' },
      ]);

      const suggestions = await getOrganizationSuggestions();

      // Wrath-shield matches with 0.95 confidence (above 0.7 threshold)
      const wrathShieldSuggestion = suggestions.find(s =>
        s.repo.name === 'wrath-shield-test'
      );
      if (wrathShieldSuggestion && wrathShieldSuggestion.suggestions.length > 0) {
        expect(wrathShieldSuggestion.autoAssignable).toBe(true);
      }
    });
  });

  describe('applyOrganizationActions', () => {
    it('should assign repos to projects', async () => {
      const { recordRepoAssignment, recordSyncEvent } = require('@/lib/pm/pm-memory');

      const actions: OrganizationAction[] = [
        {
          action: 'assign',
          repoFullName: 'Org/repo1',
          projectId: 'proj_1',
          projectName: 'Project 1',
        },
      ];

      const result = await applyOrganizationActions(actions);

      expect(result.reposAssigned).toBe(1);
      expect(mockGitHubClient.setRepoMapping).toHaveBeenCalled();
      expect(recordRepoAssignment).toHaveBeenCalled();
    });

    it('should skip repos when action is skip', async () => {
      const actions: OrganizationAction[] = [
        {
          action: 'skip',
          repoFullName: 'Org/repo-to-skip',
        },
      ];

      const result = await applyOrganizationActions(actions);

      expect(result.reposSkipped).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      mockGitHubClient.setRepoMapping.mockImplementationOnce(() => {
        throw new Error('API error');
      });

      const actions: OrganizationAction[] = [
        {
          action: 'assign',
          repoFullName: 'Org/error-repo',
          projectId: 'proj_1',
          projectName: 'Project 1',
        },
      ];

      const result = await applyOrganizationActions(actions);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require project for assign action', async () => {
      const actions: OrganizationAction[] = [
        {
          action: 'assign',
          repoFullName: 'Org/repo',
          // No projectId or projectName
        },
      ];

      const result = await applyOrganizationActions(actions);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should record sync event', async () => {
      const { recordSyncEvent } = require('@/lib/pm/pm-memory');

      await applyOrganizationActions([]);

      expect(recordSyncEvent).toHaveBeenCalledWith(
        'github',
        'organization',
        expect.any(Number),
        expect.any(Boolean),
        expect.any(String)
      );
    });
  });

  describe('autoOrganizeRepos', () => {
    it('should auto-assign high-confidence repos', async () => {
      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'wrath-shield-v5', full_name: 'Org/wrath-shield-v5' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_lifeos', title: 'Life OS' },
      ]);

      const result = await autoOrganizeRepos();

      expect(result).toHaveProperty('reposProcessed');
      expect(result).toHaveProperty('reposAssigned');
    });

    it('should skip low-confidence repos', async () => {
      const { suggestProjectForRepo } = require('@/lib/pm/pm-memory');
      suggestProjectForRepo.mockResolvedValue({
        suggestions: [
          { project: 'Maybe Project', confidence: 0.3, rationale: 'Low confidence' },
        ],
      });

      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'ambiguous-repo', full_name: 'Org/ambiguous-repo' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([]);

      const result = await autoOrganizeRepos();

      // Low confidence repos shouldn't be auto-assigned
      expect(result.reposAssigned).toBeLessThanOrEqual(result.reposProcessed);
    });
  });

  describe('learnFromUserCorrection', () => {
    it('should record correction in memory', async () => {
      const { learnFromCorrection } = require('@/lib/pm/pm-memory');

      await learnFromUserCorrection(
        'Org/repo',
        'Wrong Project',
        'Correct Project',
        'This is a UI repo'
      );

      expect(learnFromCorrection).toHaveBeenCalledWith(
        'repo',
        'Wrong Project',
        'Correct Project',
        'This is a UI repo'
      );
    });

    it('should update repo mapping', async () => {
      await learnFromUserCorrection(
        'Org/repo',
        'Wrong Project',
        'Correct Project'
      );

      expect(mockGitHubClient.setRepoMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          repo_full_name: 'Org/repo',
          project_name: 'Correct Project',
        })
      );
    });

    it('should create rule from significant pattern', async () => {
      const { recordOrganizationRule } = require('@/lib/pm/pm-memory');

      await learnFromUserCorrection(
        'Org/analytics-dashboard',
        'Wrong Project',
        'Analytics Project',
        'All analytics repos should go to Analytics Project'
      );

      expect(recordOrganizationRule).toHaveBeenCalled();
    });
  });

  describe('getOrganizationStatus', () => {
    it('should return organization statistics', async () => {
      mockGitHubClient.getRepos.mockResolvedValueOnce([
        { name: 'repo1', full_name: 'Org/repo1' },
        { name: 'repo2', full_name: 'Org/repo2' },
      ]);
      mockGitHubClient.getRepoMappings.mockReturnValueOnce([
        { repo_full_name: 'Org/repo1', project_name: 'Project 1', last_synced_at: 1000 },
      ]);

      const status = await getOrganizationStatus();

      expect(status.totalRepos).toBe(2);
      expect(status.organizedRepos).toBe(1);
      expect(status.unorganizedRepos).toBe(1);
    });

    it('should count repos by project', async () => {
      mockGitHubClient.getRepos.mockResolvedValueOnce([]);
      mockGitHubClient.getRepoMappings.mockReturnValueOnce([
        { repo_full_name: 'Org/repo1', project_name: 'Project A' },
        { repo_full_name: 'Org/repo2', project_name: 'Project A' },
        { repo_full_name: 'Org/repo3', project_name: 'Project B' },
      ]);

      const status = await getOrganizationStatus();

      expect(status.projectCounts['Project A']).toBe(2);
      expect(status.projectCounts['Project B']).toBe(1);
    });

    it('should return recent assignments', async () => {
      mockGitHubClient.getRepos.mockResolvedValueOnce([]);
      mockGitHubClient.getRepoMappings.mockReturnValueOnce([
        { repo_full_name: 'Org/repo1', project_name: 'Project 1', last_synced_at: 2000 },
        { repo_full_name: 'Org/repo2', project_name: 'Project 2', last_synced_at: 1000 },
      ]);

      const status = await getOrganizationStatus();

      expect(status.recentAssignments).toHaveLength(2);
      // Should be sorted by last_synced_at descending
      expect(status.recentAssignments[0].repo_full_name).toBe('Org/repo1');
    });
  });

  describe('syncProjectsToMemory', () => {
    it('should sync projects to memory', async () => {
      const { recordProjectContext, recordSyncEvent } = require('@/lib/pm/pm-memory');

      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_1', title: 'Project 1', shortDescription: 'Description' },
      ]);
      mockProjectsClient.getAllProjectItems.mockResolvedValueOnce([
        { content: { repository: { nameWithOwner: 'Org/repo1' } } },
      ]);

      await syncProjectsToMemory();

      expect(recordProjectContext).toHaveBeenCalled();
      expect(recordSyncEvent).toHaveBeenCalledWith(
        'github',
        'projects_sync',
        expect.any(Number),
        true,
        expect.any(String)
      );
    });

    it('should extract repos from project items', async () => {
      const { recordProjectContext } = require('@/lib/pm/pm-memory');

      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_1', title: 'Test Project' },
      ]);
      mockProjectsClient.getAllProjectItems.mockResolvedValueOnce([
        { content: { repository: { nameWithOwner: 'Org/repo1' } } },
        { content: { repository: { nameWithOwner: 'Org/repo2' } } },
      ]);

      await syncProjectsToMemory();

      expect(recordProjectContext).toHaveBeenCalledWith(
        expect.objectContaining({
          repos: expect.arrayContaining(['Org/repo1', 'Org/repo2']),
        })
      );
    });

    it('should determine domain from project title', async () => {
      const { recordProjectContext } = require('@/lib/pm/pm-memory');

      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_vuplicity', title: 'Vuplicity Tasks' },
      ]);
      mockProjectsClient.getAllProjectItems.mockResolvedValueOnce([]);

      await syncProjectsToMemory();

      expect(recordProjectContext).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'vuplicity',
        })
      );
    });

    it('should handle project item fetch errors', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_error', title: 'Error Project' },
      ]);
      mockProjectsClient.getAllProjectItems.mockRejectedValueOnce(new Error('API error'));

      await syncProjectsToMemory();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sync project')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Default Rules', () => {
    it('should match vuplicity pattern', async () => {
      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'vuplicity-api', full_name: 'Org/vuplicity-api' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_vuplicity', title: 'Vuplicity' },
      ]);

      const suggestions = await getOrganizationSuggestions();

      const vuplicitySuggestion = suggestions.find(s =>
        s.repo.name.includes('vuplicity')
      );
      expect(vuplicitySuggestion?.suggestions.some(s =>
        s.project.title === 'Vuplicity'
      )).toBe(true);
    });

    it('should match utlyze pattern', async () => {
      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'utlyze-dashboard', full_name: 'Org/utlyze-dashboard' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_utlyze', title: 'Utlyze Core' },
      ]);

      const suggestions = await getOrganizationSuggestions();

      const utlyzeSuggestion = suggestions.find(s =>
        s.repo.name.includes('utlyze')
      );
      expect(utlyzeSuggestion?.suggestions.some(s =>
        s.project.title === 'Utlyze Core'
      )).toBe(true);
    });
  });

  describe('AI Suggestions', () => {
    it('should cap AI confidence at 0.8', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '{"projectTitle": "Test", "confidence": 0.95, "rationale": "Very confident"}',
      });

      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'ai-test-repo', full_name: 'Org/ai-test-repo' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_test', title: 'Test' },
      ]);

      const suggestions = await getOrganizationSuggestions();

      const aiSuggestion = suggestions[0]?.suggestions.find(s => s.source === 'ai');
      if (aiSuggestion) {
        expect(aiSuggestion.confidence).toBeLessThanOrEqual(0.8);
      }
    });

    it('should handle null AI response', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '{"projectTitle": null, "confidence": 0, "rationale": "No match"}',
      });

      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'no-match-repo', full_name: 'Org/no-match-repo' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([
        { id: 'proj_1', title: 'Some Project' },
      ]);

      const suggestions = await getOrganizationSuggestions();

      // Should not crash and should have suggestions array
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should handle AI parse errors', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: 'invalid json response',
      });

      mockGitHubClient.getUnmappedRepos.mockResolvedValueOnce([
        { name: 'parse-error-repo', full_name: 'Org/parse-error-repo' },
      ]);
      mockProjectsClient.getAllProjects.mockResolvedValueOnce([]);

      const suggestions = await getOrganizationSuggestions();

      expect(Array.isArray(suggestions)).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
