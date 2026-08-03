-- Portal settings (key/value). Run once in the Supabase SQL editor
-- (project gsvdtgtkhnpqlwhbsfal). Used by the /portal Settings tab and
-- api/contact.js (inquiry email forwarding).
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
