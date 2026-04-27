import Head from 'next/head';
import Link from 'next/link';

const EFFECTIVE_DATE = '2026-04-02';

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>이용약관 | ArtTomato</title>
        <meta name="description" content="ArtTomato 이용약관 초안" />
      </Head>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← 홈으로
          </Link>
          <h1 className="mt-4 text-2xl font-semibold md:text-3xl">이용약관</h1>
          <p className="mt-2 text-sm text-zinc-500">시행일: {EFFECTIVE_DATE}</p>

          <div className="mt-6 space-y-6 text-sm leading-7 text-zinc-300">
            <section>
              <h2 className="text-base font-medium text-zinc-100">1. 서비스 목적</h2>
              <p>ArtTomato는 전시 정보 탐색과 관람 리뷰 공유를 위한 서비스를 제공합니다.</p>
            </section>
            <section>
              <h2 className="text-base font-medium text-zinc-100">2. 이용자 책임</h2>
              <p>이용자는 본인 계정과 작성 콘텐츠에 대한 책임을 가지며, 타인 권리를 침해하면 안 됩니다.</p>
            </section>
            <section>
              <h2 className="text-base font-medium text-zinc-100">3. 금지행위</h2>
              <p>도용, 불법 콘텐츠 게시, 서비스 악용, 명예훼손성 게시물 등록을 금지합니다.</p>
            </section>
            <section>
              <h2 className="text-base font-medium text-zinc-100">4. 문의</h2>
              <p>문의: support@arttomato.example</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
