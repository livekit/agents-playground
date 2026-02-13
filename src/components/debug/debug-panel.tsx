import type { WaveformHighlight } from "@/hooks/useStreamingWaveform";
import type {
  ClientEvent,
  ClientMetricsCollectedEvent,
  ClientUserInterruptionEvent,
} from "@/lib/types";
import type { Track } from "livekit-client";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { AudioWaveform } from "./audio-waveform";
import { EventLog } from "./event-log";
import { MetricsDisplay } from "./metrics-display";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabId = "waveform" | "events" | "metrics";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "waveform", label: "Waveform" },
  { id: "events", label: "Events" },
  { id: "metrics", label: "Metrics" },
];

const COLLAPSED_HEIGHT = 32;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 250;
const CONTROL_BUTTON_CLASS =
  "text-xs px-2 py-1 rounded transition-colors hover:text-[var(--dbg-fg)] hover:bg-[var(--dbg-bg3)]";

const INTERRUPTION_COLOR = "#FA4C39";
const BACKCHANNEL_COLOR = "#F97A1F";

const HIGHLIGHT_LEGEND = [
  { color: INTERRUPTION_COLOR, label: "Interruption" },
  { color: BACKCHANNEL_COLOR, label: "Backchannel" },
];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DebugPanelProps {
  userTrack: Track | undefined;
  agentTrack: Track | undefined;
  sessionStartedAt: number;
  events: ClientEvent[];
  metricsEvents: ClientMetricsCollectedEvent[];
  interruptionEvents: ClientUserInterruptionEvent[];
  onClearEvents: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DebugPanel({
  userTrack,
  agentTrack,
  sessionStartedAt,
  events,
  metricsEvents,
  interruptionEvents,
  onClearEvents,
}: DebugPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("waveform");
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Highlights ----------------------------------------------------------------
  const highlights = useMemo<WaveformHighlight[]>(
    () =>
      interruptionEvents.map((evt) => ({
        start: evt.overlap_speech_started_at ?? evt.created_at,
        end: evt.created_at,
        color: evt.is_interruption ? INTERRUPTION_COLOR : BACKCHANNEL_COLOR,
      })),
    [interruptionEvents],
  );

  // Resize -------------------------------------------------------------------
  const onResizeStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startHeight: height };

      const onMouseMove = (me: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startY - me.clientY;
        const newHeight = Math.min(
          MAX_HEIGHT,
          Math.max(MIN_HEIGHT, dragRef.current.startHeight + delta),
        );
        setHeight(newHeight);
      };

      const onMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [height],
  );

  // Render -------------------------------------------------------------------
  return (
    <div
      className="flex flex-col border-t fixed bottom-0 left-0 right-0 z-50"
      style={{
        height: collapsed ? COLLAPSED_HEIGHT : height,
        background: "var(--dbg-bg)",
        borderColor: "var(--dbg-border)",
      }}
    >
      {!collapsed && (
        <div
          onMouseDown={onResizeStart}
          className="h-1 w-full cursor-ns-resize transition-colors shrink-0 hover:bg-[var(--dbg-bg3)]"
          style={{ background: "var(--dbg-bg2)" }}
        />
      )}

      <div
        className="flex items-center h-[31px] shrink-0 border-b px-3 gap-1"
        style={{ borderColor: "var(--dbg-border)" }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-xs px-1 mr-1 transition-colors hover:text-[var(--dbg-fg)]"
          style={{ color: "var(--dbg-fg5)" }}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path
                d="M1 7L5 3l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path
                d="M1 3l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (collapsed) setCollapsed(false);
            }}
            className={CONTROL_BUTTON_CLASS}
            style={{
              color: activeTab === tab.id ? "var(--dbg-fg)" : "var(--dbg-fg5)",
              background:
                activeTab === tab.id ? "var(--dbg-bg3)" : "transparent",
            }}
          >
            {tab.label}
            {tab.id === "events" && events.length > 0 && (
              <span
                className="ml-1 text-[10px]"
                style={{ color: "var(--dbg-fg5)" }}
              >
                {events.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          {/* AudioWaveform is always mounted so useStreamingWaveform keeps
              collecting samples while other tabs are active. The rAF draw
              loop becomes a near-no-op when the container has display:none. */}
          <div
            className={activeTab === "waveform" ? "w-full h-full" : "hidden"}
          >
            <AudioWaveform
              userTrack={userTrack}
              agentTrack={agentTrack}
              highlights={highlights}
              legendItems={HIGHLIGHT_LEGEND}
            />
          </div>
          {activeTab === "events" && (
            <EventLog
              events={events}
              sessionStartedAt={sessionStartedAt}
              onClear={onClearEvents}
            />
          )}
          {activeTab === "metrics" && (
            <MetricsDisplay metricsEvents={metricsEvents} />
          )}
        </div>
      )}
    </div>
  );
}
