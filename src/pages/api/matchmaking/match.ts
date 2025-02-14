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
            // Use a transaction to ensure atomic operations
            const result = await db.runTransaction(async (transaction) => {
                console.log('Starting match transaction');

                // Get all users in queue
                const queueSnapshot = await transaction.get(
                    db.collection('matchmaking_queue')
                        .where('status', '==', 'waiting')
                        .orderBy('joinedAt')
                );
                console.log('Queue snapshot size:', queueSnapshot.size);

                if (queueSnapshot.size < 2) {
                    console.log('Not enough users in queue');
                    return { status: 'not_enough_users' };
                }

                // Get user documents for all queued users to check their gender
                const queuedUsers = await Promise.all(
                    queueSnapshot.docs.map(async (doc) => {
                        const userDoc = await transaction.get(db.collection('users').doc(doc.id));
                        return {
                            id: doc.id,
                            joinedAt: doc.data().joinedAt,
                            gender: userDoc.data()?.gender,
                            activeSession: userDoc.data()?.activeSession
                        };
                    })
                );

                // Filter out users who already have an active session
                const availableUsers = queuedUsers.filter(user => !user.activeSession);
                if (availableUsers.length < 2) {
                    console.log('Not enough available users');
                    return { status: 'not_enough_users' };
                }

                // Try to match male with female first
                let matchedPair = null;

                // Find the earliest joined male and female pair
                const males = availableUsers.filter(u => u.gender === 'male');
                const females = availableUsers.filter(u => u.gender === 'female');

                if (males.length > 0 && females.length > 0) {
                    // Sort by join time to get the longest waiting users
                    const earliestMale = males.sort((a, b) => a.joinedAt.toMillis() - b.joinedAt.toMillis())[0];
                    const earliestFemale = females.sort((a, b) => a.joinedAt.toMillis() - b.joinedAt.toMillis())[0];
                    matchedPair = [earliestMale, earliestFemale];
                } else {
                    // If no male-female match is possible, match the two longest waiting users
                    const sortedUsers = availableUsers.sort((a, b) => a.joinedAt.toMillis() - b.joinedAt.toMillis());
                    matchedPair = [sortedUsers[0], sortedUsers[1]];
                }

                // Create a lock for the matched pair
                const lockId = matchedPair.map(u => u.id).sort().join('-');
                console.log('Generated lock ID:', lockId);
                const lockRef = db.collection('matching_locks').doc(lockId);
                const lockDoc = await transaction.get(lockRef);

                if (lockDoc.exists) {
                    return { status: 'match_in_progress' };
                }

                // Set the lock with expiration
                transaction.set(lockRef, {
                    createdAt: FieldValue.serverTimestamp(),
                    expiresAt: Timestamp.fromMillis(Date.now() + 10000) // 10 seconds lock
                });

                // Create a new session
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

                // Update users' status and remove from queue
                for (const user of matchedPair) {
                    const userRef = db.collection('users').doc(user.id);
                    transaction.update(userRef, {
                        activeSession: sessionRef.id
                    });

                    // Remove from queue
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