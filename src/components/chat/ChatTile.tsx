import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { ChatMessage as ComponentsChatMessage } from "@livekit/components-react";
import { useEffect, useRef } from "react";

const inputHeight = 48;

let partialResponse = '';
let partialSource = '';

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
          height: `calc(100% - 6rem)`,
        }}
      >
        <div className="flex flex-col min-h-full justify-end">
          {messages.map((message, index, allMsg) => {
              console.log(messages);

              const hideName = index >= 1 && allMsg[index - 1].name === message.name;
              let outputMessage = "";
              let source = "";

              // <response> タグを含む場合
              if (message.message.includes("<response>")) {
                  // <response> が閉じられていない場合
                  if (!message.message.includes("</response>")) {
                      const responseMatch = message.message.match(/<response>([\s\S]*)/);
                      if (responseMatch) {
                          partialResponse += responseMatch[1];  // 閉じタグが来るまで蓄積
                      }
                  } else {
                      // 閉じタグがある場合、蓄積していたものも含めて出力
                      const responseMatch = message.message.match(/<response>([\s\S]*?)<\/response>/);
                      partialResponse += responseMatch ? responseMatch[1] : '';
                      outputMessage = partialResponse;
                      partialResponse = '';  // 完了後はリセット
                  }
              }

              // <source> タグを含む場合
              if (message.message.includes("<source>")) {
                  // <source> が閉じられていない場合
                  if (!message.message.includes("</source>")) {
                      const sourceMatch = message.message.match(/<source>([\s\S]*)/);
                      if (sourceMatch) {
                          partialSource += sourceMatch[1];  // 閉じタグが来るまで蓄積
                      }
                  } else {
                      // 閉じタグがある場合、蓄積していたものも含めて出力
                      const sourceMatch = message.message.match(/<source>([\s\S]*?)<\/source>/);
                      partialSource += sourceMatch ? sourceMatch[1] : '';
                      source = partialSource;
                      partialSource = '';  // 完了後はリセット
                  }
              }
              // 閉じタグがあった場合、出力される内容
              if (message.message.includes("</response>")) {
                  outputMessage = partialResponse;
                  partialResponse = '';  // 完了後はリセット
              }

              if (message.message.includes("</source>")) {
                  source = partialSource;
                  partialSource = '';  // 完了後はリセット
              }

            return (
              <ChatMessage
                key={index}
                hideName={hideName}
                name={message.name}
                message={outputMessage}
                citation={source}
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
