import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Router from 'next/router';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onStart = () => setLoading(true);
    const onDone = () => setLoading(false);

    Router.events.on('routeChangeStart', onStart);
    Router.events.on('routeChangeComplete', onDone);
    Router.events.on('routeChangeError', onDone);

    return () => {
      Router.events.off('routeChangeStart', onStart);
      Router.events.off('routeChangeComplete', onDone);
      Router.events.off('routeChangeError', onDone);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none fixed left-0 top-0 z-50 h-1 bg-gradient-to-r from-[var(--art-accent)] to-[var(--art-accent-alt)] transition-all duration-300 ${
          loading ? 'w-full opacity-100' : 'w-0 opacity-0'
        }`}
      />
      <Component {...pageProps} />
    </>
  );
}
