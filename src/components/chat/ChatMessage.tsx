import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

type ChatMessageProps = {
  message: string;
  accentColor: string;
  name: string;
  isSelf: boolean;
  hideName?: boolean;
    citation: string;
};

interface CustomMarkdownProps {
    message: string;
}

const CustomMarkdown: React.FC<CustomMarkdownProps> = ({ message }) => {

  return (
      <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
          components={{
            small: ({ node, ...props }) => <small {...props} />,
          }}
      >
        {message}
      </ReactMarkdown>
  );
};

export const ChatMessage = ({
  name,
  message,
  accentColor,
  isSelf,
  hideName,
   citation
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
                  isSelf ? "gray-700" : accentColor + "-900"
              } text-xl whitespace-pre-line`}
          >
              <CustomMarkdown message={message}/>
          </div>
          <div
              className={`pr-4 text-${
                  isSelf ? "gray-700" : accentColor + "-900"
              } text-sm whitespace-pre-line`}
          >
              <CustomMarkdown message={citation}/>
          </div>
      </div>
  );
};
