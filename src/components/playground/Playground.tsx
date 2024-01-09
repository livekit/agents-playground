"use client";

import {
  VideoTrack,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import {
  ConnectionState,
  DataPacket_Kind,
  LocalParticipant,
  Track,
} from "livekit-client";
import { ColorPicker } from "@/components/colorPicker/ColorPicker";
import { ConfigurationPanelItem } from "@/components/config/ConfigurationPanelItem";
import { LoadingSVG } from "@/components/button/LoadingSVG";
import { NameValueRow } from "@/components/config/NameValueRow";
import { PlaygroundHeader } from "@/components/playground/PlaygroundHeader";
import {
  PlaygroundTab,
  PlaygroundTabbedTile,
  PlaygroundTile,
} from "@/components/playground/PlaygroundTile";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useMultibandTrackVolume } from "@/hooks/useTrackVolume";
import { QRCodeSVG } from "qrcode.react";
import { AudioInputTile } from "@/components/config/AudioInputTile";
import { ChatMessageType, ChatTile } from "@/components/chat/ChatTile";
import { AgentMultibandAudioVisualizer } from "@/components/visualization/AgentMultibandAudioVisualizer";

export enum PlaygroundOutputs {
  Video,
  Audio,
  Chat,
}

export interface PlaygroundProps {
  logo?: ReactNode;
  title?: string;
  githubLink?: string;
  description?: ReactNode;
  themeColors: string[];
  defaultColor: string;
  outputs?: PlaygroundOutputs[];
  showQR?: boolean;
  onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
  metadata?: { name: string; value: string }[];
}

const headerHeight = 56;

