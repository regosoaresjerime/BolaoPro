-- Migration: Add finalized_at column to bolao_groups
-- This column stores when the pool was manually finalized by the admin (bancador).
-- If NULL, the pool uses the automatic +3h rule based on betting_deadline.

ALTER TABLE bolao_groups
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN bolao_groups.finalized_at IS
  'Data/hora em que a banca encerrou manualmente o bolão. Se NULL, o sistema usa a regra de +3h após o prazo de apostas.';
