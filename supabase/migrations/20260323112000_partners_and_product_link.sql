-- 파트너사 테이블 및 상품-파트너 매칭 컬럼 추가

CREATE TABLE IF NOT EXISTS public.partners (
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

ALTER TABLE public.subscription_presets
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partners_is_active
  ON public.partners(is_active);

CREATE INDEX IF NOT EXISTS idx_subscription_presets_partner_id
  ON public.subscription_presets(partner_id);
