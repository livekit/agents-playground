import type {
  WaveformHighlight,
  WaveformMarker,
} from "@/hooks/useStreamingWaveform";
import { useStreamingWaveform } from "@/hooks/useStreamingWaveform";
import type { Track } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioWaveformProps {
  userTrack?: Track;
  agentTrack?: Track;
  highlights?: WaveformHighlight[];
  markers?: WaveformMarker[];
  className?: string;
}

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
const LABEL_ROW_HEIGHT = 18;
const STATE_LABEL_ROW_HEIGHT = 14;
const MARKER_GRADIENT_SAMPLES = 20;
const MARKER_GRADIENT_ALPHA = 0.25;
const MARKER_BRACKET_TICK = 4;

const VOICE_ICON_SVG =
  "M7.75 3.75V20.25M3.75 9.75V14.25M12 7.75V16.25M16.25 5.75V18.25M20.25 9.75V14.25";
const ROBOT_ICON_SVG =
  "M9.75 14.75H14.25M12 2.75V4.75M2.25 8.75V11.25M21.75 8.75V11.25M9.25 10C9.25 10.4142 8.91421 10.75 8.5 10.75C8.08579 10.75 7.75 10.4142 7.75 10C7.75 9.58579 8.08579 9.25 8.5 9.25C8.91421 9.25 9.25 9.58579 9.25 10ZM16.25 10C16.25 10.4142 15.9142 10.75 15.5 10.75C15.0858 10.75 14.75 10.4142 14.75 10C14.75 9.58579 15.0858 9.25 15.5 9.25C15.9142 9.25 16.25 9.58579 16.25 10ZM3.25 4.75H20.75V16.25C20.75 17.9069 19.4069 19.25 17.75 19.25H6.25C4.59315 19.25 3.25 17.9069 3.25 16.25V4.75Z";
let voiceIconPath: Path2D | null = null;
let robotIconPath: Path2D | null = null;
function getIconPath(track: "user" | "agent"): Path2D {
  if (track === "user") {
    return (voiceIconPath ??= new Path2D(VOICE_ICON_SVG));
  }
  return (robotIconPath ??= new Path2D(ROBOT_ICON_SVG));
}
const ICON_SCALE = 0.85;
const ICON_SIZE = 24 * ICON_SCALE;

interface IndexedHighlight {
  startIndex: number;
  endIndex: number;
  color: string;
  label?: string;
}

