/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Trophy, Bell, Users, Coins, HelpCircle, Check, Settings, Play, ArrowUpRight, 
  ChevronRight, Sparkles, Smartphone, Clock, Calendar, CheckCircle2, CircleDollarSign, Send, ArrowRightLeft, Radio, Pencil, Trash2, X, Lock
} from 'lucide-react';
import { Match, TenantSettings, AlertNotification, Pool } from '../types';
import { getPoolEstimatedPrizeValue } from '../lib/poolPrize';
import { SupabaseService } from '../lib/supabaseService';
import { getOfficialTeamFlagUrl } from '../lib/teamFlagSource';
import { COPA_2026_TEAMS } from '../data/teams';
import { INITIAL_MATCHES } from '../data/mockData';
import SearchableTeamSelect from './SearchableTeamSelect';
import TeamAvatar from './TeamAvatar';
import { fetchLiveScores, mapApiStatusToDb } from '../lib/footballApi';


interface AdminDashboardProps {
  user: { fullName: string; email: string };
  matchesList: Match[];
  updateMatchList: (id: string, scoreA: number | null, scoreB: number | null) => void;
  updateMatchTeams?: (id: string, teamA: string, teamAFlag: string, teamB: string, teamBFlag: string) => Promise<boolean>;
  tenantSettings: TenantSettings;
  updateTenantSettings: (newSettings: TenantSettings) => void;
  onAlertDispatch: (type: 'Partidas' | 'Ranking' | 'Sistema', title: string, message: string) => void;
  poolsList: Pool[];
  onCreatePool: (newPool: Pool, explicitMatches?: Match[]) => Promise<void>;
  onUpdatePool: (updatedPool: Pool, explicitMatches?: Match[]) => Promise<void>;
  onDeletePool: (poolId: string) => void;
  onAddMatch: (newMatch: Match) => void;
}

const FLAG_MAP: Record<string, string> = {
  'BRA': 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7vNzeE8RsyKo8Fr3rL2PkL4AstJSLPk5MWkhnbl3_vaFgGY2W7ZdBkDFcG60VaUClxdeO7VlkAG7sW3Oeudi9UnoTjtfhV8suOhFHG0MJ8yQu7wpgSePrLv_RwXoCMzLm2JhHrAjVzRyCHIMxNP82eKEZVzXuGp71_CM6_7utJO38M1Nq2jr_gpR1Y6-J78ySQ1I7HNZ4jS4z7gqLZ-QjQuTjA8aQx1XpI7XPXcjw0Ka0mzLgp6Hcd845_Wbtr_t1XHE0zasSwZo',
  'FRA': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhVo1hDodGOp_am6i25Ouqv7M_OFbPrP5NJ1cpKT9k3gQ-FdE_6ghYfsJ3CVlpwD0kobx0MgoQmWocgZde_nmvarXBy7oDl18KCrgCrvxUuk8I4yYx8KtEAQ2c1nepnLvW0O6DiqcGfBYFfWLOQlN89wybYdl6himRuKg9JDuF8XNELWsH4k0jHAcv_j_ogeHmB9LYj-Rzx-t8weTLz2dVaZ5WHf_KtK3PdLAIGdPVAps_351AgXSwOwQjEJkuIon6hhh-l5lvPtU',
  'GER': 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9uobBIdm0Us_gggg5UIRCBsY5m7zVujvbCnorXj_m87hDbTeghIQjKSymCWkaKJ4mR0Xdw9x7Dny3FN8c68oKkAA_PKO8wFcgeW5HoveZ9LQBdRnQA5_5xr0WHnd0l1u_VYxDTYssYyDJF8yRFhnY5vAB_3VRIcfDxz7RPEkepvrD7lw0HuS_YIs1NGhNfesmmuVhi6WqI6F_THpJDvlhIW2WQfKTJHnnyWGueqk_EOIhq1t2p2Lw9ydvAvJZwcwNoZhmch1KBjg',
  'ARG': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJmuMinoNNpyjN50ez1KFsAdp2i3FrUB7M37Fcd5VcpHg2ZlsJgeLib_RJNRavc41tk47-tUYH7TEBycNql4P2VL2m5I_z1DlHT76N-gLgJhzyFErDiDg3669haGnKUKTUet9Qoos759vNQzy3EcFhmfixlzmOkRNm9l4AWc3KgiYaV1YcgwSV5N2Ci7vlKwfpiWsARrrqJcrdZUQkV9wcQAhvkBk25noRIPQwGP85sktmRYR_dYcaLAYhLRo3rqVcYEpMYUW0-vY',
  'MEX': 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9uobBIdm0Us_gggg5UIRCBsY5m7zVujvbCnorXj_m87hDbTeghIQjKSymCWkaKJ4mR0Xdw9x7Dny3FN8c68oKkAA_PKO8wFcgeW5HoveZ9LQBdRnQA5_5xr0WHnd0l1u_VYxDTYssYyDJF8yRFhnY5vAB_3VRIcfDxz7RPEkepvrD7lw0HuS_YIs1NGhNfesmmuVhi6WqI6F_THpJDvlhIW2WQfKTJHnnyWGueqk_EOIhq1t2p2Lw9ydvAvJZwcwNoZhmch1KBjg',
  'ENG': 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0IGlBhA7IyrVbDDUwyQZ1_MgldD0wHQs-xKgE71oPAd5K_a1Y2mRCnyC4MPeTHH2uz6vanIX2RyYcS0MDPNUuIaSONVfhYoX8b14CGezRQXoO-b2VWoPFT0XFtJLMJf7isx6KvQjsKGz_Mas8OKmWWgzZxveUfyLghlIC3Qtfa_iXd4uw5PNIntrY5gGDvLd48N9M0wKPWWzxOdl9TeBEz6V2igqdhp4iKbRC8RYacMIpmIWwNGT8s9RpVg_c0-gFojoDeLzGpSU',
  'ESP': 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7vNzeE8RsyKo8Fr3rL2PkL4AstJSLPk5MWkhnbl3_vaFgGY2W7ZdBkDFcG60VaUClxdeO7VlkAG7sW3Oeudi9UnoTjtfhV8suOhFHG0MJ8yQu7wpgSePrLv_RwXoCMzLm2JhHrAjVzRyCHIMxNP82eKEZVzXuGp71_CM6_7utJO38M1Nq2jr_gpR1Y6-J78ySQ1I7HNZ4jS4z7gqLZ-QjQuTjA8aQx1XpI7XPXcjw0Ka0mzLgp6Hcd845_Wbtr_t1XHE0zasSwZo'
};

function generateClientUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

type PodiumPositionId = 'champion' | 'vice' | 'third' | 'fourth';

const PODIUM_POSITION_OPTIONS: Array<{
  id: PodiumPositionId;
  place: string;
  desc: string;
  icon: string;
}> = [
  { id: 'champion', place: '1º Lugar', desc: 'Campeão', icon: '🏆' },
  { id: 'vice', place: '2º Lugar', desc: 'Vice-Campeão', icon: '🥈' },
  { id: 'third', place: '3º Lugar', desc: '3º Colocado', icon: '🥉' },
  { id: 'fourth', place: '4º Lugar', desc: '4º Colocado', icon: '🏅' }
];

const DEFAULT_PODIUM_POSITION_IDS = PODIUM_POSITION_OPTIONS.map((option) => option.id);

const DEFAULT_PODIUM_MATCH_IDS: Record<PodiumPositionId, string> = {
  champion: '00000000-0000-0000-0000-9999a0d11111',
  vice: '00000000-0000-0000-0000-9999a0d22222',
  third: '00000000-0000-0000-0000-9999a0d33333',
  fourth: '00000000-0000-0000-0000-9999a0d44444'
};

const TEMPORARY_FIFA_PODIUM_CODES: Record<PodiumPositionId, string> = {
  champion: 'ARG',
  vice: 'ESP',
  third: 'FRA',
  fourth: 'ENG'
};

function sortPodiumPositionIds(ids: PodiumPositionId[]): PodiumPositionId[] {
  return PODIUM_POSITION_OPTIONS
    .map((option) => option.id)
    .filter((id) => ids.includes(id));
}

function compareMatchesByStart(a: Pick<Match, 'startedAt'>, b: Pick<Match, 'startedAt'>) {
  return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
}

function getPodiumPositionId(match: Pick<Match, 'teamA' | 'teamB'>): PodiumPositionId | null {
  const matchKey = `${match.teamA}::${match.teamB}`;
  const option = PODIUM_POSITION_OPTIONS.find(
    (item) => `${item.place}::${item.desc}` === matchKey
  );

  return option?.id || null;
}

function isPodiumMatch(match: Pick<Match, 'group' | 'teamA' | 'teamB' | 'teamAFlag' | 'teamBFlag'>) {
  return match.group === 'PÓDIO'
    || getPodiumPositionId(match) !== null
    || ['🏆', '🥈', '🥉', '🏅'].includes(match.teamAFlag)
    || ['🏆', '🥈', '🥉', '🏅'].includes(match.teamBFlag);
}

function getTemporaryPodiumTeam(positionId: PodiumPositionId) {
  return COPA_2026_TEAMS.find((team) => team.code === TEMPORARY_FIFA_PODIUM_CODES[positionId]) || null;
}

function getTemporaryPodiumTeamIndex(positionId: PodiumPositionId) {
  return COPA_2026_TEAMS.findIndex((team) => team.code === TEMPORARY_FIFA_PODIUM_CODES[positionId]);
}

function createFallbackPodiumMatch(position: typeof PODIUM_POSITION_OPTIONS[number]): Match {
  return {
    id: DEFAULT_PODIUM_MATCH_IDS[position.id],
    group: 'PÓDIO',
    dateText: 'Pódio Final',
    teamA: position.place,
    teamB: position.desc,
    teamAFlag: position.icon,
    teamBFlag: position.icon,
    status: 'scheduled',
    scoreA: null,
    scoreB: null,
    startedAt: '2026-07-19T12:00:00.000Z'
  };
}

function normalizeTeamToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .toUpperCase();
}

function getTeamCodeFromMatchLabel(label: string) {
  const normalizedLabel = normalizeTeamToken(label);
  const team = COPA_2026_TEAMS.find((item) =>
    normalizeTeamToken(item.code) === normalizedLabel
    || normalizeTeamToken(item.name) === normalizedLabel
  );

  return team?.code || null;
}

function isImageSource(value?: string | null) {
  if (!value) return false;
  return /^(https?:\/\/|data:image\/|blob:|\/)/i.test(value.trim());
}

function getTeamPresentation(teamLabel: string, storedFlag?: string | null) {
  const teamCode = getTeamCodeFromMatchLabel(teamLabel);
  const team = COPA_2026_TEAMS.find((item) =>
    item.code === teamCode || normalizeTeamToken(item.name) === normalizeTeamToken(teamLabel)
  );

  const displayName = team?.name || teamLabel;
  const officialFlagUrl = teamCode ? getOfficialTeamFlagUrl(teamCode) : null;
  const mappedFlagUrl = teamCode ? FLAG_MAP[teamCode] : null;
  const displayImage = officialFlagUrl || (isImageSource(storedFlag) ? storedFlag || null : null) || mappedFlagUrl || null;
  const displayFallback = team?.flag
    || (!isImageSource(storedFlag) ? storedFlag || null : null)
    || teamCode
    || displayName.slice(0, 3).toUpperCase();

  return {
    code: teamCode,
    displayName,
    displayImage,
    displayFallback
  };
}

function matchIncludesSelectedTeams(match: Pick<Match, 'teamA' | 'teamB'>, selectedTeamCodes: string[]) {
  const teamACode = getTeamCodeFromMatchLabel(match.teamA);
  const teamBCode = getTeamCodeFromMatchLabel(match.teamB);

  return !!teamACode && selectedTeamCodes.includes(teamACode)
    || !!teamBCode && selectedTeamCodes.includes(teamBCode);
}

