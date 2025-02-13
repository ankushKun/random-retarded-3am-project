import { NextApiResponse } from 'next';
import { AuthenticatedRequest, authMiddleware } from '../../../middleware/authMiddleware';
import { db } from '../../../config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await authMiddleware(req, res, async () => {
        try {
            // Check if user is already in queue or in active session
            const userDoc = await db.collection('users').doc(req.user.uid).get();
            const userData = userDoc.data();

            if (userData?.activeSession) {
                return res.status(400).json({ error: 'User already in active session' });
            }

            // Add user to queue
            await db.collection('matchmaking_queue').doc(req.user.uid).set({
                userId: req.user.uid,
                joinedAt: Timestamp.now(),
                status: 'waiting'
            });

            res.status(200).json({ message: 'Joined queue successfully' });
        } catch (error) {
            console.error('Queue join error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
} 