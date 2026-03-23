-- 모바일 카테고리 관리용 테이블 및 기본 카테고리 추가

CREATE TABLE IF NOT EXISTS public.mobile_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_key VARCHAR(80) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  short_label VARCHAR(40) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_categories_active_sort
  ON public.mobile_categories(is_active, sort_order);

INSERT INTO public.mobile_categories (
  category_key,
  label,
  short_label,
  description,
  sort_order,
  is_active
) VALUES
  (
    'ott',
    'OTT 스트리밍',
    'OTT',
    '넷플릭스, 웨이브, 티빙 같은 영상/음악 스트리밍 상품',
    10,
    true
  ),
  (
    'delivery',
    '배달',
    '배달',
    '배민, 요기요처럼 배달/주문과 연동되는 상품',
    20,
    true
  ),
  (
    'telecom',
    '통신사 & 혜택',
    '통신사',
    'KT, SKT, LG U+ 멤버십과 통신사 혜택 상품',
    30,
    true
  ),
  (
    't-universe',
    'T우주 / 생활',
    'T우주',
    'T우주, 생활형 제휴 혜택, 쿠폰형 상품',
    40,
    true
  )
ON CONFLICT (category_key) DO UPDATE
SET
  label = EXCLUDED.label,
  short_label = EXCLUDED.short_label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
