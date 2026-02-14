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

export type AgentState = "initializing" | "listening" | "thinking" | "speaking";
export type UserState = "listening" | "speaking" | "idle" | "disconnected";

export interface ClientAgentStateChangedEvent {
  type: "agent_state_changed";
  old_state: AgentState;
  new_state: AgentState;
  created_at: number;
}

export interface ClientUserStateChangedEvent {
  type: "user_state_changed";
  old_state: UserState;
  new_state: UserState;
  created_at: number;
}

export interface ClientConversationItemAddedEvent {
  type: "conversation_item_added";
  item: Record<string, unknown>;
  created_at: number;
}

export interface ClientUserInputTranscribedEvent {
  type: "user_input_transcribed";
  transcript: string;
  is_final: boolean;
  language: string | null;
  created_at: number;
}

export interface ClientFunctionToolsExecutedEvent {
  type: "function_tools_executed";
  function_calls: Record<string, unknown>[];
  function_call_outputs: (Record<string, unknown> | null)[];
  created_at: number;
}

export interface LLMMetrics {
  type: "llm_metrics";
  label: string;
  request_id: string;
  timestamp: number;
  duration: number;
  ttft: number;
  cancelled: boolean;
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
  tokens_per_second: number;
  speech_id?: string | null;
}

export interface STTMetrics {
  type: "stt_metrics";
  label: string;
  request_id: string;
  timestamp: number;
  duration: number;
  audio_duration: number;
  streamed: boolean;
}

export interface TTSMetrics {
  type: "tts_metrics";
  label: string;
  request_id: string;
  timestamp: number;
  ttfb: number;
  duration: number;
  audio_duration: number;
  cancelled: boolean;
  characters_count: number;
  streamed: boolean;
  speech_id?: string | null;
}

export interface VADMetrics {
  type: "vad_metrics";
  label: string;
  timestamp: number;
  idle_time: number;
  inference_duration_total: number;
  inference_count: number;
}

export interface EOUMetrics {
  type: "eou_metrics";
  timestamp: number;
  end_of_utterance_delay: number;
  transcription_delay: number;
  speech_id?: string | null;
}

export interface RealtimeModelMetrics {
  type: "realtime_model_metrics";
  label: string;
  request_id: string;
  timestamp: number;
  duration: number;
  ttft: number;
  cancelled: boolean;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  tokens_per_second: number;
}

export type AgentMetricsData =
  | LLMMetrics
  | STTMetrics
  | TTSMetrics
  | VADMetrics
  | EOUMetrics
  | RealtimeModelMetrics;

export interface ClientMetricsCollectedEvent {
  type: "metrics_collected";
  metrics: AgentMetricsData;
  created_at: number;
}

export interface ClientErrorEvent {
  type: "error";
  message: string;
  created_at: number;
}

export interface ClientUserInterruptionEvent {
  type: "user_interruption";
  is_interruption: boolean;
  created_at: number;
  sent_at: number;
  overlap_speech_started_at: number | null;
}

export type ClientEvent =
  | ClientAgentStateChangedEvent
  | ClientUserStateChangedEvent
  | ClientConversationItemAddedEvent
  | ClientUserInputTranscribedEvent
  | ClientFunctionToolsExecutedEvent
  | ClientMetricsCollectedEvent
  | ClientErrorEvent
  | ClientUserInterruptionEvent;

export type ClientEventType = ClientEvent["type"];

export interface AttributeItem {
  id: string;
  key: string;
  value: string;
}
