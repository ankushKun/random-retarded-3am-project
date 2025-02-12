import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { getMatchmakingStatus } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

export default function CallPage() {
    const router = useRouter();
    const { id } = router.query;
    const { user } = useAuth();
    const [timeLeft, setTimeLeft] = useState(3600); // 1 hour in seconds
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !id) return;

        const checkSession = async () => {
            try {
                const status = await getMatchmakingStatus();

                if (status.status !== 'in_session' || status.sessionId !== id) {
                    router.push('/');
                    return;
                }

                if (status.timeLeft) {
                    setTimeLeft(Math.floor(status.timeLeft / 1000));
                }
            } catch (error) {
                console.error('Session check failed:', error);
                setError('Failed to verify session');
            }
        };

        const interval = setInterval(checkSession, 5000);
        checkSession(); // Initial check

        return () => clearInterval(interval);
    }, [id, user, router]);

    useEffect(() => {
        if (timeLeft <= 0) {
            router.push(`/chat/${id}`);
        }
    }, [timeLeft, id, router]);

    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [timeLeft]);

    if (error) {
        return (
            <Layout>
                <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-4 rounded-lg">
                        {error}
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                    {/* Local video */}
                    <div className="aspect-video w-full bg-gray-800" />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                        <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white">
                            <MicIcon />
                        </button>
                        <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white">
                            <CameraIcon />
                        </button>
                    </div>
                </div>

                <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                    {/* Remote video */}
                    <div className="aspect-video w-full bg-gray-800" />
                </div>

                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 px-6 py-3 rounded-full shadow-lg">
                    <div className="text-xl font-semibold text-purple-600 dark:text-purple-400">
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                </div>
            </div>
        </Layout>
    );
}

const MicIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
);

const CameraIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
); 