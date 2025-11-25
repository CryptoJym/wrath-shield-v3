'use client';

/**
 * PM Relationship Card
 *
 * Read-only card showing a person's roles, projects/orgs, freshness, and last source.
 */

import { useState, useEffect } from 'react';

interface CommsSource {
  channel: 'email' | 'imessage' | 'lifelog' | 'manual';
  timestamp: number;
  link?: string;
  snippet?: string;
}

interface PersonEntity {
  id: string;
  canonical_id: string;
  display_name: string | null;
  emails: string[];
  phones: string[];
  roles: string[];
  projects: string[];
  orgs: string[];
  last_source: CommsSource;
  last_seen: number;
  message_count: number;
  confidence: number;
}

interface RelationshipCardProps {
  person: PersonEntity;
}

function getFreshnessLabel(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 3600) return 'just now';
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function getChannelIcon(channel: string): string {
  switch (channel) {
    case 'email':
      return '📧';
    case 'imessage':
      return '💬';
    case 'lifelog':
      return '🎙️';
    case 'manual':
      return '✏️';
    default:
      return '📝';
  }
}

function getChannelColor(channel: string): string {
  switch (channel) {
    case 'email':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'imessage':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'lifelog':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
}

function getFreshnessColor(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 86400) return 'text-green-600 dark:text-green-400'; // < 1 day
  if (diff < 604800) return 'text-yellow-600 dark:text-yellow-400'; // < 1 week
  if (diff < 2592000) return 'text-orange-600 dark:text-orange-400'; // < 1 month
  return 'text-red-600 dark:text-red-400'; // > 1 month
}

export function RelationshipCard({ person }: RelationshipCardProps) {
  const displayName = person.display_name || person.canonical_id;
  const freshness = getFreshnessLabel(person.last_seen);
  const freshnessColor = getFreshnessColor(person.last_seen);
  const channelIcon = getChannelIcon(person.last_source.channel);
  const channelColor = getChannelColor(person.last_source.channel);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {displayName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {person.emails[0] || person.phones[0] || person.canonical_id}
          </p>
        </div>
        <div className={`text-xs font-medium ${freshnessColor} whitespace-nowrap ml-2`}>
          {freshness}
        </div>
      </div>

      {/* Roles */}
      {person.roles.length > 0 && (
        <div className="mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Roles</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {person.roles.map((role, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {person.projects.length > 0 && (
        <div className="mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Projects</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {person.projects.map((proj, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
              >
                {proj}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Orgs */}
      {person.orgs.length > 0 && (
        <div className="mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Orgs</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {person.orgs.map((org, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
              >
                {org}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer: Last source */}
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${channelColor}`}>
          {channelIcon} {person.last_source.channel}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {person.message_count} msg{person.message_count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Snippet preview */}
      {person.last_source.snippet && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic truncate">
          "{person.last_source.snippet}"
        </p>
      )}
    </div>
  );
}

/**
 * Relationships Grid - displays multiple cards
 */
interface RelationshipsGridProps {
  persons: PersonEntity[];
  loading?: boolean;
}

export function RelationshipsGrid({ persons, loading }: RelationshipsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (persons.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">No relationships found</p>
        <p className="text-sm mt-1">Import contacts or add entries manually</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {persons.map((person) => (
        <RelationshipCard key={person.id} person={person} />
      ))}
    </div>
  );
}

/**
 * Relationships Panel - full component with header and controls
 */
export function RelationshipsPanel() {
  const [persons, setPersons] = useState<PersonEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/pm/relationships');
        if (!res.ok) throw new Error('Failed to load relationships');
        const data = await res.json();
        setPersons(data.persons || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Relationships Map
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {persons.length} contact{persons.length !== 1 ? 's' : ''} from comms
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Grid */}
      <RelationshipsGrid persons={persons} loading={loading} />
    </div>
  );
}

export default RelationshipsPanel;
