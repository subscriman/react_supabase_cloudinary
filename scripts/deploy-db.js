const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 환경 변수에서 Supabase 설정 읽기
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase URL 또는 Service Key가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  console.log('🚀 데이터베이스 마이그레이션을 시작합니다...');

  const migrationsDir = path.join(__dirname, '../supabase/migrations');
  
  try {
    const files = fs.readdirSync(migrationsDir).sort();
    
    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`📄 실행 중: ${file}`);
        
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
        
        if (error) {
          console.error(`❌ ${file} 실행 실패:`, error);
        } else {
          console.log(`✅ ${file} 실행 완료`);
        }
      }
    }
    
    console.log('🎉 모든 마이그레이션이 완료되었습니다!');
    
  } catch (error) {
    console.error('❌ 마이그레이션 실행 중 오류:', error);
  }
}

// 직접 SQL 실행 함수
async function executeSqlFile(filename) {
  const filePath = path.join(__dirname, '../supabase/migrations', filename);
  const sqlContent = fs.readFileSync(filePath, 'utf8');
  
  console.log(`📄 실행 중: ${filename}`);
  
  // SQL을 세미콜론으로 분리해서 개별 실행
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('query', { query: statement });
      if (error) {
        console.error('SQL 실행 오류:', error);
      }
    } catch (err) {
      console.error('실행 중 오류:', err);
    }
  }
  
  console.log(`✅ ${filename} 실행 완료`);
}

// 메인 실행
async function main() {
  try {
    // 각 마이그레이션 파일을 순서대로 실행
    await executeSqlFile('20260103031331_initial_schema.sql');
    await executeSqlFile('20260103031541_sample_data.sql');
    await executeSqlFile('20260103031611_functions.sql');
    
    console.log('🎉 데이터베이스 설정이 완료되었습니다!');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

main();