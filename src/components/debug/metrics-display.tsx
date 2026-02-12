import type {
  AgentMetricsData,
  ClientMetricsCollectedEvent,
} from "@/lib/types";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface Stat {
  label: string;
  value: string;
}

interface CardData {
  title: string;
  color: CardColor;
  stats: Stat[];
}

type MetricType = AgentMetricsData["type"];
type MetricByType<T extends MetricType> = Extract<
  AgentMetricsData,
  { type: T }
>;
type CardColor = "violet" | "cyan" | "green" | "amber";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fmt(n: number, unit = "s", decimals = 1): string {
  if (unit === "s") {
    if (n < 1) return `${(n * 1000).toFixed(0)}ms`;
    return `${n.toFixed(decimals)}s`;
  }
  if (unit === "tok/s") return `${n.toFixed(1)} tok/s`;
  return `${n.toFixed(decimals)}`;
}

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

function buildCards(events: ClientMetricsCollectedEvent[]): CardData[] {
  const cards: CardData[] = [];

  const llm = collectMetrics(events, "llm_metrics");
  if (llm.length > 0) {
    cards.push({
      title: "LLM",
      color: "violet",
      stats: [
        { label: "Count", value: `${llm.length}` },
        { label: "Avg TTFT", value: fmt(avg(llm.map((m) => m.ttft))) },
        { label: "Avg duration", value: fmt(avg(llm.map((m) => m.duration))) },
        {
          label: "Total tokens",
          value: `${llm.reduce((s, m) => s + m.total_tokens, 0)}`,
        },
        {
          label: "Avg tok/s",
          value: fmt(avg(llm.map((m) => m.tokens_per_second)), "tok/s"),
        },
      ],
    });
  }

  const stt = collectMetrics(events, "stt_metrics");
  if (stt.length > 0) {
    cards.push({
      title: "STT",
      color: "cyan",
      stats: [
        { label: "Count", value: `${stt.length}` },
        { label: "Avg duration", value: fmt(avg(stt.map((m) => m.duration))) },
        {
          label: "Avg audio dur",
          value: fmt(avg(stt.map((m) => m.audio_duration))),
        },
      ],
    });
  }

  const tts = collectMetrics(events, "tts_metrics");
  if (tts.length > 0) {
    cards.push({
      title: "TTS",
      color: "green",
      stats: [
        { label: "Count", value: `${tts.length}` },
        { label: "Avg TTFB", value: fmt(avg(tts.map((m) => m.ttfb))) },
        { label: "Avg duration", value: fmt(avg(tts.map((m) => m.duration))) },
        {
          label: "Avg audio dur",
          value: fmt(avg(tts.map((m) => m.audio_duration))),
        },
        {
          label: "Total chars",
          value: `${tts.reduce((s, m) => s + m.characters_count, 0)}`,
        },
      ],
    });
  }

  const vad = collectMetrics(events, "vad_metrics");
  if (vad.length > 0) {
    cards.push({
      title: "VAD",
      color: "amber",
      stats: [
        { label: "Count", value: `${vad.length}` },
        {
          label: "Avg idle time",
          value: fmt(avg(vad.map((m) => m.idle_time))),
        },
        {
          label: "Total inferences",
          value: `${vad.reduce((s, m) => s + m.inference_count, 0)}`,
        },
      ],
    });
  }

  const eou = collectMetrics(events, "eou_metrics");
  if (eou.length > 0) {
    cards.push({
      title: "EOU",
      color: "amber",
      stats: [
        { label: "Count", value: `${eou.length}` },
        {
          label: "Avg EOU delay",
          value: fmt(avg(eou.map((m) => m.end_of_utterance_delay))),
        },
        {
          label: "Avg txn delay",
          value: fmt(avg(eou.map((m) => m.transcription_delay))),
        },
      ],
    });
  }

  const rt = collectMetrics(events, "realtime_model_metrics");
  if (rt.length > 0) {
    cards.push({
      title: "Realtime",
      color: "cyan",
      stats: [
        { label: "Count", value: `${rt.length}` },
        { label: "Avg TTFT", value: fmt(avg(rt.map((m) => m.ttft))) },
        { label: "Avg duration", value: fmt(avg(rt.map((m) => m.duration))) },
        {
          label: "Total tokens",
          value: `${rt.reduce((s, m) => s + m.total_tokens, 0)}`,
        },
        {
          label: "Avg tok/s",
          value: fmt(avg(rt.map((m) => m.tokens_per_second)), "tok/s"),
        },
      ],
    });
  }

  return cards;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<CardColor, { text: string }> = {
  violet: { text: "text-violet-400" },
  cyan: { text: "text-cyan-400" },
  green: { text: "text-green-400" },
  amber: { text: "text-amber-400" },
};

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
 * Card grid showing aggregated agent metrics (LLM, STT, TTS, VAD, EOU,
 * Realtime). Each card displays a colored title and label/value stat rows.
 */
export function MetricsDisplay({
  metricsEvents,
  className,
}: MetricsDisplayProps) {
  const cards = useMemo(() => buildCards(metricsEvents), [metricsEvents]);

  if (cards.length === 0) {
    return (
      <div
        data-slot="metrics-display"
        className={`flex items-center justify-center h-full text-xs${className ? ` ${className}` : ""}`}
        style={{ background: "var(--dbg-bg)", color: "var(--dbg-fg5)" }}
      >
        No metrics received yet
      </div>
    );
  }

  return (
    <div
      data-slot="metrics-display"
      className={`grid gap-3 p-3 h-full overflow-y-auto content-start${className ? ` ${className}` : ""}`}
      style={{
        background: "var(--dbg-bg)",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      }}
    >
      {cards.map((card) => {
        const colors = COLOR_MAP[card.color];
        return (
          <div
            key={card.title}
            className="border p-3"
            style={{
              background: "var(--dbg-bg2)",
              borderColor: "var(--dbg-border)",
              borderRadius: "var(--dbg-radius)",
            }}
          >
            <div className={`text-xs font-semibold mb-2 ${colors.text}`}>
              {card.title}
            </div>
            <div className="flex flex-col gap-1">
              {card.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex justify-between text-[11px]"
                >
                  <span style={{ color: "var(--dbg-fg5)" }}>{stat.label}</span>
                  <span
                    className="font-mono"
                    style={{ color: "var(--dbg-fg)" }}
                  >
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
