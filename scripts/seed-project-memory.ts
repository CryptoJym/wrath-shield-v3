/**
 * Seed Project Memory
 *
 * Populates the memory system with project inventory context for AI agents.
 * This enables agents to understand project relationships and domains.
 */

import { addMemory, initializeMemory } from '../lib/MemoryWrapper';

const PROJECT_USER_ID = 'pm-agent-system';

interface ProjectContext {
  domain: string;
  projects: Array<{
    name: string;
    repo: string;
    owner: string;
    description: string;
    status: 'active' | 'r&d' | 'archived';
    priority: 'high' | 'medium' | 'low';
  }>;
}

const PROJECT_DOMAINS: ProjectContext[] = [
  {
    domain: 'Of One Ecosystem',
    projects: [
      { name: 'CEO of One', repo: 'ceoofone', owner: 'h3ro-dev', description: 'Executive AI assistant for solo founders', status: 'active', priority: 'high' },
      { name: 'VC of One', repo: 'vcofone', owner: 'h3ro-dev', description: 'Investment analysis AI', status: 'active', priority: 'high' },
      { name: 'Director of One', repo: 'directorofone', owner: 'h3ro-dev', description: 'Project management AI', status: 'active', priority: 'high' },
      { name: 'HR of One', repo: 'hrofone', owner: 'h3ro-dev', description: 'HR automation AI', status: 'active', priority: 'high' },
      { name: 'Unicorn of One', repo: 'unicornofone', owner: 'h3ro-dev', description: 'Startup scaling AI', status: 'active', priority: 'high' },
      { name: 'Lawyer of One', repo: 'lawyerofone', owner: 'h3ro-dev', description: 'Legal assistant AI', status: 'active', priority: 'high' },
      { name: 'CRO Revenue Compass', repo: 'cro-revenue-compass', owner: 'h3ro-dev', description: 'Revenue optimization AI', status: 'active', priority: 'high' },
      { name: 'Of One UI', repo: 'ofone-ui', owner: 'h3ro-dev', description: 'Shared UI component library', status: 'active', priority: 'high' },
      { name: 'Business of One', repo: 'businessofone', owner: 'CryptoJym', description: 'Main Business of One platform', status: 'active', priority: 'high' },
    ],
  },
  {
    domain: 'FCRA Compliance',
    projects: [
      { name: 'Wrath Shield v3', repo: 'wrath-shield-v3', owner: 'CryptoJym', description: 'Main FCRA compliance platform with background check monitoring', status: 'active', priority: 'high' },
      { name: 'FCRA Compliance Matrix', repo: 'fcra-compliance-matrix', owner: 'CryptoJym', description: 'Compliance tracking matrix for FCRA regulations', status: 'active', priority: 'high' },
      { name: 'FCRA Researcher', repo: 'fcra-compliance-researcher', owner: 'CryptoJym', description: 'AI research agent for FCRA regulations', status: 'active', priority: 'high' },
      { name: 'FCRA System', repo: 'fcra-compliance-system', owner: 'h3ro-dev', description: 'Core compliance system implementation', status: 'active', priority: 'high' },
      { name: 'Background Check MCP', repo: 'background-check-mcp', owner: 'CryptoJym', description: 'MCP server for background check workflows', status: 'active', priority: 'medium' },
      { name: 'Utah BGC Mesh', repo: 'utah-bgc-mesh', owner: 'CryptoJym', description: 'Utah-specific background check integration', status: 'active', priority: 'medium' },
      { name: 'Fair Chance Advocate', repo: 'fair-chance-advocate', owner: 'h3ro-dev', description: 'Fair chance hiring advocacy tools', status: 'active', priority: 'medium' },
    ],
  },
  {
    domain: 'MCP Servers',
    projects: [
      { name: 'Motion MCP', repo: 'motion-mcp-server', owner: 'h3ro-dev', description: 'Motion.so integration for AI', status: 'active', priority: 'high' },
      { name: 'Marketing MCP', repo: 'marketing-mcp-servers', owner: 'CryptoJym', description: 'Marketing tool integrations', status: 'active', priority: 'medium' },
      { name: 'Gamma MCP', repo: 'gamma-mcp-server', owner: 'CryptoJym', description: 'Gamma.app presentation integration', status: 'active', priority: 'medium' },
      { name: 'GoHighLevel MCP', repo: 'gohighlevel-mcp', owner: 'CryptoJym', description: 'GoHighLevel CRM integration', status: 'active', priority: 'medium' },
      { name: 'FreshBooks MCP', repo: 'freshbooks-mcp-server', owner: 'CryptoJym', description: 'FreshBooks accounting integration', status: 'active', priority: 'medium' },
      { name: 'Limitless MCP', repo: 'limitless-mcp-server', owner: 'CryptoJym', description: 'Limitless wearable integration', status: 'active', priority: 'medium' },
      { name: 'Stripe MCP', repo: 'stripe-mcp-server', owner: 'h3ro-dev', description: 'Stripe payments integration', status: 'active', priority: 'medium' },
      { name: 'Resend MCP', repo: 'resend-mcp-server', owner: 'h3ro-dev', description: 'Resend email integration', status: 'active', priority: 'low' },
      { name: 'Vercel MCP', repo: 'vercel-mcp-server', owner: 'h3ro-dev', description: 'Vercel deployment integration', status: 'active', priority: 'low' },
      { name: 'Perplexity MCP', repo: 'perplexity-mcp-server', owner: 'h3ro-dev', description: 'Perplexity search integration', status: 'active', priority: 'low' },
    ],
  },
  {
    domain: 'Client Products',
    projects: [
      { name: 'Kahoa Platform', repo: 'kahoa-*', owner: 'h3ro-dev', description: 'Kahoa client platform development', status: 'active', priority: 'high' },
      { name: 'Utlyze', repo: 'utlyze-*', owner: 'h3ro-dev', description: 'Utlyze analytics product', status: 'active', priority: 'medium' },
      { name: 'Vuplicity', repo: 'vuplicity-*', owner: 'h3ro-dev', description: 'Vuplicity product development', status: 'active', priority: 'medium' },
      { name: 'SolutionStream', repo: 'solutionstream-*', owner: 'h3ro-dev', description: 'SolutionStream client project', status: 'active', priority: 'medium' },
      { name: 'New Reward', repo: 'new-reward-*', owner: 'h3ro-dev', description: 'Rewards platform development', status: 'active', priority: 'medium' },
    ],
  },
  {
    domain: 'AI Agents',
    projects: [
      { name: 'Autonomous PM', repo: 'autonomous-project-manager', owner: 'h3ro-dev', description: 'Autonomous project management agent', status: 'active', priority: 'high' },
      { name: 'Agent Generator', repo: 'ai-agent-generator', owner: 'h3ro-dev', description: 'AI agent scaffolding tool', status: 'active', priority: 'medium' },
      { name: 'Agent Template', repo: 'h3roai-agent-template', owner: 'h3ro-dev', description: 'Template for creating AI agents', status: 'active', priority: 'medium' },
      { name: 'Lead Scoring Agent', repo: 'lead-scoring-agent', owner: 'h3ro-dev', description: 'AI-powered lead scoring', status: 'active', priority: 'medium' },
      { name: 'Customer Success Agent', repo: 'customer-success-agent', owner: 'h3ro-dev', description: 'Customer success automation', status: 'active', priority: 'medium' },
      { name: 'Email Agent', repo: 'email-response-agent', owner: 'h3ro-dev', description: 'AI email response automation', status: 'active', priority: 'low' },
    ],
  },
];

