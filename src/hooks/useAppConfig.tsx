import jsYaml from "js-yaml";
import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash/isEqual";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export type AppConfig = {
  title: string;
  description: string;
  github_link?: string;
  theme_color?: string;
  video_fit?: "cover" | "contain";
  outputs: {
    audio: boolean;
    video: boolean;
    chat: boolean;
  };
  inputs: {
    mic: boolean;
    camera: boolean;
  };
  show_qr?: boolean;
  from_config?: boolean;
};

interface AppLocationState {
  cam: string;
  mic: string;
  video: string;
  audio: string;
  chat: string;
}

// Fallback if NEXT_PUBLIC_APP_CONFIG is not set
const defaultConfig: AppConfig = {
  title: "LiveKit Agents Playground",
  description: "A playground for testing LiveKit Agents",
  theme_color: "cyan",
  video_fit: "cover",
  outputs: {
    audio: true,
    video: true,
    chat: true,
  },
  inputs: {
    mic: true,
    camera: true,
  },
  show_qr: false,
};

export const useAppConfig = (): AppConfig | undefined => {
  return useMemo<AppConfig | undefined>(() => {
    if (process.env.NEXT_PUBLIC_APP_CONFIG) {
      try {
        const parsedConfig = jsYaml.load(
          process.env.NEXT_PUBLIC_APP_CONFIG
        ) as AppConfig;
        parsedConfig.from_config = true;
        return parsedConfig;
      } catch (e) {
        console.error("Error parsing app config:", e);
      }
    }
  }, []);
};

export const useSettings = (): [AppConfig, (ac: AppConfig) => void] => {
  const userConfig = useAppConfig();
  const [settings, setSettings] = useState<AppConfig>(
    userConfig ?? defaultConfig
  );
  const hash = useHash();
  const router = useRouter();

  const setSettingsWithLocation = useCallback(
    (ac: AppConfig) => {
      setSettings(ac);
      const obj = new URLSearchParams({
        cam: boolToString(ac.inputs.camera),
        mic: boolToString(ac.inputs.mic),
        video: boolToString(ac.outputs.video),
        audio: boolToString(ac.outputs.audio),
        chat: boolToString(ac.outputs.chat),
      });
      if (ac.theme_color) {
        obj.set("color", ac.theme_color);
      }
      router.replace("/#" + obj.toString());
    },
    [setSettings, router]
  );

  // parse and update settings when location state changes
  useEffect(() => {
    if (!hash) {
      return;
    }
    const params = new URLSearchParams(hash);
    if (!params) {
      return;
    }
    const updates: AppConfig = cloneDeep(settings);
    if (params.has("cam")) {
      updates.inputs.camera = stringToBool(params.get("cam"));
    }
    if (params.has("mic")) {
      updates.inputs.mic = stringToBool(params.get("mic"));
    }
    if (params.has("audio")) {
      updates.outputs.audio = stringToBool(params.get("audio"));
    }
    if (params.has("video")) {
      updates.outputs.video = stringToBool(params.get("video"));
    }
    if (params.has("chat")) {
      updates.outputs.chat = stringToBool(params.get("chat"));
    }
    if (params.has("color")) {
      updates.theme_color = params.get("color")!;
    }
    if (!isEqual(updates, settings)) {
      setSettings(updates);
    }
  }, [settings, hash]);

  return [settings, setSettingsWithLocation];
};

const useHash = () => {
  const params = useParams();
  const [hash, setHash] = useState<string>();

  useEffect(() => {
    const currentHash = window.location.hash.replace("#", "");
    setHash(currentHash);
  }, [params]);

  return hash;
};

const boolToString = (b: boolean) => (b ? "1" : "0");
const stringToBool = (s: string | null) => s === "1";
