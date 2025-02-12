export interface MatchState {
    status: 'waiting' | 'matched' | 'video_call' | 'chat' | 'completed';
    matchedUserId?: string;
    matchStartTime?: Date;
    currentPhase?: 'video' | 'chat';
    phaseEndTime?: Date;
}

export interface UserMatch {
    matchedUser: {
        uid: string;
        displayName: string;
        photoURL?: string;
    };
    state: MatchState;
}

export interface MatchingPool {
    userId: string;
    joinedAt: Date;
    preferences?: {
        minAge?: number;
        maxAge?: number;
        gender?: string;
    };
}

export interface Match {
    participants: string[];
    date: string;
    hour: number;
    startTime: Date;
    status: 'active' | 'completed';
} 