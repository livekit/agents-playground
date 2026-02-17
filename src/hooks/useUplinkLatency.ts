import type { Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

// Must match server-side constants
const TOPIC_AGENT_REQUEST = "lk.agent.request";
const TOPIC_AGENT_RESPONSE = "lk.agent.response";

type StreamRequest = {
  request_id: string;
  method: string;
  payload: string;
};

type StreamResponse = {
  request_id: string;
  payload: string;
  error: string | null;
};

type RTCStatsResponse = {
  subscriber_stats: RTCInboundStat[];
  publisher_stats: unknown[];
};

/** Subset of WebRTC inbound-rtp stats from the server's perspective. */
type RTCInboundStat = {
  kind?: string;
  jitterBufferDelay?: number;
  jitterBufferEmittedCount?: number;
  /** Server-side candidate-pair stats nested under transport. */
  [key: string]: unknown;
};

export type UplinkLatency = {
  /** Total uplink pipeline delay in seconds (send + client→SFU + SFU→agent + jitter buffer). */
  total: number;
  /** Client capture→network-send delay in seconds (encoding, packetization). */
  sendDelay: number;
  /** Client→SFU one-way latency in seconds (RTT/2 from client WebRTC stats). */
  clientToSfu: number;
  /** SFU→Agent one-way latency in seconds (RTT/2 from server WebRTC stats). */
  sfuToAgent: number;
  /** Agent jitter buffer delay in seconds. */
  jitterBuffer: number;
};

let _reqId = 0;
function nextRequestId(): string {
  return `req_${Date.now()}_${++_reqId}_${Math.random().toString(36).slice(2, 6)}`;
}

type ClientStatsResult = {
  rttHalf: number;
  /** Raw cumulative totalPacketSendDelay from the audio outbound-rtp stat (seconds). */
  rawSendDelay: number;
  /** Raw cumulative packetsSent from the audio outbound-rtp stat. */
  rawPacketsSent: number;
};

/**
 * Extract client-side stats from the publisher RTCPeerConnection:
 *   - Client→SFU RTT/2 from the succeeded candidate-pair
 *   - totalPacketSendDelay / packetsSent from the audio outbound-rtp stat
 *     (cumulative — caller computes deltas across polls)
 *
 * NOTE: accesses the private `room.engine.pcManager.publisher` API.
 * This is not part of the public livekit-client surface and may change
 * across SDK versions. Guarded so the hook degrades to 0 if unavailable.
 */
async function getClientStats(room: Room): Promise<ClientStatsResult> {
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
        "[useUplinkLatency] pcManager.publisher not available — client stats will be 0",
      );
    }
    return { rttHalf: 0, rawSendDelay: 0, rawPacketsSent: 0 };
  }

  let rttHalf = 0;
  let rawSendDelay = 0;
  let rawPacketsSent = 0;

  try {
    const report = await pcTransport.getStats();
    for (const [, stat] of report) {
      const s = stat as Record<string, unknown>;

      if (
        s.type === "candidate-pair" &&
        s.state === "succeeded" &&
        typeof s.currentRoundTripTime === "number"
      ) {
        rttHalf = (s.currentRoundTripTime as number) / 2;
      }

      if (
        s.type === "outbound-rtp" &&
        s.kind === "audio" &&
        typeof s.totalPacketSendDelay === "number" &&
        typeof s.packetsSent === "number"
      ) {
        rawSendDelay = s.totalPacketSendDelay as number;
        rawPacketsSent = s.packetsSent as number;
      }
    }
  } catch {
    // ignore — stats API may be unavailable during reconnection
  }
  return { rttHalf, rawSendDelay, rawPacketsSent };
}

type ServerStatsResult = {
  /** Current jitter buffer delay in seconds (delta-based, or cumulative avg on first reading). */
  jitterBuffer: number;
  sfuToAgent: number;
  /** Raw cumulative jitterBufferDelay from the inbound-rtp stat. */
  rawJbDelay: number;
  /** Raw cumulative jitterBufferEmittedCount from the inbound-rtp stat. */
  rawJbEmitted: number;
};

// ---- Helpers to extract fields from either flat (W3C) or nested (Pion) stat shapes ----

/** Try to read a numeric field from the Pion nested candidatePair shape, or a flat shape. */
function extractCandidatePairRtt(stat: Record<string, unknown>): number | null {
  // Pion nested: { candidatePair: { candidatePair: { currentRoundTripTime, state } } }
  const nested = stat.candidatePair as Record<string, unknown> | undefined;
  if (nested) {
    const inner = nested.candidatePair as Record<string, unknown> | undefined;
    if (inner && typeof inner.currentRoundTripTime === "number") {
      return inner.currentRoundTripTime;
    }
  }
  // Flat W3C: { type: "candidate-pair", currentRoundTripTime: ... }
  if (
    stat.type === "candidate-pair" &&
    typeof stat.currentRoundTripTime === "number"
  ) {
    return stat.currentRoundTripTime as number;
  }
  return null;
}

