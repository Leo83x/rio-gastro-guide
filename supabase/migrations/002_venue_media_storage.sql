-- BoraRio Superapp — Supabase Storage Bucket & Políticas para Mídia Otimizada (WebP)
-- Idempotente: garante criação do bucket público "venue-media" (até 5 MB por arquivo WebP/JPEG/PNG).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-media',
  'venue-media',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Venue media public read" on storage.objects;
create policy "Venue media public read"
  on storage.objects for select
  using (bucket_id = 'venue-media');

-- Permite upload e atualização a partir do painel /admin.
-- Caso deseje restringir uploads apenas a administradores autenticados via Supabase Auth,
-- adicione `and auth.role() = 'authenticated'` nas cláusulas below.
drop policy if exists "Venue media upload" on storage.objects;
create policy "Venue media upload"
  on storage.objects for insert
  with check (bucket_id = 'venue-media');

drop policy if exists "Venue media update" on storage.objects;
create policy "Venue media update"
  on storage.objects for update
  using (bucket_id = 'venue-media')
  with check (bucket_id = 'venue-media');
