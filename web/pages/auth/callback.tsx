import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { normalizeNextPath } from '../../lib/auth-redirect';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const nextPath = normalizeNextPath(
      typeof router.query.next === 'string' ? router.query.next : undefined,
    );

    const complete = async () => {
      await supabase.auth.getSession();
      if (!cancelled) {
        await router.replace(nextPath);
      }
    };

    complete().catch(() => {
      if (!cancelled) {
        router.replace('/auth?error=callback_failed');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      <Head>
        <title>로그인 처리 중 | ArtTomato</title>
      </Head>
      <main className="awwwards-canvas flex min-h-screen items-center justify-center px-6">
        <div className="rounded-2xl border border-black/15 bg-white/80 px-6 py-5 text-sm text-[color:var(--art-ink-muted)] backdrop-blur">
          로그인 정보를 확인하고 있습니다...
        </div>
      </main>
    </>
  );
}
