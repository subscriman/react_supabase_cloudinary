-- ArtTomato core schema for exhibition discovery and reviews

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.source_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_url text not null,
  list_url text,
  notes text,
  priority smallint not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text,
  district text,
  address text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  name_en text,
  birth_year int,
  death_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text not null default 'keyword'
    check (type in ('artist', 'movement', 'style', 'genre', 'venue', 'keyword')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, type)
);

create table if not exists public.exhibitions (
  id uuid primary key default gen_random_uuid(),
  source_site_id uuid references public.source_sites(id) on delete set null,
  source_external_id text,
  slug text not null unique,
  title text not null,
  subtitle text,
  venue_id uuid references public.venues(id) on delete set null,
  start_date date not null,
  end_date date not null,
  operating_hours text,
  admission_fee text,
  poster_image_url text,
  cover_image_url text,
  summary text,
  description text,
  official_url text,
  booking_url text,
  status text not null default 'pending_review'
    check (status in ('upcoming', 'ongoing', 'ended', 'hidden', 'pending_review', 'rejected')),
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_site_id, source_external_id)
);

create table if not exists public.exhibition_tags (
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exhibition_id, tag_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating numeric(2,1) not null
    check (rating >= 0.5 and rating <= 5.0 and round(rating * 2) = rating * 2),
  one_line_review text not null check (char_length(one_line_review) between 1 and 280),
  recommended_for text check (recommended_for in ('혼자', '친구와', '데이트', '가족')),
  visit_duration text check (visit_duration in ('30분', '1시간', '2시간 이상')),
  revisit_intent text check (revisit_intent in ('있음', '보통', '없음')),
  crowd_level text check (crowd_level in ('여유', '보통', '혼잡')),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exhibition_id, user_id)
);

create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  source_site_id uuid references public.source_sites(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  raw_count int not null default 0,
  inserted_count int not null default 0,
  updated_count int not null default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_exhibitions_status on public.exhibitions(status);
create index if not exists idx_exhibitions_start_date on public.exhibitions(start_date);
create index if not exists idx_exhibitions_end_date on public.exhibitions(end_date);
create index if not exists idx_exhibitions_published_at on public.exhibitions(published_at);
create index if not exists idx_reviews_exhibition_id on public.reviews(exhibition_id);
create index if not exists idx_reviews_user_id on public.reviews(user_id);
create index if not exists idx_ingestion_jobs_source_site_id on public.ingestion_jobs(source_site_id);
create index if not exists idx_tags_slug on public.tags(slug);

drop trigger if exists trg_source_sites_updated_at on public.source_sites;
create trigger trg_source_sites_updated_at
before update on public.source_sites
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_venues_updated_at on public.venues;
create trigger trg_venues_updated_at
before update on public.venues
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_artists_updated_at on public.artists;
create trigger trg_artists_updated_at
before update on public.artists
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_tags_updated_at on public.tags;
create trigger trg_tags_updated_at
before update on public.tags
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_exhibitions_updated_at on public.exhibitions;
create trigger trg_exhibitions_updated_at
before update on public.exhibitions
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_reviews_updated_at on public.reviews;
create trigger trg_reviews_updated_at
before update on public.reviews
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_ingestion_jobs_updated_at on public.ingestion_jobs;
create trigger trg_ingestion_jobs_updated_at
before update on public.ingestion_jobs
for each row execute procedure public.set_updated_at();

create or replace view public.exhibition_rating_summary as
select
  exhibition_id,
  round(avg(rating)::numeric, 1) as average_rating,
  count(*)::int as review_count
from public.reviews
where is_hidden = false
group by exhibition_id;

alter table public.exhibitions enable row level security;
alter table public.reviews enable row level security;
alter table public.profiles enable row level security;
alter table public.source_sites enable row level security;
alter table public.ingestion_jobs enable row level security;

create policy "Public can view published exhibitions"
on public.exhibitions
for select
using (published_at is not null and status in ('upcoming', 'ongoing', 'ended'));

create policy "Users can read public reviews"
on public.reviews
for select
using (is_hidden = false);

create policy "Users can insert own reviews"
on public.reviews
for insert
with check (auth.uid() = user_id);

create policy "Users can update own reviews"
on public.reviews
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own reviews"
on public.reviews
for delete
using (auth.uid() = user_id);

create policy "Profiles are readable"
on public.profiles
for select
using (true);

create policy "Users can upsert own profile"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Admins can manage exhibitions"
on public.exhibitions
for all
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

create policy "Admins can manage source sites"
on public.source_sites
for all
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

create policy "Admins can manage ingestion jobs"
on public.ingestion_jobs
for all
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);
