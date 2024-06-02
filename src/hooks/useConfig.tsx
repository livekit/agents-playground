"use client";

import { getCookie, setCookie } from "cookies-next";
import jsYaml from "js-yaml";
import { useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AppConfig = {
  title: string;
  description: string;
  github_link?: string;
  video_fit?: "cover" | "contain";
  settings: UserSettings;
  show_qr?: boolean;
};

export type UserSettings = {
  editable: boolean;
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
  settings: {
    editable: true,
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
    token: "",
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
        if (parsedConfig.settings === undefined) {
          parsedConfig.settings = defaultConfig.settings;
        }
        if (parsedConfig.settings.editable === undefined) {
          parsedConfig.settings.editable = true;
        }
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

export const ConfigProvider = ({ children }: { children: React.ReactNode }) => {
  const appConfig = useAppConfig();
  const router = useRouter();
  const [localColorOverride, setLocalColorOverride] = useState<string | null>(
    null
  );

  const getSettingsFromUrl = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }
    if (!window.location.hash) {
      return null;
    }
    const appConfigFromSettings = appConfig;
    if (appConfigFromSettings.settings.editable === false) {
      return null;
    }
    const params = new URLSearchParams(window.location.hash.replace("#", ""));
    return {
      editable: true,
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
      token: "",
    } as UserSettings;
  }, [appConfig]);

  const getSettingsFromCookies = useCallback(() => {
    const appConfigFromSettings = appConfig;
    if (appConfigFromSettings.settings.editable === false) {
      return null;
    }
    const jsonSettings = getCookie("lk_settings");
    if (!jsonSettings) {
      return null;
    }
    return JSON.parse(jsonSettings) as UserSettings;
  }, [appConfig]);

  const setUrlSettings = useCallback(
    (us: UserSettings) => {
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
    },
    [router]
  );

  const setCookieSettings = useCallback((us: UserSettings) => {
    const json = JSON.stringify(us);
    setCookie("lk_settings", json);
  }, []);

  const getConfig = useCallback(() => {
    const appConfigFromSettings = appConfig;

    if (appConfigFromSettings.settings.editable === false) {
      if (localColorOverride) {
        appConfigFromSettings.settings.theme_color = localColorOverride;
      }
      return appConfigFromSettings;
    }
    const cookieSettigs = getSettingsFromCookies();
    const urlSettings = getSettingsFromUrl();
    if (!cookieSettigs) {
      if (urlSettings) {
        setCookieSettings(urlSettings);
      }
    }
    if (!urlSettings) {
      if (cookieSettigs) {
        setUrlSettings(cookieSettigs);
      }
    }
    const newCookieSettings = getSettingsFromCookies();
    if (!newCookieSettings) {
      return appConfigFromSettings;
    }
    appConfigFromSettings.settings = newCookieSettings;
    return { ...appConfigFromSettings };
  }, [
    appConfig,
    getSettingsFromCookies,
    getSettingsFromUrl,
    localColorOverride,
    setCookieSettings,
    setUrlSettings,
  ]);

  const setUserSettings = useCallback(
    (settings: UserSettings) => {
      const appConfigFromSettings = appConfig;
      if (appConfigFromSettings.settings.editable === false) {
        setLocalColorOverride(settings.theme_color);
        return;
      }
      setUrlSettings(settings);
      setCookieSettings(settings);
      _setConfig((prev) => {
        return {
          ...prev,
          settings: settings,
        };
      });
    },
    [appConfig, setCookieSettings, setUrlSettings]
  );

  const [config, _setConfig] = useState<AppConfig>(getConfig());

  // Run things client side because we use cookies
  useEffect(() => {
    _setConfig(getConfig());
  }, [getConfig]);

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
};

const boolToString = (b: boolean) => (b ? "1" : "0");
