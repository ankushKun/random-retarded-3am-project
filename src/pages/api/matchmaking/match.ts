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

                // Get users in queue
                const queueSnapshot = await transaction.get(
                    db.collection('matchmaking_queue')
                        .where('status', '==', 'waiting')
                        .orderBy('joinedAt')
                        .limit(2)
                );
                console.log('Queue snapshot size:', queueSnapshot.size);

                if (queueSnapshot.size < 2) {
                    console.log('Not enough users in queue');
                    return { status: 'not_enough_users' };
                }

                const users = queueSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log('Found users for matching:', users);

                // Check if any of these users are already in a session
                const userDocs = await Promise.all(
                    users.map(user =>
                        transaction.get(db.collection('users').doc(user.id))
                    )
                );
                console.log('User docs retrieved:', userDocs.map(d => ({ id: d.id, exists: d.exists })));

                // If any user already has an active session, abort
                if (userDocs.some(doc => doc.exists && doc.data()?.activeSession)) {
                    console.log('Users already in session, aborting');
                    return { status: 'users_already_matched' };
                }

                // Create a lock document to prevent race conditions
                const lockId = users.map(u => u.id).sort().join('-');
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
                    participants: users.map(u => u.id),
                    startTime: FieldValue.serverTimestamp(),
                    endTime: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000), // 1 hour
                    status: 'active',
                    peerIds: {}, // Initialize empty peerIds object
                    messages: [] // Initialize empty messages array
                });

                // Update users' status
                for (const user of users) {
                    const userRef = db.collection('users').doc(user.id);

                    if (!userDocs.find(doc => doc.id === user.id)?.exists) {
                        transaction.set(userRef, {
                            activeSession: sessionRef.id,
                            createdAt: FieldValue.serverTimestamp(),
                        });
                    } else {
                        transaction.update(userRef, {
                            activeSession: sessionRef.id
                        });
                    }

                    // Remove from queue
                    transaction.delete(db.collection('matchmaking_queue').doc(user.id));
                }

                return {
                    status: 'success',
                    sessionId: sessionRef.id,
                    participants: users.map(u => u.id)
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