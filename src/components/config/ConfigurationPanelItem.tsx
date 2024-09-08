import { ReactNode } from "react";
import { PlaygroundDeviceSelector } from "@/components/playground/PlaygroundDeviceSelector";
import { TrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";

type ConfigurationPanelItemProps = {
  title: string;
  children?: ReactNode;
  deviceSelectorKind?: MediaDeviceKind;
};

export const ConfigurationPanelItem: React.FC<ConfigurationPanelItemProps> = ({
  children,
  title,
  deviceSelectorKind,
}) => {
  return (
    <div className="w-full text-gray-800 py-4 border-b border-b-gray-800 relative">
      <div className="items-center px-4 text-xs uppercase tracking-wider">
        <h3 className="pb-2">{title}</h3>
        {deviceSelectorKind && (
          <span className="gap-2">
              <PlaygroundDeviceSelector kind={deviceSelectorKind} />
            <TrackToggle
              className="flex flex-row items-center px-3 py-3 mt-2 w-full justify-center bg-blue-700 border border-gray-800 rounded-sm text-white h-[200px] text-xl lk-button"
              source={
                deviceSelectorKind === "audioinput"
                  ? Track.Source.Microphone
                  : Track.Source.Camera
              }
            />
          </span>
        )}
      </div>
      <div className="px-4 py-2 text-xs text-gray-500 leading-normal">
        {children}
      </div>
    </div>
  );
};
