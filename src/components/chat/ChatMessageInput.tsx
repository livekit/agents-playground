import { useWindowResize } from "@/hooks/useWindowResize";
import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessageInput = {
  placeholder: string;
  accentColor: string;
  height: number;
  onSend?: (message: string) => void;
};

export const ChatMessageInput = ({
  placeholder,
  accentColor,
  height,
  onSend,
}: ChatMessageInput) => {
  const [message, setMessage] = useState("");
  const [inputTextWidth, setInputTextWidth] = useState(0);
  const [inputWidth, setInputWidth] = useState(0);
  const hiddenInputRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const windowSize = useWindowResize();
  const [isTyping, setIsTyping] = useState(false);
  const [inputHasFocus, setInputHasFocus] = useState(false);

  const handleSend = useCallback(() => {
    if (!onSend) {
      return;
    }
    if (message === "") {
      return;
    }

    onSend(message);
    setMessage("");
  }, [onSend, message]);

  useEffect(() => {
    setIsTyping(true);
    const timeout = setTimeout(() => {
      setIsTyping(false);
    }, 500);

    return () => clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (hiddenInputRef.current) {
      setInputTextWidth(hiddenInputRef.current.clientWidth);
    }
  }, [hiddenInputRef, message]);

  useEffect(() => {
    if (inputRef.current) {
      setInputWidth(inputRef.current.clientWidth);
    }
  }, [hiddenInputRef, message, windowSize.width]);

  return (
    <div
      className="flex flex-col gap-2 border-t border-t-gray-800"
      style={{ height: height }}
    >
      <div className="flex flex-row pt-3 gap-2 items-center relative">
        <div
          className={`w-2 h-4 bg-${inputHasFocus ? accentColor : "gray"}-${
            inputHasFocus ? 500 : 800
          } ${inputHasFocus ? "shadow-" + accentColor : ""} absolute left-2 ${
            !isTyping && inputHasFocus ? "cursor-animation" : ""
          }`}
          style={{
            transform:
              "translateX(" +
              (message.length > 0
                ? Math.min(inputTextWidth, inputWidth - 20) - 4
                : 0) +
              "px)",
          }}
        ></div>
        <input
          ref={inputRef}
          className={`w-full text-xs caret-transparent bg-transparent opacity-25 text-gray-300 p-2 pr-6 rounded-sm focus:opacity-100 focus:outline-none focus:border-${accentColor}-700 focus:ring-1 focus:ring-${accentColor}-700`}
          style={{
            paddingLeft: message.length > 0 ? "12px" : "24px",
            caretShape: "block",
          }}
          placeholder={placeholder}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
          }}
          onFocus={() => {
            setInputHasFocus(true);
          }}
          onBlur={() => {
            setInputHasFocus(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
        ></input>
        <span
          ref={hiddenInputRef}
          className="absolute top-0 left-0 text-xs pl-3 text-amber-500 pointer-events-none opacity-0"
        >
          {message.replaceAll(" ", "\u00a0")}
        </span>
        <button
          disabled={message.length === 0 || !onSend}
          onClick={handleSend}
          className={`text-xs uppercase text-${accentColor}-500 hover:bg-${accentColor}-950 p-2 rounded-md opacity-${
            message.length > 0 ? 100 : 25
          } pointer-events-${message.length > 0 ? "auto" : "none"}`}
        >
          Send
        </button>
      </div>
    </div>
  );
};
