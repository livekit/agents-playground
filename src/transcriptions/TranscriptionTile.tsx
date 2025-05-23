import { DisplayMessageType, ChatMessageType as TileChatMessageType, ChatTile } from "@/components/chat/ChatTile"; // Renamed import to avoid conflict
import type { SystemPromptLog, AgentStateLogEntry } from "@/components/playground/Playground"; // Import types from Playground
import {
  TrackReferenceOrPlaceholder,
  useChat,
  useLocalParticipant,
  useTrackTranscription,
} from "@livekit/components-react";
import {
  LocalParticipant,
  Participant,
  Track,
  TranscriptionSegment,
} from "livekit-client";
import { useEffect, useState } from "react";

export function TranscriptionTile({
                                    agentAudioTrack,
                                    accentColor,
                                    systemPromptLogs, // Type is Playground's SystemPromptLog[]
                                    agentStateLogs,   // Type is Playground's AgentStateLogEntry[]
                                    onSystemPromptSelect,
                                    onAgentStateSelect,
                                  }: {
  agentAudioTrack?: TrackReferenceOrPlaceholder;
  accentColor: string;
  systemPromptLogs: SystemPromptLog[];
  agentStateLogs: AgentStateLogEntry[];
  onSystemPromptSelect: (log: SystemPromptLog) => void;
  onAgentStateSelect: (log: AgentStateLogEntry) => void;
}) {
  const hookData = useLocalParticipant(); // hookData holds the entire object from the hook
  const actualLocalParticipant = hookData.localParticipant; // This is the LocalParticipant instance
  const agentTranscription = useTrackTranscription(agentAudioTrack || undefined);
  const localTranscription = useTrackTranscription({
    publication: hookData.microphoneTrack,
    source: Track.Source.Microphone,
    participant: actualLocalParticipant,
  });

  const [transcriptsMap, setTranscriptsMap] = useState<Map<string, TileChatMessageType>>(new Map());
  const [messages, setMessages] = useState<DisplayMessageType[]>([]);
  const { chatMessages, send: sendChat } = useChat();

  useEffect(() => {
    const newTranscripts = new Map(transcriptsMap);

    if (agentAudioTrack && agentAudioTrack.participant) {
      agentTranscription.segments.forEach((s) => {
        console.log(s);
        const existing = newTranscripts.get(s.id);
        newTranscripts.set(
            s.id,
            segmentToChatMessage(s, existing, agentAudioTrack.participant!)
        );
      });
    }

    localTranscription.segments.forEach((s) => {
      const existing = newTranscripts.get(s.id);
      newTranscripts.set(
          s.id,
          segmentToChatMessage(s, existing, actualLocalParticipant)
      );
    });

    if (newTranscripts.size !== transcriptsMap.size ||
        Array.from(newTranscripts.values()).some((v, i) => v !== Array.from(transcriptsMap.values())[i])) {
      setTranscriptsMap(newTranscripts);
    }

  }, [agentAudioTrack, agentTranscription.segments, localTranscription.segments, actualLocalParticipant, transcriptsMap]);


  useEffect(() => {
    const allDisplayMessages: DisplayMessageType[] = [];

    transcriptsMap.forEach(transcript => {
      allDisplayMessages.push({ ...transcript, type: 'chat' });
    });

    for (const msg of chatMessages) {
      if (!msg.from) continue;
      const isAgent = agentAudioTrack
          ? msg.from.identity === agentAudioTrack.participant?.identity
          // If no agentAudioTrack, assume a non-local message is from the agent.
          // Removed the flawed `&& !hookData.isLocal` which was `&& true` due to hookData.isLocal being undefined.
          : msg.from.identity !== actualLocalParticipant.identity;

      const isSelf = msg.from.identity === actualLocalParticipant.identity;

      let name = msg.from.name;
      if (!name) name = isAgent ? "Agent" : isSelf ? "You" : msg.from.identity;

      allDisplayMessages.push({
        name: name || "Unknown",
        message: msg.message,
        timestamp: msg.timestamp,
        isSelf: isSelf,
        type: 'chat',
      });
    }

    systemPromptLogs.forEach((log) => {
      allDisplayMessages.push({
        ...log,
        type: 'system_prompt',
      });
    });

    agentStateLogs.forEach((log) => {
      allDisplayMessages.push({
        ...log,
        type: 'agent_state',
      });
    });

    // console.log(allDisplayMessages);
    allDisplayMessages.sort((a, b) => a.timestamp - b.timestamp);
    setMessages(allDisplayMessages);

  }, [
    transcriptsMap,
    chatMessages,
    actualLocalParticipant, // Depends on the actual LocalParticipant instance
    agentAudioTrack,
    systemPromptLogs,
    agentStateLogs,
  ]);

  return (
      <ChatTile
          messages={messages}
          accentColor={accentColor}
          onSend={sendChat}
          onSystemPromptClick={onSystemPromptSelect}
          onAgentStateClick={onAgentStateSelect}
      />
  );
}

function segmentToChatMessage(
    s: TranscriptionSegment,
    existingMessage: TileChatMessageType | undefined,
    participant: Participant
): TileChatMessageType {
  const msg: TileChatMessageType = {
    message: s.final ? s.text : `${s.text} ...`,
    name: participant instanceof LocalParticipant ? "You" : (participant.name || "Agent"),
    isSelf: participant instanceof LocalParticipant,
    timestamp: existingMessage?.timestamp ?? Date.now(),
  };
  return msg;
}