-- BoraRio Superapp — Migração Incremental 008
-- Sincronização Global da Curadoria Noturna & Coletor Oficial Riotur
-- Adiciona plataformas RIOTUR e VISIT_RIO, fonte de ingestão oficial e
-- assegura que a leitura pública permaneça estrita (PUBLICADO vigente), enquanto
-- a escrita administrativa é executada via /api/nightlife (Serverless Service Role)
-- ou por usuários com perfil autenticado. Preserva 001 a 007.

-- 1. Ampliação do CHECK de plataformas permitidas
alter table public.nightlife_events
  drop constraint if exists nightlife_events_source_platform_check;

alter table public.nightlife_events
  add constraint nightlife_events_source_platform_check check (
    source_platform in (
      'SYMPLA',
      'INGRESSE',
      'SHOTGUN',
      'EVENTBRITE',
      'EVENTIM',
      'TICKETMASTER',
      'TICKET360',
      'TA_SENDO',
      'RIO_NA_NOITE',
      'AGENDA_RIO',
      'PARTNER_PORTAL',
      'CSV_JSON',
      'MANUAL_ADMIN',
      'RIOTUR',
      'VISIT_RIO'
    )
  );

-- 2. Registro da fonte oficial Riotur nas fontes de ingestão
insert into public.nightlife_ingestion_sources (source_code, display_name, source_platform, mode, last_message)
values
  ('riotur_calendar', 'Riotur Agenda Oficial (Rio o Ano Inteiro)', 'RIOTUR', 'API', 'Sincronização com o calendário oficial da Prefeitura/Riotur.')
on conflict (source_code) do update set
  display_name = excluded.display_name,
  last_message = excluded.last_message,
  updated_at = now();

-- 3. Leitura e escrita para curadoria administrativa autenticada
-- Usuários autenticados no Supabase (incluindo curadores e administradores)
-- podem ler todas as filas (PENDENTE, PROGRAMADO, PUBLICADO, REJEITADO, EXPIRADO)
drop policy if exists "Curadoria autenticada visualiza todas as filas" on public.nightlife_events;
create policy "Curadoria autenticada visualiza todas as filas" on public.nightlife_events
  for select using (auth.role() = 'authenticated');

-- Gravações server-side com SUPABASE_SERVICE_ROLE_KEY ignoram RLS nativamente.
-- Esta política permite ainda inserção/atualização por administradores autenticados.
drop policy if exists "Curadoria autenticada gerencia eventos" on public.nightlife_events;
create policy "Curadoria autenticada gerencia eventos" on public.nightlife_events
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Runs de ingestao leitura publica ou autenticada" on public.nightlife_ingestion_runs;
create policy "Runs de ingestao leitura publica ou autenticada" on public.nightlife_ingestion_runs
  for select using (true);
