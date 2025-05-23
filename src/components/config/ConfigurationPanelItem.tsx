import { ReactNode, useState } from "react";
import { PlaygroundDeviceSelector } from "@/components/playground/PlaygroundDeviceSelector";
import { TrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import {ChevronIcon} from "@/components/playground/icons";

type ConfigurationPanelItemProps = {
    title: string;
    children?: ReactNode;
    source?: Track.Source;
    collapsible?: boolean;
    initialCollapsed?: boolean;
};

export const ConfigurationPanelItem: React.FC<ConfigurationPanelItemProps> = ({
                                                                                  children,
                                                                                  title,
                                                                                  source,
                                                                                  collapsible = false,
                                                                                  initialCollapsed = true,
                                                                              }) => {
    const [isCollapsed, setIsCollapsed] = useState(
        collapsible ? initialCollapsed : false
    );

    const handleHeaderClick = () => {
        if (collapsible) {
            setIsCollapsed(!isCollapsed);
        }
    };

    return (
        <div className="w-full text-gray-300 py-4 border-b border-b-gray-800 relative">
            <div
                className={`flex flex-row justify-between items-center text-xs uppercase tracking-wider ${
                    collapsible ? "pr-4 cursor-pointer" : "px-4"
                }`}
                onClick={handleHeaderClick}
            >
                <div className="flex items-center gap-1">
                    {collapsible && (
                        <div
                            className={`transition-transform duration-200 ease-in-out ${
                                isCollapsed ? "-rotate-90" : "rotate-0"
                            }`}
                        >
                            <ChevronIcon />
                        </div>
                    )}
                    <h3>{title}</h3>
                </div>
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
            {(!collapsible || !isCollapsed) && (
                <div className="px-4 py-2 text-xs text-gray-500 leading-normal">
                    {children}
                </div>
            )}
        </div>
    );
};