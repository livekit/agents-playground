import { ReactNode, useState } from "react";
import { CloseIcon, VideoIcon } from "./icons";
import { settingsButtons, SettingValue } from "@/hooks/useSettings";
import { useConfig } from "@/hooks/useConfig";

const titleHeight = 32;

type PlaygroundTileProps = {
  toggleSetting: (setting: SettingValue) => void;
  title?: string;
  children?: ReactNode;
  className?: string;
  childrenClassName?: string;
  padding?: boolean;
  backgroundColor?: string;
};

export type PlaygroundTab = {
  title: string;
  content: ReactNode;
};

export type PlaygroundTabbedTileProps = {
  tabs: PlaygroundTab[];
  initialTab?: number;
} & PlaygroundTileProps;

export const PlaygroundTile: React.FC<PlaygroundTileProps> = ({
  toggleSetting,
  children,
  title,
  className,
  childrenClassName,
  padding = true,
  backgroundColor = "transparent",
}) => {
  return (
    <div
      className={`flex flex-col flex-start lg:p-6 text-white bg-${backgroundColor} ${className}`}
    >
      {title && (
        <div
          className="flex text-base pb-[1rem] tracking-wider border-b border-skin-fill-accent justify-between"
          style={{
            height: `${titleHeight}px`,
          }}
        >
          <h2 className="text-skin-primary">{title}</h2>
          <div
            onClick={() =>
              toggleSetting({
                title: `Show ${title.toLowerCase()}`,
                type:
                  title.toLowerCase() === "chat"
                    ? "chat"
                    : title.toLowerCase() === "room details"
                    ? "room"
                    : "outputs",
                key: `${title.toLowerCase()}`,
              })
            }
          >
            <CloseIcon />
          </div>
        </div>
      )}

      <div
        className={`flex flex-col items-center grow w-full ${childrenClassName}`}
        style={{
          height: `calc(100% - ${title ? titleHeight + "px" : "0px"})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const PlaygroundTabbedTile: React.FC<PlaygroundTabbedTileProps> = ({
  tabs,
  initialTab = 0,
  className,
  childrenClassName,
  backgroundColor = "transparent",
}) => {
  const contentPadding = 4;
  const [activeTab, setActiveTab] = useState(initialTab);
  if (activeTab >= tabs.length) {
    return null;
  }
  return (
    <div
      className={`flex flex-col h-full border rounded-sm border-gray-500 text-white bg-${backgroundColor} ${className}`}
    >
      <div
        className="flex items-center justify-start text-xs uppercase tracking-wider gap-4 px-1"
        style={{
          height: `${titleHeight}px`,
        }}
      >
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`px-4 pt-3 pb-2 text-sm ${
              index === activeTab
                ? `text-skin-connect border-b border-skin-fill-primary`
                : `text-skin-accent-primary`
            } ${index === tabs.length - 1 ? "max-lg:hidden" : ""}`} // hide Settings tab for mobile view
            onClick={() => setActiveTab(index)}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div
        className={`w-full ${childrenClassName}`}
        style={{
          height: `calc(100% - ${titleHeight}px)`,
          padding: `${contentPadding * 4}px`,
        }}
      >
        {tabs[activeTab].content}
      </div>
    </div>
  );
};
