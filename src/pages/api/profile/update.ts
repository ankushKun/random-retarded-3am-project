import { NextApiResponse } from 'next';
import { AuthenticatedRequest, authMiddleware } from '../../../middleware/authMiddleware';
import { db } from '../../../config/firebase-admin';

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await authMiddleware(req, res, async () => {
        try {
            const { name, gender } = req.body;

            if (!name?.trim() || !['male', 'female'].includes(gender)) {
                return res.status(400).json({ error: 'Invalid profile data' });
            }

            const userRef = db.collection('users').doc(req.user.uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                // Create new user document if it doesn't exist
                await userRef.set({
                    email: req.user.email,
                    name: name.trim(),
                    gender,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            } else {
                // Update existing document
                await userRef.update({
                    name: name.trim(),
                    gender,
                    updatedAt: new Date()
                });
            }

            res.status(200).json({ message: 'Profile updated successfully' });
        } catch (error) {
            console.error('Profile update error:', error);
            res.status(500).json({ error: 'Failed to update profile' });
        }
    });
} 