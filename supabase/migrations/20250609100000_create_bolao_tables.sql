-- ==============================================
-- CRIAÇÃO COMPLETA DAS TABELAS DO SISTEMA DE BOLÃO
-- ==============================================

-- 1. Tabela de Grupos/Bolões
CREATE TABLE IF NOT EXISTS public.bolao_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    name text NOT NULL,
    invite_code text UNIQUE,
    prize_pool numeric(10,2) DEFAULT 0,
    net_prize_pool numeric(10,2) DEFAULT 0,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS para bolao_groups
ALTER TABLE public.bolao_groups ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para bolao_groups
CREATE POLICY "Permitir leitura pública de bolões" ON public.bolao_groups
    FOR SELECT USING (true);

CREATE POLICY "Permitir criação de bolão para usuários autenticados" ON public.bolao_groups
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir atualização do próprio bolão" ON public.bolao_groups
    FOR UPDATE USING (created_by = auth.uid() OR tenant_id = auth.uid());

CREATE POLICY "Permitir exclusão do próprio bolão" ON public.bolao_groups
    FOR DELETE USING (created_by = auth.uid() OR tenant_id = auth.uid());

-- 2. Tabela de Partidas
CREATE TABLE IF NOT EXISTS public.matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    group_id uuid REFERENCES public.bolao_groups(id) ON DELETE CASCADE,
    team_a text NOT NULL,
    team_b text NOT NULL,
    team_a_flag text,
    team_b_flag text,
    status text DEFAULT 'scheduled',
    score_a integer DEFAULT 0,
    score_b integer DEFAULT 0,
    started_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS para matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para matches
CREATE POLICY "Permitir leitura pública de partidas" ON public.matches
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserção de partidas para autenticados" ON public.matches
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir atualização de partidas" ON public.matches
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 3. Tabela de Palpites do Usuário
CREATE TABLE IF NOT EXISTS public.user_picks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id uuid REFERENCES public.bolao_groups(id) ON DELETE CASCADE,
    match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
    bet_id text,
    score_a integer NOT NULL DEFAULT 0,
    score_b integer NOT NULL DEFAULT 0,
    points integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS para user_picks
ALTER TABLE public.user_picks ENABLE ROW LEVEL SECURITY;

-- Constraints únicas
ALTER TABLE public.user_picks DROP CONSTRAINT IF EXISTS unique_user_match_pick;
ALTER TABLE public.user_picks DROP CONSTRAINT IF EXISTS unique_user_group_match_score_pick;
ALTER TABLE public.user_picks DROP CONSTRAINT IF EXISTS unique_bet_pick;

-- Nova constraint: um palpite por aposta e partida (onConflict no upsert)
ALTER TABLE public.user_picks 
ADD CONSTRAINT unique_bet_pick 
UNIQUE (bet_id, match_id);

-- Constraint para evitar palpites idênticos no mesmo bolão
ALTER TABLE public.user_picks 
ADD CONSTRAINT unique_user_group_match_score_pick 
UNIQUE (user_id, group_id, match_id, score_a, score_b);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_picks_user_group ON public.user_picks(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_user_picks_bet_id ON public.user_picks(bet_id);
CREATE INDEX IF NOT EXISTS idx_matches_group_id ON public.matches(group_id);

-- Políticas RLS para user_picks
CREATE POLICY "Permitir leitura dos próprios palpites" ON public.user_picks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Permitir inserção de palpites para usuários autenticados" ON public.user_picks
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Permitir atualização dos próprios palpites" ON public.user_picks
    FOR UPDATE USING (user_id = auth.uid());

-- 4. Tabela de Transações/Payments
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id uuid REFERENCES public.bolao_groups(id) ON DELETE SET NULL,
    amount numeric(10,2) NOT NULL,
    status text DEFAULT 'pending',
    payment_method text DEFAULT 'pix',
    qrcode_text text,
    qrcode_image text,
    pagbank_order_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS para transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para transactions
CREATE POLICY "Permitir leitura das próprias transações" ON public.transactions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Permitir inserção de transações para autenticados" ON public.transactions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Permitir atualização de transações" ON public.transactions
    FOR UPDATE USING (user_id = auth.uid());

-- 5. Tabela de Configurações do Tenant
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_name text DEFAULT 'Bolão Pro',
    fee_type text DEFAULT 'percent',
    fee_value numeric(5,2) DEFAULT 20,
    entry_fee numeric(10,2) DEFAULT 50,
    min_withdrawal numeric(10,2) DEFAULT 10,
    first_place_pct numeric(5,2) DEFAULT 50,
    second_place_pct numeric(5,2) DEFAULT 30,
    third_place_pct numeric(5,2) DEFAULT 20,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS para tenant_settings
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para tenant_settings
CREATE POLICY "Permitir leitura de configurações do tenant" ON public.tenant_settings
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserção de configurações para autenticados" ON public.tenant_settings
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Permitir atualização das próprias configurações" ON public.tenant_settings
    FOR UPDATE USING (tenant_id = auth.uid());

-- Índices adicionais
CREATE INDEX IF NOT EXISTS idx_transactions_user_group ON public.transactions(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);

-- ==============================================
-- CRIAR PARTIDAS DUMMY DE PÓDIO PARA EXISTIR
-- ==============================================
-- Estas partidas virtuais representam as colocações do pódio

DO $$
DECLARE
    first_group uuid;
    first_tenant uuid;
BEGIN
    -- Pegar o primeiro bolão e tenant existentes
    SELECT id INTO first_group FROM public.bolao_groups LIMIT 1;
    SELECT tenant_id INTO first_tenant FROM public.bolao_groups LIMIT 1;

    -- Se existir um bolão, criar as partidas de pódio
    IF first_group IS NOT NULL THEN
        INSERT INTO public.matches (id, tenant_id, group_id, team_a, team_b, team_a_flag, team_b_flag, status, started_at)
        VALUES
            ('00000000-0000-0000-0000-9999a0d11111', first_tenant, first_group, '1º Lugar', 'Campeão', '🏆', '🏆', 'scheduled', '2026-07-19T12:00:00.000Z'),
            ('00000000-0000-0000-0000-9999a0d22222', first_tenant, first_group, '2º Lugar', 'Vice-Campeão', '🥈', '🥈', 'scheduled', '2026-07-19T12:00:00.000Z'),
            ('00000000-0000-0000-0000-9999a0d33333', first_tenant, first_group, '3º Lugar', '3º Colocado', '🥉', '🥉', 'scheduled', '2026-07-19T12:00:00.000Z'),
            ('00000000-0000-0000-0000-9999a0d44444', first_tenant, first_group, '4º Lugar', '4º Colocado', '🏅', '🏅', 'scheduled', '2026-07-19T12:00:00.000Z')
        ON CONFLICT (id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            group_id = EXCLUDED.group_id,
            team_a = EXCLUDED.team_a,
            team_b = EXCLUDED.team_b,
            team_a_flag = EXCLUDED.team_a_flag,
            team_b_flag = EXCLUDED.team_b_flag;
    END IF;
END $$;
