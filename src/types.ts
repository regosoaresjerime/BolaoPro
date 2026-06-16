/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ViewType = 'LANDING' | 'ONBOARDING' | 'DASHBOARD' | 'CHECKOUT' | 'SUCCESS_PAGE' | 'PALPITES' | 'RANKING' | 'ADMIN_DASHBOARD' | 'ADMIN_FEE' | 'ADMIN_PARTIDAS' | 'ADMIN_NOTIFICACOES' | 'PERFIL' | 'BACKEND_SPECS';

export interface Match {
  id: string;
  group: string;
  dateText: string;
  teamA: string;
  teamB: string;
  teamAFlag: string;
  teamBFlag: string;
  status: 'scheduled' | 'live' | 'finished';
  scoreA: number | null;
  scoreB: number | null;
  startedAt: string;
  winProbability?: {
    a: number;
    draw: number;
    b: number;
  };
}

export interface UserPick {
  id?: string;
  matchId: string;
  groupId?: string;
  betId?: string;
  scoreA: number | null;
  scoreB: number | null;
  saved?: boolean;
  updatedAt?: string;
}

export interface Participant {
  rank: number;
  name: string;
  username: string;
  avatar: string;
  points: number;
  trend: 'up' | 'down' | 'same';
  trendValue?: string;
  accuracy: number;
  isCurrentUser: boolean;
  qualifying?: boolean;
  prizeZone?: boolean;
  prizeLabel?: string;
  totalBets?: number;
}

export interface TournamentPodiumEntry {
  id?: string;
  tournamentKey: string;
  position: number;
  slotKey: 'champion' | 'runner_up' | 'third_place' | 'fourth_place';
  positionLabel: string;
  subtitle: string;
  teamCode: string | null;
  teamName: string | null;
  teamFlag: string | null;
  sourceType: 'fifa_ranking' | 'official_result' | 'manual_admin';
  sourceMatchId: string | null;
  sourceMatchRole: 'winner' | 'loser' | 'manual' | 'ranking' | null;
  isProvisional: boolean;
  locked: boolean;
}

export interface AlertNotification {
  id: string;
  type: 'Partidas' | 'Ranking' | 'Sistema';
  title: string;
  message: string;
  timeText: string;
  unread: boolean;
  scoreGained?: number;
}

export interface TenantSettings {
  feeType: 'percent' | 'fixed';
  feeValue: number;
  entryFee: number;
  minWithdrawal: number;
  firstPlacePct: number;
  secondPlacePct: number;
  thirdPlacePct: number;
  companyName: string;
}

export interface Transaction {
  id: string;
  userId: string;
  groupId: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'expired';
  paymentMethod: string;
  pagbankId: string;
  qrcodeText: string;
  qrcodeImage: string;
  createdAt: string;
}

export interface Pool {
  id: string;
  name: string;
  creator: string;
  entryFee: number;
  accumulatedPrize: number;
  inviteCode: string;
  memberCount: number;
  description: string;
  bettingDeadline?: string;
  finalizedAt?: string;
  selectedTeams?: string[];
  selectedMatchIds?: string[];
  feeType?: 'percent' | 'fixed';
  feeValue?: number;
  maxParticipants?: number;
  modality?: 'score' | 'podium';
  prizedPlaces?: number;
}
