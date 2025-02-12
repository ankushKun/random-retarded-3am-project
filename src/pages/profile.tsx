import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { getUserProfile } from '@/lib/firebase-utils';

export default function ProfilePage() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProfile() {
            if (user?.uid) {
                const userProfile = await getUserProfile(user.uid);
                setProfile(userProfile);
                setLoading(false);
            }
        }

        loadProfile();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rose-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4">
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center space-x-4 mb-6">
                    <img
                        src={user?.photoURL || '/default-avatar.png'}
                        alt={user?.displayName || 'User'}
                        className="w-20 h-20 rounded-full"
                    />
                    <div>
                        <h1 className="text-2xl font-bold">{user?.displayName}</h1>
                        <p className="text-gray-600">{user?.email}</p>
                    </div>
                </div>

                {profile && (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold mb-2">About</h2>
                            <p className="text-gray-700">{profile.bio || 'No bio added yet'}</p>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold mb-2">Interests</h2>
                            <div className="flex flex-wrap gap-2">
                                {profile.interests?.map((interest: string) => (
                                    <span
                                        key={interest}
                                        className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm"
                                    >
                                        {interest}
                                    </span>
                                )) || 'No interests added yet'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 