let globalStream: MediaStream | null = null;

export const setGlobalStream = (stream: MediaStream | null) => {
    globalStream = stream;
};

export const getGlobalStream = () => globalStream;

export const stopMediaStream = () => {
    if (globalStream) {
        globalStream.getTracks().forEach(track => {
            track.stop();
        });
        globalStream = null;
    }
}; 