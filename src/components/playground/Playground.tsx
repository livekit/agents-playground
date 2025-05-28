"use client";

import { LoadingSVG } from "@/components/button/LoadingSVG";
import { ChatMessageType } from "@/components/chat/ChatTile";
import { ColorPicker } from "@/components/colorPicker/ColorPicker";
import { AudioInputTile } from "@/components/config/AudioInputTile";
import { ConfigurationPanelItem } from "@/components/config/ConfigurationPanelItem";
import { NameValueRow } from "@/components/config/NameValueRow";
import { PlaygroundHeader } from "@/components/playground/PlaygroundHeader";
import {
  PlaygroundTab,
  PlaygroundTabbedTile,
  PlaygroundTile,
} from "@/components/playground/PlaygroundTile";
import { useConfig } from "@/hooks/useConfig";
import { TranscriptionTile } from "@/transcriptions/TranscriptionTile";
import {
  BarVisualizer,
  VideoTrack,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useRoomInfo,
  useTracks,
  useVoiceAssistant,
  useRoomContext,
  useParticipantAttributes,
} from "@livekit/components-react";
import { ConnectionState, LocalParticipant, Track } from "livekit-client";
import { QRCodeSVG } from "qrcode.react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import tailwindTheme from "../../lib/tailwindTheme.preval";
import { EditableNameValueRow } from "@/components/config/NameValueRow";

export interface PlaygroundMeta {
  name: string;
  value: string;
}

export interface PlaygroundProps {
  logo?: ReactNode;
  themeColors: string[];
  onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
}

const headerHeight = 56;

