import { useEffect, useRef, useState } from 'react';
import Peer, { MediaConnection } from 'peerjs';

export default function Home() {
    // Use localStorage for persistent peer ID
    const [myPeerId, setMyPeerId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('myPeerId') || '';
        }
        return '';
    });

    const [targetPeerId, setTargetPeerId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('targetPeerId') || '';
        }
        return '';
    });

    const [peer, setPeer] = useState<Peer | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<string>('');
    const [currentCall, setCurrentCall] = useState<MediaConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Initialize peer connection
    useEffect(() => {
        let newPeer: Peer;

        const initializePeer = () => {
            // If we have a stored peer ID, use it to create the peer
            if (myPeerId) {
                newPeer = new Peer(myPeerId, {
                    host: '0.peerjs.com',
                    port: 443,
                    path: '/',
                    secure: false,
                });
            } else {
                newPeer = new Peer({
                    host: '0.peerjs.com',
                    port: 443,
                    path: '/',
                    secure: false,
                });
            }

            // Peer events
            newPeer.on('open', (id) => {
                setMyPeerId(id);
                localStorage.setItem('myPeerId', id);
                setConnectionStatus('Ready to connect');
                setPeer(newPeer);

                // If we have a stored target peer ID, automatically try to reconnect
                const storedTargetPeerId = localStorage.getItem('targetPeerId');
                if (storedTargetPeerId && !currentCall) {
                    setTargetPeerId(storedTargetPeerId);
                    startCall(storedTargetPeerId);
                }
            });

            newPeer.on('error', (error) => {
                console.error(error);
                setConnectionStatus(`Error: ${error.type}`);

                // If the peer is disconnected, try to reconnect
                if (error.type === 'peer-unavailable') {
                    setTimeout(initializePeer, 5000); // Retry after 5 seconds
                }
            });

            newPeer.on('disconnected', () => {
                setConnectionStatus('Disconnected - Attempting to reconnect...');
                newPeer.reconnect();
            });

            // Handle incoming calls
            newPeer.on('call', handleIncomingCall);
        };

        initializePeer();

        // Cleanup function
        return () => {
            cleanupMedia();
            if (newPeer) {
                newPeer.destroy();
            }
        };
    }, []); // Empty dependency array since we handle reconnection internally

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

            // Store the caller's peer ID
            localStorage.setItem('targetPeerId', call.peer);
            setTargetPeerId(call.peer);

            call.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                    setConnectionStatus('Connected');
                }
            });

            call.on('close', () => {
                setConnectionStatus('Call ended');
                cleanupMedia();
                localStorage.removeItem('targetPeerId');
            });

            call.on('error', (error) => {
                console.error(error);
                setConnectionStatus(`Call error: ${error}`);
                cleanupMedia();
                localStorage.removeItem('targetPeerId');
            });

        } catch (err) {
            console.error('Failed to get local stream:', err);
            setConnectionStatus('Failed to get local stream');
        }
    };

    const startCall = async (peerIdToCall: string = targetPeerId) => {
        if (!peer || !peerIdToCall) {
            setConnectionStatus('Invalid peer ID or connection');
            return;
        }

        try {
            cleanupMedia(); // Cleanup any existing calls
            setConnectionStatus('Initiating call...');

            // Store the target peer ID
            localStorage.setItem('targetPeerId', peerIdToCall);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            const call = peer.call(peerIdToCall, stream);
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
                localStorage.removeItem('targetPeerId');
            });

            call.on('error', (error) => {
                console.error(error);
                setConnectionStatus(`Call error: ${error}`);
                cleanupMedia();
                localStorage.removeItem('targetPeerId');
            });

        } catch (err) {
            console.error('Failed to start call:', err);
            setConnectionStatus('Failed to start call');
            cleanupMedia();
            localStorage.removeItem('targetPeerId');
        }
    };

    const endCall = () => {
        cleanupMedia();
        setConnectionStatus('Call ended');
        localStorage.removeItem('targetPeerId');
    };

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">P2P Video Call</h1>

            <div className="mb-4">
                <p>Status: <span className="font-semibold">{connectionStatus}</span></p>
                <p>Your Peer ID: <span className="font-mono">{myPeerId}</span></p>
                <div className="mt-2">
                    <input
                        type="text"
                        value={targetPeerId}
                        onChange={(e) => setTargetPeerId(e.target.value)}
                        placeholder="Enter peer ID to call"
                        className="border p-2 mr-2 rounded text-black"
                    />
                    <button
                        onClick={() => startCall(targetPeerId)}
                        disabled={!!currentCall}
                        className="bg-blue-500 text-white px-4 py-2 rounded mr-2 disabled:bg-gray-400"
                    >
                        Call
                    </button>
                    <button
                        onClick={endCall}
                        disabled={!currentCall}
                        className="bg-red-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
                    >
                        End Call
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h2 className="text-lg font-semibold mb-2">Local Video</h2>
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full border rounded bg-gray-100"
                    />
                </div>
                <div>
                    <h2 className="text-lg font-semibold mb-2">Remote Video</h2>
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full border rounded bg-gray-100"
                    />
                </div>
            </div>
        </div>
    );
}