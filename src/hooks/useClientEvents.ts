import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import type {
  ClientEvent,
  ClientMetricsCollectedEvent,
  ClientUserInterruptionEvent,
} from "@/lib/types";

const TOPIC_CLIENT_EVENTS = "lk.agent.events";
const MAX_EVENTS = 1000;

export interface UseClientEventsReturn {
  events: ClientEvent[];
  metricsEvents: ClientMetricsCollectedEvent[];
  interruptionEvents: ClientUserInterruptionEvent[];
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
        const parsed = JSON.parse(data);
        if (!isClientEvent(parsed)) return;
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

  const metricsEvents = events.filter(
    (e): e is ClientMetricsCollectedEvent => e.type === "metrics_collected",
  );

  const interruptionEvents = events.filter(
    (e): e is ClientUserInterruptionEvent => e.type === "user_interruption",
  );

  return { events, metricsEvents, interruptionEvents, clearEvents };
}
