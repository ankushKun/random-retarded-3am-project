import Image from "next/image";
import localFont from "next/font/local";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { useRouter } from 'next/router';
import { joinMatchmaking, getMatchmakingStatus, cancelMatchmaking, createMatch, endSession } from '../utils/api';
import ProfileSetup from '../components/ProfileSetup';
import Link from 'next/link';

type MatchmakingStatus = {
  status: 'idle' | 'queued' | 'in_session' | 'cooldown' | 'connecting' | 'error' | 'matched';
  timeLeft?: number;
  sessionId?: string;
  cooldownEnd?: number;
  queuedAt?: Date;
  queuePosition?: number;
  totalInQueue?: number;
  partnerId?: string;
  partnerName?: string;
  connectionStatus?: string;
  lastUpdated?: number;
  activeSessionId?: string;
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

  useEffect(() => {
    const { cleanup } = router.query;
    if (cleanup === 'true') {
      // Remove the cleanup parameter from the URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      // Refresh the page
      window.location.reload();
    }
  }, [router.query]);

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
            setStatus({
              ...statusData,
              status: 'in_session',
              sessionId: statusData.sessionId,
              partnerId: statusData.partnerId,
              partnerName: statusData.partnerName
            });
            setConnectionStatus('Match Found');
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
                  setStatus({
                    ...statusData,
                    status: 'matched',
                    sessionId: matchResult.sessionId,
                    partnerId: matchResult.partnerId,
                    partnerName: matchResult.partnerName
                  });
                  setConnectionStatus('Match found!');
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
    let content = (
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

            {/* Primary Action Button */}
            {user ? (
              <div className="flex flex-col items-center gap-4 my-12">
                <div className="flex flex-col items-center gap-2">
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    {status.totalInQueue === 1 ? (
                      '1 person in queue'
                    ) : (
                      `${status.totalInQueue || 0} people in queue`
                    )}
                  </div>

                  <button
                    onClick={isSearching ? cancelSearch : startMatching}
                    disabled={isRedirecting}
                    className="transform hover:scale-105 transition-all duration-200 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xl font-semibold px-12 py-6 rounded-2xl shadow-lg hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                  >
                    {isSearching ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        Finding a match...
                      </>
                    ) : (
                      <>
                        <span className="text-2xl">🎯</span>
                        Find a Match
                      </>
                    )}
                  </button>

                  {isSearching && (
                    <div className="flex flex-col items-center gap-2 mt-4">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <div className={`h-2 w-2 rounded-full ${status.status === 'error'
                          ? 'bg-red-500'
                          : status.status === 'queued'
                            ? 'bg-green-500'
                            : 'bg-yellow-500'
                          }`} />
                        <span>{connectionStatus || 'Connecting...'}</span>
                      </div>
                      {status.status === 'queued' && status.queuePosition && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Your position: {status.queuePosition} of {status.totalInQueue}
                        </p>
                      )}
                      <button
                        onClick={cancelSearch}
                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 mt-2"
                      >
                        Cancel matching
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-red-500 dark:text-red-400">{error}</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 my-12">
                <button
                  onClick={signInWithGoogle}
                  className="transform hover:scale-105 transition-all duration-200 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-12 py-6 rounded-2xl shadow-lg hover:shadow-2xl flex items-center gap-3"
                >
                  <Image
                    src="https://www.google.com/favicon.ico"
                    alt="Google"
                    width={24}
                    height={24}
                    className="bg-white rounded-full p-1"
                  />
                  <span className="text-xl font-semibold">Sign in with Google</span>
                </button>
                <Link
                  href="/email"
                  className="text-lg text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 underline decoration-dotted"
                >
                  Or sign in with email
                </Link>
              </div>
            )}

            {/* How it Works Section */}
            {/* <div className="max-w-4xl mx-auto">
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
            </div> */}

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
          </div>
        </div>
      </div>
    );

    if (status.status === 'matched') {
      content = (
        <>
          {content}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl max-w-md w-full mx-4 shadow-xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🎉</span>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  Match Found!
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  You've been matched with{' '}
                  <span className="font-semibold text-purple-600 dark:text-purple-400">
                    {status.partnerName || 'someone'}
                  </span>
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push(`/call/${status.sessionId}`)}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
                  >
                    Join Video Call
                  </button>
                  <button
                    onClick={cancelSearch}
                    className="w-full text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-sm"
                  >
                    Cancel Match
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    }

    if (status.status === 'in_session') {
      content = (
        <>
          {content}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl max-w-md w-full mx-4 shadow-xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  Match Found
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  You have an active video call with{' '}
                  <span className="font-semibold text-purple-600 dark:text-purple-400">
                    {status.partnerName || 'someone'}
                  </span>
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push(`/call/${status.sessionId}`)}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
                  >
                    Join Call
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await endSession(status.sessionId!);
                        window.location.reload();
                      } catch (error) {
                        console.error('Error ending session:', error);
                        setError('Failed to end session');
                      }
                    }}
                    className="w-full text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-sm"
                  >
                    End Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    }

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
