import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';

export default function AuthScreen() {
    const { signInWithGoogle } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true);
            await signInWithGoogle();
        } catch (error) {
            console.error('Sign in error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-100 to-rose-100">
            <div className="container mx-auto px-4 py-16 flex flex-col items-center">
                {/* Logo and App Name */}
                <div className="text-center mb-12">
                    <div className="mb-4">
                        <Image
                            src="/logo.png"
                            alt="PinkLips Logo"
                            width={120}
                            height={120}
                            className="rounded-full shadow-lg"
                        />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">
                        PinkLips
                    </h1>
                    <p className="text-gray-600 text-lg">
                        Find meaningful connections
                    </p>
                </div>

                {/* Auth Card */}
                <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                            Welcome
                        </h2>
                        <p className="text-gray-600">
                            Start your journey to find your perfect match
                        </p>
                    </div>

                    {/* Google Sign In Button */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-full px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {!isLoading ? (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09c1.97 3.92 6.02 6.62 10.71 6.62z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29v-3.09h-3.98c-.8 1.6-1.27 3.41-1.27 5.38s.46 3.78 1.27 5.38l3.98-3.09z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42c-2.07-1.94-4.78-3.13-8.02-3.13-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                                    />
                                </svg>
                                Continue with Google
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-t-2 border-b-2 border-gray-500 rounded-full animate-spin" />
                                Signing in...
                            </div>
                        )}
                    </button>

                    {/* Terms and Privacy */}
                    <p className="mt-8 text-center text-sm text-gray-500">
                        By continuing, you agree to our{' '}
                        <a href="#" className="text-pink-600 hover:underline">
                            Terms of Service
                        </a>{' '}
                        and{' '}
                        <a href="#" className="text-pink-600 hover:underline">
                            Privacy Policy
                        </a>
                    </p>
                </div>

                {/* Features Section */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
                    <div className="text-center">
                        <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-md">
                            <svg
                                className="w-8 h-8 text-pink-500"
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
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            Meaningful Connections
                        </h3>
                        <p className="text-gray-600">
                            Find people who share your interests and values
                        </p>
                    </div>
                    <div className="text-center">
                        <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-md">
                            <svg
                                className="w-8 h-8 text-pink-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            Quality Time
                        </h3>
                        <p className="text-gray-600">
                            1 hour video call followed by chat
                        </p>
                    </div>
                    <div className="text-center">
                        <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-md">
                            <svg
                                className="w-8 h-8 text-pink-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            Safe & Secure
                        </h3>
                        <p className="text-gray-600">
                            Verified profiles and secure video calls
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
} 