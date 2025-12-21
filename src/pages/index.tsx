import { AnimatePresence, motion } from "framer-motion";
import { Inter } from "next/font/google";
import Head from "next/head";
import { useState } from "react";

import { PlaygroundConnect } from "@/components/PlaygroundConnect";
import Playground from "@/components/playground/Playground";
import { PlaygroundToast, ToastType } from "@/components/toast/PlaygroundToast";
import { ConfigProvider, useConfig } from "@/hooks/useConfig";
import { ToastProvider, useToast } from "@/components/toast/ToasterProvider";
import { TokenSourceConfigurable, TokenSource } from "livekit-client";

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
  return (
    <ToastProvider>
      <ConfigProvider>
        <HomeInner />
      </ConfigProvider>
    </ToastProvider>
  );
}

export function HomeInner() {
  const { config } = useConfig();
  const { toastMessage, setToastMessage } = useToast();
  const [autoConnect, setAutoConnect] = useState(false);
  const [tokenSource, setTokenSource] = useState<
    TokenSourceConfigurable | undefined
  >(() => {
    if (process.env.NEXT_PUBLIC_LIVEKIT_URL) {
      return TokenSource.endpoint("/api/token");
    }
    return undefined;
  });

  return (
    <>
      <Head>
        <title>{config.title}</title>
        <meta name="description" content={config.description} />
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
              <PlaygroundToast />
            </motion.div>
          )}
        </AnimatePresence>
        {tokenSource ? (
          <Playground
            themeColors={themeColors}
            tokenSource={tokenSource}
            autoConnect={autoConnect}
          />
        ) : (
          <PlaygroundConnect
            accentColor={themeColors[0]}
            onConnectClicked={(tokenSource, shouldAutoConnect) => {
              setTokenSource(tokenSource);
              if (shouldAutoConnect) {
                setAutoConnect(true);
              }
            }}
          />
        )}
      </main>
    </>
  );
}
