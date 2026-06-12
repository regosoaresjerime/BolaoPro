alter table public.transactions
  add column if not exists expires_at timestamptz;

update public.transactions
set expires_at = created_at + interval '24 hours'
where expires_at is null;
