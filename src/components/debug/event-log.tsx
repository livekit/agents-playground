import {
  ALL_SESSION_EVENT_TYPES,
  type SessionEventType,
  agentStateLabel,
  eventTypeLabel,
  timestampToSeconds,
  userStateLabel,
} from "@/lib/types";
import { AgentSession } from "@livekit/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TYPE_FILTER_STYLE: Record<
  SessionEventType,
  { background: string; color: string }
> = {
  agentStateChanged: {
    background: "rgba(6, 182, 212, 0.16)",
    color: "#22D3EE",
  },
  userStateChanged: {
    background: "rgba(59, 130, 246, 0.16)",
    color: "#60A5FA",
  },
  conversationItemAdded: {
    background: "rgba(16, 185, 129, 0.16)",
    color: "#34D399",
  },
  userInputTranscribed: {
    background: "rgba(132, 204, 22, 0.16)",
    color: "#A3E635",
  },
  functionToolsExecuted: {
    background: "rgba(139, 92, 246, 0.16)",
    color: "#A78BFA",
  },
  error: { background: "rgba(239, 68, 68, 0.2)", color: "#F87171" },
  overlappingSpeech: {
    background: "rgba(245, 158, 11, 0.16)",
    color: "#FBBF24",
  },
  sessionUsageUpdated: {
    background: "rgba(148, 163, 184, 0.16)",
    color: "#94A3B8",
  },
};

const CONTROL_BUTTON_CLASS =
  "text-xs px-2 py-0.5 rounded transition-colors hover:text-[var(--lk-dbg-fg)] hover:bg-[var(--lk-dbg-control-hover)]";
const CONTROL_BUTTON_STYLE = {
  color: "var(--lk-dbg-fg5)",
  background: "var(--lk-dbg-control-bg)",
  borderRadius: "var(--lk-dbg-radius)",
} as const;

export const ALL_EVENT_TYPES: SessionEventType[] = ALL_SESSION_EVENT_TYPES;

export const DEFAULT_DISABLED_EVENT_TYPES = new Set<SessionEventType>([
  "sessionUsageUpdated",
]);

const GRID_COLUMNS = "minmax(0px,24ch) minmax(0px,28ch) minmax(0px,1fr)";
const TABLE_HEADER_HEIGHT = 24;
const ROW_HEIGHT = 37;
const TABLE_ROW_CLASS = "grid grid-rows-1 gap-2";

function eventSummary(event: AgentSession.AgentSessionEvent): string {
  switch (event.event.case) {
    case "agentStateChanged":
      return `${agentStateLabel(event.event.value.oldState)} → ${agentStateLabel(event.event.value.newState)}`;
    case "userStateChanged":
      return `${userStateLabel(event.event.value.oldState)} → ${userStateLabel(event.event.value.newState)}`;
    case "conversationItemAdded": {
      const item = event.event.value.item;
      if (!item) return "";
      if (item.item.case === "message") {
        const textParts = item.item.value.content
          .filter((c) => c.payload.case === "text")
          .map((c) => c.payload.value);
        return textParts.join(" ").slice(0, 80);
      }
      return item.item.case ?? "";
    }
    case "userInputTranscribed":
      return `${event.event.value.isFinal ? "[final]" : "[partial]"} "${event.event.value.transcript}"`;
    case "functionToolsExecuted":
      return `${event.event.value.functionCalls.length} function call(s)`;
    case "error":
      return event.event.value.message;
    case "overlappingSpeech":
      return event.event.value.isInterruption ? "interruption" : "backchannel";
    case "sessionUsageUpdated":
      return `${event.event.value.usage?.modelUsage.length ?? 0} model(s)`;
    default:
      return "";
  }
}

