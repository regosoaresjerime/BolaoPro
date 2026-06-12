-- =============================================================
-- REPARO DE CONFRONTOS DO MATA-MATA OFICIAL
-- Corrige placeholders truncados de cargas anteriores
-- =============================================================

DO $$
BEGIN
  IF to_regclass('public.matches') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.matches nao existe. Execute primeiro a migration de criacao das tabelas.';
  END IF;
END $$;

UPDATE public.matches AS target
SET
  tenant_id = NULL,
  group_id = NULL,
  team_a = seed.team_a,
  team_b = seed.team_b,
  team_a_flag = seed.team_a_flag,
  team_b_flag = seed.team_b_flag,
  started_at = seed.started_at,
  updated_at = now()
FROM (
  VALUES
    ('00000000-0000-0000-0000-000000000089', '(Vencedor do Jogo 74)', '(Vencedor do Jogo 77)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-04T18:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000090', '(Vencedor do Jogo 73)', '(Vencedor do Jogo 75)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-04T14:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000091', '(Vencedor do Jogo 76)', '(Vencedor do Jogo 78)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-05T17:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000092', '(Vencedor do Jogo 79)', '(Vencedor do Jogo 80)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-05T21:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000093', '(Vencedor do Jogo 83)', '(Vencedor do Jogo 84)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-06T12:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000094', '(Vencedor do Jogo 81)', '(Vencedor do Jogo 82)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-06T21:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000095', '(Vencedor do Jogo 86)', '(Vencedor do Jogo 88)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-07T13:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000096', '(Vencedor do Jogo 85)', '(Vencedor do Jogo 87)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-07T17:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000097', '(Vencedor do Jogo 89)', '(Vencedor do Jogo 90)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-09T17:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000098', '(Vencedor do Jogo 93)', '(Vencedor do Jogo 94)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-10T13:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000099', '(Vencedor do Jogo 91)', '(Vencedor do Jogo 92)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-12T12:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000100', '(Vencedor do Jogo 95)', '(Vencedor do Jogo 96)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-12T12:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000101', '(Vencedor do Jogo 97)', '(Vencedor do Jogo 98)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-14T12:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000102', '(Vencedor do Jogo 99)', '(Vencedor do Jogo 100)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-15T16:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000103', '(Perdedor do Jogo 101)', '(Perdedor do Jogo 102)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-18T12:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000104', '(Vencedor do Jogo 101)', '(Vencedor do Jogo 102)', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop', '2026-07-19T16:00:00.000Z')
) AS seed(id, team_a, team_b, team_a_flag, team_b_flag, started_at)
WHERE target.id = seed.id
  AND target.status = 'scheduled'
  AND target.score_a IS NULL
  AND target.score_b IS NULL
  AND (
    target.team_a IN ('(Vencedor do Jogo', '(Perdedor do Jogo')
    OR btrim(COALESCE(target.team_b, '')) = ''
  );
