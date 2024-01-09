import { Button } from "./button/Button";
import { useRef } from "react";

type PlaygroundConnectProps = {
  accentColor: string;
  onConnectClicked: (url: string, roomToken: string) => void;
};

export const PlaygroundConnect = ({
  accentColor,
  onConnectClicked,
}: PlaygroundConnectProps) => {
  const urlInput = useRef<HTMLInputElement>(null);
  const tokenInput = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex left-0 top-0 w-full h-full bg-black/80 items-center justify-center text-center">
      <div className="flex flex-col gap-4 p-8 bg-gray-950 w-full max-w-[400px] rounded-lg text-white border border-gray-900">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl">Connect to playground</h1>
          <p className="text-sm text-gray-500">
            Connect LiveKit Agent Playground with a custom server using LiveKit
            Cloud or LiveKit Server.
          </p>
        </div>
        <div className="flex flex-col gap-2 my-4">
          <input
            ref={urlInput}
            className="text-white text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-2"
            placeholder="wss://url"
          ></input>
          <textarea
            ref={tokenInput}
            className="text-white text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-2"
            placeholder="room token..."
          ></textarea>
        </div>
        <Button
          accentColor={accentColor}
          className="w-full"
          onClick={() => {
            if (urlInput.current && tokenInput.current) {
              onConnectClicked(
                urlInput.current.value,
                tokenInput.current.value
              );
            }
          }}
        >
          Connect
        </Button>
        <a
          href="https://kitt.livekit.io/"
          className={`text-xs text-${accentColor}-500 hover:underline`}
        >
          Don’t have a URL or token? Try out our KITT example to see agents in
          action!
        </a>
      </div>
    </div>
  );
};
