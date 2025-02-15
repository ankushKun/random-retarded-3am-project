import { analytics } from "../config/firebase";
import { logEvent } from "firebase/analytics";

// Helper function to log events
export const logFirebaseEvent = (eventName: string, eventParams?: { [key: string]: any }) => {
    if (analytics) {
        logEvent(analytics(), eventName, eventParams);
    }
}; 