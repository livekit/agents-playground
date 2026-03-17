import { AgentSession } from "@livekit/protocol";
import { InfoTooltip, TITLE_FONT_STACK } from "./shared";

type UsageCase = AgentSession.ModelUsage["usage"]["case"];
type UsageOfCase<C extends UsageCase> = AgentSession.ModelUsage & {
  usage: Extract<AgentSession.ModelUsage["usage"], { case: C }>;
};

function filterUsage<C extends UsageCase>(
  usages: AgentSession.ModelUsage[],
  caseTag: C,
): UsageOfCase<C>[] {
  return usages.filter(
    (u): u is UsageOfCase<C> => u.usage.case === caseTag,
  );
}

const UNIT_CLASS = "text-[20px] ml-0.5 text-gray-500";

function DurationValue({ seconds }: { seconds: number | undefined | null }) {
  if (seconds == null) seconds = 0;
  if (seconds < 60) {
    return (
      <>
        {seconds.toFixed(1)}
        <span className={UNIT_CLASS}>s</span>
      </>
    );
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <>
      {m}
      <span className={UNIT_CLASS}>m </span>
      {s.toFixed(1)}
      <span className={UNIT_CLASS}>s</span>
    </>
  );
}

function formatNumber(n: number | undefined | null): string {
  return (n ?? 0).toLocaleString();
}

function modelLabel(provider: string, model: string): string {
  const parts = [provider, model].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : "Unknown";
}

export type UsageDisplayProps = {
  sessionUsage: AgentSession.AgentSessionUsage | null;
  className?: string;
};

export function UsageDisplay({ sessionUsage, className }: UsageDisplayProps) {
  if (!sessionUsage || sessionUsage.modelUsage.length === 0) {
    return (
      <div
        data-slot="usage-display"
        className={`flex items-center justify-center h-full text-xs${className ? ` ${className}` : ""}`}
        style={{ background: "var(--lk-dbg-bg)", color: "var(--lk-dbg-fg5)" }}
      >
        No usage data yet
      </div>
    );
  }

  const llmUsages = filterUsage(sessionUsage.modelUsage, "llm");
  const sttUsages = filterUsage(sessionUsage.modelUsage, "stt");
  const ttsUsages = filterUsage(sessionUsage.modelUsage, "tts");
  const interruptionUsages = filterUsage(sessionUsage.modelUsage, "interruption");

  return (
    <div
      data-slot="usage-display"
      className={`flex flex-col h-full overflow-y-auto${className ? ` ${className}` : ""}`}
      style={{ background: "var(--lk-dbg-bg)" }}
    >
      <div className="flex flex-col gap-2 p-3">
        {llmUsages.map((u) => (
          <ModelSection
            key={`llm-${u.usage.value.provider}-${u.usage.value.model}`}
            label={modelLabel(u.usage.value.provider, u.usage.value.model)}
          >
            <StatCard
              label="Input Tokens"
              tooltip="Input tokens | cached input tokens"
              value={
                <span className="inline-flex items-center justify-center gap-2">
                  <span>{formatNumber(u.usage.value.inputTokens)}</span>
                  <span
                    className="w-px self-stretch bg-gray-500"
                    style={{ marginBlock: "0.15em" }}
                  />
                  <span>{formatNumber(u.usage.value.inputCachedTokens)}</span>
                </span>
              }
            />
            <StatCard
              label="Output Tokens"
              value={formatNumber(u.usage.value.outputTokens)}
            />
          </ModelSection>
        ))}
        {sttUsages.map((u) => (
          <ModelSection
            key={`stt-${u.usage.value.provider}-${u.usage.value.model}`}
            label={modelLabel(u.usage.value.provider, u.usage.value.model)}
          >
            <StatCard
              label="Audio Duration"
              value={<DurationValue seconds={u.usage.value.audioDuration} />}
            />
          </ModelSection>
        ))}
        {ttsUsages.map((u) => (
          <ModelSection
            key={`tts-${u.usage.value.provider}-${u.usage.value.model}`}
            label={modelLabel(u.usage.value.provider, u.usage.value.model)}
          >
            <StatCard
              label="Characters"
              value={formatNumber(u.usage.value.charactersCount)}
            />
            <StatCard
              label="Audio Duration"
              value={<DurationValue seconds={u.usage.value.audioDuration} />}
            />
          </ModelSection>
        ))}
        {interruptionUsages.map((u) => (
          <ModelSection
            key={`interruption-${u.usage.value.provider}-${u.usage.value.model}`}
            label={modelLabel(u.usage.value.provider, u.usage.value.model)}
          >
            <StatCard
              label="Total Requests"
              value={formatNumber(u.usage.value.totalRequests)}
            />
          </ModelSection>
        ))}
      </div>
    </div>
  );
}

function ModelSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[10px] font-normal uppercase tracking-wider text-gray-500 px-1"
        style={{ fontFamily: TITLE_FONT_STACK }}
      >
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div
      className="border rounded-md px-3 py-2.5 min-h-[168px] flex flex-col justify-between"
      style={{
        borderColor: "var(--lk-dbg-border)",
        background: "var(--lk-dbg-bg2)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="text-[10px] font-normal uppercase tracking-wider text-gray-500"
          style={{ fontFamily: TITLE_FONT_STACK }}
        >
          {label}
        </span>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span
          className="text-[38px] leading-[1] font-normal tracking-tight text-center w-full"
          style={{
            color: "var(--lk-theme-color, var(--lk-dbg-fg))",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
