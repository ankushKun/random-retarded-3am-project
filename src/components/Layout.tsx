import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

export default function Layout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
            <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm fixed w-full z-10 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link href="/" className="text-xl font-bold text-purple-600 dark:text-purple-400">
                                DateLock
                            </Link>
                        </div>

                        {user && (
                            <div className="flex items-center gap-4">
                                <Link
                                    href="/profile"
                                    className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400"
                                >
                                    {user.photoURL && (
                                        <Image
                                            src={user.photoURL}
                                            alt="Profile"
                                            width={32}
                                            height={32}
                                            className="rounded-full"
                                        />
                                    )}
                                </Link>
                                <button
                                    onClick={logout}
                                    className="text-sm text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400"
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            <main className="pt-16">
                {children}
            </main>
        </div>
    );
} 