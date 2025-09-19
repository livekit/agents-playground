import { useRef } from "react";
import { AgentMultibandAudioVisualizer } from "../visualization/AgentMultibandAudioVisualizer";

type AudioInputTileProps = {
  frequencies: Float32Array[];
  accentColor: string;
};

export const AudioInputTile = ({
  frequencies,
  accentColor,
}: AudioInputTileProps) => {
  return (
    <div
      className={`flex flex-row gap-2 h-[100px] items-center w-full justify-center bg-skin-fill-track-detail`}
    >
      <AgentMultibandAudioVisualizer
        state="speaking"
        barWidth={4}
        minBarHeight={2}
        maxBarHeight={50}
        accentColor={accentColor}
        accentShade={400}
        frequencies={frequencies}
        borderRadius={12}
        gap={4}
      />
    </div>
  );
};
