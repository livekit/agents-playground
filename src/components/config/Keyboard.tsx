import React, { useState } from "react";
import { LocalParticipant } from "livekit-client";

interface KeyboardProps {
  localParticipant: LocalParticipant;
  className?: string;
}

interface KeyConfig {
  label: string;
  intKey: number;
  strKey: string;
}

const keyConfigs: KeyConfig[] = [
  { label: "1", intKey: 1, strKey: "1" },
  { label: "2", intKey: 2, strKey: "2" },
  { label: "3", intKey: 3, strKey: "3" },
  { label: "4", intKey: 4, strKey: "4" },
  { label: "5", intKey: 5, strKey: "5" },
  { label: "6", intKey: 6, strKey: "6" },
  { label: "7", intKey: 7, strKey: "7" },
  { label: "8", intKey: 8, strKey: "8" },
  { label: "9", intKey: 9, strKey: "9" },
  { label: "*", intKey: 10, strKey: "*" },
  { label: "0", intKey: 0, strKey: "0" },
  { label: "#", intKey: 11, strKey: "#" },
];

export const Keyboard: React.FC<KeyboardProps> = ({
  localParticipant,
  className = "",
}) => {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [pressedSequence, setPressedSequence] = useState<string[]>([]);

  const handleKeyPress = async (keyConfig: KeyConfig) => {
    setPressedKey(keyConfig.label);
    setPressedSequence((seq) => [...seq, keyConfig.label]);
    console.log("Publishing DTMF:", keyConfig.label);
    
    try {
      await localParticipant.publishDtmf(keyConfig.intKey, keyConfig.strKey);
    } catch (error) {
      console.error("Failed to publish DTMF:", error);
    } finally {
      setTimeout(() => {
        setPressedKey(null);
      }, 150);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col gap-4">
        <div className="mb-2 text-center text-gray-400 text-sm tracking-widest">
          {pressedSequence.length > 0 ? pressedSequence.join(' ') : ''}
        </div>
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
          {keyConfigs.map((keyConfig) => (
            <button
              key={keyConfig.label}
              onClick={() => handleKeyPress(keyConfig)}
              className={`
                h-14 w-14 flex items-center justify-center
                text-lg font-semibold rounded-lg
                border transition-all duration-150 ease-out
                hover:scale-105 active:scale-95
                ${
                  pressedKey === keyConfig.label
                    ? "bg-blue-600 border-blue-500 text-white scale-95"
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-700"
                }
              `}
              disabled={pressedKey !== null}
            >
              {keyConfig.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
