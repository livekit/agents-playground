import type {
  AgentMetricsData,
  ClientConversationItemAddedEvent,
  ClientEvent,
  ClientMetricsCollectedEvent,
} from "@/lib/types";
import { useId, useMemo, useRef, useState } from "react";
import { InfoTooltip, TITLE_FONT_STACK } from "./shared";

interface Stat {
  label: string;
  value: string;
  tooltip?: string;
}

interface SummaryCardData {
  kind: "summary";
  id: string;
  title: string;
  stats: Stat[];
}

interface TrendCardData {
  kind: "trend";
  id: string;
  title: string;
  tooltip?: string;
  points: TrendPoint[];
  seriesUnit: "s" | "tok/s";
}

interface TrendPoint {
  t: number;
  v: number;
}

interface MetricsSection {
  id: string;
  title: string;
  cards: CardData[];
}

type MetricType = AgentMetricsData["type"];
type MetricByType<T extends MetricType> = Extract<
  AgentMetricsData,
  { type: T }
>;
type CardData = SummaryCardData | TrendCardData;
const MOVING_AVERAGE_WINDOW = 5;
const STALE_TREND_RATIO = 0.6;

function collectMetrics<T extends MetricType>(
  events: ClientMetricsCollectedEvent[],
  type: T,
): MetricByType<T>[] {
  return events
    .filter(
      (
        event,
      ): event is ClientMetricsCollectedEvent & { metrics: MetricByType<T> } =>
        event.metrics.type === type,
    )
    .map((event) => event.metrics);
}

function toSeries(points: TrendPoint[], maxPoints = 40): TrendPoint[] {
  if (points.length <= maxPoints) return points;
  // Keep a stable trailing window for live charts; rebucketing the full
  // history each render causes visible hover/marker jitter while streaming.
  return points.slice(points.length - maxPoints);
}

function movingAveragePoints(
  points: TrendPoint[],
  windowSize: number,
): TrendPoint[] {
  if (points.length === 0 || windowSize <= 1) return points;
  const averaged: TrendPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const slice = points.slice(start, i + 1);
    const sum = slice.reduce((acc, p) => acc + p.v, 0);
    const avg = sum / slice.length;
    const t = points[i]?.t ?? 0;
    averaged.push({ t, v: avg });
  }
  return averaged;
}

function trendCard(
  id: string,
  title: string,
  rawPoints: TrendPoint[],
  unit: "s" | "tok/s",
  tooltip?: string,
): TrendCardData {
  const smoothedPoints = movingAveragePoints(rawPoints, MOVING_AVERAGE_WINDOW);
  return {
    kind: "trend",
    id,
    title: `AVG ${title}`,
    tooltip,
    points: toSeries(smoothedPoints),
    seriesUnit: unit,
  };
}

function summaryCard(
  id: string,
  title: string,
  stats: Stat[],
): SummaryCardData {
  return {
    kind: "summary",
    id,
    title,
    stats,
  };
}

/** Extract E2E latency from assistant conversation items (server-computed). */
function extractE2eDelays(
  events: ClientConversationItemAddedEvent[],
): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const evt of events) {
    const metrics = evt.item?.metrics;
    if (evt.item?.role === "assistant" && metrics?.e2e_latency != null) {
      points.push({ t: evt.created_at, v: metrics.e2e_latency });
    }
  }
  return points;
}

