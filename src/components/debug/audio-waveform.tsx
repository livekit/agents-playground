import type {
  WaveformClock,
  WaveformHighlight,
  WaveformMarker,
} from "@/hooks/useStreamingWaveform";
import {
  SAMPLE_RATE,
  useStreamingWaveform,
} from "@/hooks/useStreamingWaveform";
import type { Track } from "livekit-client";
import { useEffect, useRef } from "react";
import { CANVAS_FONT_STACK, cssVar } from "./shared";

export type AudioWaveformProps = {
  track?: Track;
  clock: WaveformClock;
  color?: string;
  label?: string;
  tickPlacement?: "top" | "bottom" | "hidden";
  highlights?: WaveformHighlight[];
  markers?: WaveformMarker[];
  className?: string;
};

const BAR_WIDTH = 1;
const BAR_GAP = 1;
const TICK_WIDTH = BAR_WIDTH + BAR_GAP;
const TRACK_HEIGHT = 60;
const LABEL_WIDTH = 50;
const AMPLITUDE_SCALE = 0.9;

const TIMELINE_HEIGHT = 18;
const MAJOR_TICK_INTERVAL = 5;
const MINOR_TICK_INTERVAL = 1;
const LABEL_ROW_HEIGHT = 18;
const LABEL_ROW_GAP = 8;
const STATE_LABEL_ROW_HEIGHT = 14;
const MARKER_GRADIENT_SAMPLES = 20;
const MARKER_GRADIENT_ALPHA = 0.25;
const MARKER_BRACKET_TICK = 4;

/** Snap window in samples (100ms at SAMPLE_RATE). */
const SNAP_WINDOW_SEC = 0.1;
const SNAP_SAMPLES = Math.round(SAMPLE_RATE * SNAP_WINDOW_SEC);
/** Maximum total snap search distance (500ms). */
const MAX_SNAP_MULTIPLIER = 5;
const MAX_SNAP = SNAP_SAMPLES * MAX_SNAP_MULTIPLIER;
/** Minimum amplitude to qualify as speech for snapping. */
const SPEECH_THRESHOLD = 5;

/** Find nearest speech sample by expanding outward from index in both directions. */
function expandToSpeech(
  buffer: Uint8Array,
  count: number,
  index: number,
): number {
  for (let d = 0; d <= MAX_SNAP; d++) {
    if (index + d < count && buffer[index + d] >= SPEECH_THRESHOLD)
      return index + d;
    if (index - d >= 0 && buffer[index - d] >= SPEECH_THRESHOLD)
      return index - d;
  }
  return index;
}

/** From a speech sample, walk in `direction` to find the edge of the speech region.
 *  direction < 0: walk backward to find onset (first speech sample).
 *  direction > 0: walk forward to find offset (last speech sample). */
function trimToEdge(
  buffer: Uint8Array,
  count: number,
  index: number,
  direction: number,
): number {
  if (direction < 0) {
    const limit = Math.max(0, index - MAX_SNAP);
    for (let i = index - 1; i >= limit; i--) {
      if (buffer[i] < SPEECH_THRESHOLD) return i + 1;
    }
    return limit;
  } else {
    const limit = Math.min(count - 1, index + MAX_SNAP);
    for (let i = index + 1; i <= limit; i++) {
      if (buffer[i] < SPEECH_THRESHOLD) return i - 1;
    }
    return limit;
  }
}

/** Expand outward to find speech, then trim to the edge of the speech region. */
function snapAndTrim(
  buffer: Uint8Array,
  count: number,
  index: number,
  trimDirection: number,
): number {
  index = expandToSpeech(buffer, count, index);
  return trimToEdge(buffer, count, index, trimDirection);
}

type IndexedHighlight = {
  startIndex: number;
  endIndex: number;
  color: string;
  label?: string;
};

type IndexedMarker = {
  index: number;
  color: string;
  label: string;
  kind: "state-started" | "state-ended" | "state-changed";
};

function drawBracket(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  height: number,
  color: string,
  direction: 1 | -1,
) {
  const bot = top + height;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.8;
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bot);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + direction * MARKER_BRACKET_TICK, top);
  ctx.moveTo(x, bot);
  ctx.lineTo(x + direction * MARKER_BRACKET_TICK, bot);
  ctx.stroke();
  ctx.restore();
}

