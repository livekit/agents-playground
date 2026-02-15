import type { Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

// Must match server-side constants
const TOPIC_AGENT_REQUEST = "lk.agent.request";
const TOPIC_AGENT_RESPONSE = "lk.agent.response";

interface StreamRequest {
  request_id: string;
  method: string;
  payload: string;
}

interface StreamResponse {
  request_id: string;
  payload: string;
  error: string | null;
}

interface RTCStatsResponse {
  subscriber_stats: RTCInboundStat[];
  publisher_stats: unknown[];
}

/** Subset of WebRTC inbound-rtp stats from the server's perspective. */
interface RTCInboundStat {
  kind?: string;
  jitterBufferDelay?: number;
  jitterBufferEmittedCount?: number;
  /** Server-side candidate-pair stats nested under transport. */
  [key: string]: unknown;
}

export interface UplinkLatency {
  /** Total uplink pipeline delay in seconds (client→SFU + SFU→agent + jitter buffer). */
  total: number;
  /** Client→SFU one-way latency in seconds (RTT/2 from client WebRTC stats). */
  clientToSfu: number;
  /** SFU→Agent one-way latency in seconds (RTT/2 from server WebRTC stats). */
  sfuToAgent: number;
  /** Agent jitter buffer delay in seconds. */
  jitterBuffer: number;
}

let _reqId = 0;
function nextRequestId(): string {
  return `req_${Date.now()}_${++_reqId}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Extract client→SFU RTT/2 from the local RTCPeerConnection stats.
 *
 * NOTE: accesses the private `room.engine.pcManager.publisher` API.
 * This is not part of the public livekit-client surface and may change
 * across SDK versions. Guarded so the hook degrades to 0 if unavailable.
 */
async function getClientRttHalf(room: Room): Promise<number> {
  const pcTransport = (
    room as unknown as {
      engine: {
        pcManager?: { publisher: { getStats(): Promise<RTCStatsReport> } };
      };
    }
  ).engine?.pcManager?.publisher;
  if (!pcTransport) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[useUplinkLatency] pcManager.publisher not available — client→SFU RTT will be 0",
      );
    }
    return 0;
  }

  try {
    const report = await pcTransport.getStats();
    for (const [, stat] of report) {
      if (
        stat.type === "candidate-pair" &&
        (stat as Record<string, unknown>).state === "succeeded" &&
        typeof (stat as Record<string, unknown>).currentRoundTripTime ===
          "number"
      ) {
        return (
          ((stat as Record<string, unknown>).currentRoundTripTime as number) / 2
        );
      }
    }
  } catch {
    // ignore — stats API may be unavailable during reconnection
  }
  return 0;
}

/** Extract jitter buffer delay and server-side RTT from the RTC stats response. */
function parseServerStats(resp: RTCStatsResponse): {
  jitterBuffer: number;
  sfuToAgent: number;
} {
  let jitterBuffer = 0;
  let sfuToAgent = 0;

  for (const stat of resp.subscriber_stats) {
    if (
      stat.kind === "audio" &&
      typeof stat.jitterBufferDelay === "number" &&
      typeof stat.jitterBufferEmittedCount === "number" &&
      stat.jitterBufferEmittedCount > 0
    ) {
      jitterBuffer = stat.jitterBufferDelay / stat.jitterBufferEmittedCount;
    }
  }

  // Server-side RTT is in candidate-pair stats (could be nested in publisher_stats or subscriber transport)
  const allStats = [
    ...resp.subscriber_stats,
    ...(resp.publisher_stats as RTCInboundStat[]),
  ];
  for (const stat of allStats) {
    const rtt = (stat as Record<string, unknown>).currentRoundTripTime;
    if (
      (stat as Record<string, unknown>).type === "candidate-pair" &&
      typeof rtt === "number"
    ) {
      sfuToAgent = rtt / 2;
      break;
    }
  }

  return { jitterBuffer, sfuToAgent };
}

const POLL_INTERVAL_MS = 5_000;

/**
 * Measures the uplink pipeline latency: client mic → SFU → agent jitter buffer.
 *
 * Components:
 *   - Client→SFU: half the RTT from the client's RTCPeerConnection stats
 *   - SFU→Agent: half the RTT from the server's RTCPeerConnection stats (via text stream RPC)
 *   - Jitter buffer: average delay from the server's inbound-rtp stats
 */
interface PendingRpc {
  resolve: (v: string) => void;
  reject: (e: Error) => void;
  timerId: ReturnType<typeof setTimeout>;
}

export function useUplinkLatency(
  room: Room,
  agentIdentity: string | undefined,
): UplinkLatency {
  const [latency, setLatency] = useState<UplinkLatency>({
    total: 0,
    clientToSfu: 0,
    sfuToAgent: 0,
    jitterBuffer: 0,
  });

  const pendingRef = useRef<Map<string, PendingRpc>>(new Map());

  // This hook exclusively owns the lk.agent.response topic.
  useEffect(() => {
    const onResponse = async (
      reader: { readAll: () => Promise<string> },
      _participantInfo: { identity: string },
    ) => {
      try {
        const data = await reader.readAll();
        const resp: StreamResponse = JSON.parse(data);
        const pending = pendingRef.current.get(resp.request_id);
        if (pending) {
          clearTimeout(pending.timerId);
          pendingRef.current.delete(resp.request_id);
          if (resp.error) {
            pending.reject(new Error(resp.error));
          } else {
            pending.resolve(resp.payload);
          }
        }
      } catch {
        // ignore malformed responses
      }
    };

    try {
      room.registerTextStreamHandler(TOPIC_AGENT_RESPONSE, onResponse);
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[useUplinkLatency] failed to register response handler — RPCs will time out",
          e,
        );
      }
    }

    return () => {
      pendingRef.current.forEach((pending, id) => {
        clearTimeout(pending.timerId);
        pending.reject(new Error("Hook unmounted"));
        pendingRef.current.delete(id);
      });

      try {
        room.unregisterTextStreamHandler(TOPIC_AGENT_RESPONSE);
      } catch {
        // ignore if already unregistered
      }
    };
  }, [room]);

  const callRpc = useCallback(
    async (method: string, payload: string): Promise<string> => {
      if (!agentIdentity) throw new Error("No agent identity");

      const requestId = nextRequestId();
      const request: StreamRequest = {
        request_id: requestId,
        method,
        payload,
      };

      const promise = new Promise<string>((resolve, reject) => {
        const timerId = setTimeout(() => {
          if (pendingRef.current.has(requestId)) {
            pendingRef.current.delete(requestId);
            reject(new Error("RPC timeout"));
          }
        }, 5_000);

        pendingRef.current.set(requestId, { resolve, reject, timerId });
      });

      try {
        await room.localParticipant.sendText(JSON.stringify(request), {
          topic: TOPIC_AGENT_REQUEST,
          destinationIdentities: [agentIdentity],
        });
      } catch (e) {
        const pending = pendingRef.current.get(requestId);
        if (pending) {
          clearTimeout(pending.timerId);
          pendingRef.current.delete(requestId);
        }
        throw e;
      }

      return promise;
    },
    [room, agentIdentity],
  );

  useEffect(() => {
    if (!agentIdentity) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const [serverPayload, clientRttHalf] = await Promise.all([
          callRpc("get_rtc_stats", "{}"),
          getClientRttHalf(room),
        ]);

        if (cancelled) return;

        const serverStats: RTCStatsResponse = JSON.parse(serverPayload);
        const { jitterBuffer, sfuToAgent } = parseServerStats(serverStats);

        setLatency({
          clientToSfu: clientRttHalf,
          sfuToAgent,
          jitterBuffer,
          total: clientRttHalf + sfuToAgent + jitterBuffer,
        });
      } catch (e) {
        if (process.env.NODE_ENV === "development" && !cancelled) {
          console.warn("[useUplinkLatency] poll failed", e);
        }
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [room, agentIdentity, callRpc]);

  return latency;
}
