import { Participant, TournamentPodiumEntry } from '../types';
import { COPA_2026_TEAMS } from '../data/teams';

export const PODIUM_TOURNAMENT_KEY = 'FIFA_WORLD_CUP_2026';

export const PODIUM_SLOT_CONFIG = [
  {
    position: 1,
    slotKey: 'champion' as const,
    legacyMatchId: '00000000-0000-0000-0000-9999a0d11111',
    positionLabel: '1º Lugar',
    subtitle: 'Campeão',
    sourceMatchId: '00000000-0000-0000-0000-000000000104',
    sourceMatchRole: 'winner' as const,
    provisionalTeamCode: 'ARG'
  },
  {
    position: 2,
    slotKey: 'runner_up' as const,
    legacyMatchId: '00000000-0000-0000-0000-9999a0d22222',
    positionLabel: '2º Lugar',
    subtitle: 'Vice-Campeão',
    sourceMatchId: '00000000-0000-0000-0000-000000000104',
    sourceMatchRole: 'loser' as const,
    provisionalTeamCode: 'ESP'
  },
  {
    position: 3,
    slotKey: 'third_place' as const,
    legacyMatchId: '00000000-0000-0000-0000-9999a0d33333',
    positionLabel: '3º Lugar',
    subtitle: '3º Colocado',
    sourceMatchId: '00000000-0000-0000-0000-000000000103',
    sourceMatchRole: 'winner' as const,
    provisionalTeamCode: 'FRA'
  },
  {
    position: 4,
    slotKey: 'fourth_place' as const,
    legacyMatchId: '00000000-0000-0000-0000-9999a0d44444',
    positionLabel: '4º Lugar',
    subtitle: '4º Colocado',
    sourceMatchId: '00000000-0000-0000-0000-000000000103',
    sourceMatchRole: 'loser' as const,
    provisionalTeamCode: 'ENG'
  }
];

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop';

type RankingPickRecord = {
  userId: string;
  betId: string;
  matchId: string;
  scoreA: number | null;
  updatedAt?: string;
  name?: string;
  avatarUrl?: string | null;
};

type PodiumRankingRow = Participant & {
  qualifying: boolean;
  exactHits: number;
  betId: string;
  finalizedAt?: string;
};

function getTimestampValue(timestamp?: string) {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

export function buildDefaultTournamentPodium(): TournamentPodiumEntry[] {
  return PODIUM_SLOT_CONFIG.map((slot) => {
    const team = COPA_2026_TEAMS.find((item) => item.code === slot.provisionalTeamCode);

    return {
      tournamentKey: PODIUM_TOURNAMENT_KEY,
      position: slot.position,
      slotKey: slot.slotKey,
      positionLabel: slot.positionLabel,
      subtitle: slot.subtitle,
      teamCode: team?.code || null,
      teamName: team?.name || null,
      teamFlag: team?.flag || null,
      sourceType: 'fifa_ranking',
      sourceMatchId: slot.sourceMatchId,
      sourceMatchRole: slot.sourceMatchRole,
      isProvisional: true,
      locked: false
    };
  });
}

export function getPodiumEntryForMatchId(
  matchId: string,
  podiumEntries: TournamentPodiumEntry[]
): TournamentPodiumEntry | null {
  const slot = PODIUM_SLOT_CONFIG.find((item) => item.legacyMatchId === matchId);
  if (!slot) return null;

  return (
    podiumEntries.find((entry) => entry.position === slot.position || entry.slotKey === slot.slotKey) ||
    null
  );
}

export function getPodiumMinimumPoints(selectedMatchIds: string[]): number {
  const maxPoints = Math.max(selectedMatchIds.length, 1) * 25;
  return Math.min(50, maxPoints);
}

export function isPodiumStillProvisional(podiumEntries: TournamentPodiumEntry[]): boolean {
  return podiumEntries.some((entry) => entry.isProvisional);
}

function compareRankingRows(a: PodiumRankingRow, b: PodiumRankingRow) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
  if (getTimestampValue(a.finalizedAt) !== getTimestampValue(b.finalizedAt)) {
    return getTimestampValue(a.finalizedAt) - getTimestampValue(b.finalizedAt);
  }
  return a.betId.localeCompare(b.betId, 'pt-BR');
}

