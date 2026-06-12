-- =============================================================
-- TESTE: POPULAR RESULTADOS DO CRONOGRAMA OFICIAL DA COPA 2026
-- Objetivo:
--   - popular resultados das partidas oficiais para testes
--   - preservar o podio temporario salvo em public.tournament_podium
--   - NAO tocar nos jogos 103 e 104, para nao sobrescrever campeao,
--     vice, 3o e 4o lugar provisórios baseados no ranking da FIFA
-- =============================================================

DO $$
BEGIN
  IF to_regclass('public.matches') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.matches nao existe.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.match_results_test_seed_log (
  match_id uuid PRIMARY KEY,
  seeded_at timestamp with time zone NOT NULL DEFAULT now()
);

WITH target_matches AS (
  SELECT
    id,
    row_number() OVER (ORDER BY started_at, id) AS seq
  FROM public.matches
  WHERE tenant_id IS NULL
    AND group_id IS NULL
    AND id >= '00000000-0000-0000-0000-000000000001'
    AND id <= '00000000-0000-0000-0000-000000000102'
), seeded_scores AS (
  SELECT
    id,
    CASE
      WHEN seq % 7 = 0 THEN 0
      WHEN seq % 5 = 0 THEN 1
      WHEN seq % 3 = 0 THEN 2
      ELSE 3
    END AS score_a,
    CASE
      WHEN seq % 7 = 0 THEN 0
      WHEN seq % 5 = 0 THEN 1
      WHEN seq % 4 = 0 THEN 2
      ELSE 1
    END AS score_b
  FROM target_matches
)
UPDATE public.matches AS m
SET
  status = 'finished',
  score_a = seeded_scores.score_a,
  score_b = seeded_scores.score_b,
  updated_at = now()
FROM seeded_scores
WHERE m.id = seeded_scores.id;

INSERT INTO public.match_results_test_seed_log (match_id)
SELECT id
FROM public.matches
WHERE tenant_id IS NULL
  AND group_id IS NULL
  AND id >= '00000000-0000-0000-0000-000000000001'
  AND id <= '00000000-0000-0000-0000-000000000102'
ON CONFLICT (match_id) DO UPDATE
SET seeded_at = now();
