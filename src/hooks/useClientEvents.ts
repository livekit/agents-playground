import type {
  AgentSessionUsage,
  ClientEvent,
  ClientMetricsCollectedEvent,
  ClientSessionUsageEvent,
  ClientUserInterruptionEvent,
} from "@/lib/types";
import type { Room } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TOPIC_CLIENT_EVENTS = "lk.agent.events";
const MAX_EVENTS = 1000;

export interface UseClientEventsReturn {
  events: ClientEvent[];
  metricsEvents: ClientMetricsCollectedEvent[];
  interruptionEvents: ClientUserInterruptionEvent[];
  sessionUsage: AgentSessionUsage | null;
  /** Average one-way server→client transit in seconds, measured from interruption `sent_at`. */
  networkLatency: number;
  clearEvents: () => void;
}

function isClientEvent(value: unknown): value is ClientEvent {
  if (!value || typeof value !== "object") return false;
  return typeof (value as { type?: unknown }).type === "string";
}

export function useClientEvents(room: Room): UseClientEventsReturn {
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const eventsRef = useRef<ClientEvent[]>([]);

  const appendEvent = useCallback((event: ClientEvent) => {
    const next = [...eventsRef.current, event];
    if (next.length > MAX_EVENTS) {
      next.splice(0, next.length - MAX_EVENTS);
    }
    eventsRef.current = next;
    setEvents(next);
  }, []);

  const clearEvents = useCallback(() => {
    eventsRef.current = [];
    setEvents([]);
  }, []);

  useEffect(() => {
    const onTextStream = async (
      reader: { readAll: () => Promise<string> },
      _participantInfo: { identity: string },
    ) => {
      try {
        const data = await reader.readAll();
        const receivedAt = Date.now() / 1000;
        const parsed = JSON.parse(data);
        if (!isClientEvent(parsed)) return;
        (parsed as unknown as Record<string, unknown>)._received_at =
          receivedAt;
        appendEvent(parsed);
      } catch (e) {
        console.warn("[useClientEvents] failed to parse event", e);
      }
    };

    try {
      room.registerTextStreamHandler(TOPIC_CLIENT_EVENTS, onTextStream);
    } catch (e) {
      console.warn(
        "[useClientEvents] failed to register text stream handler",
        e,
      );
    }

    return () => {
      try {
        room.unregisterTextStreamHandler(TOPIC_CLIENT_EVENTS);
      } catch {
        // ignore if already unregistered
      }
    };
  }, [room, appendEvent]);

  const metricsEvents = useMemo(
    () =>
      events.filter(
        (e): e is ClientMetricsCollectedEvent => e.type === "metrics_collected",
      ),
    [events],
  );

  const interruptionEvents = useMemo(
    () =>
      events.filter(
        (e): e is ClientUserInterruptionEvent => e.type === "user_interruption",
      ),
    [events],
  );

  // session_usage events are cumulative; only the latest one matters
  const sessionUsage = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e?.type === "session_usage") {
        return (e as ClientSessionUsageEvent).usage;
      }
    }
    return null;
  }, [events]);

  // Compute average one-way network latency from interruption events' sent_at
  const networkLatency = useMemo(() => {
    const deltas: number[] = [];
    for (const e of interruptionEvents) {
      const receivedAt = (e as unknown as Record<string, unknown>)._received_at;
      if (typeof receivedAt === "number" && e.sent_at > 0) {
        const delta = receivedAt - e.sent_at;
        deltas.push(delta);
      }
    }
    if (deltas.length === 0) return 0;
    const recent = deltas.slice(-10);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    return avg;
  }, [interruptionEvents]);

  return {
    events,
    metricsEvents,
    interruptionEvents,
    sessionUsage,
    networkLatency,
    clearEvents,
  };
}
