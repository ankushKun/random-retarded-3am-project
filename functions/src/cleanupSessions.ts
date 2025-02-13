import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const cleanupExpiredSessions = functions.pubsub
    .schedule('every 5 minutes')
    .onRun(async (context) => {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();

        try {
            // Find all sessions that have passed their chat end time
            const expiredSessions = await db.collection('sessions')
                .where('chatEndTime', '<=', now)
                .get();

            if (expiredSessions.empty) return;

            const batch = db.batch();
            const userUpdates: Promise<any>[] = [];

            // Process each expired session
            expiredSessions.forEach(session => {
                // Delete the session
                batch.delete(session.ref);

                // Update users who still have this as their active session
                const userUpdate = db.collection('users')
                    .where('activeSession', '==', session.id)
                    .get()
                    .then(users => {
                        const userBatch = db.batch();
                        users.forEach(user => {
                            userBatch.update(user.ref, {
                                activeSession: null,
                                lastSessionEnd: now
                            });
                        });
                        return userBatch.commit();
                    });

                userUpdates.push(userUpdate);
            });

            // Execute all updates
            await Promise.all([
                batch.commit(),
                ...userUpdates
            ]);

            console.log(`Cleaned up ${expiredSessions.size} expired sessions`);
        } catch (error) {
            console.error('Session cleanup failed:', error);
        }
    }); 