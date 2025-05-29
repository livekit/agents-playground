"use client";

import { useCloud } from "@/cloud/useCloud";
import React, { createContext, useState } from "react";
import { useCallback } from "react";
import { useConfig } from "./useConfig";
import { useToast } from "@/components/toast/ToasterProvider";

export type ConnectionMode = "cloud" | "manual" | "env";

type TokenGeneratorData = {
  shouldConnect: boolean;
  wsUrl: string;
  token: string;
  mode: ConnectionMode;
  disconnect: () => Promise<void>;
  connect: (mode: ConnectionMode) => Promise<void>;
};

const ConnectionContext = createContext<TokenGeneratorData | undefined>(
  undefined,
);

export const ConnectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { generateToken, wsUrl: cloudWSUrl } = useCloud();
  const { setToastMessage } = useToast();
  const { config } = useConfig();
  const [connectionDetails, setConnectionDetails] = useState<{
    wsUrl: string;
    token: string;
    mode: ConnectionMode;
    shouldConnect: boolean;
  }>({ wsUrl: "", token: "", shouldConnect: false, mode: "manual" });

  const connect = useCallback(
    async (mode: ConnectionMode) => {
      let token = "";
      let url = "";
      if (mode === "cloud") {
        try {
          token = await generateToken();
        } catch (error) {
          setToastMessage({
            type: "error",
            message:
              "Failed to generate token, you may need to increase your role in this LiveKit Cloud project.",
          });
        }
        url = cloudWSUrl;
      } else if (mode === "env") {
        if (!process.env.NEXT_PUBLIC_LIVEKIT_URL) {
          throw new Error("NEXT_PUBLIC_LIVEKIT_URL is not set");
        }
        url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        const body: Record<string, any> = {};
        if (config.settings.room_name) {
          body.roomName = config.settings.room_name;
        }
        if (config.settings.participant_id) {
          body.participantId = config.settings.participant_id;
        }
        if (config.settings.participant_name) {
          body.participantName = config.settings.participant_name;
        }
        if (config.settings.agent_name) {
          body.agentName = config.settings.agent_name;
        }
        if (config.settings.metadata) {
          body.metadata = config.settings.metadata;
        }
        const attributesArray = Array.isArray(config.settings.attributes)
          ? config.settings.attributes
          : [];
        if (attributesArray?.length) {
          const attributes = attributesArray.reduce(
            (acc, attr) => {
              if (attr.key) {
                acc[attr.key] = attr.value;
              }
              return acc;
            },
            {} as Record<string, string>,
          );
          body.attributes = attributes;
        }
        const { accessToken } = await fetch(`/api/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }).then((res) => res.json());
        token = accessToken;
      } else {
        token = config.settings.token;
        url = config.settings.ws_url;
      }
      setConnectionDetails({ wsUrl: url, token, shouldConnect: true, mode });
    },
    [
      cloudWSUrl,
      config.settings.token,
      config.settings.ws_url,
      config.settings.room_name,
      config.settings.participant_name,
      config.settings.agent_name,
      config.settings.participant_id,
      config.settings.metadata,
      config.settings.attributes,
      generateToken,
      setToastMessage,
    ],
  );

  const disconnect = useCallback(async () => {
    setConnectionDetails((prev) => ({ ...prev, shouldConnect: false }));
  }, []);

  return (
    <ConnectionContext.Provider
      value={{
        wsUrl: connectionDetails.wsUrl,
        token: connectionDetails.token,
        shouldConnect: connectionDetails.shouldConnect,
        mode: connectionDetails.mode,
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
};