interface IndexedMarker {
  index: number;
  color: string;
  label: string;
  track: "user" | "agent";
  variant: "speaking-start" | "speaking-end" | "state-label";
}

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
  userTrack,
  agentTrack,
  highlights,
  markers,
  className,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const { getData, toIndex, reset } = useStreamingWaveform(
    userTrack,
    agentTrack,
    paused,
  );

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      if (prev) reset(); // unpausing — start fresh
      return !prev;
    });
  }, [reset]);

  // Mirror props into refs so the long-lived rAF draw closure always reads the
  // latest values without restarting the animation loop.
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  const markersRef = useRef(markers);
  markersRef.current = markers;

  useEffect(() => {
    if (paused) return; // keep canvas frozen with its last frame

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let prevCanvasW = 0;
    let prevCanvasH = 0;

    const draw = () => {
      const {
        userBuffer,
        userCount,
        agentBuffer,
        agentCount,
        totalTrimmed,
        startedAt,
      } = getData();
      const sampleCount = Math.max(userCount, agentCount);

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const canvasHeight =
        TIMELINE_HEIGHT +
        LABEL_ROW_HEIGHT +
        TRACK_HEIGHT * 2 +
        STATE_LABEL_ROW_HEIGHT * 2;

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

      const labelRowTop = TIMELINE_HEIGHT;
      const waveTop = TIMELINE_HEIGHT + LABEL_ROW_HEIGHT;
      // Layout: User Track | User State Labels | Agent Track | Agent State Labels
      const userTrackTop = waveTop;
      const userStateLabelTop = userTrackTop + TRACK_HEIGHT;
      const agentTrackTop = userStateLabelTop + STATE_LABEL_ROW_HEIGHT;
      const agentStateLabelTop = agentTrackTop + TRACK_HEIGHT;
      const waveformWidth = width - LABEL_WIDTH;
      const maxVisible = Math.floor(waveformWidth / TICK_WIDTH);
      const visibleStart = Math.max(0, sampleCount - maxVisible);
      const visibleCount = sampleCount - visibleStart;

      // Drop highlights/markers from before the current recording session so
      // they don't pile up at index 0 after a pause→resume reset.
      const indexHighlights: IndexedHighlight[] = (highlightsRef.current ?? [])
        .filter((h) => startedAt === 0 || h.end >= startedAt)
        .map((h) => ({
          startIndex: toIndex(h.start),
          endIndex: toIndex(h.end),
          color: h.color,
          label: h.label,
        }));

      drawTimeTicks(ctx, visibleStart, visibleCount, width, totalTrimmed);

      ctx.strokeStyle = CENTER_LINE_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (const tTop of [userTrackTop, agentTrackTop]) {
        const centerY = tTop + TRACK_HEIGHT / 2;
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
          const centerY = userTrackTop + TRACK_HEIGHT / 2;
          const halfHeight =
            (userAmp / 255) * (TRACK_HEIGHT / 2) * AMPLITUDE_SCALE;
          ctx.fillStyle = USER_COLOR;
          ctx.fillRect(x, centerY - halfHeight, BAR_WIDTH, halfHeight * 2);
        }

        const agentAmp =
          sampleIndex < agentCount ? agentBuffer[sampleIndex] : 0;
        if (agentAmp > 0) {
          const centerY = agentTrackTop + TRACK_HEIGHT / 2;
          const halfHeight =
            (agentAmp / 255) * (TRACK_HEIGHT / 2) * AMPLITUDE_SCALE;
          ctx.fillStyle = AGENT_COLOR;
          ctx.fillRect(x, centerY - halfHeight, BAR_WIDTH, halfHeight * 2);
        }
      }

      const indexMarkers: IndexedMarker[] = (markersRef.current ?? [])
        .filter((m) => startedAt === 0 || m.timestamp >= startedAt)
        .map((m) => ({
          index: toIndex(m.timestamp),
          color: m.color,
          label: m.label,
          track: m.track,
          variant: m.variant,
        }));

      for (const mk of indexMarkers) {
        const vi = mk.index - visibleStart;
        if (vi < 0 || vi >= visibleCount) continue;
        const x = Math.round(LABEL_WIDTH + vi * TICK_WIDTH);
        if (x <= LABEL_WIDTH || x >= width) continue;

        const trackTop = mk.track === "user" ? userTrackTop : agentTrackTop;
        const trackBot = trackTop + TRACK_HEIGHT;
        const labelRowY =
          mk.track === "user" ? userStateLabelTop : agentStateLabelTop;

        ctx.save();

        if (mk.variant === "speaking-start") {
          drawBracket(ctx, x, trackTop, TRACK_HEIGHT, mk.color, 1);

          const gradW = MARKER_GRADIENT_SAMPLES * TICK_WIDTH;
          const grad = ctx.createLinearGradient(x, 0, x + gradW, 0);
          grad.addColorStop(0, mk.color);
          grad.addColorStop(1, "transparent");
          ctx.globalAlpha = MARKER_GRADIENT_ALPHA;
          ctx.fillStyle = grad;
          ctx.fillRect(x, trackTop, gradW, TRACK_HEIGHT);
        } else if (mk.variant === "speaking-end") {
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

        if (mk.label !== "listening") {
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = mk.color;
          ctx.font = "bold 7px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            mk.label.toUpperCase(),
            x,
            labelRowY + STATE_LABEL_ROW_HEIGHT / 2,
          );
        }

        ctx.restore();
      }

      for (const hl of indexHighlights) {
        if (!hl.label) continue;
        const lo = hl.startIndex - visibleStart;
        const hi = hl.endIndex - visibleStart;
        if (hi < 0 || lo >= visibleCount) continue;

        // Use unclamped lo/hi so the center tracks the true midpoint of the
        // highlight even when part of it has scrolled off-screen.
        const xStart = LABEL_WIDTH + lo * TICK_WIDTH;
        const xEnd = LABEL_WIDTH + (hi + 1) * TICK_WIDTH;
        // Snap to whole pixels to avoid sub-pixel anti-alias jitter between frames.
        const centerX = Math.round((xStart + xEnd) / 2);

        ctx.save();
        const labelText = hl.label.toUpperCase();
        ctx.font = "bold 8px -apple-system, BlinkMacSystemFont, sans-serif";
        const textWidth = ctx.measureText(labelText).width;
        const padX = 5;
        const padY = 3;
        const pillW = textWidth + padX * 2;
        const pillH = 8 + padY * 2;
        const pillR = 3;
        const labelY = labelRowTop + LABEL_ROW_HEIGHT / 2;

        const rawPillX = centerX - pillW / 2;
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

      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, LABEL_WIDTH, canvasHeight);
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("User", 8, userTrackTop + TRACK_HEIGHT / 2);
      ctx.fillText("Agent", 8, agentTrackTop + TRACK_HEIGHT / 2);

      const now = performance.now();
      for (const track of ["user", "agent"] as const) {
        const trackCenterY =
          track === "user"
            ? userTrackTop + TRACK_HEIGHT / 2
            : agentTrackTop + TRACK_HEIGHT / 2;
        const labelCenterX = 22;
        const iconX = labelCenterX - ICON_SIZE / 2;
        const iconY = trackCenterY - TRACK_HEIGHT / 2 - 4;
        const iconPath = getIconPath(track);
        const iconColor = track === "user" ? USER_COLOR : AGENT_COLOR;

        let latest: IndexedMarker | undefined;
        for (let i = indexMarkers.length - 1; i >= 0; i--) {
          if (indexMarkers[i].track === track) {
            latest = indexMarkers[i];
            break;
          }
        }
        const state = latest?.label;
        let alpha = 0.15;
        if (state === "speaking") {
          alpha = Math.floor(now / 250) % 2 === 0 ? 1.0 : 0.15;
        } else if (state === "thinking") {
          alpha = 1.0;
        }

        ctx.save();
        ctx.translate(iconX, iconY);
        ctx.scale(ICON_SCALE, ICON_SCALE);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = iconColor;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "square";
        ctx.stroke(iconPath);
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [getData, toIndex, paused]);

  return (
    <div
      ref={containerRef}
      data-slot="audio-waveform"
      className={`w-full h-full overflow-hidden flex flex-col relative${className ? ` ${className}` : ""}`}
      style={{ background: BG_COLOR }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <button
        onClick={togglePause}
        className="absolute bottom-2 right-2 h-6 w-6 rounded flex items-center justify-center transition-colors"
        style={{
          background: "rgba(255, 255, 255, 0.08)",
          color: LABEL_COLOR,
        }}
        title={paused ? "Resume (clears waveform)" : "Pause"}
      >
        {paused ? (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
            <path d="M0 0l10 6-10 6z" />
          </svg>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
            <rect x="0" y="0" width="3" height="12" />
            <rect x="7" y="0" width="3" height="12" />
          </svg>
        )}
      </button>
    </div>
  );
}

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
