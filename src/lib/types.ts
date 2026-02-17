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

export type AgentState = "initializing" | "listening" | "thinking" | "speaking";
export type UserState = "listening" | "speaking" | "idle" | "disconnected";

export type ClientAgentStateChangedEvent = {
  type: "agent_state_changed";
  old_state: AgentState;
  new_state: AgentState;
  created_at: number;
};

export type ClientUserStateChangedEvent = {
  type: "user_state_changed";
  old_state: UserState;
  new_state: UserState;
  created_at: number;
  /** VAD min_endpointing_delay in seconds, if present. */
  delay?: number;
};

/** Per-turn timing metrics attached to ChatMessage by the server. */
export type ConversationItemMetrics = {
  started_speaking_at?: number;
  stopped_speaking_at?: number;
  /** Time to obtain the transcript after end of user speech (user messages). */
  transcription_delay?: number;
  /** Time between end of speech and end-of-turn decision (user messages). */
  end_of_turn_delay?: number;
  /** Time to invoke Agent.on_user_turn_completed callback (user messages). */
  on_user_turn_completed_delay?: number;
  /** LLM time-to-first-token (assistant messages). */
  llm_node_ttft?: number;
  /** TTS time-to-first-byte after first text token (assistant messages). */
  tts_node_ttfb?: number;
  /** End-to-end latency: user stopped speaking → agent started responding (assistant messages). */
  e2e_latency?: number;
};

export type ClientConversationItemAddedEvent = {
  type: "conversation_item_added";
  item: {
    role?: string;
    metrics?: ConversationItemMetrics;
    [key: string]: unknown;
  };
  created_at: number;
};

export type ClientUserInputTranscribedEvent = {
  type: "user_input_transcribed";
  transcript: string;
  is_final: boolean;
  language: string | null;
  created_at: number;
};

export type ClientFunctionToolsExecutedEvent = {
  type: "function_tools_executed";
  function_calls: Record<string, unknown>[];
  function_call_outputs: (Record<string, unknown> | null)[];
  created_at: number;
};

export type LLMMetrics = {
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
};

export type STTMetrics = {
  type: "stt_metrics";
  label: string;
  request_id: string;
  timestamp: number;
  duration: number;
  audio_duration: number;
  streamed: boolean;
};

export type TTSMetrics = {
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
};

export type VADMetrics = {
  type: "vad_metrics";
  label: string;
  timestamp: number;
  idle_time: number;
  inference_duration_total: number;
  inference_count: number;
};

export type EOUMetrics = {
  type: "eou_metrics";
  timestamp: number;
  end_of_utterance_delay: number;
  transcription_delay: number;
  speech_id?: string | null;
};

export type RealtimeModelMetrics = {
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
};

export type AgentMetricsData =
  | LLMMetrics
  | STTMetrics
  | TTSMetrics
  | VADMetrics
  | EOUMetrics
  | RealtimeModelMetrics;

export type ClientMetricsCollectedEvent = {
  type: "metrics_collected";
  metrics: AgentMetricsData;
  created_at: number;
};

export type ClientErrorEvent = {
  type: "error";
  message: string;
  created_at: number;
};

export type ClientUserInterruptionEvent = {
  type: "user_interruption";
  is_interruption: boolean;
  created_at: number;
  sent_at: number;
  overlap_speech_started_at: number | null;
  /** Time from overlap speech onset to interruption prediction (seconds). */
  detection_delay: number;
};

export type LLMModelUsage = {
  type: "llm_usage";
  provider: string;
  model: string;
  input_tokens: number;
  input_cached_tokens: number;
  input_audio_tokens: number;
  input_cached_audio_tokens: number;
  input_text_tokens: number;
  input_cached_text_tokens: number;
  input_image_tokens: number;
  input_cached_image_tokens: number;
  output_tokens: number;
  output_audio_tokens: number;
  output_text_tokens: number;
  session_duration: number;
};

export type TTSModelUsage = {
  type: "tts_usage";
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  characters_count: number;
  audio_duration: number;
};

export type STTModelUsage = {
  type: "stt_usage";
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  audio_duration: number;
};

export type ModelUsage = LLMModelUsage | TTSModelUsage | STTModelUsage;

export type AgentSessionUsage = {
  model_usage: ModelUsage[];
};

export type ClientSessionUsageEvent = {
  type: "session_usage";
  usage: AgentSessionUsage;
  created_at: number;
};

export type ClientEvent =
  | ClientAgentStateChangedEvent
  | ClientUserStateChangedEvent
  | ClientConversationItemAddedEvent
  | ClientUserInputTranscribedEvent
  | ClientFunctionToolsExecutedEvent
  | ClientMetricsCollectedEvent
  | ClientErrorEvent
  | ClientUserInterruptionEvent
  | ClientSessionUsageEvent;

export type ClientEventType = ClientEvent["type"];

export type AttributeItem = {
  id: string;
  key: string;
  value: string;
};
