create table if not exists public.exhibition_external_reviews (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  source_name text not null check (char_length(source_name) between 1 and 120),
  url text not null check (char_length(url) between 1 and 1000),
  summary text check (summary is null or char_length(summary) <= 1000),
  sort_order int not null default 100 check (sort_order between 0 and 9999),
  is_hidden boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exhibition_id, url)
);

create index if not exists idx_exhibition_external_reviews_exhibition_id
on public.exhibition_external_reviews(exhibition_id);

create index if not exists idx_exhibition_external_reviews_sort_order
on public.exhibition_external_reviews(exhibition_id, sort_order, created_at desc);

drop trigger if exists trg_exhibition_external_reviews_updated_at on public.exhibition_external_reviews;
create trigger trg_exhibition_external_reviews_updated_at
before update on public.exhibition_external_reviews
for each row execute procedure public.set_updated_at();

alter table public.exhibition_external_reviews enable row level security;

drop policy if exists "Public can read curated external reviews" on public.exhibition_external_reviews;
create policy "Public can read curated external reviews"
on public.exhibition_external_reviews
for select
using (
  is_hidden = false
  and exists (
    select 1
    from public.exhibitions
    where exhibitions.id = exhibition_external_reviews.exhibition_id
      and exhibitions.published_at is not null
      and exhibitions.status in ('upcoming', 'ongoing', 'ended')
  )
);

drop policy if exists "Admins can manage curated external reviews" on public.exhibition_external_reviews;
create policy "Admins can manage curated external reviews"
on public.exhibition_external_reviews
for all
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
