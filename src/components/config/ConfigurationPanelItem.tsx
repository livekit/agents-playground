import { ReactNode } from "react";
import { PlaygroundDeviceSelector } from "@/components/playground/PlaygroundDeviceSelector";
import { TrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";

type ConfigurationPanelItemProps = {
  title: string;
  children?: ReactNode;
  source?: Track.Source;
};

export const ConfigurationPanelItem: React.FC<ConfigurationPanelItemProps> = ({
  children,
  title,
  source,
}) => {
  return (
    <div className="w-full text-gray-300 py-4 border-b border-b-gray-800 relative">
      <div className="flex flex-row justify-between items-center px-4 text-xs uppercase tracking-wider">
        <h3>{title}</h3>
        {source && (
          <span className="flex flex-row gap-2">
            <TrackToggle
              className="px-2 py-1 bg-gray-900 text-gray-300 border border-gray-800 rounded-sm hover:bg-gray-800"
              source={source}
            />
            {source === Track.Source.Camera && (
              <PlaygroundDeviceSelector kind="videoinput" />
            )}
            {source === Track.Source.Microphone && (
              <PlaygroundDeviceSelector kind="audioinput" />
            )}
          </span>
        )}
      </div>
      <div className="px-4 py-2 text-xs text-gray-500 leading-normal">
        {children}
      </div>
    </div>
  );
};
