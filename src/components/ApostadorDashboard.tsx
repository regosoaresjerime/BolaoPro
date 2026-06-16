/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Trophy, Bell, User, CheckCircle2, Lock, Clock, Info, Check, Copy, Share2, 
  ChevronRight, ArrowUpRight, LogOut, Code, Wallet, Eye, ShieldCheck, Mail, Calendar, HelpCircle, ShieldQuestion, Star, Layers, Settings, AppWindow, Users
} from 'lucide-react';
import { Match, Participant, AlertNotification, UserPick, Pool, TournamentPodiumEntry, TenantSettings } from '../types';
import { BettorWalletSummary, PixChargeHistoryItem, RecoverablePixTransaction, SupabaseService } from '../lib/supabaseService';
import { getPoolEstimatedPrizeValue } from '../lib/poolPrize';
import { getOfficialTeamFlagUrl } from '../lib/teamFlagSource';
import { INITIAL_ALERTS, FAQ_ITEMS } from '../data/mockData';
import { COPA_2026_TEAMS } from '../data/teams';
import SearchableTeamSelect from './SearchableTeamSelect';
import TeamAvatar from './TeamAvatar';
import UserAvatar from './UserAvatar';
import {
  buildDefaultTournamentPodium,
  getPodiumEntryForMatchId,
  isPodiumStillProvisional,
  PODIUM_SLOT_CONFIG
} from '../lib/podiumRanking';

const DEFAULT_PODIUM_SLOTS = [
  {
    place: PODIUM_SLOT_CONFIG[0].positionLabel,
    desc: PODIUM_SLOT_CONFIG[0].subtitle,
    title: 'Campeão 🏆',
    matchId: PODIUM_SLOT_CONFIG[0].legacyMatchId
  },
  {
    place: PODIUM_SLOT_CONFIG[1].positionLabel,
    desc: PODIUM_SLOT_CONFIG[1].subtitle,
    title: 'Vice-Campeão 🥈',
    matchId: PODIUM_SLOT_CONFIG[1].legacyMatchId
  },
  {
    place: PODIUM_SLOT_CONFIG[2].positionLabel,
    desc: PODIUM_SLOT_CONFIG[2].subtitle,
    title: '3º Colocado 🥉',
    matchId: PODIUM_SLOT_CONFIG[2].legacyMatchId
  },
  {
    place: PODIUM_SLOT_CONFIG[3].positionLabel,
    desc: PODIUM_SLOT_CONFIG[3].subtitle,
    title: '4º Colocado 🏅',
    matchId: PODIUM_SLOT_CONFIG[3].legacyMatchId
  }
];

function getPodiumSlotForMatch(match?: Pick<Match, 'teamA' | 'teamB'> | null) {
  if (!match) return null;

  return DEFAULT_PODIUM_SLOTS.find(
    (slot) => slot.place === match.teamA && slot.desc === match.teamB
  ) || null;
}

function getPodiumSlotByMatchId(matchId?: string | null) {
  if (!matchId) return null;
  return DEFAULT_PODIUM_SLOTS.find((slot) => slot.matchId === matchId) || null;
}

