import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-lime-300">ArtTomato Admin</p>
        <h1 className="mt-3 text-3xl font-semibold">관리자 메뉴</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          기존 관리자 진입점입니다. 현재 운영 화면은 아래 ArtTomato 관리자 페이지에서 관리합니다.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/admin/dashboard"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 hover:border-lime-400"
          >
            대시보드
          </Link>
          <Link
            href="/admin/exhibitions"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 hover:border-lime-400"
          >
            전시 검수
          </Link>
          <Link
            href="/admin/ingestion-jobs"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 hover:border-lime-400"
          >
            수집 작업
          </Link>
          <Link
            href="/admin/crawling-test"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 hover:border-lime-400"
          >
            수집 테스트
          </Link>
        </div>
      </div>
    </main>
  );
}
