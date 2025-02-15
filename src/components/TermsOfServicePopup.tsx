import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const TermsOfServicePopup = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if the user has already accepted the terms
        let accepted = localStorage.getItem('tosAccepted');
        if (accepted) accepted = JSON.parse(accepted)
        if (!accepted) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('tosAccepted', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    const router = useRouter();
    if (router.pathname === '/tos') {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-gray-800 text-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
                <h2 className="text-xl font-bold mb-4">Terms of Service</h2>
                <div className="text-sm mb-4 max-h-60 overflow-y-auto">
                    Please read and accept our{' '}
                    <Link href="/tos">
                        <div className="text-blue-600 underline">Terms of Service</div>
                    </Link>{' '}
                    to continue using the service.
                </div>
                <button
                    onClick={handleAccept}
                    className="w-full py-2 px-4 bg-purple-600 rounded text-white hover:bg-purple-700"
                >
                    I Accept
                </button>
            </div>
        </div>
    );
};

export default TermsOfServicePopup; 