/** Try to read jitter buffer fields from the Pion nested inboundRtp shape, or a flat shape. */
function extractJitterBuffer(stat: Record<string, unknown>): {
  kind: string;
  jbDelay: number;
  jbEmitted: number;
} | null {
  // Pion nested: { inboundRtp: { stream: { kind }, inbound: { jitterBufferDelay, jitterBufferEmittedCount } } }
  const nested = stat.inboundRtp as Record<string, unknown> | undefined;
  if (nested) {
    const stream = nested.stream as Record<string, unknown> | undefined;
    const inbound = nested.inbound as Record<string, unknown> | undefined;
    if (stream && inbound) {
      const kind = String(stream.kind ?? "");
      const jbDelay = Number(inbound.jitterBufferDelay ?? 0);
      const jbEmitted = Number(inbound.jitterBufferEmittedCount ?? 0);
      if (jbEmitted > 0) return { kind, jbDelay, jbEmitted };
    }
  }
  // Flat W3C: { kind, jitterBufferDelay, jitterBufferEmittedCount }
  if (
    typeof stat.jitterBufferDelay === "number" &&
    typeof stat.jitterBufferEmittedCount === "number" &&
    stat.jitterBufferEmittedCount > 0
  ) {
    return {
      kind: String(stat.kind ?? ""),
      jbDelay: stat.jitterBufferDelay as number,
      jbEmitted: stat.jitterBufferEmittedCount as number,
    };
  }
  return null;
}

/**
 * Extract jitter buffer delay and server-side RTT from the RTC stats response.
 *
 * Handles two stat formats:
 *   - **Flat (W3C)**: `{ type: "candidate-pair", currentRoundTripTime: ... }`
 *   - **Nested (Pion)**: `{ candidatePair: { candidatePair: { currentRoundTripTime: ... } } }`
 *
 * `jitterBufferDelay` and `jitterBufferEmittedCount` are cumulative counters.
 * To get the *current* jitter buffer delay we compute the delta between
 * consecutive readings. On the first reading we fall back to the cumulative average.
 */
function parseServerStats(
  resp: RTCStatsResponse,
  prev: { jbDelay: number; jbEmitted: number } | null,
): ServerStatsResult {
  let rawJbDelay = 0;
  let rawJbEmitted = 0;
  let sfuToAgent = 0;

  for (const stat of resp.subscriber_stats) {
    const s = stat as Record<string, unknown>;

    // Jitter buffer (audio inbound-rtp)
    const jb = extractJitterBuffer(s);
    if (jb && jb.kind === "audio") {
      rawJbDelay = jb.jbDelay;
      rawJbEmitted = jb.jbEmitted;
    }

    // Candidate-pair RTT
    if (sfuToAgent === 0) {
      const rtt = extractCandidatePairRtt(s);
      if (rtt !== null) {
        sfuToAgent = rtt / 2;
      }
    }
  }

  // Also check publisher_stats for candidate-pair RTT
  if (sfuToAgent === 0) {
    for (const stat of resp.publisher_stats as Record<string, unknown>[]) {
      const rtt = extractCandidatePairRtt(stat);
      if (rtt !== null) {
        sfuToAgent = rtt / 2;
        break;
      }
    }
  }

  let jitterBuffer = 0;
  if (rawJbEmitted > 0) {
    if (prev && rawJbEmitted > prev.jbEmitted) {
      jitterBuffer =
        (rawJbDelay - prev.jbDelay) / (rawJbEmitted - prev.jbEmitted);
    } else {
      jitterBuffer = rawJbDelay / rawJbEmitted;
    }
  }

  return { jitterBuffer, sfuToAgent, rawJbDelay, rawJbEmitted };
}

const POLL_INTERVAL_MS = 5_000;

/**
 * Opus frame duration in seconds. When the browser doesn't expose
 * totalPacketSendDelay, we use this as a floor for the send delay because the
 * encoder must buffer at least one complete frame before it can emit a packet.
 */
const OPUS_FRAME_DURATION = 0.02; // 20ms

/**
 * Measures the uplink pipeline latency: client mic → SFU → agent jitter buffer.
 *
 * Components:
 *   - Send delay: client capture→network-send (encoding, packetization) via outbound-rtp totalPacketSendDelay,
 *     or OPUS_FRAME_DURATION as a floor when the stat is unavailable
 *   - Client→SFU: half the RTT from the client's RTCPeerConnection stats
 *   - SFU→Agent: half the RTT from the server's RTCPeerConnection stats (via text stream RPC),
 *     or estimated from the minimum observed data-channel RPC round trip
 *   - Jitter buffer: delta-based current delay from the server's inbound-rtp stats
 */
