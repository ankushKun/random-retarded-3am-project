import { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider, db } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';

interface UserProfile {
    name?: string;
    gender?: 'male' | 'female';
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    userProfile: UserProfile | null;
    profileComplete: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [profileComplete, setProfileComplete] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (!userDoc.exists()) {
                        // Create initial user document
                        await setDoc(userDocRef, {
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            createdAt: new Date(),
                        });
                        setProfileComplete(false);
                    } else {
                        // Check if profile is complete
                        const userData = userDoc.data();
                        setUserProfile(userData);
                        setProfileComplete(!!(userData.name && userData.gender));
                    }
                } catch (error) {
                    console.error('Firestore error:', error);
                }
            }
            setUser(user);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const signInWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error('Error signing in with Google:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            // Sign out from Firebase
            await signOut(auth);

            // Clear states
            setUser(null);
            setUserProfile(null);
            setProfileComplete(false);

            // Redirect to homepage
            await router.push('/');
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            signInWithGoogle,
            logout,
            userProfile,
            profileComplete
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext); 