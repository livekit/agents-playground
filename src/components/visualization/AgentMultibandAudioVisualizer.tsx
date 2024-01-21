import { AgentState } from "@/lib/types";
import { useEffect, useState } from "react";

type AgentMultibandAudioVisualizerProps = {
  state: AgentState;
  barWidth: number;
  minBarHeight: number;
  maxBarHeight: number;
  accentColor: string;
  accentShade?: number;
  frequencies: Float32Array[];
  borderRadius: number;
  gap: number;
};

export const AgentMultibandAudioVisualizer = ({
  state,
  barWidth,
  minBarHeight,
  maxBarHeight,
  accentColor,
  accentShade,
  frequencies,
  borderRadius,
  gap,
}: AgentMultibandAudioVisualizerProps) => {
  const summedFrequencies = frequencies.map((bandFrequencies) => {
    const sum = bandFrequencies.reduce((a, b) => a + b, 0);
    return Math.sqrt(sum / bandFrequencies.length);
  });

  const [thinkingIndex, setThinkingIndex] = useState(
    Math.floor(summedFrequencies.length / 2)
  );
  const [thinkingDirection, setThinkingDirection] = useState<"left" | "right">(
    "right"
  );

  useEffect(() => {
    if (state !== "thinking") {
      setThinkingIndex(Math.floor(summedFrequencies.length / 2));
      return;
    }
    const timeout = setTimeout(() => {
      if (thinkingDirection === "right") {
        if (thinkingIndex === summedFrequencies.length - 1) {
          setThinkingDirection("left");
          setThinkingIndex((prev) => prev - 1);
        } else {
          setThinkingIndex((prev) => prev + 1);
        }
      } else {
        if (thinkingIndex === 0) {
          setThinkingDirection("right");
          setThinkingIndex((prev) => prev + 1);
        } else {
          setThinkingIndex((prev) => prev - 1);
        }
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [state, summedFrequencies.length, thinkingDirection, thinkingIndex]);

  return (
    <div
      className={`flex flex-row items-center`}
      style={{
        gap: gap + "px",
      }}
    >
      {summedFrequencies.map((frequency, index) => {
        const isCenter = index === Math.floor(summedFrequencies.length / 2);

        let color = `${accentColor}-${accentShade}`;
        let shadow = `shadow-lg-${accentColor}`;
        let transform;

        if (state === "listening" || state === "idle") {
          color = isCenter ? `${accentColor}-${accentShade}` : "gray-950";
          shadow = !isCenter ? "" : shadow;
          transform = !isCenter ? "scale(1.0)" : "scale(1.2)";
        } else if (state === "speaking") {
          color = `${accentColor}${accentShade ? "-" + accentShade : ""}`;
        } else if (state === "thinking") {
          color =
            index === thinkingIndex
              ? `${accentColor}-${accentShade}`
              : "gray-950";
          shadow = "";
          transform = thinkingIndex !== index ? "scale(1)" : "scale(1.1)";
        }

        return (
          <div
            className={`bg-${color} ${shadow} ${
              isCenter && state === "listening" ? "animate-pulse" : ""
            }`}
            key={"frequency-" + index}
            style={{
              height:
                minBarHeight + frequency * (maxBarHeight - minBarHeight) + "px",
              borderRadius: borderRadius + "px",
              width: barWidth + "px",
              transition:
                "background-color 0.35s ease-out, transform 0.25s ease-out",
              transform: transform,
            }}
          ></div>
        );
      })}
    </div>
  );
};
