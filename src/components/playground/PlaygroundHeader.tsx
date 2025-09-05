import { Button } from "@/components/button/Button";
import { LoadingSVG } from "@/components/button/LoadingSVG";
import { SettingsDropdown } from "@/components/playground/SettingsDropdown";
import { useConfig } from "@/hooks/useConfig";
import { ConnectionState } from "livekit-client";
import React from "react";
import { ReactNode } from "react";
import { DarkModeIcon, LightModeIcon, LKLogo } from "./icons";

type PlaygroundHeader = {
  logo?: ReactNode;
  title?: ReactNode;
  height: number;
  accentColor: string;
};

export const PlaygroundHeader = ({
  logo,
  title,
  accentColor,
  height,
}: PlaygroundHeader) => {
  const { config } = useConfig();

  const [isDarkMode, setIsDarkMode] = React.useState(true);

  const toggleTheme = (theme: "dark" | "light") => {
    let themeToRemove = "dark";
    if (theme === "dark") {
      themeToRemove = "light";
    }
    if (document.body.classList.contains(themeToRemove)) {
      document.body.classList.remove(themeToRemove);
    }
    document.body.classList.add(theme);
    setIsDarkMode(theme === "dark");
  };

  return (
    <div
      className={`flex justify-between items-center bg-skin-fill-accent py-3 px-8`}
      style={{
        height: height + "px",
      }}
    >
      <div className="flex items-center gap-3 basis-2/3">
        <div className="flex lg:basis-1/2">
          <a href="https://livekit.io">{logo ?? <LKLogo />}</a>
        </div>
        <div className="lg:basis-1/2 lg:text-center text-xs lg:text-base lg:font-semibold text-skin-primary">
          {title}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <div
          onClick={() => toggleTheme("dark")}
          className={isDarkMode ? "header-button-active" : ""}
        >
          <DarkModeIcon />
        </div>
        <div
          onClick={() => toggleTheme("light")}
          className={!isDarkMode ? "header-button-active" : ""}
        >
          <LightModeIcon />
        </div>
      </div>
    </div>
  );
};
