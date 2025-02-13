import { useState } from 'react';
import { getAuthHeader } from '../utils/api';

interface ProfileSetupProps {
    onComplete: () => void;
}

export default function ProfileSetup({ onComplete }: ProfileSetupProps) {
    const [name, setName] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | ''>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !gender) {
            setError('Please fill in all fields');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/profile/update', {
                method: 'POST',
                headers: await getAuthHeader(),
                body: JSON.stringify({
                    name: name.trim(),
                    gender,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update profile');
            }

            onComplete();
        } catch (error) {
            console.error('Error saving profile:', error);
            setError('Failed to save profile. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        Complete Your Profile
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Please tell us a bit about yourself
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="text-red-600 text-center text-sm">
                            {error}
                        </div>
                    )}
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="name" className="sr-only">Name</label>
                            <input
                                id="name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-t-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm dark:bg-gray-800"
                                placeholder="Your name"
                            />
                        </div>
                        <div className="flex">
                            <label className="flex-1 relative block">
                                <input
                                    type="radio"
                                    name="gender"
                                    value="male"
                                    checked={gender === 'male'}
                                    onChange={(e) => setGender(e.target.value as 'male')}
                                    className="sr-only"
                                />
                                <div className={`cursor-pointer text-center py-2 border ${gender === 'male'
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}>
                                    Male
                                </div>
                            </label>
                            <label className="flex-1 relative block">
                                <input
                                    type="radio"
                                    name="gender"
                                    value="female"
                                    checked={gender === 'female'}
                                    onChange={(e) => setGender(e.target.value as 'female')}
                                    className="sr-only"
                                />
                                <div className={`cursor-pointer text-center py-2 border ${gender === 'female'
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}>
                                    Female
                                </div>
                            </label>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
} 