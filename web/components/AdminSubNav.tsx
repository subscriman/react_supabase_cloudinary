import Link from 'next/link';
import { useRouter } from 'next/router';

type AdminNavItem = {
  href: string;
  label: string;
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin/dashboard', label: '대시보드' },
  { href: '/admin/exhibitions', label: '전시 검수' },
  { href: '/admin/ingestion-jobs', label: '수집 이력' },
  { href: '/admin/crawling-test', label: '크롤링 테스트' },
  { href: '/admin/duplicates', label: '중복 처리' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin/exhibitions') {
    return pathname === href || pathname.startsWith('/admin/exhibitions/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSubNav() {
  const router = useRouter();
  const pathname = router.pathname || '';

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active
                ? 'bg-lime-300/15 text-lime-200 ring-1 ring-lime-300/40'
                : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