function getPoolDeadlineTimestamp(
  pool?: Pool | null,
  poolMatches?: Array<Pick<Match, 'startedAt'>>
) {
  if (pool?.bettingDeadline) {
    const timestamp = new Date(pool.bettingDeadline).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  const fallbackTimestamp = (poolMatches || [])
    .map((match) => new Date(match.startedAt).getTime())
    .find((value) => !Number.isNaN(value));

  return typeof fallbackTimestamp === 'number' ? fallbackTimestamp : null;
}

function formatPoolDeadline(
  pool?: Pool | null,
  poolMatches?: Array<Pick<Match, 'startedAt'>>
) {
  const deadlineTs = getPoolDeadlineTimestamp(pool, poolMatches);
  if (!deadlineTs) return 'Sem prazo definido';

  return new Date(deadlineTs).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizePodiumLabel(value?: string | null) {
  return (value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ');
}

function getTimestampValue(timestamp?: string) {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getBetFinalizedAt(picks: UserPick[]) {
  return picks.reduce<string | undefined>((latestTimestamp, pick) => {
    if (!pick.updatedAt) return latestTimestamp;
    if (!latestTimestamp) return pick.updatedAt;
    return getTimestampValue(pick.updatedAt) > getTimestampValue(latestTimestamp)
      ? pick.updatedAt
      : latestTimestamp;
  }, undefined);
}

function formatBetFinalizedAt(timestamp?: string) {
  if (!timestamp) return 'Data de finalização indisponível';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(timestamp));
}

function getPodiumEntryForPoolMatch(
  matchId: string,
  matchesList: Match[],
  podiumEntries: TournamentPodiumEntry[]
) {
  const match = matchesList.find((item) => item.id === matchId);
  const resolvedSlot = getPodiumSlotForMatch(match) || getPodiumSlotByMatchId(matchId);

  if (!resolvedSlot) {
    return getPodiumEntryForMatchId(matchId, podiumEntries);
  }

  return (
    podiumEntries.find(
      (entry) =>
        normalizePodiumLabel(entry.positionLabel) === normalizePodiumLabel(resolvedSlot.place)
        && normalizePodiumLabel(entry.subtitle) === normalizePodiumLabel(resolvedSlot.desc)
    ) || null
  );
}

interface ApostadorDashboardProps {
  user: { id?: string; fullName: string; email: string; isAdmin?: boolean; cpf?: string; telefone?: string; avatarUrl?: string };
  matchesList: Match[];
  updateMatchList: (id: string, scoreA: number | null, scoreB: number | null) => void;
  tenantSettings: TenantSettings;
  alertsList: AlertNotification[];
  setAlertsList: React.Dispatch<React.SetStateAction<AlertNotification[]>>;
  onLogout: () => void;
  accumulatedFeePool: number;
  triggerCheckoutSession: (feeAmount: number, groupCreator: string, groupId: string, userId: string, userEmail: string, userName: string, userCpf?: string, userPhone?: string) => void;
  paidPoolIds: Record<string, number>;
  onMarkPoolAsPaid: (poolId: string) => void;
  onResetPoolAccess?: (poolId: string) => void;
  checkoutTransaction: {
    active: boolean;
    amount: number;
    qrcode: string;
    copiaECola: string;
    groupCreator: string;
    groupId?: string;
    transactionId?: string;
    orderId?: string;
    expiresAt?: string;
    status?: 'pending' | 'paid' | 'failed' | 'canceled' | 'expired';
  } | null;
  setCheckoutTransaction: any;
  checkoutSucceeded: boolean;
  setCheckoutSucceeded: (val: boolean) => void;
  poolsList: Pool[];
  onCreatePool: (newPool: Pool) => void;
  onUpdateUser: (patch: { cpf?: string; telefone?: string }) => void;
}

export default function ApostadorDashboard({
  user,
  matchesList,
  updateMatchList,
  tenantSettings,
  alertsList,
  setAlertsList,
  onLogout,
  accumulatedFeePool,
  triggerCheckoutSession,
  paidPoolIds,
  onMarkPoolAsPaid,
  onResetPoolAccess,
  checkoutTransaction,
  setCheckoutTransaction,
  checkoutSucceeded,
  setCheckoutSucceeded,
  poolsList,
  onCreatePool,
  onUpdateUser
}: ApostadorDashboardProps) {
  // Tabs: 'dashboard' | 'palpites' | 'ranking' | 'alerts' | 'perfil' | 'times'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'palpites' | 'meus-palpites' | 'ranking' | 'alerts' | 'perfil' | 'times'>('dashboard');
  
  // Dashboard states
  const [inviteCode, setInviteCode] = useState('');
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [bottomSheetData, setBottomSheetData] = useState<{ creator: string; prize: number; fee: number; name: string; id?: string } | null>(null);
  const [pendingBottomSheetPix, setPendingBottomSheetPix] = useState<RecoverablePixTransaction | null>(null);
  const [pendingBottomSheetPixLoading, setPendingBottomSheetPixLoading] = useState(false);
  const [latestPixByGroup, setLatestPixByGroup] = useState<Record<string, RecoverablePixTransaction>>({});
  const [walletSummary, setWalletSummary] = useState<BettorWalletSummary>({ balance: 0 });
  const [walletLoading, setWalletLoading] = useState(false);
  const [pixChargeHistory, setPixChargeHistory] = useState<PixChargeHistoryItem[]>([]);
  const [usingWalletEntry, setUsingWalletEntry] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<string>(() => poolsList[0]?.id || 'p1');
  const [expandedPoolDescriptionId, setExpandedPoolDescriptionId] = useState<string | null>(null);
  const [agendaDateFilter, setAgendaDateFilter] = useState('');
  const [agendaTeamFilter, setAgendaTeamFilter] = useState('');
  const [agendaSlideIndex, setAgendaSlideIndex] = useState(0);
  const agendaDateInputRef = useRef<HTMLInputElement | null>(null);
  const poolSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const agendaSwipeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Perfil: edição de dados do pagador (CPF + telefone)
  const [profileCpf, setProfileCpf] = useState<string>(user.cpf || '');
  const [profilePhone, setProfilePhone] = useState<string>(user.telefone || '');
  const [profileSaved, setProfileSaved] = useState(false);

  // Sincroniza os campos do Perfil quando o usuário é recarregado do Supabase.
  // Isso evita que CPF/telefone voltem para placeholder após refresh.
  useEffect(() => {
    setProfileCpf(user.cpf ? formatCpfLocal(user.cpf) : '');
    setProfilePhone(user.telefone ? formatPhoneLocal(user.telefone) : '');
  }, [user.cpf, user.telefone]);

  const formatCpfLocal = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };
  const formatPhoneLocal = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const handleSaveProfilePaymentData = async () => {
    const cpfDigits = profileCpf.replace(/\D/g, '');
    const phoneDigits = profilePhone.replace(/\D/g, '');

    if (cpfDigits.length !== 11) {
      alert('Informe um CPF válido (11 dígitos).');
      return;
    }
    if (phoneDigits.length < 10) {
      alert('Informe um telefone válido com DDD.');
      return;
    }

    if (user.id) {
      const { error } = await SupabaseService.updateUserPaymentData(user.id, cpfDigits, phoneDigits);
      if (error) {
        alert('Erro ao salvar: ' + error);
        return;
      }
    }

    onUpdateUser({ cpf: cpfDigits, telefone: phoneDigits });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handlePoolEntryAction = async (
    poolData: { creator: string; prize: number; fee: number; name: string; id?: string },
    options?: { closeBottomSheet?: boolean; nextTab?: 'dashboard' | 'palpites' | 'meusPalpites' | 'ranking' | 'alertas' | 'perfil' | 'times' }
  ) => {
    if (poolData?.id) {
      setSelectedPoolId(poolData.id);
    }

    const selectedPool = poolsList.find((pool) => pool.id === (poolData?.id || ''));
    const selectedPoolMatches = selectedPool ? getPoolMatches(selectedPool) : [];
    const selectedPoolDeadlineTs = getPoolDeadlineTimestamp(selectedPool, selectedPoolMatches);
    if (selectedPool && selectedPoolDeadlineTs !== null && Date.now() >= selectedPoolDeadlineTs) {
      if (options?.closeBottomSheet !== false) {
        setShowBottomSheet(false);
      }
      alert(`O prazo de apostas do bolão "${selectedPool.name}" encerrou em ${formatPoolDeadline(selectedPool, selectedPoolMatches)}.`);
      return;
    }

    const selectedPoolFee = poolData?.fee ?? 0;
    const availableWalletBalance = walletSummary.balance || 0;

    if ((poolData?.id || '') && availableWalletBalance >= selectedPoolFee) {
      if (options?.closeBottomSheet !== false) {
        setShowBottomSheet(false);
      }
      if (poolData?.id) {
        setSelectedPoolId(poolData.id);
      }
      setActiveTab(options?.nextTab || 'palpites');
      return;
    }

    // Lê CPF/telefone do perfil do usuário. Se faltar, pede para completar o cadastro.
    const cpfDigits = (user.cpf || '').replace(/\D/g, '');
    const phoneDigits = (user.telefone || '').replace(/\D/g, '');

    if (cpfDigits.length !== 11 || phoneDigits.length < 10) {
      if (options?.closeBottomSheet !== false) {
        setShowBottomSheet(false);
      }
      setActiveTab('perfil');
      alert('Complete seu CPF e telefone no Perfil antes de pagar.');
      return;
    }

    if (options?.closeBottomSheet !== false) {
      setShowBottomSheet(false);
    }
    triggerCheckoutSession(
      Math.max(0, selectedPoolFee - availableWalletBalance),
      poolData?.creator ?? '',
      poolData?.id ?? '',
      user.id || '',
      user.email,
      user.fullName,
      cpfDigits,
      phoneDigits
    );
  };

  const handleConfirmPayment = async () => {
    if (!bottomSheetData) return;
    await handlePoolEntryAction(bottomSheetData);
  };

  // Palpites Auto-Save Simulation States
  const [userPicks, setUserPicks] = useState<Record<string, UserPick[]>>({});
  const [currentNewPick, setCurrentNewPick] = useState<Record<string, UserPick>>({}); // key is matchId, value is the pick for that match in the current new bet
  const [currentBetId, setCurrentBetId] = useState<string>('');
  const [tournamentPodium, setTournamentPodium] = useState<TournamentPodiumEntry[]>(() => buildDefaultTournamentPodium());
  const [rankingParticipantsByPool, setRankingParticipantsByPool] = useState<Record<string, Participant[]>>({});
  const [rankingLoadingByPool, setRankingLoadingByPool] = useState<Record<string, boolean>>({});
  const [expandedRankingPoolIds, setExpandedRankingPoolIds] = useState<string[]>(() => poolsList[0]?.id ? [poolsList[0].id] : []);
  const [rankingTab, setRankingTab] = useState<'ativos' | 'finalizados'>('ativos');
  const [autosaveToasts, setAutosaveToasts] = useState<Record<string, boolean>>({});
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const timeoutRefs = useRef<Record<string, any>>({});

  const activePool = useMemo(() => poolsList.find(p => p.id === selectedPoolId) || poolsList[0], [poolsList, selectedPoolId]);
  const getPoolPodiumMatchIds = React.useCallback((pool?: Pool | null) => {
    if (!pool || pool.modality !== 'podium') return [];

    if (pool.selectedMatchIds && pool.selectedMatchIds.length > 0) {
      return pool.selectedMatchIds;
    }

    const fallbackPodiumMatches = matchesList
      .filter((match) => match.group === 'PÓDIO')
      .slice(0, DEFAULT_PODIUM_SLOTS.length)
      .map((match) => match.id);

    return fallbackPodiumMatches.length > 0
      ? fallbackPodiumMatches
      : DEFAULT_PODIUM_SLOTS.map((slot) => slot.matchId);
  }, [matchesList]);
  const getPoolMatches = React.useCallback((pool?: Pool | null) => {
    if (!pool) return [];
    if (pool.selectedMatchIds && pool.selectedMatchIds.length > 0) {
      return matchesList.filter((match) => pool.selectedMatchIds!.includes(match.id));
    }
    return matchesList;
  }, [matchesList]);
  const activePodiumMatchIds = useMemo(() => {
    return getPoolPodiumMatchIds(activePool);
  }, [activePool, getPoolPodiumMatchIds]);
  const requiredPodiumPickCount = activePool?.modality === 'podium'
    ? (activePodiumMatchIds.length || DEFAULT_PODIUM_SLOTS.length)
    : 0;
  const podiumSelectionSlots = useMemo(() => {
    if (activePool?.modality !== 'podium') return [];

    return activePodiumMatchIds.map((matchId, index) => {
      const match = matchesList.find((item) => item.id === matchId);
      const resolvedSlot = getPodiumSlotForMatch(match);
      const fallbackSlot = DEFAULT_PODIUM_SLOTS[index] || DEFAULT_PODIUM_SLOTS[0];

      return {
        place: resolvedSlot?.place || fallbackSlot.place,
        title: resolvedSlot?.title || fallbackSlot.title,
        matchId
      };
    });
  }, [activePool, activePodiumMatchIds, matchesList]);
  const currentPodiumSnapshot = useMemo(
    () => activePodiumMatchIds
      .map((matchId) => getPodiumEntryForPoolMatch(matchId, matchesList, tournamentPodium))
      .filter(Boolean) as TournamentPodiumEntry[],
    [activePodiumMatchIds, matchesList, tournamentPodium]
  );
  const podiumIsPreview = useMemo(
    () => isPodiumStillProvisional(currentPodiumSnapshot),
    [currentPodiumSnapshot]
  );
  const activePoolMatches = useMemo(() => getPoolMatches(activePool), [activePool, getPoolMatches]);
  const activePoolDeadlineTs = useMemo(
    () => getPoolDeadlineTimestamp(activePool, activePoolMatches),
    [activePool, activePoolMatches]
  );
  const isActivePoolBettingClosed = activePoolDeadlineTs !== null && currentTimestamp >= activePoolDeadlineTs;
  const editableTraditionalMatches = useMemo(
    () => activePoolMatches.filter((match) => match.status !== 'finished'),
    [activePoolMatches]
  );
  const totalTraditionalMatchCount = activePool?.modality === 'score'
    ? activePoolMatches.length
    : 0;
  const requiredTraditionalPickCount = activePool?.modality === 'score'
    ? totalTraditionalMatchCount
    : 0;
  const filledTraditionalPickCount = activePool?.modality === 'score'
    ? activePoolMatches.filter((match) => {
        const pick = currentNewPick[match.id];
        return pick?.scoreA !== null && pick?.scoreB !== null;
      }).length
    : 0;
  const activePoolTicketsCount = activePool?.id ? (paidPoolIds[activePool.id] || 0) : 0;
  const finalizedBetsCountByPool = useMemo(() => {
    const counts: Record<string, number> = {};
    const poolMap = new Map(poolsList.map((pool) => [pool.id, pool]));

    Object.entries(userPicks).forEach(([poolId, _groupPicks]) => {
      const pool = poolMap.get(poolId);
      if (!pool) return;
      const groupPicks = _groupPicks as UserPick[];

      const picksByBetId: Record<string, UserPick[]> = {};
      groupPicks.forEach((pick) => {
        const betId = pick.betId || 'legacy';
        if (!picksByBetId[betId]) picksByBetId[betId] = [];
        picksByBetId[betId].push(pick);
      });

      const requiredPickCount = pool.modality === 'podium'
        ? getPoolPodiumMatchIds(pool).length
        : getPoolMatches(pool).length;

      let count = 0;
      Object.values(picksByBetId).forEach((picks) => {
        if (pool.modality === 'podium') {
          const validPicks = picks.filter((pick) => pick.scoreA !== null && pick.saved);
          if (requiredPickCount > 0 && validPicks.length === requiredPickCount) {
            count++;
          }
        } else {
          const validPicks = picks.filter(
            (pick) => pick.scoreA !== null && pick.scoreB !== null && pick.saved
          );
          if (requiredPickCount > 0 && validPicks.length === requiredPickCount) {
            count++;
          }
        }
      });

      counts[poolId] = count;
    });

    return counts;
  }, [poolsList, userPicks, getPoolMatches, getPoolPodiumMatchIds]);
  const activePoolFinalizedBetsCount = activePool?.id ? (finalizedBetsCountByPool[activePool.id] || 0) : 0;

  // Se o betId atual já estiver finalizado, precisamos de um novo betId para continuar apostando (se houver saldo)
  const isCurrentBetFinalized = useMemo(() => {
    if (!activePool?.id || !currentBetId) return false;
    const groupPicks = userPicks[activePool.id] || [];
    const currentPicks = groupPicks.filter(p => p.betId === currentBetId && p.scoreA !== null && p.saved);
    if (activePool.modality === 'podium') {
      return requiredPodiumPickCount > 0 && currentPicks.length === requiredPodiumPickCount;
    }
    const validTraditionalPicks = currentPicks.filter((pick) => pick.scoreB !== null);
    return requiredTraditionalPickCount > 0 && validTraditionalPicks.length === requiredTraditionalPickCount;
  }, [activePool, userPicks, currentBetId, requiredPodiumPickCount, requiredTraditionalPickCount]);

  const hasPaidInscricao = useMemo(() => {
    if (!activePool || isActivePoolBettingClosed) return false;
    if (activePool.modality === 'podium') {
      return activePoolTicketsCount > activePoolFinalizedBetsCount;
    }

    return activePoolTicketsCount > activePoolFinalizedBetsCount;
  }, [activePool, activePoolTicketsCount, activePoolFinalizedBetsCount, isActivePoolBettingClosed]);
  const canUseWalletForActivePool = !isActivePoolBettingClosed && (walletSummary.balance || 0) >= (activePool?.entryFee || 0);
  const canStartBetForActivePool = hasPaidInscricao || canUseWalletForActivePool;
  const saldoDisponivel = (activePoolTicketsCount - activePoolFinalizedBetsCount) * (activePool?.entryFee || 0);
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const isLikelyImageUrl = (value?: string | null) => /^https?:\/\//i.test((value || '').trim());
  const isGenericTeamArtwork = (value?: string | null) => /images\.unsplash\.com/i.test((value || '').trim());
  const normalizeSearchValue = (value?: string | null) => (value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const findTeamMeta = (value?: string | null) => {
    const normalized = normalizeSearchValue(value);
    if (!normalized) return null;

    return COPA_2026_TEAMS.find((team) =>
      normalizeSearchValue(team.code) === normalized
      || normalizeSearchValue(team.name) === normalized
    ) || null;
  };
  const getTeamAccentColors = (teamKey: string) => {
    const palette = [
      ['#00e676', '#0f3b2a'],
      ['#ffe16d', '#453308'],
      ['#6ec8ff', '#11324f'],
      ['#ff8a65', '#4a1f16'],
      ['#c084fc', '#31204f'],
      ['#ff6d91', '#4f1d2d']
    ] as const;
    const seed = [...teamKey].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palette[seed % palette.length];
  };
  const getAgendaTeamDisplay = (teamValue?: string | null, teamFlagValue?: string | null) => {
    const teamMeta = findTeamMeta(teamValue);
    const displayName = teamMeta?.name || teamValue || 'Seleção';
    const displayCode = teamMeta?.code || (teamValue || '??').slice(0, 3).toUpperCase();
    const displayFlag = teamMeta?.flag || null;
    const officialFlagUrl = getOfficialTeamFlagUrl(teamMeta?.code || displayCode);
    const fallbackImageUrl = isLikelyImageUrl(teamFlagValue) && !isGenericTeamArtwork(teamFlagValue)
      ? teamFlagValue
      : null;
    const imageUrl = officialFlagUrl || fallbackImageUrl;
    const [accent, accentDark] = getTeamAccentColors(teamMeta?.code || displayCode);

    return {
      displayName,
      displayCode,
      displayFlag,
      imageUrl,
      accent,
      accentDark
    };
  };
  const isSuspiciousLobbyValue = (value?: string | null) => {
    const normalized = (value || '').trim();
    if (!normalized) return true;
    if (/^https?:\/\//i.test(normalized)) return true;
    if (normalized.length > 24 && !/\s/.test(normalized)) return true;
    return false;
  };
  const getLobbyPodiumDisplay = (entry: TournamentPodiumEntry) => {
    const teamByCode = COPA_2026_TEAMS.find((team) => team.code === entry.teamCode);
    const displayName = teamByCode?.name
      || (!isSuspiciousLobbyValue(entry.teamName) ? entry.teamName : null)
      || (!isSuspiciousLobbyValue(entry.teamCode) ? entry.teamCode : null)
      || 'A definir';
    const displayCode = teamByCode?.code || entry.teamCode || displayName.slice(0, 3).toUpperCase();
    const displayFlag = teamByCode?.flag || entry.teamFlag || null;
    const imageUrl = getOfficialTeamFlagUrl(displayCode)
      || (isLikelyImageUrl(entry.teamFlag) && !isGenericTeamArtwork(entry.teamFlag) ? entry.teamFlag : null);
    const [accent, accentDark] = getTeamAccentColors(displayCode);

    return {
      displayName,
      displayCode,
      displayFlag,
      displaySubtitle: entry.positionLabel || `${entry.position}º lugar`,
      imageUrl,
      accent,
      accentDark
    };
  };
  const getPoolHeroTeams = React.useCallback((poolMatches: Match[]) => {
    const uniqueTeams = new Map<string, ReturnType<typeof getAgendaTeamDisplay>>();

    poolMatches.forEach((match) => {
      const teamAData = getAgendaTeamDisplay(match.teamA, match.teamAFlag);
      const teamBData = getAgendaTeamDisplay(match.teamB, match.teamBFlag);

      if (!uniqueTeams.has(teamAData.displayCode)) {
        uniqueTeams.set(teamAData.displayCode, teamAData);
      }
      if (!uniqueTeams.has(teamBData.displayCode)) {
        uniqueTeams.set(teamBData.displayCode, teamBData);
      }
    });

    return Array.from(uniqueTeams.values()).slice(0, 4);
  }, [getAgendaTeamDisplay]);
  const activePoolHeroTeams = useMemo(() => getPoolHeroTeams(activePoolMatches), [activePoolMatches, getPoolHeroTeams]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const agendaMatchesBase = useMemo(() => {
    return matchesList
      .filter((match) => match.group !== 'PÓDIO')
      .map((match) => ({
        match,
        startedAtMs: new Date(match.startedAt).getTime()
      }))
      .filter(({ startedAtMs }) => !Number.isNaN(startedAtMs));
  }, [matchesList]);
  const agendaTeamOptions = useMemo(() => {
    const uniqueTeams = new Set<string>();
    agendaMatchesBase.forEach(({ match }) => {
      uniqueTeams.add(getAgendaTeamDisplay(match.teamA, match.teamAFlag).displayName);
      uniqueTeams.add(getAgendaTeamDisplay(match.teamB, match.teamBFlag).displayName);
    });

    return [...uniqueTeams].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [agendaMatchesBase]);
  const lobbyMatches = useMemo(() => {
    const normalizedTeamFilter = normalizeSearchValue(agendaTeamFilter);

    const filteredMatches = agendaMatchesBase.filter(({ match }) => {
      const matchesDate = agendaDateFilter ? match.startedAt.slice(0, 10) === agendaDateFilter : true;
      const teamADisplay = getAgendaTeamDisplay(match.teamA, match.teamAFlag);
      const teamBDisplay = getAgendaTeamDisplay(match.teamB, match.teamBFlag);
      const matchesTeam = normalizedTeamFilter
        ? normalizeSearchValue(match.teamA).includes(normalizedTeamFilter)
          || normalizeSearchValue(match.teamB).includes(normalizedTeamFilter)
          || normalizeSearchValue(teamADisplay.displayName).includes(normalizedTeamFilter)
          || normalizeSearchValue(teamBDisplay.displayName).includes(normalizedTeamFilter)
        : true;

      return matchesDate && matchesTeam;
    });

    const sortedFilteredMatches = [...filteredMatches]
      .sort((a, b) => a.startedAtMs - b.startedAtMs)
      .map(({ match }) => match);

    if (agendaDateFilter || normalizedTeamFilter) {
      return sortedFilteredMatches;
    }

    const todaysMatches = agendaMatchesBase
      .filter(({ match }) => match.startedAt.slice(0, 10) === todayKey)
      .sort((a, b) => a.startedAtMs - b.startedAtMs)
      .map(({ match }) => match);

    if (todaysMatches.length > 0) return todaysMatches.slice(0, 6);

    return agendaMatchesBase
      .filter(({ startedAtMs }) => startedAtMs >= Date.now())
      .sort((a, b) => a.startedAtMs - b.startedAtMs)
      .slice(0, 6)
      .map(({ match }) => match);
  }, [agendaDateFilter, agendaMatchesBase, agendaTeamFilter, todayKey]);
  const lobbyTopTeams = useMemo(() => {
    return [...tournamentPodium]
      .sort((a, b) => a.position - b.position)
      .slice(0, 4);
  }, [tournamentPodium]);
  const lobbyTopTeamsLabel = lobbyTopTeams.some((entry) => entry.isProvisional)
    ? 'Top 4 FIFA (prévia)'
    : 'Top 4 oficial da Copa';
  const openAgendaDatePicker = () => {
    const input = agendaDateInputRef.current;
    if (!input) return;

    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === 'function') {
      pickerInput.showPicker();
      return;
    }

    input.focus();
    input.click();
  };
  const agendaSlides = useMemo(() => {
    const matchSlides = lobbyMatches.map((match) => ({ type: 'match' as const, key: match.id, match }));

    if (agendaDateFilter || agendaTeamFilter) {
      return matchSlides;
    }

    return [
      ...matchSlides,
      { type: 'topTeams' as const, key: 'top-teams-slide' }
    ];
  }, [agendaDateFilter, agendaTeamFilter, lobbyMatches]);
  // Lista de bolões ativos (não finalizados) para o carrossel da Lobby
  const activePoolsList = useMemo(() => {
    return poolsList.filter((pool) => {
      if (pool.finalizedAt) return false;
      const poolMatchesLocal = getPoolMatches(pool);
      const deadlineTs = getPoolDeadlineTimestamp(pool, poolMatchesLocal);
      // Exclui bolões cujo prazo expirou há mais de 3 horas
      if (deadlineTs !== null && currentTimestamp >= deadlineTs + 3 * 60 * 60 * 1000) return false;
      return true;
    });
  }, [poolsList, currentTimestamp]);

  const selectedPoolIndex = useMemo(() => {
    const index = activePoolsList.findIndex((pool) => pool.id === selectedPoolId);
    return index >= 0 ? index : 0;
  }, [activePoolsList, selectedPoolId]);
  const goToPoolIndex = React.useCallback((nextIndex: number) => {
    if (!activePoolsList.length) return;
    const normalizedIndex = ((nextIndex % activePoolsList.length) + activePoolsList.length) % activePoolsList.length;
    const nextPoolId = activePoolsList[normalizedIndex]?.id;
    if (nextPoolId) {
      setSelectedPoolId(nextPoolId);
    }
  }, [activePoolsList]);
  const goToAgendaIndex = React.useCallback((nextIndex: number) => {
    if (!agendaSlides.length) return;
    const normalizedIndex = ((nextIndex % agendaSlides.length) + agendaSlides.length) % agendaSlides.length;
    setAgendaSlideIndex(normalizedIndex);
  }, [agendaSlides.length]);
  const handleSwipeStart = (
    event: React.TouchEvent<HTMLDivElement>,
    targetRef: React.MutableRefObject<{ x: number; y: number } | null>
  ) => {
    const touch = event.touches[0];
    if (!touch) return;
    targetRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleSwipeEnd = (
    event: React.TouchEvent<HTMLDivElement>,
    targetRef: React.MutableRefObject<{ x: number; y: number } | null>,
    onSwipeLeft: () => void,
    onSwipeRight: () => void
  ) => {
    const start = targetRef.current;
    const touch = event.changedTouches[0];
    targetRef.current = null;

    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 48 || absX <= absY) return;

    if (deltaX < 0) {
      onSwipeLeft();
      return;
    }

    onSwipeRight();
  };
  const handleOpenPoolCheckout = (pool: Pool) => {
    const poolMatches = getPoolMatches(pool);
    const poolDeadlineTs = getPoolDeadlineTimestamp(pool, poolMatches);
    if (poolDeadlineTs !== null && Date.now() >= poolDeadlineTs) {
      setSelectedPoolId(pool.id);
      alert(`O prazo de apostas do bolão "${pool.name}" encerrou em ${formatPoolDeadline(pool, poolMatches)}. Não é mais possível fazer novas apostas.`);
      return;
    }

    setSelectedPoolId(pool.id);
    setInviteCode(pool.inviteCode);
    setBottomSheetData({
      id: pool.id,
      name: pool.name,
      creator: pool.creator,
      prize: getPoolEstimatedPrizeValue(pool, tenantSettings),
      fee: pool.entryFee
    });
    setShowBottomSheet(true);
  };

  useEffect(() => {
    if (activeTab !== 'dashboard' || poolsList.length <= 1) return;

    const interval = window.setInterval(() => {
      goToPoolIndex(selectedPoolIndex + 1);
    }, 20000);

    return () => window.clearInterval(interval);
  }, [activeTab, goToPoolIndex, poolsList.length, selectedPoolIndex]);

  useEffect(() => {
    setAgendaSlideIndex(0);
  }, [agendaDateFilter, agendaTeamFilter]);

  useEffect(() => {
    if (!agendaSlides.length) {
      setAgendaSlideIndex(0);
      return;
    }

    setAgendaSlideIndex((prev) => Math.min(prev, agendaSlides.length - 1));
  }, [agendaSlides.length]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || agendaSlides.length <= 1) return;

    const interval = window.setInterval(() => {
      goToAgendaIndex(agendaSlideIndex + 1);
    }, 6000);

    return () => window.clearInterval(interval);
  }, [activeTab, agendaSlideIndex, agendaSlides.length, goToAgendaIndex]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  // Reset current new pick when switching to Palpites tab or changing active pool
  useEffect(() => {
    if (activeTab === 'palpites' && activePool) {
      // Create a unique betId for this bet session
      const newBetId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      setCurrentBetId(newBetId);

      // Initialize with fresh empty picks for all matches in the active pool
      const freshPick: Record<string, UserPick> = {};
      activePoolMatches.forEach(match => {
        freshPick[match.id] = {
          matchId: match.id,
          groupId: activePool.id,
          betId: newBetId,
          scoreA: null,
          scoreB: activePool.modality === 'podium' ? 0 : null,
          saved: false
        };
      });
      setCurrentNewPick(freshPick);
    }
  }, [activeTab, activePool, activePoolMatches]);

  // Fetch real picks from Supabase Cloud on mount/load
  useEffect(() => {
    const loadPicks = async () => {
      if (user.id) {
        const dbPicks = await SupabaseService.fetchUserPicks(user.id);
        if (dbPicks) {
          setUserPicks(dbPicks);
        }
      }
    };
    loadPicks();
  }, [user.id]);

  useEffect(() => {
    const loadTournamentPodium = async () => {
      const officialPodium = await SupabaseService.fetchTournamentPodium();
      setTournamentPodium(officialPodium);
    };

    loadTournamentPodium();
  }, [matchesList]);

  useEffect(() => {
    if (activeTab !== 'ranking') return;

    let cancelled = false;

    const loadAllRankings = async () => {
      const loadingState: Record<string, boolean> = {};
      poolsList.forEach((pool) => {
        loadingState[pool.id] = true;
      });
      setRankingLoadingByPool(loadingState);

      const entries = await Promise.all(
        poolsList.map(async (pool) => {
          const prizeSettings = {
            firstPlacePct: tenantSettings.firstPlacePct,
            secondPlacePct: tenantSettings.secondPlacePct,
            thirdPlacePct: tenantSettings.thirdPlacePct
          };

          if (pool.modality === 'podium') {
            const ranking = await SupabaseService.fetchPodiumRankingParticipants(
              pool.id,
              getPoolPodiumMatchIds(pool),
              tournamentPodium,
              { id: user.id, fullName: user.fullName },
              prizeSettings
            );

            return [pool.id, ranking] as const;
          }

          const ranking = await SupabaseService.fetchScoreRankingParticipants(
            pool.id,
            pool.selectedMatchIds || [],
            matchesList,
            { id: user.id, fullName: user.fullName },
            prizeSettings,
            pool.bettingDeadline,
            pool.finalizedAt
          );

          return [pool.id, ranking] as const;
        })
      );

      if (cancelled) return;

      setRankingParticipantsByPool(
        entries.reduce<Record<string, Participant[]>>((acc, [poolId, ranking]) => {
          acc[poolId] = ranking;
          return acc;
        }, {})
      );

      setRankingLoadingByPool(
        entries.reduce<Record<string, boolean>>((acc, [poolId]) => {
          acc[poolId] = false;
          return acc;
        }, {})
      );
    };

    loadAllRankings();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    poolsList,
    tournamentPodium,
    matchesList,
    user.id,
    user.fullName,
    userPicks,
    tenantSettings.firstPlacePct,
    tenantSettings.secondPlacePct,
    tenantSettings.thirdPlacePct,
    getPoolPodiumMatchIds
  ]);

  useEffect(() => {
    if (!poolsList.length) {
      setExpandedRankingPoolIds([]);
      return;
    }

    setExpandedRankingPoolIds((prev) => {
      const validIds = prev.filter((poolId) => poolsList.some((pool) => pool.id === poolId));
      if (validIds.length > 0) return validIds;
      return [poolsList[0].id];
    });
  }, [poolsList]);

  useEffect(() => {
    setPodiumLocked((prev) => {
      const next = { ...prev };

      poolsList
        .filter((pool) => pool.modality === 'podium' && pool.id && pool.selectedMatchIds?.length === 4)
        .forEach((pool) => {
          if (next[pool.id] !== undefined) return;

          const groupPicks = userPicks[pool.id] || [];
          const hasAllSavedSelections = pool.selectedMatchIds!.every((matchId) => {
            const pick = groupPicks.find(p => p.matchId === matchId);
            return !!pick && pick.scoreA !== null && pick.saved === true;
          });

          if (hasAllSavedSelections) {
            next[pool.id] = true;
          }
        });

      return next;
    });
  }, [poolsList, userPicks]);

  // Checkout timer
  const [timeLeft, setTimeLeft] = useState(0);
  const [copiarTexto, setCopiarTexto] = useState('Copiar Código Pix');

  // Filter alerts state
  const [alertFilter, setAlertFilter] = useState<'Tudo' | 'Partidas' | 'Ranking' | 'Sistema'>('Tudo');

  // User input simulation values
  const [customRank, setCustomRank] = useState(3); // Mock user starts at Rank #3

  // Load state and simulated bottom-sheet content triggers
  const handleValidateInviteCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    const code = inviteCode.trim().toUpperCase();
    const foundPool = poolsList.find(p => p.inviteCode === code);

    if (foundPool) {
      const foundPoolMatches = getPoolMatches(foundPool);
      const poolDeadlineTs = getPoolDeadlineTimestamp(foundPool, foundPoolMatches);
      if (poolDeadlineTs !== null && Date.now() >= poolDeadlineTs) {
        alert(`O prazo de apostas do bolão "${foundPool.name}" encerrou em ${formatPoolDeadline(foundPool, foundPoolMatches)}.`);
        return;
      }

      setBottomSheetData({
        id: foundPool.id,
        name: foundPool.name,
        creator: foundPool.creator,
        prize: getPoolEstimatedPrizeValue(foundPool, tenantSettings),
        fee: foundPool.entryFee
      });
      setShowBottomSheet(true);
    } else {
      alert(`Nenhum bolão ativo foi localizado com o código de acesso "${code}". Vá ao Painel do Administrador para criar novos bolões com chaves personalizadas! Códigos disponíveis: "${poolsList.map(p => p.inviteCode).join(', ')}"`);
    }
  };

  // Checkout pix countdown timer
  useEffect(() => {
    if (!checkoutTransaction?.expiresAt || checkoutSucceeded) {
      setTimeLeft(0);
      return;
    }

    const syncCountdown = () => {
      const diffMs = new Date(checkoutTransaction.expiresAt || '').getTime() - Date.now();
      setTimeLeft(Math.max(0, Math.floor(diffMs / 1000)));
    };

    syncCountdown();
    const interval = setInterval(() => {
      syncCountdown();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [checkoutTransaction, checkoutSucceeded]);

  useEffect(() => {
    if (!checkoutTransaction?.transactionId || checkoutSucceeded) return;

    let cancelled = false;

    const syncTransactionStatus = async () => {
      const status = await SupabaseService.fetchPixTransactionStatus(checkoutTransaction.transactionId || '');
      if (cancelled || !status) return;

      if (status === 'paid') {
        setCheckoutTransaction((prev: typeof checkoutTransaction) => (
          prev?.transactionId === checkoutTransaction.transactionId
            ? { ...prev, status: 'paid' }
            : prev
        ));
        setCheckoutSucceeded(true);
        const newAlert: AlertNotification = {
          id: `alert-sys-${Date.now()}`,
          type: 'Sistema',
          title: 'Pagamento Confirmado',
          message: 'Seu pagamento Pix foi confirmado e a sua aposta neste bolão já pode ser concluída.',
          timeText: 'Agora',
          unread: true
        };
        setAlertsList(prev => [newAlert, ...prev]);
        return;
      }

      if (status === 'expired' || status === 'canceled' || status === 'failed') {
        setCheckoutTransaction((prev: typeof checkoutTransaction) => (
          prev?.transactionId === checkoutTransaction.transactionId
            ? { ...prev, status }
            : prev
        ));
      }
    };

    syncTransactionStatus();
    const interval = setInterval(syncTransactionStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [checkoutTransaction?.transactionId, checkoutSucceeded, setAlertsList, setCheckoutSucceeded, setCheckoutTransaction]);

  useEffect(() => {
    if (!checkoutTransaction?.transactionId || checkoutSucceeded || timeLeft > 0) return;
    if (checkoutTransaction.status === 'paid' || checkoutTransaction.status === 'expired' || checkoutTransaction.status === 'canceled') return;

    let cancelled = false;

    const syncExpiredCheckoutState = async () => {
      const latestStatus = await SupabaseService.fetchPixTransactionStatus(checkoutTransaction.transactionId || '');
      if (cancelled) return;

      if (latestStatus === 'paid') {
        setCheckoutTransaction((prev: typeof checkoutTransaction) => (
          prev?.transactionId === checkoutTransaction.transactionId
            ? { ...prev, status: 'paid' }
            : prev
        ));
        setCheckoutSucceeded(true);
        return;
      }

      if (latestStatus === 'expired' || latestStatus === 'canceled' || latestStatus === 'failed') {
        setCheckoutTransaction((prev: typeof checkoutTransaction) => (
          prev?.transactionId === checkoutTransaction.transactionId
            ? { ...prev, status: latestStatus }
            : prev
        ));
        return;
      }

      const expired = await SupabaseService.expirePixTransaction(checkoutTransaction.transactionId);
      if (cancelled || !expired) return;

      setCheckoutTransaction((prev: typeof checkoutTransaction) => (
        prev?.transactionId === checkoutTransaction.transactionId
          ? { ...prev, status: 'expired' }
          : prev
      ));
    };

    syncExpiredCheckoutState();

    return () => {
      cancelled = true;
    };
  }, [checkoutSucceeded, checkoutTransaction, timeLeft, setCheckoutTransaction]);

  useEffect(() => {
    let cancelled = false;

    const loadPendingPixHint = async () => {
      if (!showBottomSheet || !bottomSheetData?.id || !user.id) {
        setPendingBottomSheetPix(null);
        setPendingBottomSheetPixLoading(false);
        return;
      }

      setPendingBottomSheetPixLoading(true);
      const pendingPix = await SupabaseService.fetchPendingPixTransaction(user.id, bottomSheetData.id);

      if (!cancelled) {
        setPendingBottomSheetPix(pendingPix);
        setPendingBottomSheetPixLoading(false);
      }
    };

    loadPendingPixHint();

    return () => {
      cancelled = true;
    };
  }, [showBottomSheet, bottomSheetData?.id, user.id]);

  useEffect(() => {
    let cancelled = false;

    const loadLatestPixHistory = async () => {
      if (!user.id) {
        setLatestPixByGroup({});
        return;
      }

      const latestHistory = await SupabaseService.fetchLatestPixTransactionsByGroup(user.id);
      if (!cancelled) {
        setLatestPixByGroup(latestHistory);
      }
    };

    loadLatestPixHistory();

    return () => {
      cancelled = true;
    };
  }, [user.id, checkoutTransaction?.status, paidPoolIds, poolsList.length]);

  useEffect(() => {
    let cancelled = false;

    const loadFinancialSummary = async () => {
      if (!user.id) {
        setWalletSummary({ balance: 0 });
        setPixChargeHistory([]);
        setWalletLoading(false);
        return;
      }

      setWalletLoading(true);
      await SupabaseService.reclaimUnusedPoolEntries(user.id);
      const [wallet, charges] = await Promise.all([
        SupabaseService.fetchBettorWallet(user.id),
        SupabaseService.fetchRecentPixCharges(user.id, poolsList)
      ]);

      if (!cancelled) {
        setWalletSummary(wallet);
        setPixChargeHistory(charges);
        setWalletLoading(false);
      }
    };

    loadFinancialSummary();

    return () => {
      cancelled = true;
    };
  }, [user.id, checkoutTransaction?.status, poolsList, paidPoolIds]);

  // Handle score change under Palpites tab for bolao tradicional.
  // O salvamento real acontece apenas ao finalizar a aposta.
  const handleScoreChange = (matchId: string, side: 'a' | 'b', value: string) => {
    if (isActivePoolBettingClosed || isCurrentBetFinalized) return;
    const val = value === '' ? null : parseInt(value);
    if (val !== null && (val < 0 || isNaN(val))) return;

    // Update currentNewPick first
    setCurrentNewPick(prev => {
      const currentPick = prev[matchId] || {
        matchId,
        groupId: activePool?.id || '',
        betId: currentBetId,
        scoreA: null,
        scoreB: null,
        saved: false
      };

      const nextScoreA = side === 'a' ? val : currentPick.scoreA;
      const nextScoreB = side === 'b' ? val : currentPick.scoreB;

      return {
        ...prev,
        [matchId]: {
          ...currentPick,
          scoreA: nextScoreA,
          scoreB: nextScoreB,
          saved: false
        }
      };
    });
  };

  // Controla se o pódio foi bloqueado (confirmado) pelo usuário
  const [podiumLocked, setPodiumLocked] = useState<Record<string, boolean>>({});

  // Controle do salvamento da aposta de Pódio (Finalização explícita)
  const [isPodiumFinalizing, setIsPodiumFinalizing] = useState(false);
  const [isTraditionalBetFinalizing, setIsTraditionalBetFinalizing] = useState(false);

  const handleFinalizePodiumBet = async () => {
    if (!activePool?.id || !user.id || !currentBetId) return;
    if (isActivePoolBettingClosed) {
      alert(`O prazo de apostas do bolão "${activePool?.name || ''}" encerrou em ${formatPoolDeadline(activePool, activePoolMatches)}.`);
      return;
    }

    setIsPodiumFinalizing(true);
    const hasAssignedEntry = await SupabaseService.ensurePoolEntryAssignedToBet(user.id, activePool.id, currentBetId);
    if (!hasAssignedEntry) {
      setIsPodiumFinalizing(false);
      alert('Voce precisa usar saldo da carteira ou comprar uma entrada antes de finalizar esta aposta.');
      return;
    }
    let successCount = 0;
    const finalizedAt = new Date().toISOString();

    const matchIds = activePodiumMatchIds.length > 0
      ? activePodiumMatchIds
      : DEFAULT_PODIUM_SLOTS.map((slot) => slot.matchId);

    for (const matchId of matchIds) {
      const pick = currentNewPick[matchId];
      if (pick && pick.scoreA !== null && activePool?.id && user.id) {
        const success = await SupabaseService.savePick(user.id, activePool.id, matchId, pick.scoreA, 0, currentBetId);
        if (success) {
          successCount++;
          // Atualiza userPicks localmente para marcar como salvo
          setUserPicks(prev => {
            const groupPicks = prev[activePool.id] || [];
            const newPick: UserPick = {
              matchId,
              groupId: activePool.id,
              betId: currentBetId,
              scoreA: pick.scoreA,
              scoreB: 0,
              saved: true,
              updatedAt: finalizedAt
            };
            const filteredGroupPicks = groupPicks.filter(p => !(p.matchId === matchId && p.betId === currentBetId));
            return {
              ...prev,
              [activePool.id]: [...filteredGroupPicks, newPick]
            };
          });
        }
      }
    }

    setIsPodiumFinalizing(false);
    
    if (successCount === matchIds.length) {
      // Force trigger state refresh
      setAutosaveToasts(prev => ({ ...prev, 'podium-finalized': true }));
      setTimeout(() => setAutosaveToasts(prev => ({ ...prev, 'podium-finalized': false })), 3000);
    } else {
      alert('Houve um erro ao tentar salvar uma ou mais seleções do pódio. Tente novamente.');
    }
  };

  const handlePodiumSelectChange = (matchId: string, teamCode: string) => {
    if (isActivePoolBettingClosed || isCurrentBetFinalized) return;
    // Se teamCode vazio = limpar seleção
    const idx = teamCode ? COPA_2026_TEAMS.findIndex(t => t.code === teamCode) : -1;

    // Update currentNewPick first
    setCurrentNewPick(prev => {
      const currentPick = prev[matchId] || {
        matchId,
        groupId: activePool?.id || '',
        betId: currentBetId,
        scoreA: null,
        scoreB: 0,
        saved: false
      };

      return {
        ...prev,
        [matchId]: {
          ...currentPick,
          scoreA: idx !== -1 ? idx : null,
          scoreB: 0,
          saved: false // Não salva automaticamente mais para bolões de PÓDIO
        }
      };
    });
    
    // Apenas salva localmente, O botão "Finalizar Aposta" fará o salvamento real
  };

  const handleFinalizeTraditionalBet = async () => {
    if (!activePool?.id || !user.id || requiredTraditionalPickCount === 0) return;
    if (isActivePoolBettingClosed) {
      alert(`O prazo de apostas do bolão "${activePool.name}" encerrou em ${formatPoolDeadline(activePool, activePoolMatches)}.`);
      return;
    }

    setIsTraditionalBetFinalizing(true);
    const hasAssignedEntry = await SupabaseService.ensurePoolEntryAssignedToBet(user.id, activePool.id, currentBetId);
    if (!hasAssignedEntry) {
      setIsTraditionalBetFinalizing(false);
      alert('Voce precisa usar saldo da carteira ou comprar uma entrada antes de finalizar esta aposta.');
      return;
    }
    let successCount = 0;
    const finalizedAt = new Date().toISOString();

    for (const match of editableTraditionalMatches) {
      const pick = currentNewPick[match.id];
      if (pick && pick.scoreA !== null && pick.scoreB !== null) {
        const success = await SupabaseService.savePick(
          user.id,
          activePool.id,
          match.id,
          pick.scoreA,
          pick.scoreB,
          currentBetId
        );

        if (success) {
          successCount++;
          setUserPicks((prev) => {
            const groupPicks = prev[activePool.id] || [];
            const newPick: UserPick = {
              matchId: match.id,
              groupId: activePool.id,
              betId: currentBetId,
              scoreA: pick.scoreA,
              scoreB: pick.scoreB,
              saved: true,
              updatedAt: finalizedAt
            };
            const filteredGroupPicks = groupPicks.filter(
              (savedPick) => !(savedPick.matchId === match.id && savedPick.betId === currentBetId)
            );

            return {
              ...prev,
              [activePool.id]: [...filteredGroupPicks, newPick]
            };
          });
        }
      }
    }

    setIsTraditionalBetFinalizing(false);

    if (successCount === editableTraditionalMatches.length) {
      setAutosaveToasts((prev) => ({ ...prev, 'traditional-finalized': true }));
      setTimeout(() => setAutosaveToasts((prev) => ({ ...prev, 'traditional-finalized': false })), 3000);
      alert('Aposta finalizada com sucesso! Seus palpites desta rodada foram salvos no bolão.');
    } else {
      alert('Houve um erro ao tentar salvar um ou mais palpites deste bolão. Tente novamente.');
    }
  };

  const handleCopyPix = () => {
    if (!checkoutTransaction) return;
    navigator.clipboard.writeText(checkoutTransaction.copiaECola);
    setCopiarTexto('Copiado!');
    setTimeout(() => {
      setCopiarTexto('Copiar Código Pix');
    }, 2000);
  };

  const formatCountdown = (seconds: number) => {
    const totalHours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${totalHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPixStatusLabel = (status?: RecoverablePixTransaction['status']) => {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'expired':
        return 'Expirado';
      case 'canceled':
        return 'Cancelado';
      case 'failed':
        return 'Falhou';
      case 'pending':
      default:
        return 'Pendente';
    }
  };

  const getPixStatusClasses = (status?: RecoverablePixTransaction['status']) => {
    switch (status) {
      case 'paid':
        return 'border-[#00e676]/25 bg-[#00e676]/10 text-[#75ff9e]';
      case 'expired':
      case 'canceled':
      case 'failed':
        return 'border-red-500/25 bg-red-500/10 text-red-300';
      case 'pending':
      default:
        return 'border-[#ffe16d]/25 bg-[#ffe16d]/10 text-[#ffe16d]';
    }
  };

  const getBottomSheetShortfall = () => {
    const fee = bottomSheetData?.fee ?? 0;
    return Math.max(0, fee - (walletSummary.balance || 0));
  };

  const getBottomSheetCtaLabel = () => {
    if (usingWalletEntry) return 'Usando saldo...';
    if ((walletSummary.balance || 0) >= (bottomSheetData?.fee ?? 0)) return 'Usar saldo ao finalizar aposta';
    if (pendingBottomSheetPix) return 'Reabrir Pix Pendente';
    if ((walletSummary.balance || 0) > 0) return `Gerar Pix de R$ ${formatCurrency(getBottomSheetShortfall())}`;
    return 'Fazer Pagamento via Pix';
  };

  const getCheckoutExpirationState = () => {
    if (!checkoutTransaction?.expiresAt) return false;
    if (checkoutTransaction.status === 'paid') return false;

    return new Date(checkoutTransaction.expiresAt).getTime() <= Date.now();
  };

  // Active / Historical picks for Lucas Silva
  const historicalPicks = [
    { teams: 'ESP 3 - 0 POR', date: 'Ontem', userPick: '3-0', score: '+100', won: true },
    { teams: 'ALE 1 - 2 ITA', date: '12 Nov 2025', userPick: '2-0', score: '0', won: false },
  ];

  const handleOpenRecentPick = () => {
    const allSavedPicks = Object.values(userPicks).flat() as UserPick[];
    const filledPickMatchIds = allSavedPicks
      .filter((pick) => pick.scoreA !== null || pick.scoreB !== null)
      .map((pick) => pick.matchId);

    const mostRecentPickedMatch = matchesList
      .filter((match) => filledPickMatchIds.includes(match.id))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

    const poolWithRecentPick = mostRecentPickedMatch
      ? poolsList.find((pool) => pool.selectedMatchIds?.includes(mostRecentPickedMatch.id))
      : undefined;

    const latestPaidPool = poolsList.find((pool) => pool.id && paidPoolIds[pool.id]);
    const fallbackPool = poolWithRecentPick || latestPaidPool || activePool || poolsList[0];

    if (fallbackPool?.id) {
      setSelectedPoolId(fallbackPool.id);
    }

    setShowBottomSheet(false);
    setActiveTab('palpites');
  };

  return (
    <div className="flex-1 flex flex-col w-full max-w-[650px] mx-auto relative pb-28">
      {/* Header Info Banner */}
      <div className="bg-surface border-b border-surface-variant px-4 py-3 sticky top-12 md:top-16 z-30 flex items-center justify-between shadow-sm">
        {/* User Badge */}
        <div className="flex items-center gap-3">
          <UserAvatar
            className="h-9 w-9"
            initialsClassName="text-[11px]"
            name={user.fullName}
            src={user.avatarUrl}
            title="Avatar do usuario"
          />
          <div>
            <div className="font-label-bold text-label-bold text-on-surface text-sm flex items-center gap-1">
              {user.fullName}
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e676]"></span>
            </div>
          </div>
        </div>

        {/* Carteira resumida na lobby */}
        <div className="text-right">
          <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Saldo Disponível</div>
          <div className="text-sm font-display-score font-bold text-[#75ff9e]">
            {walletLoading ? 'Carregando...' : `R$ ${formatCurrency(walletSummary.balance || 0)}`}
          </div>
        </div>
      </div>

      {/* Main Tab Render Grid */}
      <div className="px-4 py-4 flex-1">
        {/* --- Tab 1: Dashboard e Convites --- */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Bolões em destaque</span>
                </div>
                <button
                  onClick={handleOpenRecentPick}
                  className="px-4 py-2 bg-[#00e676] hover:bg-[#62ff96] text-[#00210b] rounded-lg text-[11px] font-bold uppercase tracking-wider"
                >
                  Abrir palpites
                </button>
              </div>

              <div
                className="overflow-hidden rounded-[28px]"
                onTouchEnd={(event) => handleSwipeEnd(
                  event,
                  poolSwipeStartRef,
                  () => goToPoolIndex(selectedPoolIndex + 1),
                  () => goToPoolIndex(selectedPoolIndex - 1)
                )}
                onTouchStart={(event) => handleSwipeStart(event, poolSwipeStartRef)}
                style={{ touchAction: 'pan-y' }}
              >
                <div
                  className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: `translateX(-${selectedPoolIndex * 100}%)` }}
                >
                  {activePoolsList.map((pool, index) => {
                    const isSelected = selectedPoolId === pool.id;
                    const estimatedPrizeValue = getPoolEstimatedPrizeValue(pool, tenantSettings);
                    const isDescriptionExpanded = expandedPoolDescriptionId === pool.id;
                    const latestPix = latestPixByGroup[pool.id];
                    const poolMatches = getPoolMatches(pool);
                    const poolHeroTeams = getPoolHeroTeams(poolMatches);
                    const heroSummary = poolHeroTeams.length > 0
                      ? poolHeroTeams.map((team) => team.displayName).join(' • ')
                      : 'Seleções definidas conforme a agenda deste bolão';
                    const isPoolClosed = (() => {
                      const deadlineTs = getPoolDeadlineTimestamp(pool, poolMatches);
                      return deadlineTs !== null && currentTimestamp >= deadlineTs;
                    })();

                    return (
                      <div key={pool.id} className="w-full shrink-0">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedPoolId(pool.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedPoolId(pool.id);
                            }
                          }}
                          className={`bg-surface-container rounded-2xl border text-left overflow-hidden transition-all duration-500 ${
                            isSelected
                              ? 'border-[#00e676]/45 shadow-[0_0_25px_rgba(0,230,118,0.12)]'
                              : 'border-outline-variant opacity-85'
                          }`}
                        >
                          <div className="relative h-40 overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,230,118,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(110,200,255,0.18),transparent_28%),linear-gradient(135deg,#10202a_0%,#091018_55%,#060b11_100%)]"></div>
                            <div className={`absolute inset-0 transition-transform duration-700 ${index === selectedPoolIndex ? 'scale-100' : 'scale-[1.02]'}`}>
                              <div className="absolute -top-10 right-6 h-24 w-24 rounded-full bg-white/10 blur-3xl"></div>
                              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/55 to-transparent"></div>
                            </div>
                            <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-2">
                                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#00e676]/35 bg-black/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#7fffb0] backdrop-blur-sm">
                                  <span className="w-2 h-2 rounded-full bg-[#00e676]"></span>
                                  {pool.modality === 'podium' ? 'Bolão pódio' : 'Bolão placar'}
                                </span>
                                <div>
                                  <h4 className="text-lg font-bold text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]">{pool.name}</h4>
                                  <p className="text-[11px] text-white/80 mt-1 max-w-[220px] line-clamp-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                                    {heroSummary}
                                  </p>
                                </div>
                              </div>
                              <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-widest backdrop-blur-sm font-bold ${
                                isPoolClosed
                                  ? 'border-red-400/30 bg-red-900/50 text-red-300'
                                  : 'border-[#00e676]/30 bg-[#00e676]/10 text-[#7fffb0]'
                              }`}>
                                {isPoolClosed ? 'Encerrado' : 'Ativo'}
                              </span>
                            </div>
                            {poolHeroTeams.length > 0 && (
                              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4">
                                <div className="flex -space-x-3">
                                  {poolHeroTeams.map((team, teamIndex) => (
                                    <div
                                      key={`${pool.id}-${team.displayCode}-${teamIndex}`}
                                      className="rounded-full bg-[#081018]/70 p-1 backdrop-blur-sm"
                                    >
                                      <TeamAvatar
                                        accent={team.accent}
                                        accentDark={team.accentDark}
                                        className="h-12 w-12"
                                        fallback={team.displayFlag || team.displayCode}
                                        fallbackClassName="text-[11px]"
                                        name={team.displayName}
                                        src={team.imageUrl}
                                        title={team.displayName}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="hidden max-w-[180px] rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-right backdrop-blur-sm sm:block">
                                  <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/55">Seleções</div>
                                  <div className="mt-1 text-xs font-semibold leading-tight text-white/88">
                                    {poolHeroTeams[0]?.displayName}
                                    {poolHeroTeams[1] ? ` x ${poolHeroTeams[1].displayName}` : ''}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="p-4 flex flex-col gap-4 bg-[linear-gradient(180deg,#111821_0%,#0b1118_100%)]">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-xl border border-[#1f2a37] bg-[#0f151d] p-3">
                                <div className="text-[10px] uppercase tracking-widest text-[#7f91a6] font-bold">Taxa de entrada</div>
                                <div className="text-lg font-display-score font-bold text-[#75ff9e] mt-1">R$ {formatCurrency(pool.entryFee)}</div>
                              </div>
                              <div className="rounded-xl border border-[#1f2a37] bg-[#0f151d] p-3">
                                <div className="text-[10px] uppercase tracking-widest text-[#7f91a6] font-bold">Premiação estimada</div>
                                <div className="text-lg font-display-score font-bold text-[#ffe16d] mt-1">R$ {formatCurrency(estimatedPrizeValue)}</div>
                              </div>
                            </div>

                            <div className={`rounded-xl border p-3 ${
                              isPoolClosed
                                ? 'border-red-500/20 bg-red-500/10'
                                : 'border-[#1f2a37] bg-[#0f151d]'
                            }`}>
                              <div className="text-[10px] uppercase tracking-widest font-bold text-[#7f91a6]">Prazo para apostar</div>
                              <div className={`text-sm font-bold mt-1 ${isPoolClosed ? 'text-red-300' : 'text-white'}`}>
                                {formatPoolDeadline(pool, poolMatches)}
                              </div>
                            </div>

                            {latestPix && (
                              <div className={`rounded-xl border p-3 ${getPixStatusClasses(latestPix.status)}`}>
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-[10px] uppercase tracking-widest font-bold opacity-80">Ultima cobranca Pix</div>
                                    <div className="text-sm font-bold mt-1">{getPixStatusLabel(latestPix.status)}</div>
                                  </div>
                                  <span className="font-mono text-xs">R$ {latestPix.amount.toFixed(2)}</span>
                                </div>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPoolDescriptionId((prev) => (prev === pool.id ? null : pool.id));
                              }}
                              className={`rounded-xl border p-3 text-left transition-colors ${
                                isDescriptionExpanded
                                  ? 'border-[#00e676]/25 bg-[#0d1620]'
                                  : 'border-[#1f2a37] bg-[#0b1017] hover:border-[#2c3b4c]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[10px] uppercase tracking-widest text-[#7f91a6] font-bold">
                                  Descrição / Regras especiais
                                </div>
                                <ChevronRight
                                  className={`w-4 h-4 text-[#75ff9e] transition-transform duration-300 ${
                                    isDescriptionExpanded ? 'rotate-90' : ''
                                  }`}
                                />
                              </div>
                              <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                                isDescriptionExpanded ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0'
                              }`}>
                                <div className="min-h-0 overflow-hidden">
                                  <p className="text-xs text-[#d5dde8] leading-relaxed whitespace-pre-line break-words">
                                    {pool.description || 'Bolão disponível para entrada rápida via Pix.'}
                                  </p>
                                </div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPoolCheckout(pool);
                              }}
                              disabled={isPoolClosed}
                              className="h-11 w-full rounded-xl bg-[#00e676] hover:bg-[#62ff96] text-[#00210b] font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isPoolClosed ? 'Prazo Encerrado' : 'Bolão de palpites'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activePoolsList.length > 1 && (
                <div className="flex items-center justify-center gap-2">
                  {activePoolsList.map((pool, index) => (
                    <button
                      key={`pool-dot-${pool.id}`}
                      type="button"
                      onClick={() => setSelectedPoolId(pool.id)}
                      aria-label={`Ir para o bolão ${pool.name}`}
                      className={`h-2.5 rounded-full transition-all ${
                        index === selectedPoolIndex
                          ? 'w-8 bg-[#00e676] border-[#00e676]'
                          : 'w-2.5 bg-white/18 border-white/10'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Verification Success Widget (if checkout occurred) */}
            {hasPaidInscricao && (
              <div className="bg-[#00e676]/10 border border-[#00e676]/30 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#00e676]/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-[#00e676]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-on-surface leading-tight text-sm">Acesso Liberado</h3>
                    <p className="text-[11px] text-on-surface-variant leading-none mt-0.5">Seu pagamento via Pix PagBank foi processado com sucesso!</p>
                  </div>
                </div>
                <button 
                  onClick={() => activePool?.id && onResetPoolAccess?.(activePool.id)}
                  className="text-xs text-on-surface-variant hover:text-error underline cursor-pointer"
                >
                  Simular Reset
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Agenda do dia</span>
                <h3 className="text-sm font-bold text-on-surface mt-1">Jogos correntes, próximos confrontos e o top 4 provisório</h3>
              </div>

              <div className="rounded-2xl border border-outline-variant/50 bg-[#081019] p-3 flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Filtrar por data</span>
                    <div className="relative">
                      <input
                        ref={agendaDateInputRef}
                        type="date"
                        value={agendaDateFilter}
                        onChange={(e) => setAgendaDateFilter(e.target.value)}
                        onClick={openAgendaDatePicker}
                        className="h-11 w-full rounded-xl border border-outline-variant bg-[#0b1017] px-3 pr-12 text-sm text-on-surface outline-none focus:border-[#00e676]/50 [color-scheme:dark]"
                      />
                      <button
                        type="button"
                        onClick={openAgendaDatePicker}
                        aria-label="Abrir calendário"
                        className="absolute inset-y-1.5 right-1.5 flex w-8 items-center justify-center rounded-lg border border-outline-variant/60 bg-surface-container-low text-on-surface-variant transition-colors hover:border-[#00e676]/50 hover:text-[#7fffb0]"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                    </div>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Buscar seleção</span>
                    <input
                      type="search"
                      list="agenda-team-options"
                      value={agendaTeamFilter}
                      onChange={(e) => setAgendaTeamFilter(e.target.value)}
                      placeholder="Ex.: Brasil, Argentina, México"
                      className="h-11 rounded-xl border border-outline-variant bg-[#0b1017] px-3 text-sm text-on-surface placeholder:text-on-surface-variant outline-none focus:border-[#00e676]/50"
                    />
                    <datalist id="agenda-team-options">
                      {agendaTeamOptions.map((teamName) => (
                        <option key={teamName} value={teamName} />
                      ))}
                    </datalist>
                  </label>
                </div>

                {(agendaDateFilter || agendaTeamFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAgendaDateFilter('');
                      setAgendaTeamFilter('');
                    }}
                    className="h-10 rounded-xl border border-outline-variant/60 bg-transparent px-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
                  >
                    Limpar filtros
                  </button>
                )}

                {agendaSlides.length > 0 ? (
                  <>
                    <div
                      className="overflow-hidden rounded-2xl"
                      onTouchEnd={(event) => handleSwipeEnd(
                        event,
                        agendaSwipeStartRef,
                        () => goToAgendaIndex(agendaSlideIndex + 1),
                        () => goToAgendaIndex(agendaSlideIndex - 1)
                      )}
                      onTouchStart={(event) => handleSwipeStart(event, agendaSwipeStartRef)}
                      style={{ touchAction: 'pan-y' }}
                    >
                      <div
                        className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        style={{ transform: `translateX(-${agendaSlideIndex * 100}%)` }}
                      >
                        {agendaSlides.map((slide) => {
                          if (slide.type === 'match') {
                            const { match } = slide;
                            const teamAData = getAgendaTeamDisplay(match.teamA, match.teamAFlag);
                            const teamBData = getAgendaTeamDisplay(match.teamB, match.teamBFlag);

                            return (
                              <div
                                key={slide.key}
                                className="w-full shrink-0 rounded-2xl border border-outline-variant bg-surface-container-low p-4 flex flex-col gap-4 min-h-[320px]"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                    match.status === 'live'
                                      ? 'bg-[#00e676]/10 text-[#75ff9e] border border-[#00e676]/30'
                                      : match.status === 'finished'
                                        ? 'bg-white/5 text-on-surface-variant border border-white/10'
                                        : 'bg-[#ffdb3c]/10 text-[#ffe16d] border border-[#ffdb3c]/20'
                                  }`}>
                                    <span className={`w-2 h-2 rounded-full ${
                                      match.status === 'live'
                                        ? 'bg-[#00e676] animate-pulse'
                                        : match.status === 'finished'
                                          ? 'bg-white/40'
                                          : 'bg-[#ffdb3c]'
                                    }`}></span>
                                    {match.status === 'live' ? 'Ao vivo' : match.status === 'finished' ? 'Encerrado' : 'Agendado'}
                                  </span>
                                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider text-right">{match.group}</span>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex flex-col items-center gap-2 w-[30%]">
                                    <TeamAvatar
                                      accent={teamAData.accent}
                                      accentDark={teamAData.accentDark}
                                      className="h-14 w-14"
                                      fallback={teamAData.displayFlag || teamAData.displayCode}
                                      name={teamAData.displayName}
                                      src={teamAData.imageUrl}
                                      title={teamAData.displayName}
                                    />
                                    <span className="text-sm font-bold text-on-surface text-center leading-tight">{teamAData.displayName}</span>
                                  </div>

                                  <div className="flex flex-col items-center gap-1.5 min-w-[112px]">
                                    <div className="text-2xl font-display-score font-bold text-on-surface">
                                      {match.scoreA ?? '-'} <span className="text-on-surface-variant px-1">×</span> {match.scoreB ?? '-'}
                                    </div>
                                    <span className="text-[11px] text-on-surface-variant text-center">{match.dateText}</span>
                                  </div>

                                  <div className="flex flex-col items-center gap-2 w-[30%]">
                                    <TeamAvatar
                                      accent={teamBData.accent}
                                      accentDark={teamBData.accentDark}
                                      className="h-14 w-14"
                                      fallback={teamBData.displayFlag || teamBData.displayCode}
                                      name={teamBData.displayName}
                                      src={teamBData.imageUrl}
                                      title={teamBData.displayName}
                                    />
                                    <span className="text-sm font-bold text-on-surface text-center leading-tight">{teamBData.displayName}</span>
                                  </div>
                                </div>

                                <div className="rounded-xl border border-outline-variant/40 bg-[#0b1017] px-3 py-3 text-[11px] text-on-surface-variant">
                                  {match.status === 'live'
                                    ? 'Partida em andamento com atualização destacada na Lobby.'
                                    : match.status === 'finished'
                                      ? 'Resultado consolidado para consulta rápida dos apostadores.'
                                      : 'Confronto programado para acompanhamento rápido na experiência mobile.'}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={slide.key}
                              className="w-full shrink-0 rounded-2xl border border-outline-variant bg-surface-container-low p-4 flex flex-col gap-4 min-h-[320px]"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">{lobbyTopTeamsLabel}</span>
                                  <h4 className="text-sm font-bold text-on-surface mt-1">Base para o card de campanha ao 3º lugar</h4>
                                </div>
                                <Trophy className="w-5 h-5 text-[#ffdb3c]" />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                {lobbyTopTeams.map((entry) => {
                                  const {
                                    displayFlag,
                                    displayName,
                                    displaySubtitle,
                                    displayCode,
                                    imageUrl,
                                    accent,
                                    accentDark
                                  } = getLobbyPodiumDisplay(entry);

                                  return (
                                    <div key={`${entry.slotKey}-${entry.position}`} className="rounded-xl border border-outline-variant/40 bg-[#0b1017] p-3 flex items-center gap-3 overflow-hidden">
                                      <TeamAvatar
                                        accent={accent}
                                        accentDark={accentDark}
                                        className="h-10 w-10 shrink-0"
                                        fallback={displayFlag || displayCode}
                                        fallbackClassName="text-xs tracking-[0.12em]"
                                        name={displayName}
                                        src={imageUrl}
                                        title={displayName}
                                      />
                                      <div className="min-w-0 overflow-hidden">
                                        <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{entry.position}º lugar</div>
                                        <div className="text-sm font-bold text-on-surface truncate">{displayName}</div>
                                        <div className="text-[11px] text-on-surface-variant truncate">{displaySubtitle}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="rounded-xl border border-[#ffdb3c]/20 bg-[#ffdb3c]/8 px-3 py-2 text-[11px] text-on-surface-variant">
                                Os 4 melhores times acima funcionam como prévia e depois serão substituídos pelos vencedores oficiais da campanha até o 3º lugar.
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {agendaSlides.length > 1 && (
                      <div className="flex items-center justify-center gap-2">
                        {agendaSlides.map((slide, index) => (
                          <button
                            key={`agenda-dot-${slide.key}`}
                            type="button"
                            onClick={() => setAgendaSlideIndex(index)}
                            aria-label={`Ir para item ${index + 1} da agenda`}
                            className={`h-2.5 rounded-full transition-all ${
                              index === agendaSlideIndex
                                ? 'w-8 bg-[#00e676] border-[#00e676]'
                                : 'w-2.5 bg-white/18 border-white/10'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
                    Nenhum confronto encontrado para os filtros informados. Ajuste a data ou o nome da seleção para continuar.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


        {/* --- Tab 2: Área de Palpites (Autosave Debounced 800ms) --- */}
        {activeTab === 'palpites' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Active Pool Switcher Widget (As requested by the user) */}
            <div className="bg-[#161b22] border border-outline-variant p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Filtro de Bolão Ativo</span>
                <span className="text-sm font-bold text-on-surface flex items-center gap-1.5 text-primary">
                  🏆 {activePool?.name || 'Bolão Geral'}
                  <span className="text-[9px] bg-primary/15 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono font-bold">
                    {activePool?.inviteCode || 'PADRÃO'}
                  </span>
                </span>
                <p className="text-[10px] text-on-surface-variant line-clamp-1 mt-0.5">
                  {activePool?.description}
                </p>
                <p className={`text-[10px] mt-1 font-semibold ${isActivePoolBettingClosed ? 'text-red-300' : 'text-[#75ff9e]'}`}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  Prazo: {formatPoolDeadline(activePool, activePoolMatches)}
                </p>
                {activePoolHeroTeams.length > 0 && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {activePoolHeroTeams.slice(0, 4).map((team, index) => (
                        <div key={`${team.displayCode}-${index}`} className="rounded-full bg-[#081018]/75 p-0.5">
                          <TeamAvatar
                            accent={team.accent}
                            accentDark={team.accentDark}
                            className="h-8 w-8"
                            fallback={team.displayFlag || team.displayCode}
                            fallbackClassName="text-[9px]"
                            name={team.displayName}
                            src={team.imageUrl}
                            title={team.displayName}
                          />
                        </div>
                      ))}
                    </div>
                    <span className="text-[10px] text-on-surface-variant leading-tight">
                      {activePoolHeroTeams.map((team) => team.displayName).join(' • ')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase text-on-surface-variant min-w-max">Escolher Bolão:</label>
                <select
                  value={selectedPoolId}
                  onChange={(e) => setSelectedPoolId(e.target.value)}
                  className="h-9 bg-[#090D14] border border-[#1f2937] text-xs font-semibold text-on-surface px-3 rounded-lg focus:outline-none cursor-pointer"
                >
                  {poolsList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.selectedMatchIds?.length || 0} jogos)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center mb-1 bg-surface-container-high p-3 rounded-lg border border-outline-variant">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00e676] pulse-green"></span>
                <span className="font-label-bold text-label-bold text-on-surface text-xs tracking-wider">RODADA DE JOGOS DO BOLÃO</span>
              </div>
              <div className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
                Mostrando {activePoolMatches.length} de {matchesList.length} jogos totais
              </div>
            </div>

            {/* Banner de pagamento — para pódio é apenas informativo, não bloqueia seleção */}
            {isActivePoolBettingClosed ? (
              <div className="border p-3.5 rounded-xl text-xs flex items-start gap-2.5 bg-red-500/10 border-red-500/20 text-red-300">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-0.5">Prazo de Apostas Encerrado</strong>
                  <span>
                    Este bolão fechou em {formatPoolDeadline(activePool, activePoolMatches)}. Novos pagamentos, novas apostas e finalizações foram bloqueados.
                  </span>
                </div>
              </div>
            ) : !canStartBetForActivePool ? (
              <div className={`border p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                activePool?.modality === 'podium'
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                  : 'bg-[#ffdb3c]/10 border-[#ffdb3c]/20 text-[#ffe16d]'
              }`}>
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-0.5">
                    {activePool?.modality === 'podium' ? 'Inscrição Pendente — Palpite Não Salvo' : 'Inscrição Pendente para este Bolão'}
                  </strong>
                  <span>
                    {activePool?.modality === 'podium'
                      ? `Você pode montar seu pódio agora. Para oficializar o palpite e concorrer à premiação estimada de R$ ${getPoolEstimatedPrizeValue(activePool, tenantSettings).toLocaleString('pt-BR')}, efetue o pagamento da taxa de entrada de R$ ${activePool?.entryFee?.toFixed(2) || '20,00'}.`
                      : (walletSummary.balance || 0) > 0
                        ? `Sua carteira possui R$ ${formatCurrency(walletSummary.balance || 0)}. Você pode usar esse valor para entrar no bolão "${activePool?.name || ''}" ou completar a diferença da taxa de R$ ${activePool?.entryFee?.toFixed(2) || '50,00'} com um novo Pix.`
                        : `Sua taxa de entrada para o bolão "${activePool?.name || ''}" de R$ ${activePool?.entryFee?.toFixed(2) || '50,00'} ainda não foi confirmada. Seus palpites serão liberados de forma 100% gratuita, sem nenhum custo por palpite enviado, assim que a taxa única for paga.`
                    }
                  </span>
                  {activePool && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handlePoolEntryAction({
                          id: activePool.id,
                          name: activePool.name,
                          creator: activePool.creator,
                          prize: getPoolEstimatedPrizeValue(activePool, tenantSettings),
                          fee: activePool.entryFee
                        }, {
                          closeBottomSheet: false,
                          nextTab: 'palpites'
                        })}
                        disabled={usingWalletEntry}
                        className="px-4 py-2 rounded-lg border border-current/30 bg-black/20 hover:bg-black/30 transition-colors font-bold text-[11px] uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {usingWalletEntry
                          ? 'Usando saldo...'
                          : (walletSummary.balance || 0) >= (activePool.entryFee || 0)
                            ? 'Usar saldo ao finalizar'
                            : (walletSummary.balance || 0) > 0
                              ? `Completar com Pix de R$ ${formatCurrency(Math.max(0, (activePool.entryFee || 0) - (walletSummary.balance || 0)))}`
                              : 'Pagar taxa de entrada'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : !hasPaidInscricao ? (
              <div className="bg-[#00e676]/10 border border-[#00e676]/25 p-3.5 rounded-xl text-xs flex items-start gap-2.5 text-[#00e676]">
                <Wallet className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-0.5">Saldo Global Disponível para este Bolão</strong>
                  <span>Seu saldo continua livre na carteira e só será consumido quando você finalizar a aposta neste bolão.</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#00e676]/10 border border-[#00e676]/25 p-3.5 rounded-xl text-xs flex items-start gap-2.5 text-[#00e676]">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-0.5">Entrada Liberada para este Bolão!</strong>
                  <span>Você já possui uma entrada disponível no bolão "{activePool?.name || ''}". Preencha suas escolhas para finalizar a aposta.</span>
                </div>
              </div>
            )}

            {/* Match list with dynamic input handles or Podium Picker */}
            {activePool?.modality === 'podium' ? (
              <div className="flex flex-col gap-4 bg-surface-container-low border border-outline-variant rounded-xl p-5">
                {isCurrentBetFinalized && (
                  <div className="bg-[#00e676]/10 border border-[#00e676]/30 rounded-xl p-4 flex items-center gap-3 text-[#00e676] animate-fadeIn">
                    <CheckCircle2 className="w-6 h-6 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">
                        {requiredPodiumPickCount === 1
                          ? '1 posição escolhida!'
                          : `${requiredPodiumPickCount} posições escolhidas!`}
                      </h4>
                      <p className="text-[11px] opacity-90 mt-0.5">Sua aposta foi finalizada com sucesso. Acesse a aba "Meus Palpites" para conferir.</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2 border-b border-[#1f2937] pb-3 mb-2">
                  <Trophy className="w-5 h-5 text-[#ffdb3c]" />
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">Monte seu Pódio da Copa 2026</h3>
                    <p className="text-[11px] text-on-surface-variant leading-none mt-0.5">
                      Selecione as posições finais disponíveis neste bolão. Cada acerto vale 25 pontos.
                    </p>
                  </div>
                </div>

                {(() => {
                  // Mapeia matchId -> codigo do time escolhido para cada posicao
                  const pickCodeByMatchId: Record<string, string | null> = {};
                  podiumSelectionSlots.forEach((lbl) => {
                    const pick = currentNewPick[lbl.matchId];
                    const idx = pick?.scoreA;
                    pickCodeByMatchId[lbl.matchId] = (idx !== null && idx !== undefined && !isNaN(idx) && COPA_2026_TEAMS[idx])
                      ? COPA_2026_TEAMS[idx].code
                      : null;
                  });

                  // Lista de todos os códigos já escolhidos (excluindo nulls)
                  const allPickedCodes = Object.values(pickCodeByMatchId).filter((c): c is string => c !== null);

                  return (
                    <div className="space-y-4">
                      {podiumSelectionSlots.map((lbl) => {
                        const matchId = lbl.matchId;
                        const isAutosaveShowing = autosaveToasts[matchId];
                        const currentPickCode = pickCodeByMatchId[matchId];

                        // Lista de times já escolhidos em OUTRAS posições (excluindo a posição atual)
                        const disabledForThisSlot = allPickedCodes.filter(c => c !== currentPickCode);

                        return (
                          <div
                            key={matchId}
                            className="flex flex-col gap-1.5 border p-3.5 rounded-lg relative transition-all bg-[#090D14] border-[#1f2937]"
                          >
                            <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block mb-1 flex items-center gap-1.5">
                              {lbl.title}
                            </label>

                            <SearchableTeamSelect
                              selectedTeamCode={currentPickCode || null}
                              onChange={(code) => handlePodiumSelectChange(matchId, code)}
                              disabledTeams={disabledForThisSlot}
                              placeholder={`Escolha o ${lbl.place}...`}
                              disabled={isActivePoolBettingClosed || isCurrentBetFinalized}
                            />
                          </div>
                        );
                      })}

                      {/* Botão de Finalizar Aposta do Pódio */}
                      {!isCurrentBetFinalized && allPickedCodes.length === podiumSelectionSlots.length && canStartBetForActivePool && !isActivePoolBettingClosed && (
                        <button
                          onClick={handleFinalizePodiumBet}
                          disabled={isPodiumFinalizing}
                          className="w-full mt-4 h-12 bg-[#00e676] hover:bg-[#62ff96] text-[#00210b] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,230,118,0.2)]"
                        >
                          {isPodiumFinalizing ? 'Finalizando...' : 'Finalizar Aposta'}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Podio Oficial Atual */}
                <div className="mt-3 p-4 bg-[#161B22] border border-[#1f2937] rounded-lg flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#ffdb3c] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 animate-pulse" /> {podiumIsPreview ? 'Pódio Oficial Atual (Prévia FIFA)' : 'Pódio Oficial Confirmado'}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${podiumIsPreview ? 'bg-red-500/10 text-red-400 border border-red-500/25 animate-pulse' : 'bg-[#00e676]/10 text-[#00e676] border border-[#00e676]/25'}`}>
                      {podiumIsPreview ? 'Prévia' : 'Oficial'}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    {podiumIsPreview
                      ? 'O ranking usa o pódio provisório salvo no banco para indicar quem está na frente no bolão até a definição oficial da Copa.'
                      : 'O ranking já considera o pódio oficial definitivo salvo no banco de dados.'}
                  </p>

                  <div className={`grid gap-2 mt-1 ${currentPodiumSnapshot.length <= 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
                    {currentPodiumSnapshot.map((entry) => {
                      const podiumTeamData = getLobbyPodiumDisplay(entry);

                      return (
                      <div key={`${entry.slotKey}-${entry.position}`} className="flex flex-col items-center bg-black/40 p-2 rounded border border-[#1f2937]/50">
                        <span className="text-[9px] text-[#ffdb3c] font-bold mb-1">{entry.position}º</span>
                        <TeamAvatar
                          accent={podiumTeamData.accent}
                          accentDark={podiumTeamData.accentDark}
                          className="h-10 w-10"
                          fallback={podiumTeamData.displayFlag || podiumTeamData.displayCode}
                          fallbackClassName="text-[10px]"
                          name={podiumTeamData.displayName}
                          src={podiumTeamData.imageUrl}
                          title={podiumTeamData.displayName}
                        />
                        <span className="text-[9px] font-bold text-white truncate w-full text-center mt-1">
                          {podiumTeamData.displayName}
                        </span>
                        <span className="text-[9px] text-on-surface-variant truncate w-full text-center mt-0.5">
                          {entry.positionLabel}
                        </span>
                      </div>
                    )})}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {isCurrentBetFinalized && (
                  <div className="bg-[#00e676]/10 border border-[#00e676]/30 rounded-xl p-4 flex items-center gap-3 text-[#00e676] animate-fadeIn">
                    <CheckCircle2 className="w-6 h-6 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">
                        {requiredTraditionalPickCount} placares finalizados!
                      </h4>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        Sua aposta desta rodada foi finalizada com sucesso. Para fazer uma nova, selecione o bolão novamente e realize um novo pagamento.
                      </p>
                    </div>
                  </div>
                )}

                {!isCurrentBetFinalized && requiredTraditionalPickCount > 0 && (
                  <div className="bg-[#161b22] border border-[#1f2937] rounded-xl p-3 flex items-center justify-between text-[11px]">
                    <span className="text-on-surface-variant font-semibold">Progresso da aposta desta rodada</span>
                    <span className="font-bold text-[#00e676]">
                      {filledTraditionalPickCount} de {requiredTraditionalPickCount} jogos preenchidos
                    </span>
                  </div>
                )}

                {activePoolMatches.map((match) => {
                  const pick = currentNewPick[match.id] || { matchId: match.id, groupId: activePool?.id || '', betId: currentBetId, scoreA: null, scoreB: null, saved: false };
                  const isExpired = match.status === 'finished' || isActivePoolBettingClosed;
                  const teamAData = getAgendaTeamDisplay(match.teamA, match.teamAFlag);
                  const teamBData = getAgendaTeamDisplay(match.teamB, match.teamBFlag);

                  return (
                    <div 
                      key={match.id} 
                      className={`bg-surface-container-low border border-outline-variant rounded-xl p-4 relative overflow-hidden transition-all duration-300 ${
                        isExpired ? 'opacity-60 grayscale-[10%]' : 'hover:border-surface-variant/80'
                      }`}
                    >
                      {!isExpired && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ffdb3c]"></div>
                      )}

                      <div className="flex justify-between items-center mb-3">
                        <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded text-[10px]">
                          {match.group} • {match.dateText}
                        </span>

                        {isExpired && (
                          <div className="flex items-center gap-1 text-on-surface-variant bg-[#1c2026] px-2 py-0.5 rounded text-[10px]">
                            <Lock className="w-3 h-3 text-on-surface-variant" />
                            <span>{match.status === 'finished' ? 'Partida Encerrada' : 'Prazo do Bolão Encerrado'}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between py-1 relative">
                        <div className="flex flex-col items-center gap-2 w-1/3">
                          <TeamAvatar
                            accent={teamAData.accent}
                            accentDark={teamAData.accentDark}
                            className="h-11 w-11"
                            fallback={teamAData.displayFlag || teamAData.displayCode}
                            fallbackClassName="text-[10px]"
                            name={teamAData.displayName}
                            src={teamAData.imageUrl}
                            title={teamAData.displayName}
                          />
                          <span className="font-bold text-on-surface text-xs text-center leading-tight">{teamAData.displayName}</span>
                        </div>

                        <div className="flex items-center gap-2 w-1/3 justify-center relative">
                          {isExpired ? (
                            <div className="score-input flex items-center justify-center font-display-score rounded-lg text-lg text-on-surface-variant bg-surface-container font-extrabold font-mono border border-surface-variant">
                              {match.scoreA}
                            </div>
                          ) : (
                            <input 
                              type="number"
                              aria-label={`Gols ${teamAData.displayName}`}
                              value={pick.scoreA !== null ? pick.scoreA : ''}
                              onChange={(e) => handleScoreChange(match.id, 'a', e.target.value)}
                              placeholder="-"
                              disabled={!canStartBetForActivePool || isCurrentBetFinalized || isActivePoolBettingClosed}
                              title={isActivePoolBettingClosed ? 'Prazo de apostas encerrado para este bolão' : !canStartBetForActivePool ? "Efetue a inscrição via Pix para liberar palpites" : ""}
                              className="score-input font-display-score text-xl font-extrabold rounded-lg w-14 h-14 text-center bg-[#090C10] border border-[#1F2937] text-on-surface focus:border-[#00E676] focus:ring-1 focus:ring-[#00e676] outline-none transition-all placeholder:text-[#232a35] disabled:cursor-not-allowed"
                            />
                          )}

                          <span className="font-bold text-on-surface-variant text-lg select-none px-1">×</span>

                          {isExpired ? (
                            <div className="score-input flex items-center justify-center font-display-score rounded-lg text-lg text-on-surface-variant bg-surface-container font-extrabold font-mono border border-surface-variant">
                              {match.scoreB}
                            </div>
                          ) : (
                            <input 
                              type="number"
                              aria-label={`Gols ${teamBData.displayName}`}
                              value={pick.scoreB !== null ? pick.scoreB : ''}
                              onChange={(e) => handleScoreChange(match.id, 'b', e.target.value)}
                              placeholder="-"
                              disabled={!canStartBetForActivePool || isCurrentBetFinalized || isActivePoolBettingClosed}
                              title={isActivePoolBettingClosed ? 'Prazo de apostas encerrado para este bolão' : !canStartBetForActivePool ? "Efetue a inscrição via Pix para liberar palpites" : ""}
                              className="score-input font-display-score text-xl font-extrabold rounded-lg w-14 h-14 text-center bg-[#090C10] border border-[#1F2937] text-on-surface focus:border-[#00E676] focus:ring-1 focus:ring-[#00e676] outline-none transition-all placeholder:text-[#232a35]"
                            />
                          )}

                          {!canStartBetForActivePool && !isExpired && !isActivePoolBettingClosed && (
                            <div className="absolute inset-x-0 -bottom-8 flex justify-center z-15">
                              <span onClick={() => { setInviteCode('COPA26'); setBottomSheetData({ name: 'Copa Master COPA26', creator: 'Emiliano Organizador', prize: 15000, fee: 50.00 }); setShowBottomSheet(true); }} className="text-[9px] bg-secondary-container/20 border border-secondary-container/30 text-[#ffe16d] px-2 py-0.5 rounded cursor-pointer animate-pulse font-bold tracking-wider uppercase">Pendente Pix</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-center gap-2 w-1/3">
                          <TeamAvatar
                            accent={teamBData.accent}
                            accentDark={teamBData.accentDark}
                            className="h-11 w-11"
                            fallback={teamBData.displayFlag || teamBData.displayCode}
                            fallbackClassName="text-[10px]"
                            name={teamBData.displayName}
                            src={teamBData.imageUrl}
                            title={teamBData.displayName}
                          />
                          <span className="font-bold text-on-surface text-xs text-center leading-tight">{teamBData.displayName}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#1F2937] flex justify-between items-center text-[11px] text-on-surface-variant">
                        <span>{match.status === 'finished' ? 'Fim de Jogo' : isActivePoolBettingClosed ? 'Bolão Encerrado' : 'Arrecadação Ativa'}</span>
                        {isExpired ? (
                          <span className="text-[#00e676] font-bold">Acertou placar! +25 pontos</span>
                        ) : (
                          <button className="text-[#00e676] font-bold hover:underline">H2H Estatísticas</button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!isCurrentBetFinalized && filledTraditionalPickCount === requiredTraditionalPickCount && requiredTraditionalPickCount > 0 && canStartBetForActivePool && !isActivePoolBettingClosed && (
                  <button
                    onClick={handleFinalizeTraditionalBet}
                    disabled={isTraditionalBetFinalizing}
                    className="w-full h-12 bg-[#00e676] hover:bg-[#62ff96] text-[#00210b] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,230,118,0.2)]"
                  >
                    {isTraditionalBetFinalizing ? 'Finalizando...' : 'Finalizar Aposta'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- Tab 3: Meus Palpites (Histórico) --- */}
        {activeTab === 'meus-palpites' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <div className="flex flex-col gap-3 bg-[#161b22] border border-outline-variant p-4 rounded-2xl">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-[#ffe16d]" />
                <div>
                  <h3 className="font-bold text-sm text-on-surface">Meus Palpites</h3>
                  <p className="text-[11px] text-on-surface-variant">Histórico de todos os seus palpites já realizados.</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('palpites')}
                className="w-full h-10 bg-primary-container hover:bg-[#62ff96] text-[#00210b] font-bold uppercase rounded-lg flex items-center justify-center text-xs tracking-wide transition-all active:scale-[0.98] cursor-pointer"
              >
                Novo Palpite
              </button>
            </div>

            {/* Lista de palpites organizados por bolão */}
            {(() => {
              // Verificar se há palpites
              const hasPicks = Object.keys(userPicks).some(groupId => {
                const picks = userPicks[groupId];
                return picks && picks.length > 0;
              });

              if (!hasPicks) {
                return (
                  <div className="text-center text-xs text-on-surface-variant py-8 bg-surface-container rounded-xl border border-outline-variant">
                    Você ainda não tem nenhum palpite salvo.
                  </div>
                );
              }

              // Agrupar palpites por bolão e depois por betId
              return Object.entries(userPicks).map(([groupId, rawPoolPicks]) => {
                const pool = poolsList.find((item) => item.id === groupId);
                const poolPicks = ((rawPoolPicks as UserPick[]) || []).filter((pick) => pick.saved);
                if (poolPicks.length === 0) return null;

                // Agrupar picks por betId
                const picksByBetId: Record<string, UserPick[]> = {};
                poolPicks.forEach(pick => {
                  const bId = pick.betId || 'legacy'; // Agrupa picks antigos sem betId no grupo 'legacy'
                  if (!picksByBetId[bId]) picksByBetId[bId] = [];
                  picksByBetId[bId].push(pick);
                });

                return (
                  <div key={groupId} className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-[#1f2937] pb-3 mb-1">
                      <div>
                        <h4 className="font-bold text-sm text-on-surface">{pool?.name || 'Bolão salvo no histórico'}</h4>
                        <p className="text-[11px] text-on-surface-variant">{Object.keys(picksByBetId).length} {Object.keys(picksByBetId).length === 1 ? 'aposta realizada' : 'apostas realizadas'}</p>
                      </div>
                      {pool?.inviteCode && (
                        <span className="text-[10px] bg-primary/15 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono font-bold">
                          {pool.inviteCode}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-4">
                      {Object.entries(picksByBetId)
                        .sort(([, picksA], [, picksB]) => getTimestampValue(getBetFinalizedAt(picksA)) - getTimestampValue(getBetFinalizedAt(picksB)))
                        .map(([betId, picksForBet], index) => {
                          const finalizedAt = getBetFinalizedAt(picksForBet);

                          return (
                        <div key={betId} className="bg-[#090D14] border border-[#1f2937] rounded-xl overflow-hidden">
                          <div className="bg-[#161b22] px-3 py-2 border-b border-[#1f2937] flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-on-surface">Aposta {index + 1}</span>
                              <span className="text-[10px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                {formatBetFinalizedAt(finalizedAt)}
                              </span>
                            </div>
                            <span className="text-[10px] text-on-surface-variant flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-[#00e676]" />
                              Finalizada
                            </span>
                          </div>
                          
                          <div className="flex flex-col divide-y divide-[#1f2937]">
                            {picksForBet.map(pick => {
                              const match = matchesList.find(m => m.id === pick.matchId);
                              const podiumSlot = getPodiumSlotByMatchId(pick.matchId);
                              const isPodiumPool = pool?.modality === 'podium' || !!podiumSlot;
                              if (!match && !isPodiumPool) return null;
                              
                              return (
                                <div key={pick.matchId || pick.id || index} className="p-3 flex flex-col gap-2">
                                  {isPodiumPool ? (
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider">
                                        {(match?.group || podiumSlot?.title || 'Pódio')}:
                                      </span>
                                      {pick.scoreA !== null && COPA_2026_TEAMS[pick.scoreA] ? (
                                        <span className="min-w-0 text-sm font-bold text-on-surface flex items-center gap-2">
                                          <TeamAvatar
                                            accent={getTeamAccentColors(COPA_2026_TEAMS[pick.scoreA].code)[0]}
                                            accentDark={getTeamAccentColors(COPA_2026_TEAMS[pick.scoreA].code)[1]}
                                            className="h-8 w-8 shrink-0"
                                            fallback={COPA_2026_TEAMS[pick.scoreA].flag || COPA_2026_TEAMS[pick.scoreA].code}
                                            fallbackClassName="text-[9px]"
                                            name={COPA_2026_TEAMS[pick.scoreA].name}
                                            src={getOfficialTeamFlagUrl(COPA_2026_TEAMS[pick.scoreA].code)}
                                            title={COPA_2026_TEAMS[pick.scoreA].name}
                                          />
                                          <span className="truncate">{COPA_2026_TEAMS[pick.scoreA].name}</span>
                                        </span>
                                      ) : (
                                        <span className="text-xs text-on-surface-variant">—</span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] text-on-surface-variant uppercase tracking-wider">{match?.group} • {match?.dateText}</span>
                                      <div className="flex items-center justify-between gap-2">
                                        {(() => {
                                          const teamAData = match ? getAgendaTeamDisplay(match.teamA, match.teamAFlag) : null;
                                          const teamBData = match ? getAgendaTeamDisplay(match.teamB, match.teamBFlag) : null;

                                          return (
                                            <>
                                        <div className="flex items-center gap-2 flex-1">
                                          {teamAData && (
                                            <TeamAvatar
                                              accent={teamAData.accent}
                                              accentDark={teamAData.accentDark}
                                              className="h-8 w-8 shrink-0"
                                              fallback={teamAData.displayFlag || teamAData.displayCode}
                                              fallbackClassName="text-[9px]"
                                              name={teamAData.displayName}
                                              src={teamAData.imageUrl}
                                              title={teamAData.displayName}
                                            />
                                          )}
                                          <span className="text-xs font-bold text-on-surface leading-tight">{teamAData?.displayName || match?.teamA}</span>
                                          <span className="font-display-score text-lg text-[#75ff9e] font-bold">
                                            {pick.scoreA ?? '-'}
                                          </span>
                                        </div>
                                        <span className="text-xs text-on-surface-variant">×</span>
                                        <div className="flex items-center gap-2 flex-1 justify-end">
                                          <span className="font-display-score text-lg text-[#75ff9e] font-bold">
                                            {pick.scoreB ?? '-'}
                                          </span>
                                          <span className="text-xs font-bold text-on-surface text-right leading-tight">{teamBData?.displayName || match?.teamB}</span>
                                          {teamBData && (
                                            <TeamAvatar
                                              accent={teamBData.accent}
                                              accentDark={teamBData.accentDark}
                                              className="h-8 w-8 shrink-0"
                                              fallback={teamBData.displayFlag || teamBData.displayCode}
                                              fallbackClassName="text-[9px]"
                                              name={teamBData.displayName}
                                              src={teamBData.imageUrl}
                                              title={teamBData.displayName}
                                            />
                                          )}
                                        </div>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                          );
                        })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* --- Tab 3: Tabela de Rankings ao Vivo --- */}
        {activeTab === 'ranking' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Header */}
            <div className="bg-[#1c2026] p-4 rounded-xl border border-outline-variant">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error-container/20 border border-error/30 text-error font-label-sm text-label-sm uppercase tracking-wider text-[9px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-error relative animate-pulse"></span>
                Ao Vivo
              </span>
              <h3 className="font-bold text-on-surface text-sm mt-1.5">Bolões Criados</h3>
            </div>

            {/* Abas ATIVOS / FINALIZADOS */}
            <div className="flex gap-2 bg-[#0d1117] p-1 rounded-xl border border-outline-variant">
              {(['ativos', 'finalizados'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRankingTab(tab)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    rankingTab === tab
                      ? 'bg-primary-container text-[#00210b]'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab === 'ativos' ? '⚡ Ativos' : '🏁 Finalizados'}
                </button>
              ))}
            </div>

            {(() => {
              // Determinar se um bolão está finalizado:
              // finalizedAt definido manualmente OU 3h após o bettingDeadline
              const isPoolFinalized = (pool: typeof poolsList[0]) => {
                if (pool.finalizedAt) return true;
                if (!pool.bettingDeadline) return false;
                return Date.now() >= new Date(pool.bettingDeadline).getTime() + 3 * 60 * 60 * 1000;
              };

              const filteredPools = poolsList.filter((pool) =>
                rankingTab === 'ativos' ? !isPoolFinalized(pool) : isPoolFinalized(pool)
              );

              if (filteredPools.length === 0) {
                return (
                  <div className="bg-[#0d1117] border border-[#1f2937] p-6 rounded-xl text-sm text-on-surface-variant text-center">
                    {rankingTab === 'ativos'
                      ? 'Nenhum bolão ativo no momento.'
                      : 'Nenhum bolão finalizado ainda.'}
                  </div>
                );
              }

              return filteredPools.map((pool) => {
                const participants = rankingParticipantsByPool[pool.id] || [];
                const isLoading = !!rankingLoadingByPool[pool.id];
                const isExpanded = expandedRankingPoolIds.includes(pool.id);
                const currentUserEntry = participants.find((player) => player.isCurrentUser) || null;
                const probableWinners = participants.filter((player) => player.prizeZone);

                // Ranking oficial: finalizado manualmente ou +3h após deadline
                const isOfficialRanking = pool.finalizedAt
                  ? true
                  : pool.modality === 'podium'
                    ? !isPodiumStillProvisional(
                        getPoolPodiumMatchIds(pool)
                          .map((matchId) => getPodiumEntryForPoolMatch(matchId, matchesList, tournamentPodium))
                          .filter(Boolean) as TournamentPodiumEntry[]
                      )
                    : pool.bettingDeadline
                      ? Date.now() >= new Date(pool.bettingDeadline).getTime() + 3 * 60 * 60 * 1000
                      : false;

                // Top 3 sempre visíveis; restante controlado por expandedRankingPoolIds
                const top3 = participants.slice(0, 3);
                const rest = participants.slice(3);
                const showAll = isExpanded;

                return (
                  <div key={pool.id} className="rounded-2xl border border-outline-variant bg-[#181c22] overflow-hidden">
                    {/* Card Header */}
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-sm font-bold text-on-surface truncate">{pool.name}</span>
                          <span className="px-2 py-0.5 rounded-full border border-white/10 text-[10px] uppercase text-on-surface-variant shrink-0">
                            {pool.modality === 'podium' ? 'Bolão Pódio' : 'Bolão Placar'}
                          </span>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase shrink-0 ${
                          isOfficialRanking
                            ? 'bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30'
                            : 'bg-[#ffe16d]/10 text-[#ffe16d] border border-[#ffe16d]/30'
                        }`}>
                          {isOfficialRanking ? '✓ Oficial' : '⏱ Parcial'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
                        <span>
                          Sua posição: <strong className="text-white">{currentUserEntry ? `${currentUserEntry.rank}º` : '--'}</strong>
                        </span>
                        <span>
                          Seus pontos: <strong className="text-white">{currentUserEntry ? `${currentUserEntry.points} pts` : '0 pts'}</strong>
                        </span>
                        <span>
                          Apostadores: <strong className="text-white">{participants.length}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Ranking table - sempre visível */}
                    <div className="border-t border-outline-variant px-4 py-3 flex flex-col gap-3">
                      {isLoading ? (
                        <div className="bg-[#0d1117] border border-[#1f2937] p-3 rounded-xl text-xs text-on-surface-variant text-center animate-pulse">
                          Carregando ranking...
                        </div>
                      ) : participants.length === 0 ? (
                        <div className="bg-[#0d1117] border border-[#1f2937] p-3 rounded-xl text-xs text-on-surface-variant text-center">
                          Nenhum apostador pontuou neste bolão ainda.
                        </div>
                      ) : (
                        <>
                          {/* Prováveis premiados */}
                          {probableWinners.length > 0 && (
                            <div className="bg-[#00e676]/10 border border-[#00e676]/35 p-3 rounded-xl flex items-center justify-between text-xs text-[#00e676] gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base shrink-0">🏆</span>
                                <span className="truncate">
                                  <strong>{isOfficialRanking ? 'Premiados:' : 'Prováveis premiados:'}</strong>{' '}
                                  {probableWinners.map((player) => player.name).join(', ')}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Tabela de ranking */}
                          <div className="bg-[#181c22] rounded-xl border border-outline-variant overflow-hidden">
                            <div className="grid grid-cols-[40px_1fr_80px_68px] items-center px-3 py-2 border-b border-outline-variant bg-surface-container text-on-surface-variant uppercase tracking-wider text-[10px] font-bold">
                              <div className="text-center">Pos</div>
                              <div>Apostador</div>
                              <div className="text-center">Status</div>
                              <div className="text-right">Pts</div>
                            </div>

                            <div className="divide-y divide-outline-variant/30">
                              {/* TOP 3 — sempre visíveis */}
                              {top3.map((player) => {
                                const isUserCurrent = player.isCurrentUser;
                                const medalEmoji = player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : '🥉';
                                return (
                                  <div
                                    key={`${pool.id}-top-${player.rank}-${player.name}`}
                                    className={`grid grid-cols-[40px_1fr_80px_68px] items-center px-3 py-2.5 transition-colors ${
                                      isUserCurrent
                                        ? 'bg-[#1F2937] border-l-4 border-l-[#00e676]'
                                        : 'hover:bg-surface-variant/20'
                                    }`}
                                  >
                                    <div className="text-center text-base leading-none">{medalEmoji}</div>
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                      <UserAvatar
                                        className="h-6 w-6 shrink-0"
                                        initialsClassName="text-[8px] tracking-[0.12em]"
                                        name={player.name}
                                        src={player.avatar}
                                        title={player.name}
                                      />
                                      <span className={`text-xs font-medium truncate ${isUserCurrent ? 'text-primary font-bold' : 'text-on-surface'}`}>
                                        {player.name} {isUserCurrent && '(Você)'}
                                      </span>
                                    </div>
                                    <div className="text-center">
                                      <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                        player.prizeZone
                                          ? 'bg-[#00e676]/10 text-[#00e676] border border-[#00e676]/30'
                                          : 'bg-white/5 text-on-surface-variant border border-white/10'
                                      }`}>
                                        {player.prizeLabel || 'Em disputa'}
                                      </span>
                                    </div>
                                    <div className={`text-right font-display-score text-sm font-extrabold ${player.prizeZone ? 'text-[#00e676]' : 'text-on-surface'}`}>
                                      {player.points} pts
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Demais apostadores — visíveis apenas ao expandir */}
                              {showAll && rest.map((player) => {
                                const isUserCurrent = player.isCurrentUser;
                                return (
                                  <div
                                    key={`${pool.id}-rest-${player.rank}-${player.name}`}
                                    className={`grid grid-cols-[40px_1fr_80px_68px] items-center px-3 py-2.5 transition-colors ${
                                      isUserCurrent
                                        ? 'bg-[#1F2937] border-l-4 border-l-[#00e676]'
                                        : 'hover:bg-surface-variant/20'
                                    }`}
                                  >
                                    <div className={`text-center font-display-score text-sm font-extrabold ${player.prizeZone ? 'text-[#ffdb3c]' : 'text-on-surface-variant'}`}>
                                      {player.rank}º
                                    </div>
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                      <UserAvatar
                                        className="h-6 w-6 shrink-0"
                                        initialsClassName="text-[8px] tracking-[0.12em]"
                                        name={player.name}
                                        src={player.avatar}
                                        title={player.name}
                                      />
                                      <span className={`text-xs font-medium truncate ${isUserCurrent ? 'text-primary font-bold' : 'text-on-surface'}`}>
                                        {player.name} {isUserCurrent && '(Você)'}
                                      </span>
                                    </div>
                                    <div className="text-center">
                                      <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                        player.prizeZone
                                          ? 'bg-[#00e676]/10 text-[#00e676] border border-[#00e676]/30'
                                          : 'bg-white/5 text-on-surface-variant border border-white/10'
                                      }`}>
                                        {player.prizeLabel || 'Em disputa'}
                                      </span>
                                    </div>
                                    <div className={`text-right font-display-score text-sm font-extrabold ${player.prizeZone ? 'text-[#00e676]' : 'text-on-surface'}`}>
                                      {player.points} pts
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Botão Ver todos / Recolher */}
                          {rest.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRankingPoolIds((prev) =>
                                  prev.includes(pool.id)
                                    ? prev.filter((id) => id !== pool.id)
                                    : [...prev, pool.id]
                                )
                              }
                              className="w-full py-2 text-[11px] font-bold text-on-surface-variant hover:text-on-surface border border-outline-variant/50 rounded-lg hover:border-outline-variant transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              {showAll ? (
                                <>
                                  <ChevronRight className="w-3.5 h-3.5 -rotate-90" />
                                  Recolher ranking
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                                  Ver todos os {participants.length} apostadores
                                </>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}


        {/* --- Tab 4: Alertas e Notificações --- */}
        {activeTab === 'alerts' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Filter Pills list */}
            <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none">
              {(['Tudo', 'Partidas', 'Ranking', 'Sistema'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setAlertFilter(filter)}
                  className={`px-4 py-2 rounded-full font-label-bold text-label-bold text-xs whitespace-nowrap transition-transform active:scale-95 cursor-pointer ${
                    alertFilter === filter
                      ? 'bg-primary-container text-[#00210b] font-bold outline-none'
                      : 'bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {filter}
                </button>
              ))}
              <button 
                onClick={() => {
                  setAlertsList(prev => prev.map(a => ({ ...a, unread: false })));
                }}
                className="ml-auto text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                Lidas
              </button>
            </div>

            {/* List */}
            <div className="flex flex-col gap-2">
              {alertsList
                .filter(alert => alertFilter === 'Tudo' || alert.type === alertFilter)
                .map((item) => (
                  <div 
                    key={item.id}
                    className={`relative bg-surface-container rounded-xl p-4 border border-outline-variant overflow-hidden cursor-pointer hover:bg-surface-container-high active:scale-[0.99] transition-transform ${
                      item.unread ? 'border-l-4 border-l-[#00e676]' : 'opacity-85'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        item.type === 'Partidas' 
                          ? 'bg-primary-container/10 text-primary-container' 
                          : item.type === 'Ranking' 
                            ? 'bg-[#ffe16d]/10 text-[#ffe16d]' 
                            : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        <Trophy className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-body-sm text-body-sm text-on-surface-variant font-semibold">{item.title}</span>
                          <span className="text-[10px] text-on-surface-variant">{item.timeText}</span>
                        </div>
                        <p className="font-body-lg text-body-lg text-on-surface leading-tight text-xs">
                          {item.message}
                        </p>
                      </div>

                      {/* Unread circle badge */}
                      {item.unread && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#00e676] shrink-0 mt-2"></div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}


        {/* --- Tab 5: Perfil / Histórico do Lucas Silva --- */}
        {activeTab === 'perfil' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Header Profiling Details */}
            <div className="flex flex-col items-center justify-center text-center space-y-3 bg-[#181c22] p-6 rounded-2xl border border-outline-variant">
              <UserAvatar
                className="h-20 w-20 border-[#00e676]/50"
                initialsClassName="text-xl tracking-[0.16em]"
                name={user.fullName}
                src={user.avatarUrl}
                title="Perfil do usuario"
              />
              <div>
                <h2 className="text-xl font-bold tracking-tight text-on-surface">{user.fullName}</h2>
                <p className="text-xs text-on-surface-variant">Membro VIP • Inscrito em Copa 2026</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-[#0b1017] px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:border-red-400/40 hover:text-red-300"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>

            {/* Simulated performance Bento grid - exactly specified under 'Perfil' */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#1c2026] border border-outline-variant p-4 rounded-xl text-center">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block mb-1">Pontos</span>
                <span className="text-xl text-[#00e676] font-display-score font-bold">1.250</span>
              </div>
              <div className="bg-[#1c2026] border border-outline-variant p-4 rounded-xl text-center">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block mb-1">Ranking</span>
                <span className="text-xl text-[#ffe16d] font-display-score font-bold">#42</span>
              </div>
              <div className="bg-[#1c2026] border border-outline-variant p-4 rounded-xl text-center">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block mb-1">Precisão</span>
                <span className="text-xl text-on-surface font-display-score font-bold">68%</span>
              </div>
              <div className="bg-[#1c2026] border border-outline-variant p-4 rounded-xl text-center col-span-2 lg:col-span-1">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block mb-1">Forma (Últimos 5)</span>
                <div className="flex gap-1.5 justify-center mt-1">
                  {(['V', 'V', 'E', 'D', 'V'] as const).map((form, idx) => (
                    <span 
                      key={idx}
                      className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        form === 'V' 
                          ? 'bg-[#00e676]/20 text-[#00e676]' 
                          : form === 'E' 
                            ? 'bg-surface-variant text-on-surface' 
                            : 'bg-error-container/20 text-error'
                      }`}
                    >
                      {form}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Historical list from mock dataset */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-on-surface-variant border-b border-outline-variant/30 pb-2">Histórico de Conquistas</h3>
              <div className="flex flex-col gap-2">
                {historicalPicks.map((pick, i) => (
                  <div key={i} className="bg-surface-container rounded-xl p-3 border border-outline-variant flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-on-surface-variant block">{pick.date}</span>
                      <span className="font-bold text-on-surface text-xs font-mono">{pick.teams}</span>
                      <span className="text-xs text-on-surface-variant block mt-0.5">Seu Palpite: {pick.userPick}</span>
                    </div>

                    <div className="text-right">
                      <span className={`text-md font-bold block ${pick.won ? 'text-[#00e676]' : 'text-on-surface-variant'}`}>{pick.score}</span>
                      <span className="text-[9px] text-on-surface-variant uppercase tracking-wider">Pontos obtidos</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Carteira do apostador</div>
                  <div className="text-lg font-bold text-[#00e676] mt-1">
                    {walletLoading ? 'Carregando...' : `R$ ${formatCurrency(walletSummary.balance)}`}
                  </div>
                </div>
                <div className="text-right text-[10px] text-on-surface-variant max-w-[180px]">
                  Pix pagos entram primeiro na carteira e o saldo pode ser reutilizado antes de entrar em um bolão.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-sm text-on-surface-variant border-b border-outline-variant/30 pb-2">Minhas cobranças Pix</h3>
              <div className="flex flex-col gap-2">
                {pixChargeHistory.length === 0 ? (
                  <div className="bg-surface-container rounded-xl p-3 border border-outline-variant text-xs text-on-surface-variant">
                    Você ainda não possui cobranças Pix registradas.
                  </div>
                ) : (
                  pixChargeHistory.map((charge) => (
                    <div key={charge.transactionId} className="bg-surface-container rounded-xl p-3 border border-outline-variant flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-on-surface-variant block">
                          {charge.groupName || 'Bolão sem identificação'} • {new Date(charge.createdAt || charge.expiresAt).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="font-bold text-on-surface text-xs font-mono">R$ {formatCurrency(charge.amount)}</span>
                        <span className="text-xs text-on-surface-variant block mt-0.5">
                          Expira em {new Date(charge.expiresAt).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <div className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border ${getPixStatusClasses(charge.status)}`}>
                        {getPixStatusLabel(charge.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dados do pagador (CPF e telefone) — salvos no perfil para uso no PagBank */}
            <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Dados do pagador (PagBank)</span>
              </div>
              <div>
                <label className="block text-[10px] text-on-surface-variant mb-1 uppercase tracking-wide">CPF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={profileCpf}
                  onChange={(e) => setProfileCpf(formatCpfLocal(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full h-10 bg-[#161B22] border border-outline-variant rounded-lg px-3 text-sm text-on-surface focus:outline-none focus:border-[#00e676] font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-on-surface-variant mb-1 uppercase tracking-wide">Telefone (com DDD)</label>
                <input
                  type="text"
                  inputMode="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(formatPhoneLocal(e.target.value))}
                  placeholder="(91) 99999-9999"
                  className="w-full h-10 bg-[#161B22] border border-outline-variant rounded-lg px-3 text-sm text-on-surface focus:outline-none focus:border-[#00e676] font-mono"
                />
              </div>
              {profileSaved && (
                <div className="text-[11px] text-[#75ff9e] bg-[#75ff9e]/10 border border-[#75ff9e]/20 rounded px-2 py-1.5">
                  Dados salvos com sucesso.
                </div>
              )}
              <button
                onClick={handleSaveProfilePaymentData}
                className="h-10 bg-primary-container hover:bg-[#62ff96] text-[#00210b] font-bold uppercase rounded-lg flex items-center justify-center text-xs tracking-wide transition-all active:scale-[0.98] cursor-pointer"
              >
                Salvar dados do pagador
              </button>
              <p className="text-[10px] text-on-surface-variant leading-snug">
                Necessários para emissão da cobrança Pix. Não são compartilhados com terceiros além do PagBank.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'times' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <div className="flex justify-between items-center bg-[#1c2026] p-4 rounded-xl border border-outline-variant">
              <div>
                <h3 className="font-bold text-on-surface text-sm">Seleções Oficiais (Copa 2026)</h3>
                <p className="text-[11px] text-on-surface-variant font-medium">As 48 seleções divididas nos 12 grupos do torneio.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)).map(g => {
                const groupName = `Grupo ${g}`;
                const groupTeams = COPA_2026_TEAMS.filter(t => t.group === groupName);

                return (
                  <div key={groupName} className="bg-[#161B22] border border-[#1f2937] p-3 rounded-xl flex flex-col gap-2">
                    <h4 className="font-bold text-xs text-[#00E676] border-b border-[#1f2937] pb-1 uppercase">
                      {groupName}
                    </h4>
                    <div className="flex flex-col gap-1">
                      {groupTeams.map(t => (
                        <div key={t.code} className="flex items-center justify-between text-[11px] py-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm select-none">{t.flag}</span>
                            <span className="text-on-surface font-medium">{t.name}</span>
                          </div>
                          <span className="font-mono text-[10px] text-on-surface-variant bg-[#090D14] px-1 py-0.2 rounded">
                            {t.code}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* --- Checkout Pix PagBank Popover Modal: A3 --- */}
      {checkoutTransaction && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant rounded-xl w-full max-w-md relative overflow-hidden shadow-2xl p-6 flex flex-col items-center">
            {(() => {
              const isExpiredCheckout = !checkoutSucceeded && (
                checkoutTransaction.status === 'expired'
                || checkoutTransaction.status === 'canceled'
                || checkoutTransaction.status === 'failed'
                || getCheckoutExpirationState()
              );
              return (
                <>
            
            {/* Top Close */}
            <button 
              onClick={() => setCheckoutTransaction(null)}
              className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              Fechar ×
            </button>

            {/* Succeeded screen state: inside Checkout A3 */}
            {checkoutSucceeded ? (
              <div className="w-full flex flex-col items-center text-center py-6 animate-fadeIn bg-surface-container rounded-xl">
                <div className="w-16 h-16 bg-[#00e676] rounded-full flex items-center justify-center mb-4 transition-transform duration-500 shadow-[0_0_20px_rgba(0,230,118,0.4)]">
                  <Check className="w-8 h-8 text-[#00210b]" />
                </div>
                <h3 className="font-headline-md text-headline-md text-[#00e676] mb-1 font-bold">Pagamento Confirmado!</h3>
                <p className="text-xs text-on-surface-variant mb-6 max-w-xs">
                  O Pix de R$ {checkoutTransaction.amount.toFixed(2)} foi creditado na sua carteira e pode ser usado neste bolão ou em outro bolão elegível.
                </p>

                {/* Info summary */}
                <div className="w-full bg-[#181c22] p-4 rounded-xl border border-outline-variant text-[11px] text-left text-on-surface-variant space-y-2 mb-6">
                  <div className="flex justify-between">
                    <span>ID da Transação</span>
                    <span className="font-mono text-on-surface">{checkoutTransaction.transactionId || 'PENDENTE'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saldo creditado</span>
                    <span className="text-[#00e676]">R$ {checkoutTransaction.amount.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (checkoutTransaction.groupId) {
                      setSelectedPoolId(checkoutTransaction.groupId);
                    }
                    setCheckoutTransaction(null);
                    setShowBottomSheet(true);
                  }}
                  className="w-full h-11 bg-primary-container hover:bg-[#62ff96] text-[#00210b] font-label-bold text-label-bold uppercase rounded-lg cursor-pointer"
                >
                  Usar Saldo Neste Bolão
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center">
                {/* Header checkout */}
                <div className="text-center mb-6 w-full">
                  <h2 className="text-xl font-bold text-on-surface">{isExpiredCheckout ? 'Pix Expirado' : 'Checkout Pix PagBank'}</h2>
                  <div className={`flex items-center justify-center gap-1.5 font-label-sm text-label-sm mt-1 ${isExpiredCheckout ? 'text-error' : 'text-on-surface-variant animate-pulse'}`}>
                    <span className={`w-2 h-2 rounded-full ${isExpiredCheckout ? 'bg-error' : 'bg-[#00e676]'}`}></span>
                    <span>{isExpiredCheckout ? 'A cobrança expirou e precisa ser gerada novamente.' : 'Aguardando confirmação do pagamento...'}</span>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-center mb-4">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Taxa de Inscrição</span>
                  <div className="font-display-score text-3xl font-extrabold text-[#75ff9e] mt-0.5">R$ {checkoutTransaction.amount.toFixed(2)}</div>
                </div>

                {/* Timer: exactly formatted inside checkout A3 */}
                <div className="bg-surface-container-high rounded-full px-4 py-1.5 flex items-center gap-2 mb-6 border border-outline-variant text-xs text-on-surface">
                  <Clock className={`w-3.5 h-3.5 ${isExpiredCheckout ? 'text-error' : 'text-[#00e676]'}`} />
                  <span className="font-mono font-bold">
                    {isExpiredCheckout ? 'Expirado' : formatCountdown(timeLeft)}
                  </span>
                </div>

                {/* QR Code Container */}
                <div className="bg-white p-3 rounded-lg mb-6 shadow-inner">
                  <img 
                    alt="QR Code Pix" 
                    className="w-44 h-44 object-contain" 
                    src={checkoutTransaction.qrcode}
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Copy Action: exactly defined in A3 */}
                <button 
                  onClick={handleCopyPix}
                  disabled={isExpiredCheckout}
                  className="w-full h-12 bg-primary-container hover:bg-[#62ff96] text-[#00210b] font-label-bold text-label-bold rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-95 cursor-pointer font-bold"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiarTexto}</span>
                </button>

                <p className="text-[11px] text-on-surface-variant text-center mt-3 leading-relaxed">
                  Abra o aplicativo tributário do seu banco, escolha a opção "Pix Copia e Cola" ou aponte a câmera para o QR Code acima.
                </p>
                <div className="mt-4 p-2 bg-[#75ff9e]/10 rounded border border-[#75ff9e]/20 text-[10px] text-[#75ff9e] text-center w-full leading-normal">
                  Se você fechar esta tela, ao tocar novamente em "Fazer Pagamento via Pix" o sistema tentará recuperar esta mesma cobrança enquanto ela estiver válida.
                </div>
                {isExpiredCheckout && (
                  <div className="mt-3 p-2 bg-error/10 rounded border border-error/20 text-[10px] text-error text-center w-full leading-normal">
                    Este Pix expirou. Feche esta janela e gere uma nova cobrança para continuar.
                  </div>
                )}
              </div>
            )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* --- Invitation Bottom Sheet Drawer: A2 --- */}
      {showBottomSheet && bottomSheetData && (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-end justify-center">
          <div className="bg-[#161B22] border-t border-outline-variant rounded-t-2xl w-full max-w-lg p-5 flex flex-col gap-4 animate-[slideUp_0.25s_ease-out] relative">
            {(() => {
              const pendingPixTimeLeft = pendingBottomSheetPix?.expiresAt
                ? Math.max(0, Math.floor((new Date(pendingBottomSheetPix.expiresAt).getTime() - Date.now()) / 1000))
                : 0;

              return (
                <>
            
            {/* Top Indicator handle bar */}
            <div className="w-12 h-1.5 bg-surface-variant rounded-full mx-auto mb-2"></div>
            
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-[#00e676]/20 border border-[#00e676]/30 text-[#00e676] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest leading-none">Bolão Identificado</span>
                <h3 className="text-xl font-bold text-on-surface mt-2">{bottomSheetData.name}</h3>
                <p className="text-xs text-on-surface-variant">Criado por: {bottomSheetData.creator}</p>
              </div>
              <button 
                onClick={() => setShowBottomSheet(false)}
                className="text-on-surface-variant hover:text-on-surface text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Details breakdown */}
            <div className="bg-[#0D1117] border border-outline-variant rounded-xl p-4 divide-y divide-outline-variant/30 text-xs">
              <div className="flex justify-between py-2">
                <span className="text-on-surface-variant">Premiação Estimada</span>
                <span className="font-bold text-[#ffe16d]">R$ {bottomSheetData.prize.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-on-surface-variant">Taxa de Inscrição Única (Pix)</span>
                <span className="font-bold text-[#00e676]">R$ {bottomSheetData.fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 bg-[#00e676]/10 px-2 rounded mt-1">
                <span className="text-[#ffe16d] font-bold">Custo por Palpite Realizado</span>
                <span className="font-bold text-[#00e676] uppercase">Grátis (R$ 0,00)</span>
              </div>
            </div>

            <div className="bg-[#0D1117] border border-outline-variant rounded-xl p-4 flex flex-col gap-2 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-on-surface-variant uppercase tracking-widest font-bold text-[10px]">Carteira disponível</span>
                <span className="font-bold text-[#00e676]">
                  {walletLoading ? 'Carregando...' : `R$ ${formatCurrency(walletSummary.balance)}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Valor faltante para este bolão</span>
                <span className="font-mono text-on-surface">R$ {formatCurrency(getBottomSheetShortfall())}</span>
              </div>
            </div>

            {pendingBottomSheetPixLoading && (
              <div className="bg-[#0D1117] border border-outline-variant rounded-xl p-3 text-[11px] text-on-surface-variant text-center">
                Verificando se existe um Pix pendente para este bolão...
              </div>
            )}

            {pendingBottomSheetPix && !pendingBottomSheetPixLoading && (
              <div className="bg-[#75ff9e]/10 border border-[#75ff9e]/25 rounded-xl p-4 flex flex-col gap-2 text-[11px]">
                <div className="flex items-center gap-2 text-[#75ff9e] uppercase tracking-widest font-bold text-[10px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pix pendente encontrado</span>
                </div>
                <p className="text-on-surface-variant leading-relaxed">
                  Encontramos uma cobranca Pix ainda ativa para este bolão. Ao continuar, o sistema vai reabrir a mesma cobranca em vez de gerar outra.
                </p>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Valor pendente</span>
                  <span className="font-bold text-[#75ff9e]">R$ {pendingBottomSheetPix.amount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Validade restante</span>
                  <span className="font-mono text-on-surface">{formatCountdown(pendingPixTimeLeft)}</span>
                </div>
              </div>
            )}

            {!pendingBottomSheetPix && !pendingBottomSheetPixLoading && bottomSheetData.id && latestPixByGroup[bottomSheetData.id] && (
              <div className={`rounded-xl border p-4 flex flex-col gap-2 text-[11px] ${getPixStatusClasses(latestPixByGroup[bottomSheetData.id].status)}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="uppercase tracking-widest font-bold text-[10px] opacity-80">Ultima cobranca Pix</div>
                  <span className="font-mono">R$ {latestPixByGroup[bottomSheetData.id].amount.toFixed(2)}</span>
                </div>
                <p className="leading-relaxed">
                  Status atual da sua ultima tentativa de pagamento neste bolão: <strong>{getPixStatusLabel(latestPixByGroup[bottomSheetData.id].status)}</strong>.
                </p>
              </div>
            )}

            {/* Aviso de dados do pagador — agora lidos do Perfil (cadastro) */}
            {(() => {
              const cpfOk = (user.cpf || '').replace(/\D/g, '').length === 11;
              const phoneOk = (user.telefone || '').replace(/\D/g, '').length >= 10;
              if (cpfOk && phoneOk) {
                return (
                  <div className="bg-[#0D1117] border border-outline-variant rounded-xl p-4 flex flex-col gap-1.5 text-[11px] text-on-surface-variant">
                    <div className="flex items-center gap-2 text-[#75ff9e] uppercase tracking-widest font-bold text-[10px]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Dados do pagador</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CPF</span>
                      <span className="font-mono text-on-surface">{user.cpf}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Telefone</span>
                      <span className="font-mono text-on-surface">{user.telefone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>E-mail</span>
                      <span className="text-on-surface truncate ml-2">{user.email}</span>
                    </div>
                  </div>
                );
              }
              return (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-2 text-[11px] text-amber-200">
                  <div className="flex items-center gap-2 text-amber-300 uppercase tracking-widest font-bold text-[10px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Complete seu cadastro</span>
                  </div>
                  <p className="leading-snug">
                    Para pagar este bolão você precisa ter <strong>CPF</strong> e <strong>telefone</strong> cadastrados.
                    Clique no botão abaixo para abrir seu Perfil e completar.
                  </p>
                </div>
              );
            })()}

             {/* Bottom Join CTA */}
             <button
               onClick={handleConfirmPayment}
               disabled={usingWalletEntry || walletLoading}
               className="h-12 bg-primary-container hover:bg-[#62ff96] text-[#00210b] font-label-bold text-label-bold uppercase rounded-lg flex items-center justify-center font-bold tracking-wide transition-all active:scale-[0.98] cursor-pointer"
             >
              {getBottomSheetCtaLabel()}
            </button>
                </>
              );
            })()}
          </div>
        </div>
      )}


      {/* Main Persistent Bottom Navigation */}
      <nav className="bg-[#0a0e14]/95 backdrop-blur-xl border-t border-[#1f2937] fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 h-[72px] max-w-[650px] mx-auto">
        {([
          { id: 'dashboard', label: 'Lobby', icon: AppWindow, badge: false },
          { id: 'palpites', label: 'Palpites', icon: Star, badge: false },
          { id: 'meus-palpites', label: 'Meus Palpites', icon: Star, badge: false },
          { id: 'ranking', label: 'Classificação', icon: Trophy, badge: false },
          { id: 'alerts', label: 'Alertas', icon: Bell, badge: alertsList.some(a => a.unread) },
          { id: 'perfil', label: 'Perfil', icon: User, badge: false },
          { id: 'times', label: 'Times', icon: Users, badge: false },
        ] as Array<{ id: typeof activeTab; label: string; icon: React.ComponentType<{ className?: string }>; badge: boolean }>).map(({ id, label, icon: Icon, badge }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => { setActiveTab(id as typeof activeTab); setShowBottomSheet(false); }}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-[#00e676]'
                  : 'text-[#5a6a7e] hover:text-[#8ba0b5]'
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 rounded-xl bg-[#00e676]/20 border border-[#00e676]/40 animate-pulse" style={{ animationDuration: '2.5s' }} />
              )}
              <Icon className={`w-5 h-5 relative z-10 transition-all duration-200 ${
                isActive ? 'drop-shadow-[0_0_6px_rgba(0,230,118,0.6)]' : ''
              }`} />
              <span className={`font-label-sm text-[9px] relative z-10 font-bold tracking-wide transition-all duration-200 ${
                isActive ? 'text-[#00e676]' : 'text-[#5a6a7e]'
              }`}>{label}</span>
              {badge && (
                <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-500 z-20" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
