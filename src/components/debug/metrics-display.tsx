import type {
  AgentMetricsData,
  ClientMetricsCollectedEvent,
} from "@/lib/types";
import { useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface Stat {
  label: string;
  value: string;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  const step = points.length / maxPoints;
  const reduced: TrendPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(points.length - 1, Math.floor(i * step));
    const point = points[idx];
    if (point) reduced.push(point);
  }
  return reduced;
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
): TrendCardData {
  const smoothedPoints = movingAveragePoints(rawPoints, MOVING_AVERAGE_WINDOW);
  return {
    kind: "trend",
    id,
    title: `AVG ${title}`,
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
      ),
      trendCard(
        "llm-duration",
        "LLM Duration",
        llm.map((m) => ({ t: m.timestamp, v: m.duration })),
        "s",
      ),
      trendCard(
        "llm-speed",
        "LLM Speed",
        llm.map((m) => ({ t: m.timestamp, v: m.tokens_per_second })),
        "tok/s",
      ),
      summaryCard("llm-summary", "LLM Summary", [
        { label: "Count", value: `${llm.length}` },
        {
          label: "Total tokens",
          value: `${llm.reduce((s, m) => s + m.total_tokens, 0)}`,
        },
        {
          label: "Prompt tokens",
          value: `${llm.reduce((s, m) => s + m.prompt_tokens, 0)}`,
        },
        {
          label: "Completion tokens",
          value: `${llm.reduce((s, m) => s + m.completion_tokens, 0)}`,
        },
      ]),
    );
  }

  const stt = collectMetrics(events, "stt_metrics");
  const eou = collectMetrics(events, "eou_metrics");
  if (eou.length > 0 || stt.length > 0) {
    if (eou.length > 0) {
      cards.push(
        trendCard(
          "user-turn-txn-delay",
          "User Turn Txn Delay",
          eou.map((m) => ({ t: m.timestamp, v: m.transcription_delay })),
          "s",
        ),
        trendCard(
          "user-turn-eou-delay",
          "User Turn EOU Delay",
          eou.map((m) => ({ t: m.timestamp, v: m.end_of_utterance_delay })),
          "s",
        ),
      );
    }
    if (stt.length > 0) {
      cards.push(
        trendCard(
          "user-turn-stt-duration",
          "STT Duration",
          stt.map((m) => ({ t: m.timestamp, v: m.audio_duration })),
          "s",
        ),
      );
    }
    cards.push(
      summaryCard("user-turn-summary", "User Turn Summary", [
        { label: "EOU count", value: `${eou.length}` },
        { label: "STT count", value: `${stt.length}` },
      ]),
    );
  }

  const tts = collectMetrics(events, "tts_metrics");
  if (tts.length > 0) {
    cards.push(
      trendCard(
        "tts-ttfb",
        "TTS TTFB",
        tts.map((m) => ({ t: m.timestamp, v: m.ttfb })),
        "s",
      ),
      trendCard(
        "tts-duration",
        "TTS Duration",
        tts.map((m) => ({ t: m.timestamp, v: m.duration })),
        "s",
      ),
      trendCard(
        "tts-audio-duration",
        "TTS Audio Duration",
        tts.map((m) => ({ t: m.timestamp, v: m.audio_duration })),
        "s",
      ),
      summaryCard("tts-summary", "TTS Summary", [
        { label: "Count", value: `${tts.length}` },
        {
          label: "Total chars",
          value: `${tts.reduce((s, m) => s + m.characters_count, 0)}`,
        },
      ]),
    );
  }

  const vad = collectMetrics(events, "vad_metrics");
  if (vad.length > 0) {
    cards.push(
      trendCard(
        "vad-idle-time",
        "VAD Idle Time",
        vad.map((m) => ({ t: m.timestamp, v: m.idle_time })),
        "s",
      ),
    );
    cards.push(
      summaryCard("vad-summary", "VAD", [
        { label: "Count", value: `${vad.length}` },
        {
          label: "Total inferences",
          value: `${vad.reduce((s, m) => s + m.inference_count, 0)}`,
        },
      ]),
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
      ),
      trendCard(
        "realtime-duration",
        "Realtime Duration",
        rt.map((m) => ({ t: m.timestamp, v: m.duration })),
        "s",
      ),
      trendCard(
        "realtime-speed",
        "Realtime Speed",
        rt.map((m) => ({ t: m.timestamp, v: m.tokens_per_second })),
        "tok/s",
      ),
      summaryCard("realtime-summary", "Realtime Summary", [
        { label: "Count", value: `${rt.length}` },
        {
          label: "Total tokens",
          value: `${rt.reduce((s, m) => s + m.total_tokens, 0)}`,
        },
        {
          label: "Input tokens",
          value: `${rt.reduce((s, m) => s + m.input_tokens, 0)}`,
        },
        {
          label: "Output tokens",
          value: `${rt.reduce((s, m) => s + m.output_tokens, 0)}`,
        },
      ]),
    );
  }

  return cards;
}

