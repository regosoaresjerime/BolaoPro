import { Match, Participant, TournamentPodiumEntry } from '../types';
import { COPA_2026_TEAMS } from '../data/teams';
import { getPodiumEntryForMatchId } from './podiumRanking';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop';

export type RankingPickRecord = {
  userId: string;
  betId: string;
  matchId: string;
  scoreA: number | null;
  scoreB?: number | null;
  updatedAt?: string;
  name?: string;
  avatarUrl?: string | null;
};

export type BettorBetRankingRow = {
  userId: string;
  betId: string;
  name: string;
  avatar: string;
  points: number;
  accuracy: number;
  exactHits: number;
  partialHits: number;
  resultHits: number;
  evaluatedCount: number;
  isCurrentUser: boolean;
  finalizedAt?: string;
};

type AccumulatedUserRankingRow = {
  userId: string;
  name: string;
  avatar: string;
  points: number;
  accuracy: number;
  exactHits: number;
  partialHits: number;
  resultHits: number;
  evaluatedCount: number;
  totalBets: number;
  isCurrentUser: boolean;
  finalizedAt?: string;
};

function getTimestampValue(timestamp?: string) {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function compareByFinalizedAt(aTimestamp?: string, bTimestamp?: string) {
  return getTimestampValue(aTimestamp) - getTimestampValue(bTimestamp);
}

function compareRankingRows(a: BettorBetRankingRow, b: BettorBetRankingRow) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
  if (b.partialHits !== a.partialHits) return b.partialHits - a.partialHits;
  if (b.resultHits !== a.resultHits) return b.resultHits - a.resultHits;
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
  if (compareByFinalizedAt(a.finalizedAt, b.finalizedAt) !== 0) {
    return compareByFinalizedAt(a.finalizedAt, b.finalizedAt);
  }
  return a.betId.localeCompare(b.betId, 'pt-BR');
}

function getParticipantName(
  pick: RankingPickRecord | undefined,
  currentUserId?: string,
  currentUserName?: string
) {
  return (
    pick?.name ||
    (currentUserId && pick?.userId === currentUserId ? currentUserName : undefined) ||
    'Apostador'
  );
}

export function getPrizePlacesCount(firstPlacePct: number, secondPlacePct: number, thirdPlacePct: number) {
  return [firstPlacePct, secondPlacePct, thirdPlacePct].filter((value) => value > 0).length;
}

function compareAccumulatedRows(a: AccumulatedUserRankingRow, b: AccumulatedUserRankingRow) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
  if (b.partialHits !== a.partialHits) return b.partialHits - a.partialHits;
  if (b.resultHits !== a.resultHits) return b.resultHits - a.resultHits;
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
  if (compareByFinalizedAt(a.finalizedAt, b.finalizedAt) !== 0) {
    return compareByFinalizedAt(a.finalizedAt, b.finalizedAt);
  }
  return a.userId.localeCompare(b.userId, 'pt-BR');
}

function accumulateRankingRowsByUser(betRows: BettorBetRankingRow[]) {
  const totalsByUser = new Map<string, AccumulatedUserRankingRow>();

  betRows.forEach((row) => {
    const existing = totalsByUser.get(row.userId);

    if (!existing) {
      totalsByUser.set(row.userId, {
        userId: row.userId,
        name: row.name,
        avatar: row.avatar,
        points: row.points,
        accuracy: row.accuracy,
        exactHits: row.exactHits,
        partialHits: row.partialHits,
        resultHits: row.resultHits,
        evaluatedCount: row.evaluatedCount,
        totalBets: 1,
        isCurrentUser: row.isCurrentUser,
        finalizedAt: row.finalizedAt
      });
      return;
    }

    existing.points += row.points;
    existing.exactHits += row.exactHits;
    existing.partialHits += row.partialHits;
    existing.resultHits += row.resultHits;
    existing.evaluatedCount += row.evaluatedCount;
    existing.totalBets += 1;
    existing.isCurrentUser = existing.isCurrentUser || row.isCurrentUser;
    if (compareByFinalizedAt(row.finalizedAt, existing.finalizedAt) < 0) {
      existing.finalizedAt = row.finalizedAt;
    }
    existing.accuracy = existing.evaluatedCount > 0
      ? Math.round(((existing.exactHits + existing.partialHits + existing.resultHits) / existing.evaluatedCount) * 100)
      : 0;
  });

  return Array.from(totalsByUser.values())
    .sort(compareAccumulatedRows);
}