export default function Playground({
  logo,
  themeColors,
  onConnect,
}: PlaygroundProps) {
  const { config, setUserSettings } = useConfig();
  const { name } = useRoomInfo();
  const [transcripts, setTranscripts] = useState<ChatMessageType[]>([]);
  const { localParticipant } = useLocalParticipant();

  const voiceAssistant = useVoiceAssistant();

  const roomState = useConnectionState();
  const tracks = useTracks();
  const room = useRoomContext();

  const [rpcMethod, setRpcMethod] = useState("");
  const [rpcPayload, setRpcPayload] = useState("");
  const [showRpc, setShowRpc] = useState(false);

  useEffect(() => {
    if (roomState === ConnectionState.Connected) {
      localParticipant.setCameraEnabled(config.settings.inputs.camera);
      localParticipant.setMicrophoneEnabled(config.settings.inputs.mic);
    }
  }, [config, localParticipant, roomState]);

  const agentVideoTrack = tracks.find(
    (trackRef) =>
      trackRef.publication.kind === Track.Kind.Video &&
      trackRef.participant.isAgent
  );

  const localTracks = tracks.filter(
    ({ participant }) => participant instanceof LocalParticipant
  );
  const localCameraTrack = localTracks.find(
    ({ source }) => source === Track.Source.Camera
  );
  const localScreenTrack = localTracks.find(
    ({ source }) => source === Track.Source.ScreenShare
  );
  const localMicTrack = localTracks.find(
    ({ source }) => source === Track.Source.Microphone
  );

  const onDataReceived = useCallback(
    (msg: any) => {
      if (msg.topic === "transcription") {
        const decoded = JSON.parse(
          new TextDecoder("utf-8").decode(msg.payload)
        );
        let timestamp = new Date().getTime();
        if ("timestamp" in decoded && decoded.timestamp > 0) {
          timestamp = decoded.timestamp;
        }
        setTranscripts([
          ...transcripts,
          {
            name: "You",
            message: decoded.text,
            timestamp: timestamp,
            isSelf: true,
          },
        ]);
      }
    },
    [transcripts]
  );

  useDataChannel(onDataReceived);

  const videoTileContent = useMemo(() => {
    const videoFitClassName = `object-${config.video_fit || "cover"}`;

    const disconnectedContent = (
      <div className="flex items-center justify-center text-gray-700 text-center w-full h-full">
        No agent video track. Connect to get started.
      </div>
    );

    const loadingContent = (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-700 text-center h-full w-full">
        <LoadingSVG />
        Waiting for agent video track…
      </div>
    );

    const videoContent = (
      <VideoTrack
        trackRef={agentVideoTrack}
        className={`absolute top-1/2 -translate-y-1/2 ${videoFitClassName} object-position-center w-full h-full`}
      />
    );

    let content = null;
    if (roomState === ConnectionState.Disconnected) {
      content = disconnectedContent;
    } else if (agentVideoTrack) {
      content = videoContent;
    } else {
      content = loadingContent;
    }

    return (
      <div className="flex flex-col w-full grow text-gray-950 bg-black rounded-sm border border-gray-800 relative">
        {content}
      </div>
    );
  }, [agentVideoTrack, config, roomState]);

  useEffect(() => {
    document.body.style.setProperty(
      "--lk-theme-color",
      // @ts-ignore
      tailwindTheme.colors[config.settings.theme_color]["500"]
    );
    document.body.style.setProperty(
      "--lk-drop-shadow",
      `var(--lk-theme-color) 0px 0px 18px`
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
          state={voiceAssistant.state}
          trackRef={voiceAssistant.audioTrack}
          barCount={5}
          options={{ minHeight: 20 }}
        />
      </div>
    );

    if (roomState === ConnectionState.Disconnected) {
      return disconnectedContent;
    }

    if (!voiceAssistant.audioTrack) {
      return waitingContent;
    }

    return visualizerContent;
  }, [
    voiceAssistant.audioTrack,
    config.settings.theme_color,
    roomState,
    voiceAssistant.state,
  ]);

  const chatTileContent = useMemo(() => {
    if (voiceAssistant.agent) {
      return (
        <TranscriptionTile
          agentAudioTrack={voiceAssistant.audioTrack}
          accentColor={config.settings.theme_color}
        />
      );
    }
    return <></>;
  }, [config.settings.theme_color, voiceAssistant.audioTrack, voiceAssistant.agent]);

  const handleRpcCall = useCallback(async () => {
    if (!voiceAssistant.agent || !room) return;
    
    try {
      const response = await room.localParticipant.performRpc({
        destinationIdentity: voiceAssistant.agent.identity,
        method: rpcMethod,
        payload: rpcPayload,
      });
      console.log('RPC response:', response);
    } catch (e) {
      console.error('RPC call failed:', e);
    }
  }, [room, rpcMethod, rpcPayload, voiceAssistant.agent]);

  const agentAttributes = useParticipantAttributes({ participant: voiceAssistant.agent });

  const settingsTileContent = useMemo(() => {
    return (
      <div className="flex flex-col h-full w-full items-start overflow-y-auto">
        {config.description && (
          <ConfigurationPanelItem title="Description">
            {config.description}
          </ConfigurationPanelItem>
        )}

        <ConfigurationPanelItem title="Connection settings">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">Optional settings for room connection.</p>
            <EditableNameValueRow
              name="Room name"
              value={roomState === ConnectionState.Connected ? name : config.settings.room_name}
              valueColor={`${config.settings.theme_color}-500`}
              onValueChange={(value) => {
                const newSettings = { ...config.settings };
                newSettings.room_name = value;
                setUserSettings(newSettings);
              }}
              placeholder="Auto"
              editable={roomState !== ConnectionState.Connected}
            />
            <EditableNameValueRow
              name="Participant identity"
              value={roomState === ConnectionState.Connected ? 
                (localParticipant?.identity || '') : 
                (config.settings.participant_name || '')}
              valueColor={`${config.settings.theme_color}-500`}
              onValueChange={(value) => {
                const newSettings = { ...config.settings };
                newSettings.participant_name = value;
                setUserSettings(newSettings);
              }}
              placeholder="Auto"
              editable={roomState !== ConnectionState.Connected}
            />
            <EditableNameValueRow
              name="Agent name"
              value={roomState === ConnectionState.Connected ? 
                (config.settings.agent_name || 'None') : 
                (config.settings.agent_name || '')}
              valueColor={`${config.settings.theme_color}-500`}
              onValueChange={(value) => {
                const newSettings = { ...config.settings };
                newSettings.agent_name = value;
                setUserSettings(newSettings);
              }}
              placeholder="None"
              editable={roomState !== ConnectionState.Connected}
            />
            <p className="text-xs text-gray-500 text-right">Enter an agent name to use <a href="https://docs.livekit.io/agents/worker/dispatch#explicit" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 underline">explicit dispatch</a>.</p>
          </div>
        </ConfigurationPanelItem>
        <ConfigurationPanelItem title="Status">
          <div className="flex flex-col gap-2">
            <NameValueRow
              name="Room"
              value={
                roomState === ConnectionState.Connecting ? (
                  <LoadingSVG diameter={16} strokeWidth={2} />
                ) : (
                  roomState.toUpperCase()
                )
              }
              valueColor={
                roomState === ConnectionState.Connected
                  ? `${config.settings.theme_color}-500`
                  : "gray-500"
              }
            />
            <NameValueRow
              name="Agent"
              value={
                voiceAssistant.agent ? (
                  "CONNECTED"
                ) : roomState === ConnectionState.Connected ? (
                  <LoadingSVG diameter={12} strokeWidth={2} />
                ) : (
                  "DISCONNECTED"
                )
              }
              valueColor={
                voiceAssistant.agent
                  ? `${config.settings.theme_color}-500`
                  : "gray-500"
              }
            />
          </div>
        </ConfigurationPanelItem>
        {roomState === ConnectionState.Connected && voiceAssistant.agent && (
          <ConfigurationPanelItem 
            title="Agent Attributes" 
            collapsible={true} 
            defaultCollapsed={true}
          >
            <p className="text-xs text-gray-500">The <a href="https://docs.livekit.io/home/client/state/participant-attributes" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 underline">participant attributes</a> set on the agent.</p>
            <pre className="text-xs bg-gray-900 mt-2 p-2 rounded-sm overflow-auto max-h-48">{JSON.stringify(agentAttributes.attributes, null, 2)}</pre>
          </ConfigurationPanelItem>
        )}
        {roomState === ConnectionState.Connected && config.settings.inputs.screen && (
          <ConfigurationPanelItem
            title="Screen"
            source={Track.Source.ScreenShare}
          >
            {localScreenTrack ? (
              <div className="relative">
                <VideoTrack
                  className="rounded-sm border border-gray-800 opacity-70 w-full"
                  trackRef={localScreenTrack}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-700 text-center w-full h-full">
                Press the button above to share your screen.
              </div>
            )}
          </ConfigurationPanelItem>
        )}
        {roomState === ConnectionState.Connected && voiceAssistant.agent && (
          <ConfigurationPanelItem 
            title="RPC" 
            collapsible={true} 
            defaultCollapsed={true}
          >
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500">Perform an <a href="https://docs.livekit.io/home/client/data/rpc/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 underline">RPC call</a> on the agent.</p>
              <div className="text-xs text-gray-500 mt-2">Method Name</div>
              <input
                type="text"
                value={rpcMethod}
                onChange={(e) => setRpcMethod(e.target.value)}
                className="w-full text-white text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-2"
                placeholder="my_method"
              />
              
              <div className="text-xs text-gray-500 mt-2">Payload</div>
              <textarea
                value={rpcPayload}
                onChange={(e) => setRpcPayload(e.target.value)}
                className="w-full text-white text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-2"
                placeholder='{"my": "payload"}'
                rows={2}
              />
              
              <button
                onClick={handleRpcCall}
                disabled={!rpcMethod}
                className={`mt-2 px-2 py-1 rounded-sm text-xs 
                  ${rpcMethod 
                    ? `bg-${config.settings.theme_color}-500 hover:bg-${config.settings.theme_color}-600` 
                    : 'bg-gray-700 cursor-not-allowed'
                  } text-white`}
              >
                Perform RPC
              </button>
            </div>
          </ConfigurationPanelItem>
        )}
        {localCameraTrack && (
          <ConfigurationPanelItem
            title="Camera"
            source={Track.Source.Camera}
          >
            <div className="relative">
              <VideoTrack
                className="rounded-sm border border-gray-800 opacity-70 w-full"
                trackRef={localCameraTrack}
              />
            </div>
          </ConfigurationPanelItem>
        )}
        {localMicTrack && (
          <ConfigurationPanelItem
            title="Microphone"
            source={Track.Source.Microphone}
          >
            <AudioInputTile trackRef={localMicTrack} />
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
    config.description,
    config.settings,
    config.show_qr,
    localParticipant,
    name,
    roomState,
    localCameraTrack,
    localScreenTrack,
    localMicTrack,
    themeColors,
    setUserSettings,
    voiceAssistant.agent,
    rpcMethod,
    rpcPayload,
    handleRpcCall,
    showRpc,
    setShowRpc,
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
    <>
      <PlaygroundHeader
        title={config.title}
        logo={logo}
        githubLink={config.github_link}
        height={headerHeight}
        accentColor={config.settings.theme_color}
        connectionState={roomState}
        onConnectClicked={() =>
          onConnect(roomState === ConnectionState.Disconnected)
        }
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
    </>
  );
}
