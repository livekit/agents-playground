import type {
  ClientEvent,
  ClientMetricsCollectedEvent,
  ClientUserInterruptionEvent,
} from "@/lib/types";
import type { Track } from "livekit-client";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AudioWaveform } from "./audio-waveform";
import type { AudioWaveformHandle } from "./audio-waveform";
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

  const waveformRef = useRef<AudioWaveformHandle>(null);

  // Forward interruption events to the waveform as highlights ----------------
  const lastHandledRef = useRef(0);
  useEffect(() => {
    if (interruptionEvents.length < lastHandledRef.current) {
      lastHandledRef.current = 0;
    }
    if (interruptionEvents.length <= lastHandledRef.current) return;

    const newEvents = interruptionEvents.slice(lastHandledRef.current);
    lastHandledRef.current = interruptionEvents.length;

    for (const evt of newEvents) {
      waveformRef.current?.addHighlight({
        type: evt.is_interruption ? "interruption" : "backchannel",
      });
    }
  }, [interruptionEvents]);

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
          {collapsed ? "▲" : "▼"}
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
          {activeTab === "waveform" && (
            <AudioWaveform
              ref={waveformRef}
              userTrack={userTrack}
              agentTrack={agentTrack}
            />
          )}
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
