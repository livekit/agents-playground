import type {
  WaveformHighlight,
  WaveformMarker,
} from "@/hooks/useStreamingWaveform";
import type { UplinkLatency } from "@/hooks/useUplinkLatency";
import type {
  AgentSessionUsage,
  ClientAgentStateChangedEvent,
  ClientEvent,
  ClientEventType,
  ClientMetricsCollectedEvent,
  ClientUserInterruptionEvent,
  ClientUserStateChangedEvent,
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
import {
  ALL_EVENT_TYPES,
  DEFAULT_DISABLED_EVENT_TYPES,
  EventLog,
} from "./event-log";
import { MetricsDisplay } from "./metrics-display";
import { UsageDisplay } from "./usage-display";

const DEFAULT_ENABLED_EVENT_TYPES = new Set<ClientEventType>(
  ALL_EVENT_TYPES.filter((t) => !DEFAULT_DISABLED_EVENT_TYPES.has(t)),
);

type TabId = "waveform" | "events" | "metrics" | "usage";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "waveform", label: "Waveform" },
  { id: "events", label: "Events" },
  { id: "metrics", label: "Metrics" },
  { id: "usage", label: "Usage" },
];

const COLLAPSED_HEIGHT = 52;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 250;
const TAB_ROW_CLASS = "flex items-end gap-4 self-stretch";
const TAB_BUTTON_CLASS =
  "h-full px-1 pb-2 -mb-px border-b-2 transition-colors text-sm flex items-end";
const TAB_ACTIVE_COLOR = "#22D3EE";
/** Matches Tailwind gray-500 used by PlaygroundTile titles. */
const COLLAPSED_FG = "#6b7280";

const INTERRUPTION_COLOR = "#FA4C39";
const BACKCHANNEL_COLOR = "#23DE6B";
const AGENT_STATE_COLOR = "#BA1FF9"; // matches agent waveform
const USER_STATE_COLOR = "#666666"; // matches user waveform

const FONT_STACK =
  '"Public Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export type DebugPanelProps = {
  userTrack: Track | undefined;
  agentTrack: Track | undefined;
  events: ClientEvent[];
  metricsEvents: ClientMetricsCollectedEvent[];
  interruptionEvents: ClientUserInterruptionEvent[];
  sessionUsage: AgentSessionUsage | null;
  onClearEvents: () => void;
  /** One-way server→client network transit in seconds, measured from interruption sent_at. */
  networkLatency: number;
  /** Measured uplink pipeline latency (client→SFU + SFU→agent + jitter buffer). */
  uplinkLatency?: UplinkLatency;
};

