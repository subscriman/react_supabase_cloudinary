alter table public.exhibitions
add column if not exists additional_image_urls text[] not null default '{}';

alter table public.exhibitions
drop constraint if exists exhibitions_additional_image_urls_max_count;

alter table public.exhibitions
add constraint exhibitions_additional_image_urls_max_count
check (coalesce(array_length(additional_image_urls, 1), 0) <= 2);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exhibition-assets',
  'exhibition-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can manage exhibition assets" on storage.objects;
create policy "Admins can manage exhibition assets"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'exhibition-assets'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
)
with check (
  bucket_id = 'exhibition-assets'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

