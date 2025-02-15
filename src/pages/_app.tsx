import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider } from '../contexts/AuthContext';
import TermsOfServicePopup from '../components/TermsOfServicePopup';
import { Analytics } from "@vercel/analytics/react"


export default function App({ Component, pageProps }: AppProps) {

  return (
    <AuthProvider>
      <Component {...pageProps} />
      <TermsOfServicePopup />
      <Analytics />
    </AuthProvider>
  );
}
