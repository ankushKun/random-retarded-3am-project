// Global site tag (gtag.js) integration for Google Analytics

export const GA_TRACKING_ID = 'G-ZBRY04PRF7'; // Replace with your actual tracking ID

// Log page views
export const pageview = (url: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('config', GA_TRACKING_ID, {
            page_path: url,
        });
    }
};

// Log specific events
export const event = ({
    action,
    category,
    label,
    value,
}: {
    action: string;
    category: string;
    label: string;
    value: number;
}) => {
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', action, {
            event_category: category,
            event_label: label,
            value: value,
        });
    }
};

declare global {
    interface Window {
        gtag: (command: string, ...args: any[]) => void;
    }
} 