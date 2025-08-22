import { Button } from "@/components/button/Button";
import { LoadingSVG } from "@/components/button/LoadingSVG";
import { SettingsDropdown } from "@/components/playground/SettingsDropdown";
import { useConfig } from "@/hooks/useConfig";
import { ConnectionState } from "livekit-client";
import { ReactNode } from "react";

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
          if (setting.group === 2) return <>{setting.icon}</>;
        })}
      </div>
      <div className="flex basis-1/3 justify-end items-center gap-2 pr-4">
        {config.settings.editable && <SettingsDropdown />}
        <Button
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
            "Disconnect"
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </div>
  );
};

const MicIcon = () => (
  <svg
    width="70"
    height="40"
    viewBox="0 0 70 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clip-path="url(#clip0_52_412)">
      <rect width="70" height="40" rx="6" fill="#00171F" />
      <path
        d="M20 24.5C21.1931 24.4988 22.337 24.0243 23.1806 23.1806C24.0243 22.337 24.4988 21.1931 24.5 20V14C24.5 12.8065 24.0259 11.6619 23.182 10.818C22.3381 9.97411 21.1935 9.5 20 9.5C18.8065 9.5 17.6619 9.97411 16.818 10.818C15.9741 11.6619 15.5 12.8065 15.5 14V20C15.5012 21.1931 15.9757 22.337 16.8194 23.1806C17.663 24.0243 18.8069 24.4988 20 24.5ZM17 14C17 13.2044 17.3161 12.4413 17.8787 11.8787C18.4413 11.3161 19.2044 11 20 11C20.7956 11 21.5587 11.3161 22.1213 11.8787C22.6839 12.4413 23 13.2044 23 14V20C23 20.7956 22.6839 21.5587 22.1213 22.1213C21.5587 22.6839 20.7956 23 20 23C19.2044 23 18.4413 22.6839 17.8787 22.1213C17.3161 21.5587 17 20.7956 17 20V14ZM20.75 27.4625V29.75C20.75 29.9489 20.671 30.1397 20.5303 30.2803C20.3897 30.421 20.1989 30.5 20 30.5C19.8011 30.5 19.6103 30.421 19.4697 30.2803C19.329 30.1397 19.25 29.9489 19.25 29.75V27.4625C17.4009 27.2743 15.6873 26.4072 14.4405 25.0288C13.1937 23.6504 12.5023 21.8586 12.5 20C12.5 19.8011 12.579 19.6103 12.7197 19.4697C12.8603 19.329 13.0511 19.25 13.25 19.25C13.4489 19.25 13.6397 19.329 13.7803 19.4697C13.921 19.6103 14 19.8011 14 20C14 21.5913 14.6321 23.1174 15.7574 24.2426C16.8826 25.3679 18.4087 26 20 26C21.5913 26 23.1174 25.3679 24.2426 24.2426C25.3679 23.1174 26 21.5913 26 20C26 19.8011 26.079 19.6103 26.2197 19.4697C26.3603 19.329 26.5511 19.25 26.75 19.25C26.9489 19.25 27.1397 19.329 27.2803 19.4697C27.421 19.6103 27.5 19.8011 27.5 20C27.4977 21.8586 26.8063 23.6504 25.5595 25.0288C24.3127 26.4072 22.5991 27.2743 20.75 27.4625Z"
        fill="white"
      />
      <path
        d="M55.3537 18.3538L50.3537 23.3538C50.3073 23.4003 50.2522 23.4372 50.1915 23.4623C50.1308 23.4875 50.0657 23.5004 50 23.5004C49.9343 23.5004 49.8692 23.4875 49.8085 23.4623C49.7478 23.4372 49.6927 23.4003 49.6462 23.3538L44.6462 18.3538C44.5524 18.26 44.4997 18.1327 44.4997 18C44.4997 17.8674 44.5524 17.7401 44.6462 17.6463C44.7401 17.5525 44.8673 17.4998 45 17.4998C45.1327 17.4998 45.2599 17.5525 45.3537 17.6463L50 22.2932L54.6462 17.6463C54.6927 17.5998 54.7478 17.563 54.8085 17.5378C54.8692 17.5127 54.9343 17.4998 55 17.4998C55.0657 17.4998 55.1307 17.5127 55.1914 17.5378C55.2521 17.563 55.3073 17.5998 55.3537 17.6463C55.4002 17.6927 55.437 17.7479 55.4622 17.8086C55.4873 17.8693 55.5003 17.9343 55.5003 18C55.5003 18.0657 55.4873 18.1308 55.4622 18.1915C55.437 18.2522 55.4002 18.3073 55.3537 18.3538Z"
        fill="#A3A0B0"
      />
    </g>
    <defs>
      <clipPath id="clip0_52_412">
        <rect width="70" height="40" rx="6" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const VideoIcon = () => (
  <svg
    width="70"
    height="40"
    viewBox="0 0 70 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clip-path="url(#clip0_2_2407)">
      <rect width="70" height="40" rx="6" fill="#00171F" />
      <path
        d="M31.6034 14.8438C31.4838 14.7796 31.3491 14.7492 31.2135 14.7556C31.078 14.7621 30.9467 14.8052 30.8337 14.8803L27.5 17.0984V14.75C27.5 14.3522 27.342 13.9706 27.0607 13.6893C26.7794 13.408 26.3978 13.25 26 13.25H11C10.6022 13.25 10.2206 13.408 9.93934 13.6893C9.65804 13.9706 9.5 14.3522 9.5 14.75V25.25C9.5 25.6478 9.65804 26.0294 9.93934 26.3107C10.2206 26.592 10.6022 26.75 11 26.75H26C26.3978 26.75 26.7794 26.592 27.0607 26.3107C27.342 26.0294 27.5 25.6478 27.5 25.25V22.9062L30.8337 25.1291C30.9576 25.2095 31.1024 25.2515 31.25 25.25C31.4489 25.25 31.6397 25.171 31.7803 25.0303C31.921 24.8897 32 24.6989 32 24.5V15.5C31.9991 15.3651 31.9617 15.2329 31.8919 15.1174C31.8221 15.0019 31.7225 14.9073 31.6034 14.8438ZM26 25.25H11V14.75H26V25.25ZM30.5 23.0984L27.5 21.0988V18.9012L30.5 16.9062V23.0984Z"
        fill="white"
      />
      <path
        d="M55.3537 18.3538L50.3537 23.3538C50.3073 23.4003 50.2522 23.4372 50.1915 23.4623C50.1308 23.4875 50.0657 23.5004 50 23.5004C49.9343 23.5004 49.8692 23.4875 49.8085 23.4623C49.7478 23.4372 49.6927 23.4003 49.6462 23.3538L44.6462 18.3538C44.5524 18.26 44.4997 18.1327 44.4997 18C44.4997 17.8674 44.5524 17.7401 44.6462 17.6463C44.7401 17.5525 44.8673 17.4998 45 17.4998C45.1327 17.4998 45.2599 17.5525 45.3537 17.6463L50 22.2932L54.6462 17.6463C54.6927 17.5998 54.7478 17.563 54.8085 17.5378C54.8692 17.5127 54.9343 17.4998 55 17.4998C55.0657 17.4998 55.1307 17.5127 55.1914 17.5378C55.2521 17.563 55.3073 17.5998 55.3537 17.6463C55.4002 17.6927 55.437 17.7479 55.4622 17.8086C55.4873 17.8693 55.5003 17.9343 55.5003 18C55.5003 18.0657 55.4873 18.1308 55.4622 18.1915C55.437 18.2522 55.4002 18.3073 55.3537 18.3538Z"
        fill="#A3A0B0"
      />
    </g>
    <defs>
      <clipPath id="clip0_2_2407">
        <rect width="70" height="40" rx="6" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

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
    icon: <VideoIcon />,
    group: 1,
  },
  {
    title: "Show chat",
    type: "chat",
    key: "N/A",
    icon: <>Chat Icon Placeholder</>,
    group: 2,
  },
  {
    title: "Show video",
    type: "outputs",
    key: "video",
    icon: <>Show Video Placeholder</>,
    group: 2,
  },
  {
    title: "Show audio",
    type: "outputs",
    key: "audio",
    icon: <>Audio Icon Placeholder</>,
    group: 2,
  },
];