const MOTION_WORKSPACES = [
  { id: 'my_team', name: 'My Team', purpose: 'Main team workspace', domain: 'Operations' },
  { id: 'my_tasks_private', name: 'My Tasks (Private)', purpose: 'Personal tasks', domain: 'Personal' },
  { id: 'utlyze', name: 'Utlyze', purpose: 'Utlyze product development', domain: 'Client Products' },
  { id: 'lisa_wife', name: 'Lisa (Wife)', purpose: 'Personal/Family tasks', domain: 'Personal' },
  { id: 'vuplicity', name: 'Vuplicity', purpose: 'Vuplicity product', domain: 'Client Products' },
  { id: 'new_reward', name: 'New Reward', purpose: 'Rewards platform', domain: 'Client Products' },
  { id: 'kahoa', name: 'Kahoa', purpose: 'Kahoa platform', domain: 'Client Products' },
  { id: 'solutionstream', name: 'SolutionStream', purpose: 'SolutionStream client', domain: 'Client Products' },
  { id: 'hyro_education_development', name: 'Hyro Education', purpose: 'Education development', domain: 'R&D' },
];

async function seedProjectMemory() {
  console.log('[SeedMemory] Initializing memory system...');
  await initializeMemory();

  // Seed domain overviews
  console.log('[SeedMemory] Adding domain overviews...');
  for (const domain of PROJECT_DOMAINS) {
    const projectList = domain.projects.map(p => `${p.name} (${p.owner}/${p.repo})`).join(', ');
    const text = `Domain: ${domain.domain}. Projects: ${projectList}. ${domain.projects.length} projects in this domain.`;

    await addMemory(text, PROJECT_USER_ID, {
      type: 'domain_overview',
      domain: domain.domain,
      project_count: domain.projects.length,
    });
    console.log(`  Added: ${domain.domain} (${domain.projects.length} projects)`);
  }

  // Seed individual projects
  console.log('[SeedMemory] Adding individual project context...');
  for (const domain of PROJECT_DOMAINS) {
    for (const project of domain.projects) {
      const text = `Project: ${project.name}. Repository: ${project.owner}/${project.repo}. Domain: ${domain.domain}. Description: ${project.description}. Status: ${project.status}. Priority: ${project.priority}.`;

      await addMemory(text, PROJECT_USER_ID, {
        type: 'project',
        domain: domain.domain,
        project_name: project.name,
        repo: project.repo,
        owner: project.owner,
        status: project.status,
        priority: project.priority,
      });
    }
  }
  console.log(`  Added ${PROJECT_DOMAINS.reduce((sum, d) => sum + d.projects.length, 0)} project memories`);

  // Seed Motion workspaces
  console.log('[SeedMemory] Adding Motion workspace context...');
  for (const workspace of MOTION_WORKSPACES) {
    const text = `Motion Workspace: ${workspace.name} (ID: ${workspace.id}). Purpose: ${workspace.purpose}. Domain: ${workspace.domain}.`;

    await addMemory(text, PROJECT_USER_ID, {
      type: 'motion_workspace',
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      domain: workspace.domain,
    });
  }
  console.log(`  Added ${MOTION_WORKSPACES.length} workspace memories`);

  // Seed key relationships
  console.log('[SeedMemory] Adding key relationship memories...');
  const relationships = [
    'The Of One ecosystem is the primary revenue-generating product line, consisting of AI agents that serve as virtual C-suite executives for solo founders.',
    'FCRA Compliance is the core business domain, with wrath-shield-v3 being the main platform for background check monitoring and compliance.',
    'MCP servers enable AI integrations across all products, connecting Claude and other LLMs to external services.',
    'The autonomous-project-manager handles GitHub/Motion synchronization for all projects.',
    'Client products (Kahoa, Utlyze, Vuplicity) each have dedicated Motion workspaces for task management.',
    'CryptoJym and h3ro-dev are the two GitHub organizations. h3ro-dev contains most production products while CryptoJym has infrastructure and FCRA tools.',
  ];

  for (const rel of relationships) {
    await addMemory(rel, PROJECT_USER_ID, {
      type: 'relationship',
    });
  }
  console.log(`  Added ${relationships.length} relationship memories`);

  console.log('[SeedMemory] Done! Memory system seeded with project context.');
}

// Run if executed directly
seedProjectMemory().catch(console.error);
