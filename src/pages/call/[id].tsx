import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { getMatchmakingStatus, updatePeerId } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import Peer, { MediaConnection } from 'peerjs';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Timestamp } from 'firebase/firestore';
import { setGlobalStream, stopMediaStream } from '../../utils/media';

export default function CallPage() {
    const router = useRouter();
    const { id: sessionId } = router.query;
    const { user } = useAuth();
    const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<{
        type: 'connecting' | 'connected' | 'disconnected' | 'failed' | 'checking' | 'closed';
        detail: string;
    }>({ type: 'connecting', detail: 'Initializing...' });

    // PeerJS states
    const [peer, setPeer] = useState<Peer | null>(null);
    const [currentCall, setCurrentCall] = useState<MediaConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    // Add state for partner's peer ID
    const [partnerPeerId, setPartnerPeerId] = useState<string | null>(null);

    // Add state for remote user's media status
    const [remoteIsMuted, setRemoteIsMuted] = useState(false);
    const [remoteIsVideoOff, setRemoteIsVideoOff] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Add these new state variables at the top of the component
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string>('');

    // Add state for camera selector visibility
    const [isCameraSelectorOpen, setIsCameraSelectorOpen] = useState(false);

    // Add at the start of the component
    useEffect(() => {
        console.log('Component mounted with:', {
            sessionId,
            userId: user?.uid,
            connectionStatus,
            hasPeer: !!peer,
            hasCurrentCall: !!currentCall
        });
    }, []);

    // Initialize peer connection
    useEffect(() => {
        if (!user || !sessionId) return;

        const initializePeer = () => {
            console.log('Initializing peer with session:', sessionId);
            const randomSuffix = Math.random().toString(36).substring(2, 15);
            const myPeerId = `${sessionId}-${user.uid}-${randomSuffix}`;
            console.log('Generated peer ID:', myPeerId);

            const newPeer = new Peer(myPeerId, {
                host: '0.peerjs.com',
                port: 443,
                path: '/',
                secure: true,
                debug: 3,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            // Set up media stream early
            const setupMediaStream = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: selectedCamera ? { deviceId: selectedCamera } : true,
                        audio: true
                    });
                    setLocalStream(stream);
                    setGlobalStream(stream);
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = stream;
                    }
                    return stream;
                } catch (err) {
                    console.error('Failed to get local stream:', err);
                    setError('Failed to access camera/microphone');
                    return null;
                }
            };

            newPeer.on('open', async () => {
                console.log('Peer connection opened:', myPeerId);
                setPeer(newPeer);
                setConnectionStatus({
                    type: 'connected',
                    detail: 'Connected'
                });

                // Set up local media stream
                const stream = await setupMediaStream();
                if (!stream) return;

                try {
                    console.log('Storing peer ID via API...');
                    await updatePeerId(sessionId as string, myPeerId);
                    console.log('Successfully stored peer ID');

                    const attemptConnection = async () => {
                        console.log('Checking for partner peer ID...');
                        const status = await getMatchmakingStatus();
                        console.log('Status response:', status);

                        if (status.partnerId && status.peerIds?.[status.partnerId]) {
                            const partnerPeerId = status.peerIds[status.partnerId];
                            console.log('Partner peer ID found:', partnerPeerId);
                            setPartnerPeerId(partnerPeerId);

                            // Both peers try to call each other, but only the first successful call will be established
                            if (!currentCall) {
                                try {
                                    console.log('Attempting to initiate call to:', partnerPeerId);
                                    const call = newPeer.call(partnerPeerId, stream);
                                    setupCallHandlers(call);
                                } catch (error) {
                                    console.error('Call initiation failed:', error);
                                }
                            }
                        } else {
                            console.log('No partner peer ID yet, retrying in 1s');
                            setTimeout(attemptConnection, 1000);
                        }
                    };

                    attemptConnection();
                } catch (error) {
                    console.error('Peer setup failed:', error);
                    setError('Failed to connect with partner');
                }
            });

            newPeer.on('call', async (call) => {
                console.log('Received incoming call from:', call.peer);
                const stream = localStream || await setupMediaStream();
                if (!stream) return;

                if (!currentCall) {
                    console.log('Answering incoming call');
                    call.answer(stream);
                    setupCallHandlers(call);
                } else {
                    console.log('Already in a call, ignoring incoming call');
                }
            });

            newPeer.on('error', (error) => {
                console.error('Peer error:', { type: error.type, message: error.message });
                if (error.type === 'unavailable-id') {
                    console.log('Retrying with new peer ID...');
                    initializePeer();
                } else {
                    setError(`Connection error: ${error.type}`);
                }
            });

            newPeer.on('disconnected', () => {
                console.log('Peer disconnected, attempting reconnect');
                setConnectionStatus({
                    type: 'disconnected',
                    detail: 'Connection interrupted - attempting to reconnect...'
                });
                newPeer.reconnect();
            });

            setPeer(newPeer);
        };

        const updateConnectionStatus = (pc: RTCPeerConnection) => {
            pc.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', pc.iceConnectionState);
                switch (pc.iceConnectionState) {
                    case 'checking':
                        setConnectionStatus({
                            type: 'checking',
                            detail: 'Establishing connection...'
                        });
                        break;
                    case 'connected':
                        setConnectionStatus({
                            type: 'connected',
                            detail: 'Connected'
                        });
                        break;
                    case 'completed':
                        setConnectionStatus({
                            type: 'connected',
                            detail: 'Connection optimized'
                        });
                        break;
                    case 'disconnected':
                        setConnectionStatus({
                            type: 'disconnected',
                            detail: 'Connection interrupted - attempting to reconnect...'
                        });
                        break;
                    case 'failed':
                        setConnectionStatus({
                            type: 'failed',
                            detail: 'Connection failed - please refresh'
                        });
                        break;
                    case 'closed':
                        setConnectionStatus({
                            type: 'closed',
                            detail: 'Connection closed'
                        });
                        break;
                }
            };

            // Monitor connection quality
            if (pc.getStats) {
                setInterval(async () => {
                    try {
                        const stats = await pc.getStats();
                        let totalPacketsLost = 0;
                        let totalPackets = 0;

                        stats.forEach(stat => {
                            if (stat.type === 'inbound-rtp' && 'packetsLost' in stat) {
                                totalPacketsLost += stat.packetsLost as number;
                                totalPackets += (stat.packetsReceived as number) + (stat.packetsLost as number);
                            }
                        });

                        if (totalPackets > 0) {
                            const lossRate = (totalPacketsLost / totalPackets) * 100;
                            if (lossRate > 15) {
                                setConnectionStatus(prev => ({
                                    ...prev,
                                    detail: 'Poor connection quality'
                                }));
                            }
                        }
                    } catch (error) {
                        console.error('Failed to get connection stats:', error);
                    }
                }, 5000);
            }
        };

        const setupCallHandlers = (call: MediaConnection) => {
            setCurrentCall(call);
            setConnectionStatus({
                type: 'connecting',
                detail: 'Connecting to peer...'
            });

            // Access the underlying RTCPeerConnection
            if (call.peerConnection) {
                updateConnectionStatus(call.peerConnection);
            }

            call.on('stream', (remoteStream) => {
                console.log('Received remote stream');
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }

                // Track remote media status changes
                remoteStream.getAudioTracks().forEach(track => {
                    track.onmute = () => setRemoteIsMuted(true);
                    track.onunmute = () => setRemoteIsMuted(false);
                    setRemoteIsMuted(!track.enabled);
                });

                remoteStream.getVideoTracks().forEach(track => {
                    track.onmute = () => setRemoteIsVideoOff(true);
                    track.onunmute = () => setRemoteIsVideoOff(false);
                    setRemoteIsVideoOff(!track.enabled);
                });
            });

            call.on('error', (err) => {
                console.error('Call error:', err);
                setError('Call connection failed');
                setConnectionStatus({
                    type: 'failed',
                    detail: 'Call failed - please refresh'
                });
                cleanupMedia();
            });

            call.on('close', () => {
                console.log('Call closed');
                setConnectionStatus({
                    type: 'closed',
                    detail: 'Call ended'
                });
                cleanupMedia();
            });
        };

        initializePeer();

        return () => {
            console.log('Component unmounting, cleaning up...');
            cleanupMedia();
            stopMediaStream();
            if (sessionId && user) {
                console.log('Removing peer ID via API');
                updatePeerId(sessionId as string, null).catch(error =>
                    console.error('Failed to remove peer ID:', error)
                );
            }
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

                if (status.videoTimeLeft) {
                    setTimeLeft(Math.floor(status.videoTimeLeft / 1000));
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

            // Update session status to chat phase
            if (sessionId) {
                const sessionRef = doc(db, 'sessions', sessionId as string);
                updateDoc(sessionRef, {
                    status: 'chat'
                }).catch(console.error);
            }

            router.push(`/chat/${sessionId}`);
        } else {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [timeLeft, sessionId, router]);

    const cleanupMedia = () => {
        console.log('Cleaning up media...', {
            hasLocalStream: !!localStream,
            hasCurrentCall: !!currentCall,
            hasPeer: !!peer
        });
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

    // Add this new useEffect to get available devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                setDevices(videoDevices);

                // Set default camera if none selected
                if (!selectedCamera && videoDevices.length > 0) {
                    setSelectedCamera(videoDevices[0].deviceId);
                }
            } catch (error) {
                console.error('Failed to get devices:', error);
            }
        };

        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        getDevices();

        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', getDevices);
        };
    }, []);

    // Add a function to switch camera
    const switchCamera = async (deviceId: string) => {
        setSelectedCamera(deviceId);
        if (localStream) {
            // Stop current tracks
            localStream.getVideoTracks().forEach(track => track.stop());

            try {
                // Get new stream with selected camera
                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId },
                    audio: false
                });

                // Replace video track
                const newVideoTrack = newStream.getVideoTracks()[0];
                const oldVideoTrack = localStream.getVideoTracks()[0];
                localStream.removeTrack(oldVideoTrack);
                localStream.addTrack(newVideoTrack);

                // Update local video
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                }

                // Update remote stream if in call
                if (currentCall) {
                    const sender = currentCall.peerConnection?.getSenders()
                        .find(sender => sender.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(newVideoTrack);
                    }
                }
            } catch (error) {
                console.error('Failed to switch camera:', error);
                setError('Failed to switch camera');
            }
        }
    };

    // Update the CameraSelector component
    function CameraSelector() {
        return (
            <div className="relative">
                <button
                    className="p-4 rounded-full bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                    title="Switch Camera"
                    onClick={() => setIsCameraSelectorOpen(!isCameraSelectorOpen)}
                >
                    <SwitchCameraIcon />
                </button>
                {isCameraSelectorOpen && (
                    <>
                        {/* Backdrop to close selector when clicking outside */}
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsCameraSelectorOpen(false)}
                        />
                        <div className="absolute bottom-full mb-2 z-20 min-w-[200px] bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                            {devices.map(device => (
                                <button
                                    key={device.deviceId}
                                    onClick={() => {
                                        switchCamera(device.deviceId);
                                        setIsCameraSelectorOpen(false);
                                    }}
                                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 ${selectedCamera === device.deviceId ? 'bg-gray-700' : ''
                                        }`}
                                >
                                    {device.label || `Camera ${devices.indexOf(device) + 1}`}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Add this icon component
    function SwitchCameraIcon() {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 4h-3.5L15 2H9L7.5 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
                <path d="M15 11v-1a3 3 0 0 0-6 0v1" />
                <path d="M15 11a3 3 0 0 1-6 0" />
            </svg>
        );
    }

    return (
        <Layout>
            <div className="min-h-[calc(100vh-4rem)] bg-gray-900 relative">
                {/* Main video container */}
                <div className="h-[calc(100vh-4rem)] relative">
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={`w-full h-full object-cover ${remoteIsVideoOff ? 'invisible' : 'visible'}`}
                    />
                    {remoteIsVideoOff && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                            <div className="h-32 w-32 rounded-full bg-gray-700 flex items-center justify-center">
                                <span className="text-4xl text-gray-400">
                                    {partnerPeerId?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Local video pip */}
                    <div className="absolute top-4 right-4 w-48 rounded-lg overflow-hidden shadow-lg">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full aspect-video object-cover bg-gray-800 ${isVideoOff ? 'invisible' : 'visible'}`}
                        />
                        {isVideoOff && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                <div className="h-12 w-12 rounded-full bg-gray-700 flex items-center justify-center">
                                    <span className="text-xl text-gray-400">
                                        {user?.email?.charAt(0)?.toUpperCase() || '?'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status indicators */}
                    <div className="absolute top-4 left-4 flex gap-2">
                        <div className={`text-sm px-3 py-1 rounded-lg flex items-center gap-2 ${error ? 'bg-red-500/90 text-white' :
                            connectionStatus.type === 'connected' ? 'bg-green-500/90 text-white' :
                                connectionStatus.type === 'checking' ? 'bg-yellow-500/90 text-white' :
                                    connectionStatus.type === 'failed' ? 'bg-red-500/90 text-white' :
                                        'bg-gray-900/90 text-white'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${connectionStatus.type === 'connected' ? 'bg-green-300' :
                                connectionStatus.type === 'checking' ? 'bg-yellow-300' :
                                    connectionStatus.type === 'failed' ? 'bg-red-300' :
                                        'bg-gray-300'
                                }`} />
                            {error || connectionStatus.detail}
                        </div>
                        {remoteIsMuted && (
                            <div className="bg-gray-900/90 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1">
                                <MicIcon muted />
                                Muted
                            </div>
                        )}
                    </div>

                    {/* Control bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/70 to-transparent">
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
                            <button
                                onClick={toggleMute}
                                className={`p-4 rounded-full ${isMuted
                                    ? 'bg-red-500 hover:bg-red-600'
                                    : 'bg-gray-800 hover:bg-gray-700'
                                    } text-white transition-colors`}
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                <MicIcon muted={isMuted} />
                            </button>
                            <button
                                onClick={toggleVideo}
                                className={`p-4 rounded-full ${isVideoOff
                                    ? 'bg-red-500 hover:bg-red-600'
                                    : 'bg-gray-800 hover:bg-gray-700'
                                    } text-white transition-colors`}
                                title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                            >
                                <CameraIcon disabled={isVideoOff} />
                            </button>
                            {devices.length > 1 && <CameraSelector />}
                        </div>

                        {/* Timer */}
                        <div className="absolute bottom-6 right-4">
                            <div className="text-white/90 font-medium">
                                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function MicIcon({ muted = false }: { muted?: boolean }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {muted ? (
                <>
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                </>
            ) : (
                <>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                </>
            )}
        </svg>
    );
}

function CameraIcon({ disabled = false }: { disabled?: boolean }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {disabled ? (
                <>
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M15 7h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4" />
                    <path d="M10.66 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3.34" />
                </>
            ) : (
                <>
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </>
            )}
        </svg>
    );
} 