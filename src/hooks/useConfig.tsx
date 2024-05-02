"use client"

import { getCookie, setCookie } from "cookies-next";
import jsYaml from "js-yaml";
import { useRouter } from "next/navigation";
import React, { createContext, useCallback, useMemo, useState } from "react";

export type AppConfig = {
  title: string;
  description: string;
  github_link?: string;
  video_fit?: "cover" | "contain";
  user_settings: UserSettings;
  show_qr?: boolean;
};

export type UserSettings = {
  theme_color: string;
  chat: boolean;
  inputs: {
    camera: boolean;
    mic: boolean;
  };
  outputs: {
    audio: boolean;
    video: boolean;
  };
  ws_url: string;
  token: string;
};

// Fallback if NEXT_PUBLIC_APP_CONFIG is not set
const defaultConfig: AppConfig = {
  title: "LiveKit Agents Playground",
  description: "A playground for testing LiveKit Agents",
  video_fit: "cover",
  user_settings: {
    theme_color: "cyan",
    chat: true,
    inputs: {
      camera: true,
      mic: true,
    },
    outputs: {
      audio: true,
      video: true,
    },
    ws_url: "",
    token: ""
  },
  show_qr: false,
};

const useAppConfig = (): AppConfig => {
  return useMemo(() => {
    if (process.env.NEXT_PUBLIC_APP_CONFIG) {
      try {
        const parsedConfig = jsYaml.load(
          process.env.NEXT_PUBLIC_APP_CONFIG
        ) as AppConfig;
        return parsedConfig;
      } catch (e) {
        console.error("Error parsing app config:", e);
      }
    }
    return defaultConfig;
  }, []);
};

type ConfigData = {
  config: AppConfig;
  setUserSettings: (settings: UserSettings) => void;
};

const ConfigContext = createContext<ConfigData | undefined>(undefined);

export const ConfigProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const appConfig = useAppConfig();
  const router = useRouter();

  const getSettingsFromUrl = useCallback(() => {
    if(typeof window === 'undefined') {
      return null;
    }
    if (!window.location.hash) {
      return null;
    }
    const params = new URLSearchParams(window.location.hash.replace("#", ""));
    return {
      chat: params.get("chat") === "1",
      theme_color: params.get("theme_color"),
      inputs: {
        camera: params.get("cam") === "1",
        mic: params.get("mic") === "1",
      },
      outputs: {
        audio: params.get("audio") === "1",
        video: params.get("video") === "1",
        chat: params.get("chat") === "1",
      },
      ws_url: "",
      token: ""
    } as UserSettings;
  }, [])

  const getSettingsFromCookies = useCallback(() => {
    const cam = getCookie("lk_input_cam");
    const mic = getCookie("lk_input_cam");
    const audio = getCookie("lk_output_audio");
    const video = getCookie("lk_output_video");
    const chat = getCookie("lk_chat");
    const theme_color = getCookie("lk_theme_color");
    const ws_url = getCookie("lk_ws_url");
    const token = getCookie("lk_token");

    if (!cam && !mic && !audio && !video && !chat) {
      return null;
    }

    return {
      chat: chat === "1",
      theme_color,
      inputs: {
        camera: cam === "1",
        mic: mic === "1",
      },
      outputs: {
        audio: audio === "1",
        video: video === "1",
        chat: chat === "1",
      },
      ws_url: ws_url || "",
      token: token || ""
    } as UserSettings;
  }, [])

  const setUrlSettings = useCallback((us: UserSettings) => {
    const obj = new URLSearchParams({
      cam: boolToString(us.inputs.camera),
      mic: boolToString(us.inputs.mic),
      video: boolToString(us.outputs.video),
      audio: boolToString(us.outputs.audio),
      chat: boolToString(us.chat),
      theme_color: us.theme_color || "cyan",
    });
    // Note: We don't set ws_url and token to the URL on purpose
    router.replace("/#" + obj.toString());
  }, [router])

  const setCookieSettings = useCallback((us: UserSettings) => {
    setCookie("lk_input_cam", boolToString(us.inputs.camera));
    setCookie("lk_input_mic", boolToString(us.inputs.mic));
    setCookie("lk_output_audio", boolToString(us.outputs.audio));
    setCookie("lk_output_video", boolToString(us.outputs.video));
    setCookie("lk_chat", boolToString(us.chat));
    setCookie("lk_theme_color", us.theme_color || "cyan");
    setCookie("lk_ws_url", us.ws_url || "");
    setCookie("lk_token", us.token || "");
  }, [])

  const getConfig = useCallback(() => {
    const appConfigFromSettings = appConfig;
    const cookieSettigs = getSettingsFromCookies();
    const urlSettings = getSettingsFromUrl();

    console.log("Settings", cookieSettigs, urlSettings, appConfigFromSettings);
    if (urlSettings) {
      appConfigFromSettings.user_settings = urlSettings;
      setCookieSettings(urlSettings);
    } else if (cookieSettigs) {
      appConfigFromSettings.user_settings = cookieSettigs;
      setUrlSettings(cookieSettigs);
    }

    console.log("App Config", appConfigFromSettings);

    return {...appConfigFromSettings};
  }, [
    appConfig,
    getSettingsFromCookies,
    getSettingsFromUrl,
    setCookieSettings,
    setUrlSettings,
  ]);

  const setUserSettings = useCallback((settings: UserSettings) => {
    setUrlSettings(settings);
    setCookieSettings(settings);
  }, [setCookieSettings, setUrlSettings]);

  const [config, _setConfig] = useState<AppConfig>(getConfig());

  return (
    <ConfigContext.Provider value={{ config, setUserSettings }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = React.useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}

const boolToString = (b: boolean) => (b ? "1" : "0");
