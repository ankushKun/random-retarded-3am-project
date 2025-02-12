import { useAuth } from '@/hooks/useAuth';
import AuthScreen from '@/components/screens/AuthScreen';
import MatchingScreen from '@/components/screens/MatchingScreen';
import OnboardingScreen from '@/components/screens/OnboardingScreen';
import { useEffect, useState } from 'react';
import { getUserProfile } from '@/lib/firebase-utils';

export default function Home() {
    const { user, loading } = useAuth();
    const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
    const [checkingProfile, setCheckingProfile] = useState(true);

    useEffect(() => {
        async function checkUserProfile() {
            if (user?.uid) {
                const profile = await getUserProfile(user.uid);
                setIsNewUser(!profile);
                setCheckingProfile(false);
            }
        }

        if (user) {
            checkUserProfile();
        } else {
            setCheckingProfile(false);
        }
    }, [user]);

    if (loading || checkingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rose-500"></div>
            </div>
        );
    }

    if (!user) {
        return <AuthScreen />;
    }

    if (isNewUser) {
        return <OnboardingScreen onComplete={() => setIsNewUser(false)} />;
    }

    return <MatchingScreen />;
}