import { NextRequest, NextResponse } from 'next/server';
import { getDomains, getMappings } from '@/lib/life-os-config';
import githubClient, { GitHubRepo } from '@/lib/integrations/GitHubClient';
import {
  autoOrganizeRepos,
  getOrganizationSuggestions,
  getOrganizationStatus
} from '@/lib/pm/repo-organizer';

export const revalidate = 60; // Cache for 1 minute

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // 1. Suggestions Action
    if (action === 'suggestions') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const suggestions = await getOrganizationSuggestions(limit);
      return NextResponse.json({ ok: true, suggestions });
    }

    // 2. Status Action
    if (action === 'status') {
      const status = await getOrganizationStatus();
      // Map to frontend interface
      return NextResponse.json({
        ok: true,
        status: {
          totalRepos: status.totalRepos,
          unmappedRepos: status.unorganizedRepos,
          mappedRepos: status.organizedRepos,
          enabledRepos: status.organizedRepos, // Assuming all organized are enabled
          projectCount: Object.keys(status.projectCounts).length,
          lastUpdated: new Date().toISOString()
        }
      });
    }

    // 3. Default: Tree View
    // (Existing Logic)
    const domainsConfig = getDomains();
    const mappingsConfig = getMappings();

    let gitHubRepos: GitHubRepo[] = [];
    try {
      if (githubClient.isConfigured()) {
        gitHubRepos = await githubClient.getRepos({ limit: 200 });
      }
    } catch (e) {
      console.warn('Failed to fetch GitHub repos:', e);
    }

    const tree = domainsConfig.domains
      .sort((a, b) => b.priority_weight - a.priority_weight)
      .map(domain => {
        const domainProjects = mappingsConfig.project_mappings.filter(m => m.domains.includes(domain.id));
        const children = domainProjects.map(mapping => {
          let assignedRepos = gitHubRepos.filter(repo =>
            mapping.github_repos.includes(repo.full_name) ||
            mapping.github_repos.includes(repo.name)
          );

          if (assignedRepos.length === 0 && mapping.github_repos.length > 0) {
            assignedRepos = mapping.github_repos.map(repoName => ({
              id: `cfg-${repoName}`,
              name: repoName.split('/').pop() || repoName,
              full_name: repoName,
              private: true,
              html_url: `https://github.com/${repoName}`,
              description: '(from config)',
              fork: false,
              url: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              pushed_at: new Date().toISOString(),
              homepage: null,
              size: 0,
              stargazers_count: 0,
              watchers_count: 0,
              language: 'Unknown',
              has_issues: false,
              has_projects: false,
              has_downloads: false,
              has_wiki: false,
              has_pages: false,
              forks_count: 0,
              mirror_url: null,
              archived: false,
              disabled: false,
              open_issues_count: 0,
              license: null,
              forks: 0,
              open_issues: 0,
              watchers: 0,
              default_branch: 'main',
              owner: { login: 'config', id: 0, avatar_url: '', html_url: '', type: 'User', site_admin: false }
            } as any));
          }

          return {
            id: `proj-${mapping.id}`,
            name: mapping.motion_projects[0] || mapping.id,
            type: 'project',
            status: assignedRepos[0]?.id?.toString().startsWith('cfg-') ? 'pending-sync' : 'active',
            children: assignedRepos.map(repo => ({
              id: `repo-${repo.id}`,
              name: repo.name,
              type: 'repo',
              status: repo.archived ? 'archived' : (repo.id.toString().startsWith('cfg-') ? 'pending' : 'active'),
              meta: {
                stars: repo.stargazers_count || 0,
                issues: repo.open_issues_count || 0,
                prs: 0,
                lastUpdate: timeSince(repo.updated_at),
                language: repo.language
              },
              raw: repo
            }))
          };
        });

        return {
          id: `domain-${domain.id}`,
          name: domain.name,
          type: 'org',
          status: 'active',
          children: children
        };
      });

    const allMappedRepoNames = new Set(
      mappingsConfig.project_mappings.flatMap(m => m.github_repos)
    );

    const unmappedRepos = gitHubRepos.filter(r =>
      !allMappedRepoNames.has(r.full_name) && !allMappedRepoNames.has(r.name)
    );

    if (unmappedRepos.length > 0) {
      tree.push({
        id: 'domain-unmapped',
        name: 'Unmapped / Inbox',
        type: 'org',
        status: 'error',
        children: [{
          id: 'proj-triage',
          name: 'Needs Triage',
          type: 'project',
          status: 'active',
          children: unmappedRepos.map(repo => ({
            id: `repo-${repo.id}`,
            name: repo.name,
            type: 'repo',
            status: 'active',
            meta: {
              stars: 0,
              issues: repo.open_issues_count,
              prs: 0,
              lastUpdate: timeSince(repo.updated_at),
              language: repo.language
            },
            raw: repo
          }))
        }]
      });
    }

    return NextResponse.json({ tree });
  } catch (error) {
    console.error('Error constructing repo tree:', error);
    return NextResponse.json({ tree: [], error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'auto-organize') {
      const result = await autoOrganizeRepos();
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'set-mapping') {
      const { repoFullName, projectId, projectName, enabled } = body;

      if (!repoFullName || (!projectId && !projectName)) {
        return NextResponse.json({ ok: false, error: 'Missing required params' }, { status: 400 });
      }

      await githubClient.setRepoMapping({
        repo_full_name: repoFullName,
        project_id: projectId,
        project_name: projectName,
        enabled: enabled ?? true,
        last_synced_at: Math.floor(Date.now() / 1000)
      });

      return NextResponse.json({ ok: true, success: true });
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Repo API POST Error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

function timeSince(dateString: string) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
}
