'use client';

import { useEffect, useState } from 'react';

interface TimelineEvent {
  date: string;
  category: 'filing' | 'email' | 'event' | 'deadline' | 'violation';
  title: string;
  description: string;
  source: string;
}

interface TimelineData {
  events: TimelineEvent[];
  byMonth: Record<string, TimelineEvent[]>;
  stats: {
    total: number;
    byCategory: Record<string, number>;
    dateRange: { oldest: string; newest: string };
  };
  case: {
    number: string;
    name: string;
    court: string;
    status: string;
  };
}

const categoryColors: Record<string, string> = {
  filing: 'bg-blue-500',
  email: 'bg-gray-500',
  event: 'bg-green-500',
  violation: 'bg-red-500',
  deadline: 'bg-yellow-500',
};

const categoryIcons: Record<string, string> = {
  filing: '📄',
  email: '📧',
  event: '📅',
  violation: '⚠️',
  deadline: '⏰',
};

export default function LegalTimelinePage() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const params = filter !== 'all' ? `?category=${filter}&limit=200` : '?limit=200';
      const res = await fetch(`/api/legal/timeline${params}`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    load();
  }, [filter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-xl">Loading timeline...</div>
      </div>
    );
  }

  if (!data || !data.events.length) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Legal Case Timeline</h1>
          <div className="bg-yellow-900/50 border border-yellow-600 p-4 rounded">
            No timeline data found. Run the timeline builder first:
            <code className="block mt-2 bg-black p-2 rounded">
              npx tsx scripts/build-legal-timeline.ts
            </code>
          </div>
        </div>
      </div>
    );
  }

  const keyEvents = data.events.filter(e => e.category !== 'email');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Case Timeline</h1>
              <p className="text-gray-400 mt-1">
                {data.case.number} - {data.case.name}
              </p>
              <p className="text-sm text-gray-500">{data.case.court}</p>
            </div>
            <div className="text-right">
              <div className="text-green-400 font-medium">{data.case.status}</div>
              <div className="text-sm text-gray-500 mt-1">
                {data.stats.total} total events
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex gap-4 mt-6">
            {Object.entries(data.stats.byCategory).map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setFilter(filter === cat ? 'all' : cat)}
                className={`px-3 py-1 rounded text-sm flex items-center gap-2 transition ${
                  filter === cat
                    ? categoryColors[cat] + ' text-white'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <span>{categoryIcons[cat]}</span>
                <span className="capitalize">{cat}</span>
                <span className="bg-black/30 px-1.5 rounded">{count}</span>
              </button>
            ))}
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="px-3 py-1 rounded text-sm bg-gray-600 hover:bg-gray-500"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Key Events Column */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>📋</span> Key Events Timeline
            </h2>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

              {/* Events */}
              <div className="space-y-4">
                {keyEvents.map((event, idx) => (
                  <div key={idx} className="relative pl-10">
                    {/* Dot */}
                    <div
                      className={`absolute left-2 w-5 h-5 rounded-full ${categoryColors[event.category]} flex items-center justify-center text-xs`}
                    >
                      {categoryIcons[event.category]}
                    </div>

                    {/* Card */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{event.title}</div>
                        <div className="text-sm text-gray-400">
                          {new Date(event.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">{event.description}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[event.category]}`}>
                          {event.category}
                        </span>
                        <span className="text-xs text-gray-500">{event.source}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - Month Summary */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>📆</span> By Month
            </h2>

            <div className="space-y-3">
              {Object.entries(data.byMonth)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([month, events]) => {
                  const [year, m] = month.split('-');
                  const monthName = new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  const nonEmail = events.filter(e => e.category !== 'email');

                  return (
                    <div key={month} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="font-medium mb-2">{monthName}</div>
                      <div className="text-sm text-gray-400">
                        {events.length} events ({nonEmail.length} key)
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {Object.entries(
                          events.reduce((acc, e) => {
                            acc[e.category] = (acc[e.category] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([cat, count]) => (
                          <span
                            key={cat}
                            className={`text-xs px-1.5 py-0.5 rounded ${categoryColors[cat]}`}
                          >
                            {categoryIcons[cat]} {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Quick Reference */}
            <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-medium mb-3">Quick Reference</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Case #</span>
                  <span>{data.case.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Court</span>
                  <span>Utah 4th District</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Judge</span>
                  <span>Derek Pullan</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Commissioner</span>
                  <span>Marian Ito</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Attorney</span>
                  <span>Zack Starr</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
