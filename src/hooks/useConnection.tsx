"use client"

import { CLOUD_ENABLED } from "@/cloud/CloudConnect";
import { useCloud } from "@/cloud/useCloud";
import React, { createContext, useState } from "react";
import { useCallback } from "react";
import { useConfig } from "./useConfig";

type TokenGeneratorData = {
  shouldConnect: boolean;
  wsUrl: string;
  token: string;
  disconnect: () => Promise<void>;
  connect: () => Promise<void>;
};

const ConnectionContext = createContext<TokenGeneratorData | undefined>(undefined);

export const ConnectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { generateToken, wsUrl: cloudWSUrl } = useCloud();
  const { config } = useConfig();
  const [connectionDetails, setConnectionDetails] = useState<{
    wsUrl: string;
    token: string;
    shouldConnect: boolean;
  }>({ wsUrl: "", token: "", shouldConnect: false });

  const connect = useCallback(async () => {
    let token = "";
    let url = "";
    if (CLOUD_ENABLED) {
      token = await generateToken();
      url = cloudWSUrl;
    } else if (process.env.NEXT_PUBLIC_LIVEKIT_URL) {
      url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      const {accessToken} = await fetch("/api/token").then((res) => res.json());
      token = accessToken;
    } else {
      token = config.settings.token;
      url = config.settings.ws_url;
    }
    setConnectionDetails({ wsUrl: url, token, shouldConnect: true });
  }, [
    cloudWSUrl,
    config.settings.token,
    config.settings.ws_url,
    generateToken,
  ]);

  const disconnect = useCallback(async () => {
    setConnectionDetails((prev) => ({ ...prev, shouldConnect: false }));
  }, []);

  return (
    <ConnectionContext.Provider
      value={{
        wsUrl: connectionDetails.wsUrl,
        token: connectionDetails.token,
        shouldConnect: connectionDetails.shouldConnect,
        connect,
        disconnect,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => {
  const context = React.useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error("useConnection must be used within a ConnectionProvider");
  }
  return context;
}