import type {
  ClientEvent,
  ClientEventType,
  ClientMetricsCollectedEvent,
} from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_FILTER_STYLE: Record<
  ClientEventType,
  { background: string; color: string }
> = {
  agent_state_changed: {
    background: "rgba(6, 182, 212, 0.16)",
    color: "#22D3EE",
  },
  user_state_changed: {
    background: "rgba(59, 130, 246, 0.16)",
    color: "#60A5FA",
  },
  conversation_item_added: {
    background: "rgba(16, 185, 129, 0.16)",
    color: "#34D399",
  },
  user_input_transcribed: {
    background: "rgba(132, 204, 22, 0.16)",
    color: "#A3E635",
  },
  function_tools_executed: {
    background: "rgba(139, 92, 246, 0.16)",
    color: "#A78BFA",
  },
  metrics_collected: {
    background: "rgba(236, 72, 153, 0.16)",
    color: "#F472B6",
  },
  user_interruption: {
    background: "rgba(245, 158, 11, 0.16)",
    color: "#FBBF24",
  },
  error: { background: "rgba(239, 68, 68, 0.2)", color: "#F87171" },
};

const CONTROL_BUTTON_CLASS =
  "text-xs px-2 py-0.5 rounded transition-colors hover:text-[var(--dbg-fg)] hover:bg-[var(--dbg-control-hover)]";
const CONTROL_BUTTON_STYLE = {
  color: "var(--dbg-fg5)",
  background: "var(--dbg-control-bg)",
  borderRadius: "var(--dbg-radius)",
} as const;

export const ALL_EVENT_TYPES: ClientEventType[] = [
  "agent_state_changed",
  "user_state_changed",
  "conversation_item_added",
  "user_input_transcribed",
  "function_tools_executed",
  "metrics_collected",
  "user_interruption",
  "error",
];

