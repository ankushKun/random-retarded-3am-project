import { NextApiResponse } from 'next';
import { AuthenticatedRequest, authMiddleware } from '../../../middleware/authMiddleware';
import { db } from '../../../config/firebase-admin';

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await authMiddleware(req, res, async () => {
        try {
            const { sessionId, peerId } = req.body;
            console.log('Updating peer ID:', { userId: req.user.uid, sessionId, peerId });

            // Verify user is part of the session
            const sessionDoc = await db.collection('sessions').doc(sessionId).get();
            const sessionData = sessionDoc.data();

            if (!sessionData || !sessionData.participants.includes(req.user.uid)) {
                console.log('User not in session:', req.user.uid);
                return res.status(403).json({ error: 'Not authorized for this session' });
            }

            // Update the peer ID in the session
            await db.collection('sessions').doc(sessionId).update({
                [`peerIds.${req.user.uid}`]: peerId
            });

            console.log('Successfully updated peer ID');
            res.status(200).json({ message: 'Peer ID updated successfully' });
        } catch (error) {
            console.error('Failed to update peer ID:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
} 