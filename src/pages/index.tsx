import Image from "next/image";
import localFont from "next/font/local";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { useRouter } from 'next/router';
import { joinMatchmaking, getMatchmakingStatus } from '../utils/api';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

type MatchmakingStatus = {
  status: 'idle' | 'queued' | 'in_session' | 'cooldown';
  timeLeft?: number;
  sessionId?: string;
  cooldownEnd?: number;
  queuedAt?: Date;
  queuePosition?: number;
  totalInQueue?: number;
};

export default function Home() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<MatchmakingStatus>({ status: 'idle' });

  // Poll for status updates
  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      try {
        const statusData = await getMatchmakingStatus();
        setStatus(statusData);

        // Redirect to call page if matched
        if (statusData.status === 'in_session' && statusData.sessionId) {
          router.push(`/call/${statusData.sessionId}`);
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    };

    const interval = setInterval(checkStatus, 3000);
    checkStatus(); // Initial check

    return () => clearInterval(interval);
  }, [user, router]);

  const startMatching = async () => {
    try {
      setError(null);
      setIsSearching(true);
      const response = await joinMatchmaking();

      if (response.error) {
        setError(response.error);
        setIsSearching(false);
      }
    } catch (error) {
      console.error('Failed to join matchmaking:', error);
      setError('Failed to join matchmaking');
      setIsSearching(false);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!user) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
            Welcome to DateLock
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8 text-center max-w-md">
            Connect with people through meaningful video conversations.
            One hour to make a lasting impression.
          </p>
          <button
            onClick={signInWithGoogle}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            <Image
              src="https://www.google.com/favicon.ico"
              alt="Google"
              width={20}
              height={20}
            />
            Sign in to Start
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4">
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        {status.status === 'cooldown' && status.timeLeft && (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Cooldown Period
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              You can start a new match in:
            </p>
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
              {formatTime(status.timeLeft)}
            </div>
          </div>
        )}

        {status.status === 'queued' && (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-600 dark:text-gray-300">
              Finding your match...
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Queue time: {status.queuedAt &&
                formatTime(Date.now() - new Date(status.queuedAt).getTime())
              }
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Position: {status.queuePosition} of {status.totalInQueue} in queue
            </p>
          </div>
        )}

        {status.status === 'idle' && (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Ready to meet someone new?
            </h2>
            {status.totalInQueue !== undefined && status.totalInQueue > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {status.totalInQueue} {status.totalInQueue === 1 ? 'person' : 'people'} waiting to match
              </p>
            )}
            <button
              onClick={startMatching}
              disabled={isSearching}
              className={`bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all text-lg ${isSearching ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              Start Matching
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
