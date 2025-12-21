import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { ReceivedMessage } from "@livekit/components-react";
import { useEffect, useRef } from "react";

const inputHeight = 48;

type ChatTileProps = {
  messages: ReceivedMessage[];
  accentColor: string;
  onSend?: (message: string) => Promise<ReceivedMessage>;
};

export const ChatTile = ({ messages, accentColor, onSend }: ChatTileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [containerRef, messages]);

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{
          height: `calc(100% - ${inputHeight}px)`,
        }}
      >
        <div className="flex flex-col min-h-full justify-end">
          {messages.map((message, index, allMsg) => {
            const hideName =
              index >= 1 && allMsg[index - 1].from === message.from;

            return (
              <ChatMessage
                key={index}
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
      <ChatMessageInput
        height={inputHeight}
        placeholder="Type a message"
        accentColor={accentColor}
        onSend={onSend}
      />
    </div>
  );
};
