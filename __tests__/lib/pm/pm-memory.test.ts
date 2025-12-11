// @ts-nocheck
/**
 * Wrath Shield v3 - PM Memory Tests
 *
 * Tests for the PM agent's memory operations:
 * - Repo assignment recording
 * - Project context management
 * - Organization rules
 * - Temporal memory integration
 * - AI triage context
 */

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock Zep memory module
const mockAddAgentMemory = jest.fn().mockResolvedValue(undefined);
const mockSearchAgentMemory = jest.fn().mockResolvedValue([]);
const mockSearchOrgMemory = jest.fn().mockResolvedValue([]);
const mockSearchAllMemory = jest.fn().mockResolvedValue({ agent: [], org: [] });
const mockProposeOrgMemory = jest.fn().mockResolvedValue({
  id: 'proposal-123',
  proposedBy: 'pm-agent',
  status: 'pending',
});

jest.mock('@/lib/memory/zep', () => ({
  addAgentMemory: mockAddAgentMemory,
  searchAgentMemory: mockSearchAgentMemory,
  searchOrgMemory: mockSearchOrgMemory,
  searchAllMemory: mockSearchAllMemory,
  proposeOrgMemory: mockProposeOrgMemory,
}));

// Mock temporal memory
const mockRecordFact = jest.fn().mockResolvedValue(undefined);
const mockRecordRelationship = jest.fn().mockResolvedValue(undefined);
const mockGetCurrentState = jest.fn().mockReturnValue({ attributes: {} });
const mockGetHistoricalState = jest.fn().mockReturnValue({ attributes: {} });

jest.mock('@/lib/pm/temporal-memory', () => ({
  recordFact: mockRecordFact,
  recordRelationship: mockRecordRelationship,
  getCurrentState: mockGetCurrentState,
  getHistoricalState: mockGetHistoricalState,
}));

// Mock correction feedback
const mockRecordCorrection = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/pm/correction-feedback', () => ({
  recordCorrection: mockRecordCorrection,
}));

import {
  searchPMMemory,
  getPMContext,
  addPMMemory,
  recordRepoAssignment,
  recordProjectContext,
  recordOrganizationRule,
  learnFromCorrection,
  suggestProjectForRepo,
  getOrganizationStructure,
  proposeOrganizationPolicy,
  recordSyncEvent,
  getRepoOrganizationContext,
  getOrganizationalPolicies,
  recordDecisionWithTemporal,
  getHistoricalContext,
  recordEntityRelationship,
  learnFromCorrectionWithTemporal,
  recordRepoAssignmentWithTemporal,
  searchPMMemories,
  getTriageContext,
  getSuggestionContext,
  recordTriageDecision,
  recordSuggestionFeedback,
  PM_AGENT_ID,
  type RepoAssignment,
  type ProjectContext,
  type OrganizationRule,
} from '@/lib/pm/pm-memory';