export function AudioWaveform({
  track,
  clock,
  color,
  label,
  tickPlacement = "top",
  highlights,
  markers,
  className,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { getData } = useStreamingWaveform(track, clock);

  // Mirror props into refs so the long-lived rAF draw closure always reads the
  // latest values without restarting the animation loop.
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const colorRef = useRef(color);
  colorRef.current = color;
  const tickPlacementRef = useRef(tickPlacement);
  tickPlacementRef.current = tickPlacement;
  const labelRef = useRef(label);
  labelRef.current = label;
  // Cached absolute snap positions keyed by sourceId, stable across correction changes.
  const snapCacheRef = useRef<Map<string, number>>(new Map());
  const lastResetGenRef = useRef(clock.getState().resetGen);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let prevCanvasW = 0;
    let prevCanvasH = 0;

    const draw = () => {
      const { buffer, count: rawCount } = getData();
      const { startedAt, totalTrimmed, resetGen, sampleCount, paused } =
        clock.getState();

      // Skip drawing when paused — canvas retains its last painted frame.
      if (paused) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      // After a clock reset the channel buffer may still hold stale samples
      // until the next tick clears it. Clamp to the clock's authoritative count.
      const count = Math.min(rawCount, sampleCount);

      // Clear snap cache when the clock has been reset (pause→resume).
      if (resetGen !== lastResetGenRef.current) {
        snapCacheRef.current.clear();
        lastResetGenRef.current = resetGen;
      }

      const bgColor = cssVar(container, "--lk-dbg-bg", "#111");
      const borderColor = cssVar(
        container,
        "--lk-dbg-border",
        "rgba(255,255,255,0.1)",
      );
      const labelColor = cssVar(container, "--lk-dbg-fg3", "#B2B2B2");
      const tickLabelColor = cssVar(
        container,
        "--lk-dbg-fg5",
        "rgba(255,255,255,0.35)",
      );
      const defaultColor = cssVar(container, "--lk-dbg-fg4", "#666666");

      const toIndex = clock.toIndex;
      const barColor = colorRef.current ?? defaultColor;
      const ticks = tickPlacementRef.current;
      const showTicks = ticks !== "hidden";
      const ticksHeight = showTicks ? TIMELINE_HEIGHT : 0;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const canvasHeight =
        ticksHeight +
        LABEL_ROW_HEIGHT +
        LABEL_ROW_GAP +
        TRACK_HEIGHT +
        STATE_LABEL_ROW_HEIGHT;

      const targetW = Math.round(width * dpr);
      const targetH = Math.round(canvasHeight * dpr);
      if (prevCanvasW !== targetW || prevCanvasH !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${canvasHeight}px`;
        prevCanvasW = targetW;
        prevCanvasH = targetH;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, canvasHeight);

      let ticksTop: number;
      let labelRowTop: number;
      let trackTop: number;
      let stateLabelTop: number;

      if (ticks === "bottom") {
        labelRowTop = 0;
        trackTop = LABEL_ROW_HEIGHT + LABEL_ROW_GAP;
        stateLabelTop = trackTop + TRACK_HEIGHT;
        ticksTop = stateLabelTop + STATE_LABEL_ROW_HEIGHT;
      } else {
        // "top" or "hidden"
        ticksTop = 0;
        labelRowTop = ticksHeight;
        trackTop = ticksHeight + LABEL_ROW_HEIGHT + LABEL_ROW_GAP;
        stateLabelTop = trackTop + TRACK_HEIGHT;
      }

      const waveformWidth = width - LABEL_WIDTH;
      const maxVisible = Math.floor(waveformWidth / TICK_WIDTH);
      const visibleStart = Math.max(0, count - maxVisible);
      const visibleCount = count - visibleStart;

      // Drop highlights/markers from before the current recording session so
      // they don't pile up at index 0 after a pause→resume reset.
      const indexHighlights: IndexedHighlight[] = (highlightsRef.current ?? [])
        .filter((h) => startedAt === 0 || h.end >= startedAt)
        .map((h) => {
          const sid = h.sourceId ?? h.start;
          const startKey = `hs_${sid}`;
          const endKey = `he_${sid}`;
          let startIndex: number;
          let endIndex: number;

          if (h.snapToWaveform && count > 0) {
            const cachedStartAbs = snapCacheRef.current.get(startKey);
            if (cachedStartAbs !== undefined) {
              startIndex = Math.min(
                Math.max(0, cachedStartAbs - totalTrimmed),
                count - 1,
              );
            } else {
              startIndex = toIndex(h.start);
              startIndex = snapAndTrim(buffer, count, startIndex, -1);
              snapCacheRef.current.set(startKey, startIndex + totalTrimmed);
            }
            const cachedEndAbs = snapCacheRef.current.get(endKey);
            if (cachedEndAbs !== undefined) {
              endIndex = cachedEndAbs - totalTrimmed;
            } else {
              const rawEnd = toIndex(h.end);
              endIndex = snapAndTrim(buffer, count, rawEnd, 1);
              const needMore =
                endIndex < count && buffer[endIndex] >= SPEECH_THRESHOLD;
              if (count - 1 >= rawEnd + (needMore ? MAX_SNAP : SNAP_SAMPLES)) {
                snapCacheRef.current.set(endKey, endIndex + totalTrimmed);
              }
            }
          } else {
            startIndex = toIndex(h.start);
            endIndex = toIndex(h.end);
          }

          return {
            startIndex,
            endIndex,
            color: h.color,
            label: h.label,
          };
        });

      if (showTicks) {
        drawTimeTicks(
          ctx,
          visibleStart,
          visibleCount,
          width,
          totalTrimmed,
          ticksTop,
          tickLabelColor,
        );
      }

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const centerY = trackTop + TRACK_HEIGHT / 2;
      ctx.beginPath();
      ctx.moveTo(LABEL_WIDTH, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let visibleIndex = 0; visibleIndex < visibleCount; visibleIndex++) {
        const sampleIndex = visibleStart + visibleIndex;
        const x = LABEL_WIDTH + visibleIndex * TICK_WIDTH;

        const amp = sampleIndex < count ? buffer[sampleIndex] : 0;
        if (amp > 0) {
          const halfHeight = (amp / 255) * (TRACK_HEIGHT / 2) * AMPLITUDE_SCALE;
          ctx.fillStyle = barColor;
          ctx.fillRect(x, centerY - halfHeight, BAR_WIDTH, halfHeight * 2);
        }
      }

      const indexMarkers: IndexedMarker[] = (markersRef.current ?? [])
        .filter((m) => startedAt === 0 || m.timestamp >= startedAt)
        .map((m) => {
          const cacheKey = `m_${m.sourceId ?? m.timestamp}_${m.kind}`;
          const cachedAbs = snapCacheRef.current.get(cacheKey);
          let index: number;

          if (m.snapToWaveform && count > 0) {
            if (cachedAbs !== undefined) {
              index = cachedAbs - totalTrimmed;
              if (index > count - 1) index = count - 1;
            } else {
              const rawIndex = toIndex(m.timestamp);
              const trimDir = m.snapToWaveform === "start" ? -1 : 1;
              index = snapAndTrim(buffer, count, rawIndex, trimDir);
              const needMore =
                index < count && buffer[index] >= SPEECH_THRESHOLD;
              const minAhead = needMore ? MAX_SNAP : SNAP_SAMPLES;
              if (count - 1 >= rawIndex + minAhead) {
                snapCacheRef.current.set(cacheKey, index + totalTrimmed);
              }
            }
          } else {
            index = toIndex(m.timestamp);
          }

          return {
            index,
            color: m.color,
            label: m.label,
            kind: m.kind,
          };
        });

      for (const mk of indexMarkers) {
        const vi = mk.index - visibleStart;
        if (vi < 0 || vi >= visibleCount) continue;
        const x = Math.round(LABEL_WIDTH + vi * TICK_WIDTH);
        if (x <= LABEL_WIDTH || x >= width) continue;

        const trackBot = trackTop + TRACK_HEIGHT;

        ctx.save();

        if (mk.kind === "state-started") {
          drawBracket(ctx, x, trackTop, TRACK_HEIGHT, mk.color, 1);

          const gradW = MARKER_GRADIENT_SAMPLES * TICK_WIDTH;
          const grad = ctx.createLinearGradient(x, 0, x + gradW, 0);
          grad.addColorStop(0, mk.color);
          grad.addColorStop(1, "transparent");
          ctx.globalAlpha = MARKER_GRADIENT_ALPHA;
          ctx.fillStyle = grad;
          ctx.fillRect(x, trackTop, gradW, TRACK_HEIGHT);
        } else if (mk.kind === "state-ended") {
          drawBracket(ctx, x, trackTop, TRACK_HEIGHT, mk.color, -1);

          const gradW = MARKER_GRADIENT_SAMPLES * TICK_WIDTH;
          const grad = ctx.createLinearGradient(x - gradW, 0, x, 0);
          grad.addColorStop(0, "transparent");
          grad.addColorStop(1, mk.color);
          ctx.globalAlpha = MARKER_GRADIENT_ALPHA;
          ctx.fillStyle = grad;
          ctx.fillRect(x - gradW, trackTop, gradW, TRACK_HEIGHT);
        } else {
          ctx.strokeStyle = mk.color;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x, trackTop);
          ctx.lineTo(x, trackBot);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (mk.kind === "state-changed") {
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = mk.color;
          ctx.font = `bold 7px ${CANVAS_FONT_STACK}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            mk.label.toUpperCase(),
            x,
            stateLabelTop + STATE_LABEL_ROW_HEIGHT / 2,
          );
        }

        ctx.restore();
      }

      for (const hl of indexHighlights) {
        if (!hl.label) continue;
        const lo = hl.startIndex - visibleStart;
        const hi = hl.endIndex - visibleStart;
        if (hi < 0 || lo >= visibleCount) continue;

        const xStart = LABEL_WIDTH + lo * TICK_WIDTH;
        const xEnd = LABEL_WIDTH + (hi + 1) * TICK_WIDTH;
        const hlCenterX = Math.round((xStart + xEnd) / 2);

        ctx.save();
        const labelText = hl.label.toUpperCase();
        ctx.font = `bold 8px ${CANVAS_FONT_STACK}`;
        const textWidth = ctx.measureText(labelText).width;
        const padX = 5;
        const padY = 3;
        const pillW = textWidth + padX * 2;
        const pillH = 8 + padY * 2;
        const pillR = 3;
        const labelY = labelRowTop + LABEL_ROW_HEIGHT / 2;

        const rawPillX = hlCenterX - pillW / 2;
        const pillX = Math.round(
          Math.max(LABEL_WIDTH + 2, Math.min(rawPillX, width - pillW - 2)),
        );
        const pillY = Math.round(labelY - pillH / 2);
        const pillCenterX = pillX + pillW / 2;

        ctx.globalAlpha = 0.18;
        ctx.fillStyle = hl.color;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, pillR);
        ctx.fill();

        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = hl.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, pillR);
        ctx.stroke();

        ctx.globalAlpha = 0.9;
        ctx.fillStyle = hl.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, pillCenterX, labelY);
        ctx.restore();
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, LABEL_WIDTH, canvasHeight);
      if (labelRef.current) {
        ctx.fillStyle = labelColor;
        ctx.font = `11px ${CANVAS_FONT_STACK}`;
        ctx.textBaseline = "middle";
        ctx.fillText(labelRef.current, 8, trackTop + TRACK_HEIGHT / 2);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [getData, clock]);

  return (
    <div
      ref={containerRef}
      data-slot="audio-waveform"
      className={`w-full overflow-hidden flex flex-col relative${className ? ` ${className}` : ""}`}
      style={{ background: "var(--lk-dbg-bg)" }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

function drawTimeTicks(
  ctx: CanvasRenderingContext2D,
  visibleStart: number,
  visibleCount: number,
  canvasWidth: number,
  totalTrimmed: number,
  ticksTop: number,
  tickLabelColor: string,
) {
  const samplesPerSec = SAMPLE_RATE;
  const absoluteStart = visibleStart + totalTrimmed;
  const leftSec = absoluteStart / samplesPerSec;
  const rightSec = (absoluteStart + visibleCount) / samplesPerSec;
  const firstTick =
    Math.ceil(leftSec / MINOR_TICK_INTERVAL) * MINOR_TICK_INTERVAL;

  const tickBottom = ticksTop + TIMELINE_HEIGHT;

  ctx.save();
  ctx.setLineDash([]);

  for (let sec = firstTick; sec <= rightSec; sec += MINOR_TICK_INTERVAL) {
    if (sec <= 0) continue;

    const offset = sec * samplesPerSec - absoluteStart;
    const x = LABEL_WIDTH + offset * TICK_WIDTH;
    if (x <= LABEL_WIDTH || x >= canvasWidth) continue;

    const isMajor = sec % MAJOR_TICK_INTERVAL === 0;

    ctx.strokeStyle = tickLabelColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = isMajor ? 0.8 : 0.4;
    ctx.beginPath();
    ctx.moveTo(x, tickBottom - (isMajor ? 5 : 3));
    ctx.lineTo(x, tickBottom);
    ctx.stroke();

    const showLabel = isMajor || visibleCount / samplesPerSec <= 8;
    if (showLabel) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = tickLabelColor;
      ctx.font = `9px ${CANVAS_FONT_STACK}`;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "center";
      ctx.fillText(formatTickLabel(sec), x, tickBottom - 5);
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function formatTickLabel(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return seconds === 0
    ? `${minutes}m`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}
