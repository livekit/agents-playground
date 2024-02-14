import { generateRandomAlphanumeric } from "@/lib/util";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useToken,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { Inter } from "next/font/google";
import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PlaygroundConnect } from "@/components/PlaygroundConnect";
import Playground, {
  PlaygroundMeta,
  PlaygroundOutputs,
} from "@/components/playground/Playground";
import { PlaygroundToast, ToastType } from "@/components/toast/PlaygroundToast";
import { useAppConfig } from "@/hooks/useAppConfig";

const themeColors = [
  "cyan",
  "green",
  "amber",
  "blue",
  "violet",
  "rose",
  "pink",
  "teal",
];

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [shouldConnect, setShouldConnect] = useState(false);
  const [liveKitUrl, setLiveKitUrl] = useState(
    process.env.NEXT_PUBLIC_LIVEKIT_URL
  );
  const [customToken, setCustomToken] = useState<string>();
  const [metadata, setMetadata] = useState<PlaygroundMeta[]>([]);

  const [roomName, setRoomName] = useState(createRoomName());

  const tokenOptions = useMemo(() => {
    return {
      userInfo: { identity: generateRandomAlphanumeric(16) },
    };
  }, []);

  // set a new room name each time the user disconnects so that a new token gets fetched behind the scenes for a different room
  useEffect(() => {
    if (shouldConnect === false) {
      setRoomName(createRoomName());
    }
  }, [shouldConnect]);

  useEffect(() => {
    const md: PlaygroundMeta[] = [];
    if (liveKitUrl && liveKitUrl !== process.env.NEXT_PUBLIC_LIVEKIT_URL) {
      md.push({ name: "LiveKit URL", value: liveKitUrl });
    }
    if (!customToken && tokenOptions.userInfo?.identity) {
      md.push({ name: "Room Name", value: roomName });
      md.push({
        name: "Participant Identity",
        value: tokenOptions.userInfo.identity,
      });
    }
    setMetadata(md);
  }, [liveKitUrl, roomName, tokenOptions, customToken]);

  const token = useToken("/api/token", roomName, tokenOptions);
  const appConfig = useAppConfig();
  const outputs = [
    appConfig?.outputs.audio && PlaygroundOutputs.Audio,
    appConfig?.outputs.video && PlaygroundOutputs.Video,
    appConfig?.outputs.chat && PlaygroundOutputs.Chat,
  ].filter((item) => typeof item !== "boolean") as PlaygroundOutputs[];

  const handleConnect = useCallback(
    (connect: boolean, opts?: { url: string; token: string }) => {
      if (connect && opts) {
        setLiveKitUrl(opts.url);
        setCustomToken(opts.token);
      }
      setShouldConnect(connect);
    },
    []
  );

  return (
    <>
      <Head>
        <title>{appConfig?.title ?? "LiveKit Agents Playground"}</title>
        <meta
          name="description"
          content={
            appConfig?.description ??
            "Quickly prototype and test your multimodal agents"
          }
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta
          property="og:image"
          content="https://livekit.io/images/og/agents-playground.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="relative flex flex-col justify-center px-4 items-center h-full w-full bg-black repeating-square-background">
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              className="left-0 right-0 top-0 absolute z-10"
              initial={{ opacity: 0, translateY: -50 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -50 }}
            >
              <PlaygroundToast
                message={toastMessage.message}
                type={toastMessage.type}
                onDismiss={() => {
                  setToastMessage(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {liveKitUrl ? (
          <LiveKitRoom
            className="flex flex-col h-full w-full"
            serverUrl={liveKitUrl}
            token={customToken ?? token}
            audio={appConfig?.inputs.mic}
            video={appConfig?.inputs.camera}
            connect={shouldConnect}
            onError={(e) => {
              setToastMessage({ message: e.message, type: "error" });
              console.error(e);
            }}
          >
            <Playground
              title={appConfig?.title}
              githubLink={appConfig?.github_link}
              outputs={outputs}
              showQR={appConfig?.show_qr}
              description={appConfig?.description}
              themeColors={themeColors}
              defaultColor={appConfig?.theme_color ?? "cyan"}
              onConnect={handleConnect}
              metadata={metadata}
              videoFit={appConfig?.video_fit ?? "cover"}
            />
            <RoomAudioRenderer />
            <StartAudio label="Click to enable audio playback" />
          </LiveKitRoom>
        ) : (
          <PlaygroundConnect
            accentColor={themeColors[0]}
            onConnectClicked={(url, token) => {
              handleConnect(true, { url, token });
            }}
          />
        )}
      </main>
    </>
  );
}

function createRoomName() {
  return [generateRandomAlphanumeric(4), generateRandomAlphanumeric(4)].join(
    "-"
  );
}
