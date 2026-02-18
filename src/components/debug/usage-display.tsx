import type {
  AgentSessionUsage,
  InterruptionModelUsage,
  LLMModelUsage,
  STTModelUsage,
  TTSModelUsage,
} from "@/lib/types";
import { InfoTooltip, TITLE_FONT_STACK } from "./shared";

const UNIT_CLASS = "text-[20px] ml-0.5 text-gray-500";

function DurationValue({ seconds }: { seconds: number }) {
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

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function modelLabel(provider: string, model: string): string {
  const parts = [provider, model].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : "Unknown";
}

export type UsageDisplayProps = {
  sessionUsage: AgentSessionUsage | null;
  className?: string;
};

export function UsageDisplay({ sessionUsage, className }: UsageDisplayProps) {
  if (!sessionUsage || sessionUsage.model_usage.length === 0) {
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

  const llmUsages = sessionUsage.model_usage.filter(
    (u): u is LLMModelUsage => u.type === "llm_usage",
  );
  const sttUsages = sessionUsage.model_usage.filter(
    (u): u is STTModelUsage => u.type === "stt_usage",
  );
  const ttsUsages = sessionUsage.model_usage.filter(
    (u): u is TTSModelUsage => u.type === "tts_usage",
  );
  const interruptionUsages = sessionUsage.model_usage.filter(
    (u): u is InterruptionModelUsage => u.type === "interruption_usage",
  );

  return (
    <div
      data-slot="usage-display"
      className={`flex flex-col h-full overflow-y-auto${className ? ` ${className}` : ""}`}
      style={{ background: "var(--lk-dbg-bg)" }}
    >
      <div className="flex flex-col gap-2 p-3">
        {llmUsages.map((u) => (
          <ModelSection
            key={`llm-${u.provider}-${u.model}`}
            label={modelLabel(u.provider, u.model)}
          >
            <StatCard
              label="Input Tokens"
              tooltip="Input tokens | cached input tokens"
              value={
                <span className="inline-flex items-center justify-center gap-2">
                  <span>{formatNumber(u.input_tokens)}</span>
                  <span className="w-px self-stretch bg-gray-500" style={{ marginBlock: "0.15em" }} />
                  <span>{formatNumber(u.input_cached_tokens)}</span>
                </span>
              }
            />
            <StatCard
              label="Output Tokens"
              value={formatNumber(u.output_tokens)}
            />
          </ModelSection>
        ))}
        {sttUsages.map((u) => (
          <ModelSection
            key={`stt-${u.provider}-${u.model}`}
            label={modelLabel(u.provider, u.model)}
          >
            <StatCard
              label="Audio Duration"
              value={<DurationValue seconds={u.audio_duration} />}
            />
          </ModelSection>
        ))}
        {ttsUsages.map((u) => (
          <ModelSection
            key={`tts-${u.provider}-${u.model}`}
            label={modelLabel(u.provider, u.model)}
          >
            <StatCard
              label="Characters"
              value={formatNumber(u.characters_count)}
            />
            <StatCard
              label="Audio Duration"
              value={<DurationValue seconds={u.audio_duration} />}
            />
          </ModelSection>
        ))}
        {interruptionUsages.map((u) => (
          <ModelSection
            key={`interruption-${u.provider}-${u.model}`}
            label={modelLabel(u.provider, u.model)}
          >
            <StatCard
              label="Total Requests"
              value={formatNumber(u.total_requests)}
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
        background: "rgba(0, 0, 0, 0.16)",
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
