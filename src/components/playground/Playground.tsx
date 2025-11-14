"use client";

import { ChatMessageType, ChatTile } from "@/components/chat/ChatTile";
import { AudioInputTile } from "@/components/config/AudioInputTile";
import { ConfigurationPanelItem } from "@/components/config/ConfigurationPanelItem";
import { NameValueRow } from "@/components/config/NameValueRow";
import { PlaygroundHeader } from "@/components/playground/PlaygroundHeader";
import {
  PlaygroundTab,
  PlaygroundTabbedTile,
  PlaygroundTile,
} from "@/components/playground/PlaygroundTile";
import { AgentMultibandAudioVisualizer } from "@/components/visualization/AgentMultibandAudioVisualizer";
import { useConfig } from "@/hooks/useConfig";
import { useMultibandTrackVolume } from "@/hooks/useTrackVolume";
import { TranscriptionTile } from "@/transcriptions/TranscriptionTile";
import {
  VideoTrack,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomInfo,
  useTracks,
} from "@livekit/components-react";
import {
  ConnectionState,
  LocalParticipant,
  RoomEvent,
  Track,
} from "livekit-client";
import { QRCodeSVG } from "qrcode.react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { PlaygroundFooter } from "./PlaygroundFooter";
import { SettingValue } from "@/hooks/useSettings";
import { CameraOffIcon, ChatText, VideoOffIcon } from "./icons";
import DisconnectedPill from "./DisconnectedPill";
import ConnectingPill from "./ConnectingPill";

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
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [transcripts, setTranscripts] = useState<ChatMessageType[]>([]);
  const { localParticipant } = useLocalParticipant();

  const participants = useRemoteParticipants({
    updateOnlyOn: [RoomEvent.ParticipantMetadataChanged],
  });
  const agentParticipant = participants.find((p) => p.isAgent);
  const isAgentConnected = agentParticipant !== undefined;

  const roomState = useConnectionState();
  const tracks = useTracks();

  useEffect(() => {
    if (roomState === ConnectionState.Connected) {
      localParticipant.setCameraEnabled(config.settings.inputs.camera);
      localParticipant.setMicrophoneEnabled(config.settings.inputs.mic);
    }
  }, [config, localParticipant, roomState]);

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

  const isEnabled = (setting: SettingValue) => {
    if (setting.type === "separator" || setting.type === "theme_color")
      return false;
    if (setting.type === "chat" || setting.type === "room") {
      return config.settings[setting.type];
    }

    if (setting.type === "inputs") {
      const key = setting.key as "camera" | "mic";
      return config.settings.inputs[key];
    } else if (setting.type === "outputs") {
      const key = setting.key as "video" | "audio";
      return config.settings.outputs[key];
    }

    return false;
  };

  const toggleSetting = (setting: SettingValue) => {
    if (setting.type === "separator" || setting.type === "theme_color") return;
    const newValue = !isEnabled(setting);
    const newSettings = { ...config.settings };

    if (setting.type === "chat") {
      newSettings.chat = newValue;
    } else if (setting.type === "inputs") {
      newSettings.inputs[setting.key as "camera" | "mic"] = newValue;
    } else if (setting.type === "outputs") {
      newSettings.outputs[setting.key as "video" | "audio"] = newValue;
    } else if (setting.type === "room") {
      newSettings.room = newValue;
    }
    setUserSettings(newSettings);
  };

  const videoTileContent = useMemo(() => {
    const videoFitClassName = `object-${config.video_fit || "cover"}`;

    const disconnectedContent = (
      <DisconnectedPill
        icon={<VideoOffIcon />}
        prefix="No Video"
        title="to get started."
      />
    );

    const loadingContent = (
      <ConnectingPill icon={<VideoOffIcon />} title="Connecting to video..." />
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

    return <div className="flex flex-col">{content}</div>;
  }, [agentVideoTrack, config, roomState]);

  const audioTileContent = useMemo(() => {
    const disconnectedContent = (
      <DisconnectedPill
        icon={<CameraOffIcon />}
        prefix="No audio"
        title="to get started."
      />
    );

    const waitingContent = (
      <ConnectingPill icon={<CameraOffIcon />} title="Connecting to audio..." />
    );

    // TODO: keep it in the speaking state until we come up with a better protocol for agent states
    const visualizerContent = (
      <div className="flex items-center justify-center w-full">
        <AgentMultibandAudioVisualizer
          state="speaking"
          barWidth={30}
          minBarHeight={30}
          maxBarHeight={150}
          accentColor={config.settings.theme_color}
          accentShade={500}
          frequencies={subscribedVolumes}
          borderRadius={12}
          gap={16}
        />
      </div>
    );

    if (roomState === ConnectionState.Disconnected) {
      return <div className="flex flex-col">{disconnectedContent}</div>;
    }

    if (!agentAudioTrack) {
      return <div className="flex flex-col">{waitingContent}</div>;
    }

    return visualizerContent;
  }, [
    agentAudioTrack,
    config.settings.theme_color,
    subscribedVolumes,
    roomState,
  ]);

  const chatTileContent = useMemo(() => {
    const disconnectedContent = (
      <DisconnectedPill
        icon={<ChatText />}
        showSeparator={false}
        title="to start sending messages."
      />
    );
    if (roomState === ConnectionState.Disconnected) {
      return <div className="flex flex-col">{disconnectedContent}</div>;
    }

    const waitingContent = (
      <ConnectingPill icon={<ChatText />} title="Connecting to messages..." />
    );

    if (!agentAudioTrack) {
      return <div className="flex flex-col">{waitingContent}</div>;
    }

    if (agentAudioTrack) {
      return (
        <TranscriptionTile
          agentAudioTrack={agentAudioTrack}
          accentColor={config.settings.theme_color}
        />
      );
    }

    return <></>;
  }, [config.settings.theme_color, agentAudioTrack, roomState]);

  const settingsTileContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4 h-full w-full items-start overflow-y-auto">
        {config.description && (
          <ConfigurationPanelItem title="">
            {config.description}
          </ConfigurationPanelItem>
        )}

        <ConfigurationPanelItem title="">
          {localParticipant && (
            <div className="flex flex-col gap-2">
              <NameValueRow
                name="Room"
                value={name}
                roomState={roomState}
                valueColor={`${config.settings.theme_color}-500`}
              />
              <NameValueRow
                name="Participant"
                roomState={roomState}
                value={localParticipant.identity}
              />
            </div>
          )}
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
            <AudioInputTile
              frequencies={localMultibandVolume}
              accentColor={config.settings.theme_color}
            />
          </ConfigurationPanelItem>
        )}
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
    isAgentConnected,
    localVideoTrack,
    localMicTrack,
    localMultibandVolume,
    //themeColors,
    //setUserSettings,
  ]);

  let mobileTabs: PlaygroundTab[] = [];
  if (config.settings.outputs.video) {
    mobileTabs.push({
      title: "Video",
      content: (
        <PlaygroundTile
          toggleSetting={toggleSetting}
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
          toggleSetting={toggleSetting}
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
      title: "Messages",
      content: (
        <PlaygroundTile
          toggleSetting={toggleSetting}
          className="w-full h-full grow"
          childrenClassName="justify-center"
        >
          {chatTileContent}
        </PlaygroundTile>
      ),
    });
  }

  mobileTabs.push({
    title: "Settings",
    content: (
      <PlaygroundTile
        toggleSetting={toggleSetting}
        padding={false}
        className="h-full w-full basis-1/4 items-start overflow-y-auto flex max-lg:hidden"
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
        height={headerHeight}
        accentColor={config.settings.theme_color}
      />
      <div
        className={`flex gap-1 grow w-full selection:bg-${config.settings.theme_color}-900`}
        style={{ height: `calc(100% - ${headerHeight}px)` }}
      >
        <div className="flex flex-col grow basis-1/2 gap-4 h-full lg:hidden">
          <PlaygroundTabbedTile
            toggleSetting={toggleSetting}
            className="h-full"
            tabs={mobileTabs}
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
              toggleSetting={toggleSetting}
              title="Video"
              className="w-full h-full grow"
              childrenClassName="justify-center"
            >
              {videoTileContent}
            </PlaygroundTile>
          )}
          {config.settings.outputs.audio && (
            <PlaygroundTile
              toggleSetting={toggleSetting}
              title="Audio"
              className="w-full h-full grow"
              childrenClassName="justify-center"
            >
              {audioTileContent}
            </PlaygroundTile>
          )}
        </div>

        {config.settings.chat && (
          <PlaygroundTile
            toggleSetting={toggleSetting}
            title="Messages"
            className="h-full grow basis-1/4 hidden lg:flex"
            childrenClassName="justify-center"
            backgroundColor="skin-fill-alternate"
          >
            {chatTileContent}
          </PlaygroundTile>
        )}
        {config.settings.room && (
          <PlaygroundTile
            toggleSetting={toggleSetting}
            title="Room Details"
            padding={false}
            className="h-full w-full basis-1/4 lg:flex overflow-y-auto hidden"
            backgroundColor="skin-fill-alternate"
          >
            {settingsTileContent}
          </PlaygroundTile>
        )}
      </div>
      <PlaygroundFooter
        height={headerHeight}
        accentColor={config.settings.theme_color}
        connectionState={roomState}
        onConnectClicked={() =>
          onConnect(roomState === ConnectionState.Disconnected)
        }
        isEnabled={isEnabled}
        toggleSetting={toggleSetting}
      />
    </>
  );
}
