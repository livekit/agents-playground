import jsYaml from "js-yaml";

const APP_CONFIG = process.env.NEXT_PUBLIC_APP_CONFIG;

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
};

// Fallback if NEXT_PUBLIC_APP_CONFIG is not set
const defaultConfig: AppConfig = {
  title: "Agents Playground",
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

export const useAppConfig = (): AppConfig => {
  if (APP_CONFIG) {
    try {
      const parsedConfig = jsYaml.load(APP_CONFIG);
      console.log("parsedConfig:", parsedConfig);
      return parsedConfig as AppConfig;
    } catch (e) {
      console.error("Error parsing app config:", e);
      return defaultConfig;
    }
  } else {
    return defaultConfig;
  }
};
