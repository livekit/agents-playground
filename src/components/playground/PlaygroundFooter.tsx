import { Button } from "@/components/button/Button";
import { LoadingSVG } from "@/components/button/LoadingSVG";
import { SettingsDropdown } from "@/components/playground/SettingsDropdown";
import { useConfig } from "@/hooks/useConfig";
import { ConnectionState } from "livekit-client";
import { ReactNode } from "react";
import {
  AudioIcon,
  CameraVideoIcon,
  ChatIcon,
  MicIcon,
  VideoIcon,
} from "./icons";

type PlaygroundFooter = {
  height: number;
  accentColor: string;
  connectionState: ConnectionState;
  onConnectClicked: () => void;
};

type SettingType = "inputs" | "outputs" | "chat" | "theme_color";

type SettingValue = {
  title: string;
  type: SettingType | "separator";
  key: string;
  icon: ReactNode;
  group: number;
};

export const PlaygroundFooter = ({
  accentColor,
  height,
  onConnectClicked,
  connectionState,
}: PlaygroundFooter) => {
  const { config, setUserSettings } = useConfig();

  console.log(accentColor);

  const isEnabled = (setting: SettingValue) => {
    if (setting.type === "separator" || setting.type === "theme_color")
      return false;
    if (setting.type === "chat") {
      return config.settings[setting.type];
    }

    if (setting.type === "inputs") {
      const key = setting.key as "camera" | "mic";
      return config.settings.inputs[key];
    } else if (setting.type === "outputs") {
      const key = setting.key as "video" | "audio";
      return config.settings.outputs[key];
    }

    return false;
  };

  const toggleSetting = (setting: SettingValue) => {
    if (setting.type === "separator" || setting.type === "theme_color") return;
    const newValue = !isEnabled(setting);
    const newSettings = { ...config.settings };

    if (setting.type === "chat") {
      newSettings.chat = newValue;
    } else if (setting.type === "inputs") {
      newSettings.inputs[setting.key as "camera" | "mic"] = newValue;
    } else if (setting.type === "outputs") {
      newSettings.outputs[setting.key as "video" | "audio"] = newValue;
    }
    setUserSettings(newSettings);
  };
  return (
    <div
      className={`flex text-${accentColor}-500 justify-between items-center justify-end bg-skin-fill-accent`}
      style={{
        height: height + "px",
      }}
    >
      <div className="flex justify-start gap-2">
        {settingsButtons.map((setting) => {
          if (setting.group === 1)
            return (
              <div
                onClick={() => toggleSetting(setting)}
                className={isEnabled(setting) ? "button-active" : ""}
              >
                {setting.icon}
              </div>
            );
        })}
      </div>
      <div className="flex justify-center gap-2">
        {settingsButtons.map((setting) => {
          if (setting.group === 2)
            return (
              <div
                onClick={() => toggleSetting(setting)}
                className={isEnabled(setting) ? "button-active" : ""}
              >
                <>{setting.icon}</>
              </div>
            );
        })}
      </div>
      <div className="flex basis-1/3 justify-end items-center gap-2 pr-4">
        {/* {config.settings.editable && <SettingsDropdown />} */}
        <Button
          disabled={connectionState === ConnectionState.Connecting}
          className={
            connectionState === ConnectionState.Disconnected ||
            connectionState === ConnectionState.Connecting
              ? "border-transparent text-skin-accent bg-skin-button-primary transition ease-out duration-250 hover:bg-transparent hover:shadow-bg-skin-fill-accent hover:border-skin-fill-primary hover:text-skin-primary"
              : "border-red-500 text-skin-danger"
          }
          onClick={() => {
            onConnectClicked();
          }}
        >
          {connectionState === ConnectionState.Connecting ? (
            <LoadingSVG />
          ) : connectionState === ConnectionState.Connected ? (
            "Disconnect"
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </div>
  );
};

const settingsButtons: SettingValue[] = [
  {
    title: "Enable mic",
    type: "inputs",
    key: "mic",
    icon: <MicIcon />,
    group: 1,
  },
  {
    title: "Enable camera",
    type: "inputs",
    key: "camera",
    icon: <CameraVideoIcon />,
    group: 1,
  },
  {
    title: "Show chat",
    type: "chat",
    key: "N/A",
    icon: <ChatIcon />,
    group: 2,
  },

  {
    title: "Show audio",
    type: "outputs",
    key: "audio",
    icon: <AudioIcon />,
    group: 2,
  },
  {
    title: "Show video",
    type: "outputs",
    key: "video",
    icon: <VideoIcon />,
    group: 2,
  },
];
