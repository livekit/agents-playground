import type { WaveformHighlight } from "@/hooks/useStreamingWaveform";
import type {
  ClientEvent,
  ClientEventType,
  ClientMetricsCollectedEvent,
  ClientUserInterruptionEvent,
} from "@/lib/types";
import type { Track } from "livekit-client";
import { Public_Sans } from "next/font/google";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { AudioWaveform } from "./audio-waveform";
import { ALL_EVENT_TYPES, EventLog } from "./event-log";
import { MetricsDisplay } from "./metrics-display";

const DEFAULT_ENABLED_EVENT_TYPES = new Set<ClientEventType>(ALL_EVENT_TYPES);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabId = "waveform" | "events" | "metrics";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "waveform", label: "Waveform" },
  { id: "events", label: "Events" },
  { id: "metrics", label: "Metrics" },
];

const COLLAPSED_HEIGHT = 52;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 250;
const TAB_ROW_CLASS = "flex items-end gap-4 self-stretch";
const TAB_BUTTON_CLASS =
  "h-full px-1 pb-2 -mb-px border-b-2 transition-colors text-sm flex items-end";
const TAB_ACTIVE_COLOR = "#22D3EE";

const INTERRUPTION_COLOR = "#FA4C39";
const BACKCHANNEL_COLOR = "#23DE6B";

const HIGHLIGHT_LEGEND = [
  { color: INTERRUPTION_COLOR, label: "Interruption" },
  { color: BACKCHANNEL_COLOR, label: "Backchannel" },
];

const publicSans = Public_Sans({ subsets: ["latin"] });

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DebugPanelProps {
  userTrack: Track | undefined;
  agentTrack: Track | undefined;
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
  events,
  metricsEvents,
  interruptionEvents,
  onClearEvents,
}: DebugPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("waveform");
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [enabledEventTypes, setEnabledEventTypes] = useState<
    Set<ClientEventType>
  >(() => new Set(DEFAULT_ENABLED_EVENT_TYPES));
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
      className={`${publicSans.className} flex flex-col border-t shrink-0 w-full`}
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
        className="flex items-center min-h-[48px] shrink-0 border-b px-4 pt-2 pb-0 gap-1"
        style={{ borderColor: "var(--dbg-border)" }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-xs h-7 w-7 mr-1 rounded-md inline-flex items-center justify-center transition-colors hover:text-[var(--dbg-fg)] hover:bg-[var(--dbg-bg3)]"
          style={{ color: "var(--dbg-fg5)" }}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
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
            <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
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
        <div className={TAB_ROW_CLASS}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (collapsed) setCollapsed(false);
                }}
                className={TAB_BUTTON_CLASS}
                style={{
                  color: isActive ? "var(--dbg-fg)" : "var(--dbg-fg5)",
                  borderBottomColor: isActive
                    ? TAB_ACTIVE_COLOR
                    : "transparent",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {tab.label}
                {tab.id === "events" && events.length > 0 && (
                  <span
                    className="ml-1 text-[10px]"
                    style={{
                      color: isActive ? "var(--dbg-fg3)" : "var(--dbg-fg5)",
                    }}
                  >
                    {events.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
              enabledTypes={enabledEventTypes}
              onEnabledTypesChange={setEnabledEventTypes}
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
