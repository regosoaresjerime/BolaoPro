/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Match, Participant, AlertNotification, TenantSettings, Transaction, Pool, UserPick, TournamentPodiumEntry } from '../types';
import { INITIAL_MATCHES } from '../data/mockData';
import { COPA_2026_TEAMS } from '../data/teams';
import {
  buildDefaultTournamentPodium,
  PODIUM_SLOT_CONFIG,
  PODIUM_TOURNAMENT_KEY
} from './podiumRanking';
import {
  buildPublicPodiumRanking,
  buildPublicScoreRanking,
  getPrizePlacesCount
} from './rankingEngine';

// Helper to store in localStorage when Supabase is not configured
const STORAGE_KEYS = {
  USER: 'bpro_user',
  MATCHES: 'bpro_matches',
  RANKING: 'bpro_ranking',
  ALERTS: 'bpro_alerts',
  SETTINGS: 'bpro_settings',
  TRANS: 'bpro_transactions',
  WALLET: 'bpro_bettor_wallet',
  POOL_ENTRIES: 'bpro_pool_entries'
};

const DEFAULT_PIX_EXPIRATION_MS = 24 * 60 * 60 * 1000;

type PixTransactionRecord = {
  id: string;
  user_id?: string | null;
  group_id?: string | null;
  amount?: number | string | null;
  status?: string | null;
  payment_method?: string | null;
  pagbank_id?: string | null;
  qrcode_text?: string | null;
  qrcode_image?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  expires_at?: string | null;
};

export type RecoverablePixTransaction = {
  transactionId: string;
  groupId: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'expired';
  qrcodeText: string;
  qrcodeImage: string;
  pagbankId?: string;
  createdAt?: string;
  expiresAt: string;
};

export type BettorWalletSummary = {
  balance: number;
};

export type PixChargeHistoryItem = RecoverablePixTransaction & {
  groupName?: string;
};

function resolvePixExpiration(createdAt?: string | null, explicitExpiresAt?: string | null) {
  if (explicitExpiresAt) return explicitExpiresAt;

  const createdAtTs = createdAt ? new Date(createdAt).getTime() : Date.now();
  return new Date(createdAtTs + DEFAULT_PIX_EXPIRATION_MS).toISOString();
}

function normalizePixStatus(status?: string | null): RecoverablePixTransaction['status'] {
  if (status === 'paid' || status === 'failed' || status === 'canceled' || status === 'expired') {
    return status;
  }
  return 'pending';
}

