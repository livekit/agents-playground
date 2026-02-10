import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { ReceivedMessage } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";

const inputHeight = 48;
const interruptBarHeight = 28;

type ChatTileProps = {
  messages: ReceivedMessage[];
  accentColor: string;
  onSend?: (message: string) => Promise<ReceivedMessage>;
  lastInterruptSubtype?: "interruption" | "backchannel";
  interruptCounts: {
    backchannel: number;
    interruption: number;
  };
};

type InterruptSubtype = "backchannel" | "interruption";

type InterruptCounterProps = {
  label: InterruptSubtype;
  count: number;
  flashType: InterruptSubtype | null;
  flashKey: number;
  valueColorClassName: string;
  labelColorClassName: string;
};

const InterruptCounter = ({
  label,
  count,
  flashType,
  flashKey,
  valueColorClassName,
  labelColorClassName,
}: InterruptCounterProps) => (
  <div className={`flex items-center justify-center gap-2 text-xs ${valueColorClassName}`}>
    <span className={`uppercase tracking-wide ${labelColorClassName}`}>
      {label}
    </span>
    <span className="relative inline-flex items-center min-w-[3ch] justify-center">
      <span
        key={`${label}-${flashKey}`}
        className={`font-medium ${
          flashType === label ? "animate-interrupt-pulse" : ""
        }`}
      >
        x{count}
      </span>
      {flashType === label && (
        <span className={`animate-interrupt-plus ${labelColorClassName} absolute -right-6`}>
          +1
        </span>
      )}
    </span>
  </div>
);

export const ChatTile = ({
  messages,
  accentColor,
  onSend,
  lastInterruptSubtype,
  interruptCounts,
}: ChatTileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [flashType, setFlashType] = useState<InterruptSubtype | null>(null);
  const totalInterrupts =
    interruptCounts.backchannel + interruptCounts.interruption;

  useEffect(() => {
    if (!flashType) return;
    const timeout = setTimeout(() => {
      setFlashType(null);
    }, 900);
    return () => clearTimeout(timeout);
  }, [flashType]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [containerRef, messages]);

  useEffect(() => {
    if (!lastInterruptSubtype) return;
    setFlashType(lastInterruptSubtype);
    setFlashKey((prev) => prev + 1);
  }, [totalInterrupts, lastInterruptSubtype]);

  return (
    <div className="relative flex flex-col gap-4 w-full h-full">
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{
          height: `calc(100% - ${inputHeight + interruptBarHeight}px)`,
        }}
      >
        <div className="flex flex-col min-h-full justify-end pb-3">
          {messages.map((message, index, allMsg) => {
            const prev = allMsg[index - 1];
            const hideName = index >= 1 && prev.from === message.from;

            return (
              <ChatMessage
                key={message.id ?? index}
                hideName={hideName}
                name={message.from?.name ?? ""}
                message={message.message}
                isSelf={message.from?.isLocal ?? false}
                accentColor={accentColor}
              />
            );
          })}
        </div>
      </div>
      {totalInterrupts > 0 && (
        <div
          key={totalInterrupts}
          className="pointer-events-none absolute left-0 right-0 grid grid-cols-2 items-center border-t border-gray-800 px-3 bg-black"
          style={{ bottom: inputHeight, height: interruptBarHeight }}
        >
          <InterruptCounter
            label="interruption"
            count={interruptCounts.interruption}
            flashType={flashType}
            flashKey={flashKey}
            valueColorClassName="text-red-400/80"
            labelColorClassName="text-red-500/80"
          />
          <InterruptCounter
            label="backchannel"
            count={interruptCounts.backchannel}
            flashType={flashType}
            flashKey={flashKey}
            valueColorClassName="text-green-400/80"
            labelColorClassName="text-green-500/80"
          />
        </div>
      )}
      <ChatMessageInput
        height={inputHeight}
        placeholder="Type a message"
        accentColor={accentColor}
        onSend={onSend}
      />
    </div>
  );
};
