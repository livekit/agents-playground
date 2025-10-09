import React, { useMemo } from "react";

export type DataChannelLogEntry = {
  id: string;
  timestamp: number;
  topic?: string;
  participantIdentity?: string;
  participantName?: string;
  kind: "reliable" | "lossy" | "unknown";
  payload: string;
  payloadFormat: "json" | "text" | "binary";
};

type DataChannelLogProps = {
  entries: DataChannelLogEntry[];
  onClear: () => void;
};

const noEntriesMessage = "No data events received yet.";

export const DataChannelLog: React.FC<DataChannelLogProps> = ({
  entries,
  onClear,
}: DataChannelLogProps) => {
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.timestamp - b.timestamp),
    [entries],
  );

  return (
    <div className="flex flex-col h-full w-full text-xs text-gray-300">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-gray-500">
          Room data events
        </span>
        <button
          className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-gray-300 active:text-gray-200 transition-colors"
          onClick={onClear}
          type="button"
        >
          Clear
        </button>
      </div>
      <div className="mt-2 flex-1 overflow-y-auto pr-1">
        {sortedEntries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-600">
            {noEntriesMessage}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedEntries.map((entry: DataChannelLogEntry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 rounded-sm border border-gray-800 bg-gray-950/70 p-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                  <span className="font-medium text-gray-300">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="rounded-sm bg-gray-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                    {entry.kind}
                  </span>
                  {entry.topic && (
                    <span className="rounded-sm bg-gray-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                      {entry.topic}
                    </span>
                  )}
                  {entry.payloadFormat !== "text" && (
                    <span className="rounded-sm bg-gray-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                      {entry.payloadFormat}
                    </span>
                  )}
                  {(entry.participantName || entry.participantIdentity) && (
                    <span className="text-gray-500">
                      {entry.participantName || entry.participantIdentity}
                    </span>
                  )}
                </div>
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-sm bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-gray-200">
                  {entry.payload}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

