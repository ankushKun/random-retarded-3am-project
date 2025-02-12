import { auth } from '../config/firebase';

async function getAuthHeader() {
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