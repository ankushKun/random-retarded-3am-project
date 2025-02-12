import { Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { AuthRequest } from '../middleware/authMiddleware';
import { MatchState, UserMatch, MatchingPool } from '../lib/types';

export const getCurrentMatchState = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get current hour in UTC
        const now = new Date();
        const currentHour = now.getUTCHours();
        const currentDate = now.toISOString().split('T')[0];

        // Check if user has an active match for the current hour
        const matchDoc = await db.collection('matches')
            .where('participants', 'array-contains', userId)
            .where('date', '==', currentDate)
            .where('hour', '==', currentHour)
            .limit(1)
            .get();

        if (matchDoc.empty) {
            return res.json({
                status: 'waiting',
                message: 'No active match found'
            });
        }

        const match = matchDoc.docs[0].data();
        const otherUserId = match.participants.find((id: string) => id !== userId);

        // Get matched user's profile
        const otherUserDoc = await db.collection('users').doc(otherUserId).get();
        const otherUserData = otherUserDoc.data();

        // Calculate phase and remaining time
        const matchStartTime = new Date(match.startTime);
        const elapsedMinutes = (now.getTime() - matchStartTime.getTime()) / (1000 * 60);

        let currentState: MatchState;

        if (elapsedMinutes < 60) {
            // First hour: Video call
            currentState = {
                status: 'video_call',
                matchedUserId: otherUserId,
                matchStartTime: matchStartTime,
                currentPhase: 'video',
                phaseEndTime: new Date(matchStartTime.getTime() + 60 * 60 * 1000)
            };
        } else if (elapsedMinutes < 120) {
            // Second hour: Chat
            currentState = {
                status: 'chat',
                matchedUserId: otherUserId,
                matchStartTime: matchStartTime,
                currentPhase: 'chat',
                phaseEndTime: new Date(matchStartTime.getTime() + 120 * 60 * 1000)
            };
        } else {
            // Match completed
            currentState = {
                status: 'completed',
                matchedUserId: otherUserId,
                matchStartTime: matchStartTime
            };
        }

        const response: UserMatch = {
            matchedUser: {
                uid: otherUserId,
                displayName: otherUserData?.displayName || 'Anonymous',
                photoURL: otherUserData?.photoURL
            },
            state: currentState
        };

        res.json(response);

    } catch (error) {
        next(error);
    }
};

export const joinMatchingPool = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Check if user is already in a match for the current hour
        const now = new Date();
        const currentHour = now.getUTCHours();
        const currentDate = now.toISOString().split('T')[0];

        const existingMatch = await db.collection('matches')
            .where('participants', 'array-contains', userId)
            .where('date', '==', currentDate)
            .where('hour', '==', currentHour)
            .limit(1)
            .get();

        if (!existingMatch.empty) {
            return res.status(400).json({
                message: 'Already in a match for this hour'
            });
        }

        // Add user to matching pool
        const poolRef = db.collection('matching_pool');

        // Check if already in pool
        const existingPoolEntry = await poolRef
            .where('userId', '==', userId)
            .limit(1)
            .get();

        if (!existingPoolEntry.empty) {
            return res.json({
                message: 'Already in matching pool',
                position: existingPoolEntry.docs[0].data().joinedAt
            });
        }

        // Add to pool
        const poolEntry: MatchingPool = {
            userId,
            joinedAt: now,
            preferences: req.body.preferences || {}
        };

        await poolRef.add(poolEntry);

        // Try to find a match immediately
        await tryCreateMatch(userId);

        res.json({
            message: 'Joined matching pool',
            joinedAt: now
        });

    } catch (error) {
        next(error);
    }
};

export const leaveMatchingPool = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Remove from pool
        const poolRef = db.collection('matching_pool');
        const poolEntries = await poolRef
            .where('userId', '==', userId)
            .get();

        const batch = db.batch();
        poolEntries.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        res.json({ message: 'Left matching pool' });

    } catch (error) {
        next(error);
    }
};

async function tryCreateMatch(userId: string): Promise<boolean> {
    const poolRef = db.collection('matching_pool');

    // Start a transaction to ensure atomic matching
    return await db.runTransaction(async (transaction) => {
        // Get all users in pool except current user
        const poolSnapshot = await transaction.get(
            poolRef
                .where('userId', '!=', userId)
                .orderBy('userId')
                .orderBy('joinedAt')
        );

        if (poolSnapshot.empty) {
            return false;
        }

        // Get current user's pool entry
        const userPoolEntry = await transaction.get(
            poolRef.where('userId', '==', userId).limit(1)
        );

        if (userPoolEntry.empty) {
            return false;
        }

        // Randomly select a match from the pool
        const availableMatches = poolSnapshot.docs;
        const randomIndex = Math.floor(Math.random() * availableMatches.length);
        const matchedUser = availableMatches[randomIndex];

        // Create the match
        const now = new Date();
        const match = {
            participants: [userId, matchedUser.data().userId],
            date: now.toISOString().split('T')[0],
            hour: now.getUTCHours(),
            startTime: now,
            status: 'active'
        };

        // Add match to database
        const matchRef = db.collection('matches').doc();
        transaction.set(matchRef, match);

        // Remove both users from the pool
        transaction.delete(userPoolEntry.docs[0].ref);
        transaction.delete(matchedUser.ref);

        return true;
    });
}

// Optional: Periodic matching function
export async function processMatchingPool() {
    const poolRef = db.collection('matching_pool');
    const poolSnapshot = await poolRef.orderBy('joinedAt').get();

    const processedUsers = new Set<string>();

    for (const doc of poolSnapshot.docs) {
        const userId = doc.data().userId;

        if (!processedUsers.has(userId)) {
            const matched = await tryCreateMatch(userId);
            if (matched) {
                processedUsers.add(userId);
            }
        }
    }
} 