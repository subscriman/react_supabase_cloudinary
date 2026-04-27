import Head from 'next/head';
import Link from 'next/link';

const EFFECTIVE_DATE = '2026-04-02';

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>개인정보처리방침 | ArtTomato</title>
        <meta name="description" content="ArtTomato 개인정보처리방침 초안" />
      </Head>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← 홈으로
          </Link>
          <h1 className="mt-4 text-2xl font-semibold md:text-3xl">개인정보처리방침</h1>
          <p className="mt-2 text-sm text-zinc-500">시행일: {EFFECTIVE_DATE}</p>

          <div className="mt-6 space-y-6 text-sm leading-7 text-zinc-300">
            <section>
              <h2 className="text-base font-medium text-zinc-100">1. 수집 항목</h2>
              <p>이메일, 인증 식별자, 선택 프로필 정보, 서비스 이용 기록을 수집할 수 있습니다.</p>
            </section>
            <section>
              <h2 className="text-base font-medium text-zinc-100">2. 이용 목적</h2>
              <p>로그인 제공, 리뷰 기능 운영, 서비스 안정성 개선 및 부정 이용 방지를 위해 사용합니다.</p>
            </section>
            <section>
              <h2 className="text-base font-medium text-zinc-100">3. 보유 기간</h2>
              <p>회원 탈퇴 또는 목적 달성 시 파기하며, 법령상 보관 의무가 있는 경우 해당 기간 보관합니다.</p>
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