function buildCards(events: ClientMetricsCollectedEvent[]): CardData[] {
  const cards: CardData[] = [];

  const llm = collectMetrics(events, "llm_metrics");
  if (llm.length > 0) {
    cards.push(
      trendCard(
        "llm-ttft",
        "LLM TTFT",
        llm.map((m) => ({ t: m.timestamp, v: m.ttft })),
        "s",
        "Time to first token from the LLM",
      ),
      trendCard(
        "llm-duration",
        "LLM Duration",
        llm.map((m) => ({ t: m.timestamp, v: m.duration })),
        "s",
        "Total LLM inference time per request",
      ),
      trendCard(
        "llm-speed",
        "LLM Speed",
        llm.map((m) => ({ t: m.timestamp, v: m.tokens_per_second })),
        "tok/s",
        "LLM output token generation rate",
      ),
    );
  }

  const stt = collectMetrics(events, "stt_metrics");
  const eou = collectMetrics(events, "eou_metrics");
  if (eou.length > 0 || stt.length > 0) {
    if (eou.length > 0) {
      cards.push(
        trendCard(
          "user-turn-txn-delay",
          "Transcription Delay",
          eou.map((m) => ({
            t: m.timestamp,
            v: m.transcription_delay,
          })),
          "s",
          "Time between end of speech and final transcript",
        ),
        trendCard(
          "user-turn-eou-delay",
          "End of Utterance Delay",
          eou.map((m) => ({
            t: m.timestamp,
            v: m.end_of_utterance_delay,
          })),
          "s",
          "Time between end of speech and end-of-utterance detection",
        ),
      );
    }
  }

  const tts = collectMetrics(events, "tts_metrics");
  if (tts.length > 0) {
    cards.push(
      trendCard(
        "tts-ttfb",
        "TTS TTFB",
        tts.map((m) => ({ t: m.timestamp, v: m.ttfb })),
        "s",
        "Time to first byte of audio from the TTS provider",
      ),
      trendCard(
        "tts-audio-duration",
        "TTS Audio Duration",
        tts.map((m) => ({ t: m.timestamp, v: m.audio_duration })),
        "s",
        "Duration of generated speech audio",
      ),
    );
  }

  const rt = collectMetrics(events, "realtime_model_metrics");
  if (rt.length > 0) {
    cards.push(
      trendCard(
        "realtime-ttft",
        "Realtime TTFT",
        rt.map((m) => ({ t: m.timestamp, v: m.ttft })),
        "s",
        "Time to first token from the realtime model",
      ),
      trendCard(
        "realtime-duration",
        "Realtime Duration",
        rt.map((m) => ({ t: m.timestamp, v: m.duration })),
        "s",
        "Total realtime model inference time per request",
      ),
      trendCard(
        "realtime-speed",
        "Realtime Speed",
        rt.map((m) => ({
          t: m.timestamp,
          v: m.tokens_per_second,
        })),
        "tok/s",
        "Realtime model output token generation rate",
      ),
    );
  }

  return cards;
}

function sectionTitleFromCardId(id: string): string {
  if (id.startsWith("llm-")) return "LLM";
  if (id.startsWith("user-turn-")) return "Turn";
  if (id.startsWith("tts-")) return "TTS";
  if (id.startsWith("realtime-")) return "Realtime";
  return "Metrics";
}

function buildSections(cards: CardData[]): MetricsSection[] {
  const sectionMap = new Map<string, MetricsSection>();
  for (const card of cards) {
    const title = sectionTitleFromCardId(card.id);
    const id = title.toLowerCase().replace(/\s+/g, "-");
    const section = sectionMap.get(id) ?? { id, title, cards: [] };
    section.cards.push(card);
    sectionMap.set(id, section);
  }
  return Array.from(sectionMap.values());
}

