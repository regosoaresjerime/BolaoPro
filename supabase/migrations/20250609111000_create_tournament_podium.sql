-- =============================================================
-- TABELA OFICIAL DE PODIO DO TORNEIO
-- Organiza o podio final fora de public.matches
-- =============================================================

CREATE TABLE IF NOT EXISTS public.tournament_podium (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_key text NOT NULL DEFAULT 'FIFA_WORLD_CUP_2026',
    position smallint NOT NULL CHECK (position BETWEEN 1 AND 4),
    slot_key text NOT NULL CHECK (slot_key IN ('champion', 'runner_up', 'third_place', 'fourth_place')),
    position_label text NOT NULL,
    subtitle text NOT NULL,
    team_code text,
    team_name text,
    team_flag text,
    source_type text NOT NULL DEFAULT 'fifa_ranking'
        CHECK (source_type IN ('fifa_ranking', 'official_result', 'manual_admin')),
    source_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
    source_match_role text
        CHECK (source_match_role IN ('winner', 'loser', 'manual', 'ranking')),
    is_provisional boolean NOT NULL DEFAULT true,
    locked boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_tournament_podium_position UNIQUE (tournament_key, position),
    CONSTRAINT unique_tournament_podium_slot UNIQUE (tournament_key, slot_key)
);

ALTER TABLE public.tournament_podium ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura publica do podio oficial" ON public.tournament_podium;
CREATE POLICY "Permitir leitura publica do podio oficial"
    ON public.tournament_podium FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir insercao do podio para autenticados" ON public.tournament_podium;
CREATE POLICY "Permitir insercao do podio para autenticados"
    ON public.tournament_podium FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Permitir atualizacao do podio para autenticados" ON public.tournament_podium;
CREATE POLICY "Permitir atualizacao do podio para autenticados"
    ON public.tournament_podium FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_tournament_podium_tournament
    ON public.tournament_podium(tournament_key);

CREATE INDEX IF NOT EXISTS idx_tournament_podium_source_match
    ON public.tournament_podium(source_match_id);

INSERT INTO public.tournament_podium (
    tournament_key,
    position,
    slot_key,
    position_label,
    subtitle,
    team_code,
    team_name,
    team_flag,
    source_type,
    source_match_id,
    source_match_role,
    is_provisional,
    locked
)
VALUES
    (
        'FIFA_WORLD_CUP_2026',
        1,
        'champion',
        '1º Lugar',
        'Campeao',
        'ARG',
        'Argentina',
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCJmuMinoNNpyjN50ez1KFsAdp2i3FrUB7M37Fcd5VcpHg2ZlsJgeLib_RJNRavc41tk47-tUYH7TEBycNql4P2VL2m5I_z1DlHT76N-gLgJhzyFErDiDg3669haGnKUKTUet9Qoos759vNQzy3EcFhmfixlzmOkRNm9l4AWc3KgiYaV1YcgwSV5N2Ci7vlKwfpiWsARrrqJcrdZUQkV9wcQAhvkBk25noRIPQwGP85sktmRYR_dYcaLAYhLRo3rqVcYEpMYUW0-vY',
        'fifa_ranking',
        '00000000-0000-0000-0000-000000000104',
        'winner',
        true,
        false
    ),
    (
        'FIFA_WORLD_CUP_2026',
        2,
        'runner_up',
        '2º Lugar',
        'Vice-Campeao',
        'ESP',
        'Espanha',
        'https://lh3.googleusercontent.com/aida-public/AB6AXuB7vNzeE8RsyKo8Fr3rL2PkL4AstJSLPk5MWkhnbl3_vaFgGY2W7ZdBkDFcG60VaUClxdeO7VlkAG7sW3Oeudi9UnoTjtfhV8suOhFHG0MJ8yQu7wpgSePrLv_RwXoCMzLm2JhHrAjVzRyCHIMxNP82eKEZVzXuGp71_CM6_7utJO38M1Nq2jr_gpR1Y6-J78ySQ1I7HNZ4jS4z7gqLZ-QjQuTjA8aQx1XpI7XPXcjw0Ka0mzLgp6Hcd845_Wbtr_t1XHE0zasSwZo',
        'fifa_ranking',
        '00000000-0000-0000-0000-000000000104',
        'loser',
        true,
        false
    ),
    (
        'FIFA_WORLD_CUP_2026',
        3,
        'third_place',
        '3º Lugar',
        '3º Colocado',
        'FRA',
        'Franca',
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDhVo1hDodGOp_am6i25Ouqv7M_OFbPrP5NJ1cpKT9k3gQ-FdE_6ghYfsJ3CVlpwD0kobx0MgoQmWocgZde_nmvarXBy7oDl18KCrgCrvxUuk8I4yYx8KtEAQ2c1nepnLvW0O6DiqcGfBYFfWLOQlN89wybYdl6himRuKg9JDuF8XNELWsH4k0jHAcv_j_ogeHmB9LYj-Rzx-t8weTLz2dVaZ5WHf_KtK3PdLAIGdPVAps_351AgXSwOwQjEJkuIon6hhh-l5lvPtU',
        'fifa_ranking',
        '00000000-0000-0000-0000-000000000103',
        'winner',
        true,
        false
    ),
    (
        'FIFA_WORLD_CUP_2026',
        4,
        'fourth_place',
        '4º Lugar',
        '4º Colocado',
        'ENG',
        'Inglaterra',
        'https://lh3.googleusercontent.com/aida-public/AB6AXuD0IGlBhA7IyrVbDDUwyQZ1_MgldD0wHQs-xKgE71oPAd5K_a1Y2mRCnyC4MPeTHH2uz6vanIX2RyYcS0MDPNUuIaSONVfhYoX8b14CGezRQXoO-b2VWoPFT0XFtJLMJf7isx6KvQjsKGz_Mas8OKmWWgzZxveUfyLghlIC3Qtfa_iXd4uw5PNIntrY5gGDvLd48N9M0wKPWWzxOdl9TeBEz6V2igqdhp4iKbRC8RYacMIpmIWwNGT8s9RpVg_c0-gFojoDeLzGpSU',
        'fifa_ranking',
        '00000000-0000-0000-0000-000000000103',
        'loser',
        true,
        false
    )
ON CONFLICT (tournament_key, position) DO UPDATE SET
    slot_key = EXCLUDED.slot_key,
    position_label = EXCLUDED.position_label,
    subtitle = EXCLUDED.subtitle,
    team_code = EXCLUDED.team_code,
    team_name = EXCLUDED.team_name,
    team_flag = EXCLUDED.team_flag,
    source_type = EXCLUDED.source_type,
    source_match_id = EXCLUDED.source_match_id,
    source_match_role = EXCLUDED.source_match_role,
    is_provisional = EXCLUDED.is_provisional,
    locked = EXCLUDED.locked,
    updated_at = now();
