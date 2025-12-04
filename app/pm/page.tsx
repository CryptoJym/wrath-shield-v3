'use client';

/**
 * PM Agent Dashboard
 *
 * Dedicated page for PM agent with:
 * - Projects list with status indicators
 * - Tasks breakdown (pending/in-progress/done)
 * - Recent activity feed
 * - Routing accept/reject/complete actions
 * - Repository organization with AI suggestions
 */

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  FolderKanban,
  ListTodo,
  Activity,
  ChevronRight,
  Check,
  X,
  PlayCircle,
  XCircle,
  ExternalLink,
  Github,
  GitBranch,
  Loader2,
  Sparkles,
  RefreshCw,
  Calendar,
  GitCommit,
  TrendingUp,
  AlertTriangle,
  Zap,
  Search,
  SortAsc,
  Archive
} from 'lucide-react';
import { PMChat } from '@/components/ui/agent-chat-widget';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PMStatus {
  ok: boolean;
  agent: string;
  status: 'green' | 'yellow' | 'red';
  health_score: number;
  pending: number;
  total_routed: number;
  resolved: number;
  recent_items: Array<{
    id: string;
    status: string;
    created_at: number;
    event_subject?: string;
    channel?: string;
  }>;
}

interface UnifiedTask {
  id: string;
  source: 'github' | 'local';
  source_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'failed' | 'backlog';
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  created_at: string;
  updated_at: string;
  due_date: string | null;
  url: string | null;
  project_id: string | null;
  project_name: string | null;
  assignee: string | null;
  labels: string[];
  metadata: Record<string, any>;
}

interface PMDashboardData {
  ok: boolean;
  tasks: {
    total: number;
    pending: number;
    in_progress: number;
    done: number;
    backlog: number;
    failed: number;
    by_priority: Record<string, number>;
    by_project: Record<string, number>;
    by_source: Record<string, number>;
  };
  projects: {
    total: number;
    active: number;
    closed: number;
    by_source: Record<string, number>;
  };
  recent_tasks: UnifiedTask[];
  integrations: {
    github: { configured: boolean; error?: string };
  };
}

interface ContextRequest {
  id: string;
  created_at: number;
  updated_at: number;
  event_id: string;
  event_payload: {
    channel: string;
    subject?: string;
    preview?: string;
    contact?: string;
    source?: string;
    ts?: number;
  };
  target: string;
  status: 'pending' | 'processing' | 'dispatched' | 'done' | 'failed';
  resolution_summary?: string;
  follow_up_questions?: string[];
}

interface RepoSuggestion {
  repo: {
    name: string;
    full_name: string;
    description?: string;
    language?: string;
    updated_at?: string;
  };
  suggestions: Array<{
    projectTitle: string;
    projectId?: string;
    confidence: number;
    rationale: string;
    source: string;
  }>;
  autoAssignable: boolean;
}

interface OrganizationStatus {
  totalRepos: number;
  unmappedRepos: number;
  mappedRepos: number;
  enabledRepos: number;
  projectCount: number;
  lastUpdated: string;
}

interface TemporalContext {
  current_timestamp: number;
  current_date: string;
  current_time: string;
  day_of_week: string;
  week_of_year: number;
  quarter: number;
  fiscal_year: number;
  time_zone: string;
  business_hours: boolean;
}

interface TimeElapsed {
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  weeks: number;
  months: number;
  human_readable: string;
  is_stale: boolean;
  staleness_level: 'fresh' | 'aging' | 'stale' | 'very_stale' | 'ancient';
}

interface TemporalSummary {
  ok: boolean;
  context: TemporalContext;
  last_sync: TimeElapsed | null;
  last_commit_analysis: TimeElapsed | null;
  stale_items: {
    syncs: number;
    analyses: number;
  };
  grounding_statement: string;
  timestamp: string;
}

interface CommitAnalysis {
  id: string;
  repo_full_name: string;
  commit_sha: string;
  commit_message: string;
  author: string;
  authored_at: string;
  category: string;
  impact_level: string;
  bullet_statement: string;
  related_issues: string[];
  ambiguities: string[];
}

interface ProgressReport {
  period: { start: string; end: string };
  summary: {
    total_commits: number;
    by_category: Record<string, number>;
    by_impact: Record<string, number>;
    ambiguities_count: number;
  };
  bullet_statements: string[];
  top_contributors: { author: string; commits: number }[];
  needs_attention: string[];
}

const STATUS_CONFIG = {
  green: {
    label: 'Healthy',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: CheckCircle,
  },
  yellow: {
    label: 'Attention',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: Clock,
  },
  red: {
    label: 'Critical',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    icon: AlertCircle,
  },
};

