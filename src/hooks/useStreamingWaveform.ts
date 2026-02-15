import { useCallback, useEffect, useRef } from "react";
import type { Track } from "livekit-client";

const SAMPLE_RATE = 100;
const WINDOW_CAPACITY = SAMPLE_RATE * 30;
const TRIM_BUFFER = SAMPLE_RATE * 5;
const INITIAL_CAPACITY = WINDOW_CAPACITY + TRIM_BUFFER + 256;

interface ChannelState {
  buffer: Uint8Array;
  count: number;
}

interface TimelineState {
  buffer: Float64Array;
  count: number;
}

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

export interface WaveformHighlight {
  /** Start time in epoch-seconds */
  start: number;
  /** End time in epoch-seconds */
  end: number;
  /** CSS color string for this highlight */
  color: string;
  /** Optional label rendered over the highlight region */
  label?: string;
}

export interface WaveformMarker {
  /** Point-in-time in epoch-seconds */
  timestamp: number;
  /** CSS color string for this marker */
  color: string;
  /** Label text rendered in the state label row */
  label: string;
  /** Which track the marker is drawn on */
  track: "user" | "agent";
  /** Visual variant: bracket for speaking transitions, line for others */
  variant: "speaking-start" | "speaking-end" | "state-label";
}

/**
 * A point-in-time view of the waveform buffers.
 *
 * **Important:** `userBuffer` and `agentBuffer` are live references to the
 * internal ring buffers. Their contents are mutated in-place by the sampling
 * interval (via `appendSample` and `trimChannel`). Callers must consume the
 * data synchronously within the same frame (e.g. inside a rAF callback).
 * If you need to persist the data, copy with `buffer.slice(0, count)`.
 */
export interface WaveformSnapshot {
  userBuffer: Uint8Array;
  userCount: number;
  agentBuffer: Uint8Array;
  agentCount: number;
  /** Epoch-seconds when the client started recording audio. 0 if not yet started. */
  startedAt: number;
  /** Total number of samples trimmed from the front of the buffers. */
  totalTrimmed: number;
}

export interface UseStreamingWaveformReturn {
  sampleRate: number;
  toIndex: (timestamp: number) => number;
  getData: () => WaveformSnapshot;
  reset: () => void;
}

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

interface AnalyserState {
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  timeDomainBuf: Uint8Array<ArrayBuffer>;
}

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
  userTrack: Track | undefined,
  agentTrack: Track | undefined,
  paused = false,
): UseStreamingWaveformReturn {
  const userChannelRef = useRef<ChannelState>(createChannel());
  const agentChannelRef = useRef<ChannelState>(createChannel());
  const timelineRef = useRef<TimelineState>(createTimeline());
  const userAnalyserRef = useRef<AnalyserState | null>(null);
  const agentAnalyserRef = useRef<AnalyserState | null>(null);
  const startedAtRef = useRef(0);
  const totalTrimmedRef = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const toIndex = useCallback((ts: number): number => {
    const origin = startedAtRef.current;
    if (origin === 0) return 0;

    const timeline = timelineRef.current;
    if (timeline.count > 0) {
      // Map by observed sample timestamps for stable, jitter-resistant indexing.
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

  const getData = useCallback(
    (): WaveformSnapshot => ({
      userBuffer: userChannelRef.current.buffer,
      userCount: userChannelRef.current.count,
      agentBuffer: agentChannelRef.current.buffer,
      agentCount: agentChannelRef.current.count,
      startedAt: startedAtRef.current,
      totalTrimmed: totalTrimmedRef.current,
    }),
    [],
  );

  const reset = useCallback(() => {
    userChannelRef.current = createChannel();
    agentChannelRef.current = createChannel();
    timelineRef.current = createTimeline();
    startedAtRef.current = 0;
    totalTrimmedRef.current = 0;
  }, []);

  useEffect(() => {
    if (!userTrack) return;
    const state = createAnalyser(userTrack);
    userAnalyserRef.current = state;
    return () => {
      if (state) destroyAnalyser(state);
      userAnalyserRef.current = null;
    };
  }, [userTrack, userTrack?.mediaStream]);

  useEffect(() => {
    if (!agentTrack) return;
    const state = createAnalyser(agentTrack);
    agentAnalyserRef.current = state;
    return () => {
      if (state) destroyAnalyser(state);
      agentAnalyserRef.current = null;
    };
  }, [agentTrack, agentTrack?.mediaStream]);

  useEffect(() => {
    if (!userTrack && !agentTrack) return;

    const intervalMs = 1000 / SAMPLE_RATE;
    const interval = setInterval(() => {
      if (pausedRef.current) return;

      const userAnalyser = userAnalyserRef.current;
      const agentAnalyser = agentAnalyserRef.current;

      if (!userAnalyser && !agentAnalyser) return;

      const sampleTs = Date.now() / 1000;
      if (startedAtRef.current === 0) {
        startedAtRef.current = sampleTs;
      }
      appendTimestamp(timelineRef.current, sampleTs);

      const userAmp = userAnalyser
        ? peakAmplitude(userAnalyser.analyser, userAnalyser.timeDomainBuf)
        : 0;
      appendSample(userChannelRef.current, userAmp);

      const agentAmp = agentAnalyser
        ? peakAmplitude(agentAnalyser.analyser, agentAnalyser.timeDomainBuf)
        : 0;
      appendSample(agentChannelRef.current, agentAmp);

      const count = userChannelRef.current.count;
      if (count > WINDOW_CAPACITY + TRIM_BUFFER) {
        const excess = count - WINDOW_CAPACITY;
        trimChannel(userChannelRef.current, excess);
        trimChannel(agentChannelRef.current, excess);
        trimTimeline(timelineRef.current, excess);
        totalTrimmedRef.current += excess;
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [userTrack, agentTrack]);

  useEffect(() => {
    if (!userTrack && !agentTrack) {
      userChannelRef.current = createChannel();
      agentChannelRef.current = createChannel();
      timelineRef.current = createTimeline();
      startedAtRef.current = 0;
      totalTrimmedRef.current = 0;
    }
  }, [userTrack, agentTrack]);

  return {
    sampleRate: SAMPLE_RATE,
    toIndex,
    getData,
    reset,
  };
}
