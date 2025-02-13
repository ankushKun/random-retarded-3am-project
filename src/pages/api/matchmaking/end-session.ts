import { NextApiResponse } from 'next';
import { AuthenticatedRequest, authMiddleware } from '../../../middleware/authMiddleware';
import { db } from '../../../config/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await authMiddleware(req, res, async () => {
        try {
            const { sessionId } = req.body;

            // Get the session document
            const sessionDoc = await db.collection('sessions').doc(sessionId).get();
            if (!sessionDoc.exists) {
                return res.status(404).json({ error: 'Session not found' });
            }

            const sessionData = sessionDoc.data();
            if (!sessionData?.participants.includes(req.user.uid)) {
                return res.status(403).json({ error: 'Not authorized to end this session' });
            }

            // Update all participants
            const batch = db.batch();
            for (const participantId of sessionData.participants) {
                const userRef = db.collection('users').doc(participantId);
                batch.update(userRef, {
                    activeSession: null
                });
            }

            // Mark session as ended
            const sessionRef = db.collection('sessions').doc(sessionId);
            batch.update(sessionRef, {
                status: 'ended',
                endedAt: FieldValue.serverTimestamp(),
                endedBy: req.user.uid
            });

            await batch.commit();

            res.status(200).json({ message: 'Session ended successfully' });
        } catch (error) {
            console.error('Error ending session:', error);
            res.status(500).json({ error: 'Failed to end session' });
        }
    });
} 