export default function Playground({
  logo,
  title,
  githubLink,
  description,
  outputs,
  showQR,
  themeColors,
  defaultColor,
  onConnect,
  metadata,
}: PlaygroundProps) {
  const [agentState, setAgentState] = useState<
    "listening" | "speaking" | "thinking" | "offline"
  >("offline");

  const [userState, setUserState] = useState<"silent" | "speaking">("silent");
  const [themeColor, setThemeColor] = useState(defaultColor);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const localParticipant = useLocalParticipant();
  const roomContext = useRoomContext();
  const visualizerState = useMemo(() => {
    if (agentState === "thinking") {
      return "thinking";
    } else if (agentState === "speaking") {
      return "talking";
    }
    return "idle";
  }, [agentState]);

  const roomState = useConnectionState();
  const tracks = useTracks();

  const agentAudioTrack = tracks.find(
    (trackRef) =>
      trackRef.publication.kind === Track.Kind.Audio &&
      trackRef.participant.isAgent
  );

  const agentVideoTrack = tracks.find(
    (trackRef) =>
      trackRef.publication.kind === Track.Kind.Video &&
      trackRef.participant.isAgent
  );

  const subscribedVolumes = useMultibandTrackVolume(
    agentAudioTrack?.publication.track,
    5
  );

  const localTracks = tracks.filter(
    ({ participant }) => participant instanceof LocalParticipant
  );
  const localVideoTrack = localTracks.find(
    ({ source }) => source === Track.Source.Camera
  );
  const localMicTrack = localTracks.find(
    ({ source }) => source === Track.Source.Microphone
  );

  const localMultibandVolume = useMultibandTrackVolume(
    localMicTrack?.publication.track,
    20
  );

  const isAgentConnected = !!useRemoteParticipants().find((p) => p.isAgent);

  useEffect(() => {
    if (isAgentConnected && agentState === "offline") {
      setAgentState("listening");
    } else if (!isAgentConnected) {
      setAgentState("offline");
    }
  }, [isAgentConnected, agentState]);

  const onDataReceived = useCallback(
    (msg: any) => {
      const decoded = JSON.parse(new TextDecoder("utf-8").decode(msg.payload));
      if (decoded.type === "state") {
        const { agent_state, user_state } = decoded;
        setAgentState(agent_state);
        setUserState(user_state);
      } else if (decoded.type === "transcription") {
        setMessages([
          ...messages,
          { name: "You", message: decoded.text, isSelf: true },
        ]);
      } else if (decoded.type === "agent_chat_message") {
        setMessages([
          ...messages,
          { name: "Agent", message: decoded.text, isSelf: false },
        ]);
      }
      console.log("data received", decoded, msg.from);
    },
    [messages]
  );

  useDataChannel(onDataReceived);

  const videoTileContent = useMemo(() => {
    return (
      <div className="flex flex-col w-full grow text-gray-950 bg-black rounded-sm border border-gray-800 relative">
        {agentVideoTrack ? (
          <VideoTrack
            trackRef={agentVideoTrack}
            className="absolute top-1/2 -translate-y-1/2 object-cover object-position-center w-full h-full"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-gray-700 text-center h-full w-full">
            <LoadingSVG />
            Waiting for video track
          </div>
        )}
      </div>
    );
  }, [agentVideoTrack]);

  const audioTileContent = useMemo(() => {
    return (
      <div className="flex items-center justify-center w-full">
        {agentAudioTrack ? (
          <AgentMultibandAudioVisualizer
            state={agentState}
            barWidth={30}
            minBarHeight={30}
            maxBarHeight={150}
            accentColor={themeColor}
            accentShade={500}
            frequencies={subscribedVolumes}
            borderRadius={12}
            gap={16}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-700 text-center w-full">
            <LoadingSVG />
            Waiting for audio track
          </div>
        )}
      </div>
    );
  }, [agentAudioTrack, subscribedVolumes, themeColor, agentState]);

  const chatTileContent = useMemo(() => {
    return (
      <ChatTile
        messages={messages}
        accentColor={themeColor}
        onSend={(message) => {
          if (roomContext.state === ConnectionState.Disconnected) {
            return;
          }
          setMessages([
            ...messages,
            { name: "You", message: message, isSelf: true },
          ]);
          const data = {
            type: "user_chat_message",
            text: message,
          };
          const encoder = new TextEncoder();
          localParticipant.localParticipant?.publishData(
            encoder.encode(JSON.stringify(data)),
            DataPacket_Kind.RELIABLE
          );
        }}
      />
    );
  }, [
    localParticipant.localParticipant,
    messages,
    roomContext.state,
    themeColor,
  ]);

  const settingsTileContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4 h-full w-full items-start overflow-y-auto">
        {description && (
          <ConfigurationPanelItem title="Description">
            {description}
          </ConfigurationPanelItem>
        )}

        <ConfigurationPanelItem title="Settings">
          <div className="flex flex-col gap-2">
            <NameValueRow
              name="Agent URL"
              value={process.env.NEXT_PUBLIC_LIVEKIT_URL}
            />
            {metadata?.map((data, index) => (
              <NameValueRow
                key={data.name + index}
                name={data.name}
                value={data.value}
              />
            ))}
          </div>
        </ConfigurationPanelItem>
        <ConfigurationPanelItem title="Status">
          <div className="flex flex-col gap-2">
            <NameValueRow
              name="Room connected"
              value={
                roomState === ConnectionState.Connecting ? (
                  <LoadingSVG diameter={16} strokeWidth={2} />
                ) : (
                  roomState
                )
              }
              valueColor={
                roomState === ConnectionState.Connected
                  ? `${themeColor}-500`
                  : "gray-500"
              }
            />
            <NameValueRow
              name="Agent connected"
              value={
                isAgentConnected ? (
                  "true"
                ) : roomState === ConnectionState.Connected ? (
                  <LoadingSVG diameter={12} strokeWidth={2} />
                ) : (
                  "false"
                )
              }
              valueColor={isAgentConnected ? `${themeColor}-500` : "gray-500"}
            />
            <NameValueRow
              name="Agent status"
              value={
                agentState !== "offline" && agentState !== "speaking" ? (
                  <div className="flex gap-2 items-center">
                    <LoadingSVG diameter={12} strokeWidth={2} />
                    {agentState}
                  </div>
                ) : (
                  agentState
                )
              }
              valueColor={
                agentState === "speaking" ? `${themeColor}-500` : "gray-500"
              }
            />
            <NameValueRow
              name="User status"
              value={userState}
              valueColor={
                userState === "silent" ? "gray-500" : `${themeColor}-500`
              }
            />
          </div>
        </ConfigurationPanelItem>
        {localVideoTrack && (
          <ConfigurationPanelItem
            title="Camera"
            deviceSelectorKind="videoinput"
          >
            <div className="relative">
              <VideoTrack
                className="rounded-sm border border-gray-800 opacity-70 w-full"
                trackRef={localVideoTrack}
              />
            </div>
          </ConfigurationPanelItem>
        )}
        {localMicTrack && (
          <ConfigurationPanelItem
            title="Microphone"
            deviceSelectorKind="audioinput"
          >
            <AudioInputTile frequencies={localMultibandVolume} />
          </ConfigurationPanelItem>
        )}
        <div className="w-full">
          <ConfigurationPanelItem title="Color">
            <ColorPicker
              colors={themeColors}
              selectedColor={themeColor}
              onSelect={(color) => {
                setThemeColor(color);
              }}
            />
          </ConfigurationPanelItem>
        </div>
        {showQR && (
          <div className="w-full">
            <ConfigurationPanelItem title="QR Code">
              <QRCodeSVG value={window.location.href} width="128" />
            </ConfigurationPanelItem>
          </div>
        )}
      </div>
    );
  }, [
    agentState,
    description,
    isAgentConnected,
    localMicTrack,
    localMultibandVolume,
    localVideoTrack,
    metadata,
    roomState,
    themeColor,
    themeColors,
    userState,
    showQR,
  ]);

  let mobileTabs: PlaygroundTab[] = [];
  if (outputs?.includes(PlaygroundOutputs.Video)) {
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

  if (outputs?.includes(PlaygroundOutputs.Audio)) {
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

  if (outputs?.includes(PlaygroundOutputs.Chat)) {
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
        title={title}
        logo={logo}
        githubLink={githubLink}
        height={headerHeight}
        accentColor={themeColor}
        connectionState={roomState}
        onConnectClicked={() =>
          onConnect(roomState === ConnectionState.Disconnected)
        }
      />
      <div
        className={`flex gap-4 py-4 grow w-full selection:bg-${themeColor}-900`}
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
            !outputs?.includes(PlaygroundOutputs.Audio) &&
            !outputs?.includes(PlaygroundOutputs.Video)
              ? "hidden"
              : "flex"
          }`}
        >
          {outputs?.includes(PlaygroundOutputs.Video) && (
            <PlaygroundTile
              title="Video"
              className="w-full h-full grow"
              childrenClassName="justify-center"
            >
              {videoTileContent}
            </PlaygroundTile>
          )}
          {outputs?.includes(PlaygroundOutputs.Audio) && (
            <PlaygroundTile
              title="Audio"
              className="w-full h-full grow"
              childrenClassName="justify-center"
            >
              {audioTileContent}
            </PlaygroundTile>
          )}
        </div>

        {outputs?.includes(PlaygroundOutputs.Chat) && (
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
