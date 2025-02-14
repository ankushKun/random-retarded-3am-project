import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider } from '../contexts/AuthContext';
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { GA_TRACKING_ID } from "../lib/gtag";
import { Analytics } from "@vercel/analytics/react"


export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      window.gtag("config", GA_TRACKING_ID, {
        page_path: url,
      });
    }
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    }
  }, [router.events]);

  return (
    <AuthProvider>
      {/* Global Site Tag (gtag.js) - Google Analytics */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_TRACKING_ID}', {
            page_path: window.location.pathname
          });
        `}
      </Script>
      <Component {...pageProps} />
      <Analytics />
    </AuthProvider>
  );
}
