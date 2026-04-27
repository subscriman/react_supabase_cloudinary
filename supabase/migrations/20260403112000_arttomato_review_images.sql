alter table public.reviews
add column if not exists review_image_paths text[] not null default '{}';

alter table public.reviews
drop constraint if exists reviews_review_image_paths_max_count;

alter table public.reviews
add constraint reviews_review_image_paths_max_count
check (coalesce(array_length(review_image_paths, 1), 0) <= 4);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-images',
  'review-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload own review images" on storage.objects;
create policy "Authenticated users can upload own review images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = 'reviews'
  and (storage.foldername(name))[2] = (auth.uid())::text
);

drop policy if exists "Authenticated users can read own review images" on storage.objects;
create policy "Authenticated users can read own review images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'review-images'
  and (
    (
      (storage.foldername(name))[1] = 'reviews'
      and (storage.foldername(name))[2] = (auth.uid())::text
    )
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
  )
);

drop policy if exists "Authenticated users can update own review images" on storage.objects;
create policy "Authenticated users can update own review images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = 'reviews'
  and (storage.foldername(name))[2] = (auth.uid())::text
)
with check (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = 'reviews'
  and (storage.foldername(name))[2] = (auth.uid())::text
);

drop policy if exists "Authenticated users can delete own review images" on storage.objects;
create policy "Authenticated users can delete own review images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = 'reviews'
  and (storage.foldername(name))[2] = (auth.uid())::text
);
