import { NextApiResponse } from 'next';
import { AuthenticatedRequest, authMiddleware } from '../../../middleware/authMiddleware';
import { db } from '../../../config/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await authMiddleware(req, res, async () => {
        try {
            // Use a transaction to ensure atomic operations and get a fresh snapshot of the queue
            const result = await db.runTransaction(async (transaction) => {
                console.log('Starting match transaction');

                // Query the matchmaking queue inside the transaction to get the latest waiting users
                const queueQuery = db.collection('matchmaking_queue').orderBy('joinedAt');
                const querySnapshot = await transaction.get(queueQuery);

                let waitingUsers: Array<{ id: string, joinedAt: any }> = [];
                querySnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    // Only include users still waiting (status set to 'waiting')
                    if (data.status === 'waiting') {
                        waitingUsers.push({ id: doc.id, joinedAt: data.joinedAt });
                    }
                });

                // Check if there are at least 2 users ready to match
                if (waitingUsers.length < 2) {
                    return { status: 'not_enough_users' };
                }

                // Select the first two waiting users (you can choose a different matching strategy here)
                const matchedPair = waitingUsers.slice(0, 2);

                // Create a new session for the matched pair
                const sessionRef = db.collection('sessions').doc();
                transaction.set(sessionRef, {
                    participants: matchedPair.map(u => u.id),
                    startTime: FieldValue.serverTimestamp(),
                    videoEndTime: Timestamp.fromMillis(Date.now() + 15 * 60 * 1000), // 15 minutes
                    chatEndTime: Timestamp.fromMillis(Date.now() + 20 * 60 * 1000), // 15 + 5 minutes
                    status: 'video',
                    peerIds: {},
                    messages: []
                });

                // Update each user's status and remove them from the matchmaking queue
                for (const user of matchedPair) {
                    const userRef = db.collection('users').doc(user.id);
                    transaction.update(userRef, { activeSession: sessionRef.id });
                    transaction.delete(db.collection('matchmaking_queue').doc(user.id));
                }

                return {
                    status: 'success',
                    sessionId: sessionRef.id,
                    participants: matchedPair.map(u => u.id)
                };
            });

            // Clean up expired locks periodically
            cleanupExpiredLocks();

            if (result.status === 'success') {
                res.status(200).json(result);
            } else if (result.status === 'not_enough_users') {
                res.status(200).json({ message: 'Not enough users in queue' });
            } else if (result.status === 'users_already_matched') {
                res.status(200).json({ message: 'Users already matched' });
            } else {
                res.status(200).json({ message: 'Match in progress' });
            }
        } catch (error) {
            console.error('Matching error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}

async function cleanupExpiredLocks() {
    try {
        const now = Timestamp.now();
        const expiredLocks = await db.collection('matching_locks')
            .where('expiresAt', '<', now)
            .get();

        const batch = db.batch();
        expiredLocks.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        if (expiredLocks.size > 0) {
            await batch.commit();
        }
    } catch (error) {
        console.error('Error cleaning up locks:', error);
    }
} 