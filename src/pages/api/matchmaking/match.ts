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
            // Get users in queue
            const queueSnapshot = await db.collection('matchmaking_queue')
                .where('status', '==', 'waiting')
                .orderBy('joinedAt')
                .limit(2)
                .get();

            if (queueSnapshot.size < 2) {
                return res.status(200).json({ message: 'Not enough users in queue' });
            }

            const users = queueSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Create a new session
            const sessionRef = await db.collection('sessions').add({
                participants: users.map(u => u.id),
                startTime: Timestamp.now(),
                endTime: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000), // 1 hour
                status: 'active'
            });

            // Update users' status
            const batch = db.batch();
            users.forEach(user => {
                batch.delete(db.collection('matchmaking_queue').doc(user.id));
                batch.update(db.collection('users').doc(user.id), {
                    activeSession: sessionRef.id
                });
            });
            await batch.commit();

            res.status(200).json({
                message: 'Match created successfully',
                sessionId: sessionRef.id,
                participants: users.map(u => u.id)
            });
        } catch (error) {
            console.error('Matching error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
} 