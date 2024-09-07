import { Button } from "@/components/button/Button";
import { LoadingSVG } from "@/components/button/LoadingSVG";
import { SettingsDropdown } from "@/components/playground/SettingsDropdown";
import { useConfig } from "@/hooks/useConfig";
import { ConnectionState } from "livekit-client";
import { ReactNode } from "react";
import Image from "next/image";

type PlaygroundHeader = {
  logo?: ReactNode;
  title?: ReactNode;
  githubLink?: string;
  height: number;
  accentColor: string;
  connectionState: ConnectionState;
  onConnectClicked: () => void;
};

export const PlaygroundHeader = ({
  logo,
  title,
  githubLink,
  accentColor,
  height,
  onConnectClicked,
  connectionState,
}: PlaygroundHeader) => {
  const { config } = useConfig();
  return (
    <div
      className={`flex gap-4 pt-4 text-${accentColor}-500 justify-between items-center shrink-0`}
      style={{
        height: height + "px",
      }}
    >
      <div className="flex items-center gap-3 basis-2/3">
        <div className="flex lg:basis-2/5">
            <Image src="/ipresence.jpg" alt="ipresence_logo" width={40} height={40} className="w-40" />
        </div>
        <div className="lg:basis lg:text-center lg:text-base lg:font-semibold text-black">
          {title}
        </div>
      </div>
      <div className="flex basis-1/3 justify-end items-center gap-2">
        {config.settings.editable && <SettingsDropdown />}
        <Button
          className="text-white text-xl"
          accentColor={
            connectionState === ConnectionState.Connected ? "red" : accentColor
          }
          disabled={connectionState === ConnectionState.Connecting}
          onClick={() => {
            onConnectClicked();
          }}
        >
          {connectionState === ConnectionState.Connecting ? (
            <LoadingSVG />
          ) : connectionState === ConnectionState.Connected ? (
            "接続解除"
          ) : (
            "接続"
          )}
        </Button>
      </div>
    </div>
  );
};