function formatTimestamp(createdAt: number): string {
  const date = new Date(createdAt * 1000);
  const datePart = date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const [hms, meridiem = ""] = timePart.split(" ");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${datePart}, ${hms}.${ms}${meridiem ? ` ${meridiem}` : ""}`;
}

function ClipboardIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5h18" />
      <path d="M6 12h12" />
      <path d="M10 19h4" />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text).catch(() => {});
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    },
    [text],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded transition-colors hover:bg-[var(--lk-dbg-bg3)]"
      style={{
        color: copied ? "var(--lk-dbg-success, #23DE6B)" : "var(--lk-dbg-fg5)",
      }}
      title={copied ? "Copied!" : "Copy JSON"}
    >
      {copied ? <CheckIcon /> : <ClipboardIcon />}
    </button>
  );
}

function EventTypeBadge({ type }: { type: SessionEventType }) {
  const colors = TYPE_FILTER_STYLE[type];
  return (
    <span
      className="inline-flex items-center justify-center rounded-md px-1.5 py-0.5 font-semibold tracking-wider uppercase whitespace-nowrap select-none"
      style={{
        fontSize: "0.63rem",
        lineHeight: "0.95rem",
        background: colors.background,
        color: colors.color,
      }}
    >
      {eventTypeLabel(type)}
    </span>
  );
}

export type EventLogProps = {
  events: AgentSession.AgentSessionEvent[];
  enabledTypes: Set<SessionEventType>;
  onEnabledTypesChange: (types: Set<SessionEventType>) => void;
  onClear?: () => void;
  className?: string;
};

type EventRow = {
  event: AgentSession.AgentSessionEvent;
  index: number;
};

export function EventLog({
  events,
  enabledTypes,
  onEnabledTypesChange,
  onClear,
  className,
}: EventLogProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const allTypes = ALL_EVENT_TYPES;

  const isDefaultTypeFilter = useMemo(() => {
    const defaultEnabled = allTypes.filter(
      (t) => !DEFAULT_DISABLED_EVENT_TYPES.has(t),
    );
    if (enabledTypes.size !== defaultEnabled.length) return false;
    return defaultEnabled.every((t) => enabledTypes.has(t));
  }, [allTypes, enabledTypes]);

  const hasActiveFilter = !isDefaultTypeFilter;

  const toggleType = useCallback(
    (t: SessionEventType) => {
      const next = new Set(enabledTypes);
      if (next.has(t)) {
        next.delete(t);
      } else {
        next.add(t);
      }
      onEnabledTypesChange(next);
    },
    [enabledTypes, onEnabledTypesChange],
  );

  const resetTypes = useCallback(() => {
    onEnabledTypesChange(
      new Set(allTypes.filter((t) => !DEFAULT_DISABLED_EVENT_TYPES.has(t))),
    );
  }, [allTypes, onEnabledTypesChange]);

  const isolateOrRestoreType = useCallback(
    (t: SessionEventType) => {
      const isActive = enabledTypes.has(t);
      if (isActive) {
        if (enabledTypes.size === 1) {
          onEnabledTypesChange(new Set(allTypes));
        } else {
          onEnabledTypesChange(new Set([t]));
        }
      } else {
        onEnabledTypesChange(new Set([t]));
      }
    },
    [enabledTypes, onEnabledTypesChange, allTypes],
  );

  const filtered = useMemo<EventRow[]>(() => {
    const next: EventRow[] = [];
    for (let index = events.length - 1; index >= 0; index--) {
      const event = events[index];
      const eventCase = event.event.case;
      if (!eventCase || !enabledTypes.has(eventCase)) continue;
      next.push({ event, index });
    }
    return next;
  }, [events, enabledTypes]);

  useEffect(() => {
    if (expandedIndex !== null && expandedIndex >= events.length) {
      setExpandedIndex(null);
    }
  }, [events.length, expandedIndex]);

  return (
    <div
      data-slot="event-log"
      className={`flex flex-col h-full w-full text-xs${className ? ` ${className}` : ""}`}
      style={{ background: "var(--lk-dbg-bg)", color: "var(--lk-dbg-fg3)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-1.5 border-b shrink-0"
        style={{ borderColor: "var(--lk-dbg-border)" }}
      >
        <button
          onClick={() => setShowFilter((v) => !v)}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md border transition-colors"
          style={{
            borderColor: "var(--lk-dbg-border)",
            color: showFilter ? "var(--lk-dbg-fg)" : "var(--lk-dbg-fg5)",
            background: showFilter
              ? "var(--lk-dbg-bg3)"
              : "var(--lk-dbg-control-bg)",
          }}
          title={showFilter ? "Hide filters" : "Show filters"}
          aria-label={showFilter ? "Hide filters" : "Show filters"}
        >
          <FilterIcon />
        </button>
        <span className="text-xs" style={{ color: "var(--lk-dbg-fg5)" }}>
          {filtered.length} events
        </span>
        <div className="flex-1" />
        {onClear && (
          <button
            onClick={onClear}
            className={CONTROL_BUTTON_CLASS}
            style={CONTROL_BUTTON_STYLE}
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {showFilter && (
          <aside
            className="w-64 shrink-0 border-r overflow-y-auto lk-dbg-thin-scroll"
            style={{
              borderColor: "var(--lk-dbg-border)",
              background: "var(--lk-dbg-bg2)",
            }}
          >
            <div className="p-3">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--lk-dbg-fg)" }}
                >
                  Event types
                </span>
                <button
                  onClick={resetTypes}
                  className="text-xs px-2 py-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-default"
                  disabled={!hasActiveFilter}
                  style={{
                    color: "var(--lk-dbg-fg5)",
                    background: "var(--lk-dbg-bg3)",
                  }}
                >
                  Reset
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {ALL_EVENT_TYPES.map((t) => {
                  const colors = TYPE_FILTER_STYLE[t];
                  const enabled = enabledTypes.has(t);
                  return (
                    <div key={t}>
                      <div className="flex items-center gap-2 px-1 py-1.5">
                        <button
                          onClick={() => toggleType(t)}
                          className="h-4 w-4 shrink-0 rounded border inline-flex items-center justify-center transition-colors"
                          style={{
                            borderColor: "var(--lk-dbg-fg4)",
                            color: enabled
                              ? "var(--lk-dbg-fg3)"
                              : "transparent",
                            background: "transparent",
                          }}
                          title={
                            enabled ? "Disable event type" : "Enable event type"
                          }
                          aria-label={
                            enabled ? "Disable event type" : "Enable event type"
                          }
                        >
                          <CheckSmallIcon />
                        </button>
                        <button
                          onClick={() => isolateOrRestoreType(t)}
                          className="flex-1 text-left text-xs truncate uppercase tracking-wide"
                          style={{
                            color: enabled
                              ? "var(--lk-dbg-fg)"
                              : "var(--lk-dbg-fg5)",
                          }}
                          title={
                            enabled
                              ? "Click to isolate this event type"
                              : "Click to show only this event type"
                          }
                        >
                          {eventTypeLabel(t)}
                        </button>
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ background: colors.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div
            className={`shrink-0 ${TABLE_ROW_CLASS} items-center border-b px-4`}
            style={{
              gridTemplateColumns: GRID_COLUMNS,
              height: TABLE_HEADER_HEIGHT,
              background: "var(--lk-dbg-bg2)",
              borderColor: "var(--lk-dbg-border)",
              color: "var(--lk-dbg-fg5)",
              fontSize: "0.75rem",
            }}
          >
            <span className="py-0.5">Timestamp</span>
            <span className="py-0.5">Event</span>
            <span className="py-0.5">Message</span>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden lk-dbg-thin-scroll">
            {filtered.length === 0 && (
              <div
                className="flex items-center justify-center h-full text-xs"
                style={{ color: "var(--lk-dbg-fg5)" }}
              >
                No events yet
              </div>
            )}
            {filtered.map(({ event, index }) => {
              const isExpanded = expandedIndex === index;
              const eventCase = event.event.case;
              if (!eventCase) return null;
              const jsonText = event.toJsonString({ prettySpaces: 2 });
              const colors = TYPE_FILTER_STYLE[eventCase];
              const createdAt = timestampToSeconds(event.createdAt);
              return (
                <div
                  key={index}
                  className={`${TABLE_ROW_CLASS} border-b border-l-2 border-l-transparent cursor-pointer px-4 transition-colors hover:bg-[var(--lk-dbg-bg2)]`}
                  style={{
                    borderColor: "var(--lk-dbg-border)",
                    gridTemplateColumns: GRID_COLUMNS,
                    ...(isExpanded
                      ? {
                          background: "var(--lk-dbg-bg3)",
                          borderLeftColor: colors.color,
                        }
                      : {}),
                  }}
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <span
                    className="flex items-center truncate py-2 font-mono"
                    style={{
                      color: "var(--lk-dbg-fg5)",
                      minHeight: ROW_HEIGHT,
                    }}
                  >
                    {formatTimestamp(createdAt)}
                  </span>
                  <span
                    className="flex items-center truncate py-2"
                    style={{ minHeight: ROW_HEIGHT }}
                  >
                    <EventTypeBadge type={eventCase} />
                  </span>
                  <span
                    className="flex items-center truncate py-2"
                    style={{
                      color: "var(--lk-dbg-fg3)",
                      minHeight: ROW_HEIGHT,
                    }}
                    title={eventCase}
                  >
                    {eventSummary(event)}
                  </span>
                  {isExpanded && (
                    <div className="relative col-span-3 pb-2">
                      <div className="absolute top-1 right-4">
                        <CopyButton text={jsonText} />
                      </div>
                      <pre
                        className="text-[10px] overflow-x-auto whitespace-pre-wrap break-all pr-8"
                        style={{ color: "var(--lk-dbg-fg5)" }}
                      >
                        {jsonText}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
