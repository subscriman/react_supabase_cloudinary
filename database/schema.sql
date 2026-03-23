-- 구독 관리 앱 데이터베이스 스키마

-- 사용자 테이블
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'kakao', 'naver')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 구독 상품 테이블
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  start_date DATE,
  payment_date DATE,
  payment_amount DECIMAL(10,2),
  payment_method VARCHAR(50),
  expiry_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 서브 상품 테이블
CREATE TABLE sub_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('coupon', 'benefit', 'service')),
  quantity INTEGER DEFAULT 1,
  expiry_date DATE,
  validity_period INTEGER, -- days
  is_used BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 모바일 카테고리 테이블
CREATE TABLE mobile_categories (
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

-- 파트너사 테이블
CREATE TABLE partners (
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

-- 구독 프리셋 테이블
CREATE TABLE subscription_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  description TEXT,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  is_official BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  likes INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  template JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 프리셋 좋아요 테이블
CREATE TABLE preset_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preset_id UUID REFERENCES subscription_presets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, preset_id)
);

-- 알림 설정 테이블
CREATE TABLE notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('payment', 'expiry', 'benefit')),
  days_before_alert INTEGER DEFAULT 1,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 관리자 공지사항 테이블
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 배너 광고 테이블
CREATE TABLE banners (
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

-- 인덱스 생성
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_sub_products_subscription_id ON sub_products(subscription_id);
CREATE INDEX idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX idx_preset_likes_user_id ON preset_likes(user_id);
CREATE INDEX idx_preset_likes_preset_id ON preset_likes(preset_id);
CREATE INDEX idx_subscription_presets_partner_id ON subscription_presets(partner_id);
CREATE INDEX idx_partners_is_active ON partners(is_active);
CREATE INDEX idx_mobile_categories_active_sort ON mobile_categories(is_active, sort_order);

-- RLS (Row Level Security) 정책
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_likes ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 데이터만 접근 가능
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON subscriptions FOR DELETE USING (auth.uid() = user_id);

-- 프리셋은 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view presets" ON subscription_presets FOR SELECT USING (true);
CREATE POLICY "Users can insert presets" ON subscription_presets FOR INSERT WITH CHECK (auth.uid() = created_by);
