-- ====================================================================
-- Schema SQL Completo - BolãoPro 2026
-- Banco de Dados PostgreSQL (Supabase) com RLS para Arquitetura Multi-Tenant
-- ====================================================================

-- Habilitar extensões úteis
create extension if not exists "uuid-ossp";

-- 1. Tabela de Perfis de Usuários (Apostadores e Organizadores)
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null,
    avatar_url text,
    balance numeric(12, 2) not null default 0.00,
    total_points integer not null default 0,
    is_admin boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabela de Configurações do Tenant (Administrador/Organizador)
create table public.tenant_settings (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.profiles(id) on delete cascade not null,
    company_name text not null,
    fee_type text not null check (fee_type in ('percent', 'fixed')),
    fee_value numeric(10, 2) not null default 10.00, -- valor fixo em R$ ou porcentagem (ex: 20%)
    entry_fee numeric(10, 2) not null default 50.00, -- taxa de inscrição padrão do bolão
    min_withdrawal numeric(10, 2) not null default 50.00, -- limite mínimo de saque
    first_place_pct numeric(5, 2) not null default 60.00, -- rateio de prêmios
    second_place_pct numeric(5, 2) not null default 25.00,
    third_place_pct numeric(5, 2) not null default 15.00,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    constraint sum_distribution check (first_place_pct + second_place_pct + third_place_pct = 100.00)
);

