import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export default function Navigation() {
    const { user, signOut } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            {/* Top Navigation Bar */}
            <nav className="bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex justify-between h-16">
                        {/* Left side - Logo */}
                        <div className="flex items-center">
                            <Link href="/" className="flex items-center">
                                <Image
                                    src="/logo.png"
                                    alt="PinkLips"
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                />
                                <span className="ml-2 text-xl font-semibold text-gray-900">
                                    PinkLips
                                </span>
                            </Link>
                        </div>

                        {/* Right side - User Menu */}
                        {user && (
                            <div className="flex items-center">
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="relative flex items-center gap-2 p-2 rounded-full hover:bg-gray-100"
                                >
                                    <Image
                                        src={user.photoURL || '/default-avatar.png'}
                                        alt={user.displayName || 'User'}
                                        width={32}
                                        height={32}
                                        className="rounded-full"
                                    />
                                    <svg
                                        className="w-4 h-4 text-gray-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </button>

                                {/* Dropdown Menu */}
                                {isMenuOpen && (
                                    <div className="absolute right-4 top-16 w-48 bg-white rounded-lg shadow-lg py-1 z-50">
                                        <div className="px-4 py-2 border-b">
                                            <p className="text-sm font-medium text-gray-900">
                                                {user.displayName}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {user.email}
                                            </p>
                                        </div>
                                        <Link
                                            href="/profile"
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            Profile
                                        </Link>
                                        <Link
                                            href="/settings"
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            Settings
                                        </Link>
                                        <button
                                            onClick={() => {
                                                signOut();
                                                setIsMenuOpen(false);
                                            }}
                                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                        >
                                            Sign out
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Bottom Navigation Bar */}
            {user && (
                <nav className="bg-white shadow-t fixed bottom-0 left-0 right-0 z-50">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="flex justify-around h-16">
                            <Link
                                href="/"
                                className="flex flex-col items-center justify-center w-full hover:bg-gray-50"
                            >
                                <svg
                                    className="w-6 h-6 text-pink-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                                <span className="text-xs mt-1">Find Match</span>
                            </Link>
                            <Link
                                href="/matches"
                                className="flex flex-col items-center justify-center w-full hover:bg-gray-50"
                            >
                                <svg
                                    className="w-6 h-6 text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                    />
                                </svg>
                                <span className="text-xs mt-1">Matches</span>
                            </Link>
                            <Link
                                href="/profile"
                                className="flex flex-col items-center justify-center w-full hover:bg-gray-50"
                            >
                                <svg
                                    className="w-6 h-6 text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                </svg>
                                <span className="text-xs mt-1">Profile</span>
                            </Link>
                        </div>
                    </div>
                </nav>
            )}

            {/* Overlay for dropdown */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black bg-opacity-25"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}
        </>
    );
} 