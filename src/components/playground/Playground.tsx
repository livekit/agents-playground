"use client";

import { LoadingSVG } from "@/components/button/LoadingSVG";
import { ChatTile } from "@/components/chat/ChatTile";
import { ColorPicker } from "@/components/colorPicker/ColorPicker";
import { AttributesInspector } from "@/components/config/AttributesInspector";
import { AudioInputTile } from "@/components/config/AudioInputTile";
import { ConfigurationPanelItem } from "@/components/config/ConfigurationPanelItem";
import { EditableNameValueRow, NameValueRow } from "@/components/config/NameValueRow";
import { PlaygroundHeader } from "@/components/playground/PlaygroundHeader";
import {
  PlaygroundTab,
  PlaygroundTabbedTile,
  PlaygroundTile,
} from "@/components/playground/PlaygroundTile";
import { useConfig } from "@/hooks/useConfig";
import { ClientUserInterruptionEvent, InterruptChatMessage } from "@/lib/types";
import { PartialMessage } from "@bufbuild/protobuf";
import {
  BarVisualizer,
  RoomAudioRenderer,
  SessionProvider,
  StartAudio,
  VideoTrack,
  useAgent,
  useParticipantAttributes,
  useSession,
  useSessionMessages,
  useTracks,
} from "@livekit/components-react";
import {
  ConnectionState,
  TokenSourceConfigurable,
  TokenSourceFetchOptions,
  Track,
} from "livekit-client";
import { RoomAgentDispatch } from "livekit-server-sdk";
import { QRCodeSVG } from "qrcode.react";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import tailwindTheme from "../../lib/tailwindTheme.preval";
import { RpcPanel } from "./RpcPanel";

/** Topic for client events from livekit-agents */
const TOPIC_CLIENT_EVENTS = "lk.agent.events";

export interface PlaygroundMeta {
  name: string;
  value: string;
}

export interface PlaygroundProps {
  logo?: ReactNode;
  themeColors: string[];
  tokenSource: TokenSourceConfigurable;
  agentOptions?: PartialMessage<RoomAgentDispatch>;
  autoConnect?: boolean;
}

const headerHeight = 56;