export function DebugPanel({
  userTrack,
  agentTrack,
  events,
  metricsEvents,
  interruptionEvents,
  sessionUsage,
  onClearEvents,
  networkLatency,
  uplinkLatency,
}: DebugPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("waveform");
  const [collapsed, setCollapsed] = useState(true);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [enabledEventTypes, setEnabledEventTypes] = useState<
    Set<ClientEventType>
  >(() => new Set(DEFAULT_ENABLED_EVENT_TYPES));
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Server timestamps are in server clock and delayed by the uplink pipeline.
  // To place them on the client waveform:
  //   client_time = server_time + clock_offset(client−server) − uplink_pipeline
  //   where clock_offset(client−server) ≈ networkLatency − downlink_transit
  //   and downlink_transit ≈ transport (clientToSfu * 2)
  const highlights = useMemo<WaveformHighlight[]>(() => {
    const pipeline = uplinkLatency?.total ?? 0;
    const downlinkTransit = uplinkLatency?.transport ?? 0;
    const clockOffset =
      networkLatency > 0 ? networkLatency - downlinkTransit : 0;
    const correction = clockOffset - pipeline;

    if (
      process.env.NODE_ENV === "development" &&
      interruptionEvents.length > 0
    ) {
      console.log(
        "[waveform correction] networkLatency=%sms − downlink(%sms) = clockOffset(%sms); clockOffset − pipeline(%sms) = correction(%sms)",
        (networkLatency * 1000).toFixed(1),
        (downlinkTransit * 1000).toFixed(1),
        (clockOffset * 1000).toFixed(1),
        (pipeline * 1000).toFixed(1),
        (correction * 1000).toFixed(1),
      );
    }

    return interruptionEvents.map((evt) => ({
      start: (evt.overlap_speech_started_at ?? evt.created_at) + correction,
      end: evt.created_at + correction,
      color: evt.is_interruption ? INTERRUPTION_COLOR : BACKCHANNEL_COLOR,
      label: evt.is_interruption ? "Interruption" : "Backchannel",
      sourceId: evt.created_at,
    }));
  }, [interruptionEvents, networkLatency, uplinkLatency]);

  const stateMarkers = useMemo<WaveformMarker[]>(() => {
    const pipeline = uplinkLatency?.total ?? 0;
    const downlinkTransit = uplinkLatency?.transport ?? 0;
    const clockOffset =
      networkLatency > 0 ? networkLatency - downlinkTransit : 0;
    // User state: agent's VAD detects speech after the uplink pipeline, so
    // subtract pipeline to align with when the user actually spoke.
    // Agent state: audio travels the downlink before appearing on the client
    // waveform, so correction = clockOffset + downlink = networkLatency.
    const userCorrection = clockOffset - pipeline;
    const agentCorrection = networkLatency > 0 ? networkLatency : 0;

    const markers: WaveformMarker[] = [];
    for (const evt of events) {
      if (
        evt.type !== "agent_state_changed" &&
        evt.type !== "user_state_changed"
      )
        continue;

      const stateEvt = evt as
        | ClientAgentStateChangedEvent
        | ClientUserStateChangedEvent;
      const track: "user" | "agent" =
        stateEvt.type === "user_state_changed" ? "user" : "agent";
      const color = track === "user" ? USER_STATE_COLOR : AGENT_STATE_COLOR;
      const correction = track === "user" ? userCorrection : agentCorrection;

      const timestamp = stateEvt.created_at + correction;
      const prevState = stateEvt.old_state;
      const nextState = stateEvt.new_state;
      const pushMarker = (variant: WaveformMarker["variant"]) => {
        markers.push({
          timestamp,
          color,
          label: nextState,
          track,
          variant,
          sourceId: stateEvt.created_at,
        });
      };

      if (prevState === "speaking") {
        pushMarker("speaking-end");
      }
      if (nextState === "speaking") {
        pushMarker("speaking-start");
      }
      if (
        prevState !== "thinking" &&
        nextState !== "thinking" &&
        prevState !== "speaking" &&
        nextState !== "speaking"
      ) {
        pushMarker("state-label");
      }
    }
    return markers;
  }, [events, networkLatency, uplinkLatency]);

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

  return (
    <div
      className="flex flex-col border-t shrink-0 w-full"
      style={{
        height: collapsed ? COLLAPSED_HEIGHT : height,
        background: "var(--lk-dbg-bg)",
        borderColor: "var(--lk-dbg-border)",
        fontFamily: FONT_STACK,
      }}
    >
      {!collapsed && (
        <div
          onMouseDown={onResizeStart}
          className="h-1 w-full cursor-ns-resize transition-colors shrink-0 hover:bg-[var(--lk-dbg-bg3)]"
          style={{ background: "var(--lk-dbg-bg2)" }}
        />
      )}

      <div
        className={`flex items-center min-h-[48px] shrink-0 px-4 pt-2 pb-0 gap-1${collapsed ? "" : " border-b"}`}
        style={{
          borderColor: collapsed ? "transparent" : "var(--lk-dbg-border)",
        }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-xs h-7 w-7 mr-1 rounded-md inline-flex items-center justify-center transition-colors hover:text-[var(--lk-dbg-fg)] hover:bg-[var(--lk-dbg-bg3)]"
          style={{ color: collapsed ? COLLAPSED_FG : "var(--lk-dbg-fg5)" }}
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
                  color: collapsed
                    ? COLLAPSED_FG
                    : isActive
                      ? "var(--lk-dbg-fg)"
                      : "var(--lk-dbg-fg5)",
                  borderBottomColor:
                    collapsed || !isActive ? "transparent" : TAB_ACTIVE_COLOR,
                  fontWeight: collapsed ? 400 : isActive ? 600 : 400,
                }}
              >
                {tab.label}
                {tab.id === "events" && events.length > 0 && (
                  <span
                    className="ml-1 text-[10px] inline-block text-right"
                    style={{
                      minWidth: "2.4em",
                      fontVariantNumeric: "tabular-nums",
                      color: collapsed
                        ? COLLAPSED_FG
                        : isActive
                          ? "var(--lk-dbg-fg3)"
                          : "var(--lk-dbg-fg5)",
                    }}
                  >
                    {events.length > 999 ? "999+" : events.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        {(uplinkLatency?.total ?? 0) > 0 && (
          <span
            className="inline-flex items-center gap-1 min-w-[66px] px-2 py-0.5 rounded text-[11px] font-mono tabular-nums shrink-0"
            style={{
              color: "var(--lk-dbg-fg5)",
              background: "var(--lk-dbg-bg2)",
            }}
            title={
              uplinkLatency
                ? `Transport latency: ${(uplinkLatency.total * 1000).toFixed(0)}ms (encoding ${(uplinkLatency.encoding * 1000).toFixed(0)}ms + transport ${(uplinkLatency.transport * 1000).toFixed(0)}ms + JB ${(uplinkLatency.jitterBuffer * 1000).toFixed(0)}ms)`
                : ""
            }
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
              style={{ color: "var(--lk-dbg-fg5)" }}
            >
              <path
                d="M2 8h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M10 4.5L13.5 8 10 11.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {((uplinkLatency?.total ?? 0) * 1000).toFixed(0)}ms
          </span>
        )}
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
              markers={stateMarkers}
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
            <MetricsDisplay metricsEvents={metricsEvents} events={events} />
          )}
          {activeTab === "usage" && (
            <UsageDisplay sessionUsage={sessionUsage} />
          )}
        </div>
      )}
    </div>
  );
}
