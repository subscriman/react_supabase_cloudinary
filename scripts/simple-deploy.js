const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log('🚀 테이블 생성을 시작합니다...');

  // 1. subscription_presets 테이블 생성
  const createPresetTable = `
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
  `;

  // 2. banners 테이블 생성
  const createBannerTable = `
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
  `;

  // 3. T우주 샘플 데이터
  const insertSampleData = `
    INSERT INTO subscription_presets (name, provider, description, is_official, template) 
    VALUES (
      'T우주 - 배달의민족',
      'SKT',
      '배달의민족 3천원 쿠폰 3장 제공',
      true,
      '{"subscription": {"name": "T우주", "provider": "SKT", "is_active": true, "sub_products": []}, "sub_products": [{"name": "배달의민족 3천원 쿠폰 #1", "type": "coupon", "quantity": 1, "validity_period": 30, "is_used": false, "description": "3천원 할인 쿠폰"}, {"name": "배달의민족 3천원 쿠폰 #2", "type": "coupon", "quantity": 1, "validity_period": 30, "is_used": false, "description": "3천원 할인 쿠폰"}, {"name": "배달의민족 3천원 쿠폰 #3", "type": "coupon", "quantity": 1, "validity_period": 30, "is_used": false, "description": "3천원 할인 쿠폰"}]}'::jsonb
    ) ON CONFLICT DO NOTHING;
  `;

  try {
    // 테이블 생성 시도
    console.log('📄 subscription_presets 테이블 생성 중...');
    const { error: error1 } = await supabase.rpc('exec', { sql: createPresetTable });
    if (error1) console.log('테이블이 이미 존재하거나 권한 문제:', error1.message);

    console.log('📄 banners 테이블 생성 중...');
    const { error: error2 } = await supabase.rpc('exec', { sql: createBannerTable });
    if (error2) console.log('테이블이 이미 존재하거나 권한 문제:', error2.message);

    console.log('📄 샘플 데이터 삽입 중...');
    const { error: error3 } = await supabase.rpc('exec', { sql: insertSampleData });
    if (error3) console.log('데이터 삽입 문제:', error3.message);

    console.log('✅ 데이터베이스 설정 완료!');
    
    // 테스트: 프리셋 조회
    console.log('🔍 프리셋 데이터 확인 중...');
    const { data, error } = await supabase
      .from('subscription_presets')
      .select('*');
    
    if (error) {
      console.log('❌ 프리셋 조회 실패:', error.message);
    } else {
      console.log('✅ 프리셋 데이터:', data?.length || 0, '개');
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

createTables();