export function buildPublicRankingFromAccumulatedBets(params: {
  betRows: BettorBetRankingRow[];
  prizePlacesCount: number;
  official: boolean;
}): Participant[] {
  const { betRows, prizePlacesCount, official } = params;
  const sortedRows = accumulateRankingRowsByUser(betRows);

  return sortedRows.map((row, index) => {
    const rank = index + 1;
    const inPrizeZone = rank <= prizePlacesCount;
    let prizeLabel: string | undefined;

    if (inPrizeZone) {
      prizeLabel = official ? `Vencedor ${rank}º` : `Provável ${rank}º`;
    } else {
      prizeLabel = 'Em disputa';
    }

    return {
      rank,
      name: row.name,
      username: row.name,
      avatar: row.avatar,
      points: row.points,
      trend: inPrizeZone ? 'up' : 'same',
      trendValue: prizeLabel,
      accuracy: row.accuracy,
      isCurrentUser: row.isCurrentUser,
      qualifying: true,
      prizeZone: inPrizeZone,
      prizeLabel,
      totalBets: row.totalBets
    };
  });
}

function getMatchOutcome(scoreA: number, scoreB: number) {
  if (scoreA > scoreB) return 'A';
  if (scoreB > scoreA) return 'B';
  return 'D';
}

export function calculateScoreBetRankingRows(params: {
  picks: RankingPickRecord[];
  selectedMatchIds: string[];
  matches: Match[];
  currentUserId?: string;
  currentUserName?: string;
}): BettorBetRankingRow[] {
  const { picks, selectedMatchIds, matches, currentUserId, currentUserName } = params;
  // Regra de negócio: todos os jogos selecionados do bolão entram na avaliação.
  // Jogos com scoreA/scoreB nulos no banco são tratados como 0x0 provisório,
  // pois o placar 0x0 é o estado inicial oficial antes do apito inicial.
  // O ranking gerado é PARCIAL até o jogo ser marcado como 'finished'.
  const evaluatedMatches = matches.filter(
    (match) => selectedMatchIds.includes(match.id)
  );

  // Se não há nenhum jogo selecionado, retorna vazio
  if (evaluatedMatches.length === 0) return [];

  const picksByBet = new Map<string, RankingPickRecord[]>();

  picks.forEach((pick) => {
    if (!pick.betId || !pick.userId || !evaluatedMatches.some((match) => match.id === pick.matchId)) return;
    const rows = picksByBet.get(pick.betId) || [];
    rows.push(pick);
    picksByBet.set(pick.betId, rows);
  });

  const rankingRows: BettorBetRankingRow[] = [];

  picksByBet.forEach((betPicks, betId) => {
    const picksMap = new Map(betPicks.map((pick) => [pick.matchId, pick]));
    // O apostador precisa ter palpites em TODOS os jogos avaliados
    const allCovered = evaluatedMatches.every((match) => picksMap.has(match.id));
    if (!allCovered) return;

    let points = 0;
    let exactHits = 0;
    let partialHits = 0;
    let resultHits = 0;
    const finalizedAt = betPicks.reduce<string | undefined>((latestTimestamp, pick) => {
      if (!pick.updatedAt) return latestTimestamp;
      if (!latestTimestamp) return pick.updatedAt;
      return getTimestampValue(pick.updatedAt) > getTimestampValue(latestTimestamp)
        ? pick.updatedAt
        : latestTimestamp;
    }, undefined);

    evaluatedMatches.forEach((match) => {
      const pick = picksMap.get(match.id);
      if (!pick || pick.scoreA === null || pick.scoreB === null) {
        return;
      }

      // Placar provisório: null no banco = 0x0 (antes do jogo começar)
      const currentScoreA = match.scoreA ?? 0;
      const currentScoreB = match.scoreB ?? 0;

      if (pick.scoreA === currentScoreA && pick.scoreB === currentScoreB) {
        points += 25;
        exactHits += 1;
        return;
      }

      const pickOutcome = getMatchOutcome(pick.scoreA, pick.scoreB);
      const currentOutcome = getMatchOutcome(currentScoreA, currentScoreB);

      if (pickOutcome === currentOutcome) {
        const pickDiff = pick.scoreA - pick.scoreB;
        const currentDiff = currentScoreA - currentScoreB;

        if (pickDiff === currentDiff) {
          points += 10;
          partialHits += 1;
        } else {
          points += 5;
          resultHits += 1;
        }
      }
    });

    const firstPick = betPicks[0];
    rankingRows.push({
      userId: firstPick.userId,
      betId,
      name: getParticipantName(firstPick, currentUserId, currentUserName),
      avatar: firstPick.avatarUrl || DEFAULT_AVATAR,
      points,
      accuracy: Math.round(((exactHits + partialHits + resultHits) / evaluatedMatches.length) * 100),
      exactHits,
      partialHits,
      resultHits,
      evaluatedCount: evaluatedMatches.length,
      isCurrentUser: firstPick.userId === currentUserId,
      finalizedAt
    });
  });

  return rankingRows.sort(compareRankingRows);
}

