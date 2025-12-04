/**
 * GitHub Projects v2 Client
 *
 * Integrates with GitHub Projects v2 (the newer project board system)
 * using the GraphQL API, as Projects v2 is not available via REST.
 *
 * Capabilities:
 * - List organization/user projects
 * - Get project details and items
 * - Add/remove items from projects
 * - Update item field values
 * - Link issues/PRs to projects
 */

import { safeConfig } from '@/lib/safe-config';
import { ensureServerOnly } from '@/lib/server-only-guard';

ensureServerOnly('lib/integrations/GitHubProjectsClient');

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

// Types

export interface ProjectV2 {
  id: string;
  number: number;
  title: string;
  shortDescription: string | null;
  url: string;
  closed: boolean;
  public: boolean;
  createdAt: string;
  updatedAt: string;
  owner: {
    login: string;
    type: 'User' | 'Organization';
  };
  itemsCount: number;
  fieldsCount: number;
}

export interface ProjectV2Field {
  id: string;
  name: string;
  dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION';
  options?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
}

export interface ProjectV2Item {
  id: string;
  type: 'ISSUE' | 'PULL_REQUEST' | 'DRAFT_ISSUE';
  createdAt: string;
  updatedAt: string;
  content: {
    id?: string;
    title: string;
    number?: number;
    state?: string;
    url?: string;
    repository?: {
      name: string;
      nameWithOwner: string;
    };
  };
  fieldValues: Record<string, any>;
}

export interface ProjectV2ItemConnection {
  items: ProjectV2Item[];
  totalCount: number;
  hasNextPage: boolean;
  endCursor: string | null;
}

// GraphQL Queries

const LIST_USER_PROJECTS_QUERY = `
  query($login: String!, $first: Int!, $after: String) {
    user(login: $login) {
      projectsV2(first: $first, after: $after) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          number
          title
          shortDescription
          url
          closed
          public
          createdAt
          updatedAt
          items {
            totalCount
          }
          fields(first: 1) {
            totalCount
          }
        }
      }
    }
  }
`;

const LIST_ORG_PROJECTS_QUERY = `
  query($login: String!, $first: Int!, $after: String) {
    organization(login: $login) {
      projectsV2(first: $first, after: $after) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          number
          title
          shortDescription
          url
          closed
          public
          createdAt
          updatedAt
          items {
            totalCount
          }
          fields(first: 1) {
            totalCount
          }
        }
      }
    }
  }
`;

const GET_PROJECT_QUERY = `
  query($id: ID!) {
    node(id: $id) {
      ... on ProjectV2 {
        id
        number
        title
        shortDescription
        url
        closed
        public
        createdAt
        updatedAt
        owner {
          ... on User {
            login
          }
          ... on Organization {
            login
          }
        }
        items {
          totalCount
        }
        fields(first: 20) {
          totalCount
          nodes {
            ... on ProjectV2Field {
              id
              name
              dataType
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              dataType
              options {
                id
                name
                color
              }
            }
            ... on ProjectV2IterationField {
              id
              name
              dataType
            }
          }
        }
      }
    }
  }
`;

const GET_PROJECT_ITEMS_QUERY = `
  query($id: ID!, $first: Int!, $after: String) {
    node(id: $id) {
      ... on ProjectV2 {
        items(first: $first, after: $after) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            type
            createdAt
            updatedAt
            content {
              ... on Issue {
                id
                title
                number
                state
                url
                repository {
                  name
                  nameWithOwner
                }
              }
              ... on PullRequest {
                id
                title
                number
                state
                url
                repository {
                  name
                  nameWithOwner
                }
              }
              ... on DraftIssue {
                title
              }
            }
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldTextValue {
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                  text
                }
                ... on ProjectV2ItemFieldNumberValue {
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                  number
                }
                ... on ProjectV2ItemFieldDateValue {
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                  date
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  field {
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

const ADD_ITEM_TO_PROJECT_MUTATION = `
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
      item {
        id
        type
        createdAt
      }
    }
  }
`;

const REMOVE_ITEM_FROM_PROJECT_MUTATION = `
  mutation($projectId: ID!, $itemId: ID!) {
    deleteProjectV2Item(input: {projectId: $projectId, itemId: $itemId}) {
      deletedItemId
    }
  }
`;

const UPDATE_ITEM_FIELD_MUTATION = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: $value
    }) {
      projectV2Item {
        id
      }
    }
  }
`;

// Client

class GitHubProjectsClient {
  private token: string | null;
  private username: string | null;

  constructor() {
    this.token = safeConfig('GITHUB_ACCESS_TOKEN', '');
    this.username = safeConfig('GITHUB_USERNAME', '');
  }

