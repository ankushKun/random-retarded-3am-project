import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';

export default function Profile() {
    const { user, userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (user && userProfile) {
            setName(userProfile.name || '');
            setGender(userProfile.gender || 'male');
            setLoading(false);
        }
    }, [user, userProfile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch('/api/profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${await user?.getIdToken()}`
                },
                body: JSON.stringify({
                    name: name.trim(),
                    gender,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update profile');
            }

            setSuccessMessage('Profile updated successfully');
            setIsEditing(false);
            window.location.reload(); // Reload to update context
        } catch (error) {
            console.error('Error updating profile:', error);
            setError('Failed to update profile. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                    <div className="text-white">Loading...</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Profile">
            <div className="min-h-screen bg-gray-900 p-8">
                <div className="max-w-2xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold text-white">Profile</h1>
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
                            >
                                Edit Profile
                            </button>
                        )}
                    </div>

                    {successMessage && (
                        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
                            {successMessage}
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="h-20 w-20 rounded-full bg-gray-700 flex items-center justify-center">
                                <span className="text-3xl text-gray-400">
                                    {userProfile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white">
                                    {userProfile?.name || user?.email}
                                </h2>
                                <p className="text-gray-400">
                                    Member since {user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Unknown'}
                                </p>
                            </div>
                        </div>

                        {isEditing ? (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Gender
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="gender"
                                                value="male"
                                                checked={gender === 'male'}
                                                onChange={(e) => setGender(e.target.value as 'male')}
                                                className="mr-2"
                                            />
                                            <span className="text-white">Male</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="gender"
                                                value="female"
                                                checked={gender === 'female'}
                                                onChange={(e) => setGender(e.target.value as 'female')}
                                                className="mr-2"
                                            />
                                            <span className="text-white">Female</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md flex-1 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                    >
                                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(false)}
                                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                <div className="border-t border-gray-700 pt-4">
                                    <h3 className="text-lg font-medium text-white mb-2">Profile Information</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-gray-400">Name</p>
                                            <p className="text-white">{userProfile?.name || 'Not set'}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Gender</p>
                                            <p className="text-white capitalize">{userProfile?.gender || 'Not set'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-700 pt-4">
                                    <h3 className="text-lg font-medium text-white mb-2">Account Details</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-gray-400">Email</p>
                                            <p className="text-white">{user?.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">User ID</p>
                                            <p className="text-white font-mono text-sm">{user?.uid}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
