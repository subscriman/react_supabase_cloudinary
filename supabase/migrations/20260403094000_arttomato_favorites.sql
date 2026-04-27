create table if not exists public.exhibition_favorites (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (exhibition_id, user_id)
);

create index if not exists idx_exhibition_favorites_exhibition_id on public.exhibition_favorites(exhibition_id);
create index if not exists idx_exhibition_favorites_user_id on public.exhibition_favorites(user_id);

alter table public.exhibition_favorites enable row level security;

create policy "Users can read own favorites"
on public.exhibition_favorites
for select
using (auth.uid() = user_id);

create policy "Users can insert own favorites"
on public.exhibition_favorites
for insert
with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
on public.exhibition_favorites
for delete
using (auth.uid() = user_id);