function deriveTeamCodesFromMatches(matches: Pick<Match, 'teamA' | 'teamB'>[]) {
  return Array.from(new Set(
    matches
      .flatMap((match) => [getTeamCodeFromMatchLabel(match.teamA), getTeamCodeFromMatchLabel(match.teamB)])
      .filter((code): code is string => code !== null)
  ));
}

function findOfficialTraditionalMatch(match: Pick<Match, 'teamA' | 'teamB' | 'startedAt'>) {
  return INITIAL_MATCHES.find((officialMatch) =>
    officialMatch.teamA === match.teamA
    && officialMatch.teamB === match.teamB
    && officialMatch.startedAt === match.startedAt
  );
}

function toDateTimeLocalValue(isoDate?: string) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function formatPoolDeadlineLabel(isoDate?: string) {
  if (!isoDate) return 'Sem prazo definido';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Prazo inválido';

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function AdminDashboard({
  user,
  matchesList,
  updateMatchList,
  updateMatchTeams,
  tenantSettings,
  updateTenantSettings,
  onAlertDispatch,
  poolsList,
  onCreatePool,
  onUpdatePool,
  onDeletePool,
  onAddMatch
}: AdminDashboardProps) {
  // Tabs for the Admin Workspace: 'kpis' | 'comissoes' | 'partidas' | 'notificacoes' | 'boloes' | 'times'
  const [activeAdminTab, setActiveAdminTab] = useState<'kpis' | 'comissoes' | 'partidas' | 'notificacoes' | 'boloes' | 'times'>('kpis');

  // Create Pool State
  const [poolName, setPoolName] = useState('');
  const [poolCode, setPoolCode] = useState('');
  const [poolFee, setPoolFee] = useState('50');
  const [poolDesc, setPoolDesc] = useState('');
  const [poolFeeType, setPoolFeeType] = useState<'percent' | 'fixed'>('percent');
  const [poolFeeValue, setPoolFeeValue] = useState<number>(20);
  const [poolMaxParticipants, setPoolMaxParticipants] = useState<number>(100);
  const [poolModality, setPoolModality] = useState<'score' | 'podium'>('score');
  const [poolPrizedPlaces, setPoolPrizedPlaces] = useState<number>(3);
  const [poolBettingDeadline, setPoolBettingDeadline] = useState('');
  const [selectedPodiumPositions, setSelectedPodiumPositions] = useState<PodiumPositionId[]>(DEFAULT_PODIUM_POSITION_IDS);
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);


  const [selectedTeamsForPool, setSelectedTeamsForPool] = useState<string[]>([]);
  const [selectedMatchIdsForPool, setSelectedMatchIdsForPool] = useState<string[]>([]);
  const [teamSearchText, setTeamSearchText] = useState('');
  const [teamGroupFilter, setTeamGroupFilter] = useState('Todos');

  // Insert Match State
  const [teamA, setTeamA] = useState('BRA');
  const [teamB, setTeamB] = useState('ARG');
  const [teamAFlag, setTeamAFlag] = useState('BRA');
  const [teamBFlag, setTeamBFlag] = useState('ARG');
  const [matchGroup, setMatchGroup] = useState('GRUPO A • COPA DO MUNDO');
  const [matchDateText, setMatchDateText] = useState('Amanhã, 16:00');

  // O2 - Commissions local slider/config state
  const [feeType, setFeeType] = useState<'percent' | 'fixed'>(tenantSettings.feeType);
  const [feeValue, setFeeValue] = useState<number>(tenantSettings.feeValue);
  const [entryFee, setEntryFee] = useState<number>(tenantSettings.entryFee);
  const [participantProjection, setParticipantProjection] = useState<number>(180); // Slider default

  // O3 - Score definition hold-to-confirm states
  const [selectedMatchForScore, setSelectedMatchForScore] = useState<Match | null>(null);
  const [scoreInputA, setScoreInputA] = useState<string>('0');
  const [scoreInputB, setScoreInputB] = useState<string>('0');

  const [selectedMatchForTeams, setSelectedMatchForTeams] = useState<Match | null>(null);
  const [teamInputA, setTeamInputA] = useState<string>('');
  const [teamInputB, setTeamInputB] = useState<string>('');
  
  // Hold-to-confirm state parameters
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100
  const isHolding = useRef(false);
  const holdIntervalRef = useRef<any>(null);

  // O4 - Notifications dispatch state
  const [notifCategory, setNotifCategory] = useState<'Partidas' | 'Ranking' | 'Sistema'>('Sistema');
  const [notifTitle, setNotifTitle] = useState('Gol do Brasil! 🇧🇷');
  const [notifMessage, setNotifMessage] = useState('Vini Jr abre o placar no Maracanã aos 12 minutos do primeiro tempo! O ranking geral do bolão está sendo reordenado.');
  const [notifDispatched, setNotifDispatched] = useState(false);

  // Tooltip simple display states
  const [showCommissionTooltip, setShowCommissionTooltip] = useState(false);
  const [isSyncingScores, setIsSyncingScores] = useState(false);

  const availableTraditionalMatches = useMemo(
    () => INITIAL_MATCHES.filter((match) => !isPodiumMatch(match)),
    []
  );
  const podiumMatches = useMemo(
    () => PODIUM_POSITION_OPTIONS.map((position) =>
      matchesList.find((match) => getPodiumPositionId(match) === position.id) || createFallbackPodiumMatch(position)
    ),
    [matchesList]
  );
  const manageableMatches = useMemo(
    () => matchesList
      .filter((match) => !isPodiumMatch(match) && match.group !== 'Grupo do Bolão')
      .sort(compareMatchesByStart),
    [matchesList]
  );

  // Calculations for O2 dynamic projection panel
  const totalArrecadadoProjection = participantProjection * entryFee;
  const comissaoBancaProjection = feeType === 'percent'
    ? totalArrecadadoProjection * (feeValue / 100)
    : participantProjection * feeValue;
  const netPremioProjection = totalArrecadadoProjection - comissaoBancaProjection;

  const firstPlaceAward = netPremioProjection * (tenantSettings.firstPlacePct / 100);
  const secondPlaceAward = netPremioProjection * (tenantSettings.secondPlacePct / 100);
  const thirdPlaceAward = netPremioProjection * (tenantSettings.thirdPlacePct / 100);

  const handleSyncScores = async () => {
    try {
      setIsSyncingScores(true);
      const liveData = await fetchLiveScores();
      let updatedCount = 0;

      for (const apiMatch of liveData) {
        const targetMatch = manageableMatches.find(m => {
          const codeA = getTeamCodeFromMatchLabel(m.teamA);
          const codeB = getTeamCodeFromMatchLabel(m.teamB);
          return (codeA === apiMatch.homeTeamTla && codeB === apiMatch.awayTeamTla) ||
                 (codeA === apiMatch.awayTeamTla && codeB === apiMatch.homeTeamTla);
        });

        if (targetMatch) {
          const dbStatus = mapApiStatusToDb(apiMatch.status);
          const isHomeA = getTeamCodeFromMatchLabel(targetMatch.teamA) === apiMatch.homeTeamTla;
          const newScoreA = isHomeA ? apiMatch.homeScore : apiMatch.awayScore;
          const newScoreB = isHomeA ? apiMatch.awayScore : apiMatch.homeScore;

          // Sincroniza se: o jogo está ao vivo, pausado ou finalizado
          // e o placar ou status mudou
          const hasScore = newScoreA !== null && newScoreB !== null;
          const scoreChanged = targetMatch.scoreA !== newScoreA || targetMatch.scoreB !== newScoreB;
          const statusChanged = targetMatch.status !== dbStatus;

          if (hasScore && (scoreChanged || statusChanged)) {
            updateMatchList(targetMatch.id, newScoreA as number, newScoreB as number);
            updatedCount++;
          }
        }
      }
      
      alert(updatedCount > 0 ? `${updatedCount} placares sincronizados com sucesso!` : 'Nenhuma alteração de placar encontrada no momento.');
    } catch (err: any) {
      alert('Falha ao sincronizar: ' + err.message);
    } finally {
      setIsSyncingScores(false);
    }
  };

  const resetPoolForm = () => {
    setEditingPoolId(null);
    setPoolName('');
    setPoolCode('');
    setPoolFee('50');
    setPoolDesc('');
    setSelectedTeamsForPool([]);
    setSelectedMatchIdsForPool([]);
    setPoolFeeType('percent');
    setPoolFeeValue(20);
    setPoolMaxParticipants(100);
    setPoolModality('score');
    setPoolPrizedPlaces(3);
    setPoolBettingDeadline('');
    setSelectedPodiumPositions(DEFAULT_PODIUM_POSITION_IDS);
    setTeamSearchText('');
    setTeamGroupFilter('Todos');
  };

  useEffect(() => {
    if (poolModality !== 'score') return;

    setSelectedMatchIdsForPool((prev) => {
      const next = prev.filter((id) => availableTraditionalMatches.some((match) => match.id === id));
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [poolModality, availableTraditionalMatches]);

  // Save commissions config change
  const handleSaveCommissions = () => {
    updateTenantSettings({
      ...tenantSettings,
      feeType,
      feeValue,
      entryFee
    });
    alert('Configurações de comissionamento atualizadas com sucesso no banco de dados!');
  };

  const handleGenerateRulesTemplate = () => {
    const isPodium = poolModality === 'podium';
    const modalityName = isPodium ? 'Bolão de Pódio da Copa do Mundo' : `Bolão tradicional${poolName ? ` do confronto ${poolName}` : ''}`;
    
    const commissionStr = poolFeeType === 'percent' ? `${poolFeeValue}%` : `R$ ${poolFeeValue.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    
    const prizedPlaces = poolPrizedPlaces;
    let prizeDistributionStr = '';
    if (prizedPlaces === 1) {
      prizeDistributionStr = 'para o 1º colocado';
    } else if (prizedPlaces === 2) {
      prizeDistributionStr = 'entre os 2 primeiros colocados do ranking, na proporção de 70% para o 1º lugar e 30% para o 2º lugar';
    } else {
      prizeDistributionStr = 'entre os 3 primeiros colocados do ranking, na proporção de 60% para o 1º lugar, 25% para o 2º lugar e 15% para o 3º lugar';
    }

    const prazoStr = poolBettingDeadline 
      ? ` Os palpites de placar poderão ser enviados somente até ${formatPoolDeadlineLabel(poolBettingDeadline)}.`
      : ' Os palpites de placar poderão ser enviados somente até o início da partida, na data oficial do jogo.';

    const pontuacaoStr = isPodium 
      ? 'A pontuação seguirá a regra oficial da modalidade: 25 pontos quando o apostador acerta exatamente a seleção na posição correta.'
      : 'A pontuação seguirá a regra oficial da modalidade: 25 pontos por acerto exato do placar, 10 pontos por acerto do resultado final com saldo de gols correto e 5 pontos por acerto apenas do resultado final.';

    const desempateStr = isPodium
      ? 'Em caso de empate, serão aplicados, nesta ordem, os critérios de desempate: maior número de acertos exatos, maior índice de aproveitamento e, por fim, o menor tempo de finalização da aposta no sistema, considerando data, hora, minuto e segundo.'
      : 'Em caso de empate, serão aplicados, nesta ordem, os critérios de desempate: maior número de placares exatos, maior número de acertos com saldo correto, maior número de acertos de resultado, maior índice de aproveitamento e, por fim, o menor tempo de finalização da aposta no sistema, considerando data, hora, minuto e segundo.';

    const template = `${modalityName}.${prazoStr} A premiação será formada pelo valor líquido arrecadado no bolão, após a dedução da comissão da banca de ${commissionStr}, e distribuída ${prizeDistributionStr}. ${pontuacaoStr} Cada aposta finalizada gera pontuação própria, e a classificação do participante considera a soma dos pontos obtidos em suas apostas dentro deste bolão. O ranking será oficializado após a finalização da partida. ${desempateStr} Caso nenhum participante do bolão pontue, a banca fará jus ao prêmio em sua totalidade.`;
    
    setPoolDesc(template);
  };

  // Hold-to-Confirm logic (1.5 seconds) - exactly required in O3
  const handleHoldStart = () => {
    if (!selectedMatchForScore) return;
    isHolding.current = true;
    setHoldProgress(0);
    
    // Interval runs every 30ms. Increment progress so 1500ms total is reached
    // 1500 / 30 = 50 steps. Increment by 2 per step.
    holdIntervalRef.current = setInterval(() => {
      setHoldProgress(prev => {
        if (prev >= 100) {
          clearInterval(holdIntervalRef.current);
          handleExecuteScoreConfirm();
          return 100;
        }
        return prev + 2;
      });
    }, 30);
  };

  const handleHoldEnd = () => {
    isHolding.current = false;
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
    setHoldProgress(prev => (prev < 100 ? 0 : 100)); // Reset if unfinished
  };

  const handleExecuteScoreConfirm = () => {
    if (!selectedMatchForScore) return;
    const finalA = parseInt(scoreInputA) || 0;
    const finalB = parseInt(scoreInputB) || 0;

    // Trigger update in main App component
    updateMatchList(selectedMatchForScore.id, finalA, finalB);

    // Dispatch global system alert to simulate ranking update
    const isPodium = selectedMatchForScore.group === 'PÓDIO';
    const teamName = isPodium && COPA_2026_TEAMS[finalA] ? COPA_2026_TEAMS[finalA].name : '';
    const flag = isPodium && COPA_2026_TEAMS[finalA] ? COPA_2026_TEAMS[finalA].flag : '';

    onAlertDispatch(
      'Partidas',
      isPodium ? 'Seleção do Pódio Definida' : 'Placar Oficial Definido',
      isPodium
        ? `O organizador confirmou que o ${selectedMatchForScore.teamA} (${selectedMatchForScore.teamB}) da Copa do Mundo 2026 é ${flag} ${teamName}!`
        : `O organizador confirmou o placar oficial de ${selectedMatchForScore.teamA} ${finalA} × ${finalB} ${selectedMatchForScore.teamB}. Os palpites e rankings foram recalculados!`
    );

    alert(isPodium ? 'Pódio Atualizado! A seleção foi definida com segurança.' : 'Classificação Atualizada! O placar foi homologado com segurança via transação Postgres.');
    setSelectedMatchForScore(null);
    setHoldProgress(0);
  };

  const handleAdminAddMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamA.trim() || !teamB.trim()) {
      alert('Por favor, envie o nome de ambos os times.');
      return;
    }
    const flagA = FLAG_MAP[teamA.toUpperCase().trim()] || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop';
    const flagB = FLAG_MAP[teamB.toUpperCase().trim()] || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop';

    const newMatch: Match = {
      id: `m-${Date.now()}`,
      group: matchGroup.toUpperCase(),
      dateText: matchDateText,
      teamA: teamA.toUpperCase().trim(),
      teamB: teamB.toUpperCase().trim(),
      teamAFlag: flagA,
      teamBFlag: flagB,
      status: 'scheduled',
      scoreA: null,
      scoreB: null,
      startedAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    };

    onAddMatch(newMatch);
    alert(`Sucesso! O jogo ${newMatch.teamA} × ${newMatch.teamB} foi inserido e já está disponível para receber palpites de todos os usuários.`);
    setTeamA('BRA');
    setTeamB('GER');
    setMatchDateText('Amanhã, 16:00');
  };

  const handleAdminCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poolName.trim() || !poolCode.trim()) {
      alert('Por favor, insira o nome e o código de convite do bolão.');
      return;
    }

    if (poolModality === 'podium' && selectedPodiumPositions.length === 0) {
      alert('Marque pelo menos uma posição do pódio para publicar este bolão.');
      return;
    }

    const normalizedDeadline = poolBettingDeadline
      ? new Date(poolBettingDeadline).toISOString()
      : undefined;

    if (poolBettingDeadline && Number.isNaN(new Date(poolBettingDeadline).getTime())) {
      alert('Informe uma data e hora limite válidas para encerrar as apostas.');
      return;
    }

    if (normalizedDeadline && new Date(normalizedDeadline).getTime() <= Date.now()) {
      alert('O prazo limite do bolão precisa estar no futuro para permitir novas apostas.');
      return;
    }

    let matchIds = [...selectedMatchIdsForPool];
    let teamsList = [...selectedTeamsForPool];

    let explicitMatchesForPool: Match[] = [];

    if (poolModality === 'podium') {
      matchIds = [];
      teamsList = COPA_2026_TEAMS.map(t => t.code);
      const positions = PODIUM_POSITION_OPTIONS.filter((position) =>
        selectedPodiumPositions.includes(position.id)
      );

      explicitMatchesForPool = positions.map((pos) => {
        const matchId = generateClientUUID();
        matchIds.push(matchId);

        return {
          id: matchId,
          group: 'PÓDIO',
          dateText: 'Pódio Final',
          teamA: pos.place,
          teamB: pos.desc,
          teamAFlag: pos.icon,
          teamBFlag: pos.icon,
          status: 'scheduled',
          scoreA: null,
          scoreB: null,
          startedAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
      });
    } else {
      const selectedOfficialMatches = availableTraditionalMatches.filter((match) =>
        selectedMatchIdsForPool.includes(match.id)
      );
      explicitMatchesForPool = selectedOfficialMatches.map((match) => {
        const matchId = generateClientUUID();
        return {
          ...match,
          id: matchId
        };
      });
      matchIds = explicitMatchesForPool.map((match) => match.id);

      if (matchIds.length === 0) {
        alert('Selecione pelo menos um confronto oficial da Copa para publicar este bolão tradicional.');
        return;
      }
    }

    const newPool: Pool = {
      id: `p-${Date.now()}`,
      name: poolName.trim(),
      creator: user.fullName || 'Organizador',
      entryFee: parseFloat(poolFee) || 50,
      accumulatedPrize: 0,
      inviteCode: poolCode.toUpperCase().trim(),
      memberCount: 0,
      description: poolDesc.trim() || 'Bolão personalizado de apostas esportivas.',
      bettingDeadline: normalizedDeadline,
      selectedTeams: teamsList,
      selectedMatchIds: matchIds,
      feeType: poolFeeType,
      feeValue: poolFeeValue,
      maxParticipants: poolMaxParticipants,
      modality: poolModality,
      prizedPlaces: poolPrizedPlaces
    };

    if (editingPoolId) {
      await onUpdatePool({ ...newPool, id: editingPoolId }, explicitMatchesForPool);
      alert(`Sucesso! O bolão "${newPool.name}" foi atualizado com sucesso.`);
    } else {
      await onCreatePool(newPool, explicitMatchesForPool);
      if (poolModality === 'podium') {
        alert(`Sucesso! O bolão de Pódio "${newPool.name}" foi criado com sucesso com ${explicitMatchesForPool.length} posição(ões) disponível(is)!`);
      } else {
        alert(`Sucesso! O bolão "${newPool.name}" foi criado com sucesso com ${selectedTeamsForPool.length} times e ${explicitMatchesForPool.length} partidas vinculadas!`);
      }
    }
    resetPoolForm();
  };

  const handleEditPool = (pool: Pool) => {
    const linkedMatches = matchesList.filter((m) => pool.selectedMatchIds?.includes(m.id));
    const derivedTeams = pool.modality === 'podium'
      ? COPA_2026_TEAMS.map((t) => t.code)
      : deriveTeamCodesFromMatches(linkedMatches);
    const derivedTraditionalMatchIds = linkedMatches
      .map((match) => findOfficialTraditionalMatch(match)?.id || null)
      .filter((id): id is string => id !== null);
    const derivedPodiumPositions = sortPodiumPositionIds(
      linkedMatches
        .map((match) => getPodiumPositionId(match))
        .filter((position): position is PodiumPositionId => position !== null)
    );

    setEditingPoolId(pool.id);
    setPoolName(pool.name);
    setPoolCode(pool.inviteCode);
    setPoolFee(String(pool.entryFee));
    setPoolDesc(pool.description || '');
    setPoolFeeType(pool.feeType || 'percent');
    setPoolFeeValue(pool.feeValue || 20);
    setPoolMaxParticipants(pool.maxParticipants || 100);
    setPoolModality(pool.modality || 'score');
    setPoolPrizedPlaces(pool.prizedPlaces || 3);
    setPoolBettingDeadline(toDateTimeLocalValue(pool.bettingDeadline));
    setSelectedPodiumPositions(
      pool.modality === 'podium'
        ? (derivedPodiumPositions.length > 0 ? derivedPodiumPositions : DEFAULT_PODIUM_POSITION_IDS)
        : DEFAULT_PODIUM_POSITION_IDS
    );
    setSelectedTeamsForPool(derivedTeams);
    setSelectedMatchIdsForPool(
      pool.modality === 'podium'
        ? (pool.selectedMatchIds || [])
        : derivedTraditionalMatchIds
    );
    setActiveAdminTab('boloes');
  };

  const handleDeleteExistingPool = (pool: Pool) => {
    const confirmed = window.confirm(`Deseja realmente apagar o bolão "${pool.name}"?`);
    if (!confirmed) return;

    if (editingPoolId === pool.id) {
      resetPoolForm();
    }

    onDeletePool(pool.id);
  };

  const handleDispatchCustomNotification = () => {
    if (!notifTitle.trim() || !notifMessage.trim()) return;
    
    // Dispatch alert as if it was sent by web push
    onAlertDispatch(notifCategory, notifTitle, notifMessage);
    setNotifDispatched(true);
    
    setTimeout(() => {
      setNotifDispatched(false);
    }, 2500);
  };

  // Predefined templates helper
  const handleSelectTemplate = (type: 'gol' | 'ranking' | 'premio') => {
    if (type === 'gol') {
      setNotifCategory('Partidas');
      setNotifTitle('GOL DA COPA! ⚽');
      setNotifMessage('O árbitro de vídeo confirmou gol importante no jogo. Acesse os palpites ativos para ver as estatísticas ao vivo.');
    } else if (type === 'ranking') {
      setNotifCategory('Ranking');
      setNotifTitle('Mudanças no Top 3! 🏆');
      setNotifMessage('Vários apostadores acertaram os resultados extraordinários de hoje. Veja sua posição reordenada agora!');
    } else {
      setNotifCategory('Sistema');
      setNotifTitle('Prêmio Premiado Elevado! 💰');
      setNotifMessage(`As arrecadações dispararam alcançando níveis excepcionais. Participe e garanta sua parte.`);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 pb-28">
      {/* Sidebar Navigation: O1 Navigation Rails */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        {/* Navigation list */}
        <div className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 bg-surface-container-low border border-outline-variant p-3 rounded-xl scrollbar-none">
          <button
            onClick={() => setActiveAdminTab('kpis')}
            className={`shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-bold text-label-bold text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeAdminTab === 'kpis'
                ? 'bg-[#00E676]/10 text-primary border border-[#00E676]/20'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
            }`}
          >
            <CircleDollarSign className="w-4 h-4 shrink-0" />
            <div className="text-xs">
              <div className="font-bold">Painel Operacional</div>
              <div className="text-[9px] font-normal opacity-70 hidden lg:block">KPIs e métricas de receita</div>
            </div>
          </button>

          <button
            onClick={() => setActiveAdminTab('comissoes')}
            className={`shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-bold text-label-bold text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeAdminTab === 'comissoes'
                ? 'bg-[#00E676]/10 text-primary border border-[#00E676]/20'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <div className="text-xs">
              <div className="font-bold">Configuração Contábil</div>
              <div className="text-[9px] font-normal opacity-70 hidden lg:block">Simulador de comissão da banca</div>
            </div>
          </button>

          <button
            onClick={() => setActiveAdminTab('partidas')}
            className={`shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-bold text-label-bold text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeAdminTab === 'partidas'
                ? 'bg-[#00E676]/10 text-primary border border-[#00E676]/20'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
            }`}
          >
            <Trophy className="w-4 h-4 shrink-0" />
            <div className="text-xs">
              <div className="font-bold">Gestão de Partidas</div>
              <div className="text-[9px] font-normal opacity-70 hidden lg:block">Inserir e homologar placares</div>
            </div>
          </button>

          <button
            onClick={() => setActiveAdminTab('boloes')}
            className={`shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-bold text-label-bold text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeAdminTab === 'boloes'
                ? 'bg-[#00E676]/10 text-primary border border-[#00E676]/20'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <div className="text-xs">
              <div className="font-bold">Criação de Bolões</div>
              <div className="text-[9px] font-normal opacity-70 hidden lg:block">Gerenciar grupos e chaves</div>
            </div>
          </button>

          <button
            onClick={() => setActiveAdminTab('notificacoes')}
            className={`shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-bold text-label-bold text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeAdminTab === 'notificacoes'
                ? 'bg-[#00E676]/10 text-primary border border-[#00E676]/20'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <div className="text-xs">
              <div className="font-bold">Push Notifications</div>
              <div className="text-[9px] font-normal opacity-70 hidden lg:block">Simulador de Smartphone preview</div>
            </div>
          </button>

          <button
            onClick={() => setActiveAdminTab('times')}
            className={`shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-bold text-label-bold text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeAdminTab === 'times'
                ? 'bg-[#00E676]/10 text-primary border border-[#00E676]/20'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
            }`}
          >
            <Users className="w-4 h-4 shrink-0 text-[#00E676]" />
            <div className="text-xs">
              <div className="font-bold">Times da Copa</div>
              <div className="text-[9px] font-normal opacity-70 hidden lg:block">Ver todos os 48 países da Copa</div>
            </div>
          </button>
        </div>

        {/* Informational Role Card explaining user management context clearly */}
        <div className="bg-[#161B22]/65 border border-outline-variant rounded-xl p-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-[#ffe054]">
            <Radio className="w-4 h-4 shrink-0 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Painel Administrativo Activo</span>
          </div>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            Como <strong>Organizador Oficial</strong> do Bolão (Banca), você possui autoridade total para:
          </p>
          <ul className="text-[11px] text-[#b0c0b1] list-disc list-inside space-y-1">
            <li>Inserir novos jogos na grade a qualquer momento</li>
            <li>Homologar placares reais de partidas</li>
            <li>Ajustar taxa de comissão administrativa e preços de entrada</li>
            <li>Disparar avisos em tempo real para os apostadores</li>
          </ul>
        </div>
      </div>

      {/* Main Dynamic Viewport */}
      <div className="lg:col-span-9 flex flex-col bg-surface-container rounded-2xl border border-outline-variant p-6 shadow-xl w-full min-h-[480px]">
        {/* --- View 1: KPIs Operacionais: O1 --- */}
        {activeAdminTab === 'kpis' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface">Métricas de Faturamento</h2>
              <p className="text-xs text-on-surface-variant mt-1">Visão contábil em tempo real do Bolão Oficial Copa 2026.</p>
            </div>

            {/* Grid display cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Gross income */}
              <div className="bg-[#181C22] p-5 rounded-xl border border-outline-variant flex flex-col justify-between relative overflow-hidden">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Faturamento Bruto</span>
                  <div className="font-display-score text-2xl font-extrabold text-[#75ff9e] mt-1">R$ 15.000,00</div>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-[10px] text-success font-medium flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +24% este mês
                  </span>
                  <Coins className="w-5 h-5 text-on-surface-variant opacity-40" />
                </div>
              </div>

              {/* COMMISION WITH TOOLTIP ANNOTATION: exactly specified in PRD O1 */}
              <div className="bg-[#181C22] p-5 rounded-xl border border-outline-variant flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Comissões Retidas</span>
                  
                  {/* Tooltip action handler */}
                  <div className="relative">
                    <button 
                      onMouseEnter={() => setShowCommissionTooltip(true)}
                      onMouseLeave={() => setShowCommissionTooltip(false)}
                      onClick={() => setShowCommissionTooltip(!showCommissionTooltip)}
                      className="text-on-surface-variant hover:text-[#00e676] transition-colors focus:outline-none cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    {showCommissionTooltip && (
                      <div className="absolute right-0 bottom-6 w-52 bg-surface-container-high border border-outline-variant p-2.5 rounded-lg text-[9px] text-[#bacbb9] shadow-2xl z-25 leading-normal">
                        Taxa de <strong>20% retida automaticamente</strong> sobre o total de inscrições pagas via Pix PagBank para cobrir os custos de hospedagem e lucro administrativo do organizador.
                      </div>
                    )}
                  </div>
                </div>
                <div className="font-display-score text-2xl font-extrabold text-[#ffe16d] mt-1">
                  R$ 3.000,00
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-[10px] text-on-surface-variant font-medium">Equivale a 20.00% da arrecadação</span>
                  <div className="w-2.5 h-2.5 rounded-full bg-secondary-fixed"></div>
                </div>
              </div>

              {/* Saques Pendentes */}
              <div className="bg-[#181C22] p-5 rounded-xl border border-outline-variant flex flex-col justify-between relative overflow-hidden">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Saques Pendentes</span>
                  <div className="font-display-score text-2xl font-extrabold text-[#ff4b4b] mt-1">R$ 450,00</div>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-[10px] text-on-surface-variant font-medium">2 solicitações de resgates</span>
                  <ArrowRightLeft className="w-4 h-4 text-on-surface-variant opacity-40 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Simple Graphic Bar Representing 7 days users registration growth */}
            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl">
              <h3 className="font-bold text-sm text-on-surface mb-4">Novos Inscritos (Últimos 7 dias)</h3>
              <div className="flex items-end justify-between h-32 pt-2 pr-2">
                {[12, 17, 8, 25, 42, 33, 49].map((count, i) => {
                  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  const maxVal = 50;
                  const ratio = (count / maxVal) * 100;
                  return (
                    <div key={i} className="flex flex-col items-center flex-1 gap-2">
                      <div className="w-8 md:w-10 bg-gradient-to-t from-[#00E676]/40 to-[#00E676] rounded-t relative group overflow-hidden" style={{ height: `${ratio}%` }}>
                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        {/* Hover count */}
                        <div className="absolute -top-6 left-0 right-0 text-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          {count}
                        </div>
                      </div>
                      <span className="text-[9px] text-on-surface-variant font-semibold uppercase">{days[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- View 2: Painel de Comissionamento (50/50 Layout): O2 --- */}
        {activeAdminTab === 'comissoes' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface">Simulador de Custos e Premiação</h2>
              <p className="text-xs text-on-surface-variant mt-1">Defina valores fictícios para simular e planejar a arrecadação dos seus bolões. Os parâmetros contábeis oficiais são definidos individualmente na criação de cada bolão.</p>
            </div>

            {/* 50/50 Grid columns layout standard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* LEFT HALF CONTENT */}
              <div className="bg-surface-container-low border border-outline-variant p-5 rounded-xl flex flex-col gap-4">
                <h3 className="font-bold text-sm text-on-surface">Configurações Contábeis</h3>
                
                {/* Choice parameter mode option Toggle: Percent vs Fixed */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Cobrança da Banca</span>
                  <div className="grid grid-cols-2 bg-surface-container p-1 rounded-lg border border-outline-variant">
                    <button 
                      onClick={() => setFeeType('percent')}
                      className={`py-1.5 rounded font-label-bold text-label-bold text-xs font-bold transition-all ${
                        feeType === 'percent' 
                          ? 'bg-primary-container text-[#00210b]' 
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Porcentagem (%)
                    </button>
                    <button 
                      onClick={() => setFeeType('fixed')}
                      className={`py-1.5 rounded font-label-bold text-label-bold text-xs font-bold transition-all ${
                        feeType === 'fixed' 
                          ? 'bg-primary-container text-[#00210b]' 
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Valor Fixo (R$)
                    </button>
                  </div>
                </div>

                {/* Value Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
                    {feeType === 'percent' ? 'Comissão da Banca (%)' : 'Comissão da Banca (R$)'}
                  </label>
                  <input 
                    type="number" 
                    value={feeValue} 
                    onChange={(e) => setFeeValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-11 bg-[#090E14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg focus:outline-none focus:border-[#00e676]"
                  />
                </div>

                {/* Entry Fee Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Custo de Inscrição por Usuário (R$)</label>
                  <input 
                    type="number" 
                    value={entryFee} 
                    onChange={(e) => setEntryFee(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-11 bg-[#090E14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg focus:outline-none focus:border-[#00e676]"
                  />
                </div>

                {/* Action save CTA */}
                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-xs leading-relaxed text-center">
                  💡 <strong>Painel de Prospecção Ativo:</strong> Use os campos acima e o slider ao lado para projetar faturamentos. As regras reais de comissão e taxa são definidas no menu <strong>Criação de Bolões</strong>.
                </div>
              </div>

              {/* RIGHT HALF CONTENT: Projections with interactive slider as requested in O2 */}
              <div className="bg-[#181C22] border border-outline-variant p-5 rounded-xl flex flex-col gap-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-[#00e676]/5 blur-xl rounded-full"></div>
                
                <h3 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#ffdb3c]" /> Simulador de Atividades
                </h3>
                
                {/* Count slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-on-surface-variant font-semibold">
                    <span>Participantes Estimados</span>
                    <span className="text-[#00e676] font-bold">{participantProjection} inscritos</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="1000" 
                    step="10"
                    value={participantProjection}
                    onChange={(e) => setParticipantProjection(parseInt(e.target.value))}
                    className="w-full accent-[#00E676] h-1 bg-surface rounded-lg cursor-pointer mt-2"
                  />
                </div>

                {/* Calculated Projection Output display board */}
                <div className="space-y-2 mt-2 bg-black/40 border border-outline-variant/35 p-4 rounded-lg">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant">Arrecadação Bruta Total:</span>
                    <span className="font-mono text-on-surface font-bold">R$ {totalArrecadadoProjection.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant">Lucro Administrativo Retido:</span>
                    <span className="font-mono text-[#ffe16d] font-bold">R$ {comissaoBancaProjection.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1.5 border-t border-outline-variant/40">
                    <span className="text-on-surface font-semibold">Prêmio Líquido a Distribuir:</span>
                    <span className="font-mono text-[#00e676] font-bold">R$ {netPremioProjection.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Sub Distribution breakdown estimation */}
                <div className="space-y-1.5 pt-2 text-[11px] text-on-surface-variant">
                  <div className="flex justify-between">
                    <span>1º Colocado (60.00%)</span>
                    <span>R$ {firstPlaceAward.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2º Colocado (25.00%)</span>
                    <span>R$ {secondPlaceAward.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>3º Colocado (15.00%)</span>
                    <span>R$ {thirdPlaceAward.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* --- View 3: Gestão de Partidas e Hold Confirmation modal: O3 --- */}
        {activeAdminTab === 'partidas' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-on-surface">Gestão de Rodadas</h2>
                <p className="text-xs text-on-surface-variant mt-1">Homologue placares reais oficiais ou insira novos jogos de futebol no sistema.</p>
              </div>
            </div>

            <div className="bg-[#161B22] border border-outline-variant p-5 rounded-xl flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Pódio Oficial da Copa</span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Ao final da Copa, este quadro recebe definitivamente campeão, vice, 3º e 4º lugar.
                  Até lá, o preenchimento provisório usa o ranking FIFA: Argentina, Espanha, França e Inglaterra.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {podiumMatches.map((match) => {
                  const positionId = getPodiumPositionId(match);
                  const temporaryTeam = positionId ? getTemporaryPodiumTeam(positionId) : null;
                  const selectedTeam = match.scoreA !== null ? COPA_2026_TEAMS[match.scoreA] : temporaryTeam;
                  const isFinalized = match.status === 'finished' && match.scoreA !== null;
                  const fallbackIndex = positionId ? getTemporaryPodiumTeamIndex(positionId) : 0;

                  return (
                    <div key={match.id} className="bg-[#090D14] border border-outline-variant rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-surface-container-high border border-outline-variant flex items-center justify-center text-xl shrink-0">
                          {match.teamAFlag}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white">{match.teamA}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                              isFinalized
                                ? 'bg-[#00E676]/15 text-[#6dffa0] border border-[#00E676]/30'
                                : 'bg-amber-400/15 text-amber-200 border border-amber-400/30'
                            }`}>
                              {isFinalized ? 'Definitivo' : 'Temporario FIFA'}
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant">{match.teamB}</p>
                          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                            <span>{selectedTeam?.flag || '🏳️'}</span>
                            <span>{selectedTeam?.name || 'Aguardando definicao'}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedMatchForScore(match);
                          setScoreInputA(match.scoreA !== null ? match.scoreA.toString() : String(Math.max(fallbackIndex, 0)));
                          setScoreInputB('0');
                          setHoldProgress(0);
                        }}
                        className="px-4 py-2 bg-primary-container text-[#00210b] font-label-bold text-label-bold text-xs hover:bg-[#62ff96] transition-colors rounded-lg active:scale-95 cursor-pointer font-bold shrink-0"
                      >
                        {isFinalized ? 'Ajustar Selecao' : 'Definir Selecao'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inserir Novo Jogo Form */}
            <form onSubmit={handleAdminAddMatch} className="bg-[#161B22] border border-outline-variant p-5 rounded-xl flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#00E676]">Inserir Nova Partida</span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Time A (Sigla)</span>
                  <select 
                    value={teamA} 
                    onChange={(e) => setTeamA(e.target.value)}
                    className="h-9 bg-[#090D14] border border-[#1f2937] text-[#dfe2eb] font-semibold px-2 rounded-lg text-xs"
                  >
                    <option value="BRA">BRA (Brasil)</option>
                    <option value="ARG">ARG (Argentina)</option>
                    <option value="FRA">FRA (França)</option>
                    <option value="GER">GER (Alemanha)</option>
                    <option value="ENG">ENG (Inglaterra)</option>
                    <option value="ESP">ESP (Espanha)</option>
                    <option value="MEX">MEX (México)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Time B (Sigla)</span>
                  <select 
                    value={teamB} 
                    onChange={(e) => setTeamB(e.target.value)}
                    className="h-9 bg-[#090D14] border border-[#1f2937] text-[#dfe2eb] font-semibold px-2 rounded-lg text-xs"
                  >
                    <option value="BRA">BRA (Brasil)</option>
                    <option value="ARG">ARG (Argentina)</option>
                    <option value="FRA">FRA (França)</option>
                    <option value="GER">GER (Alemanha)</option>
                    <option value="ENG">ENG (Inglaterra)</option>
                    <option value="ESP">ESP (Espanha)</option>
                    <option value="MEX">MEX (México)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 lg:col-span-1">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Grupo / Fase</span>
                  <input 
                    type="text" 
                    value={matchGroup} 
                    onChange={(e) => setMatchGroup(e.target.value)}
                    placeholder="Ex: GRUPO A • DIA 1"
                    className="h-9 bg-[#090D14] border border-[#1f2937] text-[#dfe2eb] font-semibold px-3 rounded-lg text-xs focus:outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 lg:col-span-1">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Data / Hora</span>
                  <input 
                    type="text" 
                    value={matchDateText} 
                    onChange={(e) => setMatchDateText(e.target.value)}
                    placeholder="Ex: Amanhã, 16:00"
                    className="h-9 bg-[#090D14] border border-[#1f2937] text-[#dfe2eb] font-semibold px-3 rounded-lg text-xs focus:outline-none"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="h-9 bg-[#00E676] hover:bg-[#62ff96] text-[#00210b] font-bold text-xs uppercase rounded-lg transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🚀 Salvar Jogo no Cronograma</span>
              </button>
            </form>

            <div className="flex items-center justify-between gap-3 mt-2">
              <div>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold block">Cronograma Completo e Homologacao</span>
                <p className="text-xs text-on-surface-variant mt-1">
                  Todas as partidas oficiais ficam disponiveis aqui, em ordem cronologica, para lancamento dos placares conforme forem acontecendo.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncScores}
                  disabled={isSyncingScores}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high hover:bg-surface border border-outline-variant text-[#00E676] text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSyncingScores ? 'Sincronizando...' : '🔄 Sincronizar ao Vivo'}
                </button>
                <span className="text-[11px] px-3 py-1 rounded-full border border-outline-variant bg-surface-container-low text-on-surface-variant">
                  {manageableMatches.length} jogos
                </span>
              </div>
            </div>

            {/* list matches grouped by stats */}
            <div className="space-y-3">
              {manageableMatches.map((match) => {
                const isFinalized = match.status === 'finished';
                const isLive = match.status === 'live';
                const teamAData = getTeamPresentation(match.teamA, match.teamAFlag);
                const teamBData = getTeamPresentation(match.teamB, match.teamBFlag);

                return (
                  <div key={match.id} className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex items-center gap-3 min-w-0 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                        <TeamAvatar
                          className="h-8 w-8 shrink-0"
                          fallback={teamAData.displayFallback}
                          fallbackClassName="text-[10px]"
                          name={teamAData.displayName}
                          src={teamAData.displayImage}
                          title={teamAData.displayName}
                        />
                        <span className="font-bold text-sm text-on-surface whitespace-normal leading-tight">
                          {teamAData.displayName}
                        </span>
                        </div>
                        <span className="text-on-surface-variant text-xs font-bold uppercase tracking-[0.18em]">vs</span>
                        <div className="flex items-center gap-2 min-w-0">
                        <TeamAvatar
                          className="h-8 w-8 shrink-0"
                          fallback={teamBData.displayFallback}
                          fallbackClassName="text-[10px]"
                          name={teamBData.displayName}
                          src={teamBData.displayImage}
                          title={teamBData.displayName}
                        />
                        <span className="font-bold text-sm text-on-surface whitespace-normal leading-tight">
                          {teamBData.displayName}
                        </span>
                        </div>
                      </div>

                      <div className="hidden md:flex md:flex-col gap-1">
                        <span className="text-[10px] bg-outline-variant/30 px-2 py-0.5 rounded text-on-surface-variant w-fit">
                          {match.group}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">{match.dateText}</span>
                      </div>
                    </div>

                    <div>
                      {isFinalized ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-surface-container-high px-3 py-1 rounded text-[#00E676] border border-[#00E676]/30 flex items-center gap-1.5">
                            {`Confirmado: ${match.scoreA} × ${match.scoreB}`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {!match.group.toUpperCase().includes('FASE DE GRUPOS') && (
                            <button 
                              onClick={() => {
                                setSelectedMatchForTeams(match);
                                setTeamInputA(match.teamA);
                                setTeamInputB(match.teamB);
                              }}
                              className="px-4 py-2 bg-surface-container-high border border-outline-variant text-[#dfe2eb] font-label-bold text-label-bold text-xs hover:bg-surface transition-colors rounded-lg active:scale-95 cursor-pointer font-bold"
                            >
                              Definir Times
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedMatchForScore(match);
                              setScoreInputA(match.scoreA !== null ? match.scoreA.toString() : '2');
                              setScoreInputB(match.scoreB !== null ? match.scoreB.toString() : '0');
                              setHoldProgress(0);
                            }}
                            className="px-4 py-2 bg-primary-container text-[#00210b] font-label-bold text-label-bold text-xs hover:bg-[#62ff96] transition-colors rounded-lg active:scale-95 cursor-pointer font-bold"
                          >
                            {isLive ? 'Atualizar Placar' : 'Definir Placar'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {manageableMatches.length === 0 && (
                <div className="bg-surface-container-low border border-dashed border-outline-variant p-6 rounded-xl text-center text-sm text-on-surface-variant">
                  Nenhuma partida oficial disponivel no cronograma no momento.
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- View 4: Push Central Notifications (Smartphone Realtime preview): O4 --- */}
        {activeAdminTab === 'notificacoes' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface">Notificar Apostadores</h2>
              <p className="text-xs text-on-surface-variant mt-1">Dispare alertas de push instantâneos para incentivar palpites e divulgar prêmios acumulados.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Dispatch form left half */}
              <div className="lg:col-span-7 bg-surface-container-low border border-outline-variant p-4 rounded-xl flex flex-col gap-4">
                
                {/* Categories categories */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Categoria</span>
                  <div className="flex gap-2">
                    {(['Partidas', 'Ranking', 'Sistema'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setNotifCategory(cat);
                          if (cat === 'Partidas') {
                            setNotifTitle('Placar Atualizado! ⚽');
                          } else if (cat === 'Ranking') {
                            setNotifTitle('Vários degraus subidos! 🏆');
                          } else {
                            setNotifTitle('Aviso Geral da Banca! 💰');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          notifCategory === cat 
                            ? 'bg-[#00e676]/20 text-[#00e676] border border-[#00e676]/40' 
                            : 'bg-surface-container border border-outline-variant text-on-surface-variant'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Título do Alerta</label>
                  <input 
                    type="text" 
                    value={notifTitle} 
                    onChange={(e) => setNotifTitle(e.target.value)}
                    className="h-10 bg-[#090E14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg focus:outline-none"
                  />
                </div>

                {/* Message */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Conteúdo da Mensagem</label>
                  <textarea 
                    rows={3} 
                    value={notifMessage} 
                    onChange={(e) => setNotifMessage(e.target.value)}
                    className="bg-[#090E14] border border-[#1f2937] text-on-surface font-semibold p-3 rounded-lg focus:outline-none resize-none leading-relaxed text-xs"
                  />
                </div>

                {/* Quick select Templates: PRD O4 */}
                <div className="flex flex-col gap-1.5 bg-[#090E14] p-3 rounded border border-[#1d252f] gap-2">
                  <span className="text-[9px] text-[#75ff9e] uppercase font-bold tracking-widest block">Modelos Rápidos</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => handleSelectTemplate('gol')} className="text-[9px] bg-surface hover:bg-[#00e676]/10 hover:text-[#00e676] text-on-surface px-2 py-1 rounded border border-outline-variant transition-colors cursor-pointer">Modelo: Gol / VAR</button>
                    <button onClick={() => handleSelectTemplate('ranking')} className="text-[9px] bg-surface hover:bg-[#00e676]/10 hover:text-[#00e676] text-on-surface px-2 py-1 rounded border border-outline-variant transition-colors cursor-pointer">Modelo: Ranking alterado</button>
                    <button onClick={() => handleSelectTemplate('premio')} className="text-[9px] bg-surface hover:bg-[#00e676]/10 hover:text-[#00e676] text-on-surface px-2 py-1 rounded border border-outline-variant transition-colors cursor-pointer">Modelo: Divulgação prêmio</button>
                  </div>
                </div>

                {/* Dispatch trigger CTA */}
                <button 
                  onClick={handleDispatchCustomNotification}
                  className="mt-1 h-11 bg-primary-container text-[#00210b] hover:bg-[#62ff96] font-label-bold text-label-bold uppercase rounded-lg flex items-center justify-center gap-2 font-bold transition-all hover:shadow-[0_0_15px_rgba(0,230,118,0.2)] cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar Alerta Geral</span>
                </button>
                
                {notifDispatched && (
                  <span className="text-center text-[10px] text-[#00E676] font-bold animate-pulse">Push transmitido com sucesso aos servidores!</span>
                )}
              </div>

              {/* SMARTPHONE REALTIME PREVIEW CONTAINER RIGHT HALF: exactly specified in PRD O4 */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center pt-2">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-3 block">Simulação de Smartphone</span>
                
                {/* Physical Phone Model mockup frame */}
                <div className="w-[230px] h-[450px] rounded-[38px] border-[6px] border-[#313d4c] bg-[#0c1015] relative p-3 flex flex-col shadow-2xl overflow-hidden select-none">
                  {/* Speaker Topnotch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full z-20 flex items-center justify-center">
                    <span className="w-6 h-1 bg-surface-variant rounded-full"></span>
                  </div>

                  {/* Top Bar status bar clock */}
                  <div className="h-6 w-full flex justify-between px-3 text-[9px] font-bold text-on-surface-variant pt-2 mt-2">
                    <span>17:04</span>
                    <div className="flex gap-1.5 items-center">
                      <Radio className="w-3 h-3 text-error animate-pulse" />
                      <span>5G</span>
                      <span className="w-3.5 h-2 bg-on-surface-variant rounded-sm"></span>
                    </div>
                  </div>

                  {/* Screen background content */}
                  <div className="flex-1 w-full bg-cover relative flex flex-col justify-start pt-6 px-1.5" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=600&auto=format&fit=crop')" }}>
                    {/* Dark backing overlay shield */}
                    <div className="absolute inset-0 bg-black/50"></div>

                    {/* Notification Alert Box Card with slide-down entering animation */}
                    <div className="relative bg-[#161B22]/95 border border-outline-variant p-2.5 rounded-xl flex flex-col gap-1 w-full z-10 shadow-2xl animate-[slideDown_0.3s_ease-out]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-[#00E676]" />
                          <span className="font-bold text-[8px] text-white tracking-widest uppercase">BOLÃOPRO 2026</span>
                        </div>
                        <span className="text-[7px] text-on-surface-variant font-medium">Agora</span>
                      </div>

                      <div className="text-[10px] font-bold text-on-surface truncate leading-tight mt-1">{notifTitle || 'Sem Título'}</div>
                      <div className="text-[8px] text-[#bacbb9] leading-tight line-clamp-3 mt-0.5">{notifMessage || 'Escreva algo na caixa de entrada para simular o push do apostador...'}</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- View 5: Gestão de Bolões (Sweeps/Pools Creator and List) --- */}
        {activeAdminTab === 'boloes' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface">Gestão de Bolões</h2>
              <p className="text-xs text-on-surface-variant mt-1">Crie novos grupos de bolão, defina taxas de entrada, chaves de acesso privadas e veja as arrecadações acumuladas.</p>
            </div>

            {/* Form "Criar Novo Bolão" */}
            <form onSubmit={handleAdminCreatePool} className="bg-[#161B22] border border-outline-variant p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 text-primary">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#00E676]">Novo Canal de Arrecadação (Bolão)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pool Name */}
                <div className="flex flex-col gap-1.5 font-bold">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Nome do Bolão</label>
                  <input 
                    type="text" 
                    value={poolName}
                    onChange={(e) => setPoolName(e.target.value)}
                    placeholder="Ex: Bolão Vip Qatar Amigos"
                    className="h-10 bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg text-xs focus:outline-none"
                    required
                  />
                </div>

                {/* Pool invite code */}
                <div className="flex flex-col gap-1.5 font-bold">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Código de Acesso Unico</label>
                  <input 
                    type="text"
                    value={poolCode}
                    onChange={(e) => setPoolCode(e.target.value.toUpperCase())}
                    placeholder="Ex: QATAR26"
                    className="h-10 bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg text-xs focus:outline-none"
                    required
                  />
                </div>

                {/* Pool entry fee */}
                <div className="flex flex-col gap-1.5 font-bold">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Taxa de Entrada (R$)</label>
                  <input 
                    type="number"
                    value={poolFee}
                    onChange={(e) => setPoolFee(e.target.value)}
                    placeholder="1"
                    className="h-10 bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg text-xs focus:outline-none"
                    min="1"
                    required
                  />
                </div>
              </div>

              {/* Pool description */}
              <div className="flex flex-col gap-1.5 font-bold">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Descrição / Regras Especiais</label>
                  <button 
                    type="button" 
                    onClick={handleGenerateRulesTemplate}
                    className="text-[10px] text-[#00E676] hover:text-[#62ff96] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    Gerar Automático
                  </button>
                </div>
                <textarea 
                  rows={2}
                  value={poolDesc}
                  onChange={(e) => setPoolDesc(e.target.value)}
                  placeholder="Defina o destino das fatias, prazos limite para envio dos palpites, etc."
                  className="bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold p-3 rounded-lg text-xs focus:outline-none resize-none"
                />
              </div>

              {/* Modalidade do Bolão */}
              <div className="flex flex-col gap-1.5 font-bold">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Modalidade do Bolão</span>
                <div className="grid grid-cols-1 md:grid-cols-2 bg-[#090D14] p-1 rounded-lg border border-[#1f2937] gap-1">
                  <button 
                    type="button"
                    onClick={() => setPoolModality('score')}
                    className={`py-2 rounded font-bold text-xs transition-all cursor-pointer ${
                      poolModality === 'score' 
                        ? 'bg-primary text-[#00210b]' 
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    ⚽ Placares dos Jogos (Tradicional)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPoolModality('podium')}
                    className={`py-2 rounded font-bold text-xs transition-all cursor-pointer ${
                      poolModality === 'podium' 
                        ? 'bg-primary text-[#00210b]' 
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    🏆 Pódio Final
                  </button>
                </div>
              </div>

              {/* SECTION: Configurações Contábeis do Bolão (Nova Seção) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#1f2937]/40 pt-4 mt-2">
                {/* Commission Type Toggle */}
                <div className="flex flex-col gap-1.5 font-bold">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Cobrança da Banca</span>
                  <div className="grid grid-cols-2 bg-[#090D14] p-1 rounded-lg border border-[#1f2937]">
                    <button 
                      type="button"
                      onClick={() => setPoolFeeType('percent')}
                      className={`py-1 rounded font-bold text-xs transition-all cursor-pointer ${
                        poolFeeType === 'percent' 
                          ? 'bg-primary text-[#00210b]' 
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Porcentagem (%)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPoolFeeType('fixed')}
                      className={`py-1 rounded font-bold text-xs transition-all cursor-pointer ${
                        poolFeeType === 'fixed' 
                          ? 'bg-primary text-[#00210b]' 
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Valor Fixo (R$)
                    </button>
                  </div>
                </div>

                {/* Commission Value Input */}
                <div className="flex flex-col gap-1.5 font-bold">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
                    {poolFeeType === 'percent' ? 'Comissão da Banca (%)' : 'Comissão da Banca (R$)'}
                  </label>
                  <input 
                    type="number" 
                    value={poolFeeValue} 
                    onChange={(e) => setPoolFeeValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-10 bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg text-xs focus:outline-none focus:border-[#00e676]"
                    required
                  />
                </div>

                {/* Max Participants Input */}
                <div className="flex flex-col gap-1.5 font-bold">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Nº Máximo de Participantes</label>
                  <input 
                    type="number" 
                    value={poolMaxParticipants} 
                    onChange={(e) => setPoolMaxParticipants(Math.max(2, parseInt(e.target.value) || 0))}
                    className="h-10 bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg text-xs focus:outline-none focus:border-[#00e676]"
                    min="2"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4">
                <div className="flex flex-col gap-1.5 font-bold">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
                    Prazo Limite Para Apostar
                  </label>
                  <input
                    type="datetime-local"
                    value={poolBettingDeadline}
                    onChange={(e) => setPoolBettingDeadline(e.target.value)}
                    className="h-10 bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg text-xs focus:outline-none focus:border-[#00e676]"
                  />
                </div>

                <div className="bg-[#090D14] border border-[#1f2937] rounded-xl px-3 py-2 flex flex-col justify-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Status do prazo</span>
                  <span className="text-xs font-bold text-on-surface">
                    {poolBettingDeadline
                      ? formatPoolDeadlineLabel(new Date(poolBettingDeadline).toISOString())
                      : 'Sem prazo definido'}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    Ao atingir essa data e hora, o sistema bloqueia novas apostas e finalizações neste bolão.
                  </span>
                </div>
              </div>

              {/* Quantidade de Premiados */}
              <div className="flex flex-col gap-1.5 font-bold border-t border-[#1f2937]/40 pt-4 mt-2">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Ranking de Premiados</span>
                <p className="text-[11px] text-on-surface-variant mb-1 font-normal">
                  Defina quantos apostadores dividirão o prêmio líquido. A projeção abaixo será atualizada conforme sua escolha.
                </p>
                <div className="grid grid-cols-3 bg-[#090D14] p-1 rounded-lg border border-[#1f2937] gap-1">
                  <button 
                    type="button"
                    onClick={() => setPoolPrizedPlaces(1)}
                    className={`py-2 rounded font-bold text-xs transition-all cursor-pointer ${
                      poolPrizedPlaces === 1 
                        ? 'bg-[#00e676]/20 border border-[#00e676]/50 text-[#00e676]' 
                        : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                    }`}
                  >
                    1º Colocado (100%)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPoolPrizedPlaces(2)}
                    className={`py-2 rounded font-bold text-xs transition-all cursor-pointer ${
                      poolPrizedPlaces === 2 
                        ? 'bg-[#00e676]/20 border border-[#00e676]/50 text-[#00e676]' 
                        : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                    }`}
                  >
                    Até o 2º Colocado
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPoolPrizedPlaces(3)}
                    className={`py-2 rounded font-bold text-xs transition-all cursor-pointer ${
                      poolPrizedPlaces === 3 
                        ? 'bg-[#00e676]/20 border border-[#00e676]/50 text-[#00e676]' 
                        : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                    }`}
                  >
                    Até o 3º Colocado
                  </button>
                </div>
              </div>

              {/* Dynamic Projection Preview Card */}
              {(() => {
                const maxGrossPrize = poolMaxParticipants * (parseFloat(poolFee) || 0);
                const maxCommission = poolFeeType === 'percent'
                  ? maxGrossPrize * (poolFeeValue / 100)
                  : poolMaxParticipants * poolFeeValue;
                const maxNetPrize = Math.max(0, maxGrossPrize - maxCommission);

                let pct1 = 0, pct2 = 0, pct3 = 0;
                if (poolPrizedPlaces === 1) {
                  pct1 = 100;
                } else if (poolPrizedPlaces === 2) {
                  pct1 = 70;
                  pct2 = 30;
                } else {
                  pct1 = tenantSettings.firstPlacePct;
                  pct2 = tenantSettings.secondPlacePct;
                  pct3 = tenantSettings.thirdPlacePct;
                }

                const maxFirstPlace = maxNetPrize * (pct1 / 100);
                const maxSecondPlace = maxNetPrize * (pct2 / 100);
                const maxThirdPlace = maxNetPrize * (pct3 / 100);

                return (
                  <div className="bg-[#181C22] border border-[#1f2937] p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden">
                    <span className="text-xs font-bold text-[#ffd33c] uppercase tracking-wide flex items-center gap-1.5">
                      <CircleDollarSign className="w-4 h-4 text-[#ffd33c]" /> Projeção de Premiação Máxima (Simulada)
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-black/30 border border-outline-variant/20 p-3 rounded-lg text-xs">
                      <div className="flex justify-between md:flex-col md:gap-1">
                        <span className="text-on-surface-variant">Faturamento Máx. Bruto:</span>
                        <span className="font-mono text-white font-bold">R$ {maxGrossPrize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between md:flex-col md:gap-1">
                        <span className="text-on-surface-variant">Comissão Máx. Banca:</span>
                        <span className="font-mono text-[#ffe16d] font-bold">R$ {maxCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between md:flex-col md:gap-1">
                        <span className="text-on-surface font-semibold">Prêmio Máx. Líquido:</span>
                        <span className="font-mono text-[#00e676] font-bold">R$ {maxNetPrize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px] text-on-surface-variant border-t border-[#1f2937]/50 pt-2">
                      <div className="flex flex-col">
                        <span>1º Colocado ({pct1}%)</span>
                        <span className="font-bold text-white">R$ {maxFirstPlace.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                      </div>
                      {poolPrizedPlaces >= 2 && (
                        <div className="flex flex-col">
                          <span>2º Colocado ({pct2}%)</span>
                          <span className="font-bold text-white">R$ {maxSecondPlace.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {poolPrizedPlaces >= 3 && (
                        <div className="flex flex-col">
                          <span>3º Colocado ({pct3}%)</span>
                          <span className="font-bold text-white">R$ {maxThirdPlace.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {poolModality === 'podium' && (
                <div className="border-t border-outline-variant/40 pt-4 mt-2 flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-[#ffd33c] flex items-center gap-1.5 uppercase tracking-wide">
                      🏆 Posições Disponíveis neste Pódio Final
                    </span>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      Marque apenas as posições que o apostador vai preencher neste bolão. Somente as opções selecionadas aparecerão acima do botão de publicar e também na visão do usuário.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {PODIUM_POSITION_OPTIONS.map((position) => {
                      const isSelected = selectedPodiumPositions.includes(position.id);

                      return (
                        <button
                          key={position.id}
                          type="button"
                          onClick={() => {
                            setSelectedPodiumPositions((prev) => {
                              const next = prev.includes(position.id)
                                ? prev.filter((item) => item !== position.id)
                                : [...prev, position.id];

                              return sortPodiumPositionIds(next);
                            });
                          }}
                          className={`rounded-xl border p-4 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#00E676]/40 bg-[#00E676]/8'
                              : 'border-[#1f2937] bg-[#090D14] hover:border-[#00E676]/25'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${
                              isSelected
                                ? 'border-[#00E676]/40 bg-[#00E676]/12'
                                : 'border-[#1f2937] bg-black/20'
                            }`}>
                              {position.icon}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-on-surface">{position.desc}</span>
                              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold">
                                {position.place}
                              </span>
                            </div>
                          </div>

                          <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-[#00E676] bg-[#00E676] text-[#00210b]'
                              : 'border-[#334155] text-transparent'
                          }`}>
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="bg-[#090D14] border border-[#1f2937] rounded-xl px-3 py-2 flex items-center justify-between text-[10px] font-semibold">
                    <span className="text-on-surface-variant">Posições marcadas para este bolão</span>
                    <span className="text-[#00E676]">{selectedPodiumPositions.length} de {PODIUM_POSITION_OPTIONS.length}</span>
                  </div>
                </div>
              )}

              {/* SECTION: Copa 2026 Teams Selection (As requested by the user) */}
              {poolModality === 'score' && (
                <>
                  <div className="border-t border-outline-variant/40 pt-4 mt-2 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-[#ffd33c] flex items-center gap-1.5 uppercase tracking-wide">
                        🏆 Seleção de Times da Copa 2026 para o Bolão
                      </span>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Marque as seleções oficiais da Copa de 2026 para vincular a este bolão. Isso ajudará na organização correta dos times no sistema.
                      </p>
                    </div>

                    {/* Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#090D14] p-3 rounded-xl border border-[#1f2937]">
                      {/* Search input */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-on-surface-variant uppercase font-bold">Filtrar por nome</span>
                        <input
                          type="text"
                          value={teamSearchText}
                          onChange={(e) => setTeamSearchText(e.target.value)}
                          placeholder="Buscar país ou sigla (Ex: Brasil, BRA)..."
                          className="h-8 bg-[#161b22] border border-[#2d3748] px-2.5 rounded text-xs text-on-surface placeholder:text-gray-600 focus:outline-none focus:border-[#00e676]"
                        />
                      </div>

                      {/* Group dropdown */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-on-surface-variant uppercase font-bold">Filtrar por Grupo</span>
                        <select
                          value={teamGroupFilter}
                          onChange={(e) => setTeamGroupFilter(e.target.value)}
                          className="h-8 bg-[#161b22] border border-[#2d3748] px-2 rounded text-xs text-on-surface focus:outline-none"
                        >
                          <option value="Todos">Todos os Grupos</option>
                          {Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)).map(g => (
                            <option key={g} value={`Grupo ${g}`}>{`Grupo ${g}`}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Multiple Selection Helpers */}
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-on-surface-variant font-medium">
                        Marcados: <strong className="text-[#00e676]">{selectedTeamsForPool.length}</strong> de 48 seleções
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTeamsForPool(COPA_2026_TEAMS.map(t => t.code))}
                          className="px-2 py-1 bg-surface-container-high hover:bg-[#00e676]/20 hover:text-[#00e676] rounded text-[10px] transition-colors border border-outline-variant hover:border-[#00e676]/30 cursor-pointer"
                        >
                          Selecionar Todos (48)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedTeamsForPool([])}
                          className="px-2 py-1 bg-surface-container-high hover:bg-error/20 hover:text-error rounded text-[10px] transition-colors border border-outline-variant hover:border-error/30 cursor-pointer"
                        >
                          Limpar Seleção
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Teams Table Grid */}
                    <div className="max-h-60 overflow-y-auto border border-[#1f2937] rounded-xl bg-surface-container-lowest/50 scrollbar-none">
                      <table className="w-full text-left text-xs divide-y divide-[#1f2937]">
                        <thead className="bg-[#090D14] sticky top-0 font-bold text-on-surface-variant text-[10px] uppercase tracking-wider z-10">
                          <tr>
                            <th className="p-2.5 pl-4">Time</th>
                            <th className="p-2.5">Código</th>
                            <th className="p-2.5">Grupo</th>
                            <th className="p-2.5 text-center pr-4">Incluído?</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1f2937]/50">
                          {COPA_2026_TEAMS.filter(t => {
                            const matchesSearch = t.name.toLowerCase().includes(teamSearchText.toLowerCase()) || t.code.toLowerCase().includes(teamSearchText.toLowerCase());
                            const matchesGroup = teamGroupFilter === 'Todos' || t.group === teamGroupFilter;
                            return matchesSearch && matchesGroup;
                          }).map((team) => {
                            const isChecked = selectedTeamsForPool.includes(team.code);
                            return (
                              <tr 
                                key={team.code} 
                                onClick={() => {
                                  setSelectedTeamsForPool(prev => 
                                    prev.includes(team.code) ? prev.filter(c => c !== team.code) : [...prev, team.code]
                                  );
                                }}
                                className={`hover:bg-[#161b22]/40 transition-colors cursor-pointer ${
                                  isChecked ? 'bg-[#00e676]/5' : ''
                                }`}
                              >
                                <td className="p-2 pl-4 flex items-center gap-2 font-semibold">
                                  <span className="text-base select-none leading-none">{team.flag}</span>
                                  <span>{team.name}</span>
                                </td>
                                <td className="p-2 font-mono font-bold text-on-surface-variant text-[11px]">{team.code}</td>
                                <td className="p-2 text-on-surface-variant text-[11px] font-semibold">{team.group}</td>
                                <td className="p-2 text-center pr-4" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setSelectedTeamsForPool(prev => 
                                        prev.includes(team.code) ? prev.filter(c => c !== team.code) : [...prev, team.code]
                                      );
                                    }}
                                    className="accent-[#00E676] w-4 h-4 rounded cursor-pointer"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {COPA_2026_TEAMS.filter(t => {
                        const matchesSearch = t.name.toLowerCase().includes(teamSearchText.toLowerCase()) || t.code.toLowerCase().includes(teamSearchText.toLowerCase());
                        const matchesGroup = teamGroupFilter === 'Todos' || t.group === teamGroupFilter;
                        return matchesSearch && matchesGroup;
                      }).length === 0 && (
                        <div className="p-8 text-center text-xs text-on-surface-variant font-medium">
                          Nenhuma seleção encontrada para a busca "{teamSearchText}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION: Define matches related to this Bolão (As requested by the user) */}
                  <div className="border-t border-[#1f2937]/60 pt-4 mt-2 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-[#00e676] flex items-center gap-1.5 uppercase tracking-wide">
                        ⚽ Partidas Exibidas neste Bolão
                      </span>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Escolha de forma pontual quais partidas estarão ativas para receber palpites neste bolão. 
                        Você pode selecionar manualmente na tabela ou usar o assistente de auto-seleção rápida.
                      </p>
                    </div>

                    {/* Assistant Fast Actions */}
                    <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center bg-[#090D14] p-3 rounded-xl border border-[#1f2937]">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedTeamsForPool.length === 0) {
                            alert('Marque pelo menos um time da copa no painel acima primeiro!');
                            return;
                          }
                          const matchIdsOfSelectedTeams = availableTraditionalMatches
                            .filter((m) => matchIncludesSelectedTeams(m, selectedTeamsForPool))
                            .map(m => m.id);
                          setSelectedMatchIdsForPool(matchIdsOfSelectedTeams);
                          alert(`Sucesso! Foram vinculados automaticamente os ${matchIdsOfSelectedTeams.length} jogos que envolvem as seleções que você marcou como participantes.`);
                        }}
                        className="flex-1 text-[10px] bg-[#00E676]/10 text-primary border border-[#00E676]/30 hover:bg-[#00E676]/20 font-bold py-2 rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        ✨ Auto-Vincular Jogos das Seleções Marcadas ({
                          availableTraditionalMatches.filter((m) => matchIncludesSelectedTeams(m, selectedTeamsForPool)).length
                        } jogos)
                      </button>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedMatchIdsForPool(availableTraditionalMatches.map(m => m.id))}
                          className="px-2.5 py-2 bg-surface-container-high hover:bg-white/10 rounded text-[10px] transition-colors border border-outline-variant cursor-pointer font-semibold"
                        >
                          Todos os Jogos
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedMatchIdsForPool([])}
                          className="px-2.5 py-2 bg-surface-container-high hover:bg-white/10 rounded text-[10px] transition-colors border border-outline-variant cursor-pointer font-semibold"
                        >
                          Nenhum
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-on-surface-variant font-medium flex justify-between items-center px-1">
                      <span>
                        Total Ativado neste Bolão: <strong className="text-[#00e676]">{selectedMatchIdsForPool.length}</strong> de {availableTraditionalMatches.length} partidas disponíveis.
                      </span>
                    </div>

                    {/* List of matches to check */}
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {availableTraditionalMatches.map(m => {
                        const isChecked = selectedMatchIdsForPool.includes(m.id);
                        const involvesSelectedTeams = matchIncludesSelectedTeams(m, selectedTeamsForPool);
                        const teamAData = getTeamPresentation(m.teamA, m.teamAFlag);
                        const teamBData = getTeamPresentation(m.teamB, m.teamBFlag);

                        return (
                          <div 
                            key={m.id}
                            onClick={() => {
                              setSelectedMatchIdsForPool(prev =>
                                prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                              );
                            }}
                            className={`bg-surface-container-lowest border p-3 rounded-lg flex items-center justify-between transition-all hover:border-[#1f2937]/80 cursor-pointer ${
                              isChecked ? 'border-[#00e676]/50 bg-[#00e676]/2' : 'border-outline-variant/40'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedMatchIdsForPool(prev =>
                                    prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                                  );
                                }}
                                className="accent-[#00E676] w-4 h-4 rounded cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-on-surface">{teamAData.displayName}</span>
                                  <span className="text-[9px] text-on-surface-variant font-semibold">vs</span>
                                  <span className="text-xs font-bold text-on-surface">{teamBData.displayName}</span>
                                  {involvesSelectedTeams && (
                                    <span className="text-[8px] bg-[#ffe16d]/15 text-[#ffe16d] border border-[#ffe16d]/30 px-1 py-0.1 rounded uppercase font-bold tracking-wider leading-none">
                                      Time Selecionado
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-on-surface-variant font-semibold">
                                  {m.group} • {m.dateText}
                                </span>
                              </div>
                            </div>

                            <span className="font-mono text-[9px] text-on-surface-variant font-semibold uppercase tracking-wider bg-surface-container-high/60 px-2 py-0.5 rounded">
                              {m.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <button 
                type="submit"
                className="h-11 bg-primary text-[#00210b] font-bold text-xs uppercase rounded-lg transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{editingPoolId ? 'Salvar Alterações do Bolão' : 'Publicar Bolão no Sistema'}</span>
              </button>

              {editingPoolId && (
                <button
                  type="button"
                  onClick={resetPoolForm}
                  className="h-11 bg-surface-container-high text-on-surface font-bold text-xs uppercase rounded-lg transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 border border-outline-variant"
                >
                  <X className="w-4 h-4" />
                  <span>Cancelar Edição</span>
                </button>
              )}
            </form>


            {/* List Active Pools in the admin scope */}
            <div className="mt-2">
              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold block mb-3">Grade de Bolões Ativos</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {poolsList ? poolsList.map(p => (
                  <div key={p.id} className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-on-surface">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded font-mono font-bold">{p.inviteCode}</span>
                          <button
                            type="button"
                            onClick={() => handleEditPool(p)}
                            className="p-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary/30 cursor-pointer"
                            title="Editar bolão"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!p.finalizedAt && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(`Tem certeza que deseja encerrar o bolão "${p.name}" agora? Essa ação torna o ranking oficial imediatamente.`)) return;
                                const result = await SupabaseService.finalizePool(p.id);
                                if (result.success) {
                                  alert('Bolão encerrado com sucesso! O ranking agora é oficial.');
                                  // Recarregar lista de bolões
                                  window.location.reload();
                                } else {
                                  alert('Erro ao encerrar bolão: ' + (result.error || 'Erro desconhecido'));
                                }
                              }}
                              className="p-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:text-[#ffe16d] hover:border-[#ffe16d]/30 cursor-pointer"
                              title="Encerrar bolão (tornar ranking oficial)"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {p.finalizedAt && (
                            <span className="text-[9px] bg-[#ffe16d]/10 text-[#ffe16d] border border-[#ffe16d]/30 px-1.5 py-0.5 rounded font-bold uppercase">
                              🏁 Encerrado
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteExistingPool(p)}
                            className="p-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:text-error hover:border-error/30 cursor-pointer"
                            title="Apagar bolão"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2">{p.description}</p>
                      
                      {/* Linked metrics */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] bg-[#161b22] px-2 py-0.5 rounded border border-outline-variant/40 font-semibold text-[#ffe359]">
                          🏆 {p.selectedTeams?.length || 0} Seleções
                        </span>
                        <span className="text-[10px] bg-[#161b22] px-2 py-0.5 rounded border border-outline-variant/40 font-semibold text-[#00e676]">
                          ⚽ {p.selectedMatchIds?.length || 0} Partidas
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] bg-[#161b22] px-2 py-0.5 rounded border border-outline-variant/40 font-semibold text-on-surface-variant">
                          <Clock className="w-3 h-3" />
                          {formatPoolDeadlineLabel(p.bettingDeadline)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant/35 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-on-surface-variant font-medium">Inscrição</span>
                        <span className="font-bold text-on-surface">R$ {p.entryFee.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-on-surface-variant font-medium">Premiação estimada ({p.maxParticipants || p.memberCount || 0} apostadores)</span>
                        <span className="font-bold text-[#00E676]">R$ {getPoolEstimatedPrizeValue(p, tenantSettings).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Financial details specific to this pool */}
                    <div className="bg-[#090D14]/80 p-2.5 rounded-lg border border-[#1f2937] flex flex-col gap-1.5 mt-2 text-[10px]">
                      <div className="flex justify-between items-center text-on-surface-variant">
                        <span>Limite Participantes:</span>
                        <span className="font-bold text-white">{p.maxParticipants || 100} apostadores</span>
                      </div>
                      <div className="flex justify-between items-center text-on-surface-variant">
                        <span>Comissão da Banca:</span>
                        <span className="font-bold text-[#ffe16d]">
                          {p.feeType === 'fixed' 
                            ? `R$ ${(p.feeValue || 0).toFixed(2)} fixo` 
                            : `${p.feeValue || 20}%`
                          }
                        </span>
                      </div>
                      
                      {/* Calculate pool specific maximum prize values */}
                      {(() => {
                        const fee = p.entryFee;
                        const maxP = p.maxParticipants || 100;
                        const fType = p.feeType || 'percent';
                        const fVal = p.feeValue || 20;
                        const pPool = maxP * fee;
                        const pComm = fType === 'percent' ? pPool * (fVal / 100) : maxP * fVal;
                        const netP = Math.max(0, pPool - pComm);
                        
                        return (
                          <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-[#1f2937]/50 mt-1 text-[9px] text-on-surface-variant">
                            <div>
                              <span className="block opacity-75">1º Lugar:</span>
                              <span className="font-semibold text-white">R$ {(netP * (tenantSettings.firstPlacePct / 100)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div>
                              <span className="block opacity-75">2º Lugar:</span>
                              <span className="font-semibold text-white">R$ {(netP * (tenantSettings.secondPlacePct / 100)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div>
                              <span className="block opacity-75">3º Lugar:</span>
                              <span className="font-semibold text-white">R$ {(netP * (tenantSettings.thirdPlacePct / 100)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )) : null}
              </div>
            </div>
          </div>
        )}

        {activeAdminTab === 'times' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface text-white">Tabela Geral das 48 Seleções (Copa 2026)</h2>
              <p className="text-xs text-on-surface-variant mt-1">Exibição de todos os times configurados no sistema e seus respectivos grupos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)).map(g => {
                const groupName = `Grupo ${g}`;
                const groupTeams = COPA_2026_TEAMS.filter(t => t.group === groupName);

                return (
                  <div key={groupName} className="bg-[#161B22] border border-[#1f2937] p-4 rounded-xl flex flex-col gap-3">
                    <h3 className="font-bold text-sm text-[#00E676] border-b border-[#1f2937] pb-1.5 uppercase tracking-wider">
                      {groupName}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {groupTeams.map(t => (
                        <div key={t.code} className="flex items-center justify-between text-xs py-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base select-none leading-none">{t.flag}</span>
                            <span className="text-on-surface font-semibold">{t.name}</span>
                          </div>
                          <span className="font-mono font-bold text-on-surface-variant text-[11px] bg-[#090D14] px-1.5 py-0.5 rounded">
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

      {/* --- HOLD-TO-CONFIRM Score Definition Modal: O3 --- */}
      {selectedMatchForScore && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-[105] flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant rounded-xl w-full max-w-md p-6 flex flex-col relative overflow-hidden shadow-2xl">
            {/* Header top close */}
            <button 
              onClick={() => setSelectedMatchForScore(null)}
              className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface cursor-pointer focus:outline-none"
            >
              Fechar ×
            </button>

            <div className="text-center mb-6">
              <span className="text-[9px] bg-[#ffdb3c]/15 text-[#ffe16d] border border-[#ffdb3c]/30 px-2.5 py-0.5 rounded uppercase font-bold tracking-widest block w-fit mx-auto">VAR Homologation</span>
              <h3 className="text-lg font-bold text-on-surface mt-2">
                {selectedMatchForScore.group === 'PÓDIO' ? 'Definir Seleção do Pódio' : 'Definir Placar Oficial'}
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">Essa alteração recalcula imediatamente toda a classificação geral do bolão.</p>
            </div>

            {/* Inputs inputs */}
            {selectedMatchForScore.group === 'PÓDIO' ? (
              <div className="flex flex-col gap-3 w-full bg-[#090C10] p-4 rounded-xl border border-outline-variant mb-6">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block text-center">
                  Selecione a Seleção para {selectedMatchForScore.teamA} ({selectedMatchForScore.teamB}):
                </span>
                <SearchableTeamSelect
                  selectedTeamCode={
                    (() => {
                      const idx = parseInt(scoreInputA);
                      return !isNaN(idx) && COPA_2026_TEAMS[idx] ? COPA_2026_TEAMS[idx].code : null;
                    })()
                  }
                  onChange={(code) => {
                    const idx = COPA_2026_TEAMS.findIndex(t => t.code === code);
                    setScoreInputA(idx !== -1 ? idx.toString() : '0');
                  }}
                  placeholder="Selecione o país..."
                />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4 bg-[#090C10] p-4 rounded-xl border border-outline-variant mb-6">
                <div className="flex flex-col items-center gap-2">
                  <span className="font-mono text-xs font-bold">{selectedMatchForScore.teamA}</span>
                  <input 
                    type="number" 
                    value={scoreInputA} 
                    onChange={(e) => setScoreInputA(e.target.value)}
                    className="w-14 h-14 text-center font-display-score text-xl font-extrabold bg-surface border border-outline-variant rounded-lg focus:border-[#00e676]"
                  />
                </div>

                <span className="font-bold text-on-surface-variant text-xl">×</span>

                <div className="flex flex-col items-center gap-2">
                  <span className="font-mono text-xs font-bold">{selectedMatchForScore.teamB}</span>
                  <input 
                    type="number" 
                    value={scoreInputB} 
                    onChange={(e) => setScoreInputB(e.target.value)}
                    className="w-14 h-14 text-center font-display-score text-xl font-extrabold bg-surface border border-outline-variant rounded-lg focus:border-[#00e676]"
                  />
                </div>
              </div>
            )}

            {/* Hold-to-confirm visual feedback progress block: exactly specified under O3 */}
            <div className="flex flex-col gap-2 w-full">
              <div className="text-center text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                Matenha pressionado o botão por 1.5s para Homologar
              </div>

              {/* Progress bar line */}
              <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden border border-outline-variant/35 relative">
                <div 
                  className="h-full bg-gradient-to-r from-[#00E676]/40 to-[#00E676] transition-all duration-75"
                  style={{ width: `${holdProgress}%` }}
                ></div>
              </div>

              {/* Interactive confirmation action trigger */}
              <button
                onMouseDown={handleHoldStart}
                onMouseUp={handleHoldEnd}
                onMouseLeave={handleHoldEnd}
                onTouchStart={handleHoldStart}
                onTouchEnd={handleHoldEnd}
                className={`w-full h-14 rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase select-none transition-all active:scale-[0.98] ${
                  isHolding.current 
                    ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]' 
                    : 'bg-primary-container text-[#00210b] hover:bg-[#62ff96]'
                }`}
                style={{ cursor: 'pointer' }}
              >
                <Clock className="w-4 h-4 animate-spin-slow" />
                <span>
                  {holdProgress > 0 ? `Homologando... (${holdProgress}%)` : 'Pressione e Segure p/ Homologar'}
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Definir Times Modal */}
      {selectedMatchForTeams && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#161B22] border border-outline-variant rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button 
              onClick={() => setSelectedMatchForTeams(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-white transition-colors cursor-pointer"
            >
              ×
            </button>

            <h3 className="text-xl font-display-score font-bold mb-1">Definir Times do Jogo</h3>
            <p className="text-sm text-on-surface-variant mb-6">Selecione os times que jogarão esta partida do mata-mata.</p>

            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Time Mandante</label>
                <select 
                  value={teamInputA} 
                  onChange={(e) => setTeamInputA(e.target.value)}
                  className="w-full bg-[#090C10] border border-outline-variant rounded-lg p-3 text-sm focus:border-[#00e676] outline-none"
                >
                  <option value="TBD">A Definir (TBD)</option>
                  {COPA_2026_TEAMS.map(team => (
                    <option key={`a-${team.code}`} value={team.name}>{team.flag} {team.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Time Visitante</label>
                <select 
                  value={teamInputB} 
                  onChange={(e) => setTeamInputB(e.target.value)}
                  className="w-full bg-[#090C10] border border-outline-variant rounded-lg p-3 text-sm focus:border-[#00e676] outline-none"
                >
                  <option value="TBD">A Definir (TBD)</option>
                  {COPA_2026_TEAMS.map(team => (
                    <option key={`b-${team.code}`} value={team.name}>{team.flag} {team.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={async () => {
                const teamAData = COPA_2026_TEAMS.find(t => t.name === teamInputA);
                const teamBData = COPA_2026_TEAMS.find(t => t.name === teamInputB);
                
                const flagA = teamAData ? (FLAG_MAP[teamAData.code] || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop') : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop';
                const flagB = teamBData ? (FLAG_MAP[teamBData.code] || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop') : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop';
                
                if (updateMatchTeams) {
                  const success = await updateMatchTeams(selectedMatchForTeams.id, teamInputA, flagA, teamInputB, flagB);
                  if (success) {
                    alert('Times atualizados com sucesso!');
                    setSelectedMatchForTeams(null);
                    return;
                  }

                  alert('Nao foi possivel atualizar os times desta partida no banco de dados.');
                }
              }}
              className="w-full py-3 bg-primary-container text-[#00210b] font-bold rounded-lg hover:bg-[#62ff96] transition-colors"
            >
              Salvar Times
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
