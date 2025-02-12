import { NextApiRequest } from 'next';
import { auth } from './firebase-admin';

export async function authenticateRequest(req: NextApiRequest) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await auth.verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        console.error('Auth error:', error);
        return null;
    }
} 