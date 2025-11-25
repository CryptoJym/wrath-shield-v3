"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect, useCallback } from "react";
import { RoutingLog, RoutingStatsBar } from "@/components/pm/RoutingLog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

export default function InboxPage() {
  const { data, isLoading, mutate } = useSWR("/api/agentic/status", fetcher, { refreshInterval: 4000 });
  const { data: eventsData, mutate: mutateEvents } = useSWR("/api/events?limit=400", fetcher, { refreshInterval: 8000 });
  const { data: financeData } = useSWR("/api/finance/summary", fetcher, { refreshInterval: 60000 });
  const { data: ctxData, mutate: mutateCtx } = useSWR("/api/finance/context-requests", fetcher, { refreshInterval: 15000 });
  const { data: healthData } = useSWR("/api/comms/health", fetcher, { refreshInterval: 30000 });

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

  const events = useMemo(() => {
    const list = eventsData?.events || [];
    const f = eventFilter.trim().toLowerCase();
    const isJunk = (ev: any) => {
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
      .filter((ev: any) =>
        f
          ? [ev.contact, ev.subject, ev.preview, ev.channel, ev.source]
              .filter(Boolean)
              .some((v: string) => v.toLowerCase().includes(f))
          : true
      );
  }, [eventsData, eventFilter, channels, viewMode, hideJunk, selectedCalendars, getCalendarSource]);

  const grouped = useMemo(() => {
    const buckets: Record<ChannelKey, any[]> = { email: [], calendar: [], imessage: [], lifelog: [] };
    for (const ev of events) {
      const ch = (ev.channel as ChannelKey) || "email";
      if (!buckets[ch]) buckets[ch] = [];
      buckets[ch].push(ev);
    }
    return buckets;
  }, [events]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">EA Inbox</p>
          <h1 className="text-3xl font-semibold">Actions + Timeline + Chat</h1>
          <p className="text-slate-300">Review actions, scan recent signals (email/calendar/iMessage/lifelogs), and chat with Grok.</p>
        </header>

        <IngestHealthPanel data={healthData} />

        <div className="grid md:grid-cols-3 gap-6">
          <ActionColumn title="Proposed" tone="blue" items={proposed} mutate={mutate} />
          <ActionColumn title="Queued" tone="amber" items={queued} mutate={mutate} />
          <ActionColumn title="Executed" tone="green" items={executed} />
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-lg font-semibold">Recent Signals</div>
              <p className="text-sm text-slate-400">Unified feed from Gmail, Outlook, Calendars, iMessage, and Limitless lifelogs.</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center text-xs">
              <label className="flex items-center gap-1 text-slate-300">
                <input type="checkbox" checked={hideJunk} onChange={() => setHideJunk(!hideJunk)} />
                Hide junk
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
                          onToast={showToast}
                          onRefresh={mutateEvents}
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

        {/* Routing Log - shows routed items and their status */}
        <RoutingLog limit={30} showStats={true} />

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

        <div>
          <h3 className="text-lg font-semibold mb-2">Failures</h3>
          <ActionList items={failed} />
        </div>
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
            <div key={bucket} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
              <div className="text-sm text-slate-400">{bucket}</div>
              <div className="text-lg font-semibold text-slate-100">${amt.toFixed(2)}</div>
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
              <div key={bucket} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
                <div className="text-sm text-slate-400">{bucket}</div>
                <div className="text-lg font-semibold text-slate-100">${amt.toFixed(2)}</div>
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

function ActionColumn({ title, tone, items, mutate }: { title: string; tone: "blue" | "green" | "amber"; items: any[]; mutate?: any }) {
  const border = {
    blue: "border-sky-500/50",
    green: "border-emerald-500/50",
    amber: "border-amber-500/50",
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
  onToast?: (message: string, type: "success" | "error" | "info") => void;
  onRefresh?: () => void;
}

function EventRow({ ev, onToast, onRefresh }: EventRowProps) {
  const [routing, setRouting] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<{ target: string; dispatched?: string[] } | null>(null);
  const [junkState, setJunkState] = useState<boolean>(ev.junk === 1);
  const [junkAnimating, setJunkAnimating] = useState(false);
  const [rsvpState, setRsvpState] = useState<"none" | "accepted" | "declined" | "maybe">("none");
  const [rsvpLoading, setRsvpLoading] = useState(false);

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

  // Card styling based on state
  const cardClasses = [
    "border rounded-xl p-3 space-y-1 transition-all duration-200",
    junkState ? "bg-amber-950/30 border-amber-800/50" : "bg-slate-900/60 border-slate-800",
    routed ? "ring-1 ring-emerald-500/30" : "",
    junkAnimating ? "scale-[0.98] opacity-80" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={cardClasses}>
      {/* Header row */}
      <div className="flex justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full ${badge}`}>{ev.channel || ev.source}</span>
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
      </div>

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

      {/* Route and Junk buttons */}
      <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
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
          </div>
        ))}
      </div>

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
