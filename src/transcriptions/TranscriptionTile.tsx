import { ChatMessageType, ChatTile } from "@/components/chat/ChatTile";
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
import { useEffect, useMemo, useState } from "react";

export function TranscriptionTile({
  agentAudioTrack,
  accentColor,
}: {
  agentAudioTrack: TrackReferenceOrPlaceholder;
  accentColor: string;
}) {
  const agentMessages = useTrackTranscription(agentAudioTrack);
  const localParticipant = useLocalParticipant();
  const localMessages = useTrackTranscription({
    publication: localParticipant.microphoneTrack,
    source: Track.Source.Microphone,
    participant: localParticipant.localParticipant,
  });

  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const { chatMessages, send: sendChat } = useChat();

  useEffect(() => {
    const onSegment = (segment: TranscriptionSegment[]) => {
      console.log("received segment", segment);
    };
    agentAudioTrack.participant.on("transcriptionReceived", onSegment);
    return () => {
      agentAudioTrack.participant.off("transcriptionReceived", onSegment);
    };
  }, [agentAudioTrack, agentAudioTrack.participant, messages]);

  const compiledMessages = useMemo(() => {
    const agentSegments = agentMessages.segments.map((s) =>
      segmentToChatMessage(s, undefined, agentAudioTrack.participant)
    );
    const localSegments = localMessages.segments.map((s) =>
      segmentToChatMessage(s, undefined, localParticipant.localParticipant)
    );
    console.log({}, agentSegments, localSegments);
  }, [
    agentAudioTrack.participant,
    agentMessages.segments,
    localMessages.segments,
    localParticipant.localParticipant,
  ]);

  return (
    <ChatTile messages={messages} accentColor={accentColor} onSend={sendChat} />
  );
}

function segmentToChatMessage(
  s: TranscriptionSegment,
  existingMessage: ChatMessageType | undefined,
  participant: Participant
): ChatMessageType {
  const msg: ChatMessageType = {
    message: s.final ? s.text : `${s.text} ...`,
    name: participant instanceof LocalParticipant ? "You" : "Agent",
    isSelf: participant instanceof LocalParticipant,
    timestamp: existingMessage?.timestamp ?? Date.now(),
  };
  return msg;
}
