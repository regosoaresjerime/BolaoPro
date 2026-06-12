-- Migração para adicionar os placeholders estáticos (partidas de pódio)
-- Busca dinamicamente um tenant_id e group_id existentes para evitar violação de Foreign Keys

DO $$ 
DECLARE 
  valid_tenant_id uuid;
  valid_group_id uuid;
BEGIN
  -- Em deploy limpo esta migration pode rodar antes da criação das tabelas.
  -- Nesse caso, apenas ignora a carga e deixa a migration posterior cuidar do seed oficial.
  IF to_regclass('public.matches') IS NULL
    OR to_regclass('public.profiles') IS NULL
    OR to_regclass('public.bolao_groups') IS NULL THEN
    RAISE NOTICE 'Tabelas base ainda não existem; seed legado de pódio ignorado.';
  ELSE
    -- Tenta pegar o primeiro perfil e o primeiro bolão que encontrar no banco
    SELECT id INTO valid_tenant_id FROM public.profiles LIMIT 1;
    SELECT id INTO valid_group_id FROM public.bolao_groups LIMIT 1;

    -- Se o banco não for completamente vazio, insere as partidas usando as chaves reais
    IF valid_tenant_id IS NOT NULL THEN
      INSERT INTO public.matches (id, tenant_id, group_id, team_a, team_b, team_a_flag, team_b_flag, status, started_at)
      VALUES 
        ('00000000-0000-0000-0000-9999a0d11111', valid_tenant_id, valid_group_id, '1º Lugar', 'Campeão', '🏆', '🏆', 'scheduled', '2026-07-19T12:00:00.000Z'),
        ('00000000-0000-0000-0000-9999a0d22222', valid_tenant_id, valid_group_id, '2º Lugar', 'Vice-Campeão', '🥈', '🥈', 'scheduled', '2026-07-19T12:00:00.000Z'),
        ('00000000-0000-0000-0000-9999a0d33333', valid_tenant_id, valid_group_id, '3º Lugar', '3º Colocado', '🥉', '🥉', 'scheduled', '2026-07-19T12:00:00.000Z'),
        ('00000000-0000-0000-0000-9999a0d44444', valid_tenant_id, valid_group_id, '4º Lugar', '4º Colocado', '🏅', '🏅', 'scheduled', '2026-07-19T12:00:00.000Z')
      ON CONFLICT (id) DO UPDATE SET
        team_a = EXCLUDED.team_a,
        team_b = EXCLUDED.team_b,
        team_a_flag = EXCLUDED.team_a_flag,
        team_b_flag = EXCLUDED.team_b_flag,
        tenant_id = EXCLUDED.tenant_id,
        group_id = EXCLUDED.group_id;
    END IF;
  END IF;
END $$;
