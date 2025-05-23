import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { ChatMessage as ComponentsChatMessage } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";

const inputHeight = 48; // Corresponds to h-12 in Tailwind
const newMessagesButtonBottomOffset = 10; // 10px above the input field

// This is the type for an individual chat message within the chat system
export type ChatMessageType = {
    name: string;
    message: string;
    isSelf: boolean;
    timestamp: number;
};

// These types are expected to be passed from the parent (e.g., Playground.tsx)
// and match the structure defined there. ChatTile does not redefine the canonical types.
type ParentSystemPromptLog = {
    prompt: string;
    timestamp: number;
    // Allow any other properties that Playground's SystemPromptLog might have
    [key: string]: any;
};
type ParentAgentStateLogEntry = {
    state: any; // Playground defines AgentActualState; ChatTile uses 'any' for flexibility
    timestamp: number;
    // Allow any other properties that Playground's AgentStateLogEntry might have
    [key: string]: any;
};

// Union type for all displayable items in the chat list
export type DisplayMessageType =
    | (ChatMessageType & { type: 'chat' })
    | (ParentSystemPromptLog & { type: 'system_prompt' })
    | (ParentAgentStateLogEntry & { type: 'agent_state' });


type ChatTileProps = {
    messages: DisplayMessageType[];
    accentColor: string;
    onSend?: (message: string) => Promise<ComponentsChatMessage>;
    onSystemPromptClick?: (log: ParentSystemPromptLog) => void;
    onAgentStateClick?: (log: ParentAgentStateLogEntry) => void;
};

export const ChatTile = ({ messages, accentColor, onSend, onSystemPromptClick, onAgentStateClick }: ChatTileProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showNewMessagesIndicator, setShowNewMessagesIndicator] = useState(false);
    const prevMessagesLengthRef = useRef(messages.length);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const threshold = 5;
            const atBottom =
                container.scrollHeight - container.scrollTop <=
                container.clientHeight + threshold;
            setIsAtBottom(atBottom);

            if (atBottom) {
                setShowNewMessagesIndicator(false);
            }
        };

        container.addEventListener("scroll", handleScroll);
        handleScroll();

        return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const newMessagesHaveArrived = messages.length > prevMessagesLengthRef.current;
        const messagesWereRemoved = messages.length < prevMessagesLengthRef.current;

        if (newMessagesHaveArrived) {
            if (isAtBottom) {
                container.scrollTop = container.scrollHeight;
                setShowNewMessagesIndicator(false);
            } else {
                setShowNewMessagesIndicator(true);
            }
        } else if (messagesWereRemoved) {
            if (isAtBottom) {
                container.scrollTop = container.scrollHeight;
            }
            setShowNewMessagesIndicator(false);
        } else if (isAtBottom && container.scrollHeight > container.clientHeight && container.scrollTop + container.clientHeight < container.scrollHeight) {
            // Handles cases where content height changes (e.g. image loads) and we need to re-scroll
            container.scrollTop = container.scrollHeight;
        }


        prevMessagesLengthRef.current = messages.length;
    }, [messages, isAtBottom]);

    const scrollToBottom = () => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    };

    return (
        <div className="flex flex-col gap-4 w-full h-full relative">
            <div
                ref={containerRef}
                className="overflow-y-auto"
                style={{
                    height: `calc(100% - ${inputHeight}px)`,
                }}
            >
                <div className="flex flex-col min-h-full justify-end">
                    {messages.map((messageItem, index, allMsg) => {
                        if (messageItem.type === 'system_prompt') {
                            return (
                                <div key={`system-${messageItem.timestamp}-${index}`} className="py-2 text-center">
                                    <button
                                        onClick={() => onSystemPromptClick?.(messageItem)}
                                        className={`text-xs font-medium text-${accentColor}-400 hover:text-${accentColor}-300 underline`}
                                    >
                                        System prompt
                                    </button>
                                </div>
                            );
                        } else if (messageItem.type === 'agent_state') {
                            return (
                                <div key={`agent-${messageItem.timestamp}-${index}`} className="py-2 text-center">
                                    <button
                                        onClick={() => onAgentStateClick?.(messageItem)}
                                        className={`text-xs font-medium text-${accentColor}-400 hover:text-${accentColor}-300 underline`}
                                    >
                                        Agent state changed
                                    </button>
                                </div>
                            );
                        } else if (messageItem.type === 'chat') {
                            const prevMessage = index > 0 ? allMsg[index - 1] : null;
                            const hideName =
                                prevMessage?.type === 'chat' &&
                                prevMessage.name === messageItem.name;

                            return (
                                <ChatMessage
                                    key={`chat-${messageItem.timestamp}-${messageItem.name}-${index}`}
                                    hideName={hideName}
                                    name={messageItem.name}
                                    message={messageItem.message}
                                    isSelf={messageItem.isSelf}
                                    accentColor={accentColor}
                                />
                            );
                        }
                        return null;
                    })}
                </div>
            </div>

            {showNewMessagesIndicator && (
                <button
                    onClick={scrollToBottom}
                    className={`absolute left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full text-xs font-medium text-white shadow-lg transition-opacity duration-300 ease-in-out bg-${accentColor}-500 hover:bg-${accentColor}-600`}
                    style={{ bottom: `${inputHeight + newMessagesButtonBottomOffset}px` }}
                >
                    New Messages ↓
                </button>
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