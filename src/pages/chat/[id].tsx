import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { doc, updateDoc, onSnapshot, arrayUnion, Timestamp } from 'firebase/firestore';
import { getMatchmakingStatus } from '../../utils/api';

// Add loading spinner component
const LoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-600"></div>
    </div>
);

interface Message {
    id: string;
    text: string;
    senderId: string;
    timestamp: Date;
}

export default function ChatPage() {
    const router = useRouter();
    const { id: sessionId } = router.query;
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [cooldownEnds, setCooldownEnds] = useState<Date | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    // Add loading state
    const [isLoading, setIsLoading] = useState(true);

    // Fetch session data and messages
    useEffect(() => {
        if (!user || !sessionId) return;

        const sessionRef = doc(db, 'sessions', sessionId as string);
        const unsubscribe = onSnapshot(sessionRef, (doc) => {
            if (doc.exists()) {
                const sessionData = doc.data();
                // Set partner ID
                const partner = sessionData.participants.find((p: string) => p !== user.uid);
                setPartnerId(partner);

                // Set messages
                const sessionMessages = sessionData.messages || [];
                setMessages(sessionMessages.map((msg: any) => ({
                    ...msg,
                    timestamp: msg.timestamp?.toDate()
                })));

                // Check cooldown
                if (sessionData.cooldownEnds) {
                    const cooldownEnd = sessionData.cooldownEnds.toDate();
                    setCooldownEnds(cooldownEnd);
                }

                // Set loading to false once we have the data
                setIsLoading(false);
            }
        });

        return () => unsubscribe();
    }, [user, sessionId]);

    // Add timer effect for cooldown
    useEffect(() => {
        if (!cooldownEnds) return;

        const updateTimer = () => {
            const now = new Date();
            const remaining = Math.max(0, cooldownEnds.getTime() - now.getTime());
            setTimeLeft(remaining);

            if (remaining <= 0) {
                // Redirect to home when cooldown ends
                router.push('/');
            }
        };

        const timer = setInterval(updateTimer, 1000);
        updateTimer(); // Initial update

        return () => clearInterval(timer);
    }, [cooldownEnds, router]);

    // Update the session check effect
    useEffect(() => {
        if (!user || !sessionId) return;

        const checkSession = async () => {
            try {
                const status = await getMatchmakingStatus();

                if (status.status === 'ended') {
                    // Don't wait for router.push to complete
                    router.push('/').catch(console.error);
                    return;
                }

                // Update time left only if we have a valid chat time remaining
                if (status.chatTimeLeft && status.chatTimeLeft > 0) {
                    const secondsLeft = Math.ceil(status.chatTimeLeft / 1000);
                    setTimeLeft(secondsLeft);
                } else if (status.chatTimeLeft === 0) {
                    // Don't wait for router.push to complete
                    router.push('/').catch(console.error);
                }
            } catch (error) {
                console.error('Session check failed:', error);
            }
        };

        const interval = setInterval(checkSession, 1000);
        checkSession();

        return () => clearInterval(interval);
    }, [user, sessionId, router]);

    // Add effect to handle session end
    useEffect(() => {
        if (timeLeft && timeLeft <= 0) {
            router.push('/');
        }
    }, [timeLeft, router]);

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

    // Add a proper time formatting function
    const formatTimeLeft = (seconds: number | null) => {
        if (seconds === null || seconds <= 0) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <Layout>
            {isLoading ? (
                <LoadingSpinner />
            ) : (
                <div className="max-w-2xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col">
                    {timeLeft && timeLeft > 0 && (
                        <div className="bg-purple-600/10 dark:bg-purple-400/10 p-4 text-center">
                            <p className="text-purple-600 dark:text-purple-400">
                                Chat closes in {formatTimeLeft(timeLeft)}
                            </p>
                        </div>
                    )}

                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
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
                                    {msg.timestamp && (
                                        <div className={`text-xs mt-1 ${msg.senderId === user?.uid
                                            ? 'text-purple-200'
                                            : 'text-gray-500 dark:text-gray-400'
                                            }`}>
                                            {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    )}
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
                                className="flex-1 rounded-full text-white px-4 py-2 bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                            />
                            <button
                                type="submit"
                                className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-2 transition-colors"
                                disabled={!message.trim()}
                            >
                                <SendIcon />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </Layout>
    );
}

const SendIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
); 