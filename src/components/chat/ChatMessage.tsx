type ChatMessageProps = {
  message: string;
  accentColor: string;
  name: string;
  timestamp: number;
  isSelf: boolean;
  hideName?: boolean;
};

export const ChatMessage = ({
  name,
  message,
  accentColor,
  isSelf,
  hideName,
  timestamp,
}: ChatMessageProps) => {
  const date = new Date(timestamp).toLocaleTimeString(undefined, {
    timeStyle: "short",
  });
  return (
    <div
      className={`flex flex-start ${
        isSelf ? "justify-end" : ""
      } gap-4 self-stretch pt-4`}
    >
      {!isSelf && <div className="rounded-full avatar-agent"></div>}
      <div
        className={`flex flex-col shrink-0 flex-end gap-4 ${
          !isSelf ? "grow" : ""
        }`}
      >
        <div
          className={`flex flex-col gap-2 align-start rounded-lg px-4 py-2 text-base text-skin-primary overflow-y max-w-64 lg:max-w-72 ${
            isSelf
              ? "bg-skin-fill-primary text-skin-tertiary"
              : "bg-skin-fill-bubble text-skin-primary"
          }`}
        >
          {!hideName && (
            <div className="text-sm text-skin-alternate">{name}</div>
          )}
          {message}
        </div>
        <div className="text-xs text-skin-secondary">{date}</div>
      </div>
      {isSelf && <div className="rounded-full avatar-me"></div>}
    </div>
  );
};
