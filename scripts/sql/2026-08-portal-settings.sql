-- STATUS: already applied 2026-08-03 via the Supabase management API. Kept
-- here only as a historical record of the schema — do NOT re-run as-is
-- against prod (the `create table if not exists` / policy blocks are safe
-- to re-run, but there is no need to).
--
-- Portal settings (key/value). Used by the /portal Settings tab and
-- api/contact.js (inquiry email forwarding). Project gsvdtgtkhnpqlwhbsfal.
create table if not exists public.portal_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.portal_settings enable row level security;

-- Any signed-in firm user may read and change settings.
-- No anon policies: the public site never touches this table directly —
-- api/contact.js reads it with the service role key.
create policy "authenticated read settings" on public.portal_settings
  for select to authenticated using (true);
create policy "authenticated insert settings" on public.portal_settings
  for insert to authenticated with check (true);
create policy "authenticated update settings" on public.portal_settings
  for update to authenticated using (true) with check (true);