const GRID_COLUMNS = "minmax(0px,24ch) minmax(0px,28ch) minmax(0px,1fr)";
const TABLE_HEADER_HEIGHT = 24;
const ROW_HEIGHT = 37;
const TABLE_ROW_CLASS = "grid grid-rows-1 gap-2";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eventSummary(event: ClientEvent): string {
  switch (event.type) {
    case "agent_state_changed":
      return `${event.old_state} → ${event.new_state}`;
    case "user_state_changed":
      return `${event.old_state} → ${event.new_state}`;
    case "conversation_item_added":
      return JSON.stringify(event.item).slice(0, 80);
    case "user_input_transcribed":
      return `${event.is_final ? "[final]" : "[partial]"} "${event.transcript}"`;
    case "function_tools_executed":
      return `${event.function_calls.length} function call(s)`;
    case "metrics_collected":
      return `${event.metrics.type}`;
    case "user_interruption":
      return event.is_interruption ? "interruption" : "backchannel";
    case "error":
      return event.message;
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

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// CopyButton sub-component
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text);
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
      className="p-1 rounded transition-colors hover:bg-[var(--dbg-bg3)]"
      style={{ color: copied ? "#23DE6B" : "var(--dbg-fg5)" }}
      title={copied ? "Copied!" : "Copy JSON"}
    >
      {copied ? <CheckIcon /> : <ClipboardIcon />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Event badge
// ---------------------------------------------------------------------------

function EventTypeBadge({ type }: { type: ClientEventType }) {
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
      {type.replace(/_/g, " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EventLogProps {
  events: ClientEvent[];
  enabledTypes: Set<ClientEventType>;
  onEnabledTypesChange: (types: Set<ClientEventType>) => void;
  onClear?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EventRow {
  event: ClientEvent;
  index: number;
}

type MetricType = ClientMetricsCollectedEvent["metrics"]["type"];
const DEFAULT_DISABLED_METRIC_TYPES = new Set<MetricType>(["vad_metrics"]);

function getDefaultEnabledMetricTypes(
  availableMetricTypes: readonly MetricType[],
): Set<MetricType> {
  const defaults = new Set<MetricType>();
  for (const metricType of availableMetricTypes) {
    if (!DEFAULT_DISABLED_METRIC_TYPES.has(metricType)) {
      defaults.add(metricType);
    }
  }
  return defaults;
}

/**
 * Filterable, scrollable event log for agent client events.
 *
 * Displays events in reverse-chronological order in a log table with
 * timestamp / event / message columns and expandable JSON details.
 */
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

  const availableMetricTypes = useMemo<MetricType[]>(() => {
    const seen = new Set<MetricType>();
    for (const event of events) {
      if (event.type === "metrics_collected") {
        seen.add(event.metrics.type);
      }
    }
    return Array.from(seen).sort();
  }, [events]);

  const [enabledMetricTypes, setEnabledMetricTypes] = useState<Set<MetricType>>(
    () => new Set(),
  );
  const initializedMetricTypesRef = useRef(false);
  const previousMetricTypesRef = useRef<Set<MetricType>>(new Set());

  // Keep metric subtype filters aligned with available metrics.
  useEffect(() => {
    setEnabledMetricTypes((prev) => {
      if (availableMetricTypes.length === 0) {
        // Reset refs so the next session re-initializes correctly.
        initializedMetricTypesRef.current = false;
        previousMetricTypesRef.current = new Set();
        return new Set();
      }

      // First load: enable all except default-disabled metric types.
      if (!initializedMetricTypesRef.current) {
        initializedMetricTypesRef.current = true;
        previousMetricTypesRef.current = new Set(availableMetricTypes);
        return getDefaultEnabledMetricTypes(availableMetricTypes);
      }

      const next = new Set<MetricType>();
      for (const metricType of availableMetricTypes) {
        const isNewMetricType = !previousMetricTypesRef.current.has(metricType);
        if (
          prev.has(metricType) ||
          (isNewMetricType && !DEFAULT_DISABLED_METRIC_TYPES.has(metricType))
        ) {
          next.add(metricType);
        }
      }
      previousMetricTypesRef.current = new Set(availableMetricTypes);
      return next;
    });
  }, [availableMetricTypes]);

  const changedTypeCount = allTypes.length - enabledTypes.size;
  const changedMetricCount =
    availableMetricTypes.length - enabledMetricTypes.size;
  const hasActiveFilter = changedTypeCount > 0 || changedMetricCount > 0;

  const toggleType = useCallback(
    (t: ClientEventType) => {
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
    onEnabledTypesChange(new Set(allTypes));
    setEnabledMetricTypes(getDefaultEnabledMetricTypes(availableMetricTypes));
  }, [allTypes, onEnabledTypesChange, availableMetricTypes]);

  const toggleMetricType = useCallback((metricType: MetricType) => {
    setEnabledMetricTypes((prev) => {
      const next = new Set(prev);
      if (next.has(metricType)) {
        next.delete(metricType);
      } else {
        next.add(metricType);
      }
      return next;
    });
  }, []);

  const isolateOrRestoreType = useCallback(
    (t: ClientEventType) => {
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
      if (!enabledTypes.has(event.type)) continue;
      if (
        event.type === "metrics_collected" &&
        !enabledMetricTypes.has(event.metrics.type)
      ) {
        continue;
      }
      next.push({ event, index });
    }
    return next;
  }, [events, enabledTypes, enabledMetricTypes]);

  useEffect(() => {
    if (expandedIndex !== null && expandedIndex >= events.length) {
      setExpandedIndex(null);
    }
  }, [events.length, expandedIndex]);

  return (
    <div
      data-slot="event-log"
      className={`flex flex-col h-full w-full text-xs${className ? ` ${className}` : ""}`}
      style={{ background: "var(--dbg-bg)", color: "var(--dbg-fg3)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-1.5 border-b shrink-0"
        style={{ borderColor: "var(--dbg-border)" }}
      >
        <button
          onClick={() => setShowFilter((v) => !v)}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md border transition-colors"
          style={{
            borderColor: "var(--dbg-border)",
            color: showFilter ? "var(--dbg-fg)" : "var(--dbg-fg5)",
            background: showFilter ? "var(--dbg-bg3)" : "var(--dbg-control-bg)",
          }}
          title={showFilter ? "Hide filters" : "Show filters"}
          aria-label={showFilter ? "Hide filters" : "Show filters"}
        >
          <FilterIcon />
        </button>
        <span className="text-xs" style={{ color: "var(--dbg-fg5)" }}>
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
            className="w-64 shrink-0 border-r overflow-y-auto dbg-thin-scroll"
            style={{
              borderColor: "var(--dbg-border)",
              background: "var(--dbg-bg2)",
            }}
          >
            <div className="p-3">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--dbg-fg)" }}
                >
                  Event types
                </span>
                <button
                  onClick={resetTypes}
                  className="text-xs px-2 py-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-default"
                  disabled={!hasActiveFilter}
                  style={{
                    color: "var(--dbg-fg5)",
                    background: "var(--dbg-bg3)",
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
                            borderColor: "var(--dbg-fg4)",
                            color: enabled ? "var(--dbg-fg3)" : "transparent",
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
                            color: enabled ? "var(--dbg-fg)" : "var(--dbg-fg5)",
                          }}
                          title={
                            enabled
                              ? "Click to isolate this event type"
                              : "Click to show only this event type"
                          }
                        >
                          {t.replace(/_/g, " ")}
                        </button>
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ background: colors.color }}
                        />
                      </div>

                      {t === "metrics_collected" &&
                        enabled &&
                        availableMetricTypes.length > 0 && (
                          <div className="mt-1 mb-1 ml-6 flex flex-col gap-1">
                            {availableMetricTypes.map((metricType) => {
                              const metricEnabled =
                                enabledMetricTypes.has(metricType);
                              return (
                                <button
                                  key={metricType}
                                  onClick={() => toggleMetricType(metricType)}
                                  className="text-left text-[11px] rounded px-2 py-1 transition-colors"
                                  style={{
                                    color: metricEnabled
                                      ? "var(--dbg-fg3)"
                                      : "var(--dbg-fg4)",
                                    background: metricEnabled
                                      ? "var(--dbg-bg3)"
                                      : "transparent",
                                  }}
                                  title={
                                    metricEnabled
                                      ? "Disable metric subtype"
                                      : "Enable metric subtype"
                                  }
                                >
                                  {metricType.replace(/_/g, " ")}
                                </button>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Table header */}
          <div
            className={`shrink-0 ${TABLE_ROW_CLASS} items-center border-b px-4`}
            style={{
              gridTemplateColumns: GRID_COLUMNS,
              height: TABLE_HEADER_HEIGHT,
              background: "var(--dbg-bg2)",
              borderColor: "var(--dbg-border)",
              color: "#B2B2B2",
              fontSize: "0.75rem",
            }}
          >
            <span className="py-0.5">Timestamp</span>
            <span className="py-0.5">Event</span>
            <span className="py-0.5">Message</span>
          </div>

          {/* Scrollable rows */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden dbg-thin-scroll">
            {filtered.length === 0 && (
              <div
                className="flex items-center justify-center h-full text-xs"
                style={{ color: "var(--dbg-fg5)" }}
              >
                No events yet
              </div>
            )}
            {filtered.map(({ event, index }) => {
              const isExpanded = expandedIndex === index;
              const jsonText = JSON.stringify(event, null, 2);
              const colors = TYPE_FILTER_STYLE[event.type];
              return (
                <div
                  key={index}
                  className={`${TABLE_ROW_CLASS} border-b border-l-2 border-l-transparent cursor-pointer px-4 transition-colors hover:bg-[var(--dbg-bg2)]`}
                  style={{
                    borderColor: "var(--dbg-border)",
                    gridTemplateColumns: GRID_COLUMNS,
                    ...(isExpanded
                      ? {
                          background: "var(--dbg-bg3)",
                          borderLeftColor: colors.color,
                        }
                      : {}),
                  }}
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <span
                    className="flex items-center truncate py-2 font-mono"
                    style={{ color: "var(--dbg-fg5)", minHeight: ROW_HEIGHT }}
                  >
                    {formatTimestamp(event.created_at)}
                  </span>
                  <span
                    className="flex items-center truncate py-2"
                    style={{ minHeight: ROW_HEIGHT }}
                  >
                    <EventTypeBadge type={event.type} />
                  </span>
                  <span
                    className="flex items-center truncate py-2"
                    style={{ color: "var(--dbg-fg3)", minHeight: ROW_HEIGHT }}
                    title={event.type}
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
                        style={{ color: "var(--dbg-fg5)" }}
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
