'use client';

/**
 * GitHub Repos Management Page
 *
 * Shows all GitHub repos for the configured user and allows
 * mapping them to internal projects.
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  Github,
  FolderKanban,
  Link2,
  Link2Off,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Globe,
  Lock,
  Code,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  language: string | null;
  open_issues_count: number;
  updated_at: string;
  pushed_at: string;
  mapping: RepoMapping | null;
}

interface RepoMapping {
  repo_full_name: string;
  project_id: string | null;
  project_name: string | null;
  enabled: boolean;
  last_synced_at: number | null;
}

interface Project {
  id: string;
  name: string;
  source?: string;
}

function Toast({ message, type, onClose }: {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}) {
  const colors = {
    success: 'bg-emerald-600 border-emerald-500',
    error: 'bg-rose-600 border-rose-500',
    info: 'bg-sky-600 border-sky-500',
  };

  return (
    <div className={`fixed bottom-20 right-4 z-50 px-4 py-2 rounded-lg border ${colors[type]} text-white text-sm shadow-lg`}>
      {message}
      <button onClick={onClose} className="ml-3 hover:opacity-70">&times;</button>
    </div>
  );
}

export default function GitHubReposPage() {
  const { data, error, mutate, isLoading } = useSWR('/api/pm/github/repos', fetcher, {
    refreshInterval: 60000,
  });
  const { data: projectsData } = useSWR('/api/pm/projects', fetcher);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [updatingRepo, setUpdatingRepo] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleMapRepo = async (repoFullName: string, projectId: string | null, projectName: string | null, enabled: boolean) => {
    setUpdatingRepo(repoFullName);
    try {
      const res = await fetch('/api/pm/github/repos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          repo_full_name: repoFullName,
          project_id: projectId,
          project_name: projectName,
          enabled,
        }),
      });

      const result = await res.json();

      if (result.ok) {
        showToast(`Mapping updated for ${repoFullName}`, 'success');
        mutate();
      } else {
        showToast(result.error || 'Failed to update mapping', 'error');
      }
    } catch (err) {
      showToast('Failed to update mapping', 'error');
    } finally {
      setUpdatingRepo(null);
    }
  };

  // Not configured state
  if (data && !data.ok && data.configured === false) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <Github size={64} className="mx-auto text-slate-600" />
          <h2 className="text-2xl font-bold text-slate-200">GitHub Not Configured</h2>
          <p className="text-slate-400">
            Add the following to your .env.local file:
          </p>
          <div className="text-left bg-slate-800 rounded-lg p-4 text-sm font-mono text-slate-300">
            <div>GITHUB_USERNAME=your-username</div>
            <div>GITHUB_ACCESS_TOKEN=ghp_...</div>
          </div>
          <p className="text-slate-500 text-sm">
            Generate a token at github.com/settings/tokens with repo and read:user scopes.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-slate-400 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-lg">Loading GitHub repos...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || (data && !data.ok)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle size={64} className="mx-auto text-rose-400" />
          <h2 className="text-2xl font-bold text-rose-400">Failed to Load Repos</h2>
          <p className="text-slate-400">
            {data?.error || error?.message || 'Unknown error occurred'}
          </p>
          <button
            onClick={() => mutate()}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const repos: GitHubRepo[] = data?.repos || [];
  const mappings: RepoMapping[] = data?.mappings || [];
  const projects: Project[] = projectsData?.projects || [];
  const username = data?.username || 'Unknown';
  const unmappedCount = data?.unmapped_count || 0;

  // Filter repos
  const filteredRepos = repos.filter(repo => {
    if (filter === 'all') return true;
    if (filter === 'mapped') return repo.mapping !== null;
    if (filter === 'unmapped') return repo.mapping === null;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <header className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <a href="/pm" className="text-slate-400 hover:text-slate-200 text-sm">
                  PM Dashboard
                </a>
                <ChevronRight size={14} className="text-slate-600" />
                <span className="text-slate-200 text-sm">GitHub Repos</span>
              </div>
              <h1 className="text-3xl font-semibold flex items-center gap-3">
                <Github size={32} />
                GitHub Repositories
              </h1>
              <p className="text-slate-300 mt-1">
                Manage repo-to-project mappings for <span className="text-purple-400 font-medium">{username}</span>
              </p>
            </div>
            <button
              onClick={() => mutate()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="grid md:grid-cols-3 gap-4">
          <StatCard
            icon={Github}
            label="Total Repos"
            value={repos.length}
            color="text-slate-400"
            bgColor="bg-slate-800/50"
            borderColor="border-slate-700"
          />
          <StatCard
            icon={Link2}
            label="Mapped"
            value={repos.length - unmappedCount}
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
            borderColor="border-emerald-500/30"
          />
          <StatCard
            icon={Link2Off}
            label="Unmapped"
            value={unmappedCount}
            color="text-amber-400"
            bgColor="bg-amber-500/10"
            borderColor="border-amber-500/30"
          />
        </section>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-3">
          {[
            { key: 'all', label: 'All Repos', count: repos.length },
            { key: 'mapped', label: 'Mapped', count: repos.length - unmappedCount },
            { key: 'unmapped', label: 'Unmapped', count: unmappedCount },
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
              {tab.label}
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded ${
                filter === tab.key ? 'bg-slate-600' : 'bg-slate-800'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Repos List */}
        <section className="space-y-4">
          {filteredRepos.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <Github size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 text-lg">No repositories found</p>
              <p className="text-slate-500 text-sm mt-2">
                {filter !== 'all' ? `No ${filter} repositories` : 'No repositories found for this user'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredRepos.map(repo => (
                <RepoCard
                  key={repo.id}
                  repo={repo}
                  projects={projects}
                  onMap={handleMapRepo}
                  isUpdating={updatingRepo === repo.full_name}
                />
              ))}
            </div>
          )}
        </section>
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
  borderColor,
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

