import { NextApiRequest, NextApiResponse } from "next";

import { TokenSourceRequestPayload } from "livekit-client";
import { AccessToken } from "livekit-server-sdk";
import { RoomConfiguration } from "@livekit/protocol";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

type TokenRequest = {
  room_name: string;
  participant_identity: string;
  participant_name?: string;
  participant_metadata?: string;
  participant_attributes?: Record<string, string>;
  room_config?: ReturnType<RoomConfiguration["toJson"]>;
};

// This route handler creates a token for a given room and participant
// it's compatible with LiveKit's TokenSourceEndpoint API
async function createToken(request: TokenRequest) {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: request.participant_identity,
      // Token to expire after 10 minutes
      ttl: "10m",
    },
  );

  // Token permissions can be added here based on the
  // desired capabilities of the participant
  at.addGrant({
    roomJoin: true,
    room: request.room_name,
    canUpdateOwnMetadata: true,
  });

  if (request.participant_name) {
    at.name = request.participant_name;
  }
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

  const options = req.body ?? {};
  const suffix = crypto.randomUUID().substring(0, 8);
  options.room_name = options.room_name ?? options.roomName ?? `room-${suffix}`;
  options.participant_identity =
    options.participant_identity ?? options.participantName ?? `user-${suffix}`;

  try {
    res.status(200).json({
      server_url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
      participant_token: await createToken(options),
    });
  } catch (err) {
    console.error("Error generating token:", err);
    res.status(500).send({ message: "Generating token failed" });
  }
}
