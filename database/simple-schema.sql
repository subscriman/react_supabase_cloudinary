-- 테스트용 간단한 스키마 (RLS 없이)

-- 구독 프리셋 테이블 (관리자용)
CREATE TABLE IF NOT EXISTS mobile_categories (
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

CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name VARCHAR(120) NOT NULL,
  contact_email VARCHAR(255),
  business_registration_number VARCHAR(20) UNIQUE NOT NULL,
  phone_number VARCHAR(30),
  manager_primary_name VARCHAR(100),
  manager_primary_phone VARCHAR(30),
  manager_secondary_name VARCHAR(100),
  manager_secondary_phone VARCHAR(30),
  manager_tertiary_name VARCHAR(100),
  manager_tertiary_phone VARCHAR(30),
  login_id VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_algorithm VARCHAR(30) DEFAULT 'sha256',
  password_temporary BOOLEAN DEFAULT true,
  password_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  password_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  business_address TEXT,
  contract_started_at DATE,
  contract_ended_at DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  description TEXT,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  is_official BOOLEAN DEFAULT false,
  created_by VARCHAR(100) DEFAULT 'admin',
  likes INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  template JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 배너 테이블
CREATE TABLE IF NOT EXISTS banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  image_url TEXT,
  link_url TEXT,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO mobile_categories (
  category_key,
  label,
  short_label,
  description,
  sort_order,
  is_active
)
VALUES
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
ON CONFLICT (category_key) DO NOTHING;

-- T우주 샘플 프리셋 데이터 삽입
INSERT INTO subscription_presets (name, provider, description, is_official, template) 
VALUES (
  'T우주 - 배달의민족',
  'SKT',
  '배달의민족 3천원 쿠폰 3장 제공',
  true,
  '{
    "subscription": {
      "name": "T우주",
      "provider": "SKT",
      "is_active": true,
      "sub_products": []
    },
    "sub_products": [
      {
        "name": "배달의민족 3천원 쿠폰 #1",
        "type": "coupon",
        "quantity": 1,
        "validity_period": 30,
        "is_used": false,
        "description": "3천원 할인 쿠폰"
      },
      {
        "name": "배달의민족 3천원 쿠폰 #2", 
        "type": "coupon",
        "quantity": 1,
        "validity_period": 30,
        "is_used": false,
        "description": "3천원 할인 쿠폰"
      },
      {
        "name": "배달의민족 3천원 쿠폰 #3",
        "type": "coupon", 
        "quantity": 1,
        "validity_period": 30,
        "is_used": false,
        "description": "3천원 할인 쿠폰"
      }
    ]
  }'::jsonb
) ON CONFLICT DO NOTHING;
