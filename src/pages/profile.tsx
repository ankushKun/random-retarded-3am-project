import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';

export default function Profile() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            setLoading(false);
        }
    }, [user]);

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
        <Layout>
            <div className="min-h-screen bg-gray-900 p-8">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-3xl font-bold text-white mb-8">Profile</h1>

                    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="h-20 w-20 rounded-full bg-gray-700 flex items-center justify-center">
                                <span className="text-3xl text-gray-400">
                                    {user?.email?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white">
                                    {user?.email}
                                </h2>
                                <p className="text-gray-400">
                                    Member since {user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Unknown'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
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
                    </div>
                </div>
            </div>
        </Layout>
    );
}
