import { NextApiResponse } from 'next';
import { AuthenticatedRequest, authMiddleware } from '../../../middleware/authMiddleware';
import { db } from '../../../config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await authMiddleware(req, res, async () => {
        try {
            console.log('Checking status for user:', req.user.uid);
            const userDoc = await db.collection('users').doc(req.user.uid).get();
            const userData = userDoc.data();
            console.log('User data:', userData);

            // Check active session
            if (userData?.activeSession) {
                console.log('User has active session:', userData.activeSession);
                const sessionDoc = await db.collection('sessions').doc(userData.activeSession).get();
                const sessionData = sessionDoc.data();
                console.log('Session data:', sessionData);

                if (sessionData) {
                    const now = Date.now();
                    const videoEndTime = sessionData.videoEndTime.toDate().getTime();
                    const chatEndTime = sessionData.chatEndTime.toDate().getTime();

                    // Get partner's info
                    const partnerId = sessionData.participants.find((p: string) => p !== req.user.uid);
                    const partnerDoc = await db.collection('users').doc(partnerId).get();
                    const partnerData = partnerDoc.data();
                    const partnerName = partnerData?.displayName || 'Anonymous User';

                    if (now >= chatEndTime) {
                        // Session has completely ended - remove cooldown
                        await db.collection('users').doc(req.user.uid).update({
                            activeSession: null,
                        });

                        // Delete the session if it's the last participant to leave
                        const otherParticipant = await db.collection('users')
                            .where('activeSession', '==', userData.activeSession)
                            .get();

                        if (otherParticipant.empty) {
                            await db.collection('sessions').doc(userData.activeSession).delete();
                        }

                        return res.status(200).json({ status: 'ended' });
                    }

                    if (now >= videoEndTime) {
                        // In chat phase
                        return res.status(200).json({
                            status: 'in_chat',
                            sessionId: userData.activeSession,
                            partnerId: partnerId,
                            partnerName: partnerName,
                            chatTimeLeft: Math.max(0, chatEndTime - now)
                        });
                    }

                    // In video phase
                    return res.status(200).json({
                        status: 'in_session',
                        sessionId: userData.activeSession,
                        partnerId: partnerId,
                        partnerName: partnerName,
                        videoTimeLeft: Math.max(0, videoEndTime - now),
                        peerIds: sessionData.peerIds || {}
                    });
                }
            }

            // Get total number of people in queue
            const queueSnapshot = await db.collection('matchmaking_queue')
                .where('status', '==', 'waiting')
                .count()
                .get();
            const queueCount = queueSnapshot.data().count;
            console.log('Current queue count:', queueCount);

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