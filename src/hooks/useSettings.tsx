import { ReactNode } from "react";
import {
  AudioIcon,
  CameraVideoIcon,
  ChatIcon,
  MicIcon,
  VideoIcon,
  MessagesIcon,
} from "../components/playground/icons";

export type SettingType =
  | "inputs"
  | "outputs"
  | "chat"
  | "theme_color"
  | "room";

export type SettingValue = {
  title: string;
  type: SettingType | "separator";
  key: string;
  icon?: ReactNode;
  group?: number;
};

export const settingsButtons: SettingValue[] = [
  {
    title: "Enable mic",
    type: "inputs",
    key: "mic",
    icon: <MicIcon />,
    group: 1,
  },
  {
    title: "Enable camera",
    type: "inputs",
    key: "camera",
    icon: <CameraVideoIcon />,
    group: 1,
  },
  {
    title: "Show chat",
    type: "chat",
    key: "chat",
    icon: <ChatIcon />,
    group: 2,
  },

  {
    title: "Show audio",
    type: "outputs",
    key: "audio",
    icon: <AudioIcon />,
    group: 2,
  },
  {
    title: "Show video",
    type: "outputs",
    key: "video",
    icon: <VideoIcon />,
    group: 2,
  },
  {
    title: "Show room details",
    type: "room",
    key: "room details",
    icon: <MessagesIcon />,
    group: 2,
  },
];
