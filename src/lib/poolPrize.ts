import { Pool } from '../types';

type PrizeDefaults = {
  feeType?: Pool['feeType'];
  feeValue?: number;
};

export function getPoolEstimatedPrizeValue(pool: Pool, defaults?: PrizeDefaults) {
  const participantsBase = Math.max(pool.maxParticipants || 0, pool.memberCount || 0);
  const grossPrize = Math.max(0, participantsBase * (pool.entryFee || 0));
  const feeType = pool.feeType || defaults?.feeType || 'percent';
  const feeValue = pool.feeValue ?? defaults?.feeValue ?? (feeType === 'percent' ? 20 : 0);
  const commission = feeType === 'percent'
    ? grossPrize * (feeValue / 100)
    : participantsBase * feeValue;

  return Math.max(0, grossPrize - commission);
}
