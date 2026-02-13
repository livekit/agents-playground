import type { ClientEvent, ClientEventType } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_BADGE_STYLE: Record<
  ClientEventType,
  { background: string; color: string }
> = {
  agent_state_changed: {
    background: "rgba(31, 213, 249, 0.15)",
    color: "#1FD5F9",
  },
  user_state_changed: {
    background: "rgba(31, 213, 249, 0.12)",
    color: "#1FD5F9",
  },
  conversation_item_added: {
    background: "rgba(35, 222, 107, 0.15)",
    color: "#23DE6B",
  },
  user_input_transcribed: {
    background: "rgba(35, 222, 107, 0.12)",
    color: "#23DE6B",
  },
  function_tools_executed: {
    background: "rgba(168, 130, 255, 0.15)",
    color: "#A882FF",
  },
  metrics_collected: { background: "#1F1F1F", color: "#808080" },
  user_interruption: {
    background: "rgba(255, 183, 82, 0.15)",
    color: "#FFB752",
  },
  error: { background: "rgba(255, 117, 102, 0.15)", color: "#FF7566" },
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

const GRID_COLUMNS = "minmax(0px,10ch) minmax(0px,22ch) minmax(0px,1fr)";
const TABLE_HEADER_HEIGHT = 24;
const ROW_HEIGHT = 37;

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

function formatTimestamp(createdAt: number, sessionStart: number): string {
  const delta = createdAt - sessionStart;
  if (delta < 0) return `${delta.toFixed(1)}s`;
  return `+${delta.toFixed(1)}s`;
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
// Badge sub-component (matches bytes-react Badge feel)
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: ClientEventType }) {
  const colors = TYPE_BADGE_STYLE[type];
  return (
    <span
      className="inline-flex items-center justify-center rounded px-1 py-0.5 font-mono font-semibold tracking-wider whitespace-nowrap uppercase select-none"
      style={{
        fontSize: "0.63rem",
        lineHeight: "1rem",
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
  sessionStartedAt: number;
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

/**
 * Filterable, scrollable event log for agent client events.
 *
 * Displays events in reverse-chronological order in a table layout with
 * type badges, timestamps relative to the session start, and expandable
 * JSON details with a copy-to-clipboard button.
 */
export function EventLog({
  events,
  sessionStartedAt,
  onClear,
  className,
}: EventLogProps) {
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
          className={CONTROL_BUTTON_CLASS}
          style={CONTROL_BUTTON_STYLE}
        >
          Filter
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

      {/* Filter chips */}
      {showFilter && (
        <div
          className="flex flex-wrap gap-1.5 px-4 py-2 border-b"
          style={{
            borderColor: "var(--dbg-border)",
            background: "var(--dbg-bg2)",
          }}
        >
          {ALL_EVENT_TYPES.map((t) => {
            const colors = TYPE_BADGE_STYLE[t];
            const enabled = enabledTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className="px-1.5 py-0.5 rounded font-mono font-semibold tracking-wider uppercase select-none cursor-pointer transition-opacity"
                style={{
                  fontSize: "0.63rem",
                  background: enabled ? colors.background : "#1a1a1a",
                  color: enabled ? colors.color : "#555",
                  opacity: enabled ? 1 : 0.6,
                }}
              >
                {t.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      )}

      {/* Table header */}
      <div
        className="shrink-0 grid items-center gap-2 px-4 border-b font-medium"
        style={{
          gridTemplateColumns: GRID_COLUMNS,
          height: TABLE_HEADER_HEIGHT,
          background: "var(--dbg-bg2)",
          borderColor: "var(--dbg-border)",
          color: "#B2B2B2",
          fontSize: "0.75rem",
        }}
      >
        <span>Timestamp</span>
        <span>Type</span>
        <span>Message</span>
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
          return (
            <div
              key={index}
              className="border-b cursor-pointer transition-colors hover:bg-[var(--dbg-bg2)]"
              style={{
                borderColor: "var(--dbg-border)",
                borderLeft: "2px solid transparent",
                ...(isExpanded
                  ? { background: "var(--dbg-bg3)", borderLeftColor: "#1FD5F9" }
                  : {}),
              }}
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
            >
              <div
                className="grid items-center gap-2 px-4"
                style={{
                  gridTemplateColumns: GRID_COLUMNS,
                  height: ROW_HEIGHT,
                }}
              >
                <span className="font-mono" style={{ color: "var(--dbg-fg5)" }}>
                  {formatTimestamp(event.created_at, sessionStartedAt)}
                </span>
                <span className="truncate">
                  <TypeBadge type={event.type} />
                </span>
                <span className="truncate" style={{ color: "var(--dbg-fg3)" }}>
                  {eventSummary(event)}
                </span>
              </div>
              {isExpanded && (
                <div className="relative px-4 pb-2">
                  <div className="absolute top-1 right-4">
                    <CopyButton text={jsonText} />
                  </div>
                  <pre
                    className="text-[10px] overflow-x-auto whitespace-pre-wrap break-all pr-8 font-mono"
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
  );
}
