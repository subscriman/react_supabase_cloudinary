update public.source_sites
set
  collector_key = 'mmca',
  detail_url_hint = 'https://www.mmca.go.kr/exhibitions/exhibitionsDetail.do',
  crawl_difficulty = 'easy',
  is_blocked = false,
  field_mapping_notes = '목록 페이지에서 전시명/기간/상세 링크를 우선 추출'
where name = '국립현대미술관';

update public.source_sites
set
  collector_key = 'sac',
  detail_url_hint = 'https://www.sac.or.kr/site/main/show/show_view',
  crawl_difficulty = 'easy',
  is_blocked = false,
  field_mapping_notes = '전시 탭 목록에서 상세 링크 추출'
where name = '예술의전당';

update public.source_sites
set
  collector_key = 'warmemo',
  detail_url_hint = 'https://www.warmemo.or.kr:8443/Home/H20000/H20200/boardView',
  crawl_difficulty = 'hard',
  is_blocked = false,
  field_mapping_notes = '기획/특별전 게시판만 필터링'
where name = '전쟁기념관 기획/특별전';

update public.source_sites
set
  collector_key = 'sema',
  detail_url_hint = 'https://sema.seoul.go.kr/kr/whatson/exhibition/detail',
  crawl_difficulty = 'medium',
  is_blocked = false,
  field_mapping_notes = '메인/전시 섹션 혼재로 링크 필터 필요'
where name = '서울시립미술관';

update public.source_sites
set
  collector_key = 'museum',
  detail_url_hint = 'https://www.museum.go.kr/site/main/exhibition/special/view',
  crawl_difficulty = 'easy',
  is_blocked = false,
  field_mapping_notes = '특별전 목록 기준으로 상세 진입'
where name = '국립중앙박물관';

update public.source_sites
set
  collector_key = 'busan-art',
  detail_url_hint = 'https://art.busan.go.kr/index.nm',
  crawl_difficulty = 'medium',
  is_blocked = false,
  field_mapping_notes = '전시/행사 콘텐츠 분리 필요'
where name = '부산시립미술관';

update public.source_sites
set
  collector_key = 'daegu-art',
  detail_url_hint = 'https://daeguartmuseum.or.kr/exhibitions',
  crawl_difficulty = 'medium',
  is_blocked = false,
  field_mapping_notes = '메인 진입 후 전시 메뉴 링크 추출'
where name = '대구미술관';

update public.source_sites
set
  collector_key = 'leeum',
  detail_url_hint = 'https://www.leeumhoam.org/exhibitions',
  crawl_difficulty = 'medium',
  is_blocked = false,
  field_mapping_notes = 'SPA 구조 여부 확인 필요'
where name = '리움미술관';

update public.source_sites
set
  collector_key = 'apma',
  detail_url_hint = 'https://apma.amorepacific.com/exhibitions',
  crawl_difficulty = 'medium',
  is_blocked = false,
  field_mapping_notes = '전시 외 콘텐츠 혼재 가능'
where name = '아모레퍼시픽미술관';

update public.source_sites
set
  collector_key = 'ddp',
  detail_url_hint = 'https://ddp.or.kr/',
  crawl_difficulty = 'medium',
  is_blocked = false,
  field_mapping_notes = '디자인/행사 혼재로 전시 성격 필터링 필요'
where name = 'DDP';

update public.source_sites
set
  collector_key = 'sejong',
  detail_url_hint = 'https://www.sejongpac.or.kr/portal/program/exhibition',
  crawl_difficulty = 'medium',
  is_blocked = false,
  field_mapping_notes = '공연/전시 메뉴 분리 후 수집'
where name = '세종문화회관 전시';
