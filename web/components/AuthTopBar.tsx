import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../hooks/useAuthSession';

export default function AuthTopBar() {
  const router = useRouter();
  const { user, loading, role } = useAuthSession();
  const [signingOut, setSigningOut] = useState(false);

  const pathname = router.pathname || '';
  const isExhibitionsActive = pathname === '/' || pathname.startsWith('/exhibitions');
  const isMypageActive = pathname.startsWith('/mypage');
  const isAdminActive = pathname.startsWith('/admin');

  const linkClass = (active: boolean) =>
    active
      ? 'font-semibold text-[color:var(--art-ink-strong)]'
      : 'text-[color:var(--art-ink-muted)] hover:text-[color:var(--art-ink-strong)]';

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      window.location.href = '/';
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/15 bg-white/65 px-4 py-3 text-sm backdrop-blur">
      <div className="flex items-center gap-3 text-[color:var(--art-ink-muted)]">
        <Link href="/" className={linkClass(isExhibitionsActive)}>
          전시 목록
        </Link>
        <span className="text-black/20">|</span>
        <Link href="/mypage" className={linkClass(isMypageActive)}>
          마이페이지
        </Link>
        {role === 'admin' ? (
          <>
            <span className="text-black/20">|</span>
            <Link href="/admin/exhibitions" className={linkClass(isAdminActive)}>
              관리자
            </Link>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-xs">
        {loading ? (
          <span className="text-[color:var(--art-ink-muted)]">세션 확인 중...</span>
        ) : user ? (
          <>
            <span className="max-w-[220px] truncate text-[color:var(--art-ink-muted)]">{user.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full border border-black/20 px-3 py-1 text-[color:var(--art-ink-strong)] transition hover:border-black/40 hover:bg-black/5 disabled:opacity-60"
            >
              {signingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
          </>
        ) : (
          <Link
            href="/auth"
            className="rounded-full border border-black/20 px-3 py-1 text-[color:var(--art-ink-strong)] transition hover:border-black/40 hover:bg-black/5"
          >
            로그인
          </Link>
        )}
      </div>
    </div>
  );
}