-- 3. Tabela de Grupos de Bolões
create table public.bolao_groups (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    invite_code varchar(20) unique not null,
    prize_pool numeric(12, 2) not null default 0.00,
    net_prize_pool numeric(12, 2) not null default 0.00, -- valor líquido de rateio deduzidos as taxas
    created_by uuid references public.profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabela de Partidas da Copa 2026
create table public.matches (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.profiles(id) on delete set null,
    group_id uuid references public.bolao_groups(id) on delete set null,
    team_a text not null,
    team_b text not null,
    team_a_flag text,
    team_b_flag text,
    status text not null check (status in ('scheduled', 'live', 'finished')) default 'scheduled',
    score_a integer,
    score_b integer,
    started_at timestamp with time zone not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Tabela Oficial de Podio do Torneio
create table public.tournament_podium (
    id uuid default gen_random_uuid() primary key,
    tournament_key text not null default 'FIFA_WORLD_CUP_2026',
    position smallint not null check (position between 1 and 4),
    slot_key text not null check (slot_key in ('champion', 'runner_up', 'third_place', 'fourth_place')),
    position_label text not null,
    subtitle text not null,
    team_code text,
    team_name text,
    team_flag text,
    source_type text not null check (source_type in ('fifa_ranking', 'official_result', 'manual_admin')) default 'fifa_ranking',
    source_match_id uuid references public.matches(id) on delete set null,
    source_match_role text check (source_match_role in ('winner', 'loser', 'manual', 'ranking')),
    is_provisional boolean not null default true,
    locked boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_tournament_podium_position unique (tournament_key, position),
    constraint unique_tournament_podium_slot unique (tournament_key, slot_key)
);

-- 6. Tabela de Palpites dos Usuários (Picks)
create table public.user_picks (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    match_id uuid references public.matches(id) on delete cascade not null,
    score_a integer not null check (score_a >= 0),
    score_b integer not null check (score_b >= 0),
    points_awarded integer, -- calculado após encerramento da partida pela Edge Function
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    constraint unique_user_match_pick unique (user_id, match_id)
);

-- 7. Tabela de Transações Pix (PagBank)
create table public.transactions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    group_id uuid references public.bolao_groups(id) on delete cascade not null,
    amount numeric(10, 2) not null,
    status text not null check (status in ('pending', 'paid', 'failed', 'canceled', 'expired')) default 'pending',
    payment_method text not null default 'pix',
    pagbank_id text, -- ID da cobrança retornado pelo PagBank
    qrcode_text text, -- Conteúdo Pix Copia e Cola
    qrcode_image text, -- URL da imagem do QR Code
    expires_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ====================================================================
-- Configuração de Row Level Security (RLS) - Isolamento Multi-Tenant
-- ====================================================================

-- Habilitar RLS em todas as tabelas críticas
alter table public.profiles enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.bolao_groups enable row level security;
alter table public.matches enable row level security;
alter table public.tournament_podium enable row level security;
alter table public.user_picks enable row level security;
alter table public.transactions enable row level security;

-- 1. Políticas para Perfis (Profiles)
create policy "Usuários podem visualizar todos os perfis" 
    on public.profiles for select using (true);

create policy "Usuários podem atualizar seus próprios perfis" 
    on public.profiles for update using (auth.uid() = id);

create policy "Usuários podem criar seus próprios perfis" 
    on public.profiles for insert with check (auth.uid() = id);

-- 2. Políticas para Configurações do Tenant (Tenant Settings)
create policy "Tenants podem gerenciar suas próprias configurações"
    on public.tenant_settings for all using (auth.uid() = tenant_id);

create policy "Apostadores do bolão podem visualizar configurações do tenant"
    on public.tenant_settings for select using (true);

-- 3. Políticas para Grupos de Bolões (Bolao Groups)
create policy "Tenants podem gerenciar seus bolões"
    on public.bolao_groups for all using (auth.uid() = tenant_id);

create policy "Qualquer usuário logado pode visualizar grupos por convite"
    on public.bolao_groups for select using (true);

-- 4. Políticas para Partidas (Matches)
create policy "Tenants podem gerenciar partidas de seus bolões"
    on public.matches for all using (auth.uid() = tenant_id);

create policy "Qualquer usuário logado pode visualizar as partidas"
    on public.matches for select using (true);

-- 5. Políticas para Palpites (User Picks)
create policy "Podio oficial do torneio e publico"
    on public.tournament_podium for select using (true);

create policy "Usuarios autenticados podem inserir podio oficial"
    on public.tournament_podium for insert with check (auth.uid() is not null);

create policy "Usuarios autenticados podem atualizar podio oficial"
    on public.tournament_podium for update using (auth.uid() is not null);

-- 6. Políticas para Palpites (User Picks)
create policy "Usuários podem gerenciar seus próprios palpites"
    on public.user_picks for all using (auth.uid() = user_id);

-- Restringir visualização de palpites de outros antes do início do jogo (Anti-Cheat)
create policy "Apostadores podem ver palpites alheios somente se a partida estiver iniciada/encerrada"
    on public.user_picks for select 
    using (
        auth.uid() = user_id 
        or exists (
            select 1 from public.matches 
            where matches.id = match_id 
            and (matches.status = 'live' or matches.status = 'finished' or matches.started_at < now())
        )
    );

create policy "Apostadores autenticados podem ver palpites de bolões de pódio"
    on public.user_picks for select
    using (
        auth.uid() is not null
        and match_id in (
            '00000000-0000-0000-0000-9999a0d11111',
            '00000000-0000-0000-0000-9999a0d22222',
            '00000000-0000-0000-0000-9999a0d33333',
            '00000000-0000-0000-0000-9999a0d44444'
        )
    );

-- 7. Políticas para Transações (Transactions)
create policy "Usuários visualizam suas próprias transações"
    on public.transactions for select using (auth.uid() = user_id);

create policy "System/Edge functions podem gerenciar transações"
    on public.transactions for all using (true);

-- ====================================================================
-- Índices para Performance e Integridade Multi-Tenant
-- ====================================================================
create index idx_tenant_settings_id on public.tenant_settings(tenant_id);
create index idx_bolao_groups_tenant on public.bolao_groups(tenant_id);
create index idx_matches_tenant_group on public.matches(tenant_id, group_id);
create index idx_tournament_podium_tournament on public.tournament_podium(tournament_key);
create index idx_tournament_podium_source_match on public.tournament_podium(source_match_id);
create index idx_user_picks_match on public.user_picks(match_id);
create index idx_user_picks_user on public.user_picks(user_id);
create index idx_transactions_user_group on public.transactions(user_id, group_id);
create index idx_groups_invite_code on public.bolao_groups(invite_code);
