/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Trophy, ShieldAlert, FileCode, Check, RefreshCw, Layers, ShieldCheck, 
  Settings, User, HelpCircle, Coins, Sparkles, AlertCircle, Database, ChevronRight 
} from 'lucide-react';

import Onboarding from './components/Onboarding';
import ApostadorDashboard from './components/ApostadorDashboard';
import AdminDashboard from './components/AdminDashboard';
import SpecsViewer from './components/SpecsViewer';

import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { SupabaseService } from './lib/supabaseService';
import { PagBankService } from './lib/pagbankService';

import { Match, AlertNotification, TenantSettings, Pool } from './types';
import { INITIAL_MATCHES, INITIAL_ALERTS, DEFAULT_SETTINGS } from './data/mockData';
import { COPA_2026_TEAMS } from './data/teams';

function mergeMatchesWithDefaults(remoteMatches: Match[] | null): Match[] {
  const mergedMatches = new Map<string, Match>();

  INITIAL_MATCHES.forEach((match) => {
    mergedMatches.set(match.id, match);
  });

  (remoteMatches || []).forEach((match) => {
    const existingMatch = mergedMatches.get(match.id);
    mergedMatches.set(
      match.id,
      existingMatch
        ? {
            ...match,
            group: existingMatch.group,
            dateText: existingMatch.dateText,
            startedAt: match.startedAt || existingMatch.startedAt
          }
        : match
    );
  });

  return Array.from(mergedMatches.values()).sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
}

type AppUser = {
  id?: string;
  fullName: string;
  email: string;
  isAdmin?: boolean;
  cpf?: string;
  telefone?: string;
  avatarUrl?: string;
};

