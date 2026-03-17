import { timestampToSeconds } from "@/lib/types";
import { AgentSession } from "@livekit/protocol";
import { useMemo } from "react";
import { MiniTrendChart, type TrendPoint } from "./mini-trend-chart";
import { InfoTooltip, TITLE_FONT_STACK } from "./shared";

type TrendCardData = {
  kind: "trend";
  id: string;
  title: string;
  tooltip?: string;
  points: TrendPoint[];
  seriesUnit: "s" | "tok/s" | "count";
};

type MetricsSection = {
  id: string;
  title: string;
  cards: TrendCardData[];
};

const MOVING_AVERAGE_WINDOW = 5;
const MAX_VISIBLE_POINTS = 40;

function toSeries(
  points: TrendPoint[],
  maxPoints = MAX_VISIBLE_POINTS,
): TrendPoint[] {
  if (points.length <= maxPoints) return points;
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
  unit: "s" | "tok/s" | "count",
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

function cumulativeCard(
  id: string,
  title: string,
  rawPoints: TrendPoint[],
  unit: "s" | "tok/s" | "count",
  tooltip?: string,
): TrendCardData {
  let sum = 0;
  const cumulative = rawPoints.map((p) => {
    sum += p.v;
    return { t: p.t, v: sum };
  });
  return {
    kind: "trend",
    id,
    title,
    tooltip,
    points: toSeries(cumulative),
    seriesUnit: unit,
  };
}

interface MetricsReportWithTimestamp {
  metrics: AgentSession.MetricsReport;
  createdAt: number;
}

function extractMetricsReports(
  events: AgentSession.AgentSessionEvent[],
): MetricsReportWithTimestamp[] {
  const reports: MetricsReportWithTimestamp[] = [];
  for (const evt of events) {
    if (evt.event.case !== "conversationItemAdded") continue;
    const item = evt.event.value.item;
    if (!item || item.item.case !== "message") continue;
    const msg = item.item.value;
    if (msg.metrics) {
      reports.push({
        metrics: msg.metrics,
        createdAt: timestampToSeconds(evt.createdAt),
      });
    }
  }
  return reports;
}

interface OverlappingSpeechWithTimestamp {
  speech: AgentSession.AgentSessionEvent_OverlappingSpeech;
  createdAt: number;
}

function extractOverlappingSpeech(
  events: AgentSession.AgentSessionEvent[],
): OverlappingSpeechWithTimestamp[] {
  const result: OverlappingSpeechWithTimestamp[] = [];
  for (const evt of events) {
    if (evt.event.case !== "overlappingSpeech") continue;
    result.push({
      speech: evt.event.value,
      createdAt: timestampToSeconds(evt.createdAt),
    });
  }
  return result;
}

function buildCards(
  reports: MetricsReportWithTimestamp[],
  overlaps: OverlappingSpeechWithTimestamp[],
): TrendCardData[] {
  const cards: TrendCardData[] = [];

  const e2ePoints: TrendPoint[] = [];
  const txnDelayPoints: TrendPoint[] = [];
  const eouDelayPoints: TrendPoint[] = [];
  const onUserTurnPoints: TrendPoint[] = [];
  const llmTtftPoints: TrendPoint[] = [];
  const ttsTtfbPoints: TrendPoint[] = [];
  const speechDurationPoints: TrendPoint[] = [];

  for (const { metrics: m, createdAt: t } of reports) {
    if (m.e2eLatency != null) e2ePoints.push({ t, v: m.e2eLatency });
    if (m.transcriptionDelay != null)
      txnDelayPoints.push({ t, v: m.transcriptionDelay });
    if (m.endOfTurnDelay != null)
      eouDelayPoints.push({ t, v: m.endOfTurnDelay });
    if (m.onUserTurnCompletedDelay != null)
      onUserTurnPoints.push({ t, v: m.onUserTurnCompletedDelay });
    if (m.llmNodeTtft != null) llmTtftPoints.push({ t, v: m.llmNodeTtft });
    if (m.ttsNodeTtfb != null) ttsTtfbPoints.push({ t, v: m.ttsNodeTtfb });
    if (m.startedSpeakingAt && m.stoppedSpeakingAt) {
      const start = timestampToSeconds(m.startedSpeakingAt);
      const stop = timestampToSeconds(m.stoppedSpeakingAt);
      if (stop > start) {
        speechDurationPoints.push({ t, v: stop - start });
      }
    }
  }

  if (e2ePoints.length > 0) {
    cards.push(
      trendCard(
        "turn-e2e-delay",
        "E2E Latency",
        e2ePoints,
        "s",
        "End-to-end latency from user stop speaking to agent start speaking",
      ),
    );
  }
  if (speechDurationPoints.length > 0) {
    cards.push(
      trendCard(
        "turn-speech-duration",
        "Speech Duration",
        speechDurationPoints,
        "s",
        "Duration of agent speech per turn",
      ),
    );
  }
  if (txnDelayPoints.length > 0) {
    cards.push(
      trendCard(
        "turn-txn-delay",
        "Transcription Delay",
        txnDelayPoints,
        "s",
        "Time between end of speech and final transcript",
      ),
    );
  }
  if (eouDelayPoints.length > 0) {
    cards.push(
      trendCard(
        "turn-eou-delay",
        "End of Turn Delay",
        eouDelayPoints,
        "s",
        "Time between end of speech and end-of-turn decision",
      ),
    );
  }
  if (onUserTurnPoints.length > 0) {
    cards.push(
      trendCard(
        "turn-callback-delay",
        "on_user_turn_completed Delay",
        onUserTurnPoints,
        "s",
        "Time to invoke the on_user_turn_completed callback",
      ),
    );
  }
  if (llmTtftPoints.length > 0) {
    cards.push(
      trendCard(
        "llm-node-ttft",
        "LLM TTFT",
        llmTtftPoints,
        "s",
        "LLM time-to-first-token",
      ),
    );
  }
  if (ttsTtfbPoints.length > 0) {
    cards.push(
      trendCard(
        "tts-node-ttfb",
        "TTS TTFB",
        ttsTtfbPoints,
        "s",
        "TTS time-to-first-byte after first text token",
      ),
    );
  }

  if (overlaps.length > 0) {
    const detectionDelayPoints: TrendPoint[] = [];
    const interruptionPoints: TrendPoint[] = [];
    const backchannelPoints: TrendPoint[] = [];

    for (const { speech: s, createdAt: t } of overlaps) {
      if (s.detectionDelay > 0) {
        detectionDelayPoints.push({ t, v: s.detectionDelay });
      }
      interruptionPoints.push({ t, v: s.isInterruption ? 1 : 0 });
      backchannelPoints.push({ t, v: s.isInterruption ? 0 : 1 });
    }

    if (detectionDelayPoints.length > 0) {
      cards.push(
        trendCard(
          "interruption-detection-delay",
          "Detection Delay",
          detectionDelayPoints,
          "s",
          "Time from overlap speech onset to interruption prediction",
        ),
      );
    }
    cards.push(
      cumulativeCard(
        "interruption-num-interruptions",
        "Interruptions",
        interruptionPoints,
        "count",
        "Cumulative number of detected interruptions",
      ),
    );
    cards.push(
      cumulativeCard(
        "interruption-num-backchannels",
        "Backchannels",
        backchannelPoints,
        "count",
        "Cumulative number of backchannel predictions",
      ),
    );
  }

  return cards;
}

function sectionTitleFromCardId(id: string): string {
  const prefix = id.split("-")[0];
  if (!prefix) return "Metrics";
  const ACRONYMS = new Set(["llm", "tts", "stt"]);
  if (ACRONYMS.has(prefix)) return prefix.toUpperCase();
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

function buildSections(cards: TrendCardData[]): MetricsSection[] {
  const sectionMap = new Map<string, MetricsSection>();
  for (const card of cards) {
    const title = sectionTitleFromCardId(card.id);
    const id = title.toLowerCase().replace(/\s+/g, "-");
    const section = sectionMap.get(id) ?? { id, title, cards: [] };
    section.cards.push(card);
    sectionMap.set(id, section);
  }

  const raw = Array.from(sectionMap.values());
  const multi: MetricsSection[] = [];
  const singles: TrendCardData[] = [];

  for (const section of raw) {
    if (section.cards.length === 1) {
      singles.push(section.cards[0]!);
    } else {
      multi.push(section);
    }
  }

  if (singles.length > 0) {
    multi.push({ id: "pipeline", title: "Pipeline", cards: singles });
  }
  return multi;
}

export type MetricsDisplayProps = {
  events: AgentSession.AgentSessionEvent[];
  className?: string;
};

export function MetricsDisplay({ events, className }: MetricsDisplayProps) {
  const reports = useMemo(() => extractMetricsReports(events), [events]);
  const overlaps = useMemo(() => extractOverlappingSpeech(events), [events]);
  const cards = useMemo(
    () => buildCards(reports, overlaps),
    [reports, overlaps],
  );
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
              {section.cards.map((card) => (
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
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