function sectionTitleFromCardId(id: string): string {
  if (id.startsWith("llm-")) return "LLM";
  if (id.startsWith("user-turn-")) return "User Turn";
  if (id.startsWith("tts-")) return "TTS";
  if (id.startsWith("vad-")) return "VAD";
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

// ---------------------------------------------------------------------------
// Chart components
// ---------------------------------------------------------------------------

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
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length === 0) {
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
  for (const p of points) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  const span = Math.max(max - min, 1e-9);

  const plotted = points.map((point, i) => {
    const x =
      points.length === 1
        ? width / 2
        : left + (i / (points.length - 1)) * (width - left - right);
    const norm = (point.v - min) / span;
    const y = top + (1 - norm) * (height - top - bottom);
    return { x, y };
  });

  const linePath = plotted
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
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
    new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  );

  const formatYAxis = (v: number): string => {
    if (unit === "tok/s") return `${v.toFixed(1)} tok/s`;
    if (v < 1) return `${Math.round(v * 1000)} ms`;
    return `${v.toFixed(1)} s`;
  };

  const formatXAxis = (t: number): string =>
    new Date(t * 1000)
      .toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
      .toLowerCase();

  const hoveredPoint = hoverIndex !== null ? plotted[hoverIndex] : undefined;
  const hoveredRaw = hoverIndex !== null ? points[hoverIndex] : undefined;
  const hoverLabel = hoveredRaw !== undefined ? formatYAxis(hoveredRaw.v) : "";
  const hoverTimestamp =
    hoveredRaw !== undefined
      ? new Date(hoveredRaw.t * 1000)
          .toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
          .toLowerCase()
      : "";

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-[186px]"
      aria-hidden
      onMouseMove={(e) => {
        const svg = svgRef.current;
        if (!svg || points.length < 2) return;
        const rect = svg.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * width;
        const ratio = (x - left) / (width - left - right);
        const idx = Math.max(
          0,
          Math.min(points.length - 1, Math.round(ratio * (points.length - 1))),
        );
        setHoverIndex(idx);
      }}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <defs>
        <pattern
          id={patternId}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="1.25"
            cy="1.25"
            r="0.85"
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
      <path
        d={linePath}
        fill="none"
        stroke="var(--lk-theme-color, var(--lk-dbg-fg))"
        strokeWidth="2.4"
      />
      {hoveredPoint && hoveredRaw && (
        <>
          <line
            x1={left}
            x2={width - right}
            y1={hoveredPoint.y}
            y2={hoveredPoint.y}
            stroke="rgba(255, 255, 255, 0.38)"
            strokeDasharray="3 5"
            strokeWidth="1"
          />
          <line
            x1={hoveredPoint.x}
            x2={hoveredPoint.x}
            y1={top}
            y2={graphBottom}
            stroke="rgba(255, 255, 255, 0.38)"
            strokeDasharray="3 5"
            strokeWidth="1"
          />
          <rect
            x={hoveredPoint.x - 4}
            y={hoveredPoint.y - 4}
            width="8"
            height="8"
            fill="var(--lk-dbg-bg)"
            stroke="var(--lk-theme-color, var(--lk-dbg-fg))"
            strokeWidth="1.8"
            rx="1"
          />
          <g
            transform={`translate(${Math.min(width - 220, Math.max(left + 8, hoveredPoint.x + 14))}, ${Math.max(top + 6, hoveredPoint.y + 8)})`}
          >
            <rect
              x="0"
              y="0"
              width="200"
              height="50"
              rx="6"
              fill="rgba(0, 0, 0, 0.85)"
              stroke="rgba(255,255,255,0.16)"
            />
            <text
              x="10"
              y="17"
              fontSize="9.5"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
              fill="rgba(255,255,255,0.76)"
            >
              {hoverTimestamp}
            </text>
            <rect
              x="10"
              y="27"
              width="7"
              height="7"
              fill="var(--lk-theme-color, var(--lk-dbg-fg))"
            />
            <text
              x="21"
              y="34"
              fontSize="9.8"
              fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
              fill="rgba(255,255,255,0.82)"
            >
              {`${label}: ${hoverLabel}`}
            </text>
          </g>
        </>
      )}
      {xTickIdx.map((idx, i) => {
        const point = points[idx];
        if (!point) return null;
        const x =
          points.length === 1
            ? width / 2
            : left + (idx / (points.length - 1)) * (width - left - right);
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
    </svg>
  );
}

function InfoDotIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="1"
        fill="none"
      />
      <line
        x1="8"
        y1="7"
        x2="8"
        y2="10.5"
        stroke="rgba(255, 255, 255, 0.55)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="8" cy="4.8" r="0.7" fill="rgba(255, 255, 255, 0.55)" />
    </svg>
  );
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        className="peer inline-flex items-center cursor-help"
        style={{ color: "var(--lk-dbg-fg5)" }}
        aria-label={content}
      >
        <InfoDotIcon />
      </button>
      <span
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[10px] opacity-0 transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100"
        style={{
          background: "rgba(0, 0, 0, 0.9)",
          color: "var(--lk-dbg-fg3)",
          border: "1px solid var(--lk-dbg-border)",
        }}
      >
        {content}
      </span>
    </span>
  );
}

const TITLE_FONT_STACK =
  'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MetricsDisplayProps {
  metricsEvents: ClientMetricsCollectedEvent[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card grid showing aggregated agent metrics (LLM, User Turn, TTS, VAD,
 * Realtime). Each card displays a colored title and label/value stat rows.
 */
export function MetricsDisplay({
  metricsEvents,
  className,
}: MetricsDisplayProps) {
  const cards = useMemo(() => buildCards(metricsEvents), [metricsEvents]);
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
          <details key={section.id} open className="group overflow-hidden">
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
                    className="border rounded-md pt-3 overflow-hidden"
                    style={{
                      background: "var(--lk-dbg-bg)",
                      borderColor: "var(--lk-dbg-border)",
                    }}
                  >
                    <div className="px-3 py-2 flex items-center gap-1.5">
                      <h3
                        className="text-xs font-normal uppercase tracking-wider text-gray-500"
                        style={{
                          fontFamily: TITLE_FONT_STACK,
                        }}
                      >
                        {card.title}
                      </h3>
                      <InfoTooltip content={`${card.title} trend details`} />
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
                          <InfoTooltip
                            content={`${stat.label}: ${stat.value}`}
                          />
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
