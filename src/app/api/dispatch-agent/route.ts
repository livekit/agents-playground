import { AgentDispatchClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { roomName, agentName, metadata } = await request.json();
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const PRIMARY_SIP_TRUNK_NUMBER = process.env.PRIMARY_SIP_TRUNK_NUMBER;

    metadata["sipTrunkNumbers"] = [PRIMARY_SIP_TRUNK_NUMBER];

    console.log("Dispatching agent:", { roomName, agentName, metadata });

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "LiveKit API credentials not configured" }, { status: 500 });
    }

    const agentDispatchClient = new AgentDispatchClient(wsUrl, apiKey, apiSecret);

    const dispatch = await agentDispatchClient.createDispatch(roomName, agentName, {
      metadata: JSON.stringify(metadata),
    });
    console.log("Created dispatch:", dispatch);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dispatching agent:", error);
    return NextResponse.json({ error: "Failed to dispatch agent" }, { status: 500 });
  }
}
