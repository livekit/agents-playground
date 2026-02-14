import type { WaveformHighlight } from "@/hooks/useStreamingWaveform";
import { useStreamingWaveform } from "@/hooks/useStreamingWaveform";
import type { Track } from "livekit-client";
import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LegendItemDef {
  color: string;
  label: string;
}

export interface AudioWaveformProps {
  userTrack?: Track;
  agentTrack?: Track;
  highlights?: WaveformHighlight[];
  /** Extra legend entries rendered after the built-in User / Agent items. */
  legendItems?: LegendItemDef[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants – rendering
// ---------------------------------------------------------------------------

const BAR_WIDTH = 1;
const BAR_GAP = 1;
const TICK_WIDTH = BAR_WIDTH + BAR_GAP;
const TRACK_HEIGHT = 60;
const LABEL_WIDTH = 50;
const AMPLITUDE_SCALE = 0.9;

const USER_COLOR = "#666666";
const AGENT_COLOR = "#BA1FF9";
const CENTER_LINE_COLOR = "rgba(255, 255, 255, 0.1)";
const BG_COLOR = "#111";
const LABEL_COLOR = "#B2B2B2";

const NOMINAL_SAMPLE_RATE = 100;
const TIMELINE_HEIGHT = 18;
const TICK_LABEL_COLOR = "rgba(255, 255, 255, 0.35)";
const MAJOR_TICK_INTERVAL = 5;
const MINOR_TICK_INTERVAL = 1;
const HIGHLIGHT_FALLOFF_SAMPLES = 20;
const HIGHLIGHT_MAX_ALPHA = 0.72;

// ---------------------------------------------------------------------------
// Internal index-based highlight (used only during a single draw frame)
// ---------------------------------------------------------------------------

interface IndexedHighlight {
  startIndex: number;
  endIndex: number;
  color: string;
}

interface HighlightSampleStyle {
  color: string;
  alpha: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Self-contained audio waveform visualizer.
 *
 * Accepts user and agent audio tracks, manages its own streaming capture via
 * `useStreamingWaveform`, and renders a scrolling canvas of amplitude bars.
 *
 * Highlights are provided as time-based props and converted to buffer indices
 * each frame.
 */
export function AudioWaveform({
  userTrack,
  agentTrack,
  highlights,
  legendItems,
  className,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { getData, toIndex } = useStreamingWaveform(userTrack, agentTrack);

  // Mirror props into refs so the long-lived rAF draw closure always reads the
  // latest values without restarting the animation loop.
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;

  // Canvas draw loop -----------------------------------------------------------
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
      const { userBuffer, userCount, agentBuffer, agentCount, totalTrimmed } =
        getData();
      const sampleCount = Math.max(userCount, agentCount);

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const canvasHeight = TIMELINE_HEIGHT + TRACK_HEIGHT * 2;

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

      const waveTop = TIMELINE_HEIGHT;
      const waveformWidth = width - LABEL_WIDTH;
      const maxVisible = Math.floor(waveformWidth / TICK_WIDTH);
      const visibleStart = Math.max(0, sampleCount - maxVisible);
      const visibleCount = sampleCount - visibleStart;

      const indexHighlights: IndexedHighlight[] = (
        highlightsRef.current ?? []
      ).map((h) => ({
        startIndex: toIndex(h.start),
        endIndex: toIndex(h.end),
        color: h.color,
      }));

      // Build per-sample highlight lookup using center-weighted falloff.
      const highlightMap = new Map<number, HighlightSampleStyle>();
      for (const hl of indexHighlights) {
        const lo = Math.max(0, hl.startIndex - visibleStart);
        const hi = Math.min(visibleCount - 1, hl.endIndex - visibleStart);
        if (hi < 0 || lo >= visibleCount) continue;

        const center = (lo + hi) / 2;
        const halfSpan = Math.max(1, (hi - lo + 1) / 2);
        const sigma = Math.max(1, halfSpan + HIGHLIGHT_FALLOFF_SAMPLES);
        const influenceRadius = Math.ceil(sigma * 2.5);
        const start = Math.max(0, Math.floor(center - influenceRadius));
        const end = Math.min(
          visibleCount - 1,
          Math.ceil(center + influenceRadius),
        );

        for (let i = start; i <= end; i++) {
          const normalizedDistance = Math.abs(i - center) / sigma;
          const gaussian = Math.exp(-(normalizedDistance * normalizedDistance));
          const alpha = HIGHLIGHT_MAX_ALPHA * gaussian;
          if (alpha <= 0.01) continue;
          const prev = highlightMap.get(i);
          if (!prev || alpha > prev.alpha) {
            highlightMap.set(i, { color: hl.color, alpha });
          }
        }
      }

      drawTimeTicks(ctx, visibleStart, visibleCount, width, totalTrimmed);

      ctx.strokeStyle = CENTER_LINE_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LABEL_WIDTH, waveTop);
      ctx.lineTo(width, waveTop);
      ctx.stroke();

      ctx.strokeStyle = CENTER_LINE_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let track = 0; track < 2; track++) {
        const centerY = waveTop + track * TRACK_HEIGHT + TRACK_HEIGHT / 2;
        ctx.beginPath();
        ctx.moveTo(LABEL_WIDTH, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      for (let visibleIndex = 0; visibleIndex < visibleCount; visibleIndex++) {
        const sampleIndex = visibleStart + visibleIndex;
        const x = LABEL_WIDTH + visibleIndex * TICK_WIDTH;

        const userAmp = sampleIndex < userCount ? userBuffer[sampleIndex] : 0;
        if (userAmp > 0) {
          const centerY = waveTop + TRACK_HEIGHT / 2;
          const halfHeight =
            (userAmp / 255) * (TRACK_HEIGHT / 2) * AMPLITUDE_SCALE;
          const hl = highlightMap.get(visibleIndex);
          ctx.fillStyle = USER_COLOR;
          ctx.fillRect(x, centerY - halfHeight, BAR_WIDTH, halfHeight * 2);
          if (hl && hl.alpha > 0) {
            ctx.globalAlpha = hl.alpha;
            ctx.fillStyle = hl.color;
            ctx.fillRect(x, centerY - halfHeight, BAR_WIDTH, halfHeight * 2);
            ctx.globalAlpha = 1;
          }
        }

        const agentAmp =
          sampleIndex < agentCount ? agentBuffer[sampleIndex] : 0;
        if (agentAmp > 0) {
          const centerY = waveTop + TRACK_HEIGHT + TRACK_HEIGHT / 2;
          const halfHeight =
            (agentAmp / 255) * (TRACK_HEIGHT / 2) * AMPLITUDE_SCALE;
          ctx.fillStyle = AGENT_COLOR;
          ctx.fillRect(x, centerY - halfHeight, BAR_WIDTH, halfHeight * 2);
        }
      }

      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, LABEL_WIDTH, canvasHeight);
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("User", 8, waveTop + TRACK_HEIGHT / 2);
      ctx.fillText("Agent", 8, waveTop + TRACK_HEIGHT + TRACK_HEIGHT / 2);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [getData, toIndex]);

  return (
    <div
      ref={containerRef}
      data-slot="audio-waveform"
      className={`w-full h-full overflow-hidden flex flex-col${className ? ` ${className}` : ""}`}
      style={{ background: BG_COLOR }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <div
        className="flex items-center gap-4 px-3 py-1.5 text-[11px] shrink-0"
        style={{
          color: LABEL_COLOR,
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <LegendItem color={USER_COLOR} label="User" />
        <LegendItem color={AGENT_COLOR} label="Agent" />
        {legendItems?.map((item) => (
          <LegendItem key={item.label} color={item.color} label={item.label} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Canvas drawing helpers
// ---------------------------------------------------------------------------

function drawTimeTicks(
  ctx: CanvasRenderingContext2D,
  visibleStart: number,
  visibleCount: number,
  canvasWidth: number,
  totalTrimmed: number,
) {
  const samplesPerSec = NOMINAL_SAMPLE_RATE;
  // Offset by totalTrimmed so labels reflect actual elapsed time, not
  // buffer-relative indices that jump back after trimming.
  const absoluteStart = visibleStart + totalTrimmed;
  const leftSec = absoluteStart / samplesPerSec;
  const rightSec = (absoluteStart + visibleCount) / samplesPerSec;
  const firstTick =
    Math.ceil(leftSec / MINOR_TICK_INTERVAL) * MINOR_TICK_INTERVAL;

  ctx.save();
  ctx.setLineDash([]);

  for (let sec = firstTick; sec <= rightSec; sec += MINOR_TICK_INTERVAL) {
    if (sec <= 0) continue;

    const offset = sec * samplesPerSec - absoluteStart;
    const x = LABEL_WIDTH + offset * TICK_WIDTH;
    if (x <= LABEL_WIDTH || x >= canvasWidth) continue;

    const isMajor = sec % MAJOR_TICK_INTERVAL === 0;

    ctx.strokeStyle = TICK_LABEL_COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = isMajor ? 0.8 : 0.4;
    ctx.beginPath();
    ctx.moveTo(x, TIMELINE_HEIGHT - (isMajor ? 5 : 3));
    ctx.lineTo(x, TIMELINE_HEIGHT);
    ctx.stroke();

    const showLabel = isMajor || visibleCount / samplesPerSec <= 8;
    if (showLabel) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = TICK_LABEL_COLOR;
      ctx.font = "9px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textBaseline = "bottom";
      ctx.textAlign = "center";
      ctx.fillText(formatTickLabel(sec), x, TIMELINE_HEIGHT - 5);
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
