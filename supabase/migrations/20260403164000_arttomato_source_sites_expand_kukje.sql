insert into public.source_sites (
  name,
  base_url,
  list_url,
  priority,
  notes,
  collector_key,
  detail_url_hint,
  crawl_difficulty,
  is_blocked,
  field_mapping_notes,
  is_active
)
values (
  '국제갤러리',
  'https://www.kukjegallery.com',
  'https://www.kukjegallery.com/exhibitions',
  55,
  '확장 수집 사이트',
  'kukje',
  'https://www.kukjegallery.com/exhibitions',
  'medium',
  false,
  '민간 갤러리 전시 목록에서 상세 링크 우선 추출',
  true
)
on conflict (name) do update
set
  base_url = excluded.base_url,
  list_url = excluded.list_url,
  priority = excluded.priority,
  notes = excluded.notes,
  collector_key = excluded.collector_key,
  detail_url_hint = excluded.detail_url_hint,
  crawl_difficulty = excluded.crawl_difficulty,
  is_blocked = excluded.is_blocked,
  field_mapping_notes = excluded.field_mapping_notes,
  is_active = true;
