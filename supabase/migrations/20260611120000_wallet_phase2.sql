-- Fase 2: carteira do apostador, ledger e entradas de bolão

alter table public.transactions
  add column if not exists funding_mode text not null default 'legacy_entry'
  check (funding_mode in ('legacy_entry', 'wallet_topup'));

create table if not exists public.bettor_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(12, 2) not null default 0.00,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.bettor_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  group_id uuid references public.bolao_groups(id) on delete set null,
  pool_entry_id uuid,
  direction text not null check (direction in ('credit', 'debit')),
  reason text not null,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz default now() not null
);

create table if not exists public.pool_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.bolao_groups(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  source_transaction_id uuid references public.transactions(id) on delete set null,
  bet_id text,
  status text not null default 'available' check (status in ('available', 'consumed')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_bettor_wallet_ledger_user_id on public.bettor_wallet_ledger(user_id, created_at desc);
create index if not exists idx_bettor_wallet_ledger_group_id on public.bettor_wallet_ledger(group_id, created_at desc);
create index if not exists idx_pool_entries_user_group on public.pool_entries(user_id, group_id, created_at desc);
create index if not exists idx_pool_entries_bet_id on public.pool_entries(bet_id);

alter table public.bettor_wallets enable row level security;
alter table public.bettor_wallet_ledger enable row level security;
alter table public.pool_entries enable row level security;

create policy "Usuarios podem visualizar propria carteira"
  on public.bettor_wallets for select using (auth.uid() = user_id);

create policy "Usuarios podem visualizar proprio ledger"
  on public.bettor_wallet_ledger for select using (auth.uid() = user_id);

create policy "Usuarios podem visualizar proprias entradas"
  on public.pool_entries for select using (auth.uid() = user_id);

create policy "Usuarios podem atualizar proprias entradas"
  on public.pool_entries for update using (auth.uid() = user_id);
