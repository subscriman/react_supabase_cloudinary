-- ArtTomato seed data for local development

insert into public.source_sites (name, base_url, list_url, priority, notes)
values
  ('국립현대미술관', 'https://www.mmca.go.kr', 'https://www.mmca.go.kr/exhibitions/progressList.do', 10, '초기 수집 사이트'),
  ('예술의전당', 'https://www.sac.or.kr', 'https://www.sac.or.kr/site/main/program/schedule?tab=3', 20, '초기 수집 사이트'),
  ('전쟁기념관 기획/특별전', 'https://www.warmemo.or.kr:8443', 'https://www.warmemo.or.kr:8443/Home/H20000/H20200/boardList', 70, '초기 수집 사이트'),
  ('서울시립미술관', 'https://sema.seoul.go.kr', 'https://sema.seoul.go.kr/', 15, '초기 수집 사이트'),
  ('국립중앙박물관', 'https://www.museum.go.kr', 'https://www.museum.go.kr/site/main/exhibition/special/list', 25, '초기 수집 사이트'),
  ('부산시립미술관', 'https://art.busan.go.kr', 'https://art.busan.go.kr/index.nm', 60, '초기 수집 사이트'),
  ('대구미술관', 'https://daeguartmuseum.or.kr', 'https://daeguartmuseum.or.kr/', 60, '초기 수집 사이트'),
  ('리움미술관', 'https://www.leeumhoam.org', 'https://www.leeumhoam.org/', 30, '초기 수집 사이트'),
  ('아모레퍼시픽미술관', 'https://apma.amorepacific.com', 'https://apma.amorepacific.com/', 50, '초기 수집 사이트'),
  ('DDP', 'https://ddp.or.kr', 'https://ddp.or.kr/index.html?menu_id=2', 40, '초기 수집 사이트'),
  ('세종문화회관 전시', 'https://www.sejongpac.or.kr', 'https://www.sejongpac.or.kr/portal/subMain/exhibition.do', 45, '초기 수집 사이트')
on conflict (name) do update
set
  base_url = excluded.base_url,
  list_url = excluded.list_url,
  priority = excluded.priority,
  notes = excluded.notes,
  is_active = true;

insert into public.venues (name, city, district, address, website_url)
values
  ('국립현대미술관 서울', '서울', '종로구', '서울 종로구 삼청로 30', 'https://www.mmca.go.kr'),
  ('예술의전당 한가람미술관', '서울', '서초구', '서울 서초구 남부순환로 2406', 'https://www.sac.or.kr'),
  ('DDP 디자인랩', '서울', '중구', '서울 중구 을지로 281', 'https://ddp.or.kr')
on conflict (name) do update
set
  city = excluded.city,
  district = excluded.district,
  address = excluded.address,
  website_url = excluded.website_url;

insert into public.exhibitions (
  source_site_id,
  slug,
  title,
  subtitle,
  venue_id,
  start_date,
  end_date,
  operating_hours,
  admission_fee,
  poster_image_url,
  summary,
  description,
  official_url,
  status,
  published_at
)
values
  (
    (select id from public.source_sites where name = '국립현대미술관' limit 1),
    'mmca-seoul-collection-highlight-2026',
    'MMCA 서울 컬렉션 하이라이트 2026',
    '현대미술 주요 소장품을 다시 읽는 기획전',
    (select id from public.venues where name = '국립현대미술관 서울' limit 1),
    '2026-03-01',
    '2026-06-30',
    '화-일 10:00-18:00 (수, 토 21:00까지)',
    '성인 5,000원',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
    '국립현대미술관 주요 소장품을 중심으로 한국 현대미술 흐름을 훑어보는 전시.',
    '회화, 설치, 영상 작품을 통해 시대별 미술 언어의 변화를 소개한다. 초심자도 감상 포인트를 따라가기 쉽도록 섹션별 안내를 강화했다.',
    'https://www.mmca.go.kr/exhibitions/progressList.do',
    'ongoing',
    now()
  ),
  (
    (select id from public.source_sites where name = '예술의전당' limit 1),
    'sac-van-gogh-great-passion-2026',
    '불멸의 화가 반 고흐: THE GREAT PASSION',
    '반 고흐의 생애와 작품 세계를 따라가는 몰입형 전시',
    (select id from public.venues where name = '예술의전당 한가람미술관' limit 1),
    '2026-04-10',
    '2026-08-16',
    '매일 10:00-19:00',
    '성인 22,000원',
    'https://images.unsplash.com/photo-1579783901586-d88db74b4fe4?auto=format&fit=crop&w=1200&q=80',
    '고흐의 주요 작품을 중심으로 작가의 시기별 변화와 편지 기록을 함께 소개.',
    '전시 오픈 전이며, 관람객 리뷰는 오픈 후 순차적으로 노출된다.',
    'https://www.sac.or.kr/site/main/program/schedule?tab=3',
    'upcoming',
    now()
  ),
  (
    (select id from public.source_sites where name = 'DDP' limit 1),
    'ddp-media-art-now-2026',
    '미디어아트 나우: Seoul Digital Canvas',
    '디지털 아트와 인터랙티브 설치를 한 자리에서',
    (select id from public.venues where name = 'DDP 디자인랩' limit 1),
    '2026-02-14',
    '2026-05-18',
    '화-일 10:00-20:00',
    '성인 15,000원',
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
    '디자인과 미디어 기술이 결합된 전시를 통해 최신 창작 트렌드를 소개한다.',
    '사진 촬영 가능 구역과 불가능 구역이 구분되어 있으니 현장 안내를 확인해야 한다.',
    'https://ddp.or.kr/index.html?menu_id=2',
    'ongoing',
    now()
  )
on conflict (slug) do update
set
  title = excluded.title,
  subtitle = excluded.subtitle,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  operating_hours = excluded.operating_hours,
  admission_fee = excluded.admission_fee,
  poster_image_url = excluded.poster_image_url,
  summary = excluded.summary,
  description = excluded.description,
  official_url = excluded.official_url,
  status = excluded.status,
  published_at = excluded.published_at;

insert into public.tags (name, slug, type)
values
  ('반 고흐', 'van-gogh', 'artist'),
  ('후기인상주의', 'post-impressionism', 'movement'),
  ('미디어아트', 'media-art', 'genre'),
  ('한국현대미술', 'korean-modern-art', 'movement')
on conflict (slug) do update
set
  name = excluded.name,
  type = excluded.type;

insert into public.exhibition_tags (exhibition_id, tag_id)
select e.id, t.id
from public.exhibitions e
join public.tags t on t.slug in ('korean-modern-art')
where e.slug = 'mmca-seoul-collection-highlight-2026'
on conflict do nothing;

insert into public.exhibition_tags (exhibition_id, tag_id)
select e.id, t.id
from public.exhibitions e
join public.tags t on t.slug in ('van-gogh', 'post-impressionism')
where e.slug = 'sac-van-gogh-great-passion-2026'
on conflict do nothing;

insert into public.exhibition_tags (exhibition_id, tag_id)
select e.id, t.id
from public.exhibitions e
join public.tags t on t.slug in ('media-art')
where e.slug = 'ddp-media-art-now-2026'
on conflict do nothing;
