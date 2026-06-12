-- =============================================================
-- TESTE: LIMPAR RESULTADOS GERADOS PELO SEED DE CRONOGRAMA
-- Objetivo:
--   - desfazer apenas os resultados aplicados pelo script de teste
--   - preservar o podio temporario em public.tournament_podium
--   - preservar os jogos 103 e 104
-- =============================================================

DO $$
BEGIN
  IF to_regclass('public.matches') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.matches nao existe.';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.match_results_test_seed_log') IS NULL THEN
    RAISE NOTICE 'Tabela public.match_results_test_seed_log nao existe. Nada para limpar.';
    RETURN;
  END IF;
END $$;

UPDATE public.matches AS m
SET
  status = 'scheduled',
  score_a = NULL,
  score_b = NULL,
  updated_at = now()
FROM public.match_results_test_seed_log AS log
WHERE m.id = log.match_id;

TRUNCATE TABLE public.match_results_test_seed_log;
