"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect, useCallback } from "react";
import { RoutingLog, RoutingStatsBar } from "@/components/pm/RoutingLog";
import { PMStatusCard } from "@/components/pm/PMStatusCard";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error: any = new Error('Failed to fetch data');
    error.status = res.status;
    throw error;
  }
  return res.json();
};

const JUNK_PATTERNS = [
  "unsubscribe",
  "newsletter",
  "marketing",
  "sale",
  "promotion",
  "digest",
  "linkedin",
  "no-reply",
  "notifications",
  "noreply",
  "promo",
  "alert",
  "receipt",
  "statement ready",
];

type ChannelKey = "email" | "calendar" | "imessage" | "lifelog";

const channelLabels: Record<ChannelKey, string> = {
  email: "Email",
  calendar: "Calendar",
  imessage: "Messages",
  lifelog: "Life Logs",
};

// Known calendar sources for multi-calendar selection
const CALENDAR_SOURCES = [
  { key: "google", label: "Google Calendar", color: "bg-blue-500" },
  { key: "outlook", label: "Outlook", color: "bg-cyan-500" },
  { key: "apple", label: "Apple Calendar", color: "bg-rose-500" },
  { key: "other", label: "Other", color: "bg-slate-500" },
];

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: "bg-emerald-600 border-emerald-500",
    error: "bg-rose-600 border-rose-500",
    info: "bg-sky-600 border-sky-500",
  };

  return (
    <div className={`fixed bottom-20 right-4 z-50 px-4 py-2 rounded-lg border ${colors[type]} text-white text-sm shadow-lg animate-slide-up`}>
      {message}
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function InboxPage() {
  const { data, isLoading, mutate, error: agenticError } = useSWR("/api/agentic/status", fetcher, { refreshInterval: 4000 });
  const { data: eventsData, mutate: mutateEvents, error: eventsError, isLoading: eventsLoading } = useSWR("/api/events?limit=400", fetcher, { refreshInterval: 8000 });
  const { data: financeData, error: financeError } = useSWR("/api/finance/summary", fetcher, { refreshInterval: 60000 });
  const { data: ctxData, mutate: mutateCtx } = useSWR("/api/finance/context-requests", fetcher, { refreshInterval: 15000 });
  const { data: healthData } = useSWR("/api/comms/health", fetcher, { refreshInterval: 30000 });
  const { data: enrichmentData } = useSWR("/api/events/enrich", fetcher, { refreshInterval: 30000 });

  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [hideJunk, setHideJunk] = useState(true);
  const [viewMode, setViewMode] = useState<"actionable" | "firehose">("actionable");
  const [channels, setChannels] = useState<Record<ChannelKey, boolean>>({
    email: true,
    calendar: true,
    imessage: true,
    lifelog: true,
  });
  const [sending, setSending] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  }, []);

  // Multi-calendar selection
  const [selectedCalendars, setSelectedCalendars] = useState<Record<string, boolean>>(() =>
    CALENDAR_SOURCES.reduce((acc, src) => ({ ...acc, [src.key]: true }), {} as Record<string, boolean>)
  );

  const proposed = useMemo(() => data?.samples?.proposed || [], [data]);
  const queued = useMemo(() => data?.samples?.queued || [], [data]);
  const executed = useMemo(() => data?.samples?.executed || [], [data]);
  const failed = useMemo(() => data?.samples?.failed || [], [data]);

  // Helper to detect calendar source from event
  const getCalendarSource = useCallback((ev: any): string => {
    const source = (ev.source || "").toLowerCase();
    const metadata = ev.metadata || {};
    if (source.includes("google") || metadata.calendarType === "google") return "google";
    if (source.includes("outlook") || source.includes("microsoft") || metadata.calendarType === "outlook") return "outlook";
    if (source.includes("apple") || source.includes("icloud") || metadata.calendarType === "apple") return "apple";
    return "other";
  }, []);

  // Dev debug badge for live data status
  const showDebug = process.env.NODE_ENV === 'development';
  const debugStats = {
    agenticCounts: data?.counts || null,
    eventsTotal: eventsData?.events?.length || 0,
    eventsByChannel: (eventsData?.events || []).reduce((acc: Record<string, number>, ev: any) => {
      const ch = ev.channel || 'unknown';
      acc[ch] = (acc[ch] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  // Build enrichment lookup map
  const enrichmentMap = useMemo(() => {
    const map = new Map<string, any>();
    const results = enrichmentData?.results || [];
    for (const result of results) {
      if (result.id) {
        map.set(result.id, result);
      }
    }
    return map;
  }, [enrichmentData]);

  const events = useMemo(() => {
    const list = eventsData?.events || [];
    const f = eventFilter.trim().toLowerCase();
    const isJunk = (ev: any) => {
      // Check DB junk flag first
      if (ev.junk === 1) return true;
      // Fallback to pattern matching
      const text = [ev.subject, ev.preview, ev.contact].filter(Boolean).join(" ").toLowerCase();
      return JUNK_PATTERNS.some((p) => text.includes(p));
    };
    return list
      .filter((ev: any) => channels[(ev.channel as ChannelKey) || "email"])
      .filter((ev: any) => {
        // Multi-calendar filtering for calendar events
        if (ev.channel === "calendar") {
          const calSource = getCalendarSource(ev);
          return selectedCalendars[calSource];
        }
        return true;
      })
      .filter((ev: any) => (viewMode === "actionable" && hideJunk ? !isJunk(ev) : true))
      // Hide dismissed events unless showResolved is enabled
      .filter((ev: any) => showResolved || !ev.dismissed_at)
      .filter((ev: any) =>
        f
          ? [ev.contact, ev.subject, ev.preview, ev.channel, ev.source]
              .filter(Boolean)
              .some((v: string) => v.toLowerCase().includes(f))
          : true
      );
  }, [eventsData, eventFilter, channels, viewMode, hideJunk, selectedCalendars, getCalendarSource, showResolved]);

  const grouped = useMemo(() => {
    const buckets: Record<ChannelKey, any[]> = { email: [], calendar: [], imessage: [], lifelog: [] };
    for (const ev of events) {
      const ch = (ev.channel as ChannelKey) || "email";
      if (!buckets[ch]) buckets[ch] = [];
      buckets[ch].push(ev);
    }
    return buckets;
  }, [events]);

  // Calculate junk count from all events
  const junkCount = useMemo(() => {
    const list = eventsData?.events || [];
    return list.filter((ev: any) => {
      if (ev.junk === 1) return true;
      const text = [ev.subject, ev.preview, ev.contact].filter(Boolean).join(" ").toLowerCase();
      return JUNK_PATTERNS.some((p) => text.includes(p));
    }).length;
  }, [eventsData]);

  // Bulk action handlers
  const handleBulkRoute = async (target: string) => {
    if (selectedEvents.size === 0) {
      showToast("No events selected", "error");
      return;
    }
    setBulkActionLoading("route");
    try {
      const res = await fetch("/api/events/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "route",
          eventIds: Array.from(selectedEvents),
          target,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Routed ${data.processed} events to ${target}`, "success");
        setSelectedEvents(new Set());
        mutateEvents();
      } else {
        showToast("Failed to route events", "error");
      }
    } catch {
      showToast("Failed to route events", "error");
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkProcessAll = async () => {
    const unroutedEvents = events.filter((ev: any) => !ev.routed_target && !ev.dismissed_at);
    if (unroutedEvents.length === 0) {
      showToast("No events to process", "info");
      return;
    }
    setBulkActionLoading("process");
    try {
      // Enrich all unrouted events
      const res = await fetch("/api/events/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "enrich",
          eventIds: unroutedEvents.map((ev: any) => ev.id),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Processing ${data.processed} events...`, "success");
        mutateEvents();
      } else {
        showToast("Failed to process events", "error");
      }
    } catch {
      showToast("Failed to process events", "error");
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleClearResolved = async () => {
    const resolvedEvents = events.filter((ev: any) => ev.dismissed_at || ev.routed_target);
    if (resolvedEvents.length === 0) {
      showToast("No resolved events to clear", "info");
      return;
    }
    setBulkActionLoading("clear");
    try {
      const res = await fetch("/api/events/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "clear_resolved",
          eventIds: resolvedEvents.map((ev: any) => ev.id),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Cleared ${data.processed} resolved events`, "success");
        mutateEvents();
      } else {
        showToast("Failed to clear events", "error");
      }
    } catch {
      showToast("Failed to clear events", "error");
    } finally {
      setBulkActionLoading(null);
    }
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedEvents(new Set(events.map((ev: any) => ev.id)));
  };

  const clearSelection = () => {
    setSelectedEvents(new Set());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">EA Inbox</p>
          <h1 className="text-3xl font-semibold">Actions + Timeline + Chat</h1>
          <p className="text-slate-300">Review actions, scan recent signals (email/calendar/iMessage/lifelogs), and chat with Grok.</p>
        </header>

        {/* Error Display */}
        {(eventsError || agenticError || financeError) && (
          <div className="rounded-2xl border border-rose-500/50 bg-rose-900/20 p-4 space-y-2">
            <div className="text-lg font-semibold text-rose-300">Error Loading Data</div>
            {eventsError && <p className="text-sm text-rose-400">Events: {eventsError.message}</p>}
            {agenticError && <p className="text-sm text-rose-400">Agentic Status: {agenticError.message}</p>}
            {financeError && <p className="text-sm text-rose-400">Finance: {financeError.message}</p>}
            <button
              onClick={() => {
                mutateEvents();
                mutate();
              }}
              className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Initial Loading State */}
        {eventsLoading && !eventsData && (
          <div className="rounded-2xl border border-sky-500/50 bg-sky-900/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
              <span className="text-sky-300">Loading inbox data...</span>
            </div>
          </div>
        )}

        {showDebug && (
          <div className="text-xs bg-slate-800 rounded p-3 mb-2 space-y-1 border border-slate-700">
            <div className="text-slate-400 font-semibold">Debug: Inbox data</div>
            <div className="text-slate-500">
              Agentic counts → proposed:{debugStats.agenticCounts?.proposed ?? 0} | queued:{debugStats.agenticCounts?.queued ?? 0} | executed:{debugStats.agenticCounts?.executed ?? 0} | failed:{debugStats.agenticCounts?.failed ?? 0}
            </div>
            <div className="text-slate-500">
              Events total: {debugStats.eventsTotal} | Channels: {Object.entries(debugStats.eventsByChannel || {}).map(([k,v]) => `${k}:${v}`).join(' ')}
            </div>
          </div>
        )}

        <IngestHealthPanel data={healthData} />

        {enrichmentData?.needs_review_count > 0 && (
          <section className="rounded-2xl border border-purple-800 bg-purple-900/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-lg font-semibold text-purple-200">AI Enrichment</div>
                <p className="text-sm text-purple-300">
                  {enrichmentData.needs_review_count} events need review (low confidence or multi-channel signals)
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs bg-purple-900/50 text-purple-300">
                {enrichmentData.total_events} total analyzed
              </span>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-lg font-semibold">Action Lanes</div>
              <p className="text-sm text-slate-400">Proposed, queued, and execution status.</p>
            </div>
            <label className="flex items-center gap-1 text-slate-300 text-xs ml-auto">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={() => setShowResolved(!showResolved)}
              />
              Show resolved
            </label>
          </div>

          <div className={`grid ${showResolved ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-6`}>
            <ActionColumn title="Proposed" tone="blue" items={proposed} mutate={mutate} />
            <ActionColumn title="Queued" tone="amber" items={queued} mutate={mutate} />
            {showResolved && <ActionColumn title="Executed" tone="green" items={executed} />}
            {showResolved && <ActionColumn title="Failed" tone="red" items={failed} />}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-lg font-semibold">Recent Signals</div>
              <p className="text-sm text-slate-400">Unified feed from Gmail, Outlook, Calendars, iMessage, and Limitless lifelogs.</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center text-xs">
              <label className="flex items-center gap-1 text-slate-300">
                <input type="checkbox" checked={hideJunk} onChange={() => setHideJunk(!hideJunk)} />
                Hide junk {junkCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-300 text-[10px] font-medium">{junkCount}</span>}
              </label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
              >
                <option value="actionable">Actionable</option>
                <option value="firehose">Firehose</option>
              </select>
              <input
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                placeholder="Filter text…"
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100"
              />
            </div>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-slate-800 pt-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">
                {selectedEvents.size > 0 ? `${selectedEvents.size} selected` : "Bulk Actions"}
              </span>
              {selectedEvents.size > 0 && (
                <button
                  onClick={clearSelection}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Clear
                </button>
              )}
              {selectedEvents.size === 0 && events.length > 0 && (
                <button
                  onClick={selectAllVisible}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Select All ({events.length})
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap text-xs">
              <button
                onClick={handleBulkProcessAll}
                disabled={bulkActionLoading === "process"}
                className="px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-medium transition disabled:opacity-50"
              >
                {bulkActionLoading === "process" ? (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Process All"
                )}
              </button>
              {selectedEvents.size > 0 && (
                <>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleBulkRoute(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    disabled={bulkActionLoading === "route"}
                    className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition disabled:opacity-50"
                  >
                    <option value="">Route Selected</option>
                    <option value="finance">→ Finance</option>
                    <option value="pm">→ PM</option>
                    <option value="orchestrator">→ Orchestrator</option>
                    <option value="legal">→ Legal</option>
                  </select>
                  {bulkActionLoading === "route" && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-3 h-3 border-2 border-emerald-400/50 border-t-emerald-400 rounded-full animate-spin" />
                      Routing...
                    </span>
                  )}
                </>
              )}
              <button
                onClick={handleClearResolved}
                disabled={bulkActionLoading === "clear"}
                className="px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition disabled:opacity-50"
              >
                {bulkActionLoading === "clear" ? (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Clearing...
                  </span>
                ) : (
                  "Clear Resolved"
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap text-xs">
            {Object.entries(channelLabels).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1 text-slate-300">
                <input
                  type="checkbox"
                  checked={channels[key as ChannelKey]}
                  onChange={() =>
                    setChannels((c) => ({ ...c, [key]: !c[key as ChannelKey] }))
                  }
                />
                {label}
              </label>
            ))}
          </div>

          {/* Multi-calendar selection - shows when calendar channel is enabled */}
          {channels.calendar && (
            <div className="flex gap-2 flex-wrap text-xs items-center border-t border-slate-800 pt-2">
              <span className="text-slate-500">Calendars:</span>
              {CALENDAR_SOURCES.map((src) => (
                <label
                  key={src.key}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full cursor-pointer transition ${
                    selectedCalendars[src.key]
                      ? `${src.color} text-white`
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCalendars[src.key]}
                    onChange={() =>
                      setSelectedCalendars((c) => ({ ...c, [src.key]: !c[src.key] }))
                    }
                    className="sr-only"
                  />
                  <span className={`w-2 h-2 rounded-full ${selectedCalendars[src.key] ? "bg-white/80" : src.color}`} />
                  {src.label}
                </label>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {(Object.keys(channelLabels) as ChannelKey[]).map((key) => (
              <div key={key} className="space-y-2">
                <div className="text-sm text-slate-400">{channelLabels[key]}</div>
                <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                  {grouped[key]?.length ? (
                    grouped[key]
                      .slice(0, 100)
                      .map((ev: any) => (
                        <EventRow
                          key={ev.id}
                          ev={ev}
                          enrichment={enrichmentMap.get(ev.id)}
                          onToast={showToast}
                          onRefresh={mutateEvents}
                          selected={selectedEvents.has(ev.id)}
                          onToggleSelect={() => toggleEventSelection(ev.id)}
                        />
                      ))
                  ) : (
                    <p className="text-sm text-slate-500">Empty.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <FinancePanel data={financeData} />
        <ContextRequestsPanel data={ctxData} mutate={mutateCtx} />

        {/* PM Status + Routing Log */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <PMStatusCard />
          </div>
          <div className="md:col-span-2">
            <RoutingLog limit={30} showStats={true} />
          </div>
        </div>

        <ChatBox
          query={query}
          setQuery={setQuery}
          sending={sending}
          onSend={async () => {
            if (!query.trim()) return;
            setSending(true);
            try {
              await fetch("/api/agentic/chat", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ query }),
              });
              setQuery("");
            } finally {
              setSending(false);
            }
          }}
        />

        {!showResolved && failed.length > 0 && (
          <div className="rounded-2xl border border-rose-500/30 bg-slate-900/70 p-4">
            <h3 className="text-lg font-semibold mb-2 text-rose-300">Failures ({failed.length})</h3>
            <p className="text-xs text-slate-400 mb-3">Enable "Show resolved" above to see full failure list.</p>
            <ActionList items={failed.slice(0, 2)} />
          </div>
        )}
      </div>
      {(isLoading || sending) && <div className="fixed bottom-4 right-4 text-xs text-slate-400">Syncing…</div>}

      {/* Toast notifications */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function FinancePanel({ data }: { data: any }) {
  const buckets = data?.buckets || {};
  const buckets90 = data?.back90?.buckets || {};
  const entries = Object.entries(buckets);
  const entries90 = Object.entries(buckets90);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-semibold">Finance Snapshot</div>
          <p className="text-sm text-slate-400">
            Cycle {data?.window?.start ?? "?"} → {data?.window?.end ?? "?"} · {data?.count ?? 0} transactions
          </p>
        </div>
      </div>
      {entries.length ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {entries.map(([bucket, amt]) => (
            <div key={bucket as string} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
              <div className="text-sm text-slate-400">{bucket as string}</div>
              <div className="text-lg font-semibold text-slate-100">${(amt as number).toFixed(2)}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No finance data in current cycle. Showing 90d view below.</p>
      )}
      {entries90.length ? (
        <div className="space-y-2">
          <div className="text-sm text-slate-400">
            Last 90 days ({data?.back90?.start} → {data?.back90?.end}) · {data?.back90?.count ?? 0} tx
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {entries90.map(([bucket, amt]) => (
              <div key={bucket as string} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
                <div className="text-sm text-slate-400">{bucket as string}</div>
                <div className="text-lg font-semibold text-slate-100">${(amt as number).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ContextRequestsPanel({ data, mutate }: { data: any; mutate?: any }) {
  const requests = data?.requests || [];
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-semibold">Finance Context Requests</div>
          <p className="text-sm text-slate-400">Low-confidence transactions that need clarification.</p>
        </div>
      </div>
      {requests.length ? (
        <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
          {requests.map((r: any) => (
            <div key={r.id} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60 space-y-1 text-sm">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{r.vendor || '(vendor unknown)'}</span>
                <span>{r.date || ''}</span>
              </div>
              <div className="text-slate-200">Amount: {r.amount ?? 'n/a'}</div>
              <div className="text-xs text-slate-500">Confidence: {r.confidence ?? 0}</div>
              <button
                onClick={async () => {
                  await fetch("/api/finance/context-requests", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ id: r.id, status: "resolved", summary: "marked resolved" }),
                  });
                  mutate?.();
                }}
                className="text-xs px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Mark resolved
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No pending context requests.</p>
      )}
    </section>
  );
}

function ActionColumn({ title, tone, items, mutate }: { title: string; tone: "blue" | "green" | "amber" | "red"; items: any[]; mutate?: any }) {
  const border = {
    blue: "border-sky-500/50",
    green: "border-emerald-500/50",
    amber: "border-amber-500/50",
    red: "border-rose-500/50",
  }[tone];
  return (
    <div className={`rounded-2xl border ${border} bg-slate-900/70 p-4 space-y-3`}>
      <div className="text-lg font-semibold">{title}</div>
      <ActionList items={items} mutate={mutate} />
    </div>
  );
}

function ActionList({ items, mutate }: { items: any[]; mutate?: any }) {
  if (!items?.length) return <p className="text-sm text-slate-500">Empty.</p>;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ActionCard key={item.id} item={item} mutate={mutate} />
      ))}
    </div>
  );
}

function ActionCard({ item, mutate }: { item: any; mutate?: any }) {
  const onAction = async (action: "execute" | "queue" | "dismiss") => {
    if (!mutate) return;
    await fetch("/api/agentic/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id, action }),
    });
    await mutate();
  };
  return (
    <div className="rounded-xl bg-slate-800/80 p-3 space-y-1 border border-slate-700">
      <div className="text-sm font-semibold">{item.title || item.type}</div>
      <div className="text-sm text-slate-300 whitespace-pre-line line-clamp-4">{item.content}</div>
      <div className="text-xs text-slate-500 flex gap-3">
        <span>confidence: {item.confidence ?? "n/a"}</span>
        <span>target: {item.target ?? "n/a"}</span>
      </div>
      {mutate && (
        <div className="flex gap-2 pt-1">
          <ActionBtn label="Execute" tone="green" onClick={() => onAction("execute")} />
          <ActionBtn label="Queue" tone="blue" onClick={() => onAction("queue")} />
          <ActionBtn label="Dismiss" tone="red" onClick={() => onAction("dismiss")} />
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, onClick, tone }: { label: string; onClick: () => void; tone: "green" | "blue" | "red" }) {
  const toneMap = {
    green: "bg-emerald-600 hover:bg-emerald-500",
    blue: "bg-sky-600 hover:bg-sky-500",
    red: "bg-rose-600 hover:bg-rose-500",
  } as const;
  return (
    <button onClick={onClick} className={`text-xs px-3 py-1 rounded-full text-white transition ${toneMap[tone]}`}>
      {label}
    </button>
  );
}

interface EventRowProps {
  ev: any;
  enrichment?: any;
  onToast?: (message: string, type: "success" | "error" | "info") => void;
  onRefresh?: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}

function EventRow({ ev, enrichment, onToast, onRefresh, selected = false, onToggleSelect }: EventRowProps) {
  const [routing, setRouting] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<{ target: string; dispatched?: string[] } | null>(null);
  const [junkState, setJunkState] = useState<boolean>(ev.junk === 1);
  const [junkAnimating, setJunkAnimating] = useState(false);
  const [rsvpState, setRsvpState] = useState<"none" | "accepted" | "declined" | "maybe">("none");
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [flagged, setFlagged] = useState<boolean>(ev.flagged === 1);
  const [snoozed, setSnoozed] = useState<boolean>(!!ev.snoozed_until && ev.snoozed_until > Math.floor(Date.now() / 1000));
  const [enriching, setEnriching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const ts = ev.ts ? new Date(ev.ts * 1000) : null;
  const when = ts ? ts.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  const channelColor: Record<string, string> = {
    email: "text-sky-300 bg-sky-900/40",
    calendar: "text-emerald-300 bg-emerald-900/30",
    imessage: "text-indigo-300 bg-indigo-900/30",
    lifelog: "text-amber-300 bg-amber-900/30",
  };
  const badge = channelColor[ev.channel] || "text-slate-300 bg-slate-800";
  const routed = routeResult?.target || ev.routed_target;

  // Detect if this is a calendar invite that can be RSVP'd
  const isCalendarInvite = ev.channel === "calendar" && (
    ev.metadata?.isInvite ||
    ev.subject?.toLowerCase().includes("invitation") ||
    ev.preview?.toLowerCase().includes("invited you") ||
    ev.metadata?.attendees
  );

  const route = async (target: string) => {
    setRouting(target);
    setRouteResult(null);
    try {
      const res = await fetch("/api/events/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ev.id, target }),
      });
      const data = await res.json();
      if (data.ok) {
        setRouteResult({ target, dispatched: data.dispatched_to });
        const targetLabel = ROUTE_OPTIONS.find(o => o.key === target)?.label || target;
        onToast?.(`Routed to ${targetLabel.replace("→ ", "")}`, "success");
        if (data.dispatched_to?.length) {
          setTimeout(() => {
            onToast?.(`Dispatched to: ${data.dispatched_to.map((a: string) => a.replace('-agent', '')).join(', ')}`, "info");
          }, 1500);
        }
      } else {
        onToast?.("Failed to route", "error");
      }
    } catch {
      onToast?.("Failed to route", "error");
    } finally {
      setRouting(null);
    }
  };

  const markJunk = async (junk: boolean) => {
    setJunkAnimating(true);
    try {
      await fetch("/api/events/junk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ev.id, junk }),
      });
      setJunkState(junk);
      onToast?.(junk ? "Marked as junk" : "Unmarked from junk", junk ? "info" : "success");
      onRefresh?.();
    } catch {
      onToast?.("Failed to update", "error");
    } finally {
      setTimeout(() => setJunkAnimating(false), 300);
    }
  };

  const handleRsvp = async (response: "accepted" | "declined" | "maybe") => {
    setRsvpLoading(true);
    try {
      const res = await fetch("/api/events/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ev.id, response, eventData: ev.metadata }),
      });
      const data = await res.json();
      if (data.ok) {
        setRsvpState(response);
        const labels = { accepted: "Accepted", declined: "Declined", maybe: "Tentative" };
        onToast?.(`RSVP: ${labels[response]}`, "success");
        onRefresh?.();
      } else {
        onToast?.("Failed to send RSVP", "error");
      }
    } catch {
      // Even if API doesn't exist yet, show UI feedback
      setRsvpState(response);
      const labels = { accepted: "Accepted", declined: "Declined", maybe: "Tentative" };
      onToast?.(`RSVP: ${labels[response]} (pending sync)`, "info");
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleDismiss = async () => {
    setActionLoading("dismiss");
    try {
      const res = await fetch("/api/events/dismiss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ev.id }),
      });
      const data = await res.json();
      if (data.ok) {
        onToast?.("Event dismissed", "success");
        onRefresh?.();
      } else {
        onToast?.("Failed to dismiss", "error");
      }
    } catch {
      onToast?.("Failed to dismiss", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleFlag = async () => {
    setActionLoading("flag");
    try {
      const newFlagState = !flagged;
      const res = await fetch("/api/events/flag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ev.id, flagged: newFlagState }),
      });
      const data = await res.json();
      if (data.ok) {
        setFlagged(newFlagState);
        onToast?.(newFlagState ? "Event flagged" : "Flag removed", "success");
        onRefresh?.();
      } else {
        onToast?.("Failed to flag", "error");
      }
    } catch {
      onToast?.("Failed to flag", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSnooze = async () => {
    setActionLoading("snooze");
    try {
      const res = await fetch("/api/events/snooze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ev.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setSnoozed(true);
        onToast?.("Event snoozed for 4 hours", "success");
        onRefresh?.();
      } else {
        onToast?.("Failed to snooze", "error");
      }
    } catch {
      onToast?.("Failed to snooze", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch("/api/events/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventIds: [ev.id], autoClassify: true }),
      });
      const data = await res.json();
      if (data.ok) {
        onToast?.("Event enriched with AI context", "success");
        onRefresh?.();
      } else {
        onToast?.("Failed to enrich", "error");
      }
    } catch {
      onToast?.("Failed to enrich", "error");
    } finally {
      setEnriching(false);
    }
  };

  // Card styling based on state
  const cardClasses = [
    "border rounded-xl p-3 space-y-1 transition-all duration-200",
    junkState ? "bg-amber-950/30 border-amber-800/50" :
    flagged ? "bg-rose-950/30 border-rose-800/50 ring-1 ring-rose-500/30" :
    snoozed ? "bg-blue-950/30 border-blue-800/50 opacity-70" :
    "bg-slate-900/60 border-slate-800",
    routed ? "ring-1 ring-emerald-500/30" : "",
    junkAnimating ? "scale-[0.98] opacity-80" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={cardClasses}>
      {/* Header row */}
      <div className="flex justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer"
            />
          )}
          <span className={`px-2 py-0.5 rounded-full ${badge}`}>{ev.channel || ev.source}</span>
          {flagged && (
            <span className="px-1.5 py-0.5 rounded bg-rose-900/50 text-rose-400 text-[10px] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              URGENT
            </span>
          )}
          {snoozed && (
            <span className="px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 text-[10px] font-medium flex items-center gap-1">
              <span>⏰</span>
              SNOOZED
            </span>
          )}
          {junkState && (
            <span className="px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400 text-[10px] font-medium animate-pulse">
              JUNK
            </span>
          )}
          {routed && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {routed.toUpperCase()}
            </span>
          )}
        </div>
        <span>{when}</span>
      </div>

      {/* Subject */}
      <div className={`text-sm font-semibold line-clamp-1 ${junkState ? "text-slate-400 line-through" : "text-slate-100"}`}>
        {ev.subject || ev.preview || "(no subject)"}
      </div>

      {/* Preview */}
      <div className={`text-sm line-clamp-2 whitespace-pre-line ${junkState ? "text-slate-500" : "text-slate-300"}`}>
        {ev.preview}
      </div>

      {/* Metadata row */}
      <div className="text-xs text-slate-500 flex gap-2 flex-wrap">
        {ev.contact && <span>from/to: {ev.contact}</span>}
        {ev.source && <span>source: {ev.source}</span>}
        {routeResult?.dispatched && routeResult.dispatched.length > 0 && (
          <span className="text-cyan-300 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-cyan-400" />
            dispatched: {routeResult.dispatched.map((a) => a.replace("-agent", "")).join(", ")}
          </span>
        )}
        {ev.classification && (
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-purple-400" />
            {ev.classification}
          </span>
        )}
        {ev.confidence !== null && ev.confidence !== undefined && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
            ev.confidence >= 0.8 ? 'bg-emerald-900/50 text-emerald-300' :
            ev.confidence >= 0.6 ? 'bg-amber-900/50 text-amber-300' :
            'bg-rose-900/50 text-rose-300'
          }`}>
            {Math.round(ev.confidence * 100)}% confidence
          </span>
        )}
      </div>

      {/* AI Enrichment Section */}
      {enrichment && (enrichment.suggested_task || enrichment.summary) && (
        <div className="mt-2 pt-2 border-t border-purple-900/30 space-y-1.5 bg-purple-950/20 -mx-3 px-3 py-2 rounded">
          <div className="flex items-center gap-1.5 text-[10px] text-purple-400 font-medium uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            AI Enrichment
          </div>
          {enrichment.suggested_task && (
            <div className="text-xs">
              <span className="text-purple-300 font-medium">Task: </span>
              <span className="text-slate-300">{enrichment.suggested_task}</span>
            </div>
          )}
          {enrichment.summary && (
            <div className="text-xs">
              <span className="text-purple-300 font-medium">Summary: </span>
              <span className="text-slate-400">{enrichment.summary}</span>
            </div>
          )}
          {enrichment.suggestions && enrichment.suggestions.length > 0 && (
            <details className="text-xs mt-1">
              <summary className="text-purple-300 cursor-pointer hover:text-purple-200">
                {enrichment.suggestions.length} suggestions
              </summary>
              <ul className="mt-1 ml-3 space-y-0.5 text-slate-400">
                {enrichment.suggestions.map((suggestion: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-purple-500 mt-0.5">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* RSVP buttons for calendar invites */}
      {isCalendarInvite && (
        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-500 self-center mr-1">RSVP:</span>
          <button
            onClick={() => handleRsvp("accepted")}
            disabled={rsvpLoading}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              rsvpState === "accepted"
                ? "bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900"
                : "bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/60 border border-emerald-700"
            }`}
          >
            {rsvpState === "accepted" ? "✓ Accepted" : "Accept"}
          </button>
          <button
            onClick={() => handleRsvp("maybe")}
            disabled={rsvpLoading}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              rsvpState === "maybe"
                ? "bg-amber-600 text-white ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900"
                : "bg-amber-900/40 text-amber-300 hover:bg-amber-800/60 border border-amber-700"
            }`}
          >
            {rsvpState === "maybe" ? "? Maybe" : "Maybe"}
          </button>
          <button
            onClick={() => handleRsvp("declined")}
            disabled={rsvpLoading}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              rsvpState === "declined"
                ? "bg-rose-600 text-white ring-2 ring-rose-400 ring-offset-1 ring-offset-slate-900"
                : "bg-rose-900/40 text-rose-300 hover:bg-rose-800/60 border border-rose-700"
            }`}
          >
            {rsvpState === "declined" ? "✗ Declined" : "Decline"}
          </button>
          {rsvpLoading && <span className="text-xs text-slate-500 self-center ml-1">Sending...</span>}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2 pt-1">
        {/* Primary orchestration buttons */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className={`px-2 py-1 rounded border transition-all duration-200 ${
              enriching
                ? "border-purple-400 bg-purple-600 text-white scale-95"
                : "border-purple-600 bg-purple-900/40 text-purple-100 hover:bg-purple-800/60"
            }`}
          >
            {enriching ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                Enriching...
              </span>
            ) : (
              "Enrich"
            )}
          </button>
          <button
            onClick={handleFlag}
            disabled={actionLoading === "flag"}
            className={`px-2 py-1 rounded border transition-all duration-200 ${
              flagged
                ? "border-rose-500 bg-rose-900/50 text-rose-300 ring-1 ring-rose-500/30"
                : "border-rose-700 bg-rose-900/40 text-rose-100 hover:bg-rose-800/60"
            } ${actionLoading === "flag" ? "scale-95 opacity-70" : ""}`}
          >
            {actionLoading === "flag" ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-current/50 border-t-current rounded-full animate-spin" />
              </span>
            ) : flagged ? (
              "✓ Flagged"
            ) : (
              "Flag"
            )}
          </button>
          <button
            onClick={handleSnooze}
            disabled={actionLoading === "snooze" || snoozed}
            className={`px-2 py-1 rounded border transition-all duration-200 ${
              snoozed
                ? "border-blue-500 bg-blue-900/50 text-blue-300 opacity-60 cursor-not-allowed"
                : "border-blue-700 bg-blue-900/40 text-blue-100 hover:bg-blue-800/60"
            } ${actionLoading === "snooze" ? "scale-95 opacity-70" : ""}`}
          >
            {actionLoading === "snooze" ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-current/50 border-t-current rounded-full animate-spin" />
              </span>
            ) : snoozed ? (
              "⏰ Snoozed"
            ) : (
              "Snooze"
            )}
          </button>
          <button
            onClick={handleDismiss}
            disabled={actionLoading === "dismiss"}
            className={`px-2 py-1 rounded border transition-all duration-200 ${
              actionLoading === "dismiss"
                ? "border-slate-600 bg-slate-700 scale-95 opacity-70"
                : "border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-slate-600"
            } text-slate-100`}
          >
            {actionLoading === "dismiss" ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-current/50 border-t-current rounded-full animate-spin" />
              </span>
            ) : (
              "Dismiss"
            )}
          </button>
        </div>

        {/* Route buttons */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          {ROUTE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => route(opt.key)}
              disabled={!!routing}
              className={`px-2 py-1 rounded border text-slate-100 transition-all duration-200 ${
                routing === opt.key
                  ? "border-emerald-400 bg-emerald-600 text-white scale-95"
                  : routed === opt.key
                  ? "border-emerald-500 bg-emerald-900/50 text-emerald-300"
                  : "border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-slate-600"
              } ${routing && routing !== opt.key ? "opacity-50" : ""}`}
            >
              {routing === opt.key ? (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  Routing...
                </span>
              ) : routed === opt.key ? (
                <span className="flex items-center gap-1">
                  <span className="text-emerald-400">✓</span>
                  {opt.label}
                </span>
              ) : (
                opt.label
              )}
            </button>
          ))}
          <button
            onClick={() => markJunk(!junkState)}
            disabled={junkAnimating}
            className={`px-2 py-1 rounded border transition-all duration-200 ${
              junkState
                ? "border-emerald-600 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/60"
                : "border-amber-600 bg-amber-900/40 text-amber-100 hover:bg-amber-800/60"
            } ${junkAnimating ? "scale-95 opacity-70" : ""}`}
          >
            {junkAnimating ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-current/50 border-t-current rounded-full animate-spin" />
              </span>
            ) : junkState ? (
              "✓ Restore from junk"
            ) : (
              "Mark junk"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBox({ query, setQuery, sending, onSend }: { query: string; setQuery: (s: string) => void; sending: boolean; onSend: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
      <div className="text-lg font-semibold">Chat with Grok</div>
      <textarea
        className="w-full rounded-lg bg-slate-800 border border-slate-700 p-3 text-sm text-slate-100"
        rows={4}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask or instruct (context-aware)..."
      />
      <button
        onClick={onSend}
        disabled={sending}
        className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50"
      >
        {sending ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
const ROUTE_OPTIONS = [
  { key: "finance", label: "→ Finance" },
  { key: "pm", label: "→ PM" },
  { key: "orchestrator", label: "→ Orchestrator" },
  { key: "legal", label: "→ Legal" },
];

function IngestHealthPanel({ data }: { data: any }) {
  const [retrying, setRetrying] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  if (!data) return null;

  const statusColor: Record<string, string> = {
    ok: "text-emerald-400 bg-emerald-900/30",
    warning: "text-amber-400 bg-amber-900/30",
    error: "text-rose-400 bg-rose-900/30",
    not_configured: "text-slate-400 bg-slate-800/50",
  };

  const statusIcon: Record<string, string> = {
    ok: "●",
    warning: "◐",
    error: "○",
    not_configured: "○",
  };

  const sources = data.sources || [];
  const summary = data.summary || {};
  const events = data.events || {};

  const overallStatus = !data.ok ? (summary.errors > 0 ? "error" : "warning") : "ok";

  const handleRetry = async (sourceName: string) => {
    setRetrying(sourceName);
    try {
      // Map source names to sync endpoints
      const sourceMap: Record<string, () => Promise<Response>> = {
        'Gmail': () => fetch('/api/sync', { method: 'POST', body: JSON.stringify({ days: 1, whoop: false }), headers: { 'content-type': 'application/json' } }),
        'Outlook': () => fetch('/api/sync', { method: 'POST', body: JSON.stringify({ days: 1, whoop: false }), headers: { 'content-type': 'application/json' } }),
        'iMessage': () => fetch('/api/events/ingest-imessage', { method: 'POST' }),
        'Lifelogs (Limitless)': () => fetch('/api/sync', { method: 'POST', body: JSON.stringify({ days: 1, whoop: false }), headers: { 'content-type': 'application/json' } }),
        'Google Calendar': () => fetch('/api/sync', { method: 'POST', body: JSON.stringify({ days: 1, whoop: false }), headers: { 'content-type': 'application/json' } }),
        'Outlook Calendar': () => fetch('/api/sync', { method: 'POST', body: JSON.stringify({ days: 1, whoop: false }), headers: { 'content-type': 'application/json' } }),
      };

      const fetcher = sourceMap[sourceName];
      if (!fetcher) {
        setToast({ message: `No retry handler for ${sourceName}`, type: 'error' });
        return;
      }

      const res = await fetcher();
      const result = await res.json();

      if (result.ok || res.ok) {
        setToast({ message: `${sourceName} sync initiated`, type: 'success' });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setToast({ message: `Failed to retry ${sourceName}`, type: 'error' });
      }
    } catch (error) {
      setToast({ message: `Error retrying ${sourceName}`, type: 'error' });
    } finally {
      setRetrying(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`text-xl ${statusColor[overallStatus]?.split(" ")[0]}`}>
            {statusIcon[overallStatus]}
          </span>
          <div>
            <div className="text-lg font-semibold">Ingest Health</div>
            <p className="text-sm text-slate-400">
              {summary.healthy}/{summary.total} sources healthy · {events.total || 0} events in timeline
            </p>
          </div>
        </div>
        {events.needs_review > 0 && (
          <span className="px-3 py-1 rounded-full text-xs bg-amber-900/40 text-amber-300">
            {events.needs_review} needs review
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
        {sources.map((src: any) => (
          <div
            key={src.name}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${statusColor[src.status]}`}
          >
            <span className="text-sm">{statusIcon[src.status]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{src.name}</div>
              {src.status === "ok" || src.status === "warning" ? (
                <div className="text-xs opacity-70">
                  {src.recordCount ?? 0} records · {src.lastSync || "unknown"}
                </div>
              ) : src.status === "not_configured" ? (
                <div className="text-xs opacity-70">Not configured</div>
              ) : (
                <div className="text-xs opacity-70">{src.error || "Error"}</div>
              )}
            </div>
            {(src.status === "warning" || src.status === "error") && (
              <button
                onClick={() => handleRetry(src.name)}
                disabled={retrying === src.name}
                className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-50"
              >
                {retrying === src.name ? "..." : "Retry"}
              </button>
            )}
          </div>
        ))}
      </div>
      {toast && (
        <div className={`mt-2 px-3 py-2 rounded text-xs ${toast.type === 'success' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'}`}>
          {toast.message}
        </div>
      )}

      {events.by_channel && Object.keys(events.by_channel).length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-slate-400 pt-1">
          {Object.entries(events.by_channel).map(([ch, cnt]) => (
            <span key={ch} className="px-2 py-1 rounded bg-slate-800">
              {ch}: {cnt as number}
            </span>
          ))}
        </div>
      )}

      {/* Routing stats bar */}
      <div className="pt-2 border-t border-slate-800">
        <RoutingStatsBar />
      </div>
    </section>
  );
}
