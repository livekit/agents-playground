import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { ChatMessage as ComponentsChatMessage } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";

const inputHeight = 48;

export type ChatMessageType = {
  name: string;
  message: string;
  isSelf: boolean;
  timestamp: number;
};

type ChatTileProps = {
  messages: ChatMessageType[];
  accentColor: string;
  onSend?: (message: string) => Promise<ComponentsChatMessage>;
};

export const ChatTile = ({ messages, accentColor, onSend }: ChatTileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copySuccess, setCopySuccess] = useState("");

  const handleCopy = () => {
    const userMessages = messages
      .filter((message) => message.name === "You")
      .map((message) => message.message);
    navigator.clipboard.writeText(JSON.stringify(userMessages, null, 2))
      .then(() => {
        setCopySuccess("Copied!");
        setTimeout(() => setCopySuccess(""), 1000);
      })
      .catch(() => {
        setCopySuccess("Failed to copy!");
        setTimeout(() => setCopySuccess(""), 1000);
      });
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [containerRef, messages]);

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <button onClick={handleCopy} className={`text-xs uppercase text-${accentColor}-500 hover:bg-${accentColor}-950 p-2 rounded-md`}>
        Copy Chat
      </button>
      {copySuccess && <span className="text-xs text-green-500">{copySuccess}</span>}
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
              index >= 1 && allMsg[index - 1].name === message.name;

            return (
              <ChatMessage
                key={index}
                hideName={hideName}
                name={message.name}
                message={message.message}
                isSelf={message.isSelf}
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
