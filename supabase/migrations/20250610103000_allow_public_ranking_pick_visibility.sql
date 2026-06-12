-- =============================================================
-- VISIBILIDADE DE PALPITES PARA RANKINGS PUBLICOS DE TODOS OS BOLOES
-- Permite montar a classificacao publica de qualquer bolao
-- para usuários autenticados, mantendo escrita restrita ao dono.
-- =============================================================

DROP POLICY IF EXISTS "Apostadores autenticados podem ver palpites de bolões de pódio" ON public.user_picks;
DROP POLICY IF EXISTS "Apostadores autenticados podem ver palpites para rankings públicos" ON public.user_picks;

CREATE POLICY "Apostadores autenticados podem ver palpites para rankings públicos"
    ON public.user_picks FOR SELECT
    USING (auth.uid() IS NOT NULL);