  /**
   * Check if GitHub Projects is configured
   */
  isConfigured(): boolean {
    return !!this.token;
  }

  /**
   * Get the configured username
   */
  getUsername(): string | null {
    return this.username;
  }

  /**
   * Execute a GraphQL query
   */
  private async graphql<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
    if (!this.token) {
      throw new Error('GitHub not configured. Set GITHUB_ACCESS_TOKEN in environment.');
    }

    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub GraphQL error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    if (result.errors?.length) {
      throw new Error(`GitHub GraphQL error: ${result.errors.map((e: any) => e.message).join(', ')}`);
    }

    return result.data as T;
  }

  // ============================================================================
  // Projects
  // ============================================================================

  /**
   * List projects for the configured user
   */
  async getUserProjects(options?: {
    limit?: number;
    after?: string;
  }): Promise<{ projects: ProjectV2[]; totalCount: number; hasNextPage: boolean; endCursor: string | null }> {
    if (!this.username) {
      throw new Error('GitHub username not configured. Set GITHUB_USERNAME in environment.');
    }

    const data = await this.graphql<any>(LIST_USER_PROJECTS_QUERY, {
      login: this.username,
      first: options?.limit || 20,
      after: options?.after,
    });

    const projectsData = data.user?.projectsV2;
    if (!projectsData) {
      return { projects: [], totalCount: 0, hasNextPage: false, endCursor: null };
    }

    const projects: ProjectV2[] = projectsData.nodes.map((node: any) => ({
      id: node.id,
      number: node.number,
      title: node.title,
      shortDescription: node.shortDescription,
      url: node.url,
      closed: node.closed,
      public: node.public,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      owner: {
        login: this.username!,
        type: 'User' as const,
      },
      itemsCount: node.items?.totalCount || 0,
      fieldsCount: node.fields?.totalCount || 0,
    }));

    return {
      projects,
      totalCount: projectsData.totalCount,
      hasNextPage: projectsData.pageInfo.hasNextPage,
      endCursor: projectsData.pageInfo.endCursor,
    };
  }

  /**
   * List projects for an organization
   */
  async getOrgProjects(
    orgLogin: string,
    options?: {
      limit?: number;
      after?: string;
    }
  ): Promise<{ projects: ProjectV2[]; totalCount: number; hasNextPage: boolean; endCursor: string | null }> {
    const data = await this.graphql<any>(LIST_ORG_PROJECTS_QUERY, {
      login: orgLogin,
      first: options?.limit || 20,
      after: options?.after,
    });

    const projectsData = data.organization?.projectsV2;
    if (!projectsData) {
      return { projects: [], totalCount: 0, hasNextPage: false, endCursor: null };
    }

    const projects: ProjectV2[] = projectsData.nodes.map((node: any) => ({
      id: node.id,
      number: node.number,
      title: node.title,
      shortDescription: node.shortDescription,
      url: node.url,
      closed: node.closed,
      public: node.public,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      owner: {
        login: orgLogin,
        type: 'Organization' as const,
      },
      itemsCount: node.items?.totalCount || 0,
      fieldsCount: node.fields?.totalCount || 0,
    }));

    return {
      projects,
      totalCount: projectsData.totalCount,
      hasNextPage: projectsData.pageInfo.hasNextPage,
      endCursor: projectsData.pageInfo.endCursor,
    };
  }

  /**
   * Get all projects (user + organizations the user belongs to)
   */
  async getAllProjects(): Promise<ProjectV2[]> {
    const allProjects: ProjectV2[] = [];

    // Get user projects
    try {
      const userResult = await this.getUserProjects({ limit: 50 });
      allProjects.push(...userResult.projects);
    } catch (error) {
      console.warn('[GitHubProjects] Failed to fetch user projects:', error);
    }

    // Could also fetch org projects if we had a list of orgs
    // For now, just return user projects

    return allProjects;
  }

  /**
   * Get a project by its node ID
   */
  async getProject(projectId: string): Promise<ProjectV2 & { fields: ProjectV2Field[] }> {
    const data = await this.graphql<any>(GET_PROJECT_QUERY, { id: projectId });

    const project = data.node;
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const fields: ProjectV2Field[] = project.fields.nodes.map((f: any) => ({
      id: f.id,
      name: f.name,
      dataType: f.dataType,
      options: f.options,
    }));

    return {
      id: project.id,
      number: project.number,
      title: project.title,
      shortDescription: project.shortDescription,
      url: project.url,
      closed: project.closed,
      public: project.public,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      owner: {
        login: project.owner?.login || '',
        type: project.owner?.__typename === 'Organization' ? 'Organization' : 'User',
      },
      itemsCount: project.items?.totalCount || 0,
      fieldsCount: project.fields?.totalCount || 0,
      fields,
    };
  }

  // ============================================================================
  // Project Items
  // ============================================================================

  /**
   * Get items in a project
   */
  async getProjectItems(
    projectId: string,
    options?: {
      limit?: number;
      after?: string;
    }
  ): Promise<ProjectV2ItemConnection> {
    const data = await this.graphql<any>(GET_PROJECT_ITEMS_QUERY, {
      id: projectId,
      first: options?.limit || 50,
      after: options?.after,
    });

    const itemsData = data.node?.items;
    if (!itemsData) {
      return { items: [], totalCount: 0, hasNextPage: false, endCursor: null };
    }

    const items: ProjectV2Item[] = itemsData.nodes.map((node: any) => {
      // Extract field values into a map
      const fieldValues: Record<string, any> = {};
      for (const fv of node.fieldValues?.nodes || []) {
        if (fv.field?.name) {
          fieldValues[fv.field.name] = fv.text || fv.number || fv.date || fv.name;
        }
      }

      return {
        id: node.id,
        type: node.type,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        content: {
          id: node.content?.id,
          title: node.content?.title || '',
          number: node.content?.number,
          state: node.content?.state,
          url: node.content?.url,
          repository: node.content?.repository ? {
            name: node.content.repository.name,
            nameWithOwner: node.content.repository.nameWithOwner,
          } : undefined,
        },
        fieldValues,
      };
    });

    return {
      items,
      totalCount: itemsData.totalCount,
      hasNextPage: itemsData.pageInfo.hasNextPage,
      endCursor: itemsData.pageInfo.endCursor,
    };
  }

  /**
   * Add an issue or PR to a project
   */
  async addItemToProject(projectId: string, contentId: string): Promise<{ itemId: string }> {
    const data = await this.graphql<any>(ADD_ITEM_TO_PROJECT_MUTATION, {
      projectId,
      contentId,
    });

    return {
      itemId: data.addProjectV2ItemById.item.id,
    };
  }

  /**
   * Remove an item from a project
   */
  async removeItemFromProject(projectId: string, itemId: string): Promise<{ deletedItemId: string }> {
    const data = await this.graphql<any>(REMOVE_ITEM_FROM_PROJECT_MUTATION, {
      projectId,
      itemId,
    });

    return {
      deletedItemId: data.deleteProjectV2Item.deletedItemId,
    };
  }

  /**
   * Update a field value for a project item
   */
  async updateItemField(
    projectId: string,
    itemId: string,
    fieldId: string,
    value: { text?: string; number?: number; date?: string; singleSelectOptionId?: string }
  ): Promise<void> {
    await this.graphql(UPDATE_ITEM_FIELD_MUTATION, {
      projectId,
      itemId,
      fieldId,
      value,
    });
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Find a project by title
   */
  async findProjectByTitle(title: string): Promise<ProjectV2 | null> {
    const projects = await this.getAllProjects();
    return projects.find(p => p.title.toLowerCase() === title.toLowerCase()) || null;
  }

  /**
   * Get all items from a project (handles pagination)
   */
  async getAllProjectItems(projectId: string): Promise<ProjectV2Item[]> {
    const allItems: ProjectV2Item[] = [];
    let cursor: string | null = null;

    do {
      const result = await this.getProjectItems(projectId, {
        limit: 100,
        after: cursor || undefined,
      });

      allItems.push(...result.items);
      cursor = result.hasNextPage ? result.endCursor : null;
    } while (cursor);

    return allItems;
  }

  /**
   * Get project summary with item counts by status
   */
  async getProjectSummary(projectId: string): Promise<{
    project: ProjectV2;
    itemsByStatus: Record<string, number>;
    itemsByRepo: Record<string, number>;
  }> {
    const project = await this.getProject(projectId);
    const items = await this.getAllProjectItems(projectId);

    const itemsByStatus: Record<string, number> = {};
    const itemsByRepo: Record<string, number> = {};

    for (const item of items) {
      // Count by status field (if available)
      const status = item.fieldValues['Status'] || item.content.state || 'Unknown';
      itemsByStatus[status] = (itemsByStatus[status] || 0) + 1;

      // Count by repository
      const repo = item.content.repository?.nameWithOwner || 'Draft';
      itemsByRepo[repo] = (itemsByRepo[repo] || 0) + 1;
    }

    return {
      project,
      itemsByStatus,
      itemsByRepo,
    };
  }
}

// Singleton instance
const githubProjectsClient = new GitHubProjectsClient();
export default githubProjectsClient;
