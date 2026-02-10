import {
  LocalAudioTrack,
  LocalVideoTrack,
  TokenSourceConfigurable,
} from "livekit-client";

export type PlaygroundConnectProps = {
  accentColor: string;
  onConnectClicked: (
    tokenSource: TokenSourceConfigurable,
    shouldAutoConnect?: boolean,
  ) => void;
};

export interface SessionProps {
  roomName: string;
  identity: string;
  audioTrack?: LocalAudioTrack;
  videoTrack?: LocalVideoTrack;
  region?: string;
  turnServer?: RTCIceServer;
  forceRelay?: boolean;
}

export interface TokenResult {
  identity: string;
  accessToken: string;
}

export type InterruptChatMessage = {
  id: string;
  timestamp: number;
  type: "interruptEvent";
  subtype: "interruption" | "backchannel";
  detectionDelay?: number;
  totalDuration?: number;
};

/**
 * Event format from livekit-agents ClientUserInterruptionEvent
 * Sent via text stream on topic "lk.agent.events"
 */
export interface ClientUserInterruptionEvent {
  type: "user_interruption";
  is_interruption: boolean;
  created_at: number;
}

export interface AttributeItem {
  id: string;
  key: string;
  value: string;
}
