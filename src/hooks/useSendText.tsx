import { useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';

export const useSendText = () => {
    const room = useRoomContext();

    const sendText = useCallback(async (message: string) => {
        if (!room?.localParticipant) return;

        try {
            console.log('Sending text message:', message);
            const info = await room.localParticipant.sendText(message, {
                topic: 'lk.room_text_input'
            });
            console.log('Text message sent:', info);
        } catch (e) {
            console.error('Failed to send message:', e);
        }
    }, [room]);

    return sendText;
}; 