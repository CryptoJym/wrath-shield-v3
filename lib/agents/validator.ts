/**
 * Agent Configuration Validator
 * Validates agents.json for consistency and correctness
 */

import { getAgents, type AgentDefinition } from '@/lib/life-os-config';

export interface ValidationError {
  type: 'duplicate_id' | 'missing_field' | 'invalid_mapping' | 'orphan_reference';
  agentId?: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  try {
    const agentsConfig = getAgents();
    const agents = agentsConfig.agents;
    const seenIds = new Set<string>();

    for (const agent of agents) {
      // Check required fields first (including id)
      const requiredFields = ['id', 'name', 'role', 'type', 'system_prompt'] as const;
      for (const field of requiredFields) {
        if (!(agent as any)[field]) {
          errors.push({
            type: 'missing_field',
            agentId: agent.id || 'unknown',
            field: String(field),
            message: `Agent ${agent.id || 'unknown'} missing required field: ${field}`
          });
        }
      }

      // Check for duplicate IDs (only if id exists)
      if (agent.id) {
        if (seenIds.has(agent.id)) {
          errors.push({
            type: 'duplicate_id',
            agentId: agent.id,
            message: `Duplicate agent ID: ${agent.id}`
          });
        }
        seenIds.add(agent.id);
      }

      // Validate ID format
      if (!agent.id.startsWith('agent.')) {
        warnings.push(`Agent ID ${agent.id} doesn't follow naming convention (agent.xxx)`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  } catch (error) {
    return {
      valid: false,
      errors: [{ type: 'invalid_mapping', message: `Failed to load agent config: ${error}` }],
      warnings: []
    };
  }
}

/**
 * Validate and throw if invalid - call during app initialization
 */
export function validateAgentConfigOrThrow(): void {
  const result = validateAgentConfig();

  if (result.warnings.length > 0) {
    console.warn('[AgentValidator] Warnings:', result.warnings);
  }

  if (!result.valid) {
    console.error('[AgentValidator] Errors:', result.errors);
    throw new Error(`Agent configuration invalid: ${result.errors.map(e => e.message).join(', ')}`);
  }

  console.log('[AgentValidator] Configuration valid ✓');
}
