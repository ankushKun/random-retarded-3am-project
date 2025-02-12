import { auth } from '../config/firebase';

async function getAuthHeader() {
    const token = await auth.currentUser?.getIdToken();
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export async function joinMatchmaking() {
    const res = await fetch('/api/matchmaking/join', {
        method: 'POST',
        headers: await getAuthHeader(),
    });
    return res.json();
}

export async function getMatchmakingStatus() {
    const res = await fetch('/api/matchmaking/status', {
        headers: await getAuthHeader(),
    });
    return res.json();
}

export async function createMatch() {
    const res = await fetch('/api/matchmaking/match', {
        method: 'POST',
        headers: await getAuthHeader(),
    });
    return res.json();
}

export async function cancelMatchmaking() {
    const res = await fetch('/api/matchmaking/cancel', {
        method: 'POST',
        headers: await getAuthHeader(),
    });
    return res.json();
} 