import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { AuthRequest } from '../middleware/authMiddleware';

export const getUserProfile = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const { userId } = req.params;

        // Check if user is requesting their own profile or has admin rights
        if (req.user?.uid !== userId) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(userDoc.data());
    } catch (error) {
        next(error);
    }
};

export const updateUserProfile = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const { userId } = req.params;

        // Check if user is updating their own profile
        if (req.user?.uid !== userId) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        const updateData = req.body;

        await db.collection('users').doc(userId).update(updateData);

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        next(error);
    }
}; 