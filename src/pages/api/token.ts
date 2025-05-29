import { NextApiRequest, NextApiResponse } from "next";
import { generateRandomAlphanumeric } from "@/lib/util";

import { AccessToken } from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import type { AccessTokenOptions, VideoGrant } from "livekit-server-sdk";
import { TokenResult } from "../../lib/types";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

const createToken = (
  userInfo: AccessTokenOptions,
  grant: VideoGrant,
  agentName?: string,
) => {
  const at = new AccessToken(apiKey, apiSecret, userInfo);
  at.addGrant(grant);
  if (agentName) {
    at.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: agentName,
          metadata: '{"user_id": "12345"}',
        }),
      ],
    });
  }
  return at.toJwt();
};

export default async function handleToken(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).end("Method Not Allowed");
      return;
    }
    if (!apiKey || !apiSecret) {
      res.statusMessage = "Environment variables aren't set up correctly";
      res.status(500).end();
      return;
    }

    const {
      roomName: roomNameFromBody,
      participantName: participantNameFromBody,
      participantId: participantIdFromBody,
      metadata: metadataFromBody,
      attributes: attributesFromBody,
      agentName: agentNameFromBody,
    } = req.body;

    // Get room name from query params or generate random one
    const roomName =
      (roomNameFromBody as string) ||
      `room-${generateRandomAlphanumeric(4)}-${generateRandomAlphanumeric(4)}`;

    // Get participant name from query params or generate random one
    const identity =
      (participantIdFromBody as string) ||
      `identity-${generateRandomAlphanumeric(4)}`;

    // Get agent name from query params or use none (automatic dispatch)
    const agentName = (agentNameFromBody as string) || undefined;

    // Get metadata and attributes from query params
    const metadata = metadataFromBody as string | undefined;
    const attributesStr = attributesFromBody as string | undefined;
    const attributes = attributesStr || {};

    const participantName = participantNameFromBody || identity;

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true,
    };

    const token = await createToken(
      { identity, metadata, attributes, name: participantName },
      grant,
      agentName,
    );
    const result: TokenResult = {
      identity,
      accessToken: token,
    };

    res.status(200).json(result);
  } catch (e) {
    res.statusMessage = (e as Error).message;
    res.status(500).end();
  }
}
