import { NextApiResponse } from 'next';
import { AuthenticatedRequest, authMiddleware } from '../../../middleware/authMiddleware';
import { db } from '../../../config/firebase-admin';

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await authMiddleware(req, res, async () => {
        try {
            // Get user's current status
            const userDoc = await db.collection('users').doc(req.user.uid).get();
            const userData = userDoc.data();

            // Check active session
            if (userData?.activeSession) {
                const sessionDoc = await db.collection('sessions').doc(userData.activeSession).get();
                const sessionData = sessionDoc.data();

                if (sessionData) {
                    const timeLeft = sessionData.endTime.toDate().getTime() - Date.now();
                    return res.status(200).json({
                        status: 'in_session',
                        sessionId: userData.activeSession,
                        partnerId: sessionData.participants.find((p: string) => p !== req.user.uid),
                        timeLeft: Math.max(0, timeLeft),
                    });
                }
            }

            // Check cooldown
            if (userData?.lastSessionEnd) {
                const cooldownEnd = userData.lastSessionEnd.toDate().getTime() + 30 * 60 * 1000;
                if (Date.now() < cooldownEnd) {
                    return res.status(200).json({
                        status: 'cooldown',
                        cooldownEnd,
                        timeLeft: cooldownEnd - Date.now()
                    });
                }
            }

            // Get total number of people in queue
            const queueSnapshot = await db.collection('matchmaking_queue')
                .where('status', '==', 'waiting')
                .count()
                .get();
            const queueCount = queueSnapshot.data().count;

            // Check queue status
            const queueDoc = await db.collection('matchmaking_queue').doc(req.user.uid).get();
            if (queueDoc.exists) {
                return res.status(200).json({
                    status: 'queued',
                    queuedAt: queueDoc.data()?.joinedAt.toDate(),
                    queuePosition: queueCount, // This will show their position in queue
                    totalInQueue: queueCount
                });
            }

            // User is idle
            return res.status(200).json({
                status: 'idle',
                totalInQueue: queueCount
            });

        } catch (error) {
            console.error('Status check error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
} 