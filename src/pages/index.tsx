import Image from "next/image";
import localFont from "next/font/local";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { useRouter } from 'next/router';
import { joinMatchmaking, getMatchmakingStatus, cancelMatchmaking, createMatch } from '../utils/api';
import ProfileSetup from '../components/ProfileSetup';

type MatchmakingStatus = {
  status: 'idle' | 'queued' | 'in_session' | 'cooldown' | 'connecting' | 'error';
  timeLeft?: number;
  sessionId?: string;
  cooldownEnd?: number;
  queuedAt?: Date;
  queuePosition?: number;
  totalInQueue?: number;
  connectionStatus?: string;
  lastUpdated?: number;
};

export default function Home() {
  const { user, signInWithGoogle, profileComplete } = useAuth();
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<MatchmakingStatus>({ status: 'idle' });
  const [lastStatusUpdate, setLastStatusUpdate] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  const getTimeSinceUpdate = () => {
    const seconds = Math.floor((new Date().getTime() - lastStatusUpdate.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
  };

  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      try {
        if (isRedirecting) return;

        console.log('Checking matchmaking status...');
        setConnectionStatus('Checking status...');
        const statusData = await getMatchmakingStatus();
        console.log('Status received:', statusData);
        setStatus(statusData);
        setLastStatusUpdate(new Date());
        setConnectionStatus('Connected');

        switch (statusData.status) {
          case 'in_session':
            setIsRedirecting(true);
            setConnectionStatus('Active video call found, redirecting...');
            await router.push(`/call/${statusData.sessionId}`);
            return;

          case 'in_chat':
            setIsRedirecting(true);
            setConnectionStatus('Active chat found, redirecting...');
            await router.push(`/chat/${statusData.sessionId}`);
            return;

          case 'queued':
            if (statusData.totalInQueue >= 2) {
              setConnectionStatus('Attempting to create match...');
              try {
                const matchResult = await createMatch();
                console.log('Match creation result:', matchResult);
                if (matchResult.sessionId) {
                  setIsRedirecting(true);
                  setConnectionStatus('Match found! Redirecting...');
                  await router.push(`/call/${matchResult.sessionId}`);
                  return;
                }
              } catch (error) {
                console.error('Match creation failed:', error);
                setConnectionStatus('Match creation failed, retrying...');
              }
            }
            break;
        }
      } catch (error) {
        console.error('Status check failed:', error);
        setConnectionStatus('Connection lost, retrying...');
        setError('Failed to connect to server');
      }
    };

    const interval = setInterval(checkStatus, 5000);
    checkStatus();

    return () => {
      clearInterval(interval);
      setIsRedirecting(false);
    };
  }, [user, router, isRedirecting]);

  const startMatching = async () => {
    console.log('Starting matchmaking process...');
    try {
      setError(null);
      setIsSearching(true);
      const response = await joinMatchmaking();
      console.log('Join matchmaking response:', response);

      if (response.error) {
        console.error('Join matchmaking error:', response.error);
        setError(response.error);
        setIsSearching(false);
      }
    } catch (error) {
      console.error('Failed to join matchmaking:', error);
      setError('Failed to join matchmaking');
      setIsSearching(false);
    }
  };

  const cancelSearch = async () => {
    try {
      setError(null);
      await cancelMatchmaking();
      setIsSearching(false);
    } catch (error) {
      console.error('Failed to cancel matchmaking:', error);
      setError('Failed to cancel matchmaking');
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderMainContent = () => {
    const content = (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4">
        <div className="max-w-3xl text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-8">
            Call Me Maybe 🤙
          </h1>
          <div className="space-y-12 mb-12">
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Meet interesting people through quick video conversations.
              No swiping, no endless chats - just real connections.
            </p>

            {/* How it Works Section */}
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-8">
                How It Works
              </h2>
              <div className="grid md:grid-cols-4 gap-8">
                <div className="relative">
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm p-6 h-full">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                      1
                    </div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mt-2 mb-3">
                      Sign Up
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      Quick sign in with Google. No lengthy forms or verification needed.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm p-6 h-full">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                      2
                    </div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mt-2 mb-3">
                      Get Matched
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      Get matched with someone looking to meet new people.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm p-6 h-full">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                      3
                    </div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mt-2 mb-3">
                      15 Min Call
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      Have a meaningful 15-minute video conversation. No pressure, just be yourself.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm p-6 h-full">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                      4
                    </div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mt-2 mb-3">
                      Connect
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      If you both click, you have 5 minutes to chat or exchange contact.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-3 gap-6 text-left mt-12">
              <div className="p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">
                  ⏱️ Quick Connection
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  15 minutes to spark a connection. If it clicks, get 5 more minutes to exchange contacts!
                </p>
              </div>

              <div className="p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">
                  🎯 Smart Matching
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Meet new people and discover unexpected connections through random matching.
                </p>
              </div>

              <div className="p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">
                  🎭 No Games, Just Real
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Skip the small talk. Have meaningful conversations that matter.
                </p>
              </div>
            </div>

            {/* Sign In Button */}
            {!user ? (
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all mx-auto mt-8"
              >
                <Image
                  src="https://www.google.com/favicon.ico"
                  alt="Google"
                  width={20}
                  height={20}
                />
                <span className="text-lg">Start Your Journey</span>
              </button>
            ) : (
              <div className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
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
                    <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
                    <p className="text-gray-600 dark:text-gray-300">
                      {connectionStatus || 'Finding your match...'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Queue time: {status.queuedAt &&
                        formatTime(Date.now() - new Date(status.queuedAt).getTime())
                      }
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Position: {status.queuePosition} of {status.totalInQueue} in queue
                    </p>
                    <button
                      onClick={cancelSearch}
                      className="mt-6 px-6 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {status.status === 'idle' && (
                  <button
                    onClick={startMatching}
                    disabled={isSearching}
                    className={`bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all text-lg mx-auto block ${isSearching ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Start Matching
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );

    return content;
  };

  if (!user) {
    return (
      <Layout title="Welcome">
        {renderMainContent()}
      </Layout>
    );
  }

  if (!profileComplete) {
    return (
      <Layout>
        <ProfileSetup onComplete={() => window.location.reload()} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="fixed top-0 left-0 right-0 bg-gray-100 dark:bg-gray-800 p-2 text-sm">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'Connected'
              ? 'bg-green-500'
              : connectionStatus.includes('failed')
                ? 'bg-red-500'
                : 'bg-yellow-500'
              }`} />
            <span className="text-gray-600 dark:text-gray-300">{connectionStatus}</span>
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Last updated: {getTimeSinceUpdate()}
          </div>
        </div>
      </div>
      {renderMainContent()}
    </Layout>
  );
}
