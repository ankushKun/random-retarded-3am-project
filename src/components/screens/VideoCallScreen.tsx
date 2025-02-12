import { useEffect, useRef } from 'react';
import Peer from 'peerjs';

interface VideoCallScreenProps {
    matchedUser: {
        uid: string;
        displayName: string;
        photoURL?: string;
    };
    onTimeUp: () => void;
}

export default function VideoCallScreen({ matchedUser, onTimeUp }: VideoCallScreenProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer>();

    useEffect(() => {
        // Initialize PeerJS and handle video call
        const initializeCall = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Initialize PeerJS
            const peer = new Peer();
            peerRef.current = peer;

            // Handle incoming calls
            peer.on('call', (call) => {
                call.answer(stream);
                call.on('stream', (remoteStream) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = remoteStream;
                    }
                });
            });
        };

        initializeCall();

        return () => {
            // Cleanup
            peerRef.current?.destroy();
        };
    }, []);

    return (
        <div className="grid grid-cols-2 gap-4 h-full">
            <div className="relative">
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded">
                    You
                </div>
            </div>
            <div className="relative">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded">
                    {matchedUser.displayName}
                </div>
            </div>
        </div>
    );
} 