function formatRelativeTime(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function Toast({ message, type, onClose }: {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-emerald-600 border-emerald-500',
    error: 'bg-rose-600 border-rose-500',
    info: 'bg-sky-600 border-sky-500',
  };

  return (
    <div className={`fixed bottom-20 right-4 z-50 px-4 py-2 rounded-lg border ${colors[type]} text-white text-sm shadow-lg animate-slide-up`}>
      {message}
    </div>
  );
}

export default function PMPage() {
  const { data: statusData, error: statusError, mutate: mutateStatus } = useSWR('/api/pm/status', fetcher, {
    refreshInterval: 10000
  });
  const { data: requestsData, error: requestsError, mutate: mutateRequests } = useSWR('/api/pm/requests', fetcher, {
    refreshInterval: 10000
  });
  const { data: dashboardData, error: dashboardError, mutate: mutateDashboard } = useSWR('/api/pm/dashboard', fetcher, {
    refreshInterval: 30000
  });

  // Repo organization data
  const { data: repoSuggestionsData, mutate: mutateSuggestions } = useSWR('/api/pm/repos?action=suggestions&limit=20', fetcher, {
    refreshInterval: 60000
  });
  const { data: repoStatusData, mutate: mutateRepoStatus } = useSWR('/api/pm/repos?action=status', fetcher, {
    refreshInterval: 60000
  });

  // Temporal and commit intelligence data
  const { data: temporalData, mutate: mutateTemporal } = useSWR<TemporalSummary>('/api/pm/temporal', fetcher, {
    refreshInterval: 30000
  });
  const { data: progressData, mutate: mutateProgress } = useSWR('/api/pm/commits?action=report', fetcher, {
    refreshInterval: 60000
  });
  const { data: recentCommitsData } = useSWR('/api/pm/commits?action=recent&limit=10', fetcher, {
    refreshInterval: 60000
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'priority' | 'due'>('updated');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'repos' | 'progress'>('tasks');
  const [autoOrganizing, setAutoOrganizing] = useState(false);
  const [applyingRepo, setApplyingRepo] = useState<string | null>(null);
  const [analyzingCommits, setAnalyzingCommits] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  const handleAction = async (id: string, action: 'accept' | 'reject' | 'complete', resolution?: string) => {
    setActioningId(id);
    try {
      const res = await fetch('/api/pm/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action, resolution }),
      });

      const data = await res.json();

      if (data.ok) {
        showToast(`Action ${action} completed`, 'success');
        mutateRequests();
        mutateStatus();
      } else {
        showToast(data.error || 'Action failed', 'error');
      }
    } catch (error) {
      showToast('Failed to perform action', 'error');
    } finally {
      setActioningId(null);
    }
  };

  // Repo organization handlers
  const handleAutoOrganize = async () => {
    setAutoOrganizing(true);
    try {
      const res = await fetch('/api/pm/repos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'auto-organize' }),
      });
      const data = await res.json();
      if (data.result) {
        showToast(`Auto-organized ${data.result.applied} repos`, 'success');
        mutateSuggestions();
        mutateRepoStatus();
      }
    } catch (error) {
      showToast('Failed to auto-organize', 'error');
    } finally {
      setAutoOrganizing(false);
    }
  };

  const handleApplySuggestion = async (repoFullName: string, projectTitle: string, projectId?: string) => {
    setApplyingRepo(repoFullName);
    try {
      const res = await fetch('/api/pm/repos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'set-mapping',
          repoFullName,
          projectId,
          projectName: projectTitle,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Mapped ${repoFullName} to ${projectTitle}`, 'success');
        mutateSuggestions();
        mutateRepoStatus();
      }
    } catch (error) {
      showToast('Failed to apply mapping', 'error');
    } finally {
      setApplyingRepo(null);
    }
  };

  // Commit analysis handler
  const handleAnalyzeCommits = async () => {
    setAnalyzingCommits(true);
    try {
      const res = await fetch('/api/pm/commits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Analyzed ${data.result?.analyzed || 0} commits`, 'success');
        mutateProgress();
        mutateTemporal();
      } else {
        showToast(data.error || 'Analysis failed', 'error');
      }
    } catch (error) {
      showToast('Failed to analyze commits', 'error');
    } finally {
      setAnalyzingCommits(false);
    }
  };

  const pmStatus = statusData as PMStatus | undefined;
  const requests = (requestsData?.requests || []) as ContextRequest[];
  const dashboard = dashboardData as PMDashboardData | undefined;
  const repoSuggestions = (repoSuggestionsData?.suggestions || []) as RepoSuggestion[];
  const repoStatus = repoStatusData?.status as OrganizationStatus | undefined;
  const temporal = temporalData as TemporalSummary | undefined;
  const progressReport = progressData?.ok ? progressData.report as ProgressReport : undefined;
  const recentCommits = (recentCommitsData?.analyses || []) as CommitAnalysis[];

  // Combine local context requests with unified tasks from integrations
  const allTasks = dashboard?.recent_tasks || [];
  const localRequests = requests;

  // Use dashboard stats if available, otherwise fall back to local requests
  const tasksByStatus = dashboard ? {
    pending: dashboard.tasks.pending,
    processing: dashboard.tasks.in_progress,
    done: dashboard.tasks.done,
    failed: dashboard.tasks.failed,
    backlog: dashboard.tasks.backlog,
  } : {
    pending: requests.filter(r => r.status === 'pending').length,
    processing: requests.filter(r => r.status === 'processing').length,
    done: requests.filter(r => r.status === 'done').length,
    failed: requests.filter(r => r.status === 'failed').length,
    backlog: 0,
  };

  const projectsCount = dashboard?.projects.total || 0;

  // Filter unified tasks - "All" shows only ACTIVE tasks, not done
  const activeTasks = allTasks.filter(task => task.status !== 'done' && task.status !== 'failed');
  const archivedTasks = allTasks.filter(task => task.status === 'done');

  // Priority order for sorting
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

  // Helper to check if task is overdue or due soon
  const getDueStatus = (task: UnifiedTask): 'overdue' | 'due_soon' | 'normal' => {
    if (!task.due_date) return 'normal';
    const due = new Date(task.due_date);
    const now = new Date();
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 3) return 'due_soon';
    return 'normal';
  };

  // Filter by status, then search, then sort
  const filteredTasks = allTasks
    .filter(task => {
      // Status filter
      if (filter === 'all' && (task.status === 'done' || task.status === 'failed')) return false;
      if (filter === 'pending' && task.status !== 'pending' && task.status !== 'backlog') return false;
      if (filter === 'processing' && task.status !== 'in_progress') return false;
      if (filter === 'done' && task.status !== 'done') return false;
      return true;
    })
    .filter(task => {
      // Search filter
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.labels.some(l => l.toLowerCase().includes(query)) ||
        task.project_name?.toLowerCase().includes(query) ||
        task.assignee?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      // Sort logic
      switch (sortBy) {
        case 'priority':
          return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
        case 'due':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

  // Count tasks by urgency for quick stats
  const urgentCount = activeTasks.filter(t => getDueStatus(t) === 'overdue' || getDueStatus(t) === 'due_soon').length;

  const config = pmStatus ? STATUS_CONFIG[pmStatus.status] : STATUS_CONFIG.green;
  const StatusIcon = config.icon;
  const showDebug = false; // Hide debug panel in production

  // Show loading state
  if (!dashboardData && !dashboardError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-slate-400 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-lg">Loading PM Dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (dashboardError || statusError || requestsError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle size={64} className="mx-auto text-rose-400" />
          <h2 className="text-2xl font-bold text-rose-400">Failed to Load Dashboard</h2>
          <p className="text-slate-400">
            {dashboardError?.message || statusError?.message || requestsError?.message || 'Unknown error occurred'}
          </p>
          <button
            onClick={() => {
              mutateDashboard();
              mutateStatus();
              mutateRequests();
            }}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <header className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">PM Agent</p>
              <h1 className="text-3xl font-semibold">Project Management Dashboard</h1>
              <p className="text-slate-300 mt-1">
                Manage routed items, track project status, and coordinate tasks
              </p>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition ${
                    activeTab === 'tasks'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <ListTodo size={16} />
                  Tasks
                </button>
                <button
                  onClick={() => setActiveTab('repos')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition ${
                    activeTab === 'repos'
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-900/30 text-purple-300 border border-purple-500/30 hover:bg-purple-900/50'
                  }`}
                >
                  <GitBranch size={16} />
                  Repo Organization
                  {repoStatus && repoStatus.unmappedRepos > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-purple-500 text-white">
                      {repoStatus.unmappedRepos}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('progress')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition ${
                    activeTab === 'progress'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-900/30 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/50'
                  }`}
                >
                  <TrendingUp size={16} />
                  Progress
                  {temporal?.stale_items && (temporal.stale_items.syncs > 0 || temporal.stale_items.analyses > 0) && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-amber-500 text-white">
                      !
                    </span>
                  )}
                </button>
                <a
                  href="/pm/github"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  <Github size={16} />
                  GitHub Projects
                </a>
              </div>
            </div>
            {pmStatus && (
              <div className={`rounded-xl border ${config.border} ${config.bg} px-6 py-4`}>
                <div className="flex items-center gap-3">
                  <StatusIcon size={32} className={config.text} />
                  <div>
                    <div className="text-2xl font-bold text-slate-100">{pmStatus.health_score}%</div>
                    <div className={`text-sm ${config.text}`}>{config.label}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {showDebug && (
          <div className="text-xs bg-slate-800 rounded p-3 mb-2 space-y-1 border border-slate-700">
            <div className="text-slate-400 font-semibold">Debug: PM data (GitHub-native)</div>
            <div className="text-slate-500">
              Total tasks: {dashboard?.tasks.total ?? 0} | Pending: {tasksByStatus.pending} | In Progress: {tasksByStatus.processing} | Done: {tasksByStatus.done} | Failed: {tasksByStatus.failed}
            </div>
            <div className="text-slate-500">
              Projects: {projectsCount} | Health: {pmStatus?.health_score ?? '-'} | Status: {pmStatus?.status ?? '-'}
            </div>
            <div className="text-slate-500">
              Sources → GitHub: {dashboard?.tasks.by_source?.github ?? 0} | Local: {dashboard?.tasks.by_source?.local ?? 0}
            </div>
            <div className="text-slate-500">
              Integration → GitHub: {dashboard?.integrations.github.configured ? '✓ Connected' : '✗ Not configured'}
            </div>
          </div>
        )}

        {/* Tasks Tab Content */}
        {activeTab === 'tasks' && (
          <>
        {/* Search and Filter Bar */}
        <section className="space-y-4">
          {/* Search and Sort Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search tasks by title, description, labels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <SortAsc size={16} className="text-slate-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-slate-500"
              >
                <option value="updated">Recently Updated</option>
                <option value="created">Recently Created</option>
                <option value="priority">Priority</option>
                <option value="due">Due Date</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => mutateDashboard()}
              className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition flex items-center gap-2"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Quick Stats Strip */}
          <div className="flex items-center gap-6 px-4 py-3 bg-slate-800/30 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-sm text-slate-400">
                <span className="font-semibold text-slate-200">{tasksByStatus.processing}</span> In Progress
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-sm text-slate-400">
                <span className="font-semibold text-slate-200">{tasksByStatus.pending}</span> Pending
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-slate-400">
                <span className="font-semibold text-slate-200">{tasksByStatus.done}</span> Done
              </span>
            </div>
            {urgentCount > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <AlertTriangle size={14} className="text-rose-400" />
                <span className="text-sm text-rose-400 font-medium">
                  {urgentCount} due soon
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-3">
          {[
            { key: 'all', label: 'Active', count: activeTasks.length, color: 'bg-blue-500' },
            { key: 'pending', label: 'Pending', count: tasksByStatus.pending + tasksByStatus.backlog, color: 'bg-amber-500' },
            { key: 'processing', label: 'In Progress', count: tasksByStatus.processing, color: 'bg-sky-500' },
            { key: 'done', label: 'Archived', count: archivedTasks.length, color: 'bg-slate-500' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                filter === tab.key
                  ? 'bg-slate-700 text-slate-100 border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.key === 'done' && <Archive size={14} />}
              {tab.label}
              <span className={`px-1.5 py-0.5 text-xs rounded ${
                filter === tab.key ? tab.color + ' text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Projects/Tasks List */}
        <section className="space-y-4">
          {filter === 'done' && (
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 px-4 py-3 mb-4">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle size={18} className="text-emerald-400" />
                <span className="font-medium">Archived Tasks</span>
                <span className="text-slate-500 text-sm">- Completed items from GitHub and local sources</span>
              </div>
            </div>
          )}
          {filteredTasks.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <ListTodo size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 text-lg">
                {filter === 'done' ? 'No archived tasks yet' : 'No items to display'}
              </p>
              <p className="text-slate-500 text-sm mt-2">
                {filter === 'all'
                  ? dashboard?.integrations.github.configured
                    ? 'No active tasks found. Create issues in your enabled repositories.'
                    : 'No tasks yet. Configure GitHub integration in .env.local'
                  : filter === 'done'
                    ? 'Completed tasks will appear here with their project relations.'
                    : `No items with status "${filter}"`
                }
              </p>
              {!dashboard?.integrations.github.configured && filter !== 'done' && (
                <div className="mt-4 text-xs text-slate-600 space-y-1">
                  <p>Add to .env.local:</p>
                  <p>GITHUB_ACCESS_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTasks.map(task => (
                <UnifiedTaskCard
                  key={task.id}
                  task={task}
                  onAction={handleAction}
                  isActioning={actioningId === task.id}
                  onRefresh={mutateDashboard}
                  showProjectRelation={filter === 'done'}
                />
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity Feed */}
        {pmStatus?.recent_items && pmStatus.recent_items.length > 0 && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-slate-400" />
              <h2 className="text-lg font-semibold">Recent Activity</h2>
            </div>
            <div className="space-y-2">
              {pmStatus.recent_items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                      item.status === 'done' ? 'bg-emerald-900/50 text-emerald-300' :
                      item.status === 'pending' ? 'bg-amber-900/50 text-amber-300' :
                      item.status === 'processing' ? 'bg-blue-900/50 text-blue-300' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {item.status}
                    </span>
                    <span className="text-slate-300 truncate">
                      {item.event_subject || item.channel || 'Item'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0 ml-4">
                    {formatRelativeTime(item.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
          </>
        )}

        {/* Repos Tab Content */}
        {activeTab === 'repos' && (
          <section className="space-y-6">
            {/* Repo Stats */}
            {repoStatus && (
              <div className="grid md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800/50 text-purple-400">
                      <Github size={24} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-100">{repoStatus.totalRepos}</div>
                      <div className="text-sm text-slate-400">Total Repos</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800/50 text-amber-400">
                      <GitBranch size={24} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-100">{repoStatus.unmappedRepos}</div>
                      <div className="text-sm text-slate-400">Unmapped</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800/50 text-emerald-400">
                      <CheckCircle size={24} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-100">{repoStatus.mappedRepos}</div>
                      <div className="text-sm text-slate-400">Mapped</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800/50 text-sky-400">
                      <FolderKanban size={24} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-100">{repoStatus.projectCount}</div>
                      <div className="text-sm text-slate-400">Projects</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-organize Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleAutoOrganize}
                disabled={autoOrganizing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition disabled:opacity-50 font-medium"
              >
                {autoOrganizing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {autoOrganizing ? 'Auto-organizing...' : 'Auto-organize High Confidence'}
              </button>
              <button
                onClick={() => {
                  mutateSuggestions();
                  mutateRepoStatus();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition font-medium"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              {repoSuggestions.filter(s => s.autoAssignable).length > 0 && (
                <span className="text-sm text-emerald-400">
                  {repoSuggestions.filter(s => s.autoAssignable).length} repos ready for auto-assignment
                </span>
              )}
            </div>

            {/* Suggestions List */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Organization Suggestions</h2>
              {repoSuggestions.length === 0 ? (
                <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-12 text-center">
                  <GitBranch size={48} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 text-lg">No unmapped repositories</p>
                  <p className="text-slate-500 text-sm mt-2">
                    All your repositories have been organized into projects
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {repoSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.repo.full_name}
                      className={`rounded-xl border p-4 ${
                        suggestion.autoAssignable
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-slate-700 bg-slate-800/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Github size={16} className="text-slate-400" />
                            <span className="font-medium text-slate-100">{suggestion.repo.name}</span>
                            {suggestion.repo.language && (
                              <span className="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300">
                                {suggestion.repo.language}
                              </span>
                            )}
                            {suggestion.autoAssignable && (
                              <span className="px-2 py-0.5 text-xs rounded bg-emerald-900/50 text-emerald-300">
                                Auto-assignable
                              </span>
                            )}
                          </div>
                          {suggestion.repo.description && (
                            <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                              {suggestion.repo.description}
                            </p>
                          )}

                          {/* Suggestions */}
                          <div className="space-y-2">
                            {suggestion.suggestions.slice(0, 3).map((sug, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/50"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="text-sm">
                                    <span className="font-medium text-slate-200">{sug.projectTitle}</span>
                                    <span className="text-slate-500 ml-2">
                                      ({Math.round(sug.confidence * 100)}% confidence)
                                    </span>
                                  </div>
                                  <span className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-400">
                                    {sug.source}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleApplySuggestion(
                                    suggestion.repo.full_name,
                                    sug.projectTitle,
                                    sug.projectId
                                  )}
                                  disabled={applyingRepo === suggestion.repo.full_name}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50"
                                >
                                  {applyingRepo === suggestion.repo.full_name ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                  Apply
                                </button>
                              </div>
                            ))}
                          </div>

                          {suggestion.suggestions.length > 0 && suggestion.suggestions[0].rationale && (
                            <p className="text-xs text-slate-500 mt-2 italic">
                              {suggestion.suggestions[0].rationale}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Progress Tab Content */}
        {activeTab === 'progress' && (
          <section className="space-y-6">
            {/* Temporal Grounding Card */}
            {temporal?.context && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100">Temporal Grounding</h2>
                      <p className="text-sm text-slate-400">Current context awareness</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-400">
                      {temporal.context.current_time}
                    </div>
                    <div className="text-sm text-slate-400">
                      {temporal.context.day_of_week}, {temporal.context.current_date}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 mb-4">
                  <p className="text-sm text-slate-300 italic">
                    {temporal.grounding_statement}
                  </p>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-slate-800/30">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Quarter</div>
                    <div className="text-lg font-semibold text-slate-200">Q{temporal.context.quarter}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/30">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Week</div>
                    <div className="text-lg font-semibold text-slate-200">{temporal.context.week_of_year}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/30">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Business Hours</div>
                    <div className={`text-lg font-semibold ${temporal.context.business_hours ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {temporal.context.business_hours ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/30">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Last Sync</div>
                    <div className={`text-lg font-semibold ${temporal.last_sync?.is_stale ? 'text-amber-400' : 'text-slate-200'}`}>
                      {temporal.last_sync?.human_readable || 'Never'}
                    </div>
                  </div>
                </div>

                {/* Stale Alerts */}
                {(temporal.stale_items.syncs > 0 || temporal.stale_items.analyses > 0) && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-900/20 border border-amber-500/30 flex items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-400" />
                    <span className="text-sm text-amber-300">
                      Attention needed: {temporal.stale_items.syncs} stale syncs, {temporal.stale_items.analyses} stale analyses
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Commit Analysis Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleAnalyzeCommits}
                disabled={analyzingCommits}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50 font-medium"
              >
                {analyzingCommits ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <GitCommit size={16} />
                )}
                {analyzingCommits ? 'Analyzing...' : 'Analyze Recent Commits'}
              </button>
              <button
                onClick={() => {
                  mutateProgress();
                  mutateTemporal();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition font-medium"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            {/* Progress Report */}
            {progressReport && (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800/50 text-sky-400">
                        <GitCommit size={24} />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-slate-100">{progressReport.summary.total_commits}</div>
                        <div className="text-sm text-slate-400">Total Commits</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800/50 text-emerald-400">
                        <Zap size={24} />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-slate-100">{progressReport.summary.by_category?.feature || 0}</div>
                        <div className="text-sm text-slate-400">Features</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800/50 text-amber-400">
                        <CheckCircle size={24} />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-slate-100">{progressReport.summary.by_category?.bugfix || 0}</div>
                        <div className="text-sm text-slate-400">Bug Fixes</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800/50 text-rose-400">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-slate-100">{progressReport.summary.ambiguities_count}</div>
                        <div className="text-sm text-slate-400">Need Review</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bullet Statements */}
                {progressReport.bullet_statements.length > 0 && (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                      <TrendingUp size={20} className="text-emerald-400" />
                      Progress Bullets (Tongue & Quill Style)
                    </h3>
                    <ul className="space-y-3">
                      {progressReport.bullet_statements.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="text-emerald-400 mt-1">•</span>
                          <span className="text-slate-300 text-sm">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Top Contributors */}
                {progressReport.top_contributors.length > 0 && (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">Top Contributors</h3>
                    <div className="space-y-2">
                      {progressReport.top_contributors.map((contributor, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                          <span className="text-slate-200">{contributor.author}</span>
                          <span className="text-slate-400">{contributor.commits} commits</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Needs Attention */}
                {progressReport.needs_attention.length > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
                    <h3 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-2">
                      <AlertTriangle size={20} />
                      Needs PM Review
                    </h3>
                    <ul className="space-y-2">
                      {progressReport.needs_attention.map((item, idx) => (
                        <li key={idx} className="text-sm text-slate-300 p-2 rounded bg-slate-800/30">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Recent Commit Analyses */}
            {recentCommits.length > 0 && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Recent Commit Analysis</h3>
                <div className="space-y-3">
                  {recentCommits.slice(0, 5).map((commit) => (
                    <div
                      key={commit.id}
                      className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                              commit.category === 'feature' ? 'bg-emerald-900/50 text-emerald-300' :
                              commit.category === 'bugfix' ? 'bg-amber-900/50 text-amber-300' :
                              commit.category === 'enhancement' ? 'bg-sky-900/50 text-sky-300' :
                              commit.category === 'refactor' ? 'bg-purple-900/50 text-purple-300' :
                              'bg-slate-700 text-slate-300'
                            }`}>
                              {commit.category}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              commit.impact_level === 'critical' ? 'bg-rose-900/50 text-rose-300' :
                              commit.impact_level === 'high' ? 'bg-orange-900/50 text-orange-300' :
                              commit.impact_level === 'medium' ? 'bg-amber-900/50 text-amber-300' :
                              'bg-slate-700 text-slate-400'
                            }`}>
                              {commit.impact_level}
                            </span>
                            <span className="text-xs text-slate-500">{commit.repo_full_name}</span>
                          </div>
                          <p className="text-sm text-slate-200 truncate">{commit.commit_message.split('\n')[0]}</p>
                        </div>
                        <div className="text-xs text-slate-500 flex-shrink-0">
                          {commit.author}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 italic mt-2">{commit.bullet_statement}</p>
                      {commit.ambiguities.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-amber-400">
                          <AlertTriangle size={12} />
                          {commit.ambiguities[0]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!progressReport && recentCommits.length === 0 && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-12 text-center">
                <GitCommit size={48} className="mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-lg">No commit analyses yet</p>
                <p className="text-slate-500 text-sm mt-2">
                  Click "Analyze Recent Commits" to generate progress tracking data
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      {/* PM Chat Widget */}
      <PMChat defaultCollapsed={true} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function UnifiedTaskCard({
  task,
  onAction,
  isActioning,
  onRefresh,
  showProjectRelation,
}: {
  task: UnifiedTask;
  onAction: (id: string, action: 'accept' | 'reject' | 'complete', resolution?: string) => void;
  isActioning: boolean;
  onRefresh?: () => void;
  showProjectRelation?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [resolution, setResolution] = useState('');

  const statusConfig = {
    pending: {
      color: 'text-amber-400',
      bg: 'bg-amber-900/20',
      border: 'border-amber-500/30',
      icon: Clock,
    },
    in_progress: {
      color: 'text-blue-400',
      bg: 'bg-blue-900/20',
      border: 'border-blue-500/30',
      icon: PlayCircle,
    },
    backlog: {
      color: 'text-slate-400',
      bg: 'bg-slate-900/20',
      border: 'border-slate-500/30',
      icon: ListTodo,
    },
    done: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-900/20',
      border: 'border-emerald-500/30',
      icon: CheckCircle,
    },
    failed: {
      color: 'text-rose-400',
      bg: 'bg-rose-900/20',
      border: 'border-rose-500/30',
      icon: XCircle,
    },
  };

  const priorityConfig = {
    urgent: { color: 'text-rose-400', bg: 'bg-rose-900/50' },
    high: { color: 'text-orange-400', bg: 'bg-orange-900/50' },
    medium: { color: 'text-amber-400', bg: 'bg-amber-900/50' },
    low: { color: 'text-slate-400', bg: 'bg-slate-900/50' },
    none: { color: 'text-slate-500', bg: 'bg-slate-800/50' },
  };

  const sourceConfig = {
    github: { label: 'GitHub', color: 'text-purple-400', bg: 'bg-purple-900/50' },
    local: { label: 'Local', color: 'text-slate-400', bg: 'bg-slate-900/50' },
  };

  const config = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const priorityStyle = priorityConfig[task.priority];
  const sourceStyle = sourceConfig[task.source];

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  const handleStatusUpdate = async (newStatus: 'in_progress' | 'done') => {
    setIsUpdating(true);
    try {
      // For completion, pass title and description for LLM summary
      const payload: Record<string, any> = {
        id: task.id,
        status: newStatus,
      };

      // Include task details for intelligent completion
      if (newStatus === 'done') {
        payload.title = task.title;
        payload.description = task.description;
      }

      console.log('[PM Task] Updating task:', payload);

      const res = await fetch('/api/pm/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log('[PM Task] Update response:', { ok: res.ok, data });

      if (res.ok && data.ok) {
        // Show completion summary if available
        const successMsg = data.completion?.summary
          ? `Completed: ${data.completion.summary.slice(0, 50)}...`
          : (newStatus === 'done' ? 'Marked as complete!' : 'Started!');
        setUpdateSuccess(successMsg);

        // Wait a bit then refresh the dashboard data
        setTimeout(async () => {
          console.log('[PM Task] Refreshing dashboard data...');
          await onRefresh?.();
          console.log('[PM Task] Dashboard refresh complete');
          setUpdateSuccess(null);
        }, newStatus === 'done' ? 1500 : 800);
      } else {
        console.error('[PM Task] Update failed:', data.error || 'Unknown error');
        setUpdateSuccess(`Error: ${data.error || 'Update failed'}`);
        setTimeout(() => setUpdateSuccess(null), 3000);
      }
    } catch (error) {
      console.error('[PM Task] Exception during update:', error);
      setUpdateSuccess('Error: Network or server error');
      setTimeout(() => setUpdateSuccess(null), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden transition`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusIcon size={18} className={config.color} />
              <span className={`text-xs font-medium uppercase tracking-wide ${config.color}`}>
                {(task.status || 'pending').replace('_', ' ')}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded ${sourceStyle.bg} ${sourceStyle.color}`}>
                {sourceStyle.label}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded ${priorityStyle.bg} ${priorityStyle.color}`}>
                {task.priority}
              </span>
              {task.project_name && (
                <span className="px-2 py-0.5 text-xs rounded bg-indigo-900/50 text-indigo-300">
                  {task.project_name}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-100 truncate">
              {task.title}
            </h3>
            <div className="flex gap-3 mt-2 text-xs text-slate-400 flex-wrap">
              {task.assignee && <span>Assignee: {task.assignee}</span>}
              {task.due_date && !isNaN(new Date(task.due_date).getTime()) && (() => {
                const due = new Date(task.due_date!);
                const now = new Date();
                const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysUntil < 0;
                const isDueSoon = daysUntil >= 0 && daysUntil <= 3;
                return (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                    isOverdue
                      ? 'bg-rose-900/50 text-rose-300 font-medium'
                      : isDueSoon
                        ? 'bg-amber-900/50 text-amber-300 font-medium'
                        : ''
                  }`}>
                    {isOverdue && <AlertTriangle size={12} />}
                    {isDueSoon && !isOverdue && <Clock size={12} />}
                    {isOverdue
                      ? `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''}`
                      : isDueSoon
                        ? daysUntil === 0
                          ? 'Due today!'
                          : `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`
                        : `Due: ${due.toLocaleDateString()}`
                    }
                  </span>
                );
              })()}
              {task.updated_at && !isNaN(new Date(task.updated_at).getTime()) && (
                <span>Updated: {new Date(task.updated_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {task.url && (
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-slate-700/50 transition"
              >
                <ExternalLink size={18} className="text-slate-400" />
              </a>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg hover:bg-slate-700/50 transition"
            >
              <ChevronRight
                size={20}
                className={`text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Project Relation - shown in archived view */}
        {showProjectRelation && (task.project_name || task.source === 'github') && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/70 border border-slate-700/50">
            <FolderKanban size={16} className="text-indigo-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {task.project_name && (
                  <span className="text-sm text-indigo-300 font-medium">{task.project_name}</span>
                )}
                {task.source === 'github' && task.url && (
                  <a
                    href={task.url.split('/issues')[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
                  >
                    <Github size={12} />
                    {task.id.replace('github-', '').replace(/-\d+$/, '')}
                  </a>
                )}
              </div>
              {task.updated_at && (
                <div className="text-xs text-slate-500 mt-0.5">
                  Completed: {new Date(task.updated_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Description - improved formatting */}
        {task.description && (
          <div className="text-sm text-slate-300">
            <div className="line-clamp-3 leading-relaxed whitespace-pre-line">
              {task.description.split('\n').map((line, i) => (
                <span key={i}>
                  {line.startsWith('- ') || line.startsWith('* ') ? (
                    <span className="flex items-start gap-2">
                      <span className="text-slate-500 mt-1">•</span>
                      <span>{line.slice(2)}</span>
                    </span>
                  ) : line.startsWith('# ') || line.startsWith('## ') ? (
                    <span className="font-semibold text-slate-200">{line.replace(/^#+\s*/, '')}</span>
                  ) : (
                    line
                  )}
                  {i < task.description!.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Labels */}
        {Array.isArray(task.labels) && task.labels.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {task.labels.map((label, i) => (
              <span key={i} className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-400">
                {label || 'unlabeled'}
              </span>
            ))}
          </div>
        )}

        {/* Expanded Details */}
        {expanded && (
          <div className="pt-3 border-t border-slate-700/50 space-y-3">
            {task.description && (
              <div className="text-sm">
                <span className="text-slate-500 text-xs uppercase tracking-wide">Full Description</span>
                <div className="mt-2 p-3 rounded-lg bg-slate-800/50 text-slate-300 text-sm leading-relaxed border border-slate-700/30">
                  {task.description.split('\n').map((line, i) => {
                    if (!line.trim()) return <div key={i} className="h-2" />;
                    if (line.startsWith('# ')) return <h3 key={i} className="text-base font-semibold text-slate-100 mt-3 first:mt-0">{line.slice(2)}</h3>;
                    if (line.startsWith('## ')) return <h4 key={i} className="text-sm font-semibold text-slate-200 mt-2 first:mt-0">{line.slice(3)}</h4>;
                    if (line.startsWith('### ')) return <h5 key={i} className="text-sm font-medium text-slate-300 mt-2 first:mt-0">{line.slice(4)}</h5>;
                    if (line.startsWith('- ') || line.startsWith('* ')) {
                      return (
                        <div key={i} className="flex items-start gap-2 ml-2">
                          <span className="text-slate-500 mt-0.5">•</span>
                          <span>{line.slice(2)}</span>
                        </div>
                      );
                    }
                    if (line.match(/^\d+\.\s/)) {
                      return (
                        <div key={i} className="flex items-start gap-2 ml-2">
                          <span className="text-slate-400 font-mono text-xs">{line.match(/^\d+/)?.[0]}.</span>
                          <span>{line.replace(/^\d+\.\s*/, '')}</span>
                        </div>
                      );
                    }
                    if (line.startsWith('```')) return <div key={i} className="h-1" />;
                    if (line.startsWith('> ')) {
                      return (
                        <div key={i} className="border-l-2 border-slate-600 pl-3 italic text-slate-400">
                          {line.slice(2)}
                        </div>
                      );
                    }
                    return <p key={i} className="my-1">{line}</p>;
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 p-2 rounded bg-slate-800/30">
              <div>
                <span className="text-slate-600">Source ID:</span> {task.source_id}
              </div>
              <div>
                <span className="text-slate-600">Task ID:</span> {task.id}
              </div>
              {task.created_at && !isNaN(new Date(task.created_at).getTime()) && (
                <div>
                  <span className="text-slate-600">Created:</span> {new Date(task.created_at).toLocaleString()}
                </div>
              )}
              {task.source === 'github' && task.url && (
                <div>
                  <span className="text-slate-600">Repo:</span> {task.id.replace('github-', '').replace(/-\d+$/, '')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {task.status !== 'done' && task.source !== 'local' && (
          <div className="flex gap-2 pt-2 border-t border-slate-700/50">
            {updateSuccess ? (
              <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium animate-pulse">
                <CheckCircle size={16} />
                {updateSuccess}
              </div>
            ) : (
              <>
                {task.status === 'pending' && (
                  <button
                    onClick={() => handleStatusUpdate('in_progress')}
                    disabled={isActioning || isUpdating}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <div className="w-4 h-4 border-2 border-blue-300 border-t-white rounded-full animate-spin" />
                    ) : (
                      <PlayCircle size={16} />
                    )}
                    Start
                  </button>
                )}
                {(task.status === 'in_progress' || task.status === 'pending') && (
                  <button
                    onClick={() => handleStatusUpdate('done')}
                    disabled={isActioning || isUpdating}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <div className="w-4 h-4 border-2 border-emerald-300 border-t-white rounded-full animate-spin" />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    Complete
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({
  request,
  onAction,
  isActioning
}: {
  request: ContextRequest;
  onAction: (id: string, action: 'accept' | 'reject' | 'complete', resolution?: string) => void;
  isActioning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [resolution, setResolution] = useState('');

  const statusConfig = {
    pending: {
      color: 'text-amber-400',
      bg: 'bg-amber-900/20',
      border: 'border-amber-500/30',
      icon: Clock,
    },
    processing: {
      color: 'text-blue-400',
      bg: 'bg-blue-900/20',
      border: 'border-blue-500/30',
      icon: PlayCircle,
    },
    dispatched: {
      color: 'text-cyan-400',
      bg: 'bg-cyan-900/20',
      border: 'border-cyan-500/30',
      icon: Activity,
    },
    done: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-900/20',
      border: 'border-emerald-500/30',
      icon: CheckCircle,
    },
    failed: {
      color: 'text-rose-400',
      bg: 'bg-rose-900/20',
      border: 'border-rose-500/30',
      icon: XCircle,
    },
  };

  const config = statusConfig[request.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  const age = Math.floor(Date.now() / 1000) - request.created_at;
  const isOverdue = request.status === 'pending' && age > 86400; // 24 hours

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden transition ${
      isOverdue ? 'ring-2 ring-rose-500/50' : ''
    }`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon size={18} className={config.color} />
              <span className={`text-xs font-medium uppercase tracking-wide ${config.color}`}>
                {request.status}
              </span>
              {isOverdue && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-rose-600 text-white font-medium">
                  OVERDUE
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-100 truncate">
              {request.event_payload.subject || request.event_payload.preview?.slice(0, 60) || 'Untitled Item'}
            </h3>
            <div className="flex gap-3 mt-2 text-xs text-slate-400">
              <span>Channel: {request.event_payload.channel}</span>
              {request.event_payload.contact && <span>From: {request.event_payload.contact}</span>}
              <span>Created: {formatRelativeTime(request.created_at)}</span>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition"
          >
            <ChevronRight
              size={20}
              className={`text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        </div>

        {/* Preview */}
        {request.event_payload.preview && (
          <div className="text-sm text-slate-300 line-clamp-2">
            {request.event_payload.preview}
          </div>
        )}

        {/* Expanded Details */}
        {expanded && (
          <div className="pt-3 border-t border-slate-700/50 space-y-3">
            {request.event_payload.source && (
              <div className="text-sm">
                <span className="text-slate-500">Source:</span>
                <span className="text-slate-300 ml-2">{request.event_payload.source}</span>
              </div>
            )}
            {request.resolution_summary && (
              <div className="text-sm">
                <span className="text-slate-500">Resolution:</span>
                <div className="mt-1 p-2 rounded bg-slate-800/50 text-slate-300">
                  {request.resolution_summary}
                </div>
              </div>
            )}
            {request.follow_up_questions && request.follow_up_questions.length > 0 && (
              <div className="text-sm">
                <span className="text-slate-500">Follow-up Questions:</span>
                <ul className="mt-1 space-y-1">
                  {request.follow_up_questions.map((q, i) => (
                    <li key={i} className="text-slate-300 ml-4">• {q}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-xs text-slate-500">
              <div>Event ID: {request.event_id}</div>
              <div>Request ID: {request.id}</div>
              <div>Last Updated: {formatDate(request.updated_at)}</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {request.status !== 'done' && (
          <div className="flex gap-2 pt-2 border-t border-slate-700/50">
            {request.status === 'pending' && (
              <>
                <button
                  onClick={() => onAction(request.id, 'accept')}
                  disabled={isActioning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  <Check size={16} />
                  Accept
                </button>
                <button
                  onClick={() => onAction(request.id, 'reject')}
                  disabled={isActioning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  <X size={16} />
                  Reject
                </button>
              </>
            )}
            {request.status === 'processing' && (
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Add resolution notes (optional)..."
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500"
                />
                <button
                  onClick={() => {
                    onAction(request.id, 'complete', resolution || undefined);
                    setResolution('');
                  }}
                  disabled={isActioning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50 whitespace-nowrap"
                >
                  <CheckCircle size={16} />
                  Complete
                </button>
              </div>
            )}
            {isActioning && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
                Processing...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