describe('PM Memory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    it('should export PM agent ID', () => {
      expect(PM_AGENT_ID).toBe('pm-agent');
    });
  });

  describe('searchPMMemory', () => {
    it('should search PM agent memory', async () => {
      const mockResults = [{ memory: { text: 'test' } }];
      mockSearchAgentMemory.mockResolvedValueOnce(mockResults);

      const result = await searchPMMemory('project');

      expect(result).toEqual(mockResults);
      expect(mockSearchAgentMemory).toHaveBeenCalledWith('pm-agent', 'project', 10);
    });

    it('should respect custom limit', async () => {
      mockSearchAgentMemory.mockResolvedValueOnce([]);
      await searchPMMemory('query', 5);

      expect(mockSearchAgentMemory).toHaveBeenCalledWith('pm-agent', 'query', 5);
    });
  });

  describe('getPMContext', () => {
    it('should return combined private and org context', async () => {
      mockSearchAllMemory.mockResolvedValueOnce({
        agent: [{ memory: { text: 'private' } }],
        org: [{ memory: { text: 'org' } }],
      });

      const result = await getPMContext('query');

      expect(result.private).toHaveLength(1);
      expect(result.org).toHaveLength(1);
    });
  });

  describe('addPMMemory', () => {
    it('should add memory with category prefix', async () => {
      await addPMMemory('Test memory', 'project');

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'pm-agent',
        '[PM - PROJECT] Test memory',
        expect.objectContaining({
          domain: 'pm',
          category: 'project',
        })
      );
    });

    it('should support all categories', async () => {
      const categories = [
        'assignment', 'project', 'rule', 'pattern',
        'decision', 'sync', 'suggestion', 'triage', 'continuity'
      ] as const;

      for (const category of categories) {
        jest.clearAllMocks();
        await addPMMemory('Test', category);

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'pm-agent',
          expect.stringContaining(`[PM - ${category.toUpperCase()}]`),
          expect.objectContaining({ category })
        );
      }
    });
  });

  describe('recordRepoAssignment', () => {
    it('should record repo assignment to memory', async () => {
      const assignment: RepoAssignment = {
        repoName: 'test-repo',
        repoFullName: 'org/test-repo',
        projectId: 'proj-123',
        projectName: 'Test Project',
        rationale: 'Good fit',
        confidence: 0.85,
        source: 'ai_suggested',
        assignedAt: '2025-01-01T00:00:00Z',
      };

      await recordRepoAssignment(assignment);

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'pm-agent',
        expect.stringContaining('org/test-repo'),
        expect.objectContaining({
          repo_name: 'test-repo',
          project_id: 'proj-123',
          confidence: 0.85,
          source: 'ai_suggested',
        })
      );
    });
  });

  describe('recordProjectContext', () => {
    it('should record project context', async () => {
      const context: ProjectContext = {
        projectId: 'proj-123',
        projectName: 'Test Project',
        description: 'A test project',
        domain: 'utlyze',
        repos: ['repo1', 'repo2'],
        primaryLanguages: ['TypeScript'],
        teamMembers: ['Alice', 'Bob'],
      };

      await recordProjectContext(context);

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'pm-agent',
        expect.stringContaining('Test Project'),
        expect.objectContaining({
          project_id: 'proj-123',
          domain: 'utlyze',
          repo_count: 2,
        })
      );
    });
  });

  describe('recordOrganizationRule', () => {
    it('should record organization rule', async () => {
      const rule: OrganizationRule = {
        id: 'rule-1',
        pattern: 'utlyze-*',
        targetProject: 'Utlyze Core',
        confidence: 0.9,
        examples: ['utlyze-api', 'utlyze-web'],
        createdAt: '2025-01-01T00:00:00Z',
      };

      await recordOrganizationRule(rule);

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'pm-agent',
        expect.stringContaining('utlyze-*'),
        expect.objectContaining({
          rule_id: 'rule-1',
          pattern: 'utlyze-*',
          target_project: 'Utlyze Core',
        })
      );
    });
  });

  describe('learnFromCorrection', () => {
    it('should record correction pattern', async () => {
      await learnFromCorrection(
        'test-repo',
        'Wrong Project',
        'Correct Project',
        'User corrected'
      );

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'pm-agent',
        expect.stringContaining('Assignment Correction'),
        expect.objectContaining({
          repo_name: 'test-repo',
          wrong_project: 'Wrong Project',
          correct_project: 'Correct Project',
          type: 'correction',
        })
      );
    });
  });

  describe('suggestProjectForRepo', () => {
    it('should return suggestions based on memory', async () => {
      mockSearchAgentMemory.mockResolvedValueOnce([
        { memory: { text: 'Project A', metadata: { project_name: 'Project A' } }, score: 0.9 },
        { memory: { text: 'Project B', metadata: { project_name: 'Project B' } }, score: 0.8 },
      ]);

      const result = await suggestProjectForRepo('new-repo');

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].project).toBe('Project A');
      expect(result.suggestions[0].confidence).toBe(0.9);
    });

    it('should deduplicate suggestions', async () => {
      mockSearchAgentMemory.mockResolvedValueOnce([
        { memory: { metadata: { project_name: 'Project A' } }, score: 0.9 },
        { memory: { metadata: { project_name: 'Project A' } }, score: 0.8 },
      ]);

      const result = await suggestProjectForRepo('repo');

      expect(result.suggestions).toHaveLength(1);
    });
  });

  describe('getOrganizationStructure', () => {
    it('should return projects and rules', async () => {
      mockSearchAgentMemory
        .mockResolvedValueOnce([
          { memory: { text: 'Repos: repo1, repo2', metadata: { category: 'project', project_name: 'Proj' } } }
        ])
        .mockResolvedValueOnce([
          { memory: { metadata: { category: 'rule' } } }
        ]);

      const result = await getOrganizationStructure();

      expect(result.projects.size).toBe(1);
      expect(result.projects.get('Proj')).toEqual(['repo1', 'repo2']);
      expect(result.rules).toHaveLength(1);
    });
  });

  describe('proposeOrganizationPolicy', () => {
    it('should submit policy proposal', async () => {
      const proposal = await proposeOrganizationPolicy(
        'Route all frontend repos to UI project',
        'Improves organization',
        ['UI Project', 'Frontend']
      );

      expect(proposal.id).toBe('proposal-123');
      expect(mockProposeOrgMemory).toHaveBeenCalledWith(
        'pm-agent',
        expect.stringContaining('[PM ORGANIZATION POLICY]'),
        expect.objectContaining({
          type: 'organization_policy',
          affected_projects: ['UI Project', 'Frontend'],
        })
      );
    });
  });

  describe('recordSyncEvent', () => {
    it('should record sync event', async () => {
      await recordSyncEvent('github', 'fetch_issues', 50, true, 'All fetched');

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'pm-agent',
        expect.stringContaining('Sync Event: github'),
        expect.objectContaining({
          source: 'github',
          operation: 'fetch_issues',
          items_affected: 50,
          success: true,
        })
      );
    });
  });

  describe('getRepoOrganizationContext', () => {
    it('should format context for UI', async () => {
      mockSearchAgentMemory.mockResolvedValue([]);

      const context = await getRepoOrganizationContext('test-repo');

      expect(context).toContain('Organization Context for test-repo');
    });
  });

  describe('getOrganizationalPolicies', () => {
    it('should search org council memory', async () => {
      await getOrganizationalPolicies('routing');

      expect(mockSearchOrgMemory).toHaveBeenCalledWith('routing', 10);
    });
  });

  describe('Temporal Memory Integration', () => {
    describe('recordDecisionWithTemporal', () => {
      it('should record to both Zep and temporal layer', async () => {
        await recordDecisionWithTemporal({
          entity_type: 'task',
          entity_id: 'task-123',
          attribute: 'priority',
          value: 'high',
          source: 'ai_suggestion',
          confidence: 0.9,
        });

        expect(mockAddAgentMemory).toHaveBeenCalled();
        expect(mockRecordFact).toHaveBeenCalledWith(
          expect.objectContaining({
            entity_type: 'task',
            entity_id: 'task-123',
            attribute: 'priority',
            value: 'high',
          })
        );
      });
    });

    describe('getHistoricalContext', () => {
      it('should get current state when no point_in_time', async () => {
        mockGetCurrentState.mockReturnValueOnce({ attributes: { status: 'open' } });

        const context = await getHistoricalContext({
          entity_type: 'task',
          entity_id: 'task-123',
        });

        expect(context.status).toBe('open');
        expect(mockGetCurrentState).toHaveBeenCalled();
      });

      it('should get historical state when point_in_time provided', async () => {
        const pointInTime = new Date('2025-01-01');
        mockGetHistoricalState.mockReturnValueOnce({ attributes: { status: 'closed' } });

        const context = await getHistoricalContext({
          entity_type: 'task',
          entity_id: 'task-123',
          point_in_time: pointInTime,
        });

        expect(context.status).toBe('closed');
        expect(mockGetHistoricalState).toHaveBeenCalled();
      });
    });

    describe('recordEntityRelationship', () => {
      it('should record relationship', async () => {
        await recordEntityRelationship({
          from_entity_type: 'task',
          from_entity_id: 'task-123',
          to_entity_type: 'person',
          to_entity_id: 'user-456',
          relationship_type: 'assigned_to',
        });

        expect(mockRecordRelationship).toHaveBeenCalledWith(
          expect.objectContaining({
            relationship_type: 'assigned_to',
          })
        );
      });
    });

    describe('learnFromCorrectionWithTemporal', () => {
      it('should record to both Zep and correction feedback', async () => {
        await learnFromCorrectionWithTemporal({
          repoName: 'test-repo',
          wrongProject: 'Wrong',
          correctProject: 'Correct',
          reason: 'User fixed',
        });

        expect(mockAddAgentMemory).toHaveBeenCalled();
        expect(mockRecordCorrection).toHaveBeenCalledWith(
          expect.objectContaining({
            correction_type: 'assignment',
            original_value: { project: 'Wrong' },
            corrected_value: { project: 'Correct' },
          })
        );
      });
    });

    describe('recordRepoAssignmentWithTemporal', () => {
      it('should record assignment and relationship', async () => {
        const assignment: RepoAssignment = {
          repoName: 'repo',
          repoFullName: 'org/repo',
          projectId: 'proj-1',
          projectName: 'Project',
          rationale: 'Fits',
          confidence: 0.9,
          source: 'manual',
          assignedAt: new Date().toISOString(),
        };

        await recordRepoAssignmentWithTemporal(assignment);

        expect(mockAddAgentMemory).toHaveBeenCalled();
        expect(mockRecordFact).toHaveBeenCalled();
        expect(mockRecordRelationship).toHaveBeenCalledWith(
          expect.objectContaining({
            relationship_type: 'belongs_to',
          })
        );
      });
    });
  });

  describe('AI Triage Memory Functions', () => {
    describe('searchPMMemories', () => {
      it('should return simplified memory format', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { text: 'Test', metadata: { key: 'value' } }, score: 0.9 }
        ]);

        const result = await searchPMMemories('query');

        expect(result[0].text).toBe('Test');
        expect(result[0].score).toBe(0.9);
        expect(result[0].metadata).toEqual({ key: 'value' });
      });

      it('should handle errors gracefully', async () => {
        mockSearchAgentMemory.mockRejectedValueOnce(new Error('Search failed'));

        const result = await searchPMMemories('query');

        expect(result).toEqual([]);
      });
    });

    describe('getTriageContext', () => {
      it('should combine private and org context', async () => {
        mockSearchAllMemory.mockResolvedValueOnce({
          agent: [{ memory: { text: 'Past triage' } }],
          org: [{ memory: { text: 'Policy' } }],
        });

        const result = await getTriageContext('github', 'issue', ['bug']);

        expect(result.privateContext).toContain('Past Triage Decisions');
        expect(result.orgContext).toContain('Organizational Policies');
        expect(result.combinedContext).toContain('Past Triage');
      });
    });

    describe('getSuggestionContext', () => {
      it('should return patterns and examples', async () => {
        mockSearchAgentMemory
          .mockResolvedValueOnce([{ memory: { text: 'Pattern 1' } }])
          .mockResolvedValueOnce([{ memory: { text: 'Example 1' } }]);

        const result = await getSuggestionContext('task', 'task-123', 'priority');

        expect(result.patterns).toContain('Pattern 1');
        expect(result.examples).toContain('Example 1');
      });
    });

    describe('recordTriageDecision', () => {
      it('should record triage decision', async () => {
        await recordTriageDecision({
          signalId: 'sig-123',
          signalSource: 'github',
          signalType: 'issue',
          action: 'github_issue',
          escalation: 'auto',
          priority: 'high',
          confidence: 0.9,
          rationale: 'High priority bug',
          aiPowered: true,
        });

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'pm-agent',
          expect.stringContaining('Triage Decision'),
          expect.objectContaining({
            signal_id: 'sig-123',
            ai_powered: true,
          })
        );
      });
    });

    describe('recordSuggestionFeedback', () => {
      it('should record accepted feedback', async () => {
        await recordSuggestionFeedback({
          suggestionId: 'sug-123',
          suggestionType: 'priority',
          entityType: 'task',
          entityId: 'task-123',
          suggestedValue: 'high',
          accepted: true,
        });

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'pm-agent',
          expect.stringContaining('Accepted'),
          expect.any(Object)
        );
        // Should NOT record correction for accepted
        expect(mockRecordCorrection).not.toHaveBeenCalled();
      });

      it('should record correction for rejected feedback', async () => {
        await recordSuggestionFeedback({
          suggestionId: 'sug-123',
          suggestionType: 'priority',
          entityType: 'task',
          entityId: 'task-123',
          suggestedValue: 'high',
          accepted: false,
          userFeedback: 'Should be medium',
        });

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'pm-agent',
          expect.stringContaining('Rejected'),
          expect.any(Object)
        );
        expect(mockRecordCorrection).toHaveBeenCalled();
      });
    });
  });
});
