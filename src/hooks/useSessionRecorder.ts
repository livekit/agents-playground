import type { ClientEvent } from "@/lib/types";
import type { Track } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function makeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function tryCreateRecorder(
  track: Track | undefined,
  chunksRef: React.MutableRefObject<Blob[]>,
): MediaRecorder | null {
  const mst = track?.mediaStreamTrack;
  if (!mst) return null;
  try {
    const stream = new MediaStream([mst]);
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(100); // 100ms slices
    return recorder;
  } catch (err) {
    console.warn("[useSessionRecorder] MediaRecorder failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseSessionRecorderReturn {
  /** True while at least one audio track is being recorded. */
  isRecording: boolean;
  /** Unix timestamp (seconds) when recording started, or 0 if not yet started. */
  recordingStartedAt: number;
  /** Stop recording and download user.webm + agent.webm + events.ndjson. */
  download: () => void;
}

/**
 * Automatically records user & agent audio (via MediaRecorder) for the entire
 * session. Recording begins as soon as each track becomes available.
 *
 * Call `download()` at any time to stop recording and save:
 *   - `recording-{ts}-user.webm`  – local microphone audio
 *   - `recording-{ts}-agent.webm` – remote agent audio
 *   - `recording-{ts}-events.ndjson` – all events collected so far
 */
export function useSessionRecorder(
  userTrack: Track | undefined,
  agentTrack: Track | undefined,
  events: ClientEvent[],
): UseSessionRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);

  const userRecorderRef = useRef<MediaRecorder | null>(null);
  const agentRecorderRef = useRef<MediaRecorder | null>(null);
  const userChunksRef = useRef<Blob[]>([]);
  const agentChunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Auto-start user track recording when it becomes available
  useEffect(() => {
    if (!userTrack?.mediaStreamTrack || userRecorderRef.current) return;
    if (startedAtRef.current === 0) startedAtRef.current = Date.now() / 1000;
    userChunksRef.current = [];
    userRecorderRef.current = tryCreateRecorder(userTrack, userChunksRef);
    if (userRecorderRef.current) setIsRecording(true);
  }, [userTrack]);

  // Auto-start agent track recording when it becomes available
  useEffect(() => {
    if (!agentTrack?.mediaStreamTrack || agentRecorderRef.current) return;
    if (startedAtRef.current === 0) startedAtRef.current = Date.now() / 1000;
    agentChunksRef.current = [];
    agentRecorderRef.current = tryCreateRecorder(agentTrack, agentChunksRef);
    if (agentRecorderRef.current) setIsRecording(true);
  }, [agentTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (
        userRecorderRef.current &&
        userRecorderRef.current.state !== "inactive"
      )
        userRecorderRef.current.stop();
      if (
        agentRecorderRef.current &&
        agentRecorderRef.current.state !== "inactive"
      )
        agentRecorderRef.current.stop();
    };
  }, []);

  // ------ download ------

  const download = useCallback(() => {
    const endedAt = Date.now() / 1000;
    const startedAt = startedAtRef.current || endedAt;
    const ts = makeTimestamp();

    const doDownload = () => {
      // User audio
      if (userChunksRef.current.length > 0) {
        const mime =
          userRecorderRef.current?.mimeType || "audio/webm;codecs=opus";
        const blob = new Blob(userChunksRef.current, { type: mime });
        triggerDownload(blob, `recording-${ts}-user.webm`);
      }

      // Agent audio
      if (agentChunksRef.current.length > 0) {
        const mime =
          agentRecorderRef.current?.mimeType || "audio/webm;codecs=opus";
        const blob = new Blob(agentChunksRef.current, { type: mime });
        triggerDownload(blob, `recording-${ts}-agent.webm`);
      }

      // Events (NDJSON) — all events from the entire session
      const allEvents = eventsRef.current;
      const metadata = {
        _type: "recording_metadata",
        started_at: startedAt,
        ended_at: endedAt,
      };
      const lines = [
        JSON.stringify(metadata),
        ...allEvents.map((e) => JSON.stringify(e)),
      ];
      const eventsBlob = new Blob([lines.join("\n") + "\n"], {
        type: "application/x-ndjson",
      });
      triggerDownload(eventsBlob, `recording-${ts}-events.ndjson`);

      // Reset for a fresh recording
      userRecorderRef.current = null;
      agentRecorderRef.current = null;
      userChunksRef.current = [];
      agentChunksRef.current = [];
      startedAtRef.current = 0;
      setIsRecording(false);
    };

    // Wait for recorders to flush final chunks before creating blobs
    let pending = 0;
    const onStopped = () => {
      pending--;
      if (pending === 0) doDownload();
    };

    const ur = userRecorderRef.current;
    const ar = agentRecorderRef.current;

    if (ur && ur.state !== "inactive") {
      pending++;
      ur.onstop = onStopped;
      ur.stop();
    }
    if (ar && ar.state !== "inactive") {
      pending++;
      ar.onstop = onStopped;
      ar.stop();
    }
    if (pending === 0) doDownload();
  }, []);

  return {
    isRecording,
    recordingStartedAt: startedAtRef.current,
    download,
  };
}
