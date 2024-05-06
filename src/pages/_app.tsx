import { CloudProvider } from "@/cloud/useCloud";
import "@/styles/globals.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <CloudProvider>
      <Component {...pageProps} />
    </CloudProvider>
  );}
