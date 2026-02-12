import type {
  WaveformHighlight,
  WaveformSnapshot,
} from "@/hooks/useStreamingWaveform";
import { useEffect, useRef } from "react";

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
const BACKCHANNEL_COLOR = "#F97A1F";
const INTERRUPTION_COLOR = "#FA4C39";

const NOMINAL_SAMPLE_RATE = 100;
const TIMELINE_HEIGHT = 18;
const TICK_LABEL_COLOR = "rgba(255, 255, 255, 0.35)";
const MAJOR_TICK_INTERVAL = 5;
const MINOR_TICK_INTERVAL = 1;

interface WaveformTabProps {
  getData: () => WaveformSnapshot;
}

export function WaveformTab({ getData }: WaveformTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      const { userBuffer, userCount, agentBuffer, agentCount, highlights } =
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

      const highlightMap = new Map<number, "interruption" | "backchannel">();
      for (const highlight of highlights) {
        const lo = Math.max(0, highlight.startIndex - visibleStart);
        const hi = Math.min(
          visibleCount - 1,
          highlight.endIndex - visibleStart,
        );
        if (hi < 0 || lo >= visibleCount) continue;
        for (let i = lo; i <= hi; i++) {
          highlightMap.set(i, highlight.type);
        }
      }

      drawTimeTicks(ctx, visibleStart, visibleCount, width);

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
          const highlightType = highlightMap.get(visibleIndex);
          if (highlightType === "interruption") {
            ctx.fillStyle = INTERRUPTION_COLOR;
          } else if (highlightType === "backchannel") {
            ctx.fillStyle = BACKCHANNEL_COLOR;
          } else {
            ctx.fillStyle = USER_COLOR;
          }
          ctx.fillRect(x, centerY - halfHeight, BAR_WIDTH, halfHeight * 2);
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

      drawHighlightBoundaries(
        ctx,
        highlights,
        visibleStart,
        visibleCount,
        waveTop,
      );

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
  }, [getData]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden flex flex-col"
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
        <LegendItem color={INTERRUPTION_COLOR} label="Interruption" />
        <LegendItem color={BACKCHANNEL_COLOR} label="Backchannel" />
      </div>
    </div>
  );
}

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

function drawTimeTicks(
  ctx: CanvasRenderingContext2D,
  visibleStart: number,
  visibleCount: number,
  canvasWidth: number,
) {
  const samplesPerSec = NOMINAL_SAMPLE_RATE;
  const leftSec = visibleStart / samplesPerSec;
  const rightSec = (visibleStart + visibleCount) / samplesPerSec;
  const firstTick =
    Math.ceil(leftSec / MINOR_TICK_INTERVAL) * MINOR_TICK_INTERVAL;

  ctx.save();
  ctx.setLineDash([]);

  for (let sec = firstTick; sec <= rightSec; sec += MINOR_TICK_INTERVAL) {
    if (sec <= 0) continue;

    const offset = sec * samplesPerSec - visibleStart;
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

function drawHighlightBoundaries(
  ctx: CanvasRenderingContext2D,
  highlights: readonly WaveformHighlight[],
  visibleStart: number,
  visibleCount: number,
  waveTop: number,
) {
  for (const highlight of highlights) {
    const lo = Math.max(0, highlight.startIndex - visibleStart);
    const hi = Math.min(visibleCount, highlight.endIndex - visibleStart);
    if (hi < 0 || lo >= visibleCount) continue;

    const color =
      highlight.type === "interruption"
        ? INTERRUPTION_COLOR
        : BACKCHANNEL_COLOR;
    const leftX = LABEL_WIDTH + lo * TICK_WIDTH;
    const rightX = LABEL_WIDTH + hi * TICK_WIDTH;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;

    ctx.beginPath();
    ctx.moveTo(leftX, waveTop);
    ctx.lineTo(leftX, waveTop + TRACK_HEIGHT);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightX, waveTop);
    ctx.lineTo(rightX, waveTop + TRACK_HEIGHT);
    ctx.stroke();

    ctx.globalAlpha = 0.08;
    ctx.fillStyle = color;
    ctx.fillRect(leftX, waveTop, rightX - leftX, TRACK_HEIGHT);

    ctx.globalAlpha = 1;
  }
}
