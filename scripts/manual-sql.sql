-- 구독 관리 앱 기본 테이블 생성

-- 구독 프리셋 테이블
CREATE TABLE IF NOT EXISTS subscription_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  description TEXT,
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

-- 네이버플러스 샘플 프리셋
INSERT INTO subscription_presets (name, provider, description, is_official, template) 
VALUES (
  '네이버플러스 멤버십',
  '네이버',
  '네이버페이 적립, 무료배송 혜택 제공',
  true,
  '{
    "subscription": {
      "name": "네이버플러스 멤버십",
      "provider": "네이버",
      "is_active": true,
      "sub_products": []
    },
    "sub_products": [
      {
        "name": "네이버페이 적립 혜택",
        "type": "benefit",
        "quantity": 1,
        "validity_period": 365,
        "is_used": false,
        "description": "결제 시 추가 적립"
      },
      {
        "name": "무료배송 혜택",
        "type": "benefit",
        "quantity": 1,
        "validity_period": 365,
        "is_used": false,
        "description": "스마트스토어 무료배송"
      }
    ]
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- 샘플 배너 데이터
INSERT INTO banners (title, image_url, position, is_active) 
VALUES 
  ('T우주', 'https://via.placeholder.com/300x120/FF6B6B/FFFFFF?text=T우주', 1, true),
  ('네이버플러스', 'https://via.placeholder.com/300x120/4ECDC4/FFFFFF?text=네이버플러스', 2, true),
  ('쿠팡 와우', 'https://via.placeholder.com/300x120/45B7D1/FFFFFF?text=쿠팡와우', 3, true)
ON CONFLICT DO NOTHING;