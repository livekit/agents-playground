import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { InterruptChatMessage } from "@/lib/types";
import { ReceivedMessage } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";

const inputHeight = 48;
const interruptBarHeight = 28;

type ChatTileProps = {
  messages: ReceivedMessage[];
  accentColor: string;
  onSend?: (message: string) => Promise<ReceivedMessage>;
  latestInterrupt?: InterruptChatMessage;
  interruptCounts: {
    backchannel: number;
    interruption: number;
  };
};

export const ChatTile = ({
  messages,
  accentColor,
  onSend,
  latestInterrupt,
  interruptCounts,
}: ChatTileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [flashType, setFlashType] = useState<
    "backchannel" | "interruption" | null
  >(null);

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
    if (!latestInterrupt) return;
    setFlashType(latestInterrupt.subtype);
    setFlashKey((prev) => prev + 1);
  }, [latestInterrupt]);

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
      {latestInterrupt && (
        <div
          key={latestInterrupt.id}
          className="pointer-events-none absolute left-0 right-0 grid grid-cols-2 items-center border-t border-gray-800 px-3 bg-black"
          style={{ bottom: inputHeight, height: interruptBarHeight }}
        >
          <div className="flex items-center justify-center gap-2 text-xs text-red-400/80">
            <span className="uppercase tracking-wide text-red-500/80">
              interruption
            </span>
            <span className="relative inline-flex items-center min-w-[3ch] justify-center">
              <span
                key={`interruption-${flashKey}`}
                className={`font-medium ${
                  flashType === "interruption" ? "animate-interrupt-pulse" : ""
                }`}
              >
                x{interruptCounts.interruption}
              </span>
              {flashType === "interruption" && (
                <span className="animate-interrupt-plus text-red-500/80 absolute -right-6">
                  +1
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-green-400/80">
            <span className="uppercase tracking-wide text-green-500/80">
              backchannel
            </span>
            <span className="relative inline-flex items-center min-w-[3ch] justify-center">
              <span
                key={`backchannel-${flashKey}`}
                className={`font-medium ${
                  flashType === "backchannel" ? "animate-interrupt-pulse" : ""
                }`}
              >
                x{interruptCounts.backchannel}
              </span>
              {flashType === "backchannel" && (
                <span className="animate-interrupt-plus text-green-500/80 absolute -right-6">
                  +1
                </span>
              )}
            </span>
          </div>
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