export default function App() {
  // Sandbox State: 'bettor' | 'admin' | 'specs'
  const [activePersona, setActivePersona] = useState<'bettor' | 'admin' | 'specs'>('bettor');
  
  // App States: starts null to fetch real Auth on load
  const [user, setUser] = useState<AppUser | null>(null);

  const [matchesList, setMatchesList] = useState<Match[]>(() => {
    if (isSupabaseConfigured) {
      return [];
    }
    const cached = localStorage.getItem('bpro_matches');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Force update if the length is different OR if the first match teams/date differ from INITIAL_MATCHES
        if (
          !Array.isArray(parsed) ||
          parsed.length === 0 ||
          parsed.length !== INITIAL_MATCHES.length || 
          parsed[0]?.id !== INITIAL_MATCHES[0]?.id ||
          parsed[0]?.teamA !== INITIAL_MATCHES[0]?.teamA || 
          parsed[0]?.teamB !== INITIAL_MATCHES[0]?.teamB
        ) {
          localStorage.setItem('bpro_matches', JSON.stringify(INITIAL_MATCHES));
          return INITIAL_MATCHES;
        }
        return parsed;
      } catch (e) {
        localStorage.setItem('bpro_matches', JSON.stringify(INITIAL_MATCHES));
        return INITIAL_MATCHES;
      }
    }
    return INITIAL_MATCHES;
  });

  const [alertsList, setAlertsList] = useState<AlertNotification[]>(() => {
    const cached = localStorage.getItem('bpro_alerts');
    return cached ? JSON.parse(cached) : INITIAL_ALERTS;
  });

  const [tenantSettings, setTenantSettings] = useState<TenantSettings>(() => {
    const cached = localStorage.getItem('bpro_tenant_settings');
    return cached ? JSON.parse(cached) : DEFAULT_SETTINGS;
  });

  const [poolsList, setPoolsList] = useState<Pool[]>(() => {
    if (isSupabaseConfigured) {
      return [];
    }
    const cached = localStorage.getItem('bpro_pools');
    const defaultPools: Pool[] = [
      { id: 'p1', name: 'Bolão Oficial Master Copa', creator: 'Organizador Oficial', entryFee: 50, accumulatedPrize: 34000, inviteCode: 'BRASIL', memberCount: 680, description: 'O bolão oficial geral com premiação máxima garantida pela comissão contábil.', selectedTeams: ['BRA', 'FRA', 'GER', 'ARG', 'MEX', 'ENG', 'ESP'], selectedMatchIds: INITIAL_MATCHES.filter(m => m.group !== 'PÓDIO').map(m => m.id), feeType: 'percent', feeValue: 20, maxParticipants: 1000 },
      { id: 'p2', name: 'Copa Master COPA26', creator: 'Emiliano Organizador', entryFee: 50, accumulatedPrize: 15000, inviteCode: 'COPA26', memberCount: 300, description: 'Grupo corporativo para entusiastas e colegas de trabalho.', selectedTeams: ['BRA', 'GER', 'ARG', 'MEX'], selectedMatchIds: INITIAL_MATCHES.slice(0, 12).map(m => m.id), feeType: 'percent', feeValue: 20, maxParticipants: 500 },
      { id: 'p3', name: 'Amigos do Futebol', creator: 'Carlos Silva', entryFee: 20, accumulatedPrize: 4200, inviteCode: 'AMIGOS', memberCount: 210, description: 'Bolão clássico de final de semana entre amigos.', selectedTeams: ['BRA', 'FRA', 'ENG'], selectedMatchIds: INITIAL_MATCHES.slice(0, 6).map(m => m.id), feeType: 'fixed', feeValue: 5, maxParticipants: 300 },
      {
        id: 'p4',
        name: '🏆 Bolão de Pódio Copa 2026',
        creator: 'Organizador Oficial',
        entryFee: 100,
        accumulatedPrize: 12000,
        inviteCode: 'PODIO26',
        memberCount: 120,
        description: 'Preveja as 4 melhores seleções da Copa. 25 pontos por acerto. Regra especial: prêmio para a maior pontuação com mínimo de 50 pontos.',
        selectedTeams: COPA_2026_TEAMS.map(t => t.code),
        selectedMatchIds: [
          '00000000-0000-0000-0000-9999a0d11111',
          '00000000-0000-0000-0000-9999a0d22222',
          '00000000-0000-0000-0000-9999a0d33333',
          '00000000-0000-0000-0000-9999a0d44444'
        ],
        feeType: 'percent',
        feeValue: 20,
        maxParticipants: 500,
        modality: 'podium'
      }
    ];
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Validação robusta: verifica se o cache tem a estrutura correta
        const podiumPool = Array.isArray(parsed) ? parsed.find((p: Pool) => p.id === 'p4') : null;
        const hasPodiumPool = podiumPool
          && podiumPool.modality === 'podium'
          && Array.isArray(podiumPool.selectedMatchIds)
          && podiumPool.selectedMatchIds.length === 4
          && podiumPool.selectedMatchIds[0] === '00000000-0000-0000-0000-9999a0d11111';

        if (
          !Array.isArray(parsed) ||
          parsed.length < defaultPools.length ||
          !parsed[0]?.selectedMatchIds ||
          parsed[0]?.selectedMatchIds[0] !== defaultPools[0]?.selectedMatchIds[0] ||
          !parsed[0]?.maxParticipants ||
          !hasPodiumPool
        ) {
          localStorage.setItem('bpro_pools', JSON.stringify(defaultPools));
          return defaultPools;
        }
        return parsed;
      } catch (e) {
        localStorage.setItem('bpro_pools', JSON.stringify(defaultPools));
        return defaultPools;
      }
    }
    return defaultPools;
  });

  // Financial Accumulated Pool (Sum of entries minus commission)
  const [accumulatedFeePool, setAccumulatedFeePool] = useState<number>(() => {
    const cached = localStorage.getItem('bpro_accumulated_pool');
    return cached ? parseFloat(cached) : 34000.00;
  });

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('bpro_matches', JSON.stringify(matchesList));
  }, [matchesList]);

  useEffect(() => {
    localStorage.setItem('bpro_alerts', JSON.stringify(alertsList));
  }, [alertsList]);

  useEffect(() => {
    localStorage.setItem('bpro_tenant_settings', JSON.stringify(tenantSettings));
  }, [tenantSettings]);

  useEffect(() => {
    localStorage.setItem('bpro_pools', JSON.stringify(poolsList));
  }, [poolsList]);

  useEffect(() => {
    localStorage.setItem('bpro_accumulated_pool', accumulatedFeePool.toString());
  }, [accumulatedFeePool]);

  // Inscrição purchase checkout simulations
  const [paidPoolIds, setPaidPoolIds] = useState<Record<string, number>>({});
  const [checkoutTransaction, setCheckoutTransaction] = useState<{
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
  } | null>(null);
  const [checkoutSucceeded, setCheckoutSucceeded] = useState<boolean>(false);

  // Persistent Regulatory LGPD acceptance banner states
  const [lgpdAccepted, setLgpdAccepted] = useState<boolean>(false);
  const [showRlsWarning, setShowRlsWarning] = useState<boolean>(false);

  // Supabase live database synchronization loading helper
  const loadSupabaseData = async (userId: string, userEmail?: string) => {
    if (!isSupabaseConfigured) return;
    try {
      // Verifica profile com fallback para esquemas legados.
      // Muitos usuários antigos já possuem CPF/telefone salvos, mas o vínculo
      // pode estar em `id` ou apenas em `email`, então não mostramos alerta
      // falso de RLS nesses casos.
      const profileCheck = await SupabaseService.findProfileByAuthUser(
        userId,
        userEmail || user?.email
      );
      setShowRlsWarning(!profileCheck);
      if (profileCheck) {
        setUser((currentUser) => {
          if (!currentUser || currentUser.id !== userId) return currentUser;
          return {
            ...currentUser,
            fullName: profileCheck.full_name || currentUser.fullName,
            email: userEmail || currentUser.email,
            isAdmin: Boolean(profileCheck.is_admin) || currentUser.isAdmin,
            cpf: profileCheck.cpf || currentUser.cpf,
            telefone: profileCheck.telefone || currentUser.telefone,
            avatarUrl: profileCheck.avatar_url || currentUser.avatarUrl
          };
        });
      }

      // Load Pools
      const pools = await SupabaseService.fetchPools();
      setPoolsList(pools || []);

      await SupabaseService.reclaimUnusedPoolEntries(userId);

      const paidGroups = await SupabaseService.fetchPaidGroupIds(userId);
      setPaidPoolIds(paidGroups);

      await SupabaseService.syncOfficialSchedule(userId);
      await SupabaseService.syncTournamentPodiumFromOfficialMatches();

      // Load Matches
      const dbMatches = await SupabaseService.fetchMatches();
      setMatchesList(mergeMatchesWithDefaults(dbMatches));
    } catch (err) {
      console.error('Error synchronizing database data from Supabase:', err);
    }
  };

  // Automatic Session recovery useEffect (Production real user support)
  useEffect(() => {
    const recoverSession = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const userEmail = session.user.email || '';
            const profile = await SupabaseService.findProfileByAuthUser(
              session.user.id,
              userEmail
            );

            const isAdminUser = profile?.is_admin || userEmail === 'jerime.rego@gmail.com' || userEmail === 'organizador@bolaopro.com.br';

            setUser({
              id: session.user.id,
              fullName: profile?.full_name || userEmail.split('@')[0] || 'Apostador',
              email: userEmail,
              isAdmin: isAdminUser,
              cpf: profile?.cpf || undefined,
              telefone: profile?.telefone || undefined,
              avatarUrl: profile?.avatar_url || undefined
            });

            // Persist for offline use
            localStorage.setItem('bpro_user', JSON.stringify({
              id: session.user.id,
              fullName: profile?.full_name || userEmail.split('@')[0] || 'Apostador',
              email: userEmail,
              isAdmin: isAdminUser,
              cpf: profile?.cpf || undefined,
              telefone: profile?.telefone || undefined,
              avatarUrl: profile?.avatar_url || undefined
            }));

            // Load and seed cloud database on session load
            loadSupabaseData(session.user.id, userEmail);
            return;
          }
        }

        // Sem sessão Supabase válida: limpa cache local para evitar
        // re-autenticação silenciosa de usuário deletado/expirado.
        localStorage.removeItem('bpro_user');
        setUser(null);
      } catch (err) {
        console.error('Error recovering user session:', err);
        localStorage.removeItem('bpro_user');
        setUser(null);
      }
    };
    recoverSession();
  }, []);

  // Actions
  const handleOnboardingSuccess = (
    fullName: string,
    email: string,
    userId?: string,
    isAdmin?: boolean,
    cpf?: string,
    telefone?: string
  ) => {
    setUser({ id: userId, fullName, email, isAdmin, cpf, telefone, avatarUrl: undefined });
    setPaidPoolIds({});
    if (userId) {
      loadSupabaseData(userId, email);
    }
  };

  const handleLogout = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Error during signout:', err);
    }
    localStorage.removeItem('bpro_user');
    setUser(null);
    setPaidPoolIds({});
    setShowRlsWarning(false);
  };

  const handleUpdateMatchList = async (id: string, scoreA: number | null, scoreB: number | null) => {
    const originalMatches = [...matchesList];

    setMatchesList(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          status: 'finished',
          scoreA,
          scoreB
        };
      }
      return m;
    }));

    // Save score in Supabase Cloud
    if (isSupabaseConfigured && scoreA !== null && scoreB !== null) {
      const targetMatch = originalMatches.find((match) => match.id === id);
      const matchReadyForUpdate = targetMatch
        ? await SupabaseService.ensureMatchExists(targetMatch, user?.id)
        : false;
      const success = matchReadyForUpdate && await SupabaseService.updateMatchScore(id, scoreA, scoreB);
      if (!success) {
        alert('Erro ao salvar o placar oficial no banco de dados do Supabase. Operação cancelada e revertida.');
        setMatchesList(originalMatches);
      } else {
        await SupabaseService.syncTournamentPodiumFromOfficialMatches();
      }
    }
  };

  const handleUpdateMatchTeams = async (id: string, teamA: string, teamAFlag: string, teamB: string, teamBFlag: string) => {
    const originalMatches = [...matchesList];
    setMatchesList(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          teamA,
          teamAFlag,
          teamB,
          teamBFlag
        };
      }
      return m;
    }));

    if (isSupabaseConfigured) {
      const targetMatch = originalMatches.find((match) => match.id === id);
      const matchReadyForUpdate = targetMatch
        ? await SupabaseService.ensureMatchExists(
            {
              ...targetMatch,
              teamA,
              teamAFlag,
              teamB,
              teamBFlag
            },
            user?.id
          )
        : false;
      const success = matchReadyForUpdate && await SupabaseService.updateMatchTeams(id, teamA, teamAFlag, teamB, teamBFlag);

      if (!success) {
        setMatchesList(originalMatches);
        return false;
      }
    }

    return true;
  };

  const handleAlertDispatch = (type: 'Partidas' | 'Ranking' | 'Sistema', title: string, message: string) => {
    const newAlert: AlertNotification = {
      id: `alert-${Date.now()}`,
      type,
      title,
      message,
      timeText: 'Agora',
      unread: true
    };
    setAlertsList(prev => [newAlert, ...prev]);

    // If it's a dynamic reward pool announcement, increase mock accum pool slightly
    if (type === 'Sistema') {
      setAccumulatedFeePool(current => current + 1500);
    }
  };

  const handleTriggerCheckoutSession = async (
    feeAmount: number,
    groupCreator: string,
    groupId: string,
    userId: string,
    userEmail: string,
    userName: string,
    userCpf?: string,
    userPhone?: string
  ) => {
    if (!isSupabaseConfigured || !user) {
      // Fallback local mode - código simulado
      const codeCopiar = `00020101021226830014br.gov.bcb.pix2561api.pagseguro.com/pix/v2/cobv/BPRO2026_${Math.floor(Math.random() * 900000 + 100000)}5204000053039865405${feeAmount.toFixed(2)}5802BR5912BOLAOPRO20266009SAOPAULO62070503***6304ECE3`;
      const fallbackExpiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
      setCheckoutTransaction({
        active: true,
        amount: feeAmount,
        qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(codeCopiar)}`,
        copiaECola: codeCopiar,
        groupCreator,
        groupId,
        expiresAt: fallbackExpiresAt,
        status: 'pending'
      });
      setCheckoutSucceeded(false);
      return;
    }

    const recoverableTx = await SupabaseService.fetchPendingPixTransaction(userId, groupId);
    if (recoverableTx) {
      setCheckoutTransaction({
        active: true,
        amount: recoverableTx.amount,
        qrcode: recoverableTx.qrcodeImage,
        copiaECola: recoverableTx.qrcodeText,
        groupCreator,
        groupId: recoverableTx.groupId,
        transactionId: recoverableTx.transactionId,
        orderId: recoverableTx.pagbankId,
        expiresAt: recoverableTx.expiresAt,
        status: recoverableTx.status
      });
      setCheckoutSucceeded(false);
      return;
    }

    // Integração real com PagBank via Edge Function
    const result = await PagBankService.createPixOrder({
      amount: feeAmount,
      userId: userId,
      userEmail: userEmail,
      userName: userName,
      groupId: groupId,
      groupName: groupCreator,
      userCpf: userCpf || user?.cpf,
      userPhone: userPhone || user?.telefone
    });

    if (result.success && result.data) {
      const orderData = result.data;
      setCheckoutTransaction({
        active: true,
        amount: feeAmount,
        qrcode: orderData.qr_code.qr_code_image,
        copiaECola: orderData.qr_code.qr_code_text,
        groupCreator,
        groupId,
        transactionId: orderData.transaction_id,
        orderId: orderData.order_id,
        expiresAt: orderData.expires_at,
        status: 'pending'
      });
      setCheckoutSucceeded(false);
    } else {
      console.error('Erro ao criar order PagBank:', result.error);
      alert(`Erro ao iniciar pagamento: ${result.error}. Tente novamente.`);
    }
  };

  const refreshPoolsAndMatches = async () => {
    const pools = await SupabaseService.fetchPools();
    setPoolsList(pools || []);

    await SupabaseService.syncOfficialSchedule(user?.id);

    const dbMatches = await SupabaseService.fetchMatches();
    setMatchesList(mergeMatchesWithDefaults(dbMatches));
  };

  const handleCreatePool = async (newPool: Pool, explicitMatches: Match[] = []) => {
    if (!isSupabaseConfigured) {
      setPoolsList(prev => [newPool, ...prev]);
      if (explicitMatches.length > 0) {
        setMatchesList((prev) => [...explicitMatches, ...prev]);
      }
    }

    // Save created pool to Supabase
    if (isSupabaseConfigured && user?.id) {
      const success = await SupabaseService.createPool(user.id, newPool, matchesList, explicitMatches);
      if (!success) {
        alert('Erro ao salvar o bolão no banco de dados do Supabase. Verifique se o RLS está configurado ou se você possui um perfil ativo.');
        return;
      }

      // Load updated pools and matches from Supabase to synchronize IDs immediately
      await refreshPoolsAndMatches();
    }

    handleAlertDispatch(
      'Sistema',
      'Novo Bolão Disponível',
      `O bolão "${newPool.name}" foi criado com sucesso com taxa de R$ ${newPool.entryFee.toFixed(2)}!`
    );
  };

  const handleUpdatePool = async (updatedPool: Pool, explicitMatches: Match[] = []) => {
    setPoolsList((prev) => prev.map((pool) => (pool.id === updatedPool.id ? updatedPool : pool)));

    if (isSupabaseConfigured && user?.id) {
      const success = await SupabaseService.updatePool(user.id, updatedPool, matchesList, explicitMatches);
      if (!success) {
        alert('Erro ao atualizar o bolão no banco de dados do Supabase.');
      }
      await refreshPoolsAndMatches();
    }

    handleAlertDispatch(
      'Sistema',
      'Bolão Atualizado',
      `O bolão "${updatedPool.name}" foi atualizado com sucesso.`
    );
  };

  const handleDeletePool = async (poolId: string) => {
    const poolToDelete = poolsList.find((pool) => pool.id === poolId);
    if (!poolToDelete) return;

    setPoolsList((prev) => prev.filter((pool) => pool.id !== poolId));
    setMatchesList((prev) => prev.filter((match) => !poolToDelete.selectedMatchIds?.includes(match.id)));

    if (isSupabaseConfigured) {
      const success = await SupabaseService.deletePool(poolId);
      if (!success) {
        alert('Erro ao apagar o bolão no banco de dados do Supabase.');
      }
      await refreshPoolsAndMatches();
    }

    handleAlertDispatch(
      'Sistema',
      'Bolão Removido',
      `O bolão "${poolToDelete.name}" foi apagado com sucesso.`
    );
  };

  const handleInsertMatch = (newMatch: Match) => {
    setMatchesList(prev => [newMatch, ...prev]);
    handleAlertDispatch(
      'Partidas',
      'Nova Partida Adicionada',
      `${newMatch.teamA} vs ${newMatch.teamB} foi adicionada na grade.`
    );
  };

  // Redirect persona if not admin
  const currentPersona = (activePersona === 'admin' || activePersona === 'specs') && !user?.isAdmin
    ? 'bettor'
    : activePersona;

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#dfe2eb] flex flex-col font-sans selection:bg-[#00E676]/30 relative overflow-x-hidden">
      
      {/* Decorative Aurora lights */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-secondary-container/5 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Top Main Dual Workspace Switchboard Rail */}
      <header className="bg-[#161B22]/80 backdrop-blur-md border-b border-outline-variant sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Branded Logo Name: strictly following literal humble guidelines */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-[#00E676] to-[#00b248] flex items-center justify-center font-bold text-[#00210b] shadow-[0_0_15px_rgba(0,230,118,0.3)]">
              ⚽
            </div>
            <div className="flex items-center">
              <span className="font-display-score font-extrabold tracking-tight italic text-sm md:text-xl text-white leading-none">BPRO 2026</span>
            </div>
          </div>

          {/* Persona selector rails */}
          {user?.isAdmin && (
            <div className="flex items-center bg-[#090C10] p-1 rounded-xl border border-outline-variant space-x-1">
              <button
                onClick={() => setActivePersona('bettor')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePersona === 'bettor'
                    ? 'bg-[#00E676]/15 hover:bg-[#00E676]/25 text-[#00e676] border border-[#00E676]/30 font-bold'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Visão Apostador</span>
              </button>

              <button
                onClick={() => setActivePersona('admin')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePersona === 'admin'
                    ? 'bg-[#00E676]/15 hover:bg-[#00E676]/25 text-[#00e676] border border-[#00E676]/30 font-bold'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Painel Admin</span>
              </button>

              <button
                onClick={() => setActivePersona('specs')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePersona === 'specs'
                    ? 'bg-[#00E676]/15 hover:bg-[#00E676]/25 text-[#00e676] border border-[#00E676]/30 font-bold'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Arquitetura SQL/Deno</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container Content */}
      <main className="flex-1 flex flex-col justify-start">
        {showRlsWarning && (
          <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 w-full">
            <div className="bg-[#b45309]/10 border-2 border-[#b45309]/40 text-[#f59e0b] p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg animate-pulse">
              <div className="flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-[#f59e0b] shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h4 className="font-bold text-sm text-white flex items-center gap-1.5">⚠️ Banco de Dados: Perfil não detectado no Supabase</h4>
                  <p className="text-gray-300 leading-relaxed mt-1 font-medium">
                    O Supabase não conseguiu inserir o seu usuário na tabela <code className="bg-black/40 px-1.5 py-0.5 rounded text-[#ffd33c] font-bold">profiles</code> devido à falta de uma política de Row Level Security (RLS) para <code className="text-[#ffd33c] font-bold">INSERT</code>.
                    Sem esse perfil, **nenhum bolão ou palpite será salvo no banco de dados remoto**.
                  </p>
                  <div className="mt-2.5 p-2.5 bg-black/60 rounded-lg border border-[#1f2937] font-mono text-[9px] text-gray-300 select-all leading-normal">
                    <span className="text-[#00e676] font-bold block mb-1"># Execute este comando no SQL Editor do painel do Supabase para corrigir:</span>
                    CREATE POLICY "Permitir insercao de perfis" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPersona === 'bettor' ? (
          /* BETTOR USER WORKSPACE LOGIC */
          user ? (
            <ApostadorDashboard
              user={user}
              matchesList={matchesList}
              updateMatchList={handleUpdateMatchList}
              tenantSettings={tenantSettings}
              alertsList={alertsList}
              setAlertsList={setAlertsList}
              onLogout={handleLogout}
              accumulatedFeePool={accumulatedFeePool}
              triggerCheckoutSession={handleTriggerCheckoutSession}
              paidPoolIds={paidPoolIds}
              onMarkPoolAsPaid={(poolId) =>
                setPaidPoolIds((prev) => ({ ...prev, [poolId]: (prev[poolId] || 0) + 1 }))
              }
              onResetPoolAccess={(poolId) =>
                setPaidPoolIds((prev) => {
                  const next = { ...prev };
                  delete next[poolId];
                  return next;
                })
              }
              checkoutTransaction={checkoutTransaction}
              setCheckoutTransaction={setCheckoutTransaction}
              checkoutSucceeded={checkoutSucceeded}
              setCheckoutSucceeded={setCheckoutSucceeded}
              poolsList={poolsList}
              onCreatePool={handleCreatePool}
              onUpdateUser={(patch) => setUser((u) => (u ? { ...u, ...patch } : u))}
            />
          ) : (
            <Onboarding
              onSuccess={handleOnboardingSuccess}
              lgpdAccepted={lgpdAccepted}
              onAcceptLgpd={() => setLgpdAccepted(true)}
              accumulatedFeePool={accumulatedFeePool}
              setAccumulatedFeePool={setAccumulatedFeePool}
            />
          )
        ) : currentPersona === 'admin' ? (
          /* ORGANIZER/ADMIN WORKSPACE LOGIC */
          <AdminDashboard
            user={user || { fullName: 'Lucas Silva', email: 'organizador@bolaopro.com.br' }}
            matchesList={matchesList}
            updateMatchList={handleUpdateMatchList}
            updateMatchTeams={handleUpdateMatchTeams}
            tenantSettings={tenantSettings}
            updateTenantSettings={setTenantSettings}
            onAlertDispatch={handleAlertDispatch}
            poolsList={poolsList}
            onCreatePool={handleCreatePool}
            onUpdatePool={handleUpdatePool}
            onDeletePool={handleDeletePool}
            onAddMatch={handleInsertMatch}
          />
        ) : (
          /* SPECS ARCHITECT CODE DIRECTORIES VIEW */
          <SpecsViewer />
        )}
      </main>

      {/* --- Persistent LGPD Regulatory Consent Banner: exactly specified in A1 / Cadastro --- */}
      {!lgpdAccepted && (
        <div id="lgpd-regulatory-banner" className="fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[600px] bg-[#161B22]/95 backdrop-blur-lg border border-outline-variant p-4 rounded-xl z-[99] flex flex-col md:flex-row items-center gap-3 shadow-2xl animate-[slideUp_0.3s_ease-out]">
          <div className="flex gap-2.5 items-start">
            <ShieldAlert className="w-5 h-5 text-secondary-fixed shrink-0 mt-0.5 text-[#ffdb3c]" />
            <div className="text-xs">
              <h4 className="font-bold text-on-surface">Conformidade com a LGPD</h4>
              <p className="text-on-surface-variant leading-relaxed mt-0.5 font-medium">
                Nós utilizamos cookies e dados pessoais estritamente necessários para permitir autenticação multi-tenant e gerenciar seus palpites com segurança contábil.
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto shrink-0">
            <button 
              onClick={() => setLgpdAccepted(true)}
              className="px-4 py-2 hover:bg-surface-container-high rounded text-[11px] font-bold text-on-surface border border-outline-variant flex-1 md:flex-initial transition-colors cursor-pointer"
            >
              Filtros
            </button>
            <button 
              onClick={() => setLgpdAccepted(true)}
              className="px-4 py-2 bg-primary text-[#e7f1ea] hover:bg-[#62ff96] font-bold rounded text-[11px] flex-1 md:flex-initial uppercase tracking-wider transition-all active:scale-95 cursor-pointer border border-[#e7f3ec]"
            >
              Aceitar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