function MiniTrendChart({
  points,
  unit,
  label,
}: {
  points: TrendPoint[];
  unit: "s" | "tok/s";
  label: string;
}) {
  const patternId = useId();
  const maskGradientId = useId();
  const maskId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [frozenPoints, setFrozenPoints] = useState<TrendPoint[] | null>(null);
  const displayedPoints = frozenPoints ?? points;

  if (displayedPoints.length === 0) {
    return (
      <div
        className="h-[160px] flex items-center justify-center text-[10px]"
        style={{ color: "var(--lk-dbg-fg4)" }}
      >
        No samples
      </div>
    );
  }

  const width = 520;
  const height = 186;
  const left = unit === "tok/s" ? 94 : 72;
  const right = 12;
  const top = 10;
  const bottom = 30;
  let min = Infinity;
  let max = -Infinity;
  for (const p of displayedPoints) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  const span = Math.max(max - min, 1e-9);
  const minTime = displayedPoints[0]?.t ?? 0;
  const maxTime = displayedPoints[displayedPoints.length - 1]?.t ?? minTime;
  const timeSpan = Math.max(maxTime - minTime, 1e-9);

  const plotted = displayedPoints.map((point, i) => {
    const x =
      displayedPoints.length === 1
        ? width / 2
        : left + ((point.t - minTime) / timeSpan) * (width - left - right);
    const norm = (point.v - min) / span;
    const y = top + (1 - norm) * (height - top - bottom);
    return { x, y };
  });

  const firstTimestamp = displayedPoints[0]?.t ?? 0;
  const lastTimestamp =
    displayedPoints[displayedPoints.length - 1]?.t ?? firstTimestamp;
  const staleCutoffSec =
    firstTimestamp + (lastTimestamp - firstTimestamp) * STALE_TREND_RATIO;

  const linePath = plotted
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const [staleLinePath, freshLinePath] = (() => {
    type XY = { x: number; y: number };
    const stalePolylines: XY[][] = [];
    const freshPolylines: XY[][] = [];
    const epsilon = 0.01;

    const appendSegment = (target: XY[][], start: XY, end: XY) => {
      const polyline = target[target.length - 1];
      if (!polyline) {
        target.push([start, end]);
        return;
      }
      const tail = polyline[polyline.length - 1];
      const isConnected =
        tail !== undefined &&
        Math.abs(tail.x - start.x) < epsilon &&
        Math.abs(tail.y - start.y) < epsilon;
      if (isConnected) {
        polyline.push(end);
        return;
      }
      target.push([start, end]);
    };

    for (let i = 1; i < plotted.length; i++) {
      const prev = plotted[i - 1];
      const curr = plotted[i];
      const prevPoint = displayedPoints[i - 1];
      const currPoint = displayedPoints[i];
      if (!prev || !curr || !prevPoint || !currPoint) continue;

      const prevStale = prevPoint.t <= staleCutoffSec;
      const currStale = currPoint.t <= staleCutoffSec;
      if (prevStale === currStale) {
        appendSegment(prevStale ? stalePolylines : freshPolylines, prev, curr);
        continue;
      }

      const dt = currPoint.t - prevPoint.t;
      if (dt === 0) {
        appendSegment(prevStale ? stalePolylines : freshPolylines, prev, curr);
        continue;
      }

      const ratio = Math.max(
        0,
        Math.min(1, (staleCutoffSec - prevPoint.t) / dt),
      );
      const split = {
        x: prev.x + (curr.x - prev.x) * ratio,
        y: prev.y + (curr.y - prev.y) * ratio,
      };
      appendSegment(prevStale ? stalePolylines : freshPolylines, prev, split);
      appendSegment(currStale ? stalePolylines : freshPolylines, split, curr);
    }

    const toPath = (polylines: XY[][]) =>
      polylines
        .map((polyline) =>
          polyline
            .map(
              (point, i) =>
                `${i === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
            )
            .join(" "),
        )
        .join(" ");

    return [toPath(stalePolylines), toPath(freshPolylines)];
  })();
  const lastPoint = plotted[plotted.length - 1] ?? {
    x: width - right,
    y: height / 2,
  };
  const firstPoint = plotted[0] ?? { x: left, y: height / 2 };
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${(height - bottom).toFixed(2)} L ${firstPoint.x.toFixed(2)} ${(height - bottom).toFixed(2)} Z`;
  const graphBottom = height - bottom;

  const yTicks = [0, 0.33, 0.66, 1].map((k) => {
    const v = min + (1 - k) * span;
    const y = top + k * (height - top - bottom);
    return { v, y };
  });

  const xTickIdx = Array.from(
    new Set([
      0,
      Math.floor((displayedPoints.length - 1) / 2),
      displayedPoints.length - 1,
    ]),
  );

  const formatYAxis = (v: number): string => {
    if (unit === "tok/s") {
      const d = span < 1 ? 2 : span < 10 ? 1 : 0;
      return `${v.toFixed(d)} tok/s`;
    }
    // All values under 1s → format as ms
    if (max < 1) {
      const spanMs = span * 1000;
      if (spanMs < 10) return `${(v * 1000).toFixed(1)} ms`;
      return `${Math.round(v * 1000)} ms`;
    }
    // Seconds: pick enough decimal places so adjacent ticks don't collide
    const decimals = Math.min(
      3,
      Math.max(1, Math.ceil(-Math.log10(span * 0.3))),
    );
    return `${v.toFixed(decimals)} s`;
  };

  const formatXAxis = (t: number): string =>
    new Date(t * 1000)
      .toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
      .toLowerCase();

  const hoverSample = (() => {
    if (hoverRatio === null || displayedPoints.length === 0) return undefined;
    const hoverX = left + hoverRatio * (width - left - right);
    if (displayedPoints.length === 1) {
      const onlyPoint = displayedPoints[0];
      const onlyPlotted = plotted[0];
      if (!onlyPoint || !onlyPlotted) return undefined;
      return { x: width / 2, y: onlyPlotted.y, t: onlyPoint.t, v: onlyPoint.v };
    }

    let leftIndex = 0;
    for (let i = 0; i < plotted.length - 1; i++) {
      const curr = plotted[i];
      const next = plotted[i + 1];
      if (!curr || !next) continue;
      if (hoverX <= next.x) {
        leftIndex = i;
        break;
      }
      leftIndex = i + 1;
    }
    const rightIndex = Math.min(displayedPoints.length - 1, leftIndex + 1);
    const leftRaw = displayedPoints[leftIndex];
    const rightRaw = displayedPoints[rightIndex];
    const leftPlotted = plotted[leftIndex];
    const rightPlotted = plotted[rightIndex];
    if (!leftRaw || !rightRaw || !leftPlotted || !rightPlotted)
      return undefined;
    const dx = rightPlotted.x - leftPlotted.x;
    const blend =
      dx === 0 ? 0 : Math.max(0, Math.min(1, (hoverX - leftPlotted.x) / dx));

    return {
      x: hoverX,
      y: leftPlotted.y + (rightPlotted.y - leftPlotted.y) * blend,
      t: leftRaw.t + (rightRaw.t - leftRaw.t) * blend,
      v: leftRaw.v + (rightRaw.v - leftRaw.v) * blend,
    };
  })();
  const hoverLabel =
    hoverSample !== undefined ? formatYAxis(hoverSample.v) : "";
  const hoverTimestamp =
    hoverSample !== undefined
      ? new Date(hoverSample.t * 1000).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      : "";
  const tooltipHeight = 68;
  const tooltipPaddingX = 14;
  const tooltipTimestampY = 22;
  const tooltipValueRowY = 45;
  const tooltipValueTextX = tooltipPaddingX + 11;
  const tooltipMetricLabel = `${label}:`;
  const tooltipMetricValue = hoverLabel;
  const tooltipValueGap = 8;
  const tooltipMinWidth = 158;
  const tooltipMaxWidth = 300;
  const monoCharWidth = 5.8;
  const sansCharWidth = 5.2;
  const timestampTextWidth = hoverTimestamp.length * monoCharWidth;
  const labelTextWidth = tooltipMetricLabel.length * sansCharWidth;
  const valueTextWidth = tooltipMetricValue.length * sansCharWidth;
  const valueRowTextWidth =
    labelTextWidth + tooltipValueGap + valueTextWidth + 11;
  const tooltipContentWidth = Math.max(timestampTextWidth, valueRowTextWidth);
  const tooltipWidth = Math.min(
    tooltipMaxWidth,
    Math.max(
      tooltipMinWidth,
      Math.ceil(tooltipContentWidth + tooltipPaddingX * 2),
    ),
  );

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-[186px]"
      aria-hidden
      onMouseMove={(e) => {
        const svg = svgRef.current;
        if (!svg) return;
        if (frozenPoints === null) setFrozenPoints(displayedPoints);
        const rect = svg.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * width;
        const ratio = Math.max(
          0,
          Math.min(1, (x - left) / (width - left - right)),
        );
        setHoverRatio(ratio);
      }}
      onMouseLeave={() => {
        setHoverRatio(null);
        setFrozenPoints(null);
      }}
    >
      <defs>
        <pattern
          id={patternId}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="2.5"
            cy="2.5"
            r="1.6"
            fill="var(--lk-theme-color, var(--lk-dbg-fg))"
            opacity="0.58"
          />
        </pattern>
        <linearGradient id={maskGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="55%" stopColor="white" stopOpacity="0.28" />
          <stop offset="100%" stopColor="white" stopOpacity="0.08" />
        </linearGradient>
        <mask
          id={maskId}
          x="0"
          y="0"
          width={width}
          height={height}
          maskUnits="userSpaceOnUse"
        >
          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            fill={`url(#${maskGradientId})`}
          />
        </mask>
      </defs>
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={left}
            x2={width - right}
            y1={tick.y}
            y2={tick.y}
            stroke="rgba(255, 255, 255, 0.09)"
            strokeWidth="1"
          />
          <text
            x={left - 6}
            y={tick.y + 3}
            fontSize="12"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            textAnchor="end"
            fill="rgba(255, 255, 255, 0.52)"
          >
            {formatYAxis(tick.v)}
          </text>
        </g>
      ))}
      <path d={areaPath} fill={`url(#${patternId})`} mask={`url(#${maskId})`} />
      <line
        x1={lastPoint.x}
        x2={lastPoint.x}
        y1={lastPoint.y}
        y2={graphBottom}
        stroke="var(--lk-theme-color, var(--lk-dbg-fg))"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      {staleLinePath && (
        <path
          d={staleLinePath}
          fill="none"
          stroke="var(--lk-theme-color, var(--lk-dbg-fg))"
          strokeOpacity="0.9"
          strokeWidth="2.4"
          strokeDasharray="7 6"
        />
      )}
      {freshLinePath && (
        <path
          d={freshLinePath}
          fill="none"
          stroke="var(--lk-theme-color, var(--lk-dbg-fg))"
          strokeWidth="2.4"
        />
      )}
      {hoverSample && (
        <>
          <line
            x1={left}
            x2={width - right}
            y1={hoverSample.y}
            y2={hoverSample.y}
            stroke="rgba(255, 255, 255, 0.38)"
            strokeDasharray="3 5"
            strokeWidth="1"
          />
          <line
            x1={hoverSample.x}
            x2={hoverSample.x}
            y1={top}
            y2={graphBottom}
            stroke="rgba(255, 255, 255, 0.38)"
            strokeDasharray="3 5"
            strokeWidth="1"
          />
          <rect
            x={hoverSample.x - 4}
            y={hoverSample.y - 4}
            width="8"
            height="8"
            fill="var(--lk-dbg-bg)"
            stroke="var(--lk-theme-color, var(--lk-dbg-fg))"
            strokeWidth="1.8"
            rx="1"
          />
        </>
      )}
      {xTickIdx.map((idx, i) => {
        const point = displayedPoints[idx];
        const plottedPoint = plotted[idx];
        if (!point) return null;
        const x = plottedPoint?.x ?? width / 2;
        return (
          <text
            key={i}
            x={x}
            y={height - 6}
            fontSize="12"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            textAnchor={
              i === 0 ? "start" : i === xTickIdx.length - 1 ? "end" : "middle"
            }
            fill="rgba(255, 255, 255, 0.52)"
          >
            {formatXAxis(point.t)}
          </text>
        );
      })}
      {hoverSample && (
        <g
          transform={`translate(${Math.min(width - tooltipWidth, Math.max(left + 8, hoverSample.x + 14))}, ${Math.min(height - tooltipHeight, Math.max(top + 6, hoverSample.y + 8))})`}
        >
          <rect
            x="0"
            y="0"
            width={tooltipWidth}
            height={tooltipHeight}
            rx="6"
            fill="rgb(12, 12, 12)"
            stroke="rgba(255,255,255,0.28)"
          />
          <text
            x={tooltipPaddingX}
            y={tooltipTimestampY}
            fontSize="9.5"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            fill="rgba(255,255,255,0.9)"
          >
            {hoverTimestamp}
          </text>
          <rect
            x={tooltipPaddingX}
            y={tooltipValueRowY - 8}
            width="7"
            height="7"
            fill="var(--lk-theme-color, var(--lk-dbg-fg))"
          />
          <text
            x={tooltipValueTextX}
            y={tooltipValueRowY}
            fontSize="9.8"
            fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          >
            <tspan fill="rgba(255,255,255,0.82)">{tooltipMetricLabel}</tspan>
            <tspan dx={tooltipValueGap} fill="#fff">
              {tooltipMetricValue}
            </tspan>
          </text>
        </g>
      )}
    </svg>
  );
}

export interface MetricsDisplayProps {
  metricsEvents: ClientMetricsCollectedEvent[];
  events: ClientEvent[];
  className?: string;
}

export function MetricsDisplay({
  metricsEvents,
  events,
  className,
}: MetricsDisplayProps) {
  const conversationItemEvents = useMemo(
    () =>
      events.filter(
        (e): e is ClientConversationItemAddedEvent =>
          e.type === "conversation_item_added",
      ),
    [events],
  );
  const e2eDelays = useMemo(
    () => extractE2eDelays(conversationItemEvents),
    [conversationItemEvents],
  );
  const cards = useMemo(() => {
    const c = buildCards(metricsEvents);
    if (e2eDelays.length > 0) {
      c.push(
        trendCard(
          "user-turn-e2e-delay",
          "E2E Delay",
          e2eDelays,
          "s",
          "Time from user stopping speech to agent starting speech (server-measured)",
        ),
      );
    }
    return c;
  }, [metricsEvents, e2eDelays]);
  const sections = useMemo(() => buildSections(cards), [cards]);

  if (cards.length === 0) {
    return (
      <div
        data-slot="metrics-display"
        className={`flex items-center justify-center h-full text-xs${className ? ` ${className}` : ""}`}
        style={{ background: "var(--lk-dbg-bg)", color: "var(--lk-dbg-fg5)" }}
      >
        No metrics received yet
      </div>
    );
  }

  return (
    <div
      data-slot="metrics-display"
      className={`flex flex-col h-full overflow-y-auto${className ? ` ${className}` : ""}`}
      style={{
        background: "var(--lk-dbg-bg)",
      }}
    >
      <div className="flex flex-col gap-3 p-3">
        {sections.map((section) => (
          <details key={section.id} open className="group">
            <summary className="list-none cursor-pointer px-3 py-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  className="transition-transform group-open:rotate-90"
                  style={{ color: "var(--lk-dbg-fg5)" }}
                >
                  <path
                    d="M3 1.5L7 5 3 8.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className="text-[11px] font-normal uppercase tracking-wider text-gray-500"
                  style={{ fontFamily: TITLE_FONT_STACK }}
                >
                  {section.title}
                </span>
              </span>
            </summary>
            <div
              className="grid gap-3 p-3"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              }}
            >
              {section.cards.map((card) =>
                card.kind === "trend" ? (
                  <div
                    key={card.id}
                    className="border rounded-md pt-3"
                    style={{
                      background: "var(--lk-dbg-bg)",
                      borderColor: "var(--lk-dbg-border)",
                    }}
                  >
                    <div className="px-3 pt-1 pb-5 flex items-center gap-1.5">
                      <h3
                        className="text-xs font-normal uppercase tracking-wider text-gray-500"
                        style={{
                          fontFamily: TITLE_FONT_STACK,
                        }}
                      >
                        {card.title}
                      </h3>
                      {card.tooltip && <InfoTooltip content={card.tooltip} />}
                    </div>
                    <div className="px-3 pb-3">
                      <MiniTrendChart
                        points={card.points}
                        unit={card.seriesUnit}
                        label={card.title}
                      />
                    </div>
                  </div>
                ) : (
                  <div key={card.id} className="grid grid-cols-2 gap-2">
                    {card.stats.map((stat) => (
                      <div
                        key={stat.label}
                        className="border rounded-md px-3 py-2.5 min-h-[84px] flex flex-col justify-between"
                        style={{
                          borderColor: "var(--lk-dbg-border)",
                          background: "rgba(0, 0, 0, 0.16)",
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[10px] font-normal uppercase tracking-wider text-gray-500"
                            style={{
                              fontFamily: TITLE_FONT_STACK,
                            }}
                          >
                            {stat.label}
                          </span>
                          {stat.tooltip && (
                            <InfoTooltip content={stat.tooltip} />
                          )}
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                          <span
                            className="text-[38px] leading-[1] font-normal tracking-tight text-center w-full"
                            style={{
                              color: "var(--lk-theme-color, var(--lk-dbg-fg))",
                            }}
                          >
                            {stat.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
