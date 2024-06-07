type ChatMessageProps = {
  message: string;
  accentColor: string;
  name: string;
  isSelf: boolean;
  hideName?: boolean;
};

export const ChatMessage = ({
  name,
  message,
  accentColor,
  isSelf,
  hideName,
}: ChatMessageProps) => {
  return (
    <div className={`flex flex-col gap-1 ${hideName ? "pt-0" : "pt-6"}`}>
      {!hideName && (
        <div
          className={`text-${
            isSelf ? "gray-700" : accentColor + "-800 text-ts-" + accentColor
          } uppercase text-xs`}
        >
          {name}
        </div>
      )}
      <div
        className={`pr-4 text-${
          isSelf ? "gray-300" : accentColor + "-500"
        } text-sm ${
          isSelf ? "" : "drop-shadow-" + accentColor
        } whitespace-pre-line`}
      >
        {message}
      </div>
    </div>
  );
};
