import { NextApiRequest, NextApiResponse } from "next";
import { AgentDispatchClient } from 'livekit-server-sdk';

const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

const dispatchAgent = async (roomName: string, agentName: string, metadata: string) => {
    const agentDispatchClient = new AgentDispatchClient(url, apiKey, apiSecret);
    const dispatch = await agentDispatchClient.createDispatch(roomName, agentName, {
        metadata: metadata,
    });

    return dispatch;
};

export default async function handleDispatchAgent(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try {
        const roomName = req.query.roomName as string || '';
        const agentName = req.query.agentName as string || '';
        const metadata = req.query.metadata as string || '';
    
        const result = await dispatchAgent(roomName, agentName, metadata);
    
        res.status(200).json(result);
    } catch (e) {
        res.statusMessage = (e as Error).message;
        res.status(500).end();
    }
}