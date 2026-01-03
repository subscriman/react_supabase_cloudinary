-- Supabase 함수들

-- 프리셋 좋아요 수 증가
CREATE OR REPLACE FUNCTION increment_preset_likes(preset_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE subscription_presets 
  SET likes = likes + 1, updated_at = NOW()
  WHERE id = preset_id;
END;
$$ LANGUAGE plpgsql;

-- 프리셋 좋아요 수 감소
CREATE OR REPLACE FUNCTION decrement_preset_likes(preset_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE subscription_presets 
  SET likes = GREATEST(likes - 1, 0), updated_at = NOW()
  WHERE id = preset_id;
END;
$$ LANGUAGE plpgsql;

-- 프리셋 다운로드 수 증가
CREATE OR REPLACE FUNCTION increment_preset_downloads(preset_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE subscription_presets 
  SET downloads = downloads + 1, updated_at = NOW()
  WHERE id = preset_id;
END;
$$ LANGUAGE plpgsql;

-- 만료 예정 구독 조회 (알림용)
CREATE OR REPLACE FUNCTION get_expiring_subscriptions(days_ahead INTEGER DEFAULT 1)
RETURNS TABLE (
  subscription_id UUID,
  user_id UUID,
  subscription_name VARCHAR,
  expiry_date DATE,
  days_until_expiry INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.name,
    s.expiry_date,
    (s.expiry_date - CURRENT_DATE)::INTEGER
  FROM subscriptions s
  WHERE s.is_active = true
    AND s.expiry_date IS NOT NULL
    AND s.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + days_ahead);
END;
$$ LANGUAGE plpgsql;

-- 만료 예정 서브 상품 조회 (알림용)
CREATE OR REPLACE FUNCTION get_expiring_sub_products(days_ahead INTEGER DEFAULT 1)
RETURNS TABLE (
  sub_product_id UUID,
  subscription_id UUID,
  user_id UUID,
  sub_product_name VARCHAR,
  expiry_date DATE,
  days_until_expiry INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.subscription_id,
    s.user_id,
    sp.name,
    sp.expiry_date,
    (sp.expiry_date - CURRENT_DATE)::INTEGER
  FROM sub_products sp
  JOIN subscriptions s ON sp.subscription_id = s.id
  WHERE sp.is_used = false
    AND sp.expiry_date IS NOT NULL
    AND sp.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + days_ahead)
    AND s.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 사용자 통계 조회
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE (
  total_users BIGINT,
  active_subscriptions BIGINT,
  total_presets BIGINT,
  total_preset_downloads BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM users),
    (SELECT COUNT(*) FROM subscriptions WHERE is_active = true),
    (SELECT COUNT(*) FROM subscription_presets),
    (SELECT COALESCE(SUM(downloads), 0) FROM subscription_presets);
END;
$$ LANGUAGE plpgsql;