function mapPixTransactionRecord(record: PixTransactionRecord): RecoverablePixTransaction | null {
  if (!record.id || !record.group_id) return null;

  return {
    transactionId: record.id,
    groupId: record.group_id,
    amount: parseFloat(String(record.amount ?? 0)) || 0,
    status: normalizePixStatus(record.status),
    qrcodeText: record.qrcode_text || '',
    qrcodeImage: record.qrcode_image || '',
    pagbankId: record.pagbank_id || undefined,
    createdAt: record.created_at || undefined,
    expiresAt: resolvePixExpiration(record.created_at, record.expires_at)
  };
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function isPodiumMatchRecord(match: {
  team_a?: string | null;
  team_b?: string | null;
  team_a_flag?: string | null;
  team_b_flag?: string | null;
}) {
  const podiumPairs = new Set([
    '1º Lugar::Campeão',
    '2º Lugar::Vice-Campeão',
    '3º Lugar::3º Colocado',
    '4º Lugar::4º Colocado'
  ]);
  const podiumIcons = new Set(['🏆', '🥈', '🥉', '🏅']);
  const pairKey = `${match.team_a || ''}::${match.team_b || ''}`;

  return podiumPairs.has(pairKey)
    || podiumIcons.has(match.team_a_flag || '')
    || podiumIcons.has(match.team_b_flag || '');
}

const TEMPORARY_PODIUM_TEAM_CODES = {
  '00000000-0000-0000-0000-9999a0d11111': 'ARG',
  '00000000-0000-0000-0000-9999a0d22222': 'ESP',
  '00000000-0000-0000-0000-9999a0d33333': 'FRA',
  '00000000-0000-0000-0000-9999a0d44444': 'ENG'
} as const;

function resolveTeamMetadata(teamRef?: string | null, teamFlag?: string | null) {
  const normalizedRef = (teamRef || '').trim();
  const resolvedTeam = COPA_2026_TEAMS.find(
    (team) => team.code === normalizedRef || team.name === normalizedRef
  );

  return {
    teamCode: resolvedTeam?.code || normalizedRef || null,
    teamName: resolvedTeam?.name || normalizedRef || null,
    teamFlag: resolvedTeam?.flag || teamFlag || null
  };
}

type MatchRecord = {
  id: string;
  group_id?: string | null;
  team_a?: string | null;
  team_b?: string | null;
  team_a_flag?: string | null;
  team_b_flag?: string | null;
  status?: string | null;
  score_a?: number | null;
  score_b?: number | null;
  started_at?: string | null;
};

function normalizeLookupToken(value?: string | null) {
  return (value || '').trim().toLocaleLowerCase('pt-BR');
}

function normalizeLabelToken(value?: string | null) {
  return normalizeLookupToken(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ');
}

function buildMatchLookupKey(match: Pick<MatchRecord, 'team_a' | 'team_b' | 'started_at'>) {
  return [
    normalizeLookupToken(match.team_a),
    normalizeLookupToken(match.team_b),
    match.started_at || ''
  ].join('::');
}

function mapRecordToMatch(raw: MatchRecord): Match {
  const startedAt = raw.started_at || new Date().toISOString();

  return {
    id: raw.id,
    group: isPodiumMatchRecord(raw)
      ? 'PÓDIO'
      : (raw.group_id ? 'Grupo do Bolão' : 'Rodada Oficial • ' + new Date(startedAt).toLocaleDateString('pt-BR')),
    dateText: new Date(startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    teamA: raw.team_a || '',
    teamB: raw.team_b || '',
    teamAFlag: raw.team_a_flag || '',
    teamBFlag: raw.team_b_flag || '',
    status: (raw.status as Match['status']) || 'scheduled',
    scoreA: raw.score_a ?? null,
    scoreB: raw.score_b ?? null,
    startedAt,
    winProbability: { a: 45, draw: 30, b: 25 }
  };
}

function mergeGroupMatchWithOfficialResult(groupMatch: MatchRecord, officialMatchesByKey: Map<string, MatchRecord>) {
  if (!groupMatch.group_id || isPodiumMatchRecord(groupMatch)) {
    return groupMatch;
  }

  const officialMatch = officialMatchesByKey.get(buildMatchLookupKey(groupMatch));
  if (!officialMatch) return groupMatch;

  return {
    ...groupMatch,
    status: officialMatch.status,
    score_a: officialMatch.score_a,
    score_b: officialMatch.score_b,
    started_at: officialMatch.started_at || groupMatch.started_at,
    team_a_flag: officialMatch.team_a_flag || groupMatch.team_a_flag,
    team_b_flag: officialMatch.team_b_flag || groupMatch.team_b_flag
  };
}

function resolvePodiumLegacyMatchId(match?: Pick<MatchRecord, 'id' | 'team_a' | 'team_b'> | null) {
  if (!match?.id) return null;

  const directSlot = PODIUM_SLOT_CONFIG.find((slot) => slot.legacyMatchId === match.id);
  if (directSlot) return directSlot.legacyMatchId;

  const resolvedSlot = PODIUM_SLOT_CONFIG.find(
    (slot) =>
      normalizeLabelToken(slot.positionLabel) === normalizeLabelToken(match.team_a)
      && normalizeLabelToken(slot.subtitle) === normalizeLabelToken(match.team_b)
  );

  return resolvedSlot?.legacyMatchId || null;
}

async function loadProfilesByIds(userIds: string[]) {
  const profilesById = new Map<string, { full_name: string; avatar_url: string | null }>();

  if (!isSupabaseConfigured || !supabase || userIds.length === 0) {
    return profilesById;
  }

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  (profilesData || []).forEach((profile: any) => {
    profilesById.set(profile.id, {
      full_name: profile.full_name,
      avatar_url: profile.avatar_url
    });
  });

  return profilesById;
}

export class SupabaseService {
  static async syncOfficialSchedule(userId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase || !userId) return false;

    try {
      const officialMatches = INITIAL_MATCHES.filter((match) => match.group !== 'PÓDIO');
      const podiumMatches = INITIAL_MATCHES.filter((match) => match.group === 'PÓDIO');
      const scheduleIds = INITIAL_MATCHES.map((match) => match.id);

      const { data: existingMatches, error } = await supabase
        .from('matches')
        .select('id, team_a, team_b, status, score_a, score_b')
        .in('id', scheduleIds);

      if (error) throw error;

      const existingIds = new Set((existingMatches || []).map((match) => match.id));
      const malformedOfficialMatches = (existingMatches || []).filter((match) =>
        !isPodiumMatchRecord(match)
        && match.status === 'scheduled'
        && match.score_a === null
        && match.score_b === null
        && (
          (match.team_a || '').trim() === '(Vencedor do Jogo'
          || (match.team_a || '').trim() === '(Perdedor do Jogo'
          || !(match.team_b || '').trim()
        )
      );
      const missingOfficialMatches = officialMatches.filter((match) => !existingIds.has(match.id));
      const missingPodiumMatches = podiumMatches.filter((match) => !existingIds.has(match.id));

      const matchesToInsert = [
        ...missingOfficialMatches.map((match) => ({
          id: match.id,
          tenant_id: userId,
          group_id: null,
          team_a: match.teamA,
          team_b: match.teamB,
          team_a_flag: match.teamAFlag || null,
          team_b_flag: match.teamBFlag || null,
          status: match.status,
          score_a: match.scoreA,
          score_b: match.scoreB,
          started_at: match.startedAt,
          updated_at: new Date().toISOString()
        })),
        ...missingPodiumMatches.map((match) => {
          const teamCode = TEMPORARY_PODIUM_TEAM_CODES[match.id as keyof typeof TEMPORARY_PODIUM_TEAM_CODES];
          const teamIndex = COPA_2026_TEAMS.findIndex((team) => team.code === teamCode);

          return {
            id: match.id,
            tenant_id: userId,
            group_id: null,
            team_a: match.teamA,
            team_b: match.teamB,
            team_a_flag: match.teamAFlag || null,
            team_b_flag: match.teamBFlag || null,
            status: 'scheduled',
            score_a: teamIndex >= 0 ? teamIndex : 0,
            score_b: 0,
            started_at: match.startedAt,
            updated_at: new Date().toISOString()
          };
        })
      ];

      if (matchesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('matches')
          .insert(matchesToInsert);

        if (insertError) throw insertError;
      }

      for (const malformedMatch of malformedOfficialMatches) {
        const canonicalMatch = officialMatches.find((match) => match.id === malformedMatch.id);
        if (!canonicalMatch) continue;

        const { error: repairError } = await supabase
          .from('matches')
          .update({
            team_a: canonicalMatch.teamA,
            team_b: canonicalMatch.teamB,
            team_a_flag: canonicalMatch.teamAFlag || null,
            team_b_flag: canonicalMatch.teamBFlag || null,
            started_at: canonicalMatch.startedAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', malformedMatch.id);

        if (repairError) throw repairError;
      }

      return true;
    } catch (err) {
      console.error('Error syncing official schedule:', err);
      return false;
    }
  }

  static serializePoolName(pool: Pool): string {
    return `${pool.name} ::: ${pool.entryFee} | ${pool.feeType || 'percent'} | ${pool.feeValue || 20} | ${pool.maxParticipants || 100} | ${pool.description} | ${pool.modality || 'score'} | ${pool.bettingDeadline || ''}`;
  }

  static async findProfileByAuthUser(
    authUserId?: string,
    email?: string
  ): Promise<{
    id?: string;
    user_id?: string | null;
    full_name?: string | null;
    is_admin?: boolean | null;
    cpf?: string | null;
    telefone?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null> {
    if (!isSupabaseConfigured || !supabase || !authUserId) return null;

    const baseSelect = 'id, user_id, full_name, is_admin, cpf, telefone, email, avatar_url';

    const { data: byUserId } = await supabase
      .from('profiles')
      .select(baseSelect)
      .eq('user_id', authUserId)
      .maybeSingle();
    if (byUserId) return byUserId;

    const { data: byId } = await supabase
      .from('profiles')
      .select(baseSelect)
      .eq('id', authUserId)
      .maybeSingle();
    if (byId) return byId;

    if (email) {
      const { data: byEmail } = await supabase
        .from('profiles')
        .select(baseSelect)
        .eq('email', email)
        .maybeSingle();
      if (byEmail) return byEmail;
    }

    return null;
  }

  /**
   * Auth: Sign up a new user / bettor
   */
  static async signUp(
    fullName: string,
    email: string,
    password?: string,
    cpf?: string,
    telefone?: string
  ): Promise<{ user: { id: string; fullName: string; email: string; isAdmin?: boolean; cpf?: string; telefone?: string } | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      // Offline fallback: generate fake uuid
      const mockId = `mock-usr-${Math.random().toString(36).substring(2, 9)}`;
      const isAdminUser = email === 'jerime.rego@gmail.com' || email === 'organizador@bolaopro.com.br';
      const newUser = { id: mockId, fullName, email, isAdmin: isAdminUser, cpf, telefone };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      return { user: newUser };
    }

    try {
      // Create user auth in Supabase Autenticação nativa
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || 'TemporaryBPROPass123!',
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) throw error;

      if (data?.user) {
        const isAdminUser = email === 'jerime.rego@gmail.com' || email === 'organizador@bolaopro.com.br';
        // Upsert standard profile (com cpf e telefone para uso no PagBank)
        // Importante: a RLS desta tabela valida `auth.uid() = user_id`, então
        // precisamos gravar `id = data.user.id` E `user_id = data.user.id`
        // (a coluna user_id existe separada da PK id).
        const profilePayload = {
          id: data.user.id,
          user_id: data.user.id,
          full_name: fullName,
          email: email,
          cpf: cpf ? cpf.replace(/\D/g, '') : null,
          telefone: telefone ? telefone.replace(/\D/g, '') : null,
          balance: 0.00,
          total_points: 0,
          is_admin: isAdminUser
        };

        // Usa upsert para evitar erro de PK duplicada (usuário já existia no auth mas não tinha perfil)
        let { error: profileError } = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' });

        // Erro 23505 = violação de unique constraint (ex: idx_profiles_cpf_unique)
        // CPF já cadastrado em outro perfil — cria o perfil sem CPF e avisa para atualizar depois
        if (profileError && profileError.code === '23505' && profileError.message?.includes('cpf')) {
          console.warn('[signUp] CPF já existe em outro perfil, criando perfil sem CPF:', profileError);
          const { error: retryError } = await supabase
            .from('profiles')
            .upsert({ ...profilePayload, cpf: null }, { onConflict: 'id' });
          if (retryError) {
            console.error('[signUp] Erro ao criar perfil mesmo sem CPF:', retryError);
          } else {
            return {
              user: {
                id: data.user.id,
                fullName,
                email,
                isAdmin: isAdminUser,
                cpf: undefined,
                telefone
              },
              error: 'Conta criada, mas o CPF informado já está associado a outro perfil. Você pode atualizá-lo na tela de perfil.'
            };
          }
        } else if (profileError) {
          console.error('[signUp] Error upserting profile:', profileError);
        }

        return {
          user: {
            id: data.user.id,
            fullName,
            email,
            isAdmin: isAdminUser,
            cpf,
            telefone
          }
        };
      }
      return { user: null, error: 'Inscrição efetuada. Aguardando confirmação ou login direto.' };
    } catch (err: any) {
      console.error('Supabase sign up error:', err);
      return { user: null, error: err.message };
    }
  }

  /**
   * Auth: Sign in existing user with email and password
   */
  static async signIn(email: string, password?: string): Promise<{ user: { id: string; fullName: string; email: string; isAdmin?: boolean; cpf?: string; telefone?: string } | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      // Local fallback: apenas lê o usuário já em cache; nunca cria mock user.
      // Sem Supabase configurado, não há como validar a senha — bloqueia o login.
      const cached = localStorage.getItem(STORAGE_KEYS.USER);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.email === email) {
            return { user: parsed };
          }
        } catch { /* fallthrough */ }
      }
      return { user: null, error: 'Login indisponível no modo local. Configure o Supabase para autenticar.' };
    }

    try {
      if (password) {
        // Limpa qualquer sessão anterior antes de tentar novo login.
        // Garante que credenciais erradas não reaproveitem token em cache.
        await supabase.auth.signOut();

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        if (data?.user) {
          const profile = await SupabaseService.findProfileByAuthUser(
            data.user.id,
            data.user.email || email
          );

          const isAdminUser = profile?.is_admin || email === 'jerime.rego@gmail.com' || email === 'organizador@bolaopro.com.br';

          return {
            user: {
              id: data.user.id,
              fullName: profile?.full_name || email.split('@')[0],
              email: data.user.email || email,
              isAdmin: isAdminUser,
              cpf: profile?.cpf || undefined,
              telefone: profile?.telefone || undefined
            }
          };
        }
      } else {
        // Standard OTP fallback
        const { data, error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          }
        });

        if (error) throw error;
        return { user: null, error: 'Link de login enviado para seu e-mail!' };
      }
      return { user: null, error: 'Credenciais inválidas.' };
    } catch (err: any) {
      console.error('Supabase sign in error:', err);
      return { user: null, error: err.message };
    }
  }

  /**
   * Update payment data (CPF and telefone) of a user profile.
   * Used on the Profile screen to fill the data required by PagBank.
   */
  static async updateUserPaymentData(
    userId: string,
    cpf: string,
    telefone: string
  ): Promise<{ error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      // Local fallback: atualiza localStorage
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.USER);
        if (raw) {
          const u = JSON.parse(raw);
          u.cpf = cpf;
          u.telefone = telefone;
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(u));
        }
      } catch { /* ignore */ }
      return { error: undefined };
    }
    try {
      // Sanitiza antes de mandar (somente dígitos)
      const cpfDigits = cpf.replace(/\D/g, '');
      const phoneDigits = telefone.replace(/\D/g, '');

      // Tenta UPDATE primeiro por user_id (coluna validada pelas policies RLS)
      let result = await supabase
        .from('profiles')
        .update({ cpf: cpfDigits, telefone: phoneDigits, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select('id, user_id, cpf, telefone');

      let data = result.data;
      let error = result.error;

      // Se o RLS não retornou nada por user_id, tenta por id (PK) — policy
      // foi ajustada para também aceitar auth.uid() = id
      if (!error && (!data || data.length === 0)) {
        const fallback = await supabase
          .from('profiles')
          .update({ cpf: cpfDigits, telefone: phoneDigits, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .select('id, user_id, cpf, telefone');
        if (!fallback.error && fallback.data && fallback.data.length > 0) {
          data = fallback.data;
        }
      }

      if (error) {
        console.error('[updateUserPaymentData] UPDATE error:', error);
        return { error: `${error.message} (code=${error.code}, hint=${error.hint ?? '-'})` };
      }
      if (!data || data.length === 0) {
        // Diagnóstico: verifica se o profile existe E se a sessão Supabase tem uid
        const { data: { session } } = await supabase.auth.getSession();
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, user_id, cpf, telefone')
          .or(`user_id.eq.${userId},id.eq.${userId}`)
          .maybeSingle();
        return {
          error:
            'UPDATE não afetou nenhuma linha. Provável bloqueio de RLS no UPDATE. ' +
            `Sessão ativa: ${!!session?.user} (uid=${session?.user?.id ?? 'null'}). ` +
            `Profile localizado: ${!!existing} (user_id=${existing?.user_id ?? 'null'}, id=${existing?.id ?? 'null'}).`
        };
      }
      console.log('[updateUserPaymentData] OK:', data);
      return { error: undefined };
    } catch (err: any) {
      console.error('updateUserPaymentData unexpected error:', err);
      return { error: err?.message || String(err) };
    }
  }

  /**
   * Fetch All Matches for user (respecting Tenant context)
   */
  static async fetchMatches(tenantGroupId?: string): Promise<Match[] | null> {
    if (!isSupabaseConfigured || !supabase) {
      const offlineMatches = localStorage.getItem(STORAGE_KEYS.MATCHES);
      return offlineMatches ? JSON.parse(offlineMatches) : null;
    }

    try {
      let query = supabase.from('matches').select('*');
      if (tenantGroupId) {
        query = query.eq('group_id', tenantGroupId);
      }
      
      const { data, error } = await query.order('started_at', { ascending: true });
      if (error) throw error;

      let officialMatchesData = (data || []).filter((match: any) => !match.group_id);

      if (tenantGroupId) {
        const { data: globalMatchesData, error: globalMatchesError } = await supabase
          .from('matches')
          .select('id, group_id, team_a, team_b, team_a_flag, team_b_flag, status, score_a, score_b, started_at')
          .is('group_id', null);

        if (globalMatchesError) throw globalMatchesError;
        officialMatchesData = globalMatchesData || [];
      }

      const officialMatchesByKey = new Map<string, MatchRecord>();
      officialMatchesData
        .filter((match: any) => !isPodiumMatchRecord(match))
        .forEach((match: any) => {
          officialMatchesByKey.set(buildMatchLookupKey(match), match);
        });

      // Map back to local Match models
      return (data || []).map((m: any) => mapRecordToMatch(mergeGroupMatchWithOfficialResult(m, officialMatchesByKey)));
    } catch (err) {
      console.error('Error fetching matches:', err);
      return null;
    }
  }

  /**
   * Save a user's bet/pick (uses Debounce flow in UI, this is the final insert)
   */
  static async savePick(userId: string, groupId: string, matchId: string, scoreA: number, scoreB: number, betId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      // Local caching of picks
      const picksKey = `bpro_picks_${userId}`;
      const existingPicks = JSON.parse(localStorage.getItem(picksKey) || '[]');
      const updatedAt = new Date().toISOString();
      const newPick = { id: `local_${Date.now()}`, matchId, groupId, betId, scoreA, scoreB, saved: true, updatedAt };
      
      // Remover picks idênticos existentes ou da mesma aposta (betId)
      const filteredPicks = existingPicks.filter((p: any) => {
        if (betId && p.betId === betId && p.matchId === matchId) return false;
        return !(p.groupId === groupId && p.matchId === matchId && p.scoreA === scoreA && p.scoreB === scoreB);
      });
      
      // Limitar a 30 picks por bolão
      const groupPicks = filteredPicks.filter((p: any) => p.groupId === groupId);
      if (groupPicks.length >= 30) {
        console.error('Limite de 30 palpites por bolão atingido');
        return false;
      }
      
      localStorage.setItem(picksKey, JSON.stringify([...filteredPicks, newPick]));
      return true;
    }

    // Verificar se é um ID de pódio (UUIDs fixos para as posições do pódio)
    const isPodiumMatch = matchId.startsWith('00000000-0000-0000-0000-9999a0d');
    
    // Fallback: Garantir que as partidas dummy de pódio existam antes de salvar
    if (isPodiumMatch) {
      try {
        // Buscar as partidas de pódio para este bolão
        // Usar eq em vez de like para UUIDs
        const { data: existingMatches } = await supabase
          .from('matches')
          .select('id')
          .eq('group_id', groupId);
        
        // Filtrar apenas os IDs de pódio
        const podiumMatchIds = [
          '00000000-0000-0000-0000-9999a0d11111',
          '00000000-0000-0000-0000-9999a0d22222',
          '00000000-0000-0000-0000-9999a0d33333',
          '00000000-0000-0000-0000-9999a0d44444'
        ];
        const existingPodiumMatches = existingMatches?.filter(m => 
          podiumMatchIds.includes(m.id)
        ) || [];
        
        // Se não existir, criar as 4 partidas de pódio
        if (existingPodiumMatches.length < 4) {
          console.log('[savePick] Criando partidas de pódio para o bolão:', groupId);
          
          // Obter o tenant_id do bolão para manter a consistência
          const { data: poolData } = await supabase
            .from('bolao_groups')
            .select('tenant_id')
            .eq('id', groupId)
            .single();
          
          const tenantId = poolData?.tenant_id || userId;
          
          const dummyMatches = [
            { id: '00000000-0000-0000-0000-9999a0d11111', tenant_id: tenantId, group_id: groupId, team_a: '1º Lugar', team_b: 'Campeão', team_a_flag: '🏆', team_b_flag: '🏆', status: 'scheduled', started_at: '2026-07-19T12:00:00.000Z' },
            { id: '00000000-0000-0000-0000-9999a0d22222', tenant_id: tenantId, group_id: groupId, team_a: '2º Lugar', team_b: 'Vice-Campeão', team_a_flag: '🥈', team_b_flag: '🥈', status: 'scheduled', started_at: '2026-07-19T12:00:00.000Z' },
            { id: '00000000-0000-0000-0000-9999a0d33333', tenant_id: tenantId, group_id: groupId, team_a: '3º Lugar', team_b: '3º Colocado', team_a_flag: '🥉', team_b_flag: '🥉', status: 'scheduled', started_at: '2026-07-19T12:00:00.000Z' },
            { id: '00000000-0000-0000-0000-9999a0d44444', tenant_id: tenantId, group_id: groupId, team_a: '4º Lugar', team_b: '4º Colocado', team_a_flag: '🏅', team_b_flag: '🏅', status: 'scheduled', started_at: '2026-07-19T12:00:00.000Z' }
          ];
          
          // Inserir cada partida que não existe usando upsert
          for (const match of dummyMatches) {
            const exists = existingPodiumMatches.some(m => m.id === match.id);
            if (!exists) {
              const { error: insertError } = await supabase
                .from('matches')
                .upsert(match, { onConflict: 'id' });
              if (insertError) {
                console.error('[savePick] Erro ao inserir partida de pódio:', insertError);
              }
            }
          }
        }
      } catch (e) {
        console.error('[savePick] Erro ao criar partidas de pódio:', e);
        // Continua mesmo se falhar - tenta salvar o palpite
      }
    }

    try {
      // Usar upsert para que se for a mesma aposta (bet_id) e partida (match_id), ele atualize
      const { error } = await supabase
        .from('user_picks')
        .upsert({
          user_id: userId,
          group_id: groupId,
          match_id: matchId,
          bet_id: betId || `legacy_${Date.now()}`,
          score_a: scoreA,
          score_b: scoreB,
          updated_at: new Date().toISOString()
        }, { onConflict: 'bet_id, match_id' });

      if (error) {
        // Se ainda der erro 23503 (FK), significa que a partida não existe
        if (error.code === '23503') {
          console.error('[savePick] Foreign key error - partida não existe:', error);
          return false;
        }
        throw error;
      }
      return true;
    } catch (err: any) {
      // duplicate key - o palpite já existe, tratar como sucesso
      if (err.code === '23505' || err.code === '409') {
        console.log('[savePick] Palpite já existe, tratando como sucesso');
        return true;
      }
      console.error('Error saving pick to Supabase:', err);
      return false;
    }
  }

  /**
   * Fetch specific picks made by user, grouped by groupId
   */
  static async fetchUserPicks(userId: string): Promise<Record<string, UserPick[]> | null> {
    if (!isSupabaseConfigured || !supabase) {
      // Local caching of picks
      const picksKey = `bpro_picks_${userId}`;
      const cachedPicks = JSON.parse(localStorage.getItem(picksKey) || '[]');
      
      const result: Record<string, UserPick[]> = {};
      cachedPicks.forEach((p: any) => {
        if (!result[p.groupId]) {
          result[p.groupId] = [];
        }
        result[p.groupId].push({
          id: p.id,
          matchId: p.matchId,
          groupId: p.groupId,
          betId: p.betId,
          scoreA: p.scoreA,
          scoreB: p.scoreB,
          saved: true,
          updatedAt: p.updatedAt
        });
      });
      
      return result;
    }

    try {
      const { data, error } = await supabase
        .from('user_picks')
        .select('id, match_id, group_id, bet_id, score_a, score_b, updated_at')
        .eq('user_id', userId);

      if (error) throw error;

      const result: Record<string, UserPick[]> = {};
      data?.forEach((p: any) => {
        if (!result[p.group_id]) {
          result[p.group_id] = [];
        }
        result[p.group_id].push({
          id: p.id,
          matchId: p.match_id,
          groupId: p.group_id,
          betId: p.bet_id,
          scoreA: p.score_a,
          scoreB: p.score_b,
          saved: true,
          updatedAt: p.updated_at
        });
      });
      return result;
    } catch (err) {
      console.error('Error fetching picks:', err);
      return null;
    }
  }

  static async fetchTournamentPodium(
    tournamentKey: string = PODIUM_TOURNAMENT_KEY
  ): Promise<TournamentPodiumEntry[]> {
    if (!isSupabaseConfigured || !supabase) {
      return buildDefaultTournamentPodium();
    }

    try {
      const { data, error } = await supabase
        .from('tournament_podium')
        .select(`
          id,
          tournament_key,
          position,
          slot_key,
          position_label,
          subtitle,
          team_code,
          team_name,
          team_flag,
          source_type,
          source_match_id,
          source_match_role,
          is_provisional,
          locked
        `)
        .eq('tournament_key', tournamentKey)
        .order('position', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        return buildDefaultTournamentPodium();
      }

      return data.map((entry: any) => ({
        id: entry.id,
        tournamentKey: entry.tournament_key,
        position: entry.position,
        slotKey: entry.slot_key,
        positionLabel: entry.position_label,
        subtitle: entry.subtitle,
        teamCode: entry.team_code,
        teamName: entry.team_name,
        teamFlag: entry.team_flag,
        sourceType: entry.source_type,
        sourceMatchId: entry.source_match_id,
        sourceMatchRole: entry.source_match_role,
        isProvisional: entry.is_provisional,
        locked: entry.locked
      }));
    } catch (err) {
      console.error('Error fetching tournament podium:', err);
      return buildDefaultTournamentPodium();
    }
  }

  static async fetchPodiumRankingParticipants(
    groupId: string,
    selectedMatchIds: string[],
    podiumEntries: TournamentPodiumEntry[],
    currentUser?: { id?: string; fullName?: string },
    prizeSettings?: { firstPlacePct: number; secondPlacePct: number; thirdPlacePct: number }
  ): Promise<Participant[]> {
    if (!groupId || selectedMatchIds.length === 0) return [];

    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data: groupMatchesData, error: groupMatchesError } = await supabase
        .from('matches')
        .select('id, team_a, team_b')
        .eq('group_id', groupId)
        .in('id', selectedMatchIds);

      if (groupMatchesError) throw groupMatchesError;

      const normalizedPodiumMatchIds = new Map<string, string>();
      (groupMatchesData || []).forEach((match: any) => {
        const normalizedId = resolvePodiumLegacyMatchId(match);
        if (normalizedId) {
          normalizedPodiumMatchIds.set(match.id, normalizedId);
        }
      });

      const normalizedSelectedMatchIds = Array.from(
        new Set(selectedMatchIds.map((matchId) => normalizedPodiumMatchIds.get(matchId) || matchId))
      );

      const { data: picksData, error: picksError } = await supabase
        .from('user_picks')
        .select('user_id, bet_id, match_id, score_a, updated_at')
        .eq('group_id', groupId)
        .in('match_id', selectedMatchIds);

      if (picksError) throw picksError;
      if (!picksData || picksData.length === 0) return [];

      const userIds = Array.from(new Set(picksData.map((pick: any) => pick.user_id).filter(Boolean)));
      const profilesById = await loadProfilesByIds(userIds);
      const prizePlacesCount = getPrizePlacesCount(
        prizeSettings?.firstPlacePct ?? 60,
        prizeSettings?.secondPlacePct ?? 25,
        prizeSettings?.thirdPlacePct ?? 15
      );

      return buildPublicPodiumRanking({
        picks: picksData.map((pick: any) => {
          const profile = profilesById.get(pick.user_id);
          return {
            userId: pick.user_id,
            betId: pick.bet_id,
            matchId: normalizedPodiumMatchIds.get(pick.match_id) || pick.match_id,
            scoreA: pick.score_a,
            updatedAt: pick.updated_at,
            name: profile?.full_name,
            avatarUrl: profile?.avatar_url
          };
        }),
        selectedMatchIds: normalizedSelectedMatchIds,
        podiumEntries,
        currentUserId: currentUser?.id,
        currentUserName: currentUser?.fullName,
        prizePlacesCount,
        official: podiumEntries.length > 0 && podiumEntries.every((entry) => !entry.isProvisional)
      });
    } catch (err) {
      console.error('Error fetching podium ranking participants:', err);
      return [];
    }
  }

  static async fetchScoreRankingParticipants(
    groupId: string,
    selectedMatchIds: string[],
    matches: Match[],
    currentUser?: { id?: string; fullName?: string },
    prizeSettings?: { firstPlacePct: number; secondPlacePct: number; thirdPlacePct: number },
    poolBettingDeadline?: string,
    poolFinalizedAt?: string
  ): Promise<Participant[]> {
    if (!groupId || selectedMatchIds.length === 0) return [];
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data: selectedMatchesData, error: selectedMatchesError } = await supabase
        .from('matches')
        .select('id, group_id, team_a, team_b, team_a_flag, team_b_flag, status, score_a, score_b, started_at')
        .eq('group_id', groupId)
        .in('id', selectedMatchIds);

      if (selectedMatchesError) throw selectedMatchesError;
      if (!selectedMatchesData || selectedMatchesData.length === 0) return [];

      const { data: officialMatchesData, error: officialMatchesError } = await supabase
        .from('matches')
        .select('id, group_id, team_a, team_b, team_a_flag, team_b_flag, status, score_a, score_b, started_at')
        .is('group_id', null);

      if (officialMatchesError) throw officialMatchesError;

      const officialMatchesByKey = new Map<string, MatchRecord>();
      (officialMatchesData || [])
        .filter((match: any) => !isPodiumMatchRecord(match))
        .forEach((match: any) => {
          officialMatchesByKey.set(buildMatchLookupKey(match), match);
        });

      const evaluatedMatches = selectedMatchesData.map((match: any) =>
        mapRecordToMatch(mergeGroupMatchWithOfficialResult(match, officialMatchesByKey))
      );

      // Buscar picks de TODOS os jogos selecionados (não apenas os finalizados)
      // O placar 0x0 inicial da API será usado para calcular o ranking desde o início
      const matchesWithScore = evaluatedMatches
        .filter((match) => selectedMatchIds.includes(match.id) && match.scoreA !== null && match.scoreB !== null)
        .map((match) => match.id);

      if (matchesWithScore.length === 0) return [];

      const { data: picksData, error: picksError } = await supabase
        .from('user_picks')
        .select('user_id, bet_id, match_id, score_a, score_b, updated_at')
        .eq('group_id', groupId)
        .in('match_id', matchesWithScore);

      if (picksError) throw picksError;
      if (!picksData || picksData.length === 0) return [];

      const userIds = Array.from(new Set(picksData.map((pick: any) => pick.user_id).filter(Boolean)));
      const profilesById = await loadProfilesByIds(userIds);
      const prizePlacesCount = getPrizePlacesCount(
        prizeSettings?.firstPlacePct ?? 60,
        prizeSettings?.secondPlacePct ?? 25,
        prizeSettings?.thirdPlacePct ?? 15
      );

      // Um bolão é oficial se: foi encerrado manualmente (finalizedAt definido)
      // OU se já passaram 3 horas do prazo limite de apostas
      const now = Date.now();
      const deadlinePlusThreeHours = poolBettingDeadline
        ? new Date(poolBettingDeadline).getTime() + 3 * 60 * 60 * 1000
        : null;
      const official =
        !!poolFinalizedAt ||
        (deadlinePlusThreeHours !== null && now >= deadlinePlusThreeHours);

      return buildPublicScoreRanking({
        picks: picksData.map((pick: any) => {
          const profile = profilesById.get(pick.user_id);
          return {
            userId: pick.user_id,
            betId: pick.bet_id,
            matchId: pick.match_id,
            scoreA: pick.score_a,
            scoreB: pick.score_b,
            updatedAt: pick.updated_at,
            name: profile?.full_name,
            avatarUrl: profile?.avatar_url
          };
        }),
        selectedMatchIds: matchesWithScore,
        matches: evaluatedMatches,
        currentUserId: currentUser?.id,
        currentUserName: currentUser?.fullName,
        prizePlacesCount,
        official
      });
    } catch (err) {
      console.error('Error fetching score ranking participants:', err);
      return [];
    }
  }


  /**
   * Finaliza um bolão manualmente (banca encerra antes do prazo de 3h).
   * Salva a data/hora de encerramento no campo finalized_at da tabela bolao_groups.
   */
  static async finalizePool(poolId: string): Promise<{ success: boolean; error?: string }> {
    if (!poolId) return { success: false, error: 'ID do bolão inválido.' };
    if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Supabase não configurado.' };

    try {
      const { error } = await supabase
        .from('bolao_groups')
        .update({ finalized_at: new Date().toISOString() })
        .eq('id', poolId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Error finalizing pool:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Save general Tenant configurations (Admin settings)
   */
  static async saveTenantSettings(tenantId: string, settings: TenantSettings): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    }

    try {
      const { error } = await supabase
        .from('tenant_settings')
        .upsert({
          tenant_id: tenantId,
          company_name: settings.companyName,
          fee_type: settings.feeType,
          fee_value: settings.feeValue,
          entry_fee: settings.entryFee,
          min_withdrawal: settings.minWithdrawal,
          first_place_pct: settings.firstPlacePct,
          second_place_pct: settings.secondPlacePct,
          third_place_pct: settings.thirdPlacePct
        }, { onConflict: 'tenant_id' });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating settings:', err);
      return false;
    }
  }

  /**
   * Create a Pix Payment session and save transaction
   */
  static async createPixTransaction(
    userId: string,
    groupId: string,
    amount: number,
    copiaECola: string,
    qrCodeImg: string
  ): Promise<string | null> {
    if (!isSupabaseConfigured || !supabase) {
      const cached = localStorage.getItem(STORAGE_KEYS.TRANS) || '[]';
      const list = JSON.parse(cached);
      const newTxId = `tx-${Math.floor(Math.random() * 900000 + 100000)}`;
      list.push({ id: newTxId, userId, groupId, amount, status: 'pending', copiaECola, qrCodeImg, created: new Date() });
      localStorage.setItem(STORAGE_KEYS.TRANS, JSON.stringify(list));
      return newTxId;
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          group_id: groupId,
          amount: amount,
          status: 'pending',
          payment_method: 'pix',
          qrcode_text: copiaECola,
          qrcode_image: qrCodeImg
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (err) {
      console.error('Error recording transaction:', err);
      return null;
    }
  }

  static async expirePixTransaction(transactionId: string): Promise<boolean> {
    if (!transactionId) return false;

    if (!isSupabaseConfigured || !supabase) {
      const cached = localStorage.getItem(STORAGE_KEYS.TRANS) || '[]';
      const list = JSON.parse(cached);
      const existingTx = list.find((tx: any) => tx.id === transactionId);
      if (!existingTx || existingTx.status !== 'pending') {
        return false;
      }
      const nextList = list.map((tx: any) =>
        tx.id === transactionId
          ? { ...tx, status: 'expired', updatedAt: new Date().toISOString() }
          : tx
      );
      localStorage.setItem(STORAGE_KEYS.TRANS, JSON.stringify(nextList));
      return true;
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      return !!data?.id;
    } catch (err) {
      console.error('Error expiring Pix transaction:', err);
      return false;
    }
  }

  static async fetchPendingPixTransaction(userId: string, groupId: string): Promise<RecoverablePixTransaction | null> {
    if (!userId || !groupId) return null;

    if (!isSupabaseConfigured || !supabase) {
      const cached = localStorage.getItem(STORAGE_KEYS.TRANS) || '[]';
      const list = JSON.parse(cached);
      const latest = [...list]
        .filter((tx: any) => tx.userId === userId && tx.groupId === groupId && tx.status === 'pending')
        .sort((a: any, b: any) => new Date(b.created || b.createdAt || 0).getTime() - new Date(a.created || a.createdAt || 0).getTime())[0];

      if (!latest) return null;

      const mapped = mapPixTransactionRecord({
        id: latest.id,
        user_id: latest.userId,
        group_id: latest.groupId,
        amount: latest.amount,
        status: latest.status,
        payment_method: latest.paymentMethod,
        pagbank_id: latest.pagbankId,
        qrcode_text: latest.copiaECola,
        qrcode_image: latest.qrCodeImg,
        created_at: latest.createdAt || latest.created
      });

      if (!mapped) return null;
      if (new Date(mapped.expiresAt).getTime() <= Date.now()) {
        await this.expirePixTransaction(mapped.transactionId);
        return null;
      }

      return mapped;
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, group_id, amount, status, pagbank_id, qrcode_text, qrcode_image, created_at, expires_at')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .eq('payment_method', 'pix')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const mapped = mapPixTransactionRecord(data as PixTransactionRecord);
      if (!mapped) return null;

      if (new Date(mapped.expiresAt).getTime() <= Date.now()) {
        const expired = await this.expirePixTransaction(mapped.transactionId);
        return expired ? null : mapped;
      }

      return mapped;
    } catch (err) {
      console.error('Error fetching pending Pix transaction:', err);
      return null;
    }
  }

  static async fetchPixTransactionStatus(transactionId: string): Promise<RecoverablePixTransaction['status'] | null> {
    if (!transactionId) return null;

    if (!isSupabaseConfigured || !supabase) {
      const cached = localStorage.getItem(STORAGE_KEYS.TRANS) || '[]';
      const list = JSON.parse(cached);
      const tx = list.find((item: any) => item.id === transactionId);
      if (!tx) return null;

      const mapped = mapPixTransactionRecord({
        id: tx.id,
        user_id: tx.userId,
        group_id: tx.groupId,
        amount: tx.amount,
        status: tx.status,
        payment_method: tx.paymentMethod,
        pagbank_id: tx.pagbankId,
        qrcode_text: tx.copiaECola,
        qrcode_image: tx.qrCodeImg,
        created_at: tx.createdAt || tx.created
      });

      if (!mapped) return null;
      if (mapped.status === 'pending' && new Date(mapped.expiresAt).getTime() <= Date.now()) {
        await this.expirePixTransaction(transactionId);
        return 'expired';
      }

      return mapped.status;
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, group_id, amount, status, pagbank_id, qrcode_text, qrcode_image, created_at, expires_at')
        .eq('id', transactionId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const mapped = mapPixTransactionRecord(data as PixTransactionRecord);
      if (!mapped) return null;

      if (mapped.status === 'pending' && new Date(mapped.expiresAt).getTime() <= Date.now()) {
        const expired = await this.expirePixTransaction(transactionId);
        return expired ? 'expired' : mapped.status;
      }

      return mapped.status;
    } catch (err) {
      console.error('Error fetching Pix transaction status:', err);
      return null;
    }
  }

  static async fetchLatestPixTransactionsByGroup(userId: string): Promise<Record<string, RecoverablePixTransaction>> {
    if (!userId) return {};

    const reduceLatestTransactions = async (records: PixTransactionRecord[]) => {
      const latestByGroup: Record<string, RecoverablePixTransaction> = {};

      for (const record of records) {
        const mapped = mapPixTransactionRecord(record);
        if (!mapped) continue;

        if (mapped.status === 'pending' && new Date(mapped.expiresAt).getTime() <= Date.now()) {
          const expired = await this.expirePixTransaction(mapped.transactionId);
          if (expired) {
            mapped.status = 'expired';
          }
        }

        if (!latestByGroup[mapped.groupId]) {
          latestByGroup[mapped.groupId] = mapped;
        }
      }

      return latestByGroup;
    };

    if (!isSupabaseConfigured || !supabase) {
      const cached = localStorage.getItem(STORAGE_KEYS.TRANS) || '[]';
      const list = JSON.parse(cached);
      const records = [...list]
        .filter((tx: any) => tx.userId === userId)
        .sort((a: any, b: any) => new Date(b.created || b.createdAt || 0).getTime() - new Date(a.created || a.createdAt || 0).getTime())
        .map((tx: any) => ({
          id: tx.id,
          user_id: tx.userId,
          group_id: tx.groupId,
          amount: tx.amount,
          status: tx.status,
          payment_method: tx.paymentMethod,
          pagbank_id: tx.pagbankId,
          qrcode_text: tx.copiaECola,
          qrcode_image: tx.qrCodeImg,
          created_at: tx.createdAt || tx.created
        }));

      return reduceLatestTransactions(records);
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, group_id, amount, status, pagbank_id, qrcode_text, qrcode_image, created_at, expires_at')
        .eq('user_id', userId)
        .eq('payment_method', 'pix')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return reduceLatestTransactions((data as PixTransactionRecord[]) || []);
    } catch (err) {
      console.error('Error fetching latest Pix transactions by group:', err);
      return {};
    }
  }

  static async fetchBettorWallet(userId: string): Promise<BettorWalletSummary> {
    if (!userId) return { balance: 0 };

    if (!isSupabaseConfigured || !supabase) {
      const cached = localStorage.getItem(STORAGE_KEYS.WALLET);
      const balance = cached ? parseFloat(cached) : 0;
      return { balance: Number.isFinite(balance) ? balance : 0 };
    }

    try {
      const { data, error } = await supabase
        .from('bettor_wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return { balance: parseFloat(String(data?.balance ?? 0)) || 0 };
    } catch (err) {
      console.error('Error fetching bettor wallet:', err);
      return { balance: 0 };
    }
  }

  static async fetchRecentPixCharges(userId: string, pools?: Pool[] | null): Promise<PixChargeHistoryItem[]> {
    if (!userId) return [];

    const mapWithGroupName = async (records: PixTransactionRecord[]) => {
      const poolNameMap = new Map((pools || []).map((pool) => [pool.id, pool.name]));
      const items: PixChargeHistoryItem[] = [];

      for (const record of records) {
        const mapped = mapPixTransactionRecord(record);
        if (!mapped) continue;

        if (mapped.status === 'pending' && new Date(mapped.expiresAt).getTime() <= Date.now()) {
          const expired = await this.expirePixTransaction(mapped.transactionId);
          if (expired) {
            mapped.status = 'expired';
          }
        }

        items.push({
          ...mapped,
          groupName: poolNameMap.get(mapped.groupId)
        });
      }

      return items;
    };

    if (!isSupabaseConfigured || !supabase) {
      const cached = localStorage.getItem(STORAGE_KEYS.TRANS) || '[]';
      const list = JSON.parse(cached);
      const records = [...list]
        .filter((tx: any) => tx.userId === userId)
        .sort((a: any, b: any) => new Date(b.created || b.createdAt || 0).getTime() - new Date(a.created || a.createdAt || 0).getTime())
        .slice(0, 10)
        .map((tx: any) => ({
          id: tx.id,
          user_id: tx.userId,
          group_id: tx.groupId,
          amount: tx.amount,
          status: tx.status,
          payment_method: tx.paymentMethod,
          pagbank_id: tx.pagbankId,
          qrcode_text: tx.copiaECola,
          qrcode_image: tx.qrCodeImg,
          created_at: tx.createdAt || tx.created
        }));

      return mapWithGroupName(records);
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, group_id, amount, status, pagbank_id, qrcode_text, qrcode_image, created_at, expires_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return mapWithGroupName((data as PixTransactionRecord[]) || []);
    } catch (err) {
      console.error('Error fetching recent Pix charges:', err);
      return [];
    }
  }

  static async useWalletForPool(userId: string, groupId: string, betId?: string): Promise<{
    success: boolean;
    walletBalance?: number;
    entryId?: string;
    error?: string;
  }> {
    if (!userId || !groupId) {
      return { success: false, error: 'Usuário e bolão são obrigatórios' };
    }

    if (!isSupabaseConfigured || !supabase) {
      const currentWallet = await this.fetchBettorWallet(userId);
      const pools = await this.fetchPools();
      const pool = (pools || []).find((item) => item.id === groupId);
      const entryFee = pool?.entryFee || 0;

      if (currentWallet.balance < entryFee) {
        return { success: false, error: 'Saldo insuficiente para entrar neste bolão' };
      }

      localStorage.setItem(STORAGE_KEYS.WALLET, (currentWallet.balance - entryFee).toFixed(2));
      const cachedEntries = JSON.parse(localStorage.getItem(STORAGE_KEYS.POOL_ENTRIES) || '[]');
      const newEntryId = generateUUID();
      cachedEntries.push({
        id: newEntryId,
        userId,
        groupId,
        amount: entryFee,
        betId: betId || null,
        status: betId ? 'consumed' : 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      localStorage.setItem(STORAGE_KEYS.POOL_ENTRIES, JSON.stringify(cachedEntries));
      return {
        success: true,
        walletBalance: currentWallet.balance - entryFee,
        entryId: newEntryId
      };
    }

    const endpoint = import.meta.env.VITE_SUPABASE_URL
      ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-use-balance`
      : null;

    if (!endpoint) {
      return { success: false, error: 'Edge Function da carteira não configurada' };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`
        },
        body: JSON.stringify({ userId, groupId, betId })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        return { success: false, error: data?.error || `Erro HTTP ${response.status}` };
      }

      return {
        success: true,
        walletBalance: data.wallet_balance,
        entryId: data.entry_id
      };
    } catch (err: any) {
      console.error('Error using wallet for pool:', err);
      return { success: false, error: err.message || 'Erro ao usar saldo da carteira' };
    }
  }

  static async ensurePoolEntryAssignedToBet(userId: string, groupId: string, betId: string): Promise<boolean> {
    if (!userId || !groupId || !betId) return false;

    if (!isSupabaseConfigured || !supabase) {
      const cachedEntries = JSON.parse(localStorage.getItem(STORAGE_KEYS.POOL_ENTRIES) || '[]');
      const existingEntry = cachedEntries.find((entry: any) => entry.userId === userId && entry.groupId === groupId && entry.betId === betId);
      if (existingEntry) return true;

      const availableIndex = cachedEntries.findIndex((entry: any) => entry.userId === userId && entry.groupId === groupId && !entry.betId);
      if (availableIndex === -1) {
        const createdEntry = await this.useWalletForPool(userId, groupId, betId);
        return !!createdEntry.success;
      }

      cachedEntries[availableIndex] = {
        ...cachedEntries[availableIndex],
        betId,
        status: 'consumed',
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEYS.POOL_ENTRIES, JSON.stringify(cachedEntries));
      return true;
    }

    try {
      const { data: existingEntry, error: existingError } = await supabase
        .from('pool_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .eq('bet_id', betId)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existingEntry?.id) return true;

      const { data: availableEntry, error: availableError } = await supabase
        .from('pool_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .is('bet_id', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (availableError) throw availableError;
      if (!availableEntry?.id) {
        const createdEntry = await this.useWalletForPool(userId, groupId, betId);
        return !!createdEntry.success;
      }

      const { error: updateError } = await supabase
        .from('pool_entries')
        .update({
          bet_id: betId,
          status: 'consumed',
          updated_at: new Date().toISOString()
        })
        .eq('id', availableEntry.id)
        .eq('user_id', userId)
        .is('bet_id', null);

      if (updateError) throw updateError;
      return true;
    } catch (err) {
      console.error('Error assigning pool entry to bet:', err);
      return false;
    }
  }

  /**
   * Retorna os bolões já pagos pelo usuário.
   * A regra de negócio de liberação de palpites deve ser por bolão, não global.
   */
  static async fetchPaidGroupIds(userId: string): Promise<Record<string, number>> {
    if (!userId) return {};

    if (!isSupabaseConfigured || !supabase) {
      const cachedEntries = JSON.parse(localStorage.getItem(STORAGE_KEYS.POOL_ENTRIES) || '[]');
      const entryCounts = cachedEntries.reduce((acc: Record<string, number>, entry: any) => {
        if (entry.userId === userId && entry.groupId && entry.status === 'consumed' && entry.betId) {
          acc[entry.groupId] = (acc[entry.groupId] || 0) + 1;
        }
        return acc;
      }, {});

      const cached = localStorage.getItem(STORAGE_KEYS.TRANS) || '[]';
      const list = JSON.parse(cached);
      return list.reduce((acc: Record<string, number>, tx: any) => {
        if (tx.userId === userId && tx.groupId && tx.status === 'paid' && tx.fundingMode !== 'wallet_topup') {
          acc[tx.groupId] = (acc[tx.groupId] || 0) + 1;
        }
        return acc;
      }, entryCounts);
    }

    try {
      const counts: Record<string, number> = {};

      const { data: entryData, error: entryError } = await supabase
        .from('pool_entries')
        .select('group_id, status, bet_id')
        .eq('user_id', userId);

      if (!entryError) {
        (entryData || []).forEach((entry: any) => {
          if (entry.group_id && entry.status === 'consumed' && entry.bet_id) {
            counts[entry.group_id] = (counts[entry.group_id] || 0) + 1;
          }
        });
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('group_id, status, funding_mode')
        .eq('user_id', userId)
        .eq('status', 'paid');

      if (error) throw error;

      return (data || []).reduce((acc: Record<string, number>, tx: any) => {
        if (tx.group_id && tx.funding_mode !== 'wallet_topup') {
          acc[tx.group_id] = (acc[tx.group_id] || 0) + 1;
        }
        return acc;
      }, counts);
    } catch (err) {
      console.error('Error fetching paid transactions:', err);
      return {};
    }
  }

  static async reclaimUnusedPoolEntries(userId: string): Promise<{ success: boolean; walletBalance?: number; reclaimedAmount?: number; error?: string; }> {
    if (!userId) return { success: true, reclaimedAmount: 0 };

    if (!isSupabaseConfigured || !supabase) {
      return { success: true, reclaimedAmount: 0 };
    }

    const endpoint = import.meta.env.VITE_SUPABASE_URL
      ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-reclaim-unused-entries`
      : null;

    if (!endpoint) {
      return { success: false, error: 'Edge Function de liberação da carteira não configurada' };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        return { success: false, error: data?.error || `Erro HTTP ${response.status}` };
      }

      return {
        success: true,
        walletBalance: data.wallet_balance,
        reclaimedAmount: data.reclaimed_amount
      };
    } catch (err: any) {
      console.error('Error reclaiming unused pool entries:', err);
      return { success: false, error: err.message || 'Erro ao liberar saldo pendente' };
    }
  }

  /**
   * Fetch All Pools/Groups from Supabase (including custom serialization workaround)
   */
  static async fetchPools(): Promise<Pool[] | null> {
    if (!isSupabaseConfigured || !supabase) {
      const cached = localStorage.getItem('bpro_pools');
      return cached ? JSON.parse(cached) : null;
    }

    try {
      const { data, error } = await supabase
        .from('bolao_groups')
        .select('*');

      if (error) throw error;

      // Fetch matches to associate their IDs to pools
      const { data: matchesData } = await supabase
        .from('matches')
        .select('id, group_id');

      return data.map((g: any) => {
        let name = g.name;
        let entryFee = 50;
        let feeType: 'percent' | 'fixed' = 'percent';
        let feeValue = 20;
        let maxParticipants = 100;
        let description = 'Bolão personalizado de apostas esportivas.';
        let modality: 'score' | 'podium' = 'score';
        let bettingDeadline: string | undefined;

        if (name.includes(' ::: ')) {
          const parts = name.split(' ::: ');
          name = parts[0];
          const subparts = parts[1].split(' | ');
          entryFee = parseFloat(subparts[0]) || 50;
          feeType = (subparts[1] as 'percent' | 'fixed') || 'percent';
          feeValue = parseFloat(subparts[2]) || 20;
          maxParticipants = parseInt(subparts[3]) || 100;
          description = subparts[4] || '';
          modality = (subparts[5] as 'score' | 'podium') || 'score';
          bettingDeadline = subparts[6] || undefined;
        }

        const poolMatchIds = matchesData
          ? matchesData.filter((m: any) => m.group_id === g.id).map((m: any) => m.id)
          : [];

        return {
          id: g.id,
          name: name,
          creator: 'Organizador',
          entryFee: entryFee,
          accumulatedPrize: parseFloat(g.prize_pool) || 0,
          inviteCode: g.invite_code,
          memberCount: 0,
          description: description,
          bettingDeadline,
          finalizedAt: g.finalized_at || undefined,
          feeType: feeType,
          feeValue: feeValue,
          maxParticipants: maxParticipants,
          selectedTeams: [],
          selectedMatchIds: poolMatchIds,
          modality: modality
        };
      });
    } catch (err) {
      console.error('Error fetching pools:', err);
      return null;
    }
  }

  /**
   * Create a new Pool in Supabase (saving details inside the serialized name field)
   */
  static async createPool(userId: string, pool: Pool, allMatchesList: Match[], explicitMatches: Match[] = []): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      const serializedName = SupabaseService.serializePoolName(pool);

      const { data: groupData, error: groupError } = await supabase
        .from('bolao_groups')
        .insert({
          tenant_id: userId,
          name: serializedName,
          invite_code: pool.inviteCode,
          prize_pool: pool.accumulatedPrize,
          net_prize_pool: pool.accumulatedPrize * 0.8,
          created_by: userId
        })
        .select('id')
        .single();

      if (groupError) throw groupError;

      const newGroupId = groupData.id;

      // Seed matches assigned to this pool
      const poolMatchIds = pool.selectedMatchIds || [];
      const selectedMatches = explicitMatches.length > 0
        ? explicitMatches
        : allMatchesList.filter(m => poolMatchIds.includes(m.id));
      const preserveProvidedMatchIds = explicitMatches.length > 0;

      if (selectedMatches.length > 0) {
        const matchesToInsert = selectedMatches.map(m => ({
          id: preserveProvidedMatchIds ? m.id : generateUUID(),
          tenant_id: userId,
          group_id: newGroupId,
          team_a: m.teamA,
          team_b: m.teamB,
          team_a_flag: m.teamAFlag,
          team_b_flag: m.teamBFlag,
          status: m.status,
          score_a: m.scoreA,
          score_b: m.scoreB,
          started_at: m.startedAt
        }));

        const { error: matchesError } = await supabase
          .from('matches')
          .insert(matchesToInsert);

        if (matchesError) throw matchesError;
      }

      return true;
    } catch (err) {
      console.error('Error creating pool in Supabase:', err);
      return false;
    }
  }

  /**
   * Update pool metadata and, if needed, replace linked matches for this group.
   */
  static async updatePool(userId: string, pool: Pool, allMatchesList: Match[], explicitMatches: Match[] = []): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase || !pool.id) return false;

    try {
      const serializedName = SupabaseService.serializePoolName(pool);

      const { error: groupError } = await supabase
        .from('bolao_groups')
        .update({
          name: serializedName,
          invite_code: pool.inviteCode,
          prize_pool: pool.accumulatedPrize,
          net_prize_pool: pool.accumulatedPrize * 0.8,
          created_by: userId
        })
        .eq('id', pool.id);

      if (groupError) throw groupError;

      const { error: deleteMatchesError } = await supabase
        .from('matches')
        .delete()
        .eq('group_id', pool.id);

      if (deleteMatchesError) throw deleteMatchesError;

      const selectedMatches = explicitMatches.length > 0
        ? explicitMatches
        : allMatchesList.filter((m) => (pool.selectedMatchIds || []).includes(m.id));
      const preserveProvidedMatchIds = explicitMatches.length > 0;

      if (selectedMatches.length > 0) {
        const matchesToInsert = selectedMatches.map((m) => ({
          id: preserveProvidedMatchIds ? m.id : generateUUID(),
          tenant_id: userId,
          group_id: pool.id,
          team_a: m.teamA,
          team_b: m.teamB,
          team_a_flag: m.teamAFlag,
          team_b_flag: m.teamBFlag,
          status: m.status,
          score_a: m.scoreA,
          score_b: m.scoreB,
          started_at: m.startedAt
        }));

        const { error: insertMatchesError } = await supabase
          .from('matches')
          .insert(matchesToInsert);

        if (insertMatchesError) throw insertMatchesError;
      }

      return true;
    } catch (err) {
      console.error('Error updating pool in Supabase:', err);
      return false;
    }
  }

  /**
   * Delete a pool and dependent records owned by the admin.
   */
  static async deletePool(poolId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase || !poolId) return false;

    try {
      await supabase.from('transactions').delete().eq('group_id', poolId);
      await supabase.from('matches').delete().eq('group_id', poolId);

      const { error } = await supabase
        .from('bolao_groups')
        .delete()
        .eq('id', poolId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting pool in Supabase:', err);
      return false;
    }
  }

  /**
   * Guarantee that an official match exists before score homologation.
   */
  static async ensureMatchExists(match: Match, tenantId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      const { data, error } = await supabase
        .from('matches')
        .select('id')
        .eq('id', match.id)
        .maybeSingle();

      if (error) throw error;
      if (data?.id) return true;

      const { error: insertError } = await supabase
        .from('matches')
        .insert({
          id: match.id,
          tenant_id: tenantId || null,
          group_id: null,
          team_a: match.teamA,
          team_b: match.teamB,
          team_a_flag: match.teamAFlag || null,
          team_b_flag: match.teamBFlag || null,
          status: match.status,
          score_a: match.scoreA,
          score_b: match.scoreB,
          started_at: match.startedAt,
          updated_at: new Date().toISOString()
        });

      if (insertError) throw insertError;
      return true;
    } catch (err) {
      console.error('Error ensuring official match exists:', err);
      return false;
    }
  }

  /**
   * Update Match scores in Supabase
   */
  static async updateMatchScore(matchId: string, scoreA: number, scoreB: number): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      const { error } = await supabase
        .from('matches')
        .update({
          score_a: scoreA,
          score_b: scoreB,
          status: 'finished',
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating match score:', err);
      return false;
    }
  }

  static async syncTournamentPodiumFromOfficialMatches(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      const { data: decidingMatches, error } = await supabase
        .from('matches')
        .select('id, team_a, team_b, team_a_flag, team_b_flag, score_a, score_b, status')
        .in('id', [
          '00000000-0000-0000-0000-000000000103',
          '00000000-0000-0000-0000-000000000104'
        ]);

      if (error) throw error;

      const updates: any[] = [];
      const finalMatch = decidingMatches?.find((match: any) => match.id === '00000000-0000-0000-0000-000000000104');
      const thirdPlaceMatch = decidingMatches?.find((match: any) => match.id === '00000000-0000-0000-0000-000000000103');

      if (
        finalMatch &&
        finalMatch.status === 'finished' &&
        finalMatch.score_a !== null &&
        finalMatch.score_b !== null &&
        finalMatch.score_a !== finalMatch.score_b
      ) {
        const champion = finalMatch.score_a > finalMatch.score_b
          ? resolveTeamMetadata(finalMatch.team_a, finalMatch.team_a_flag)
          : resolveTeamMetadata(finalMatch.team_b, finalMatch.team_b_flag);
        const runnerUp = finalMatch.score_a > finalMatch.score_b
          ? resolveTeamMetadata(finalMatch.team_b, finalMatch.team_b_flag)
          : resolveTeamMetadata(finalMatch.team_a, finalMatch.team_a_flag);

        updates.push({
          tournament_key: PODIUM_TOURNAMENT_KEY,
          position: 1,
          slot_key: 'champion',
          position_label: '1º Lugar',
          subtitle: 'Campeão',
          team_code: champion.teamCode,
          team_name: champion.teamName,
          team_flag: champion.teamFlag,
          source_type: 'official_result',
          source_match_id: finalMatch.id,
          source_match_role: 'winner',
          is_provisional: false,
          locked: true
        });
        updates.push({
          tournament_key: PODIUM_TOURNAMENT_KEY,
          position: 2,
          slot_key: 'runner_up',
          position_label: '2º Lugar',
          subtitle: 'Vice-Campeão',
          team_code: runnerUp.teamCode,
          team_name: runnerUp.teamName,
          team_flag: runnerUp.teamFlag,
          source_type: 'official_result',
          source_match_id: finalMatch.id,
          source_match_role: 'loser',
          is_provisional: false,
          locked: true
        });
      }

      if (
        thirdPlaceMatch &&
        thirdPlaceMatch.status === 'finished' &&
        thirdPlaceMatch.score_a !== null &&
        thirdPlaceMatch.score_b !== null &&
        thirdPlaceMatch.score_a !== thirdPlaceMatch.score_b
      ) {
        const thirdPlace = thirdPlaceMatch.score_a > thirdPlaceMatch.score_b
          ? resolveTeamMetadata(thirdPlaceMatch.team_a, thirdPlaceMatch.team_a_flag)
          : resolveTeamMetadata(thirdPlaceMatch.team_b, thirdPlaceMatch.team_b_flag);
        const fourthPlace = thirdPlaceMatch.score_a > thirdPlaceMatch.score_b
          ? resolveTeamMetadata(thirdPlaceMatch.team_b, thirdPlaceMatch.team_b_flag)
          : resolveTeamMetadata(thirdPlaceMatch.team_a, thirdPlaceMatch.team_a_flag);

        updates.push({
          tournament_key: PODIUM_TOURNAMENT_KEY,
          position: 3,
          slot_key: 'third_place',
          position_label: '3º Lugar',
          subtitle: '3º Colocado',
          team_code: thirdPlace.teamCode,
          team_name: thirdPlace.teamName,
          team_flag: thirdPlace.teamFlag,
          source_type: 'official_result',
          source_match_id: thirdPlaceMatch.id,
          source_match_role: 'winner',
          is_provisional: false,
          locked: true
        });
        updates.push({
          tournament_key: PODIUM_TOURNAMENT_KEY,
          position: 4,
          slot_key: 'fourth_place',
          position_label: '4º Lugar',
          subtitle: '4º Colocado',
          team_code: fourthPlace.teamCode,
          team_name: fourthPlace.teamName,
          team_flag: fourthPlace.teamFlag,
          source_type: 'official_result',
          source_match_id: thirdPlaceMatch.id,
          source_match_role: 'loser',
          is_provisional: false,
          locked: true
        });
      }

      if (updates.length === 0) return true;

      const { error: upsertError } = await supabase
        .from('tournament_podium')
        .upsert(updates, { onConflict: 'tournament_key,position' });

      if (upsertError) throw upsertError;
      return true;
    } catch (err) {
      console.error('Error syncing tournament podium from official matches:', err);
      return false;
    }
  }

  /**
   * Update official teams in knockout matches after qualification is defined.
   */
  static async updateMatchTeams(matchId: string, teamA: string, teamAFlag: string, teamB: string, teamBFlag: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      const { error } = await supabase
        .from('matches')
        .update({
          team_a: teamA,
          team_b: teamB,
          team_a_flag: teamAFlag,
          team_b_flag: teamBFlag,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating match teams:', err);
      return false;
    }
  }

  /**
   * Automatic database seeding for a fresh empty database
   */
  static async seedDatabase(userId: string, defaultPools: Pool[], matches: Match[]): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      // 1. Insert profile if missing — suporta perfis legados por user_id ou id
      const profile = await SupabaseService.findProfileByAuthUser(userId);

      if (!profile) {
        const { error: insertErr } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            user_id: userId,
            full_name: 'Organizador Oficial',
            balance: 0.00,
            total_points: 0
          }, { onConflict: 'id' });
        // 409 Conflict = profile já existe (outro INSERT concorrencial ou race condition)
        // Neste caso, ignoramos o erro pois o profile já está criado.
        if (insertErr && !insertErr.message.includes('409')) {
          console.error('[seedDatabase] Erro ao criar profile:', insertErr);
        }
      }

      // 2. Check if we already have pools
      const { count } = await supabase
        .from('bolao_groups')
        .select('*', { count: 'exact', head: true });

      if (count && count > 0) {
        return false; // Already seeded
      }

      // 3. Seed default pools
      let isFirstPool = true;
      for (const pool of defaultPools) {
        const serializedName = SupabaseService.serializePoolName(pool);

        const { data: groupData, error: groupError } = await supabase
          .from('bolao_groups')
          .insert({
            tenant_id: userId,
            name: serializedName,
            invite_code: pool.inviteCode,
            prize_pool: pool.accumulatedPrize,
            net_prize_pool: pool.accumulatedPrize * 0.8,
            created_by: userId
          })
          .select('id')
          .single();

        if (groupError) throw groupError;

        const newGroupId = groupData.id;

        // 4. Seed matches for this pool
        const poolMatchIds = pool.selectedMatchIds || [];
        const selectedMatches = matches.filter(m => poolMatchIds.includes(m.id));

        if (selectedMatches.length > 0) {
          const matchesToInsert = selectedMatches.map(m => ({
            id: isFirstPool ? m.id : generateUUID(),
            tenant_id: userId,
            group_id: newGroupId,
            team_a: m.teamA,
            team_b: m.teamB,
            team_a_flag: m.teamAFlag,
            team_b_flag: m.teamBFlag,
            status: m.status,
            score_a: m.scoreA,
            score_b: m.scoreB,
            started_at: m.startedAt
          }));

          const { error: matchesError } = await supabase
            .from('matches')
            .insert(matchesToInsert);

          if (matchesError) throw matchesError;
        }
        isFirstPool = false;
      }

      console.log('Database seeded successfully.');
      return true;
    } catch (err) {
      console.error('Error seeding database:', err);
      return false;
    }
  }
}
