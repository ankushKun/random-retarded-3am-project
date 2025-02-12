import { auth } from './firebase';

async function getAuthHeaders() {
    const token = await auth.currentUser?.getIdToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export async function getUserProfile(userId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${userId}`, {
        headers,
    });
    if (!response.ok) throw new Error('Failed to fetch user profile');
    return response.json();
}

export async function updateUserProfile(userId: string, data: any) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update user profile');
    return response.json();
}

export async function getCurrentMatchState() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${auth.currentUser?.uid}/match-state`, {
        headers,
    });
    if (!response.ok) throw new Error('Failed to fetch match state');
    return response.json();
}

export async function joinMatchingPool(preferences?: {
    minAge?: number;
    maxAge?: number;
    gender?: string;
}) {
    const headers = await getAuthHeaders();
    const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/${auth.currentUser?.uid}/match/join`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({ preferences })
        }
    );
    if (!response.ok) throw new Error('Failed to join matching pool');
    return response.json();
}

export async function leaveMatchingPool() {
    const headers = await getAuthHeaders();
    const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/${auth.currentUser?.uid}/match/leave`,
        {
            method: 'POST',
            headers
        }
    );
    if (!response.ok) throw new Error('Failed to leave matching pool');
    return response.json();
} 