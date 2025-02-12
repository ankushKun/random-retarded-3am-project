import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import Image from 'next/image';

export default function ChatPage() {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([
        { id: 1, text: 'Hey there!', sender: 'them' },
        { id: 2, text: 'Hi! That was a great conversation!', sender: 'me' },
    ]);

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            setMessages([...messages, { id: Date.now(), text: message, sender: 'me' }]);
            setMessage('');
        }
    };

    return (
        <Layout>
            <div className="max-w-2xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col">
                <div className="flex-1 p-4 overflow-y-auto">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'} mb-4`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.sender === 'me'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                                    }`}
                            >
                                {msg.text}
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
                            className="flex-1 rounded-full px-4 py-2 bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                        />
                        <button
                            type="submit"
                            className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-2"
                        >
                            <SendIcon />
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
}

const SendIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
); 