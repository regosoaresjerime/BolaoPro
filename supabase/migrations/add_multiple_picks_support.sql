-- Migration para suportar múltiplos palpites por bolão (até 30)
-- e evitar palpites idênticos no mesmo bolão

-- 1. Adicionar coluna group_id na tabela user_picks
ALTER TABLE public.user_picks 
ADD COLUMN IF NOT EXISTS group_id uuid references public.bolao_groups(id) on delete cascade;

-- 2. Remover a constraint única antiga (user_id, match_id)
ALTER TABLE public.user_picks 
DROP CONSTRAINT IF EXISTS unique_user_match_pick;

-- 3. Adicionar nova constraint única para evitar palpites idênticos no mesmo bolão
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_picks' AND constraint_name = 'unique_user_group_match_score_pick'
  ) THEN
    ALTER TABLE public.user_picks 
    ADD CONSTRAINT unique_user_group_match_score_pick 
    UNIQUE (user_id, group_id, match_id, score_a, score_b);
  END IF;
END $$;

-- 4. Criar função para validar o limite de 30 palpites por usuário por bolão
CREATE OR REPLACE FUNCTION public.check_max_picks_per_pool()
RETURNS TRIGGER AS $$
DECLARE
    pick_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO pick_count
    FROM public.user_picks
    WHERE user_id = NEW.user_id AND group_id = NEW.group_id;
    
    IF pick_count >= 30 THEN
        RAISE EXCEPTION 'Limite de 30 palpites por bolão atingido';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger para aplicar a validação
DROP TRIGGER IF EXISTS enforce_max_picks_per_pool ON public.user_picks;
CREATE TRIGGER enforce_max_picks_per_pool
BEFORE INSERT ON public.user_picks
FOR EACH ROW
EXECUTE FUNCTION public.check_max_picks_per_pool();

-- 6. Atualizar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_picks_user_group ON public.user_picks(user_id, group_id);