type PendingRpc = {
  resolve: (v: string) => void;
  reject: (e: Error) => void;
  timerId: ReturnType<typeof setTimeout>;
};

export function useUplinkLatency(
  room: Room,
  agentIdentity: string | undefined,
): UplinkLatency {
  const [latency, setLatency] = useState<UplinkLatency>({
    total: 0,
    sendDelay: 0,
    clientToSfu: 0,
    sfuToAgent: 0,
    jitterBuffer: 0,
  });

  const pendingRef = useRef<Map<string, PendingRpc>>(new Map());
  const prevJbRef = useRef<{ jbDelay: number; jbEmitted: number } | null>(null);
  const prevSendRef = useRef<{
    delay: number;
    packets: number;
  } | null>(null);
  /** Minimum observed RPC round trip (seconds). Used to estimate sfuToAgent
   *  when the server doesn't report candidate-pair RTT. The minimum is the
   *  reading least polluted by server-side processing time. */
  const minRpcRttRef = useRef<number>(Infinity);
  const loggedServerPayloadRef = useRef(false);

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
        // Measure RPC round trip so we can estimate sfuToAgent when server
        // stats don't include candidate-pair RTT.
        const rpcStart = performance.now();
        const [serverPayload, clientStats] = await Promise.all([
          callRpc("get_rtc_stats", "{}"),
          getClientStats(room),
        ]);
        const rpcRtt = (performance.now() - rpcStart) / 1000; // seconds
        minRpcRttRef.current = Math.min(minRpcRttRef.current, rpcRtt);

        if (cancelled) return;

        if (
          process.env.NODE_ENV === "development" &&
          !loggedServerPayloadRef.current
        ) {
          loggedServerPayloadRef.current = true;
          console.log("[useUplinkLatency] raw server stats:", serverPayload);
        }

        const serverStats: RTCStatsResponse = JSON.parse(serverPayload);
        const {
          jitterBuffer,
          sfuToAgent: serverSfuToAgent,
          rawJbDelay,
          rawJbEmitted,
        } = parseServerStats(serverStats, prevJbRef.current);

        prevJbRef.current = { jbDelay: rawJbDelay, jbEmitted: rawJbEmitted };

        // Compute delta-based send delay (totalPacketSendDelay is cumulative).
        // When the stat is unavailable, use OPUS_FRAME_DURATION as a floor:
        // the encoder must buffer one complete frame before emitting a packet.
        let sendDelay = OPUS_FRAME_DURATION;
        const prevSend = prevSendRef.current;
        if (prevSend && clientStats.rawPacketsSent > prevSend.packets) {
          sendDelay = Math.max(
            OPUS_FRAME_DURATION,
            (clientStats.rawSendDelay - prevSend.delay) /
              (clientStats.rawPacketsSent - prevSend.packets),
          );
        } else if (
          clientStats.rawPacketsSent > 0 &&
          clientStats.rawSendDelay > 0
        ) {
          sendDelay = Math.max(
            OPUS_FRAME_DURATION,
            clientStats.rawSendDelay / clientStats.rawPacketsSent,
          );
        }
        prevSendRef.current = {
          delay: clientStats.rawSendDelay,
          packets: clientStats.rawPacketsSent,
        };

        const clientToSfu = clientStats.rttHalf;

        // If server didn't report candidate-pair RTT, estimate sfuToAgent
        // from the minimum observed data-channel round trip.
        // minRpcRtt ≈ 2*(clientToSfu + sfuToAgent) + minServerProcessing
        // The minimum reading has the least server-processing overhead,
        // giving the best approximation of actual network latency.
        let sfuToAgent = serverSfuToAgent;
        if (
          sfuToAgent === 0 &&
          minRpcRttRef.current < Infinity &&
          clientToSfu > 0
        ) {
          sfuToAgent = Math.max(0, minRpcRttRef.current / 2 - clientToSfu);
        }

        if (process.env.NODE_ENV === "development") {
          console.log(
            "[useUplinkLatency] send=%sms client→SFU=%sms SFU→agent=%sms (server=%sms) JB=%sms rpcRtt=%sms (min=%sms) total=%sms",
            (sendDelay * 1000).toFixed(1),
            (clientToSfu * 1000).toFixed(1),
            (sfuToAgent * 1000).toFixed(1),
            (serverSfuToAgent * 1000).toFixed(1),
            (jitterBuffer * 1000).toFixed(1),
            (rpcRtt * 1000).toFixed(1),
            (minRpcRttRef.current * 1000).toFixed(1),
            (
              (sendDelay + clientToSfu + sfuToAgent + jitterBuffer) *
              1000
            ).toFixed(1),
          );
        }

        setLatency({
          sendDelay,
          clientToSfu,
          sfuToAgent,
          jitterBuffer,
          total: sendDelay + clientToSfu + sfuToAgent + jitterBuffer,
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
