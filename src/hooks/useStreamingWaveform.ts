import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Track } from "livekit-client";

const SAMPLE_RATE = 100;
const WINDOW_CAPACITY = SAMPLE_RATE * 30;
const TRIM_BUFFER = SAMPLE_RATE * 5;
const INITIAL_CAPACITY = WINDOW_CAPACITY + TRIM_BUFFER + 256;

type ChannelState = {
  buffer: Uint8Array;
  count: number;
};

type TimelineState = {
  buffer: Float64Array;
  count: number;
};

function createChannel(): ChannelState {
  return { buffer: new Uint8Array(INITIAL_CAPACITY), count: 0 };
}

function createTimeline(): TimelineState {
  return { buffer: new Float64Array(INITIAL_CAPACITY), count: 0 };
}

function appendSample(channel: ChannelState, sample: number): void {
  if (channel.count >= channel.buffer.length) {
    const next = new Uint8Array(channel.buffer.length * 2);
    next.set(channel.buffer);
    channel.buffer = next;
  }
  channel.buffer[channel.count++] = sample;
}

function appendTimestamp(timeline: TimelineState, timestamp: number): void {
  if (timeline.count >= timeline.buffer.length) {
    const next = new Float64Array(timeline.buffer.length * 2);
    next.set(timeline.buffer);
    timeline.buffer = next;
  }
  if (timeline.count > 0) {
    // Keep timeline sorted even if system clock steps backwards briefly.
    const prev = timeline.buffer[timeline.count - 1];
    if (timestamp < prev) timestamp = prev;
  }
  timeline.buffer[timeline.count++] = timestamp;
}

function trimChannel(channel: ChannelState, excess: number): void {
  if (excess <= 0 || channel.count === 0) return;
  if (excess >= channel.count) {
    channel.count = 0;
    return;
  }
  channel.buffer.copyWithin(0, excess, channel.count);
  channel.count -= excess;
}

function trimTimeline(timeline: TimelineState, excess: number): void {
  if (excess <= 0 || timeline.count === 0) return;
  if (excess >= timeline.count) {
    timeline.count = 0;
    return;
  }
  timeline.buffer.copyWithin(0, excess, timeline.count);
  timeline.count -= excess;
}

function upperBound(arr: Float64Array, count: number, target: number): number {
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type WaveformHighlight = {
  /** Start time in epoch-seconds */
  start: number;
  /** End time in epoch-seconds */
  end: number;
  /** CSS color string for this highlight */
  color: string;
  /** Optional label rendered over the highlight region */
  label?: string;
  /** Stable identity for caching (e.g. original event created_at before correction). */
  sourceId?: number;
  /** When true, snap start/end to the nearest speech boundary in the waveform. */
  snapToWaveform?: boolean;
};

export type WaveformMarker = {
  /** Point-in-time in epoch-seconds */
  timestamp: number;
  /** CSS color string for this marker */
  color: string;
  /** Label text rendered in the state label row */
  label: string;
  /** Marker kind: state-started/state-ended snap to speech boundaries, state-changed is a point marker. */
  kind: "state-started" | "state-ended" | "state-changed";
  /** Stable identity for caching (e.g. original event created_at before correction). */
  sourceId?: number;
  /** Snap to nearest speech boundary: "start" trims backward to onset, "end" trims forward to offset. */
  snapToWaveform?: "start" | "end";
};

/**
 * A point-in-time view of the waveform buffer.
 *
 * **Important:** `buffer` is a live reference to the internal ring buffer.
 * Its contents are mutated in-place by the sampling interval. Callers must
 * consume the data synchronously within the same frame (e.g. inside a rAF
 * callback). If you need to persist the data, copy with `buffer.slice(0, count)`.
 */
export type WaveformSnapshot = {
  buffer: Uint8Array;
  count: number;
};

// ---------------------------------------------------------------------------
// Waveform clock – shared timeline that drives one or more track channels
// ---------------------------------------------------------------------------

type TickCallback = (trimExcess: number) => void;

export type WaveformClock = {
  /** Register a callback invoked on every sample tick. Returns unsubscribe fn. */
  subscribe: (cb: TickCallback) => () => void;
  /** Convert an epoch-seconds timestamp to a buffer index. */
  toIndex: (timestamp: number) => number;
  /** Read shared clock state. */
  getState: () => {
    startedAt: number;
    totalTrimmed: number;
    sampleCount: number;
    resetGen: number;
    paused: boolean;
  };
  /** Reset the clock and all shared state. */
  reset: () => void;
};

export function useWaveformClock(paused: boolean): WaveformClock {
  const timelineRef = useRef<TimelineState>(createTimeline());
  const startedAtRef = useRef(0);
  const totalTrimmedRef = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const resetGenRef = useRef(0);
  const subscribersRef = useRef<Set<TickCallback>>(new Set());

  const subscribe = useCallback((cb: TickCallback) => {
    subscribersRef.current.add(cb);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  const toIndex = useCallback((ts: number): number => {
    const origin = startedAtRef.current;
    if (origin === 0) return 0;

    const timeline = timelineRef.current;
    if (timeline.count > 0) {
      const i = upperBound(timeline.buffer, timeline.count, ts);
      if (i <= 0) return 0;
      if (i >= timeline.count) return timeline.count - 1;
      const prev = timeline.buffer[i - 1];
      const next = timeline.buffer[i];
      return ts - prev <= next - ts ? i - 1 : i;
    }

    const absoluteIndex = (ts - origin) * SAMPLE_RATE;
    const bufferIndex = absoluteIndex - totalTrimmedRef.current;
    return Math.max(0, Math.round(bufferIndex));
  }, []);

  const getState = useCallback(
    () => ({
      startedAt: startedAtRef.current,
      totalTrimmed: totalTrimmedRef.current,
      sampleCount: timelineRef.current.count,
      resetGen: resetGenRef.current,
      paused: pausedRef.current,
    }),
    [],
  );

  const reset = useCallback(() => {
    timelineRef.current = createTimeline();
    startedAtRef.current = 0;
    totalTrimmedRef.current = 0;
    resetGenRef.current += 1;
    // Synchronously notify subscribers to clear buffers now, before any
    // rAF draw can see stale data.  -1 is a sentinel meaning "reset".
    subscribersRef.current.forEach((cb) => cb(-1));
  }, []);

  useEffect(() => {
    const intervalMs = 1000 / SAMPLE_RATE;
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      if (subscribersRef.current.size === 0) return;

      // Trim if needed — notify subscribers first so they trim in lockstep.
      let trimExcess = 0;
      const count = timelineRef.current.count;
      if (count > WINDOW_CAPACITY + TRIM_BUFFER) {
        trimExcess = count - WINDOW_CAPACITY;
        trimTimeline(timelineRef.current, trimExcess);
        totalTrimmedRef.current += trimExcess;
      }

      // Append new timestamp.
      const now = Date.now() / 1000;
      if (startedAtRef.current === 0) {
        startedAtRef.current = now;
      }
      appendTimestamp(timelineRef.current, now);

      // Notify all subscribers to trim (if needed) and append their sample.
      subscribersRef.current.forEach((cb) => cb(trimExcess));
    }, intervalMs);

    return () => clearInterval(interval);
  }, []);

  return useMemo(
    () => ({ subscribe, toIndex, getState, reset }),
    [subscribe, toIndex, getState, reset],
  );
}

// ---------------------------------------------------------------------------
// Per-track streaming waveform
// ---------------------------------------------------------------------------

export type UseStreamingWaveformReturn = {
  getData: () => WaveformSnapshot;
};

function peakAmplitude(
  analyser: AnalyserNode,
  buf: Uint8Array<ArrayBuffer>,
): number {
  analyser.getByteTimeDomainData(buf);
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const deviation = Math.abs(buf[i] - 128);
    if (deviation > peak) peak = deviation;
  }
  return Math.min(255, peak * 2);
}

