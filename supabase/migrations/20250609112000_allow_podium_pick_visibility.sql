-- =============================================================
-- VISIBILIDADE DE PALPITES PARA RANKING DE BOLAO DE PODIO
-- Mantem o anti-cheat do bolao de placar e libera ranking do podio
-- =============================================================

DROP POLICY IF EXISTS "Apostadores autenticados podem ver palpites de bolões de pódio" ON public.user_picks;

CREATE POLICY "Apostadores autenticados podem ver palpites de bolões de pódio"
    ON public.user_picks FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND match_id IN (
            '00000000-0000-0000-0000-9999a0d11111',
            '00000000-0000-0000-0000-9999a0d22222',
            '00000000-0000-0000-0000-9999a0d33333',
            '00000000-0000-0000-0000-9999a0d44444'
        )
    );
