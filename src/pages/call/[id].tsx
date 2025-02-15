import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { getMatchmakingStatus, updatePeerId, endSession } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import Peer, { MediaConnection } from 'peerjs';
import { doc, updateDoc, onSnapshot, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { setGlobalStream, stopMediaStream } from '../../utils/media';
import { logFirebaseEvent } from '../../lib/firebaseAnalytics';

interface Message {
    id: string;
    text: string;
    senderId: string;
    timestamp: Date;
}

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

    // Add state for chat
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);

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
                        { urls: 'stun:stun.relay.metered.ca:80' },
                        // { urls: 'turn:a.relay.metered.ca:80', username: 'YOUR_USERNAME', credential: 'YOUR_CREDENTIAL' },
                        // { urls: 'turn:a.relay.metered.ca:443', username: 'YOUR_USERNAME', credential: 'YOUR_CREDENTIAL' },
                        // { urls: 'turn:a.relay.metered.ca:443?transport=tcp', username: 'YOUR_USERNAME', credential: 'YOUR_CREDENTIAL' }
                    ],
                    iceTransportPolicy: 'all',
                    iceCandidatePoolSize: 10,
                    bundlePolicy: 'max-bundle',
                    rtcpMuxPolicy: 'require'
                }
            });

            // Set up media stream early
            const setupMediaStream = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                            frameRate: { ideal: 30, max: 60 },
                            aspectRatio: { ideal: 1.7777777778 },
                            // Enable hardware acceleration when available
                            // encoderConfig: {
                            //     bitrateMax: 1000000, // 1Mbps
                            //     bitrateMin: 250000,  // 250kbps
                            //     hardwareAcceleration: 'prefer-hardware'
                            // } as any
                        },
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                            sampleRate: 48000,
                            sampleSize: 16
                        }
                    });

                    // Set initial audio state based on isMuted
                    stream.getAudioTracks().forEach(track => {
                        track.enabled = !isMuted;
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

            // Enhanced connection quality monitoring
            if (pc.getStats) {
                let lastPacketLoss = 0;
                let consecutivePoorConnections = 0;

                setInterval(async () => {
                    try {
                        const stats = await pc.getStats();
                        let totalPacketsLost = 0;
                        let totalPackets = 0;
                        let currentBitrate = 0;
                        let lastTimestamp: number;
                        let lastBytes = 0;

                        stats.forEach(stat => {
                            if (stat.type === 'inbound-rtp' && 'packetsLost' in stat) {
                                totalPacketsLost += stat.packetsLost as number;
                                totalPackets += (stat.packetsReceived as number) + (stat.packetsLost as number);

                                // Calculate bitrate
                                if (lastTimestamp && 'bytesReceived' in stat) {
                                    const deltaTime = (stat.timestamp - lastTimestamp) / 1000;
                                    const deltaBytes = (stat.bytesReceived as number) - lastBytes;
                                    currentBitrate = (deltaBytes * 8) / deltaTime; // bits per second
                                }

                                if ('timestamp' in stat) {
                                    lastTimestamp = stat.timestamp;
                                }
                                if ('bytesReceived' in stat) {
                                    lastBytes = stat.bytesReceived as number;
                                }
                            }
                        });

                        if (totalPackets > 0) {
                            const lossRate = (totalPacketsLost / totalPackets) * 100;
                            const packetLossIncrease = totalPacketsLost - lastPacketLoss;
                            lastPacketLoss = totalPacketsLost;

                            // Adaptive quality management
                            if (lossRate > 15 || packetLossIncrease > 50) {
                                consecutivePoorConnections++;
                                if (consecutivePoorConnections >= 3) {
                                    // Reduce video quality
                                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                                    if (sender) {
                                        const params = sender.getParameters();
                                        if (!params.encodings) {
                                            params.encodings = [{}];
                                        }
                                        params.encodings[0].maxBitrate = Math.max(250000,
                                            (params.encodings[0].maxBitrate || 1000000) * 0.8);
                                        sender.setParameters(params).catch(console.error);
                                    }

                                    setConnectionStatus(prev => ({
                                        ...prev,
                                        detail: 'Reducing video quality due to poor connection'
                                    }));
                                }
                            } else {
                                consecutivePoorConnections = 0;
                                // Gradually increase quality if connection is good
                                if (currentBitrate > 0 && currentBitrate < 100000) { // Less than 100kbps
                                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                                    if (sender) {
                                        const params = sender.getParameters();
                                        if (!params.encodings) {
                                            params.encodings = [{}];
                                        }
                                        params.encodings[0].maxBitrate = Math.min(1000000,
                                            (params.encodings[0].maxBitrate || 250000) * 1.2);
                                        sender.setParameters(params).catch(console.error);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Failed to get connection stats:', error);
                    }
                }, 2000); // Check more frequently
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

            // Add connection recovery logic
            let reconnectAttempts = 0;
            const maxReconnectAttempts = 5;

            const attemptReconnect = async () => {
                if (reconnectAttempts >= maxReconnectAttempts) {
                    setError('Unable to restore connection after multiple attempts');
                    return;
                }

                reconnectAttempts++;
                console.log(`Attempting to reconnect (attempt ${reconnectAttempts})`);

                try {
                    if (call.peerConnection?.connectionState === 'failed') {
                        // Create a new connection
                        cleanupMedia();
                        initializePeer();
                    } else {
                        // Try to restart ICE
                        const pc = call.peerConnection;
                        if (pc) {
                            const offer = await pc.createOffer({ iceRestart: true });
                            await pc.setLocalDescription(offer);
                        }
                    }
                } catch (error) {
                    console.error('Reconnection attempt failed:', error);
                    setTimeout(attemptReconnect, 2000 * reconnectAttempts); // Exponential backoff
                }
            };

            if (call.peerConnection) {
                call.peerConnection.onconnectionstatechange = () => {
                    const state = call.peerConnection?.connectionState;
                    console.log('Connection state changed:', state);

                    if (state === 'failed') {
                        attemptReconnect();
                    } else if (state === 'connected') {
                        reconnectAttempts = 0; // Reset counter on successful connection
                    }
                };
            }
        };

        initializePeer();

        return () => {
            console.log('Component unmounting, cleaning up...');
            cleanupMedia();
            if (sessionId && user) {
                console.log('Removing peer ID via API');
                updatePeerId(sessionId as string, null).catch(error =>
                    console.error('Failed to remove peer ID:', error)
                );
            }
        };
    }, [user, sessionId]);

    // Timer effect
    useEffect(() => {
        if (timeLeft <= 0) {
            if (sessionId) {
                const sessionRef = doc(db, 'sessions', sessionId as string);
                updateDoc(sessionRef, {
                    status: 'chat'
                }).then(() => {
                    window.location.reload();
                }).catch(console.error);
            }
        } else {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [timeLeft, sessionId]);

    const cleanupMedia = () => {
        console.log('Cleaning up media streams...');
        // refresh after 3 seconds

        // Clean up local stream
        if (localStream) {
            localStream.getTracks().forEach(track => {
                console.log('Stopping track:', track.kind);
                track.stop();
                track.enabled = false;
            });
            setTimeout(() => window.location.reload())
            setLocalStream(null);
        }

        // Clean up global stream
        stopMediaStream();

        // Clean up video elements
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }

        // Clean up peer connection
        if (currentCall) {
            currentCall.close();
            setCurrentCall(null);
        }

        if (peer) {
            peer.destroy();
            setPeer(null);
        }

        // Request all user media and stop it (catches any lingering streams)
        if (typeof window !== 'undefined') {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(stream => {
                    stream.getTracks().forEach(track => {
                        track.stop();
                        track.enabled = false;
                    });
                })
                .catch(console.error);
        }
    };

    // Add cleanup to the router change event
    useEffect(() => {
        const handleRouteChange = () => {
            console.log('Route changing, cleaning up media...');
            cleanupMedia();
        };

        router.events.on('routeChangeStart', handleRouteChange);

        return () => {
            router.events.off('routeChangeStart', handleRouteChange);
        };
    }, [router]);

    const toggleMute = () => {
        setIsMuted(prev => {
            const newMuted = !prev;
            logFirebaseEvent(newMuted ? 'mic_muted' : 'mic_unmuted', { uid: user?.uid, session: sessionId });
            return newMuted;
        });
    };

    const toggleVideo = async () => {
        if (!localStream) return;
        if (!isVideoOff) {
            // Turn video off: stop all video tracks
            localStream.getVideoTracks().forEach((track) => track.stop());
            // Create new stream preserving only audio tracks
            const newStream = new MediaStream(localStream.getAudioTracks());
            setLocalStream(newStream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = newStream;
            }
            setIsVideoOff(true);
            logFirebaseEvent('video_off', { uid: user?.uid, session: sessionId });
        } else {
            // Turn video back on: request new video track only
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30, max: 60 },
                        aspectRatio: { ideal: 1.7777777778 },
                    },
                    audio: false,
                });
                // Merge new video tracks with existing audio tracks
                const audioTracks = localStream.getAudioTracks();
                const newStream = new MediaStream([...audioTracks, ...videoStream.getVideoTracks()]);
                setLocalStream(newStream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = newStream;
                }
                setIsVideoOff(false);
                logFirebaseEvent('video_on', { uid: user?.uid, session: sessionId });
            } catch (error) {
                console.error("Error re-enabling video:", error);
            }
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
                    className="p-4 rounded-full bg-gray-800 hover:bg-gray-700 !text-white transition-colors"
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
                                    className={`w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 ${selectedCamera === device.deviceId ? 'bg-gray-700' : ''
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

    // Update the handleEndCall function
    const handleEndCall = async () => {
        try {
            if (sessionId) {
                await endSession(sessionId as string);
                window.location.reload();
            }
        } catch (error) {
            console.error('Failed to end call:', error);
            setError('Failed to end call');
            window.location.reload();
        }
    };

    // Updated session subscription that replaces polling with realtime Firestore updates.
    useEffect(() => {
        // Ensure we have a valid session id from the router query.
        if (!router.query.id) return;
        const sessionId = router.query.id as string;
        const sessionDocRef = doc(db, 'sessions', sessionId);

        const unsubscribeSession = onSnapshot(sessionDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const sessionData = docSnap.data();

                // Verify that the session is still active (in_session).
                // If the status is no longer 'in_session', redirect with cleanup.
                if (sessionData.status !== 'in_session' && sessionData.status !== 'video') {
                    router.push('/?cleanup=true');
                    return;
                }

                // Update connection status (here using an object; adjust as needed).
                setConnectionStatus({ type: 'connected', detail: sessionData.status });

                // Update the partner's peer ID from the session data.
                setPartnerPeerId(sessionData.peerIds?.[sessionData.partnerId] || null);

                // Update the session timer if videoTimeLeft is available.
                if (sessionData.videoTimeLeft) {
                    // Assuming videoTimeLeft is in milliseconds.
                    setTimeLeft(Math.floor(sessionData.videoTimeLeft / 1000));
                }

                // (Optional) Update chat messages if they are stored in the session document.
                if (sessionData.messages) {
                    setMessages(
                        sessionData.messages.map((msg: any) => ({
                            ...msg,
                            timestamp: msg.timestamp?.toDate()
                        }))
                    );
                }
            }
        });

        // Clean up the subscription on unmount.
        return () => unsubscribeSession();
    }, [router.query.id, router]);

    // Add this function to send messages
    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !user || !sessionId) return;

        try {
            const newMessage = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                text: message.trim(),
                senderId: user.uid,
                timestamp: Timestamp.now()
            };

            const sessionRef = doc(db, 'sessions', sessionId as string);
            await updateDoc(sessionRef, {
                messages: arrayUnion(newMessage)
            });

            setMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // Add this component for the chat toggle button
    const ChatToggleButton = () => (
        <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-3 sm:p-4 rounded-full ${isChatOpen ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'} text-white transition-colors`}
            title={isChatOpen ? "Close Chat" : "Open Chat"}
        >
            <ChatIcon />
        </button>
    );

    // Add this icon component
    function ChatIcon() {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        );
    }

    // For example, logging when the local stream is set up
    useEffect(() => {
        if (localStream) {
            logFirebaseEvent('local_stream_started', { uid: user?.uid, session: sessionId });
        }
    }, [localStream]);

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
                            <div className="h-20 w-20 sm:h-32 sm:w-32 rounded-full bg-gray-700 flex items-center justify-center">
                                <span className="text-2xl sm:text-4xl text-gray-400">
                                    {partnerPeerId?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Local video pip - moved to top-right on mobile */}
                    <div className="absolute top-4 right-4 aspect-video h-40 max-w-screen-sm rounded-lg overflow-hidden shadow-lg">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full aspect-video object-cover bg-gray-800 ${isVideoOff ? 'invisible' : 'visible'}`}
                        />
                        {isVideoOff && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                <div className="rounded-full bg-gray-700 flex items-center justify-center">
                                    <span className="text-sm sm:text-xl text-gray-400">
                                        {user?.email?.charAt(0)?.toUpperCase() || '?'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status indicators - stacked on mobile */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2 w-[calc(100%-8rem)] sm:w-fit">
                        <div className="bg-gray-900/90 text-white/70 px-2 sm:px-3 py-1 w-fit rounded-lg text-xs sm:text-sm">
                            Having issues? Try refreshing the page
                        </div>
                        <div className={`text-xs sm:text-sm px-2 sm:px-3 py-1 w-fit rounded-lg flex items-center gap-2 ${error ? 'bg-red-500/90 text-white' :
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
                            <span className="truncate">{error || connectionStatus.detail}</span>
                        </div>
                        {remoteIsMuted && (
                            <div className="bg-gray-900/90 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm flex items-center gap-1">
                                <MicIcon muted />
                                <span>Muted</span>
                            </div>
                        )}
                    </div>

                    {/* Control bar - adjusted for mobile */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-16 pb-4 px-4">
                        <div className="flex flex-col gap-4">
                            {/* Timer - moved above controls on mobile */}
                            <div className="self-center bg-gray-900/90 text-white px-3 py-1 rounded-lg text-center">
                                <div className="text-xs sm:text-sm text-gray-400">
                                    Call ends in
                                </div>
                                <div className="text-lg sm:text-xl font-medium text-green-400">
                                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center justify-center gap-3 sm:gap-4">
                                <button
                                    onClick={toggleMute}
                                    className={`p-3 sm:p-4 rounded-full ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
                                        } text-white transition-colors`}
                                    title={isMuted ? "Unmute" : "Mute"}
                                >
                                    <MicIcon muted={isMuted} />
                                </button>
                                <button
                                    onClick={toggleVideo}
                                    className={`p-3 sm:p-4 rounded-full ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
                                        } text-white transition-colors`}
                                    title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                                >
                                    <CameraIcon disabled={isVideoOff} />
                                </button>
                                {devices.length > 1 && <CameraSelector />}
                                <ChatToggleButton />
                                <button
                                    onClick={handleEndCall}
                                    className="p-3 sm:p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                                    title="End Call"
                                >
                                    <EndCallIcon />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chat panel */}
                {isChatOpen && (
                    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-800 shadow-lg flex flex-col">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Chat</h3>
                            <button
                                onClick={() => setIsChatOpen(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.senderId === user?.uid
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                                            }`}
                                    >
                                        <div>{msg.text}</div>
                                        <div className={`text-xs mt-1 ${msg.senderId === user?.uid
                                            ? 'text-purple-200'
                                            : 'text-gray-500 dark:text-gray-400'
                                            }`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={sendMessage} className="p-4 border-t dark:border-gray-700">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 rounded-full text-white px-4 py-2 bg-gray-100 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                                <button
                                    type="submit"
                                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-2 transition-colors"
                                    disabled={!message.trim()}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                        </form>
                    </div>
                )}
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

function EndCallIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" />
            <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
} 