import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { getMatchmakingStatus } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import Peer, { MediaConnection } from 'peerjs';

export default function CallPage() {
    const router = useRouter();
    const { id: sessionId } = router.query;
    const { user } = useAuth();
    const [timeLeft, setTimeLeft] = useState(3600); // 1 hour in seconds
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState('Initializing...');

    // PeerJS states
    const [peer, setPeer] = useState<Peer | null>(null);
    const [currentCall, setCurrentCall] = useState<MediaConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Initialize peer connection
    useEffect(() => {
        if (!user || !sessionId) return;

        const initializePeer = () => {
            // Generate a random suffix to ensure uniqueness
            const randomSuffix = Math.random().toString(36).substring(2, 15);
            const peerId = `${sessionId}-${user.uid}-${randomSuffix}`;

            const newPeer = new Peer(peerId, {
                host: '0.peerjs.com',
                port: 443,
                path: '/',
                secure: true,
                debug: 3, // Add debug level for more detailed logs
                config: { // Add STUN/TURN servers for better connectivity
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            newPeer.on('open', async () => {
                setPeer(newPeer);
                setConnectionStatus('Connected to server');

                try {
                    // Get session data to find partner
                    const status = await getMatchmakingStatus();
                    if (status.partnerId && status.partnerId !== user.uid) {
                        // Wait a short time to ensure both peers are ready
                        setTimeout(() => {
                            // The user with the smaller UID initiates the call
                            if (user.uid < status.partnerId!) {
                                startCall(`${sessionId}-${status.partnerId}-${randomSuffix}`);
                            }
                        }, 1000);
                    }
                } catch (error) {
                    console.error('Failed to get partner info:', error);
                    setError('Failed to connect with partner');
                }
            });

            newPeer.on('call', handleIncomingCall);

            newPeer.on('error', (error) => {
                console.error('Peer error:', error);
                // Retry connection if error is due to ID being taken
                if (error.type === 'unavailable-id') {
                    console.log('Retrying with new peer ID...');
                    initializePeer();
                } else {
                    setError(`Connection error: ${error.type}`);
                }
            });

            newPeer.on('disconnected', () => {
                setConnectionStatus('Disconnected - Attempting to reconnect...');
                newPeer.reconnect();
            });
        };

        initializePeer();

        return () => {
            cleanupMedia();
        };
    }, [user, sessionId]);

    // Session timer and verification
    useEffect(() => {
        if (!user || !sessionId) return;

        const checkSession = async () => {
            try {
                const status = await getMatchmakingStatus();

                if (status.status !== 'in_session' || status.sessionId !== sessionId) {
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
        checkSession();

        return () => clearInterval(interval);
    }, [sessionId, user, router]);

    // Timer effect
    useEffect(() => {
        if (timeLeft <= 0) {
            cleanupMedia();
            router.push(`/chat/${sessionId}`);
        } else {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [timeLeft, sessionId, router]);

    const cleanupMedia = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        if (currentCall) {
            currentCall.close();
            setCurrentCall(null);
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        if (peer) {
            peer.destroy();
        }
    };

    const handleIncomingCall = async (call: MediaConnection) => {
        try {
            setConnectionStatus('Incoming call...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            call.answer(stream);
            setCurrentCall(call);

            call.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                    setConnectionStatus('Connected');
                }
            });

            call.on('close', () => {
                setConnectionStatus('Call ended');
                cleanupMedia();
            });

        } catch (err) {
            console.error('Failed to get local stream:', err);
            setError('Failed to access camera/microphone');
        }
    };

    const startCall = async (targetPeerId: string) => {
        if (!peer) {
            setError('Connection not ready');
            return;
        }

        try {
            setConnectionStatus('Starting call...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            const call = peer.call(targetPeerId, stream);
            setCurrentCall(call);

            call.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                    setConnectionStatus('Connected');
                }
            });

            call.on('close', () => {
                setConnectionStatus('Call ended');
                cleanupMedia();
            });

        } catch (err) {
            console.error('Failed to start call:', err);
            setError('Failed to start call');
        }
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

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
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="aspect-video w-full bg-gray-800"
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                        <button
                            onClick={toggleMute}
                            className={`p-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-800'} hover:bg-gray-700 text-white`}
                        >
                            <MicIcon />
                        </button>
                        <button
                            onClick={toggleVideo}
                            className={`p-2 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-gray-800'} hover:bg-gray-700 text-white`}
                        >
                            <CameraIcon />
                        </button>
                    </div>
                </div>

                <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="aspect-video w-full bg-gray-800"
                    />
                    <div className="absolute top-4 left-4 text-sm text-white bg-black/50 px-3 py-1 rounded-full">
                        {connectionStatus}
                    </div>
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