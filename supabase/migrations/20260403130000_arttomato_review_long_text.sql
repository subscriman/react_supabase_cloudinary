alter table public.reviews
add column if not exists detailed_review text;

alter table public.reviews
drop constraint if exists reviews_detailed_review_length;

alter table public.reviews
add constraint reviews_detailed_review_length
check (detailed_review is null or char_length(detailed_review) <= 3000);