export default function Playground({
  logo,
  themeColors,
  tokenSource,
  agentOptions: initialAgentOptions,
  autoConnect,
}: PlaygroundProps) {
  const { config, setUserSettings } = useConfig();

  const [rpcMethod, setRpcMethod] = useState("");
  const [rpcPayload, setRpcPayload] = useState("");
  const [hasConnected, setHasConnected] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const [tokenFetchOptions, setTokenFetchOptions] = useState<TokenSourceFetchOptions>();

  // initialize token fetch options from initial values, which can come from config
  useEffect(() => {
    // set initial options only if they haven't been set yet
    if (tokenFetchOptions !== undefined || initialAgentOptions === undefined) {
      return;
    }
    setTokenFetchOptions({
      agentName: initialAgentOptions?.agentName ?? "",
      agentMetadata: initialAgentOptions?.metadata ?? "",
    });
  }, [tokenFetchOptions, initialAgentOptions, initialAgentOptions?.agentName, initialAgentOptions?.metadata]);

  const session = useSession(tokenSource, tokenFetchOptions);
  const { connectionState } = session;
  const agent = useAgent(session);
  const messages = useSessionMessages(session);
  const [latestInterrupt, setLatestInterrupt] =
    useState<InterruptChatMessage | null>(null);
  const interruptCountsRef = useRef({ backchannel: 0, interruption: 0 });
  const [interruptCounts, setInterruptCounts] = useState({
    backchannel: 0,
    interruption: 0,
  });
  const videoTracks = useTracks([Track.Source.Camera], { onlySubscribed: true, room: session.room });

  const localScreenTrack = session.room.localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  );

  const startSession = useCallback(() => {
    if (session.isConnected) {
      return;
    }
    session.start();
    setHasConnected(true);
  }, [session, session.isConnected]);

  useEffect(() => {
    if (autoConnect && !hasConnected) {
      startSession();
    }
  }, [autoConnect, hasConnected, startSession]);

  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      session.room.localParticipant.setCameraEnabled(
        config.settings.inputs.camera,
      );
      session.room.localParticipant.setMicrophoneEnabled(
        config.settings.inputs.mic,
      );
    }
  }, [config, session.room.localParticipant, connectionState]);

  useEffect(() => {
    if (connectionState !== ConnectionState.Disconnected) return;
    interruptCountsRef.current = { backchannel: 0, interruption: 0 };
    setInterruptCounts({ backchannel: 0, interruption: 0 });
    setLatestInterrupt(null);
  }, [connectionState]);

  // Handle interruption events from livekit-agents text streams
  useEffect(() => {
    const room = session.room;
    if (!room) return;

    const handleInterruptEvent = (isInterruption: boolean, createdAt?: number) => {
      const subtype = isInterruption ? "interruption" : "backchannel";
      const timestamp = createdAt ? createdAt * 1000 : Date.now(); // convert seconds to ms

      const next: InterruptChatMessage = {
        id: `interrupt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp,
        type: "interruptEvent",
        subtype,
      };

      if (subtype === "backchannel") {
        interruptCountsRef.current = {
          ...interruptCountsRef.current,
          backchannel: interruptCountsRef.current.backchannel + 1,
        };
      } else {
        interruptCountsRef.current = {
          ...interruptCountsRef.current,
          interruption: interruptCountsRef.current.interruption + 1,
        };
      }
      setInterruptCounts(interruptCountsRef.current);
      setLatestInterrupt(next);
    };

    // Handler for livekit-agents text stream events (topic: lk.agent.events)
    const onTextStream = async (
      reader: { readAll: () => Promise<string>; info: { topic: string } },
      participantInfo: { identity: string },
    ) => {
      try {
        const data = await reader.readAll();
        const event = JSON.parse(data) as { type: string };

        if (event.type !== "user_interruption") return;

        const interruptEvent = event as ClientUserInterruptionEvent;
        console.debug("[interruption] received", {
          from: participantInfo.identity,
          is_interruption: interruptEvent.is_interruption,
          created_at: interruptEvent.created_at,
        });

        handleInterruptEvent(interruptEvent.is_interruption, interruptEvent.created_at);
      } catch (e) {
        console.warn("[interruption] failed to parse event", e);
      }
    };

    try {
      room.registerTextStreamHandler(TOPIC_CLIENT_EVENTS, onTextStream);
    } catch (e) {
      console.warn("[interruption] failed to register text stream handler", e);
    }

    return () => {
      try {
        room.unregisterTextStreamHandler(TOPIC_CLIENT_EVENTS);
      } catch {
        // ignore if already unregistered
      }
    };
  }, [session.room]);

  // Ensure carousel index is valid when tracks change
  useEffect(() => {
    if (videoTracks.length > 0 && carouselIndex >= videoTracks.length) {
      setCarouselIndex(0);
    }
  }, [videoTracks.length, carouselIndex]);

  const videoTileContent = useMemo(() => {
    const videoFitClassName = `object-${config.video_fit || "contain"}`;

    const disconnectedContent = (
      <div className="flex items-center justify-center text-gray-700 text-center w-full h-full">
        No agent video track. Connect to get started.
      </div>
    );

    const loadingContent = (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-700 text-center h-full w-full">
        <LoadingSVG />
        Waiting for video tracks…
      </div>
    );

    if (connectionState === ConnectionState.Disconnected) {
      return (
        <div className="flex flex-col w-full grow text-gray-950 bg-black rounded-sm border border-gray-800 relative">
          {disconnectedContent}
        </div>
      );
    }

    if (videoTracks.length === 0) {
      return (
        <div className="flex flex-col w-full grow text-gray-950 bg-black rounded-sm border border-gray-800 relative">
          {loadingContent}
        </div>
      );
    }

    const currentIndex = Math.min(carouselIndex, videoTracks.length - 1);
    const currentTrack = videoTracks[currentIndex];

    return (
      <div className="flex flex-col w-full grow text-gray-950 bg-black rounded-sm border border-gray-800 relative">
        <VideoTrack
          trackRef={currentTrack}
          className={`absolute top-1/2 -translate-y-1/2 ${videoFitClassName} object-position-center w-full h-full`}
        />
        {/* Carousel controls */}
        {videoTracks.length > 1 && (
          <>
            {/* Navigation arrows */}
            <button
              onClick={() => setCarouselIndex((prev) => (prev - 1 + videoTracks.length) % videoTracks.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => setCarouselIndex((prev) => (prev + 1) % videoTracks.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            {/* Participant label */}
            <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
              {currentTrack.participant?.identity ?? "Unknown"}
            </div>
            {/* Dot indicators */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {videoTracks.map((track, idx) => (
                <button
                  key={track.participant?.identity ?? idx}
                  onClick={() => setCarouselIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentIndex ? "bg-white" : "bg-white/40 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          </>
        )}
        {/* Single track label */}
        {videoTracks.length === 1 && (
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
            {currentTrack.participant?.identity ?? "Unknown"}
          </div>
        )}
      </div>
    );
  }, [config, connectionState, videoTracks, carouselIndex]);

  useEffect(() => {
    document.body.style.setProperty(
      "--lk-theme-color",
      // @ts-ignore
      tailwindTheme.colors[config.settings.theme_color]["500"],
    );
    document.body.style.setProperty(
      "--lk-drop-shadow",
      `var(--lk-theme-color) 0px 0px 18px`,
    );
  }, [config.settings.theme_color]);

  const audioTileContent = useMemo(() => {
    const disconnectedContent = (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-700 text-center w-full">
        No agent audio track. Connect to get started.
      </div>
    );

    const waitingContent = (
      <div className="flex flex-col items-center gap-2 text-gray-700 text-center w-full">
        <LoadingSVG />
        Waiting for agent audio track…
      </div>
    );

    const visualizerContent = (
      <div
        className={`flex items-center justify-center w-full h-48 [--lk-va-bar-width:30px] [--lk-va-bar-gap:20px] [--lk-fg:var(--lk-theme-color)]`}
      >
        <BarVisualizer
          state={agent.state}
          track={agent.microphoneTrack}
          barCount={5}
          options={{ minHeight: 20 }}
        />
      </div>
    );

    if (connectionState === ConnectionState.Disconnected) {
      return disconnectedContent;
    }

    if (!agent.microphoneTrack) {
      return waitingContent;
    }

    return visualizerContent;
  }, [
    agent.microphoneTrack,
    connectionState,
    agent.state,
  ]);

  const chatTileContent = useMemo(() => {
    if (agent.isConnected) {
      return (
        <ChatTile
          messages={messages.messages}
          latestInterrupt={latestInterrupt ?? undefined}
          interruptCounts={interruptCounts}
          accentColor={config.settings.theme_color}
          onSend={messages.send}
        />
      );
    }
    return <></>;
  }, [
    agent.isConnected,
    config.settings.theme_color,
    messages.messages,
    messages.send,
    latestInterrupt,
    interruptCounts,
  ]);

  const handleRpcCall = useCallback(async () => {
    if (!agent.internal.agentParticipant) {
      throw new Error("No agent or room available");
    }

    const response = await session.room.localParticipant.performRpc({
      destinationIdentity: agent.internal.agentParticipant.identity,
      method: rpcMethod,
      payload: rpcPayload,
    });
    return response;
  }, [
    session.room.localParticipant,
    rpcMethod,
    rpcPayload,
    agent.internal.agentParticipant,
  ]);

  const agentAttributes = useParticipantAttributes({
    participant: agent.internal.agentParticipant ?? undefined,
  });

  const settingsTileContent = useMemo(() => {
    return (
      <div className="flex flex-col h-full w-full items-start overflow-y-auto">
        {config.description && (
          <ConfigurationPanelItem title="Description">
            {config.description}
          </ConfigurationPanelItem>
        )}

        <ConfigurationPanelItem title="Room">
          <div className="flex flex-col gap-2">
            <NameValueRow
              name="Room name"
              value={
                connectionState === ConnectionState.Connected
                  ? session.room.name
                  : ""
              }
              valueColor={`${config.settings.theme_color}-500`}
            />
            <NameValueRow
              name="Status"
              value={
                connectionState === ConnectionState.Connecting ? (
                  <LoadingSVG diameter={16} strokeWidth={2} />
                ) : (
                  connectionState.charAt(0).toUpperCase() +
                  connectionState.slice(1)
                )
              }
              valueColor={
                connectionState === ConnectionState.Connected
                  ? `${config.settings.theme_color}-500`
                  : "gray-500"
              }
            />
          </div>
        </ConfigurationPanelItem>

        <ConfigurationPanelItem title="Agent">
          <div className="flex flex-col gap-2">
            <EditableNameValueRow
              name="Agent name"
              value={tokenFetchOptions?.agentName ?? ""}
              valueColor={`${config.settings.theme_color}-500`}
              onValueChange={(value) => {
                setTokenFetchOptions({
                  ...tokenFetchOptions,
                  agentName: value,
                });
              }}
              placeholder="None"
              editable={connectionState !== ConnectionState.Connected}
            />
            <NameValueRow
              name="Identity"
              value={
                agent.internal.agentParticipant ? (
                  agent.internal.agentParticipant.identity
                ) : connectionState === ConnectionState.Connected ? (
                  <LoadingSVG diameter={12} strokeWidth={2} />
                ) : (
                  "No agent connected"
                )
              }
              valueColor={
                agent.isConnected
                  ? `${config.settings.theme_color}-500`
                  : "gray-500"
              }
            />
            <NameValueRow
              name="Worker"
              value={
                agent.internal.workerParticipant ? (
                  agent.internal.workerParticipant.identity
                ) : (
                  "No worker"
                )
              }
              valueColor="gray-500"
            />
            <NameValueRow
              name="Camera Source"
              value={
                agent.cameraTrack ? (
                  `${agent.cameraTrack.participant?.identity ?? "unknown"}`
                ) : (
                  "No camera"
                )
              }
              valueColor="gray-500"
            />
            {connectionState === ConnectionState.Connected &&
              agent.internal.agentParticipant && (
                <AttributesInspector
                  attributes={Object.entries(
                    agentAttributes.attributes || {},
                  ).map(([key, value]) => ({
                    id: key,
                    key,
                    value: String(value),
                  }))}
                  onAttributesChange={() => {}}
                  themeColor={config.settings.theme_color}
                  disabled={true}
                />
              )}
            <p className="text-xs text-gray-500 text-right">
              Set an agent name to use{" "}
              <a
                href="https://docs.livekit.io/agents/server/agent-dispatch/#explicit"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-300 underline"
              >
                explicit dispatch
              </a>
              .
            </p>
          </div>
        </ConfigurationPanelItem>

        <ConfigurationPanelItem title="User">
          <div className="flex flex-col gap-2">
            <EditableNameValueRow
              name="Name"
              value={
                connectionState === ConnectionState.Connected
                  ? session.room.localParticipant.name || ""
                  : (tokenFetchOptions?.participantName ?? "")
              }
              valueColor={`${config.settings.theme_color}-500`}
              onValueChange={(value) => {
                setTokenFetchOptions({
                  ...tokenFetchOptions,
                  participantName: value,
                });
              }}
              placeholder="Auto"
              editable={connectionState !== ConnectionState.Connected}
            />
            <EditableNameValueRow
              name="Identity"
              value={
                connectionState === ConnectionState.Connected
                  ? session.room.localParticipant.identity
                  : (tokenFetchOptions?.participantIdentity ?? "")
              }
              valueColor={`${config.settings.theme_color}-500`}
              onValueChange={(value) => {
                setTokenFetchOptions({
                  ...tokenFetchOptions,
                  participantIdentity: value,
                });
              }}
              placeholder="Auto"
              editable={connectionState !== ConnectionState.Connected}
            />
            <AttributesInspector
              attributes={Object.entries(
                tokenFetchOptions?.participantAttributes || {},
              ).map(([key, value]) => ({
                id: key,
                key,
                value: value,
              }))}
              onAttributesChange={(newAttributes) => {
                const newAttributesMap = newAttributes.reduce(
                  (acc, attr) => {
                    acc[attr.key] = attr.value;
                    return acc;
                  },
                  {} as Record<string, string>,
                );
                setTokenFetchOptions({
                  ...tokenFetchOptions,
                  participantAttributes: newAttributesMap,
                });
              }}
              metadata={tokenFetchOptions?.participantMetadata}
              onMetadataChange={(metadata) => {
                setTokenFetchOptions({
                  ...tokenFetchOptions,
                  participantMetadata: metadata,
                });
              }}
              themeColor={config.settings.theme_color}
              disabled={false}
              connectionState={connectionState}
            />
          </div>
        </ConfigurationPanelItem>

        {connectionState === ConnectionState.Connected &&
          config.settings.inputs.screen && (
            <ConfigurationPanelItem
              title="Screen"
              source={Track.Source.ScreenShare}
            >
              {localScreenTrack ? (
                <div className="relative">
                  <VideoTrack
                    className="rounded-sm border border-gray-800 opacity-70 w-full"
                    trackRef={
                      localScreenTrack
                        ? {
                            participant: session.room.localParticipant,
                            publication: localScreenTrack,
                            source: Track.Source.ScreenShare,
                          }
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center text-gray-700 text-center w-full h-full">
                  Press the button above to share your screen.
                </div>
              )}
            </ConfigurationPanelItem>
          )}
        {connectionState === ConnectionState.Connected && agent.isConnected && (
          <RpcPanel
            config={config}
            rpcMethod={rpcMethod}
            rpcPayload={rpcPayload}
            setRpcMethod={setRpcMethod}
            setRpcPayload={setRpcPayload}
            handleRpcCall={handleRpcCall}
          />
        )}
        {config.settings.inputs.camera && (
          <ConfigurationPanelItem title="Camera" source={Track.Source.Camera}>
            {session.local.cameraTrack ? (
              <div className="relative">
                <VideoTrack
                  className="rounded-sm border border-gray-800 opacity-70 w-full"
                  trackRef={session.local.cameraTrack}
                />
              </div>
            ) : null}
          </ConfigurationPanelItem>
        )}
        {config.settings.inputs.mic && (
          <ConfigurationPanelItem
            title="Microphone"
            source={Track.Source.Microphone}
          >
            {session.local.microphoneTrack ? (
              <AudioInputTile trackRef={session.local.microphoneTrack} />
            ) : null}
          </ConfigurationPanelItem>
        )}
        <div className="w-full">
          <ConfigurationPanelItem title="Color">
            <ColorPicker
              colors={themeColors}
              selectedColor={config.settings.theme_color}
              onSelect={(color) => {
                const userSettings = { ...config.settings };
                userSettings.theme_color = color;
                setUserSettings(userSettings);
              }}
            />
          </ConfigurationPanelItem>
        </div>
        {config.show_qr && (
          <div className="w-full">
            <ConfigurationPanelItem title="QR Code">
              <QRCodeSVG value={window.location.href} width="128" />
            </ConfigurationPanelItem>
          </div>
        )}
      </div>
    );
  }, [
    config,
    agent.isConnected,
    agentAttributes.attributes,
    session.room.localParticipant,
    session.room.name,
    connectionState,
    session.local.cameraTrack,
    localScreenTrack,
    session.local.microphoneTrack,
    themeColors,
    setUserSettings,
    agent.internal.agentParticipant,
    rpcMethod,
    rpcPayload,
    handleRpcCall,
    tokenFetchOptions,
    setTokenFetchOptions,
  ]);

  let mobileTabs: PlaygroundTab[] = [];
  if (config.settings.outputs.video) {
    mobileTabs.push({
      title: "Video",
      content: (
        <PlaygroundTile
          className="w-full h-full grow"
          childrenClassName="justify-center"
        >
          {videoTileContent}
        </PlaygroundTile>
      ),
    });
  }

  if (config.settings.outputs.audio) {
    mobileTabs.push({
      title: "Audio",
      content: (
        <PlaygroundTile
          className="w-full h-full grow"
          childrenClassName="justify-center"
        >
          {audioTileContent}
        </PlaygroundTile>
      ),
    });
  }

  if (config.settings.chat) {
    mobileTabs.push({
      title: "Chat",
      content: chatTileContent,
    });
  }

  mobileTabs.push({
    title: "Settings",
    content: (
      <PlaygroundTile
        padding={false}
        backgroundColor="gray-950"
        className="h-full w-full basis-1/4 items-start overflow-y-auto flex"
        childrenClassName="h-full grow items-start"
      >
        {settingsTileContent}
      </PlaygroundTile>
    ),
  });

  return (
    <SessionProvider session={session}>
      <div className="flex flex-col h-full w-full">
        <PlaygroundHeader
          title={config.title}
          logo={logo}
          githubLink={config.github_link}
          height={headerHeight}
          accentColor={config.settings.theme_color}
          connectionState={connectionState}
          onConnectClicked={() => {
            if (connectionState === ConnectionState.Disconnected) {
              startSession();
            } else if (connectionState === ConnectionState.Connected) {
              session.end();
            }
          }}
        />
        <div
          className={`flex gap-4 py-4 grow w-full selection:bg-${config.settings.theme_color}-900`}
          style={{ height: `calc(100% - ${headerHeight}px)` }}
        >
          <div className="flex flex-col grow basis-1/2 gap-4 h-full lg:hidden">
            <PlaygroundTabbedTile
              className="h-full"
              tabs={mobileTabs}
              initialTab={mobileTabs.length - 1}
            />
          </div>
          <div
            className={`flex-col grow basis-1/2 gap-4 h-full hidden lg:${
              !config.settings.outputs.audio && !config.settings.outputs.video
                ? "hidden"
                : "flex"
            }`}
          >
            {config.settings.outputs.video && (
              <PlaygroundTile
                title="Agent Video"
                className="w-full h-full grow"
                childrenClassName="justify-center"
              >
                {videoTileContent}
              </PlaygroundTile>
            )}
            {config.settings.outputs.audio && (
              <PlaygroundTile
                title="Agent Audio"
                className="w-full h-full grow"
                childrenClassName="justify-center"
              >
                {audioTileContent}
              </PlaygroundTile>
            )}
          </div>

          {config.settings.chat && (
            <PlaygroundTile
              title="Chat"
              className="h-full grow basis-1/4 hidden lg:flex"
            >
              {chatTileContent}
            </PlaygroundTile>
          )}
          <PlaygroundTile
            padding={false}
            backgroundColor="gray-950"
            className="h-full w-full basis-1/4 items-start overflow-y-auto hidden max-w-[480px] lg:flex"
            childrenClassName="h-full grow items-start"
          >
            {settingsTileContent}
          </PlaygroundTile>
        </div>
        <RoomAudioRenderer />
        <StartAudio label="Click to enable audio playback" />
      </div>
    </SessionProvider>
  );
}
