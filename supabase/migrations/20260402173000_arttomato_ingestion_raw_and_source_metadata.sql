alter table public.source_sites
  add column if not exists collector_key text,
  add column if not exists detail_url_hint text,
  add column if not exists crawl_difficulty text not null default 'medium'
    check (crawl_difficulty in ('easy', 'medium', 'hard')),
  add column if not exists is_blocked boolean not null default false,
  add column if not exists field_mapping_notes text;

create unique index if not exists idx_source_sites_collector_key
on public.source_sites (collector_key)
where collector_key is not null;

create table if not exists public.ingestion_raw_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.ingestion_jobs(id) on delete set null,
  source_site_id uuid references public.source_sites(id) on delete set null,
  source_external_id text,
  source_list_url text,
  source_detail_url text,
  dedupe_key text,
  status text not null default 'raw'
    check (status in ('raw', 'validated', 'accepted', 'rejected')),
  raw_payload jsonb not null,
  normalized_payload jsonb,
  validation_errors text[] not null default '{}',
  llm_prompt_tokens int,
  llm_completion_tokens int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ingestion_raw_items_job_id on public.ingestion_raw_items(job_id);
create index if not exists idx_ingestion_raw_items_source_site_id on public.ingestion_raw_items(source_site_id);
create index if not exists idx_ingestion_raw_items_status on public.ingestion_raw_items(status);
create index if not exists idx_ingestion_raw_items_dedupe_key on public.ingestion_raw_items(dedupe_key);

drop trigger if exists trg_ingestion_raw_items_updated_at on public.ingestion_raw_items;
create trigger trg_ingestion_raw_items_updated_at
before update on public.ingestion_raw_items
for each row execute procedure public.set_updated_at();

alter table public.ingestion_raw_items enable row level security;

create policy "Admins can manage ingestion raw items"
on public.ingestion_raw_items
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
