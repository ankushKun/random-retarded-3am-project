import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getCurrentMatchState, joinMatchingPool, leaveMatchingPool } from '@/lib/api';

export interface MatchState {
    status: 'waiting' | 'matched' | 'video_call' | 'chat' | 'completed';
    matchedUser?: {
        uid: string;
        displayName: string;
        photoURL?: string;
    };
    currentPhase?: 'video' | 'chat';
    phaseEndTime?: Date;
}

export function useMatching() {
    const { user } = useAuth();
    const [matchState, setMatchState] = useState<MatchState>({ status: 'waiting' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch match state periodically
    useEffect(() => {
        if (!user) return;

        const fetchMatchState = async () => {
            try {
                const state = await getCurrentMatchState();
                setMatchState(state);
            } catch (err) {
                console.error('Error fetching match state:', err);
            }
        };

        // Initial fetch
        fetchMatchState();

        // Poll every 5 seconds
        const interval = setInterval(fetchMatchState, 5000);

        return () => clearInterval(interval);
    }, [user]);

    const joinPool = async () => {
        if (!user) return;

        setLoading(true);
        setError(null);

        try {
            await joinMatchingPool();
            // State will be updated by the polling effect
        } catch (err) {
            setError('Failed to join matching pool');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const leavePool = async () => {
        if (!user) return;

        setLoading(true);
        setError(null);

        try {
            await leaveMatchingPool();
            setMatchState({ status: 'waiting' });
        } catch (err) {
            setError('Failed to leave matching pool');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return {
        matchState,
        loading,
        error,
        joinPool,
        leavePool
    };
} 