type AnalyserState = {
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  timeDomainBuf: Uint8Array<ArrayBuffer>;
};

function createAnalyser(track: Track): AnalyserState | null {
  const mediaStream = track.mediaStream;
  if (!mediaStream) return null;

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(mediaStream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  return {
    ctx,
    source,
    analyser,
    timeDomainBuf: new Uint8Array(analyser.fftSize),
  };
}

function destroyAnalyser(state: AnalyserState): void {
  state.source.disconnect();
  state.ctx.close().catch(() => {});
}

export function useStreamingWaveform(
  track: Track | undefined,
  clock: WaveformClock,
): UseStreamingWaveformReturn {
  const channelRef = useRef<ChannelState>(createChannel());
  const analyserRef = useRef<AnalyserState | null>(null);
  const lastResetGenRef = useRef(clock.getState().resetGen);

  useEffect(() => {
    if (!track) return;
    const state = createAnalyser(track);
    analyserRef.current = state;
    return () => {
      if (state) destroyAnalyser(state);
      analyserRef.current = null;
    };
  }, [track, track?.mediaStream]);

  useEffect(() => {
    // Pad channel to match current clock position (for late-joining tracks).
    const { sampleCount, resetGen } = clock.getState();
    lastResetGenRef.current = resetGen;
    while (channelRef.current.count < sampleCount) {
      appendSample(channelRef.current, 0);
    }

    return clock.subscribe((trimExcess) => {
      // Sentinel -1 = synchronous reset from clock.reset().
      if (trimExcess < 0) {
        channelRef.current = createChannel();
        lastResetGenRef.current = clock.getState().resetGen;
        return;
      }

      // Trim in lockstep with the clock.
      if (trimExcess > 0) {
        trimChannel(channelRef.current, trimExcess);
      }

      // Sample amplitude (or 0 if no analyser available).
      const analyser = analyserRef.current;
      const amp = analyser
        ? peakAmplitude(analyser.analyser, analyser.timeDomainBuf)
        : 0;
      appendSample(channelRef.current, amp);
    });
  }, [clock, track]);

  useEffect(() => {
    if (!track) {
      channelRef.current = createChannel();
    }
  }, [track]);

  const getData = useCallback(
    (): WaveformSnapshot => ({
      buffer: channelRef.current.buffer,
      count: channelRef.current.count,
    }),
    [],
  );

  return { getData };
}
