// @ts-nocheck
/**
 * Wrath Shield v3 - Agent Validator Tests
 *
 * Tests for the Agent Configuration Validator that validates agents.json:
 * - Duplicate ID detection
 * - Required field validation
 * - ID naming convention warnings
 */

// Mock life-os-config
const mockGetAgents = jest.fn();

jest.mock('@/lib/life-os-config', () => ({
  getAgents: mockGetAgents,
}));

import {
  validateAgentConfig,
  validateAgentConfigOrThrow,
  type ValidationResult,
  type ValidationError,
} from '@/lib/agents/validator';

describe('Agent Validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAgentConfig', () => {
    it('should return valid for correct configuration', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.orchestrator',
            name: 'Orchestrator',
            role: 'Central coordinator',
            type: 'coordinator',
            system_prompt: 'You are the orchestrator.',
          },
          {
            id: 'agent.legal',
            name: 'Legal Agent',
            role: 'Legal advisor',
            type: 'specialist',
            system_prompt: 'You handle legal matters.',
          },
        ],
      });

      const result = validateAgentConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate agent IDs', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.legal',
            name: 'Legal Agent 1',
            role: 'Legal',
            type: 'specialist',
            system_prompt: 'Prompt 1',
          },
          {
            id: 'agent.legal', // Duplicate!
            name: 'Legal Agent 2',
            role: 'Legal',
            type: 'specialist',
            system_prompt: 'Prompt 2',
          },
        ],
      });

      const result = validateAgentConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'duplicate_id')).toBe(true);
      expect(result.errors[0].message).toContain('Duplicate');
    });

    it('should detect missing required fields', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.incomplete',
            name: 'Incomplete Agent',
            // Missing: role, type, system_prompt
          },
        ],
      });

      const result = validateAgentConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_field')).toBe(true);
    });

    it('should detect missing id field', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            // Missing id!
            name: 'Agent Without ID',
            role: 'Test',
            type: 'specialist',
            system_prompt: 'Prompt',
          },
        ],
      });

      const result = validateAgentConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'id')).toBe(true);
    });

    it('should detect missing name field', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.noname',
            // Missing name!
            role: 'Test',
            type: 'specialist',
            system_prompt: 'Prompt',
          },
        ],
      });

      const result = validateAgentConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should detect missing role field', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.norole',
            name: 'Agent Without Role',
            // Missing role!
            type: 'specialist',
            system_prompt: 'Prompt',
          },
        ],
      });

      const result = validateAgentConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'role')).toBe(true);
    });

    it('should warn for non-standard ID format', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'my-agent', // Doesn't start with 'agent.'
            name: 'My Agent',
            role: 'Test',
            type: 'specialist',
            system_prompt: 'Prompt',
          },
        ],
      });

      const result = validateAgentConfig();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('naming convention');
    });

    it('should not warn for properly formatted IDs', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.proper',
            name: 'Proper Agent',
            role: 'Test',
            type: 'specialist',
            system_prompt: 'Prompt',
          },
        ],
      });

      const result = validateAgentConfig();

      expect(result.warnings).toHaveLength(0);
    });

    it('should handle getAgents throwing an error', () => {
      mockGetAgents.mockImplementation(() => {
        throw new Error('Config file not found');
      });

      const result = validateAgentConfig();

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('invalid_mapping');
      expect(result.errors[0].message).toContain('Failed to load');
    });

    it('should handle empty agents array', () => {
      mockGetAgents.mockReturnValue({ agents: [] });

      const result = validateAgentConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect multiple errors from same agent', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.broken',
            // Missing: name, role, type, system_prompt
          },
        ],
      });

      const result = validateAgentConfig();

      // Should have errors for each missing field
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateAgentConfigOrThrow', () => {
    it('should not throw for valid configuration', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.valid',
            name: 'Valid Agent',
            role: 'Test',
            type: 'specialist',
            system_prompt: 'Prompt',
          },
        ],
      });

      expect(() => validateAgentConfigOrThrow()).not.toThrow();
    });

    it('should throw for invalid configuration', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.invalid',
            // Missing required fields
          },
        ],
      });

      expect(() => validateAgentConfigOrThrow()).toThrow('Agent configuration invalid');
    });

    it('should include error messages in thrown error', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.incomplete',
            name: 'Incomplete',
            // Missing: role, type, system_prompt
          },
        ],
      });

      expect(() => validateAgentConfigOrThrow()).toThrow(/missing required field/);
    });

    it('should log warnings but not throw', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'nonstandard-id', // Warning but not error
            name: 'Agent',
            role: 'Test',
            type: 'specialist',
            system_prompt: 'Prompt',
          },
        ],
      });

      expect(() => validateAgentConfigOrThrow()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AgentValidator] Warnings:'),
        expect.any(Array)
      );

      consoleSpy.mockRestore();
    });

    it('should log success message on valid config', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockGetAgents.mockReturnValue({
        agents: [
          {
            id: 'agent.good',
            name: 'Good Agent',
            role: 'Test',
            type: 'specialist',
            system_prompt: 'Prompt',
          },
        ],
      });

      validateAgentConfigOrThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration valid')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Types', () => {
    it('should use duplicate_id error type for duplicates', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          { id: 'agent.dup', name: 'A', role: 'R', type: 'T', system_prompt: 'P' },
          { id: 'agent.dup', name: 'B', role: 'R', type: 'T', system_prompt: 'P' },
        ],
      });

      const result = validateAgentConfig();
      const dupError = result.errors.find(e => e.type === 'duplicate_id');

      expect(dupError).toBeDefined();
      expect(dupError?.agentId).toBe('agent.dup');
    });

    it('should use missing_field error type for missing fields', () => {
      mockGetAgents.mockReturnValue({
        agents: [
          { id: 'agent.test', name: 'Test' /* missing role, type, system_prompt */ },
        ],
      });

      const result = validateAgentConfig();
      const missingErrors = result.errors.filter(e => e.type === 'missing_field');

      expect(missingErrors.length).toBeGreaterThan(0);
      expect(missingErrors[0].field).toBeDefined();
    });

    it('should use invalid_mapping error type for load failures', () => {
      mockGetAgents.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = validateAgentConfig();
      const loadError = result.errors.find(e => e.type === 'invalid_mapping');

      expect(loadError).toBeDefined();
    });
  });
});