function resolveTeamCodeByPickIndex(scoreA: number | null) {
  if (scoreA === null || scoreA === undefined) return '';
  return COPA_2026_TEAMS[scoreA]?.code || '';
}

export function calculatePodiumBetRankingRows(params: {
  picks: RankingPickRecord[];
  selectedMatchIds: string[];
  podiumEntries: TournamentPodiumEntry[];
  currentUserId?: string;
  currentUserName?: string;
}): BettorBetRankingRow[] {
  const { picks, selectedMatchIds, podiumEntries, currentUserId, currentUserName } = params;

  if (selectedMatchIds.length === 0) return [];

  const picksByBet = new Map<string, RankingPickRecord[]>();

  picks.forEach((pick) => {
    if (!pick.betId || !pick.userId || !selectedMatchIds.includes(pick.matchId)) return;
    const rows = picksByBet.get(pick.betId) || [];
    rows.push(pick);
    picksByBet.set(pick.betId, rows);
  });

  const rankingRows: BettorBetRankingRow[] = [];

  picksByBet.forEach((betPicks, betId) => {
    const picksMap = new Map(betPicks.map((pick) => [pick.matchId, pick]));
    const fullCoverage = selectedMatchIds.every((matchId) => picksMap.has(matchId));
    if (!fullCoverage) return;

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
      const pick = picksMap.get(matchId);
      const targetEntry = getPodiumEntryForMatchId(matchId, podiumEntries);
      const targetCode = targetEntry?.teamCode || '';
      const pickedCode = resolveTeamCodeByPickIndex(pick?.scoreA ?? null);

      if (pickedCode && targetCode && pickedCode === targetCode) {
        points += 25;
        exactHits += 1;
      }
    });

    const firstPick = betPicks[0];
    rankingRows.push({
      userId: firstPick.userId,
      betId,
      name: getParticipantName(firstPick, currentUserId, currentUserName),
      avatar: firstPick.avatarUrl || DEFAULT_AVATAR,
      points,
      accuracy: Math.round((exactHits / selectedMatchIds.length) * 100),
      exactHits,
      partialHits: 0,
      resultHits: 0,
      evaluatedCount: selectedMatchIds.length,
      isCurrentUser: firstPick.userId === currentUserId,
      finalizedAt
    });
  });

  return rankingRows.sort(compareRankingRows);
}

export function buildPublicPodiumRanking(params: {
  picks: RankingPickRecord[];
  selectedMatchIds: string[];
  podiumEntries: TournamentPodiumEntry[];
  currentUserId?: string;
  currentUserName?: string;
  prizePlacesCount: number;
  official: boolean;
}) {
  const { picks, selectedMatchIds, podiumEntries, currentUserId, currentUserName, prizePlacesCount, official } = params;
  const betRows = calculatePodiumBetRankingRows({
    picks,
    selectedMatchIds,
    podiumEntries,
    currentUserId,
    currentUserName
  });

  return buildPublicRankingFromAccumulatedBets({
    betRows,
    prizePlacesCount,
    official
  });
}

export function buildPublicScoreRanking(params: {
  picks: RankingPickRecord[];
  selectedMatchIds: string[];
  matches: Match[];
  currentUserId?: string;
  currentUserName?: string;
  prizePlacesCount: number;
  official: boolean;
}) {
  const { picks, selectedMatchIds, matches, currentUserId, currentUserName, prizePlacesCount, official } = params;
  const betRows = calculateScoreBetRankingRows({
    picks,
    selectedMatchIds,
    matches,
    currentUserId,
    currentUserName
  });

  return buildPublicRankingFromAccumulatedBets({
    betRows,
    prizePlacesCount,
    official
  });
}
