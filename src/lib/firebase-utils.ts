import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from './types';

export async function getUserProfile(userId: string) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
}

export async function saveUserProfile(userId: string, profileData: Omit<UserProfile, 'createdAt'>) {
    try {
        const userProfile: UserProfile = {
            ...profileData,
            createdAt: new Date(),
        };
        await setDoc(doc(db, 'users', userId), userProfile);
        return true;
    } catch (error) {
        console.error('Error saving user profile:', error);
        return false;
    }
} 