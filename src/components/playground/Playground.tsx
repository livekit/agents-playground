"use client";

import { LoadingSVG } from "@/components/button/LoadingSVG";
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
} from "@livekit/components-react";
import { ConnectionState, LocalParticipant, Track } from "livekit-client";
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

export type SystemPromptLog = {
    prompt: string;
    timestamp: number;
};
export interface AgentActualState {
    agent_experience?: string;
    [key: string]: any;
}
export interface AgentStateLogEntry {
    state: AgentActualState;
    timestamp: number;
}

const headerHeight = 56;
const logDetailHeaderHeight = "h-10"; // Approx 40px for the fixed header in log details

export default function Playground({
                                       logo,
                                       themeColors,
                                       onConnect,
                                   }: PlaygroundProps) {
    const { config, setUserSettings } = useConfig();
    const { name } = useRoomInfo();
    const [systemPromptLogs, setSystemPromptLogs] = useState<SystemPromptLog[]>([]);
    const [agentStateLogs, setAgentStateLogs] = useState<AgentStateLogEntry[]>([]);
    const hookLpData = useLocalParticipant();

    const [selectedSystemPrompt, setSelectedSystemPrompt] = useState<SystemPromptLog | null>(null);
    const [selectedAgentState, setSelectedAgentState] = useState<AgentStateLogEntry | null>(null);

    const voiceAssistant = useVoiceAssistant();

    const roomState = useConnectionState();
    const tracks = useTracks();
    const room = useRoomContext();

    const [rpcMethod, setRpcMethod] = useState("");
    const [rpcPayload, setRpcPayload] = useState("");

    useEffect(() => {
        if (roomState === ConnectionState.Connected) {
            hookLpData.localParticipant.setCameraEnabled(config.settings.inputs.camera);
            hookLpData.localParticipant.setMicrophoneEnabled(config.settings.inputs.mic);
        }
    }, [config.settings.inputs.camera, config.settings.inputs.mic, hookLpData.localParticipant, roomState]);

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
            if (msg.topic === "system_prompt") {
                const promptText = new TextDecoder("utf-8").decode(msg.payload);
                let timestamp = new Date().getTime();
                const newLog: SystemPromptLog = { prompt: promptText, timestamp: timestamp };
                setSystemPromptLogs((prevPrompts) => [...prevPrompts, newLog]);
            } else if (msg.topic === "agent_state") {
                try {
                    const decodedState = JSON.parse(
                        new TextDecoder("utf-8").decode(msg.payload)
                    ) as AgentActualState;
                    const timestamp = new Date().getTime();
                    const newLog: AgentStateLogEntry = { state: decodedState, timestamp: timestamp };
                    setAgentStateLogs((prevLogs) => [...prevLogs, newLog]);
                } catch (error) {
                    console.error("Error decoding agent state:", error, msg.payload);
                }
            }
        },
        []
    );

    useDataChannel(onDataReceived);

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
                No audio track. Connect to get started.
            </div>
        );
        const waitingContent = (
            <div className="flex flex-col items-center gap-2 text-gray-700 text-center w-full">
                <LoadingSVG /> Waiting for audio track
            </div>
        );
        const visualizerContent = (
            <div
                className={`flex flex-col items-center justify-center w-full h-48 [--lk-va-bar-width:30px] [--lk-va-bar-gap:20px] [--lk-fg:var(--lk-theme-color)]`}
            >
                <BarVisualizer state={voiceAssistant.state} trackRef={voiceAssistant.audioTrack} barCount={5} options={{ minHeight: 20 }} />
                {voiceAssistant.audioTrack && (<div className="text-white text-center mt-2 text-sm">{voiceAssistant.state.toUpperCase()}</div>)}
            </div>
        );
        if (roomState === ConnectionState.Disconnected) return disconnectedContent;
        if (!voiceAssistant.audioTrack) return waitingContent;
        return visualizerContent;
    }, [voiceAssistant.audioTrack, roomState, voiceAssistant.state]);

    const handleSystemPromptSelect = useCallback((log: SystemPromptLog) => {
        setSelectedSystemPrompt(log);
        setSelectedAgentState(null);
    }, []);

    const handleAgentStateSelect = useCallback((log: AgentStateLogEntry) => {
        setSelectedAgentState(log);
        setSelectedSystemPrompt(null);
    }, []);

    const showLatestSystemPrompt = useCallback(() => setSelectedSystemPrompt(null), []);
    const showLatestAgentState = useCallback(() => setSelectedAgentState(null), []);


    const chatTileContent = useMemo(() => {
        if (voiceAssistant.agent || roomState === ConnectionState.Connected) {
            return (
                <TranscriptionTile
                    agentAudioTrack={voiceAssistant.audioTrack}
                    accentColor={config.settings.theme_color}
                    systemPromptLogs={systemPromptLogs}
                    agentStateLogs={agentStateLogs}
                    onSystemPromptSelect={handleSystemPromptSelect}
                    onAgentStateSelect={handleAgentStateSelect}
                />
            );
        }
        return <div className="flex items-center justify-center h-full text-gray-500">Connect to chat.</div>;
    }, [
        config.settings.theme_color,
        voiceAssistant.audioTrack,
        voiceAssistant.agent,
        systemPromptLogs,
        agentStateLogs,
        handleSystemPromptSelect,
        handleAgentStateSelect,
        roomState
    ]);

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

    const settingsTileContent = useMemo(() => {
        return (
            <div className="flex flex-col gap-4 h-full w-full items-start overflow-y-auto">
                <ConfigurationPanelItem title="Settings">
                    <div className="flex flex-col gap-4">
                        <EditableNameValueRow name="Room" value={roomState === ConnectionState.Connected ? name : config.settings.room_name} valueColor={`${config.settings.theme_color}-500`} onValueChange={(value) => setUserSettings({ ...config.settings, room_name: value })} editable={false} />
                        <EditableNameValueRow name="Participant" value={roomState === ConnectionState.Connected ? (hookLpData.localParticipant?.identity || '') : (config.settings.participant_name || '')} valueColor={`${config.settings.theme_color}-500`} onValueChange={(value) => setUserSettings({ ...config.settings, participant_name: value })} placeholder="Enter participant id" editable={roomState !== ConnectionState.Connected} />
                    </div>
                </ConfigurationPanelItem>
                <ConfigurationPanelItem title="RPC Call" collapsible={true} initialCollapsed={true}>
                    <div className="flex flex-col gap-2 mt-0">
                        <div className="text-xs text-gray-500 mt-2">RPC Method</div>
                        <input type="text" value={rpcMethod} onChange={(e) => setRpcMethod(e.target.value)} className="w-full text-white text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-2" placeholder="RPC method name" />
                        <div className="text-xs text-gray-500 mt-2">RPC Payload</div>
                        <textarea value={rpcPayload} onChange={(e) => setRpcPayload(e.target.value)} className="w-full text-white text-sm bg-transparent border border-gray-800 rounded-sm px-3 py-2" placeholder="RPC payload (JSON string)" rows={3} />
                        <button onClick={handleRpcCall} disabled={!voiceAssistant.agent || !rpcMethod} className={`mt-2 px-3 py-1.5 rounded-sm text-xs ${voiceAssistant.agent && rpcMethod ? `bg-${config.settings.theme_color}-500 hover:bg-${config.settings.theme_color}-600` : 'bg-gray-700 cursor-not-allowed'} text-white self-start`}>Perform RPC Call</button>
                    </div>
                </ConfigurationPanelItem>
                <ConfigurationPanelItem title="Status">
                    <div className="flex flex-col gap-2">
                        <NameValueRow name="Room connected" value={roomState === ConnectionState.Connecting ? (<LoadingSVG diameter={16} strokeWidth={2} />) : (roomState.toUpperCase())} valueColor={roomState === ConnectionState.Connected ? `${config.settings.theme_color}-500` : "gray-500"} />
                        <NameValueRow name="Agent connected" value={voiceAssistant.agent ? ("TRUE") : roomState === ConnectionState.Connected ? (<LoadingSVG diameter={12} strokeWidth={2} />) : ("FALSE")} valueColor={voiceAssistant.agent ? `${config.settings.theme_color}-500` : "gray-500"} />
                    </div>
                </ConfigurationPanelItem>
                {roomState === ConnectionState.Connected && config.settings.inputs.screen && (<ConfigurationPanelItem title="Screen" source={Track.Source.ScreenShare}>{localScreenTrack ? (<div className="relative"><VideoTrack className="rounded-sm border border-gray-800 opacity-70 w-full" trackRef={localScreenTrack} /></div>) : (<div className="flex items-center justify-center text-gray-700 text-center w-full h-full">Press the button above to share your screen.</div>)}</ConfigurationPanelItem>)}
                {localCameraTrack && (<ConfigurationPanelItem title="Camera" source={Track.Source.Camera}><div className="relative"><VideoTrack className="rounded-sm border border-gray-800 opacity-70 w-full" trackRef={localCameraTrack} /></div></ConfigurationPanelItem>)}
                {localMicTrack && (<ConfigurationPanelItem title="Microphone" source={Track.Source.Microphone}><AudioInputTile trackRef={localMicTrack} /></ConfigurationPanelItem>)}
            </div>
        );
    }, [config.settings, hookLpData.localParticipant, name, roomState, localCameraTrack, localScreenTrack, localMicTrack, setUserSettings, voiceAssistant.agent, rpcMethod, rpcPayload, handleRpcCall]);

    const latestSystemPrompt = systemPromptLogs.length > 0 ? systemPromptLogs[systemPromptLogs.length - 1] : null;
    const systemPromptToDisplay = selectedSystemPrompt ?? latestSystemPrompt;
    // Show button if a prompt is selected AND that selected prompt is not the latest one available.
    const showSystemPromptLatestButton = selectedSystemPrompt && latestSystemPrompt && selectedSystemPrompt.timestamp !== latestSystemPrompt.timestamp;

    const latestAgentState = agentStateLogs.length > 0 ? agentStateLogs[agentStateLogs.length - 1] : null;
    const agentStateToDisplay = selectedAgentState ?? latestAgentState;
    // Show button if a state is selected AND that selected state is not the latest one available.
    const showAgentStateLatestButton = selectedAgentState && latestAgentState && selectedAgentState.timestamp !== latestAgentState.timestamp;


    const renderLogDetailContent = (
        logItem: SystemPromptLog | AgentStateLogEntry | null,
        type: 'system' | 'agent',
        showLatestButton: boolean,
        showLatestCallback: () => void
    ) => {
        if (!logItem) {
            return <div className="flex items-center justify-center h-full text-gray-500 p-2">No {type === 'system' ? 'system prompts' : 'agent state logs'} available.</div>;
        }
        return (
            <div className="flex flex-col h-full">
                <div className={`flex-shrink-0 ${logDetailHeaderHeight} px-2 py-1 flex justify-between items-center border-b border-gray-800`}>
                    <div className="text-xs text-gray-400 font-semibold">
                        Timestamp: {new Date(logItem.timestamp).toLocaleString()}
                    </div>
                    {showLatestButton && (
                        <button onClick={showLatestCallback} className={`text-xs bg-${config.settings.theme_color}-600 hover:bg-${config.settings.theme_color}-700 text-white px-2 py-1 rounded`}>
                            Show Latest
                        </button>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto p-2">
                <pre className="whitespace-pre-wrap text-xs text-gray-300 bg-gray-800 p-2 rounded">
                    {type === 'system' ? (logItem as SystemPromptLog).prompt : JSON.stringify((logItem as AgentStateLogEntry).state, null, 2)}
                </pre>
                </div>
            </div>
        );
    };


    let mobileTabs: PlaygroundTab[] = [];
    if (config.settings.outputs.audio) mobileTabs.push({ title: "Audio", content: (<PlaygroundTile className="w-full h-full grow" childrenClassName="justify-center">{audioTileContent}</PlaygroundTile>) });
    if (config.settings.chat) mobileTabs.push({ title: "Chat", content: chatTileContent });

    mobileTabs.push({
        title: "System Prompt",
        content: (
            <PlaygroundTile className="w-full h-full grow" padding={false} childrenClassName="h-full">
                {renderLogDetailContent(systemPromptToDisplay, 'system', showSystemPromptLatestButton, showLatestSystemPrompt)}
            </PlaygroundTile>
        ),
    });
    mobileTabs.push({
        title: "Agent State",
        content: (
            <PlaygroundTile className="w-full h-full grow" padding={false} childrenClassName="h-full">
                {renderLogDetailContent(agentStateToDisplay, 'agent', showAgentStateLatestButton, showLatestAgentState)}
            </PlaygroundTile>
        ),
    });
    mobileTabs.push({ title: "Settings", content: (<PlaygroundTile padding={false} backgroundColor="gray-950" className="h-full w-full basis-1/4 items-start overflow-y-auto flex" childrenClassName="h-full grow items-start">{settingsTileContent}</PlaygroundTile>) });

    return (
        <>
            <PlaygroundHeader title={config.title} logo={logo} githubLink={config.github_link} height={headerHeight} accentColor={config.settings.theme_color} connectionState={roomState} onConnectClicked={() => onConnect(roomState === ConnectionState.Disconnected)} />
            <div className={`flex gap-4 py-4 grow w-full selection:bg-${config.settings.theme_color}-900`} style={{ height: `calc(100% - ${headerHeight}px)` }}>
                <div className="flex flex-col grow basis-1/2 gap-4 h-full lg:hidden">
                    <PlaygroundTabbedTile className="h-full" tabs={mobileTabs} initialTab={0} />
                </div>

                <div className={`flex-col grow basis-1/2 gap-4 h-full hidden lg:flex overflow-y-auto ${!config.settings.outputs.audio && !config.settings.outputs.video ? "hidden" : "flex"}`}>
                    <div className="flex gap-4 w-full">
                        {config.settings.outputs.audio && (
                            <PlaygroundTile title="Audio" className="w-1/2" childrenClassName="justify-center">
                                {audioTileContent}
                            </PlaygroundTile>
                        )}
                        <PlaygroundTile title="Agent State Detail" className="w-1/2 flex-shrink-0 max-h-60" padding={false} childrenClassName="h-full"> {/* max-h-60 applied here */}
                            {renderLogDetailContent(agentStateToDisplay, 'agent', showAgentStateLatestButton, showLatestAgentState)}
                        </PlaygroundTile>
                    </div>

                    <PlaygroundTile title="System Prompt Detail" className="w-full flex-shrink-0 max-h-60" padding={false} childrenClassName="h-full"> {/* max-h-60 applied here */}
                        {renderLogDetailContent(systemPromptToDisplay, 'system', showSystemPromptLatestButton, showLatestSystemPrompt)}
                    </PlaygroundTile>
                </div>

                {config.settings.chat && (<PlaygroundTile title="Chat" className="h-full grow basis-1/4 hidden lg:flex">{chatTileContent}</PlaygroundTile>)}

                <PlaygroundTile padding={false} backgroundColor="gray-950" className="h-full w-full basis-1/4 items-start overflow-y-auto hidden max-w-[480px] lg:flex" childrenClassName="h-full grow items-start">{settingsTileContent}</PlaygroundTile>
            </div>
        </>
    );
}