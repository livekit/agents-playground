import { CloudProvider } from "@/cloud/useCloud";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "react-hot-toast";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <CloudProvider>
      <Toaster />
      <Component {...pageProps} />
    </CloudProvider>
  );}
