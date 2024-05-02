"use client"

import React, { createContext, useState } from "react";
import { useConfig } from "./useConfig";
import { useCallback } from "react";

// Note: cloud mode is only used in our private, hosted version
export type Mode = "cloud" | "env" | "manual";

type TokenGeneratorData = {
  shouldConnect: boolean;
  wsUrl: string;
  token: string;
  disconnect: () => Promise<void>;
  connect: (mode: Mode) => Promise<void>;
};

const TokenGeneratorContext = createContext<TokenGeneratorData | undefined>(undefined);

export const TokenGeneratorProvider = ({
  children,
  generateConnectionDetails,
}: {
  children: React.ReactNode;
  // generateConnectionDetails is only required in cloud mode
  generateConnectionDetails?: () => Promise<{ wsUrl: string; token: string }>;
}) => {
  const { config } = useConfig();
  const [token, setToken] = useState("");
  const [wsUrl, setWsUrl] = useState("");
  const [shouldConnect, setShouldConnect] = useState(false);
  const connect = useCallback(
    async (mode: Mode) => {
      if (mode === "cloud") {
        if (!generateConnectionDetails) {
          throw new Error(
            "generateConnectionDetails must be provided in cloud mode"
          );
        }
        const { wsUrl, token } = await generateConnectionDetails();
        setWsUrl(wsUrl);
        setToken(token);
      } else if (mode === "env") {
        const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        if (!url) {
          throw new Error("NEXT_PUBLIC_LIVEKIT_URL must be set in env mode");
        }
        const res = await fetch("/api/token");
        const { token } = await res.json();
        setWsUrl(url);
        setToken(token);
      } else if (mode === "manual") {
        setWsUrl(config.user_settings.ws_url);
        setToken(config.user_settings.token);
      }
      setShouldConnect(true);
    },
    [
      config.user_settings.token,
      config.user_settings.ws_url,
      generateConnectionDetails,
    ]
  );
  const disconnect = useCallback(async () => {
    setShouldConnect(false);
  }, []);

  return (
    <TokenGeneratorContext.Provider
      value={{
        wsUrl,
        token,
        shouldConnect,
        connect,
        disconnect,
      }}
    >
      {children}
    </TokenGeneratorContext.Provider>
  );
};

export const useTokenGenerator = () => {
  const context = React.useContext(TokenGeneratorContext);
  if (context === undefined) {
    throw new Error("useTokenGenerator must be used within a TokenGeneratorProvider");
  }
  return context;
}