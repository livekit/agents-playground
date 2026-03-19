import { AgentSession } from "@livekit/protocol";
import type { Timestamp } from "@bufbuild/protobuf";
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

export type SessionProps = {
  roomName: string;
  identity: string;
  audioTrack?: LocalAudioTrack;
  videoTrack?: LocalVideoTrack;
  region?: string;
  turnServer?: RTCIceServer;
  forceRelay?: boolean;
};

export type TokenResult = {
  identity: string;
  accessToken: string;
};

export type AttributeItem = {
  id: string;
  key: string;
  value: string;
};

export type SessionEventType = NonNullable<
  AgentSession.AgentSessionEvent["event"]["case"]
>;

export const ALL_SESSION_EVENT_TYPES: SessionEventType[] = [
  "agentStateChanged",
  "userStateChanged",
  "conversationItemAdded",
  "userInputTranscribed",
  "functionToolsExecuted",
  "error",
  "overlappingSpeech",
  "sessionUsageUpdated",
];

export function timestampToSeconds(ts: Timestamp | undefined): number {
  if (!ts) return 0;
  return Number(ts.seconds) + ts.nanos / 1e9;
}

const AGENT_STATE_LABELS: Record<AgentSession.AgentState, string> = {
  [AgentSession.AgentState.AS_INITIALIZING]: "initializing",
  [AgentSession.AgentState.AS_IDLE]: "idle",
  [AgentSession.AgentState.AS_LISTENING]: "listening",
  [AgentSession.AgentState.AS_THINKING]: "thinking",
  [AgentSession.AgentState.AS_SPEAKING]: "speaking",
};

const USER_STATE_LABELS: Record<AgentSession.UserState, string> = {
  [AgentSession.UserState.US_SPEAKING]: "speaking",
  [AgentSession.UserState.US_LISTENING]: "listening",
  [AgentSession.UserState.US_AWAY]: "away",
};

export function agentStateLabel(state: AgentSession.AgentState): string {
  return AGENT_STATE_LABELS[state] ?? "unknown";
}

export function userStateLabel(state: AgentSession.UserState): string {
  return USER_STATE_LABELS[state] ?? "unknown";
}

const EVENT_TYPE_LABELS: Record<SessionEventType, string> = {
  agentStateChanged: "agent state changed",
  userStateChanged: "user state changed",
  conversationItemAdded: "conversation item added",
  userInputTranscribed: "user input transcribed",
  functionToolsExecuted: "function tools executed",
  error: "error",
  overlappingSpeech: "overlapping speech",
  sessionUsageUpdated: "session usage updated",
};

export function eventTypeLabel(eventCase: SessionEventType): string {
  return EVENT_TYPE_LABELS[eventCase];
}
