import type { Track } from "livekit-client";
import { RemoteAudioTrack, Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Playout delay measurement (delta-based, not lifetime average)
// ---------------------------------------------------------------------------

interface PlayoutState {
  prevPlayoutDelay: number;
  prevSamplesCount: number;
  prevTimestamp: number;
}

function createPlayoutState(): PlayoutState {
  return { prevPlayoutDelay: 0, prevSamplesCount: 0, prevTimestamp: 0 };
}

async function getCurrentPlayoutDelay(
  track: RemoteAudioTrack,
  state: PlayoutState,
): Promise<number> {
  const report = await track.getRTCStatsReport();
  if (!report) return 0;

  let totalPlayoutDelay = 0;
  let totalSamplesDuration = 0;
  let totalSamplesCount = 0;

  report.forEach((stat: Record<string, unknown>) => {
    if (stat.type === "media-playout") {
      totalPlayoutDelay = (stat.totalPlayoutDelay as number) ?? 0;
      totalSamplesDuration = (stat.totalSamplesDuration as number) ?? 0;
      totalSamplesCount = (stat.totalSamplesCount as number) ?? 0;
    }
  });

  const now = Date.now() / 1000;
  let currentDelay = 0;
  let delaySource = "none";

  // W3C spec: average playout delay = totalPlayoutDelay / totalSamplesCount
  // totalPlayoutDelay is accumulated per-sample, so we must divide by sample
  // count (not totalSamplesDuration which is audio-seconds).
  if (state.prevTimestamp > 0) {
    const elapsed = now - state.prevTimestamp;
    if (elapsed > 0) {
      const deltaDelay = totalPlayoutDelay - state.prevPlayoutDelay;
      const deltaCount = totalSamplesCount - state.prevSamplesCount;
      if (deltaCount > 0) {
        currentDelay = deltaDelay / deltaCount;
        delaySource = "delta";
      }
    }
  }

  state.prevPlayoutDelay = totalPlayoutDelay;
  state.prevSamplesCount = totalSamplesCount;
  state.prevTimestamp = now;

  // Fallback: lifetime average when no delta is available yet
  if (currentDelay === 0 && totalSamplesCount > 0) {
    currentDelay = totalPlayoutDelay / totalSamplesCount;
    delaySource = "fallback-count";
  }

  // #region agent log
  fetch("http://127.0.0.1:7243/ingest/b12283cb-413d-4953-a08e-7e5d83a2db14", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "useLatency.ts:playout",
      message: "playoutDelay raw",
      data: {
        totalPlayoutDelay,
        totalSamplesDuration,
        totalSamplesCount,
        currentDelay,
        delaySource,
        prevTimestamp: state.prevTimestamp,
      },
      timestamp: Date.now(),
      hypothesisId: "H1-H2",
    }),
  }).catch(() => {});
  // #endregion

  return currentDelay;
}

// ---------------------------------------------------------------------------
// Subscriber RTT measurement
// ---------------------------------------------------------------------------

async function getSubscriberRTT(room: Room): Promise<number> {
  const engine = (room as unknown as Record<string, unknown>).engine as
    | { subscriber?: { pc?: RTCPeerConnection } }
    | undefined;
  const pc = engine?.subscriber?.pc;
  if (!pc) return 0;

  const stats = await pc.getStats();

  let selectedPairId = "";
  let currentRTT = 0;
  let avgRTT = 0;
  let responsesReceived = 0;

  let matchedPairs = 0;
  stats.forEach((report: Record<string, unknown>) => {
    if (report.type === "transport") {
      selectedPairId =
        (report.selectedCandidatePairId as string) ||
        (report.id as string) ||
        "";
    }
    if (
      report.type === "candidate-pair" &&
      (report.selected || report.nominated || report.id === selectedPairId)
    ) {
      matchedPairs++;
      currentRTT = (report.currentRoundTripTime as number) ?? 0;
      avgRTT = (report.totalRoundTripTime as number) ?? 0;
      responsesReceived = (report.responsesReceived as number) ?? 0;
    }
  });

  const rttResult =
    currentRTT > 0
      ? currentRTT
      : responsesReceived > 0
        ? avgRTT / responsesReceived
        : 0;

  // #region agent log
  fetch("http://127.0.0.1:7243/ingest/b12283cb-413d-4953-a08e-7e5d83a2db14", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "useLatency.ts:rtt",
      message: "subscriberRTT raw",
      data: {
        currentRTT,
        avgRTT,
        responsesReceived,
        selectedPairId,
        matchedPairs,
        rttResult,
        hasPc: !!pc,
      },
      timestamp: Date.now(),
      hypothesisId: "H3-H4",
    }),
  }).catch(() => {});
  // #endregion

  return rttResult;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;

export interface UseLatencyReturn {
  /** Estimated total latency in seconds (server → client audio playback). */
  latency: number;
}

/**
 * Periodically measures the estimated end-to-end latency from the server to
 * the client's audio output.
 *
 * Combines:
 *  - Subscriber RTT (doubled to approximate full publisher→SFU→subscriber path)
 *  - Current playout delay (jitter buffer + any explicit playout delay)
 */
export function useLatency(
  room: Room,
  agentTrack: Track | undefined,
): UseLatencyReturn {
  const [latency, setLatency] = useState(0);
  const playoutStateRef = useRef<PlayoutState>(createPlayoutState());

  // Reset playout state when track changes
  useEffect(() => {
    playoutStateRef.current = createPlayoutState();
  }, [agentTrack]);

  const measure = useCallback(async () => {
    if (!agentTrack || !(agentTrack instanceof RemoteAudioTrack)) return;

    const [rtt, playoutDelay] = await Promise.all([
      getSubscriberRTT(room),
      getCurrentPlayoutDelay(agentTrack, playoutStateRef.current),
    ]);

    const total = rtt * 2 + playoutDelay;

    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/b12283cb-413d-4953-a08e-7e5d83a2db14", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "useLatency.ts:measure",
        message: "total latency",
        data: { rtt, playoutDelay, total, totalMs: total * 1000 },
        timestamp: Date.now(),
        hypothesisId: "H1-H5",
      }),
    }).catch(() => {});
    // #endregion

    setLatency(total);
  }, [room, agentTrack]);

  useEffect(() => {
    if (!agentTrack) return;

    // Measure immediately, then poll
    measure();
    const interval = setInterval(measure, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [agentTrack, measure]);

  return { latency };
}
