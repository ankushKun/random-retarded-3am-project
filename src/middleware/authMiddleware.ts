import { auth } from '../config/firebase-admin';
import { NextApiRequest, NextApiResponse } from 'next';

export interface AuthenticatedRequest extends NextApiRequest {
    user: {
        uid: string;
        email: string;
    };
}

export async function authMiddleware(
    req: AuthenticatedRequest,
    res: NextApiResponse,
    next: () => Promise<void>
) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token);

        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email || '',
        };

        await next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ error: 'Unauthorized' });
    }
} 