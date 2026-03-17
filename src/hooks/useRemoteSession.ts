import { AgentSession } from "@livekit/protocol";
import { timestampToSeconds } from "@/lib/types";
import type { Room } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TOPIC_SESSION_MESSAGES = "lk.agent.session";
const MAX_EVENTS = 1000;
const LATENCY_SAMPLE_WINDOW = 10;
const RPC_TIMEOUT_MS = 5_000;

/** Global across hook instances; combined with Date.now() + random suffix for uniqueness. */
let _reqSeq = 0;
function nextRequestId(): string {
  return `req_${Date.now()}_${++_reqSeq}_${Math.random().toString(36).slice(2, 6)}`;
}

type PendingRequest = {
  resolve: (resp: AgentSession.SessionResponse) => void;
  reject: (err: Error) => void;
  timerId: ReturnType<typeof setTimeout>;
};

export type OverlappingSpeechEvent = {
  speech: AgentSession.AgentSessionEvent_OverlappingSpeech;
  /** Wrapper event's createdAt (= server send time). Use for aligning with state markers. */
  createdAt: AgentSession.AgentSessionEvent["createdAt"];
  /** Pre-computed createdAt in seconds. */
  createdAtSeconds: number;
  /** Pre-computed detectedAt in seconds (falls back to createdAtSeconds). */
  detectedAtSeconds: number;
  /** Wall-clock time (epoch seconds) when the client received this event. */
  receivedAt: number;
};

export type UseRemoteSessionReturn = {
  events: AgentSession.AgentSessionEvent[];
  overlappingSpeechEvents: OverlappingSpeechEvent[];
  sessionUsage: AgentSession.AgentSessionUsage | null;
  networkLatency: number;
  clearEvents: () => void;
  sendRequest: (
    agentIdentity: string,
    request: AgentSession.SessionRequest["request"],
  ) => Promise<AgentSession.SessionResponse>;
};

