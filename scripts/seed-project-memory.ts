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
      { name: 'LLC of One', repo: 'one-llc-launchpad', owner: 'CryptoJym', description: 'Multi-venture launch platform for solo founders', status: 'active', priority: 'medium' },
      { name: 'HR of One Launchpad', repo: 'hr-of-one-launchpad', owner: 'CryptoJym', description: 'HR of One launchpad variant', status: 'active', priority: 'medium' },
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
      { name: 'Legal Advocate AI', repo: 'legal-advocate-ai', owner: 'CryptoJym', description: 'Privacy-first legal workflow assistant for Utah family law', status: 'active', priority: 'medium' },
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
      { name: 'WHOOP MCP', repo: 'whoop-mcp-server', owner: 'CryptoJym', description: 'WHOOP API health/fitness data access', status: 'active', priority: 'high' },
      { name: 'Cloze CRM MCP', repo: 'cloze-crm-mcp', owner: 'CryptoJym', description: 'Cloze CRM integration with Six Sigma validation', status: 'active', priority: 'medium' },
      { name: 'OSS 120B PM MCP', repo: 'oss-120b-pm-mcp', owner: 'CryptoJym', description: 'Autonomous PM with GitHub/Notion/Motion sync', status: 'active', priority: 'medium' },
      { name: 'InformData MCP', repo: 'informdata-mcp', owner: 'vuplicity', description: 'InformData background check integration', status: 'active', priority: 'high' },
    ],
  },
  {
    domain: 'Vuplicity Platform',
    projects: [
      { name: 'Vuplicity API', repo: 'vuplicity-api', owner: 'vuplicity', description: 'Core backend API - business logic, DB, integrations', status: 'active', priority: 'high' },
      { name: 'Vuplicity HR Portal', repo: 'vuplicity-hr-portal', owner: 'vuplicity', description: 'HR background check management interface', status: 'active', priority: 'high' },
      { name: 'Vuplicity Employee Portal', repo: 'vuplicity-employee-portal', owner: 'vuplicity', description: 'Candidate consent/dispute/report portal', status: 'active', priority: 'high' },
      { name: 'Vuplicity Website', repo: 'Vuplicity-Website', owner: 'vuplicity', description: 'Main Vuplicity marketing website', status: 'active', priority: 'medium' },
      { name: 'Vuplicity Workers', repo: 'vuplicity-workers', owner: 'vuplicity', description: 'Cloudflare Workers for edge computing', status: 'active', priority: 'medium' },
      { name: 'InformData API Docs', repo: 'informdata-api-documentation', owner: 'vuplicity', description: 'InformData API documentation', status: 'active', priority: 'medium' },
      { name: 'Stripe Integration', repo: 'stripe-test', owner: 'vuplicity', description: 'Stripe card-on-file billing system', status: 'active', priority: 'low' },
    ],
  },
  {
    domain: 'Client Products',
    projects: [
      { name: 'Kahoa Roadmap', repo: 'kahoa-roadmap', owner: 'CryptoJym', description: 'Kahoa roadmap documentation', status: 'active', priority: 'high' },
      { name: 'SolutionStream Site', repo: 'solutionstream-site', owner: 'CryptoJym', description: 'SolutionStream site managed with Task Master', status: 'active', priority: 'high' },
      { name: 'SolutionStream Website', repo: 'solutionstream-website', owner: 'CryptoJym', description: 'SolutionStream website backup', status: 'active', priority: 'medium' },
      { name: 'Utlyze Futuristic', repo: 'utlyze-futuristic', owner: 'CryptoJym', description: 'Utlyze futuristic web application', status: 'active', priority: 'medium' },
      { name: 'Utlyze Business Structure', repo: 'utlyze-business-structure-site', owner: 'CryptoJym', description: 'Utlyze business structure site', status: 'active', priority: 'medium' },
      { name: 'Utlyze Taskmaster Mem0', repo: 'utlyze-taskmaster-mem0', owner: 'CryptoJym', description: 'Taskmaster with Mem0 cloud memory', status: 'active', priority: 'medium' },
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
      { name: 'AI Agent Village Monitor', repo: 'ai-agent-village-monitor', owner: 'CryptoJym', description: 'AI agent village monitoring system', status: 'active', priority: 'medium' },
      { name: 'AI Lead Gen Pro', repo: 'ai-lead-gen-pro', owner: 'CryptoJym', description: 'AI lead generation with 5-pass Horsemen analysis', status: 'active', priority: 'medium' },
    ],
  },
  {
    domain: 'BCI Research',
    projects: [
      { name: 'EEG Burst Recorder', repo: 'eeg-burst-recorder', owner: 'CryptoJym', description: 'Real-time EEG burst detection for MW75 Neuro headphones', status: 'active', priority: 'medium' },
      { name: 'EEG Meditation Analysis', repo: 'eeg-meditation-analysis', owner: 'CryptoJym', description: 'Brainwave analysis for meditation tracking', status: 'active', priority: 'medium' },
      { name: 'Brain Visualization App', repo: 'brain-visualization-app', owner: 'CryptoJym', description: 'Brain visualization application', status: 'active', priority: 'medium' },
      { name: 'BCI Research', repo: 'bci-research', owner: 'CryptoJym', description: 'Brain-Computer Interface - neural to LLM tokens', status: 'r&d', priority: 'low' },
      { name: 'NanoBanana API', repo: 'nanobanana-api', owner: 'CryptoJym', description: 'Gemini 2.5 Flash image generation for brain viz', status: 'active', priority: 'low' },
    ],
  },
  {
    domain: 'Automation Tools',
    projects: [
      { name: 'Audio Pipeline', repo: 'audio-pipeline', owner: 'CryptoJym', description: 'Multi-speaker audio cleanup/diarization/transcription', status: 'active', priority: 'medium' },
      { name: 'Sidekick Testing Agent', repo: 'sidekick-testing-agent', owner: 'CryptoJym', description: 'Sidekick UI testing with OpenAI CUA + Playwright', status: 'active', priority: 'medium' },
      { name: 'Overseer', repo: 'Overseer', owner: 'CryptoJym', description: 'GitHub Action for roadmaps, memory graph, todoist', status: 'active', priority: 'medium' },
      { name: 'Limitless Intake Pipeline', repo: 'limitless-intake-pipeline', owner: 'CryptoJym', description: 'Limitless pendant ingestion + Mem0', status: 'active', priority: 'medium' },
      { name: 'Agent Foundry', repo: 'agent-foundry', owner: 'CryptoJym', description: 'Interactive open-weight model selection tool', status: 'active', priority: 'low' },
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
    'CryptoJym and h3ro-dev are the two main GitHub accounts. h3ro-dev contains most production products while CryptoJym has infrastructure, FCRA tools, and personal projects.',
    'The vuplicity GitHub organization contains the production Vuplicity platform: API, HR Portal, Employee Portal, Workers, and InformData MCP integration.',
    'Vuplicity is a background check platform that integrates with InformData for screening services. All 8 repos in the vuplicity org are private.',
    'BCI Research includes EEG burst recording, meditation analysis, and brain visualization - experimental work exploring neural-to-LLM token conversion.',
    'The WHOOP MCP server provides health/fitness data access for wrath-shield-v3 manipulation detection.',
  ];

  for (const rel of relationships) {
    await addMemory(rel, PROJECT_USER_ID, {
      type: 'relationship',
    });
  }
  console.log(`  Added ${relationships.length} relationship memories`);

  // Seed executive priorities
  console.log('[SeedMemory] Adding executive priority memories...');
  const execPriorities = [
    {
      name: 'Utlyze MIP Vision',
      urgency: 'high',
      owner: 'James Brady',
      workspace: 'utlyze',
      description: 'Managed Intelligence Platform - AI-powered business intelligence and automation. Key repos: utlyze-futuristic, utlyze-taskmaster-mem0, utlyze-financial-dashboard.',
    },
    {
      name: 'New Reward AI Marketing',
      urgency: 'high',
      owner: 'James Brady / Cody',
      workspace: 'new_reward',
      description: 'AI-first marketing, SEO, and site generation platform. Includes Cody\'s camera AI project for visual content automation. Key repos: marketing-mcp-servers, ai-lead-gen-pro, creative-ad-analyzer.',
    },
    {
      name: 'Solution Stream Fractional CAIO',
      urgency: 'high',
      owner: 'James Brady',
      workspace: 'solutionstream',
      description: 'AI-focused software development and fractional Chief AI Officer consulting. Site rebuild and lead generation active. Key repos: solutionstream-site, solutionstream-website.',
    },
    {
      name: 'Kahoa AI Training',
      urgency: 'medium',
      owner: 'James Brady',
      workspace: 'kahoa',
      description: 'AI training platform and product development. Roadmap defined, development pending. Key repos: kahoa-roadmap.',
    },
    {
      name: 'Vuplicity Background Screening',
      urgency: 'high',
      owner: 'James Brady',
      workspace: 'vuplicity',
      description: 'Background screening platform with AI-powered compliance. Production system integrating with InformData. Key repos: vuplicity-api, vuplicity-hr-portal, vuplicity-employee-portal, informdata-mcp.',
    },
    {
      name: 'AI Leadership Book & Breakfast Club',
      urgency: 'medium',
      owner: 'James Brady',
      workspace: 'my_team',
      description: 'AI-native leadership book project and executive collaboration program (Breakfast Club). Focus on AI transformation for business leaders. NEEDS NEW Motion project and GitHub repo.',
    },
    {
      name: 'X Data Lead Strategy',
      urgency: 'medium',
      owner: 'James Brady',
      workspace: 'my_team',
      description: 'X/Twitter data mining and lead generation strategy. Leveraging social data for business development. Key repos: ai-lead-gen-pro, lead-scoring-agent, social-media-agent. NEEDS NEW Motion project.',
    },
    {
      name: 'IT Infrastructure & Podcast Studio',
      urgency: 'low',
      owner: 'James Brady',
      workspace: 'my_team',
      description: 'Server infrastructure and podcast studio setup. Supporting infrastructure for all priorities. Key repos: audio-pipeline, coolify. NEEDS NEW Motion project.',
    },
  ];

  for (const priority of execPriorities) {
    const text = `Executive Priority: ${priority.name}. Owner: ${priority.owner}. Urgency: ${priority.urgency.toUpperCase()}. Workspace: ${priority.workspace}. ${priority.description}`;
    await addMemory(text, PROJECT_USER_ID, {
      type: 'exec_priority',
      name: priority.name,
      urgency: priority.urgency,
      owner: priority.owner,
      workspace: priority.workspace,
    });
  }
  console.log(`  Added ${execPriorities.length} executive priority memories`);

  console.log('[SeedMemory] Done! Memory system seeded with project context.');
}

// Run if executed directly
seedProjectMemory().catch(console.error);
