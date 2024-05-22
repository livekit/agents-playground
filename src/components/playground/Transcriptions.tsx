import {
  TrackReference,
  useTrackTranscription,
} from "@livekit/components-react";

export function Transcriptions({ trackRef }: { trackRef: TrackReference }) {
  const { segments } = useTrackTranscription(trackRef, {
    bufferSize: 1,
  });

  return (
    <div>
      {segments.map((s) => (
        <p key={s.id}>{s.text}</p>
      ))}
    </div>
  );
}
