/**
 * Life OS Configuration Loader
 *
 * Loads and provides typed access to:
 * - life_charter.json - Global principles and escalation rules
 * - domains.json - Life domains (Family, Utlyze, Vuplicity, etc.)
 * - agents.json - Agent definitions with system prompts
 * - mappings.json - Motion/GitHub project mappings
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface PriorityItem {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface EscalationLevel {
  description: string;
  triggers: string[];
  response_time: string;
}

export interface LifeCharter {
  owner: string;
  version: number;
  lastUpdated: string;
  global_principles: string[];
  priority_stack: PriorityItem[];
  coherence_rules: {
    avoid_fragmentation: string[];
    deadline_rules: string[];
    meeting_rules: string[];
  };
  escalation_levels: {
    CRITICAL: EscalationLevel;
    PROPOSE: EscalationLevel;
    AUTO_EXECUTE: EscalationLevel;
  };
}

export interface Domain {
  id: string;
  name: string;
  type: 'personal' | 'company' | 'venture';
  description: string;
  owner: string;
  parent_domain?: string;
  key_people: string[];
  default_agent: string;
  priority_weight: number;
  sensitivity_level?: string;
  motion_workspace?: string;
  github_orgs?: string[];
}

export interface DomainsConfig {
  version: number;
  domains: Domain[];
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  type: 'orchestrator' | 'meta' | 'domain' | 'org' | 'personal' | 'support';
  domains: string[];
  tools: string[];
  system_prompt: string;
  max_context_tasks: number;
  avatar?: string;
  status_endpoint?: string | null;
  link?: string | null;
}

export interface AgentsConfig {
  version: number;
  agents: AgentDefinition[];
}

export interface MotionWorkspace {
  id: string;
  name: string;
  description: string;
}

export interface GitHubOrg {
  id: string;
  name: string;
  description: string;
  default_domain: string;
}

export interface GitHubRepo {
  id: string;
  full_name: string;
  description: string;
  default_domain: string;
  sensitivity?: string;
}

export interface ProjectMapping {
  id: string;
  domains: string[];
  motion_workspace_id: string;
  motion_projects: string[];
  github_repos: string[];
  direction: 'bidirectional' | 'motion_primary' | 'github_primary' | 'motion_only' | 'github_only' | 'none';
  auto_create_issue: boolean;
  auto_create_task: boolean;
  sync_status: boolean;
  sync_labels: boolean;
  sensitivity_level?: string;
  require_approval_for?: string[];
}

export interface SyncRules {
  default_sync_interval_minutes: number;
  status_mapping: {
    motion_to_github: Record<string, string>;
    github_to_motion: Record<string, string>;
  };
  priority_mapping: {
    motion_to_github: Record<string, string[]>;
  };
  conflict_resolution: string;
}

export interface MappingsConfig {
  version: number;
  motion: {
    workspaces: MotionWorkspace[];
  };
  github: {
    organizations: GitHubOrg[];
    repos: GitHubRepo[];
  };
  project_mappings: ProjectMapping[];
  sync_rules: SyncRules;
}

// ============================================================================
// Config Loader
// ============================================================================

const CONFIG_DIR = path.resolve(process.cwd(), 'config');

let _lifeCharter: LifeCharter | null = null;
let _domains: DomainsConfig | null = null;
let _agents: AgentsConfig | null = null;
let _mappings: MappingsConfig | null = null;

function loadJsonFile<T>(filename: string): T {
  const filePath = path.join(CONFIG_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Load the Life Charter configuration
 */
export function getLifeCharter(): LifeCharter {
  if (!_lifeCharter) {
    _lifeCharter = loadJsonFile<LifeCharter>('life_charter.json');
  }
  return _lifeCharter;
}

/**
 * Load the Domains configuration
 */
export function getDomains(): DomainsConfig {
  if (!_domains) {
    _domains = loadJsonFile<DomainsConfig>('domains.json');
  }
  return _domains;
}

/**
 * Load the Agents configuration
 */
export function getAgents(): AgentsConfig {
  if (!_agents) {
    _agents = loadJsonFile<AgentsConfig>('agents.json');
  }
  return _agents;
}

/**
 * Load the Mappings configuration
 */
export function getMappings(): MappingsConfig {
  if (!_mappings) {
    _mappings = loadJsonFile<MappingsConfig>('mappings.json');
  }
  return _mappings;
}

/**
 * Force reload all configs (useful after editing)
 */
