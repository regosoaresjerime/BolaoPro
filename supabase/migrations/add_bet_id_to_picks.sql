-- Migration para adicionar agrupamento de apostas (bet_id)

-- 1. Alterar a coluna bet_id para TEXT na tabela userPicks (para suportar IDs como legacy_123)
-- Como a coluna já foi criada como UUID no seu banco antes do ajuste, precisamos alterar o tipo dela
ALTER TABLE public.user_picks ALTER COLUMN bet_id TYPE TEXT USING bet_id::text;

-- 2. Remover a constraint unique antiga (que causava múltiplas inserções ao editar)
ALTER TABLE public.user_picks DROP CONSTRAINT IF EXISTS unique_user_group_match_score_pick;

-- 3. Limpar duplicatas legadas antes de criar os índices
-- Mantém apenas o palpite mais recente para cada combinação (user_id, group_id, match_id)
DELETE FROM public.user_picks
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_id, group_id, match_id ORDER BY updated_at DESC) as rnum
        FROM public.user_picks
    ) t
    WHERE t.rnum > 1
);

-- 3.1 Preencher bet_id nulos para não dar erro na constraint de unique
UPDATE public.user_picks 
SET bet_id = id::text 
WHERE bet_id IS NULL;

-- 4. Adicionar nova constraint unique que inclui bet_id e match_id
-- Para usar no ON CONFLICT do Supabase, precisamos de UMA CONSTRAINT e não apenas de um INDEX.
DO $$
BEGIN
  -- Se as constraints parciais não funcionarem no upsert, precisamos de uma constraint normal.
  -- Para isso, garantimos que bet_id não é mais usado apenas de forma parcial para a constraint
  
  -- Adicionar constraint composta para o UPSERT (onConflict) funcionar corretamente:
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_picks' AND constraint_name = 'unique_bet_match_pick'
  ) THEN
    ALTER TABLE public.user_picks ADD CONSTRAINT unique_bet_match_pick UNIQUE (bet_id, match_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_picks' AND constraint_name = 'unique_legacy_user_match_idx'
  ) THEN
    -- Alteramos a lógica: A constraint de legado atrapalha o sistema de múltiplas apostas
    -- porque impede que o mesmo usuário faça 2 apostas diferentes para o mesmo bolão/partida
    -- Portanto, NÃO vamos adicionar essa constraint. O unique_bet_match_pick é suficiente.
    -- ALTER TABLE public.user_picks ADD CONSTRAINT unique_legacy_user_match_idx UNIQUE (user_id, group_id, match_id);
  END IF;
END $$;
