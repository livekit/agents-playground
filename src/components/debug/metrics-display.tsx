import type {
  AgentMetricsData,
  ClientConversationItemAddedEvent,
  ClientEvent,
  ClientMetricsCollectedEvent,
} from "@/lib/types";
import { useMemo } from "react";
import { MiniTrendChart, type TrendPoint } from "./mini-trend-chart";
import { InfoTooltip, TITLE_FONT_STACK } from "./shared";

type Stat = {
  label: string;
  value: string;
  tooltip?: string;
};

type SummaryCardData = {
  kind: "summary";
  id: string;
  title: string;
  stats: Stat[];
};

type TrendCardData = {
  kind: "trend";
  id: string;
  title: string;
  tooltip?: string;
  points: TrendPoint[];
  seriesUnit: "s" | "tok/s";
};

type MetricsSection = {
  id: string;
  title: string;
  cards: CardData[];
};

type MetricType = AgentMetricsData["type"];
type MetricByType<T extends MetricType> = Extract<
  AgentMetricsData,
  { type: T }
>;
type CardData = SummaryCardData | TrendCardData;
const MOVING_AVERAGE_WINDOW = 5;

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

export type MetricsDisplayProps = {
  metricsEvents: ClientMetricsCollectedEvent[];
  events: ClientEvent[];
  className?: string;
};

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