export function reloadConfigs(): void {
  _lifeCharter = null;
  _domains = null;
  _agents = null;
  _mappings = null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a specific agent by ID
 */
export function getAgent(agentId: string): AgentDefinition | null {
  const agents = getAgents();
  return agents.agents.find(a => a.id === agentId) || null;
}

/**
 * Get a specific domain by ID
 */
export function getDomain(domainId: string): Domain | null {
  const domains = getDomains();
  return domains.domains.find(d => d.id === domainId) || null;
}

/**
 * Get the default agent for a domain
 */
export function getDefaultAgentForDomain(domainId: string): AgentDefinition | null {
  const domain = getDomain(domainId);
  if (!domain) return null;
  return getAgent(domain.default_agent);
}

/**
 * Get all agents that handle a specific domain
 */
export function getAgentsForDomain(domainId: string): AgentDefinition[] {
  const agents = getAgents();
  return agents.agents.filter(a =>
    a.domains.includes('*') || a.domains.includes(domainId)
  );
}

/**
 * Get mapping for a domain
 */
export function getMappingForDomain(domainId: string): ProjectMapping | null {
  const mappings = getMappings();
  return mappings.project_mappings.find(m => m.domains.includes(domainId)) || null;
}

/**
 * Get Motion workspace by ID
 */
export function getMotionWorkspace(workspaceId: string): MotionWorkspace | null {
  const mappings = getMappings();
  return mappings.motion.workspaces.find(w => w.id === workspaceId) || null;
}

/**
 * Get GitHub repo by ID
 */
export function getGitHubRepo(repoId: string): GitHubRepo | null {
  const mappings = getMappings();
  return mappings.github.repos.find(r => r.id === repoId) || null;
}

/**
 * Determine escalation level based on content
 */
export function determineEscalationLevel(
  content: string,
  domainId?: string
): 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE' {
  const charter = getLifeCharter();
  const domain = domainId ? getDomain(domainId) : null;

  // Check for CRITICAL triggers
  const criticalPatterns = [
    /lawsuit/i, /legal\s*threat/i, /security\s*(breach|incident)/i,
    /fraud/i, /compliance\s*violation/i, /fcra/i,
    /emergency/i, /urgent.*family/i, /health\s*crisis/i
  ];

  for (const pattern of criticalPatterns) {
    if (pattern.test(content)) {
      return 'CRITICAL';
    }
  }

  // High-compliance domains default to PROPOSE for anything non-trivial
  if (domain?.sensitivity_level === 'high_compliance') {
    return 'PROPOSE';
  }

  // Check for PROPOSE triggers
  const proposePatterns = [
    /new\s*project/i, /create\s*repo/i, /bulk/i,
    /deadline\s*change/i, /reassign/i, /budget/i,
    /\$\d{3,}/  // Amounts $100+
  ];

  for (const pattern of proposePatterns) {
    if (pattern.test(content)) {
      return 'PROPOSE';
    }
  }

  // Default to AUTO_EXECUTE
  return 'AUTO_EXECUTE';
}

/**
 * Build context pack for an agent invocation
 */
export function buildAgentContext(
  agentId: string,
  events: any[],
  recentTasks: any[],
  graphSnippet?: any
): {
  agent_id: string;
  system_prompt: string;
  life_charter: LifeCharter;
  domains: Domain[];
  events: any[];
  recent_tasks: any[];
  graph_snippet?: any;
} {
  const agent = getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const charter = getLifeCharter();
  const domainsConfig = getDomains();

  // Filter domains relevant to this agent
  const relevantDomains = agent.domains.includes('*')
    ? domainsConfig.domains
    : domainsConfig.domains.filter(d => agent.domains.includes(d.id));

  return {
    agent_id: agentId,
    system_prompt: agent.system_prompt,
    life_charter: charter,
    domains: relevantDomains,
    events,
    recent_tasks: recentTasks.slice(0, agent.max_context_tasks),
    graph_snippet: graphSnippet,
  };
}

/**
 * Get priority weight for a domain (higher = more important)
 */
export function getDomainPriority(domainId: string): number {
  const domain = getDomain(domainId);
  return domain?.priority_weight || 0;
}

/**
 * Sort items by domain priority (highest first)
 */
export function sortByDomainPriority<T extends { domain?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const priorityA = a.domain ? getDomainPriority(a.domain) : 0;
    const priorityB = b.domain ? getDomainPriority(b.domain) : 0;
    return priorityB - priorityA;
  });
}

// Export all configs for direct access if needed
export {
  CONFIG_DIR,
};
