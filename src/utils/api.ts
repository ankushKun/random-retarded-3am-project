import { auth } from '../config/firebase';

export async function getAuthHeader() {
    const token = await auth.currentUser?.getIdToken();
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export async function joinMatchmaking() {
    console.log('Sending join matchmaking request');
    const res = await fetch('/api/matchmaking/join', {
        method: 'POST',
        headers: await getAuthHeader(),
    });
    const data = await res.json();
    console.log('Join matchmaking response:', data);
    return data;
}

export async function getMatchmakingStatus() {
    console.log('Fetching matchmaking status');
    const res = await fetch('/api/matchmaking/status', {
        headers: await getAuthHeader(),
    });
    const data = await res.json();
    console.log('Status response:', data);
    return data;
}

export async function createMatch() {
    console.log('Sending create match request');
    const res = await fetch('/api/matchmaking/match', {
        method: 'POST',
        headers: await getAuthHeader(),
    });
    const data = await res.json();
    console.log('Create match response:', data);
    return data;
}

export async function cancelMatchmaking() {
    const res = await fetch('/api/matchmaking/cancel', {
        method: 'POST',
        headers: await getAuthHeader(),
    });
    return res.json();
}

export async function updatePeerId(sessionId: string, peerId: string | null) {
    console.log('Sending update peer ID request:', { sessionId, peerId });
    const res = await fetch('/api/sessions/update-peer', {
        method: 'POST',
        headers: await getAuthHeader(),
        body: JSON.stringify({ sessionId, peerId })
    });
    const data = await res.json();
    console.log('Update peer ID response:', data);
    return data;
}

export const endSession = async (sessionId: string) => {
    const response = await fetch('/api/matchmaking/end-session', {
        method: 'POST',
        headers: await getAuthHeader(),
        body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to end session');
    }

    return response.json();
}; 