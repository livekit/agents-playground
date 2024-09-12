import { useMemo } from "react";
import { BarVisualizer, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";

export const AudioInputTile = () => {
  const { microphoneTrack, localParticipant } = useLocalParticipant();

  const trackRef = useMemo(() => {
    return {
      participant: localParticipant,
      source: Track.Source.Microphone,
      publication: microphoneTrack,
    };
  }, [microphoneTrack, localParticipant]);
  return (
    <div
      className={`flex flex-row gap-2 h-[100px] items-center w-full justify-center border rounded-sm border-gray-800 bg-gray-900`}
    >
      <BarVisualizer
        trackRef={trackRef}
        className="h-full w-full"
        barCount={20}
        options={{ minHeight: 0 }}
      />
    </div>
  );
};
