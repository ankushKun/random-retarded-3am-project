import { useEffect, useState } from 'react';
import { useMatching } from '@/hooks/useMatching';
import VideoCallScreen from './VideoCallScreen';
import ChatScreen from './ChatScreen';

export default function MatchingScreen() {
    const { matchState, loading, error, joinPool, leavePool } = useMatching();
    const [timeRemaining, setTimeRemaining] = useState<string>('');

    // Update countdown timer
    useEffect(() => {
        if (!matchState.phaseEndTime) return;

        const updateTimer = () => {
            const now = new Date();
            const end = new Date(matchState.phaseEndTime!);
            const diff = end.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeRemaining('Times up!');
                return;
            }

            const minutes = Math.floor(diff / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [matchState.phaseEndTime]);

    // Render different screens based on match state
    const renderContent = () => {
        switch (matchState.status) {
            case 'waiting':
                return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">Find Your Match</h2>
                        <button
                            onClick={joinPool}
                            disabled={loading}
                            className="bg-pink-500 text-white px-6 py-3 rounded-full hover:bg-pink-600 disabled:opacity-50"
                        >
                            {loading ? 'Finding Match...' : 'Start Matching'}
                        </button>
                        {error && <p className="text-red-500 mt-2">{error}</p>}
                    </div>
                );

            case 'video_call':
                return (
                    <div className="h-full">
                        <div className="bg-pink-500 text-white p-2 text-center">
                            Video Call Time Remaining: {timeRemaining}
                        </div>
                        <VideoCallScreen
                            matchedUser={matchState.matchedUser!}
                            onTimeUp={() => {/* Handle time up */ }}
                        />
                    </div>
                );

            case 'chat':
                return (
                    <div className="h-full">
                        <div className="bg-pink-500 text-white p-2 text-center">
                            Chat Time Remaining: {timeRemaining}
                        </div>
                        <ChatScreen
                            matchedUser={matchState.matchedUser!}
                            onTimeUp={() => {/* Handle time up */ }}
                        />
                    </div>
                );

            case 'completed':
                return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">Match Completed</h2>
                        <p>Your time with {matchState.matchedUser?.displayName} has ended.</p>
                        <button
                            onClick={joinPool}
                            className="bg-pink-500 text-white px-6 py-3 rounded-full hover:bg-pink-600 mt-4"
                        >
                            Find New Match
                        </button>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="max-w-4xl mx-auto p-4">
                {renderContent()}
            </div>
        </div>
    );
} 