export function calculatePodiumRankingRows(params: {
  picks: RankingPickRecord[];
  selectedMatchIds: string[];
  podiumEntries: TournamentPodiumEntry[];
  currentUserId?: string;
  currentUserName?: string;
}): PodiumRankingRow[] {
  const { picks, selectedMatchIds, podiumEntries, currentUserId, currentUserName } = params;

  if (selectedMatchIds.length === 0) return [];

  const minimumPoints = getPodiumMinimumPoints(selectedMatchIds);
  const picksByUser = new Map<string, Map<string, RankingPickRecord[]>>();

  picks.forEach((pick) => {
    if (!pick.userId || !pick.betId || !selectedMatchIds.includes(pick.matchId)) return;
    if (pick.scoreA === null || pick.scoreA === undefined) return;

    const userEntries = picksByUser.get(pick.userId) || new Map<string, RankingPickRecord[]>();
    const betEntries = userEntries.get(pick.betId) || [];
    betEntries.push(pick);
    userEntries.set(pick.betId, betEntries);
    picksByUser.set(pick.userId, userEntries);
  });

  const rankingRows: PodiumRankingRow[] = [];

  picksByUser.forEach((bets, userId) => {
    const evaluatedRows: PodiumRankingRow[] = [];

    bets.forEach((betPicks, betId) => {
      const picksByMatchId = new Map(betPicks.map((pick) => [pick.matchId, pick]));
      const hasCompleteBet = selectedMatchIds.every((matchId) => picksByMatchId.has(matchId));
      if (!hasCompleteBet) return;

      let points = 0;
      let exactHits = 0;
      const finalizedAt = betPicks.reduce<string | undefined>((latestTimestamp, pick) => {
        if (!pick.updatedAt) return latestTimestamp;
        if (!latestTimestamp) return pick.updatedAt;
        return getTimestampValue(pick.updatedAt) > getTimestampValue(latestTimestamp)
          ? pick.updatedAt
          : latestTimestamp;
      }, undefined);

      selectedMatchIds.forEach((matchId) => {
        const pick = picksByMatchId.get(matchId);
        const targetEntry = getPodiumEntryForMatchId(matchId, podiumEntries);
        const targetCode = targetEntry?.teamCode || '';
        const pickedCode =
          pick?.scoreA !== null && pick?.scoreA !== undefined
            ? (COPA_2026_TEAMS[pick.scoreA]?.code || '')
            : '';

        if (pickedCode && targetCode && pickedCode === targetCode) {
          points += 25;
          exactHits += 1;
        }
      });

      const firstPick = betPicks[0];
      const participantName =
        firstPick?.name ||
        (currentUserId === userId ? currentUserName : undefined) ||
        'Apostador';

      evaluatedRows.push({
        rank: 0,
        name: participantName,
        username: participantName,
        avatar: firstPick?.avatarUrl || DEFAULT_AVATAR,
        points,
        trend: 'same',
        accuracy: selectedMatchIds.length > 0 ? Math.round((exactHits / selectedMatchIds.length) * 100) : 0,
        isCurrentUser: currentUserId === userId,
        qualifying: points >= minimumPoints,
        exactHits,
        betId,
        finalizedAt
      });
    });

    if (evaluatedRows.length === 0) return;

    evaluatedRows.sort(compareRankingRows);
    rankingRows.push(evaluatedRows[0]);
  });

  rankingRows.sort(compareRankingRows);

  return rankingRows.map((row, index) => ({
    ...row,
    rank: index + 1,
    trend: row.rank === 1 ? 'up' : row.trend
  }));
}
