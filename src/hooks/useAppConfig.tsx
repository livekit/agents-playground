import jsYaml from "js-yaml";
import { useEffect, useState } from "react";

const APP_CONFIG = process.env.NEXT_PUBLIC_APP_CONFIG;

export type AppConfig = {
  title: string;
  description: string;
  github_link?: string;
  theme_color?: string;
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
  title: "Agent Playground",
  description: "A playground for testing LiveKit agents",
  theme_color: "cyan",
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
  const [config, setConfig] = useState<any>(null);
  useEffect(() => {
    try {
      if (APP_CONFIG) {
        const parsedConfig = jsYaml.load(APP_CONFIG);
        setConfig(parsedConfig);
        console.log("parsedConfig:", parsedConfig);
      } else {
        setConfig(defaultConfig);
      }
    } catch (error) {
      console.error("Error parsing NEXT_PUBLIC_APP_CONFIG:", error);
    }
  }, []);

  return config;
};
