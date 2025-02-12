import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, addDoc, onSnapshot } from 'firebase/firestore';

interface ChatScreenProps {
    matchedUser: {
        uid: string;
        displayName: string;
        photoURL?: string;
    };
    onTimeUp: () => void;
}

interface Message {
    id: string;
    senderId: string;
    text: string;
    timestamp: Date;
}

export default function ChatScreen({ matchedUser, onTimeUp }: ChatScreenProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Subscribe to messages
        const q = query(
            collection(db, 'chats'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Message[];
            setMessages(newMessages.reverse());
        });

        return unsubscribe;
    }, []);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await addDoc(collection(db, 'chats'), {
                text: newMessage,
                timestamp: new Date(),
                senderId: 'currentUserId', // Replace with actual user ID
            });
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`mb-2 ${message.senderId === 'currentUserId'
                            ? 'text-right'
                            : 'text-left'
                            }`}
                    >
                        <div
                            className={`inline-block p-2 rounded-lg ${message.senderId === 'currentUserId'
                                ? 'bg-pink-500 text-white'
                                : 'bg-gray-200'
                                }`}
                        >
                            {message.text}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 p-2 border rounded"
                        placeholder="Type a message..."
                    />
                    <button
                        type="submit"
                        className="bg-pink-500 text-white px-4 py-2 rounded"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
} 