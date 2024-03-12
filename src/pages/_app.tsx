import { ConnectionDetailsGeneratorProvider } from "@/hooks/useConnectionDetailsGenerator";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useCallback } from "react";

export default function App({ Component, pageProps }: AppProps) {
  const tokenGenerator = useCallback(async () => {
    if(process.env.NEXT_PUBLIC_LIVEKIT_URL) {
      const res = await fetch("/api/token", {});
      const {identity, token} = await res.json();
      return { token, url: process.env.NEXT_PUBLIC_LIVEKIT_URL };
    } else {
      
    }
  }, []);
  return (
    <ConnectionDetailsGeneratorProvider connectionDetailsGenerator={process.env.NEXT_PUBLIC_LIVEKIT_URL ? tokenGenerator : undefined}>
      <Component {...pageProps} />
    </ConnectionDetailsGeneratorProvider>
  );
}
