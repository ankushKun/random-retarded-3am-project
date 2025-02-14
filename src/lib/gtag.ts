// Extend the Window interface to include the gtag method
declare global {
    interface Window {
        gtag: (...args: any[]) => void;
    }
}

export const GA_TRACKING_ID = "G-ZBRY04PRF7"; // Replace with your GA Tracking ID

// Optional helper function if you want to track pageviews in other parts of your app.
export const pageview = (url: string) => {
    window.gtag("config", GA_TRACKING_ID, {
        page_path: url,
    });
}; 