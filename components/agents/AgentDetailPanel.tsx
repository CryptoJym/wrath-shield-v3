"use client";

import React, { useEffect, useState } from 'react';
import { X, Activity, Clock, AlertCircle, CheckCircle, Zap, TrendingUp, BookOpen, Shield, GitBranch, Layers, Terminal, Users, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';

// Life OS Agent types from config API
interface LifeOSAgent {
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

interface LifeOSDomain {
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

interface ProjectMapping {
  id: string;
  domains: string[];
  motion_workspace_id: string;
  motion_projects: string[];
  github_repos: string[];
  direction: string;
  auto_create_issue: boolean;
  auto_create_task: boolean;
  sync_status: boolean;
  sync_labels: boolean;
  sensitivity_level?: string;
}

interface LifeOSConfig {
  charter: {
    escalation_levels: {
      CRITICAL: { description: string; triggers: string[] };
      PROPOSE: { description: string; triggers: string[] };
      AUTO_EXECUTE: { description: string; triggers: string[] };
    };
  };
  domains: { domains: LifeOSDomain[] };
  agents: { agents: LifeOSAgent[] };
  mappings: { project_mappings: ProjectMapping[] };
}

export interface AgentDetailPanelProps {
  agent: {
    id: string;
    name: string;
    type: string;
    status: 'green' | 'yellow' | 'red';
    lastSeen: string;
    hp: number;
    mp: number;
    openItems: number;
    capabilities?: string[];
    link?: string;
  };
  onClose: () => void;
}

// Map graph agent IDs to Life OS agent IDs
const graphIdToLifeOsId: Record<string, string> = {
  'inbox': 'agent.comms',
  'finance': 'agent.finance',
  'pm': 'agent.pm',
  'legal': 'agent.legal',
  'grok': 'agent.grok',
  'comms': 'agent.comms',
  'health': 'agent.hyro', // Health routes through hyro for now
  'hyro': 'agent.hyro',
  'orchestrator': 'agent.orchestrator',
  'utlyze': 'agent.utlyze',
  'vuplicity': 'agent.vuplicity',
  'solutionstream': 'agent.solutionstream',
  'kahoa': 'agent.kahoa',
  'family': 'agent.family',
  'hiro': 'agent.hiro',
};

export const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({ agent, onClose }) => {
  const [lifeOsConfig, setLifeOsConfig] = useState<LifeOSConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['domains', 'tools']));

  // Fetch Life OS config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setLifeOsConfig(data);
        }
      } catch (e) {
        console.error('Failed to load Life OS config:', e);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, []);

  // Get Life OS agent data
  const lifeOsAgentId = graphIdToLifeOsId[agent.id] || `agent.${agent.id}`;
  const lifeOsAgent = lifeOsConfig?.agents?.agents?.find(a => a.id === lifeOsAgentId);

  // Get domains this agent handles
  const agentDomains = lifeOsAgent?.domains.includes('*')
    ? lifeOsConfig?.domains?.domains || []
    : lifeOsConfig?.domains?.domains?.filter(d => lifeOsAgent?.domains.includes(d.id)) || [];

  // Get mappings for agent's domains
  const relevantMappings = lifeOsConfig?.mappings?.project_mappings?.filter(
    m => m.domains.some(d => lifeOsAgent?.domains.includes('*') || lifeOsAgent?.domains.includes(d))
  ) || [];

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const getStatusInfo = () => {
    switch (agent.status) {
      case 'green':
        return {
          label: 'Healthy',
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          border: 'border-green-500/30',
          icon: CheckCircle,
        };
      case 'yellow':
        return {
          label: 'Warning',
          color: 'text-yellow-500',
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          icon: AlertCircle,
        };
      case 'red':
        return {
          label: 'Critical',
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          icon: AlertCircle,
        };
      default:
        return {
          label: 'Unknown',
          color: 'text-gray-500',
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/30',
          icon: Activity,
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const getHealthLevel = (value: number) => {
    if (value >= 80) return 'Excellent';
    if (value >= 60) return 'Good';
    if (value >= 40) return 'Fair';
    if (value >= 20) return 'Poor';
    return 'Critical';
  };

  const getBarColor = (value: number, type: 'hp' | 'mp') => {
    if (type === 'hp') {
      if (value >= 80) return 'bg-green-500';
      if (value >= 50) return 'bg-yellow-500';
      return 'bg-red-500';
    }
    // MP bars
    if (value >= 80) return 'bg-blue-500';
    if (value >= 50) return 'bg-blue-400';
    return 'bg-blue-300';
  };

  const timeSinceLastSeen = () => {
    const now = new Date();
    const lastSeen = new Date(agent.lastSeen);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  return (
    <>
      {/* Backdrop overlay to prevent seeing through */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel with solid background */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto z-50 animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Agent Details</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          aria-label="Close panel"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Agent Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-foreground">{agent.name}</h3>
            <div className={`p-2 rounded-full ${statusInfo.bg}`}>
              <StatusIcon size={20} className={statusInfo.color} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Type:</span>
            <span className="text-sm font-medium text-foreground capitalize">{agent.type}</span>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`border ${statusInfo.border} ${statusInfo.bg} rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={16} className={statusInfo.color} />
            <span className={`text-sm font-bold ${statusInfo.color}`}>
              Status: {statusInfo.label}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {agent.status === 'green' && 'All systems operational'}
            {agent.status === 'yellow' && 'Performance degradation detected'}
            {agent.status === 'red' && 'Critical issues detected - immediate attention required'}
          </div>
        </div>

        {/* Health Metrics */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Health Metrics
          </h4>

          {/* HP Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-red-500" />
                <span className="text-xs text-muted-foreground">Health Points (HP)</span>
              </div>
              <span className="text-sm font-bold text-foreground">{agent.hp}%</span>
            </div>
            <div className="w-full h-3 bg-secondary/30 rounded-full overflow-hidden">
              <div
                className={`h-full ${getBarColor(agent.hp, 'hp')} transition-all duration-500 rounded-full`}
                style={{ width: `${agent.hp}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Level: {getHealthLevel(agent.hp)}
            </div>
          </div>

          {/* MP Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-blue-500" />
                <span className="text-xs text-muted-foreground">Processing Power (MP)</span>
              </div>
              <span className="text-sm font-bold text-foreground">{agent.mp}%</span>
            </div>
            <div className="w-full h-3 bg-secondary/30 rounded-full overflow-hidden">
              <div
                className={`h-full ${getBarColor(agent.mp, 'mp')} transition-all duration-500 rounded-full`}
                style={{ width: `${agent.mp}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Level: {getHealthLevel(agent.mp)}
            </div>
          </div>
        </div>

        {/* Activity Metrics */}
        <div className="space-y-3 p-4 bg-secondary/20 rounded-lg border border-border">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Activity
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Open Items</div>
              <div className="text-2xl font-bold text-primary">{agent.openItems}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Last Seen</div>
              <div className="text-sm font-semibold text-foreground">{timeSinceLastSeen()}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(agent.lastSeen).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Capabilities */}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Capabilities
            </h4>
            <div className="space-y-2">
              {agent.capabilities.map((capability, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-secondary/20 rounded-lg border border-border"
                >
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                  <span className="text-xs text-foreground">{capability}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Indicators */}
        <div className="space-y-3 p-4 bg-secondary/20 rounded-lg border border-border">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Performance
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Uptime</span>
              <span className="text-sm font-semibold text-green-500">
                {agent.status === 'red' ? '< 50%' : agent.status === 'yellow' ? '~75%' : '99.9%'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Response Time</span>
              <span className="text-sm font-semibold text-foreground">
                {agent.status === 'red' ? '> 5s' : agent.status === 'yellow' ? '~2s' : '< 500ms'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Success Rate</span>
              <span className="text-sm font-semibold text-foreground">
                {agent.hp}%
              </span>
            </div>
          </div>
        </div>

        {/* Life OS Deep Dive - Only show if we have config data */}
        {!loadingConfig && lifeOsAgent && (
          <>
            {/* Divider */}
            <div className="border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Life OS Configuration</h3>
              </div>
            </div>

            {/* Agent Role & Type */}
            <div className="space-y-3 p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Role</span>
                <span className="text-sm font-semibold text-foreground">{lifeOsAgent.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Agent Type</span>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium capitalize">
                  {lifeOsAgent.type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Max Context Tasks</span>
                <span className="text-sm font-semibold text-foreground">{lifeOsAgent.max_context_tasks}</span>
              </div>
            </div>

            {/* System Prompt (collapsible) */}
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('prompt')}
                className="w-full flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground">System Prompt</span>
                </div>
                {expandedSections.has('prompt') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.has('prompt') && (
                <div className="p-3 bg-slate-950/50 rounded-lg border border-border max-h-[300px] overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {lifeOsAgent.system_prompt}
                  </pre>
                </div>
              )}
            </div>

            {/* Domains (collapsible) */}
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('domains')}
                className="w-full flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-purple-500" />
                  <span className="text-sm font-semibold text-foreground">
                    Domains ({lifeOsAgent.domains.includes('*') ? 'All' : agentDomains.length})
                  </span>
                </div>
                {expandedSections.has('domains') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.has('domains') && (
                <div className="space-y-2 p-2">
                  {lifeOsAgent.domains.includes('*') ? (
                    <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <Layers size={14} className="text-purple-500" />
                      <span className="text-xs text-foreground font-medium">Global Access (All Domains)</span>
                    </div>
                  ) : null}
                  {agentDomains.map((domain) => (
                    <div key={domain.id} className="p-3 bg-secondary/10 rounded-lg border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{domain.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          domain.type === 'company' ? 'bg-blue-500/20 text-blue-400' :
                          domain.type === 'venture' ? 'bg-green-500/20 text-green-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>{domain.type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{domain.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users size={12} />
                        {domain.key_people.slice(0, 3).join(', ')}
                        {domain.key_people.length > 3 && ` +${domain.key_people.length - 3} more`}
                      </div>
                      {domain.sensitivity_level && (
                        <div className="flex items-center gap-1">
                          <Shield size={12} className="text-red-500" />
                          <span className="text-xs text-red-400 font-medium">{domain.sensitivity_level}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tools (collapsible) */}
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('tools')}
                className="w-full flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-green-500" />
                  <span className="text-sm font-semibold text-foreground">
                    Tools ({lifeOsAgent.tools.length})
                  </span>
                </div>
                {expandedSections.has('tools') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.has('tools') && (
                <div className="flex flex-wrap gap-2 p-2">
                  {lifeOsAgent.tools.map((tool, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 font-mono"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Project Mappings (collapsible) */}
            {relevantMappings.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => toggleSection('mappings')}
                  className="w-full flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} className="text-cyan-500" />
                    <span className="text-sm font-semibold text-foreground">
                      Project Mappings ({relevantMappings.length})
                    </span>
                  </div>
                  {expandedSections.has('mappings') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSections.has('mappings') && (
                  <div className="space-y-3 p-2">
                    {relevantMappings.map((mapping) => (
                      <div key={mapping.id} className="p-3 bg-secondary/10 rounded-lg border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">{mapping.id}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            mapping.direction === 'bidirectional' ? 'bg-primary/20 text-primary' :
                            mapping.direction === 'motion_only' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>{mapping.direction}</span>
                        </div>
                        {mapping.motion_projects.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            <span className="text-orange-400">Motion:</span> {mapping.motion_projects.join(', ')}
                          </div>
                        )}
                        {mapping.github_repos.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            <span className="text-purple-400">GitHub:</span> {mapping.github_repos.join(', ')}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {mapping.auto_create_task && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">auto-task</span>
                          )}
                          {mapping.auto_create_issue && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">auto-issue</span>
                          )}
                          {mapping.sync_status && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">sync-status</span>
                          )}
                          {mapping.sensitivity_level && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">{mapping.sensitivity_level}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Escalation Rules */}
            {lifeOsConfig?.charter?.escalation_levels && (
              <div className="space-y-2">
                <button
                  onClick={() => toggleSection('escalation')}
                  className="w-full flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="text-yellow-500" />
                    <span className="text-sm font-semibold text-foreground">Escalation Rules</span>
                  </div>
                  {expandedSections.has('escalation') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSections.has('escalation') && (
                  <div className="space-y-2 p-2">
                    {/* CRITICAL */}
                    <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-bold text-red-400">CRITICAL</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lifeOsConfig.charter.escalation_levels.CRITICAL.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {lifeOsConfig.charter.escalation_levels.CRITICAL.triggers.slice(0, 3).map((t, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">{t}</span>
                        ))}
                      </div>
                    </div>
                    {/* PROPOSE */}
                    <div className="p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-sm font-bold text-yellow-400">PROPOSE</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lifeOsConfig.charter.escalation_levels.PROPOSE.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {lifeOsConfig.charter.escalation_levels.PROPOSE.triggers.slice(0, 3).map((t, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-300">{t}</span>
                        ))}
                      </div>
                    </div>
                    {/* AUTO_EXECUTE */}
                    <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/20 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-bold text-green-400">AUTO_EXECUTE</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lifeOsConfig.charter.escalation_levels.AUTO_EXECUTE.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {lifeOsConfig.charter.escalation_levels.AUTO_EXECUTE.triggers.slice(0, 3).map((t, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-300">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Loading state for Life OS config */}
        {loadingConfig && (
          <div className="p-4 bg-secondary/20 rounded-lg border border-border animate-pulse">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield size={14} />
              <span className="text-xs">Loading Life OS configuration...</span>
            </div>
          </div>
        )}

        {/* Actions */}
        {(agent.link || lifeOsAgent?.link) && (
          <div className="pt-4 border-t border-border space-y-2">
            {agent.link && (
              <Link
                href={agent.link}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-semibold"
              >
                <TrendingUp size={16} />
                View Agent Dashboard
              </Link>
            )}
            {lifeOsAgent?.status_endpoint && (
              <a
                href={lifeOsAgent.status_endpoint}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-all text-sm"
              >
                <ExternalLink size={14} />
                Status API Endpoint
              </a>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default AgentDetailPanel;
