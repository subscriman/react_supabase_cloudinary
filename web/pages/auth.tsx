import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Provider } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../hooks/useAuthSession';
import { buildWebAuthRedirectUrl } from '../lib/auth-redirect';

type SocialProviderId = 'google' | 'kakao' | 'naver';

type SocialProviderItem = {
  id: SocialProviderId;
  label: string;
  enabled: boolean;
  presentInSettings: boolean;
};

type AuthProviderApiResponse = {
  data?: {
    checkedAt: string;
    providers: SocialProviderItem[];
  };
  error?: string;
};

const PROVIDERS: Array<{ id: SocialProviderId; label: string }> = [
  { id: 'google', label: 'Google 로그인' },
  { id: 'kakao', label: 'Kakao 로그인' },
  { id: 'naver', label: 'Naver 로그인' },
];

export default function AuthPage() {
  const { user, loading } = useAuthSession();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [enabledProviders, setEnabledProviders] = useState<Array<{ id: SocialProviderId; label: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const redirectTo = useMemo(() => buildWebAuthRedirectUrl('/mypage'), []);

  useEffect(() => {
    let active = true;

    const loadProviders = async () => {
      try {
        const response = await fetch('/api/auth/providers');
        const body = ((await response.json().catch(() => ({}))) ?? {}) as AuthProviderApiResponse;

        if (!response.ok) {
          throw new Error(body.error ?? `상태 코드 ${response.status}`);
        }

        const providers = body.data?.providers ?? [];
        if (!active) return;

        const enabled = providers
          .filter((provider) => provider.enabled)
          .map((provider) => ({
            id: provider.id,
            label: provider.label,
          }));

        setEnabledProviders(enabled);
      } catch (_error) {
        if (!active) return;
        // 설정 조회 실패 시에도 기본 목록을 제공해 로그인 시도를 막지 않는다.
        setEnabledProviders(PROVIDERS);
      } finally {
        if (active) {
          setProviderLoading(false);
        }
      }
    };

    loadProviders();
    return () => {
      active = false;
    };
  }, []);

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage('로그인 링크를 이메일로 전송했습니다. 받은 편지함을 확인해주세요.');
    }
    setSubmitting(false);
  };

  const handleSocialSignIn = async (provider: SocialProviderId) => {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>로그인 | ArtTomato</title>
        <meta name="description" content="ArtTomato 로그인 페이지" />
      </Head>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-md px-5 py-16">
          <Link href="/" className="mb-5 inline-block text-sm text-zinc-400 hover:text-zinc-200">
            ← 전시 목록으로
          </Link>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h1 className="text-2xl font-semibold">ArtTomato 로그인</h1>
            <p className="mt-2 text-sm text-zinc-400">이메일 또는 소셜 계정으로 로그인할 수 있습니다.</p>

            {loading ? (
              <p className="mt-6 text-sm text-zinc-400">세션 확인 중...</p>
            ) : user ? (
              <div className="mt-6 rounded-lg border border-lime-800 bg-lime-950/30 p-4 text-sm text-lime-300">
                이미 로그인되어 있습니다.{' '}
                <Link href="/mypage" className="underline">
                  마이페이지로 이동
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleEmailSignIn} className="mt-6 space-y-3">
                  <label htmlFor="email" className="block text-xs text-zinc-400">
                    이메일 로그인
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-lime-400 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-lime-300 disabled:opacity-70"
                  >
                    {submitting ? '처리 중...' : '이메일 링크 받기'}
                  </button>
                </form>

                <div className="mt-6">
                  <p className="mb-2 text-xs text-zinc-400">소셜 로그인</p>
                  {providerLoading ? (
                    <p className="text-xs text-zinc-500">소셜 로그인 설정 확인 중...</p>
                  ) : enabledProviders.length === 0 ? (
                    <p className="text-xs text-zinc-500">현재 사용 가능한 소셜 로그인 공급자가 없습니다.</p>
                  ) : (
                    <div className="grid gap-2">
                      {enabledProviders.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => handleSocialSignIn(provider.id)}
                          disabled={submitting}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-70"
                        >
                          {provider.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {message ? <p className="mt-4 text-sm text-lime-300">{message}</p> : null}
            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          </div>
        </div>
      </div>
    </>
  );
}
