import { NextApiResponse } from 'next';
import { AuthenticatedRequest, authMiddleware } from '../../../middleware/authMiddleware';
import { db } from '../../../config/firebase-admin';

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await authMiddleware(req, res, async () => {
        try {
            // Remove user from queue
            await db.collection('matchmaking_queue').doc(req.user.uid).delete();

            res.status(200).json({ message: 'Successfully left queue' });
        } catch (error) {
            console.error('Queue leave error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
} 