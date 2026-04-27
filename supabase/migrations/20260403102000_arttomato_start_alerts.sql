create table if not exists public.exhibition_start_alerts (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notify_days_before int not null default 1 check (notify_days_before between 0 and 30),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (exhibition_id, user_id)
);

create index if not exists idx_exhibition_start_alerts_exhibition_id on public.exhibition_start_alerts(exhibition_id);
create index if not exists idx_exhibition_start_alerts_user_id on public.exhibition_start_alerts(user_id);
create index if not exists idx_exhibition_start_alerts_sent_at on public.exhibition_start_alerts(sent_at);

alter table public.exhibition_start_alerts enable row level security;

create policy "Users can read own start alerts"
on public.exhibition_start_alerts
for select
using (auth.uid() = user_id);

create policy "Users can insert own start alerts"
on public.exhibition_start_alerts
for insert
with check (auth.uid() = user_id);

create policy "Users can delete own start alerts"
on public.exhibition_start_alerts
for delete
using (auth.uid() = user_id);
