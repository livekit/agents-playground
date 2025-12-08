import { NextApiRequest, NextApiResponse } from "next";
import { generateRandomAlphanumeric } from "@/lib/util";

import { AccessToken } from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import type { AccessTokenOptions, VideoGrant } from "livekit-server-sdk";
import { TokenResult } from "../../lib/types";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

type TokenRequest = {
  room_name?: string;
  participant_name?: string;
  participant_identity?: string;
  participant_metadata?: string;
  participant_attributes?: Record<string, string>;
  room_config?: ReturnType<RoomConfiguration["toJson"]>;

  // (old fields, here for backwards compatibility)
  roomName?: string;
  participantName?: string;
};

// This route handler creates a token for a given room and participant
// it's compatible with LiveKit's TokenSourceEndpoint API
async function createToken(request: TokenRequest) {
  const roomName = request.room_name ?? request.roomName!;
  const participantName = request.participant_name ?? request.participantName!;

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: participantName,
      // Token to expire after 10 minutes
      ttl: "10m",
    },
  );

  // Token permissions can be added here based on the
  // desired capabilities of the participant
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canUpdateOwnMetadata: true,
  });

  if (request.participant_identity) {
    at.identity = request.participant_identity;
  }
  if (request.participant_metadata) {
    at.metadata = request.participant_metadata;
  }
  if (request.participant_attributes) {
    at.attributes = request.participant_attributes;
  }
  if (request.room_config) {
    at.roomConfig = RoomConfiguration.fromJson(request.room_config);
  }

  return at.toJwt();
}

export default async function handleToken(
  req: NextApiRequest,
  res: NextApiResponse,
) {
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

  const body = req.body ?? {};
  body.roomName = body.roomName ?? `room-${crypto.randomUUID()}`;
  body.participantName = body.participantName ?? `user-${crypto.randomUUID()}`;

  try {
    res.status(200).json({
      server_url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
      participant_token: await createToken(body),
    });
  } catch (err) {
    console.error("Error generating token:", err);
    res.status(500).send({ message: "Generating token failed" });
  }
}