function RepoCard({
  repo,
  projects,
  onMap,
  isUpdating,
}: {
  repo: GitHubRepo;
  projects: Project[];
  onMap: (repoFullName: string, projectId: string | null, projectName: string | null, enabled: boolean) => void;
  isUpdating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>(repo.mapping?.project_id || '');
  const [customProjectName, setCustomProjectName] = useState(repo.mapping?.project_name || '');
  const [enabled, setEnabled] = useState(repo.mapping?.enabled ?? true);

  const isMapped = repo.mapping !== null;
  const lastUpdated = new Date(repo.updated_at).toLocaleDateString();
  const lastPushed = repo.pushed_at ? new Date(repo.pushed_at).toLocaleDateString() : null;

  const languageColors: Record<string, string> = {
    TypeScript: 'bg-blue-500',
    JavaScript: 'bg-yellow-500',
    Python: 'bg-green-500',
    Rust: 'bg-orange-500',
    Go: 'bg-cyan-500',
    Java: 'bg-red-500',
    Ruby: 'bg-rose-500',
    Swift: 'bg-orange-400',
    Kotlin: 'bg-purple-500',
    default: 'bg-slate-500',
  };

  const handleSaveMapping = () => {
    const project = projects.find(p => p.id === selectedProject);
    onMap(
      repo.full_name,
      selectedProject || null,
      project?.name || customProjectName || null,
      enabled
    );
  };

  return (
    <div className={`rounded-xl border ${
      isMapped
        ? 'border-emerald-500/30 bg-emerald-900/10'
        : 'border-slate-700 bg-slate-900/50'
    } overflow-hidden transition`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {repo.private ? (
                <Lock size={14} className="text-amber-400" />
              ) : (
                <Globe size={14} className="text-slate-400" />
              )}
              <span className="text-xs text-slate-500">
                {repo.private ? 'Private' : 'Public'}
              </span>
              {repo.language && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${languageColors[repo.language] || languageColors.default}`} />
                  {repo.language}
                </span>
              )}
              {isMapped ? (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-emerald-900/50 text-emerald-300">
                  <Link2 size={12} />
                  Mapped
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-amber-900/50 text-amber-300">
                  <Link2Off size={12} />
                  Unmapped
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-100">
              {repo.name}
            </h3>
            {repo.description && (
              <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                {repo.description}
              </p>
            )}
            <div className="flex gap-4 mt-2 text-xs text-slate-500">
              <span>Updated: {lastUpdated}</span>
              {lastPushed && <span>Last push: {lastPushed}</span>}
              {repo.open_issues_count > 0 && (
                <span className="text-amber-400">{repo.open_issues_count} open issues</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-slate-700/50 transition"
            >
              <ExternalLink size={18} className="text-slate-400" />
            </a>
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

        {/* Mapping info */}
        {isMapped && repo.mapping?.project_name && (
          <div className="flex items-center gap-2 text-sm">
            <FolderKanban size={14} className="text-indigo-400" />
            <span className="text-slate-400">Mapped to:</span>
            <span className="text-indigo-300 font-medium">{repo.mapping.project_name}</span>
            {!repo.mapping.enabled && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-400">
                Disabled
              </span>
            )}
          </div>
        )}

        {/* Expanded Mapping Form */}
        {expanded && (
          <div className="pt-3 border-t border-slate-700/50 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Project Selection */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Link to Project</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100"
                >
                  <option value="">-- Select a project --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Custom Project Name */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Or create new project name</label>
                <input
                  type="text"
                  value={customProjectName}
                  onChange={(e) => setCustomProjectName(e.target.value)}
                  placeholder="e.g., My Project"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500"
                />
              </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-300">Sync issues from this repo</span>
              </label>
            </div>

            {/* Save Button */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveMapping}
                disabled={isUpdating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50"
              >
                {isUpdating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Save Mapping
                  </>
                )}
              </button>
              {isMapped && (
                <button
                  onClick={() => onMap(repo.full_name, null, null, false)}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition disabled:opacity-50"
                >
                  <Link2Off size={16} />
                  Remove Mapping
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
