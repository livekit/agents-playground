import { Button } from "@/components/button/Button";
import { LoadingSVG } from "@/components/button/LoadingSVG";
import { useConfig } from "@/hooks/useConfig";
import { ConnectionState } from "livekit-client";
import { settingsButtons, SettingValue } from "@/hooks/useSettings";
import { SettingsDropdown } from "./SettingsDropdown";

type PlaygroundFooter = {
  height: number;
  accentColor: string;
  connectionState: ConnectionState;
  onConnectClicked: () => void;
  isEnabled: (setting: SettingValue) => boolean;
  toggleSetting: (setting: SettingValue) => void;
};

export const PlaygroundFooter = ({
  accentColor,
  height,
  onConnectClicked,
  connectionState,
  isEnabled,
  toggleSetting,
}: PlaygroundFooter) => {
  return (
    <div
      className={`flex text-${accentColor}-500 justify-between items-center justify-end bg-skin-fill-accent py-3 px-4`}
      style={{
        height: height + "px",
      }}
    >
      <div className="flex justify-start gap-2">
        {settingsButtons.map((setting: SettingValue, idx) => {
          if (setting.group === 1)
            return (
              <div
                key={idx}
                onClick={() => toggleSetting(setting)}
                className={isEnabled(setting) ? "button-active" : ""}
              >
                {setting.icon}
              </div>
            );
        })}
      </div>
      <div className="flex justify-center gap-2 max-sm:hidden">
        {settingsButtons.map((setting, idx) => {
          if (setting.group === 2)
            return (
              <div
                key={idx}
                onClick={() => toggleSetting(setting)}
                className={isEnabled(setting) ? "button-active" : ""}
              >
                <>{setting.icon}</>
              </div>
            );
        })}
      </div>
      <div className="flex basis-1/3 justify-end items-center gap-2 pr-4">
        {/* <SettingsDropdown /> */}
        {settingsButtons.map((setting, idx) => {
          if (setting.group === 3)
            return (
              <div
                key={idx}
                onClick={() => toggleSetting(setting)}
                className={isEnabled(setting) ? "button-active" : ""}
              >
                <>{setting.icon}</>
              </div>
            );
        })}
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
