'use client';

/**
 * PM Agent Dashboard
 *
 * Dedicated page for PM agent with:
 * - Projects list with status indicators
 * - Tasks breakdown (pending/in-progress/done)
 * - Recent activity feed
 * - Routing accept/reject/complete actions
 */

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import {
  ClipboardList,
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
  CheckCircle2,
  ExternalLink,
  Github
} from 'lucide-react';

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
  source: 'github' | 'motion' | 'local';
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
    motion: { configured: boolean; error?: string };
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

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'done'>('all');
  const [actioningId, setActioningId] = useState<string | null>(null);

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

  const pmStatus = statusData as PMStatus | undefined;
  const requests = (requestsData?.requests || []) as ContextRequest[];
  const dashboard = dashboardData as PMDashboardData | undefined;

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

  // Filter unified tasks
  const filteredTasks = allTasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'pending') return task.status === 'pending';
    if (filter === 'processing') return task.status === 'in_progress';
    if (filter === 'done') return task.status === 'done';
    return false;
  });

  const config = pmStatus ? STATUS_CONFIG[pmStatus.status] : STATUS_CONFIG.green;
  const StatusIcon = config.icon;
  const showDebug = process.env.NODE_ENV === 'development';

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
                <a
                  href="/pm/github"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-purple-900/30 text-purple-300 border border-purple-500/30 hover:bg-purple-900/50 transition"
                >
                  <Github size={16} />
                  GitHub Repos
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
            <div className="text-slate-400 font-semibold">Debug: PM data</div>
            <div className="text-slate-500">
              Total tasks: {dashboard?.tasks.total ?? 0} | Pending: {tasksByStatus.pending} | In Progress: {tasksByStatus.processing} | Done: {tasksByStatus.done} | Failed: {tasksByStatus.failed}
            </div>
            <div className="text-slate-500">
              Projects: {projectsCount} | Health: {pmStatus?.health_score ?? '-'} | Status: {pmStatus?.status ?? '-'}
            </div>
            <div className="text-slate-500">
              Sources → GitHub: {dashboard?.tasks.by_source?.github ?? 0} | Motion: {dashboard?.tasks.by_source?.motion ?? 0} | Local: {dashboard?.tasks.by_source?.local ?? 0}
            </div>
            <div className="text-slate-500">
              Integrations → GitHub: {dashboard?.integrations.github.configured ? '✓' : '✗'} | Motion: {dashboard?.integrations.motion.configured ? '✓' : '✗'}
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <section className="grid md:grid-cols-4 gap-4">
          <StatCard
            icon={FolderKanban}
            label="Total Projects"
            value={projectsCount}
            color="text-sky-400"
            bgColor="bg-sky-500/10"
            borderColor="border-sky-500/30"
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={tasksByStatus.pending}
            color="text-amber-400"
            bgColor="bg-amber-500/10"
            borderColor="border-amber-500/30"
          />
          <StatCard
            icon={PlayCircle}
            label="In Progress"
            value={tasksByStatus.processing}
            color="text-blue-400"
            bgColor="bg-blue-500/10"
            borderColor="border-blue-500/30"
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed"
            value={tasksByStatus.done}
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
            borderColor="border-emerald-500/30"
          />
        </section>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-3">
          {[
            { key: 'all', label: 'All Items', count: allTasks.length },
            { key: 'pending', label: 'Pending', count: tasksByStatus.pending },
            { key: 'processing', label: 'In Progress', count: tasksByStatus.processing },
            { key: 'done', label: 'Completed', count: tasksByStatus.done },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === tab.key
                  ? 'bg-slate-700 text-slate-100 border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label} {tab.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded ${
                  filter === tab.key ? 'bg-slate-600' : 'bg-slate-800'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Projects/Tasks List */}
        <section className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <ListTodo size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 text-lg">No items to display</p>
              <p className="text-slate-500 text-sm mt-2">
                {filter === 'all'
                  ? dashboard?.integrations.github.configured || dashboard?.integrations.motion.configured
                    ? 'No tasks found in connected systems. Create tasks in GitHub or Motion.'
                    : 'No tasks yet. Configure GitHub or Motion integrations in .env.local'
                  : `No items with status "${filter}"`
                }
              </p>
              {!dashboard?.integrations.github.configured && !dashboard?.integrations.motion.configured && (
                <div className="mt-4 text-xs text-slate-600 space-y-1">
                  <p>Add to .env.local:</p>
                  <p>GITHUB_ACCESS_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME</p>
                  <p>or MOTION_API_KEY</p>
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
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
  borderColor
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-slate-800/50 ${color}`}>
          <Icon size={24} />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-100">{value}</div>
          <div className="text-sm text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

function UnifiedTaskCard({
  task,
  onAction,
  isActioning,
  onRefresh,
}: {
  task: UnifiedTask;
  onAction: (id: string, action: 'accept' | 'reject' | 'complete', resolution?: string) => void;
  isActioning: boolean;
  onRefresh?: () => void;
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
    motion: { label: 'Motion', color: 'text-cyan-400', bg: 'bg-cyan-900/50' },
    local: { label: 'Local', color: 'text-slate-400', bg: 'bg-slate-900/50' },
  };

  const config = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const priorityStyle = priorityConfig[task.priority];
  const sourceStyle = sourceConfig[task.source];

  const handleStatusUpdate = async (newStatus: 'in_progress' | 'done') => {
    try {
      const res = await fetch('/api/pm/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });

      if (res.ok) {
        onRefresh?.();
      }
    } catch (error) {
      console.error('Failed to update task:', error);
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
              {task.due_date && !isNaN(new Date(task.due_date).getTime()) && (
                <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
              )}
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

        {/* Description */}
        {task.description && (
          <div className="text-sm text-slate-300 line-clamp-2">
            {task.description}
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
                <span className="text-slate-500">Full Description:</span>
                <div className="mt-1 p-2 rounded bg-slate-800/50 text-slate-300 whitespace-pre-wrap">
                  {task.description}
                </div>
              </div>
            )}
            <div className="text-xs text-slate-500">
              <div>Source ID: {task.source_id}</div>
              <div>Task ID: {task.id}</div>
              {task.created_at && !isNaN(new Date(task.created_at).getTime()) && (
                <div>Created: {new Date(task.created_at).toLocaleString()}</div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {task.status !== 'done' && task.source !== 'local' && (
          <div className="flex gap-2 pt-2 border-t border-slate-700/50">
            {task.status === 'pending' && (
              <button
                onClick={() => handleStatusUpdate('in_progress')}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition disabled:opacity-50"
              >
                <PlayCircle size={16} />
                Start
              </button>
            )}
            {(task.status === 'in_progress' || task.status === 'pending') && (
              <button
                onClick={() => handleStatusUpdate('done')}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50"
              >
                <CheckCircle size={16} />
                Complete
              </button>
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