export function useRemoteSession(room: Room): UseRemoteSessionReturn {
  const [events, setEvents] = useState<AgentSession.AgentSessionEvent[]>([]);
  const eventsRef = useRef<AgentSession.AgentSessionEvent[]>([]);
  const receivedAtMap = useRef<WeakMap<AgentSession.AgentSessionEvent, number>>(
    new WeakMap(),
  );
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());

  const appendEvent = useCallback(
    (event: AgentSession.AgentSessionEvent, receivedAt: number) => {
      receivedAtMap.current.set(event, receivedAt);
      const next = [...eventsRef.current, event];
      if (next.length > MAX_EVENTS) {
        next.splice(0, next.length - MAX_EVENTS);
      }
      eventsRef.current = next;
      setEvents(next);
    },
    [],
  );

  const handleResponse = useCallback(
    (resp: AgentSession.SessionResponse) => {
      const pending = pendingRef.current.get(resp.requestId);
      if (!pending) return;
      clearTimeout(pending.timerId);
      pendingRef.current.delete(resp.requestId);
      if (resp.error != null) {
        pending.reject(new Error(resp.error));
      } else {
        pending.resolve(resp);
      }
    },
    [],
  );

  const clearEvents = useCallback(() => {
    eventsRef.current = [];
    receivedAtMap.current = new WeakMap();
    setEvents([]);
  }, []);

  useEffect(() => {
    const onByteStream = async (
      reader: { readAll: () => Promise<Array<Uint8Array>> },
      _participantInfo: { identity: string },
    ) => {
      try {
        const receivedAt = Date.now() / 1000;
        const chunks = await reader.readAll();
        let totalLen = 0;
        for (const c of chunks) totalLen += c.byteLength;
        const data = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          data.set(c, offset);
          offset += c.byteLength;
        }

        const msg = AgentSession.AgentSessionMessage.fromBinary(data);
        switch (msg.message.case) {
          case "event":
            appendEvent(msg.message.value, receivedAt);
            break;
          case "response":
            handleResponse(msg.message.value);
            break;
        }
      } catch (e) {
        console.warn("[useRemoteSession] failed to parse message", e);
      }
    };

    try {
      room.registerByteStreamHandler(TOPIC_SESSION_MESSAGES, onByteStream);
    } catch (e) {
      console.warn(
        "[useRemoteSession] failed to register byte stream handler",
        e,
      );
    }

    return () => {
      pendingRef.current.forEach((pending) => {
        clearTimeout(pending.timerId);
        pending.reject(new Error("Hook unmounted"));
      });
      pendingRef.current.clear();

      try {
        room.unregisterByteStreamHandler(TOPIC_SESSION_MESSAGES);
      } catch {
        // ignore if already unregistered
      }
    };
  }, [room, appendEvent, handleResponse]);

  const sendRequest = useCallback(
    (
      agentIdentity: string,
      request: AgentSession.SessionRequest["request"],
    ): Promise<AgentSession.SessionResponse> => {
      const requestId = nextRequestId();
      const sessionRequest = new AgentSession.SessionRequest({
        requestId,
        request,
      });
      const wrapper = new AgentSession.AgentSessionMessage({
        message: { case: "request", value: sessionRequest },
      });
      const bytes = wrapper.toBinary();

      const promise = new Promise<AgentSession.SessionResponse>(
        (resolve, reject) => {
          const timerId = setTimeout(() => {
            if (pendingRef.current.has(requestId)) {
              pendingRef.current.delete(requestId);
              reject(new Error("RPC timeout"));
            }
          }, RPC_TIMEOUT_MS);
          pendingRef.current.set(requestId, { resolve, reject, timerId });
        },
      );

      void (async () => {
        let writer: { write: (data: Uint8Array) => Promise<void>; close: () => Promise<void> } | undefined;
        try {
          writer = await room.localParticipant.streamBytes({
            topic: TOPIC_SESSION_MESSAGES,
            destinationIdentities: [agentIdentity],
          });
          await writer.write(bytes);
          await writer.close();
        } catch (e) {
          if (writer) {
            try { await writer.close(); } catch { /* best-effort */ }
          }
          const pending = pendingRef.current.get(requestId);
          if (pending) {
            clearTimeout(pending.timerId);
            pendingRef.current.delete(requestId);
            pending.reject(e instanceof Error ? e : new Error(String(e)));
          }
        }
      })();

      return promise;
    },
    [room],
  );

  const overlappingSpeechEvents = useMemo(
    () =>
      events
        .filter((e) => e.event.case === "overlappingSpeech")
        .map((e) => {
          const speech =
            e.event.value as AgentSession.AgentSessionEvent_OverlappingSpeech;
          const createdAtSeconds = timestampToSeconds(e.createdAt);
          return {
            speech,
            createdAt: e.createdAt,
            createdAtSeconds,
            detectedAtSeconds:
              timestampToSeconds(speech.detectedAt) || createdAtSeconds,
            receivedAt: receivedAtMap.current.get(e) ?? 0,
          };
        }),
    [events],
  );

  const sessionUsage = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e?.event.case === "sessionUsageUpdated") {
        return e.event.value.usage ?? null;
      }
    }
    return null;
  }, [events]);

  const networkLatency = useMemo(() => {
    const deltas: number[] = [];
    for (const evt of overlappingSpeechEvents) {
      if (evt.receivedAt > 0 && evt.createdAtSeconds > 0) {
        const delta = evt.receivedAt - evt.createdAtSeconds;
        if (delta >= 0) deltas.push(delta);
      }
    }
    if (deltas.length === 0) return 0;
    const recent = deltas.slice(-LATENCY_SAMPLE_WINDOW);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }, [overlappingSpeechEvents]);

  return {
    events,
    overlappingSpeechEvents,
    sessionUsage,
    networkLatency,
    clearEvents,
    sendRequest,
  };
}
