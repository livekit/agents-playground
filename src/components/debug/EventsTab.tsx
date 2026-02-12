import type { ClientEvent, ClientEventType } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const TYPE_BADGE_COLORS: Record<ClientEventType, string> = {
  agent_state_changed: "bg-green-800 text-green-200",
  user_state_changed: "bg-green-900 text-green-300",
  conversation_item_added: "bg-blue-800 text-blue-200",
  user_input_transcribed: "bg-cyan-800 text-cyan-200",
  function_tools_executed: "bg-violet-800 text-violet-200",
  metrics_collected: "bg-gray-700 text-gray-200",
  user_interruption: "bg-amber-800 text-amber-200",
  error: "bg-red-800 text-red-200",
};

const CONTROL_BUTTON_CLASS =
  "text-xs px-2 py-0.5 rounded transition-colors hover:text-[var(--dbg-fg)] hover:bg-[var(--dbg-control-hover)]";
const CONTROL_BUTTON_STYLE = {
  color: "var(--dbg-fg5)",
  background: "var(--dbg-control-bg)",
  borderRadius: "var(--dbg-radius)",
} as const;

const ALL_EVENT_TYPES: ClientEventType[] = [
  "agent_state_changed",
  "user_state_changed",
  "conversation_item_added",
  "user_input_transcribed",
  "function_tools_executed",
  "metrics_collected",
  "user_interruption",
  "error",
];

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

function formatTimestamp(createdAt: number, sessionStart: number): string {
  const delta = createdAt - sessionStart;
  if (delta < 0) return `${delta.toFixed(1)}s`;
  return `+${delta.toFixed(1)}s`;
}

interface EventsTabProps {
  events: ClientEvent[];
  sessionStartedAt: number;
  onClear: () => void;
}

interface EventRow {
  event: ClientEvent;
  index: number;
}

export function EventsTab({
  events,
  sessionStartedAt,
  onClear,
}: EventsTabProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [enabledTypes, setEnabledTypes] = useState<Set<ClientEventType>>(
    new Set(ALL_EVENT_TYPES),
  );
  const [showFilter, setShowFilter] = useState(false);

  const toggleType = useCallback((t: ClientEventType) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        next.delete(t);
      } else {
        next.add(t);
      }
      return next;
    });
  }, []);

  const filtered = useMemo<EventRow[]>(() => {
    const next: EventRow[] = [];
    for (let index = events.length - 1; index >= 0; index--) {
      const event = events[index];
      if (enabledTypes.has(event.type)) {
        next.push({ event, index });
      }
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
      className="flex flex-col h-full w-full"
      style={{ background: "var(--dbg-bg)" }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0"
        style={{ borderColor: "var(--dbg-border)" }}
      >
        <button
          onClick={() => setShowFilter((v) => !v)}
          className={CONTROL_BUTTON_CLASS}
          style={CONTROL_BUTTON_STYLE}
        >
          Filter
        </button>
        <span className="text-xs" style={{ color: "var(--dbg-fg5)" }}>
          {filtered.length} events
        </span>
        <div className="flex-1" />
        <button
          onClick={onClear}
          className={CONTROL_BUTTON_CLASS}
          style={CONTROL_BUTTON_STYLE}
        >
          Clear
        </button>
      </div>

      {showFilter && (
        <div
          className="flex flex-wrap gap-1.5 px-3 py-2 border-b"
          style={{
            borderColor: "var(--dbg-border)",
            background: "var(--dbg-bg2)",
          }}
        >
          {ALL_EVENT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                enabledTypes.has(t)
                  ? TYPE_BADGE_COLORS[t]
                  : "bg-gray-900 text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
          return (
            <div
              key={index}
              className="border-b cursor-pointer transition-colors hover:bg-[var(--dbg-bg2)]"
              style={{ borderColor: "var(--dbg-border)" }}
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
            >
              <div className="flex items-center gap-2 px-3 py-1 text-xs">
                <span
                  className="font-mono w-14 shrink-0 text-right"
                  style={{ color: "var(--dbg-fg5)" }}
                >
                  {formatTimestamp(event.created_at, sessionStartedAt)}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${TYPE_BADGE_COLORS[event.type]}`}
                >
                  {event.type}
                </span>
                <span className="truncate" style={{ color: "var(--dbg-fg3)" }}>
                  {eventSummary(event)}
                </span>
              </div>
              {isExpanded && (
                <pre
                  className="px-3 pb-2 text-[10px] overflow-x-auto whitespace-pre-wrap break-all"
                  style={{ color: "var(--dbg-fg5)" }}
                >
                  {JSON.stringify(event, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
