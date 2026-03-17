import { AgentSession } from "@livekit/protocol";
import type { Room } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import type { UseRemoteSessionReturn } from "./useRemoteSession";

export type UplinkLatency = {
  /** Total transport pipeline delay in seconds (encoding + transport + jitter buffer). */
  total: number;
  /** Fixed encoding delay in seconds (Opus frame duration). */
  encoding: number;
  /** One-way network transport delay in seconds (client→SFU + SFU→agent). */
  transport: number;
  /** Agent jitter buffer delay in seconds. */
  jitterBuffer: number;
};

type ClientStatsResult = {
  rttHalf: number;
};

/**
 * Extract client-side RTT/2 from the publisher RTCPeerConnection's
 * succeeded candidate-pair stat.
 *
 * Accesses the private `room.engine.pcManager.publisher` API.
 * Guarded so the hook degrades to 0 if unavailable.
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
    return { rttHalf: 0 };
  }

  let rttHalf = 0;

  try {
    const report = await pcTransport.getStats();
    report.forEach((stat) => {
      const s = stat as Record<string, unknown>;
      if (
        s.type === "candidate-pair" &&
        s.state === "succeeded" &&
        typeof s.currentRoundTripTime === "number"
      ) {
        rttHalf = (s.currentRoundTripTime as number) / 2;
      }
    });
  } catch {
    // stats API may be unavailable during reconnection
  }
  return { rttHalf };
}

/** Try to read a numeric field from the Pion nested candidatePair shape, or a flat shape. */
function extractCandidatePairRtt(stat: Record<string, unknown>): number | null {
  const nested = stat.candidatePair as Record<string, unknown> | undefined;
  if (nested) {
    const inner = nested.candidatePair as Record<string, unknown> | undefined;
    if (inner && typeof inner.currentRoundTripTime === "number") {
      return inner.currentRoundTripTime;
    }
  }
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

type ServerStatsResult = {
  jitterBuffer: number;
  sfuToAgent: number;
  rawJbDelay: number;
  rawJbEmitted: number;
};

type RTCStatsData = {
  subscriberStats: Record<string, unknown>[];
  publisherStats: Record<string, unknown>[];
};

/**
 * Convert the protobuf `GetRTCStatsResponse` (which uses `google.protobuf.Struct`)
 * into plain JS objects we can inspect for RTT / jitter buffer fields.
 */
function responseToStatsData(
  resp: AgentSession.SessionResponse,
): RTCStatsData | null {
  if (resp.response.case !== "getRtcStats") return null;
  const v = resp.response.value;
  const subscriberStats = v.subscriberStats.map((s) =>
    s.toJson() as Record<string, unknown>,
  );
  const publisherStats = v.publisherStats.map((s) =>
    s.toJson() as Record<string, unknown>,
  );
  return { subscriberStats, publisherStats };
}

function parseServerStats(
  data: RTCStatsData,
  prev: { jbDelay: number; jbEmitted: number } | null,
): ServerStatsResult {
  let rawJbDelay = 0;
  let rawJbEmitted = 0;
  let sfuToAgent = 0;

  for (const s of data.subscriberStats) {
    const jb = extractJitterBuffer(s);
    if (jb && jb.kind === "audio") {
      rawJbDelay = jb.jbDelay;
      rawJbEmitted = jb.jbEmitted;
    }
    if (sfuToAgent === 0) {
      const rtt = extractCandidatePairRtt(s);
      if (rtt !== null) {
        sfuToAgent = rtt / 2;
      }
    }
  }

  if (sfuToAgent === 0) {
    for (const stat of data.publisherStats) {
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
 * Opus frame duration in seconds. Used as a floor for the encoding delay.
 */
const OPUS_FRAME_DURATION = 0.02; // 20ms

/**
 * Measures the uplink pipeline latency: client mic → SFU → agent jitter buffer.
 *
 * Uses the protobuf `SessionRequest.GetRTCStats` via `sendRequest` from
 * `useRemoteSession` instead of the old text-stream JSON RPC.
 */
export function useUplinkLatency(
  room: Room,
  agentIdentity: string | undefined,
  sendRequest: UseRemoteSessionReturn["sendRequest"],
): UplinkLatency {
  const [latency, setLatency] = useState<UplinkLatency>({
    total: 0,
    encoding: OPUS_FRAME_DURATION,
    transport: 0,
    jitterBuffer: 0,
  });

  const prevJbRef = useRef<{ jbDelay: number; jbEmitted: number } | null>(null);
  const minRpcRttRef = useRef<number>(Infinity);

  useEffect(() => {
    if (!agentIdentity) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const rpcStart = performance.now();
        const [serverResp, clientStats] = await Promise.all([
          sendRequest(agentIdentity, {
            case: "getRtcStats",
            value: new AgentSession.SessionRequest_GetRTCStats(),
          }),
          getClientStats(room),
        ]);
        const rpcRtt = (performance.now() - rpcStart) / 1000;
        minRpcRttRef.current = Math.min(minRpcRttRef.current, rpcRtt);

        if (cancelled) return;

        const statsData = responseToStatsData(serverResp);
        if (!statsData) return;

        const {
          jitterBuffer,
          sfuToAgent: serverSfuToAgent,
          rawJbDelay,
          rawJbEmitted,
        } = parseServerStats(statsData, prevJbRef.current);

        prevJbRef.current = { jbDelay: rawJbDelay, jbEmitted: rawJbEmitted };

        const clientToSfu = clientStats.rttHalf;

        let sfuToAgent = serverSfuToAgent;
        if (
          sfuToAgent === 0 &&
          minRpcRttRef.current < Infinity &&
          clientToSfu > 0
        ) {
          sfuToAgent = Math.max(0, minRpcRttRef.current / 2 - clientToSfu);
        }

        const encoding = OPUS_FRAME_DURATION;
        const transport = clientToSfu + sfuToAgent;

        setLatency({
          encoding,
          transport,
          jitterBuffer,
          total: encoding + transport + jitterBuffer,
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
  }, [room, agentIdentity, sendRequest]);

  return latency;
}
