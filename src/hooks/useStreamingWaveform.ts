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

function createChannel(): ChannelState {
  return { buffer: new Uint8Array(INITIAL_CAPACITY), count: 0 };
}

function appendSample(channel: ChannelState, sample: number): void {
  if (channel.count >= channel.buffer.length) {
    const next = new Uint8Array(channel.buffer.length * 2);
    next.set(channel.buffer);
    channel.buffer = next;
  }
  channel.buffer[channel.count++] = sample;
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

export interface WaveformHighlight {
  startIndex: number;
  endIndex: number;
  type: "interruption" | "backchannel";
}

export interface WaveformSnapshot {
  userBuffer: Uint8Array;
  userCount: number;
  agentBuffer: Uint8Array;
  agentCount: number;
  highlights: readonly WaveformHighlight[];
}

export interface UseStreamingWaveformReturn {
  sampleCount: number;
  sampleRate: number;
  addHighlight: (highlight: WaveformHighlight) => void;
  toIndex: (timestamp: number) => number;
  getData: () => WaveformSnapshot;
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
): UseStreamingWaveformReturn {
  const userChannelRef = useRef<ChannelState>(createChannel());
  const agentChannelRef = useRef<ChannelState>(createChannel());
  const userAnalyserRef = useRef<AnalyserState | null>(null);
  const agentAnalyserRef = useRef<AnalyserState | null>(null);
  const highlightsRef = useRef<WaveformHighlight[]>([]);
  const startedAtRef = useRef(0);
  const totalTrimmedRef = useRef(0);

  const addHighlight = useCallback((h: WaveformHighlight) => {
    highlightsRef.current = [...highlightsRef.current, h];
  }, []);

  const toIndex = useCallback((ts: number): number => {
    const origin = startedAtRef.current;
    if (origin === 0) return 0;

    const currentCount = Math.max(
      userChannelRef.current.count,
      agentChannelRef.current.count,
    );
    const totalProduced = currentCount + totalTrimmedRef.current;
    const elapsed = Date.now() / 1000 - origin;
    const effectiveRate = elapsed > 0 ? totalProduced / elapsed : SAMPLE_RATE;

    const absoluteIndex = (ts - origin) * effectiveRate;
    const bufferIndex = absoluteIndex - totalTrimmedRef.current;
    return Math.max(0, Math.round(bufferIndex));
  }, []);

  const getData = useCallback(
    (): WaveformSnapshot => ({
      userBuffer: userChannelRef.current.buffer,
      userCount: userChannelRef.current.count,
      agentBuffer: agentChannelRef.current.buffer,
      agentCount: agentChannelRef.current.count,
      highlights: highlightsRef.current,
    }),
    [],
  );

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
    const intervalMs = 1000 / SAMPLE_RATE;
    const interval = setInterval(() => {
      const userAnalyser = userAnalyserRef.current;
      const agentAnalyser = agentAnalyserRef.current;

      if (!userAnalyser && !agentAnalyser) return;

      if (startedAtRef.current === 0) {
        startedAtRef.current = Date.now() / 1000;
      }

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
        totalTrimmedRef.current += excess;

        highlightsRef.current = highlightsRef.current
          .map((h) => ({
            ...h,
            startIndex: h.startIndex - excess,
            endIndex: h.endIndex - excess,
          }))
          .filter((h) => h.endIndex > 0);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!userTrack && !agentTrack) {
      userChannelRef.current = createChannel();
      agentChannelRef.current = createChannel();
      highlightsRef.current = [];
      startedAtRef.current = 0;
      totalTrimmedRef.current = 0;
    }
  }, [userTrack, agentTrack]);

  return {
    sampleCount: Math.max(
      userChannelRef.current.count,
      agentChannelRef.current.count,
    ),
    sampleRate: SAMPLE_RATE,
    addHighlight,
    toIndex,
    getData,
  };
}
