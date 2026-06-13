/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ShieldAlert, ArrowRight, Eye, EyeOff, ChevronDown, Trophy, Coins, UserCheck, Target, LogIn, Users, Wallet, Clock3 } from 'lucide-react';
import { SupabaseService } from '../lib/supabaseService';
import TeamAvatar from './TeamAvatar';
import { COPA_2026_TEAMS } from '../data/teams';
import { Pool, Match } from '../types';
import { getOfficialTeamFlagUrl } from '../lib/teamFlagSource';

interface OnboardingProps {
  onSuccess: (
    fullName: string,
    email: string,
    userId?: string,
    isAdmin?: boolean,
    cpf?: string,
    telefone?: string
  ) => void;
  lgpdAccepted: boolean;
  onAcceptLgpd: () => void;
  setAccumulatedFeePool: (val: number) => void;
  accumulatedFeePool: number;
  poolsList: Pool[];
  matchesList: Match[];
}

const LANDING_FAQ = [
  {
    q: 'Como entro em um bolão?',
    a: 'Crie sua conta ou faça login, escolha um bolão ativo e conclua a taxa de entrada com o código de acesso informado pelo organizador.'
  },
  {
    q: 'Posso alterar minha aposta depois de concluída?',
    a: 'Não. Depois que a aposta é concluída, ela fica registrada sem edição. Para montar uma nova combinação, você precisa ter nova entrada disponível no bolão.'
  },
  {
    q: 'Os palpites têm algum custo adicional?',
    a: 'Não. Depois da taxa única de entrada, não existe cobrança por palpite enviado. O que vale é a regra de saldo e de entrada do bolão escolhido.'
  },
  {
    q: 'Como funciona o pagamento e o saldo?',
    a: 'A entrada é confirmada por Pix ou por saldo disponível em carteira. O saldo só é consumido quando a aposta é efetivamente finalizada no bolão.'
  },
  {
    q: 'Onde acompanho minhas apostas e resultados?',
    a: 'Depois do acesso, você acompanha seus palpites, ranking, jogos liberados e histórico diretamente no ambiente do apostador.'
  }
];

const formatCurrency = (value: number, minimumFractionDigits = 0) =>
  value.toLocaleString('pt-BR', {
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits
  });

export default function Onboarding({ onSuccess, accumulatedFeePool, poolsList, matchesList }: OnboardingProps) {
  const [mode, setMode] = useState<'lobby' | 'register'>('lobby');
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [currentSlide, setCurrentSlide] = useState(0);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [antiSpamAnswer, setAntiSpamAnswer] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const brazilTeam = useMemo(
    () => COPA_2026_TEAMS.find((team) => team.code === 'BRA'),
    []
  );
  const activePools = useMemo(() => {
    const now = Date.now();
    return poolsList.filter((pool) => {
      let deadlineTs: number | null = null;
      if (pool.bettingDeadline) {
        const ts = new Date(pool.bettingDeadline).getTime();
        if (!Number.isNaN(ts)) deadlineTs = ts;
      }
      if (!deadlineTs) {
        const poolMatches = (pool.selectedMatchIds || [])
          .map((id) => matchesList.find((m) => m.id === id))
          .filter(Boolean) as Match[];
        const fallbackTimestamp = poolMatches
          .map((match) => new Date(match.startedAt).getTime())
          .find((value) => !Number.isNaN(value));
        if (typeof fallbackTimestamp === 'number') {
          deadlineTs = fallbackTimestamp;
        }
      }
      return !deadlineTs || deadlineTs > now;
    });
  }, [poolsList, matchesList]);

  React.useEffect(() => {
    if (!activePools.length) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activePools.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [activePools.length]);

  const featuredPools = useMemo(
    () => [...activePools]
      .sort((a, b) => (b.memberCount + b.accumulatedPrize) - (a.memberCount + a.accumulatedPrize))
      .slice(0, 3),
    [activePools]
  );
  const totalParticipants = useMemo(
    () => poolsList.reduce((sum, pool) => sum + (pool.memberCount || 0), 0),
    [poolsList]
  );
  const totalPrizePool = useMemo(() => {
    const sum = activePools.reduce((acc, pool) => acc + (pool.accumulatedPrize || 0), 0);
    return sum > 0 ? sum : accumulatedFeePool;
  }, [accumulatedFeePool, activePools]);
  const entryFeeRange = useMemo(() => {
    if (!poolsList.length) return null;
    const values = poolsList.map((pool) => pool.entryFee).filter((value) => Number.isFinite(value));
    if (!values.length) return null;
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }, [poolsList]);
  const hottestPool = featuredPools[0];

  const getEstimatedMaxPrize = (pool: Pool) => {
    if (!pool.maxParticipants || !pool.entryFee) return pool.accumulatedPrize || 0;
    const gross = pool.maxParticipants * pool.entryFee;
    if (pool.feeType === 'percent' && pool.feeValue) {
      return gross * (1 - pool.feeValue / 100);
    } else if (pool.feeType === 'fixed' && pool.feeValue) {
      return gross - pool.feeValue;
    }
    return gross;
  };

  const getFormattedDeadline = (pool: Pool) => {
    let deadlineTs: number | null = null;
    if (pool.bettingDeadline) {
      const ts = new Date(pool.bettingDeadline).getTime();
      if (!Number.isNaN(ts)) deadlineTs = ts;
    }
    if (!deadlineTs) {
      const poolMatches = (pool.selectedMatchIds || [])
        .map((id) => matchesList.find((m) => m.id === id))
        .filter(Boolean) as Match[];
      const fallbackTimestamp = poolMatches
        .map((match) => new Date(match.startedAt).getTime())
        .find((value) => !Number.isNaN(value));
      if (typeof fallbackTimestamp === 'number') {
        deadlineTs = fallbackTimestamp;
      }
    }
    if (!deadlineTs) return 'Sem prazo definido';

    return new Date(deadlineTs).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCpf = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const getPasswordStrength = () => {
    if (!password) return { percent: 0, text: 'Força da senha', color: 'bg-surface-variant', labelColor: 'text-on-surface-variant' };

    let score = 0;
    if (password.length > 5) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

    if (score === 1) return { percent: 33, text: 'Fraca', color: 'bg-[#ffb4ab]', labelColor: 'text-error' };
    if (score === 2) return { percent: 66, text: 'Média', color: 'bg-[#ffdb3c]', labelColor: 'text-secondary-container' };
    if (score >= 3) return { percent: 100, text: 'Forte', color: 'bg-[#00e676]', labelColor: 'text-primary-container' };

    return { percent: 15, text: 'Fraca', color: 'bg-[#ffb4ab]', labelColor: 'text-error' };
  };

  const strengthObj = getPasswordStrength();

  const getPoolTeams = (pool: Pool) => {
    if (pool.modality === 'score' && pool.selectedMatchIds && pool.selectedMatchIds.length > 0) {
      const match = matchesList.find(m => m.id === pool.selectedMatchIds![0]);
      if (match) {
        return [
          COPA_2026_TEAMS.find((team) => team.code === match.teamA),
          COPA_2026_TEAMS.find((team) => team.code === match.teamB)
        ].filter((team): team is (typeof COPA_2026_TEAMS)[number] => Boolean(team));
      }
    }
    return (pool.selectedTeams || [])
      .map((code) => COPA_2026_TEAMS.find((team) => team.code === code))
      .filter((team): team is (typeof COPA_2026_TEAMS)[number] => Boolean(team))
      .slice(0, 4);
  };

  const openAuth = (nextAuthMode: 'signup' | 'login' = 'login') => {
    setAuthMode(nextAuthMode);
    setErrorMessage(null);
    setMode('register');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        if (!fullName || !email || !password) {
          setErrorMessage('Por favor, preencha todos os campos obrigatórios.');
          setIsLoading(false);
          return;
        }

        const cpfDigits = cpf.replace(/\D/g, '');
        const phoneDigits = telefone.replace(/\D/g, '');

        if (cpfDigits.length !== 11) {
          setErrorMessage('Informe um CPF válido (11 dígitos).');
          setIsLoading(false);
          return;
        }

        if (phoneDigits.length < 10) {
          setErrorMessage('Informe um telefone válido com DDD.');
          setIsLoading(false);
          return;
        }

        if (antiSpamAnswer !== '7') {
          setErrorMessage('Desafio de segurança anti-spam incorreto. Quanto é 3+4? Dica: 7.');
          setIsLoading(false);
          return;
        }

        const res = await SupabaseService.signUp(fullName, email, password, cpfDigits, phoneDigits);
        if (res.error) {
          setErrorMessage(res.error);
        } else if (res.user) {
          onSuccess(res.user.fullName, res.user.email, res.user.id, res.user.isAdmin, cpfDigits, phoneDigits);
        }
      } else {
        if (!email || !password) {
          setErrorMessage('E-mail e senha são obrigatórios para acessar.');
          setIsLoading(false);
          return;
        }

        const res = await SupabaseService.signIn(email, password);
        if (res.error) {
          setErrorMessage(res.error);
        } else if (res.user) {
          onSuccess(
            res.user.fullName,
            res.user.email,
            res.user.id,
            res.user.isAdmin,
            res.user.cpf,
            res.user.telefone
          );
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocorreu um erro desconhecido durante a autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'lobby') {
    return (
      <div className="flex-1 flex flex-col gap-6 w-full max-w-[640px] mx-auto overflow-hidden px-4 py-6">
        <section className="relative pt-4 pb-2 flex flex-col items-start gap-4 overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#00e676]/10 blur-3xl rounded-full pointer-events-none"></div>

          {activePools.length > 0 ? (
            <div className="relative w-full h-[220px] rounded-3xl overflow-hidden bg-[#071018] border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
               {activePools.map((pool, idx) => {
                 const teams = getPoolTeams(pool);
                 return (
                   <div 
                     key={pool.id}
                     className={`absolute inset-0 w-full h-full p-6 flex flex-col justify-between transition-opacity duration-1000 ${
                       idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                     }`}
                     style={{
                       background: 'radial-gradient(circle at top right, rgba(0, 230, 118, 0.15), transparent 60%)'
                     }}
                   >
                     <div>
                       <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#75ff9e] font-bold mb-2">
                         <span className="h-1.5 w-1.5 rounded-full bg-[#00e676]"></span>
                         DÊ SEU PALPITE
                       </div>
                       <h2 className="text-2xl font-black text-white leading-tight">{pool.name}</h2>
                       {teams.length > 0 && (
                         <p className="text-sm font-semibold text-gray-300 mt-1 mb-2">
                           {teams.slice(0, 2).map(t => t?.name).join(' • ')}
                         </p>
                       )}
                       <div className="flex -space-x-3 mt-1">
                         {(teams.length ? teams.slice(0, 2) : [brazilTeam].filter(Boolean)).map((team) => (
                           <div key={`${pool.id}-${team?.code || 'bra'}`} className="rounded-full bg-[#071018] p-0.5 shadow-lg border border-white/5 relative z-10">
                             <TeamAvatar
                               accent="rgba(12, 120, 74, 0.54)"
                               accentDark="#06120e"
                               className="h-10 w-10"
                               fallback={team?.flag || '🇧🇷'}
                               fallbackClassName="text-base tracking-normal"
                               name={team?.name || 'Brasil'}
                               title={team?.name || 'Brasil'}
                               src={getOfficialTeamFlagUrl(team?.code)}
                             />
                           </div>
                         ))}
                       </div>
                     </div>
                     <div className="flex items-end justify-between mt-4">
                       <div className="text-left">
                         <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-1">Prazo Final</div>
                         <p className="text-sm font-bold text-white">{getFormattedDeadline(pool)}</p>
                       </div>
                       <div className="text-right">
                         <div className="text-[10px] uppercase tracking-[0.2em] text-[#ffe16d] font-bold mb-1">Prêmio Estimado</div>
                         <div className="text-lg font-black text-white">R$ {formatCurrency(getEstimatedMaxPrize(pool))}</div>
                       </div>
                     </div>
                   </div>
                 );
               })}
               <div className="absolute bottom-4 right-4 flex gap-1.5 z-20">
                 {activePools.map((_, idx) => (
                   <div key={idx} className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentSlide ? 'w-4 bg-[#00e676]' : 'w-1.5 bg-white/20'}`} />
                 ))}
               </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center justify-center p-8 rounded-3xl bg-[#071018] border border-white/10">
              <div className="text-xl font-black italic tracking-tight text-white mb-2">BolãoPro</div>
              <p className="text-gray-400 text-center text-sm">Carregando os melhores bolões...</p>
            </div>
          )}

          <div className="grid w-full grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#111723]/85 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-gray-400 font-bold">Bolões ativos</div>
              <div className="mt-1 text-2xl font-black text-white">{activePools.length || '--'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111723]/85 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-gray-400 font-bold">Apostas</div>
              <div className="mt-1 text-2xl font-black text-white">{totalParticipants > 0 ? totalParticipants.toLocaleString('pt-BR') : '--'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111723]/85 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-gray-400 font-bold">Em disputa</div>
              <div className="mt-1 text-lg font-black text-[#ffe16d]">R$ {formatCurrency(totalPrizePool)}</div>
            </div>
          </div>

          <button
            onClick={() => openAuth('login')}
            id="cta-start-lobby"
            className="mt-2 w-full h-[52px] bg-primary-container hover:bg-[#62ff96] text-on-primary-container font-label-bold text-label-bold uppercase rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_15px_rgba(0,230,118,0.3)] cursor-pointer"
          >
            <span>Entrar Para Participar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>

        <section className="w-full flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Bolões em Destaque</h2>
              <p className="text-sm text-on-surface-variant">Cards montados com os dados reais já carregados no sistema.</p>
            </div>
            <div className="rounded-full border border-[#00e676]/25 bg-[#00e676]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#75ff9e]">
              Mobile first
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {featuredPools.map((pool) => {
              const teams = getPoolTeams(pool);

              return (
                <article
                  key={pool.id}
                  className="min-w-[88%] snap-center rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#111723_0%,#0a0f17_100%)] p-5 shadow-[0_22px_48px_rgba(0,0,0,0.34)] flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#00e676]/20 bg-[#00e676]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#75ff9e]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00e676]" />
                        <span>{pool.modality === 'podium' ? 'BOLÃO PÓDIO' : 'BOLÃO PLACAR'}</span>
                      </div>
                      <h3 className="mt-3 text-2xl font-black leading-tight text-white">{pool.name}</h3>
                      {teams.length > 0 && (
                        <p className="text-sm font-semibold text-gray-300 mt-1 mb-2">
                          {teams.slice(0, 2).map(t => t?.name).join(' • ')}
                        </p>
                      )}
                      <div className="flex -space-x-3 mt-1">
                        {(teams.length ? teams.slice(0, 2) : [brazilTeam].filter(Boolean)).map((team) => (
                          <div key={`${pool.id}-${team?.code || 'bra'}`} className="rounded-full bg-[#071018] p-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-white/5 relative z-10">
                            <TeamAvatar
                              accent="rgba(12, 120, 74, 0.54)"
                              accentDark="#06120e"
                              className="h-12 w-12"
                              fallback={team?.flag || '🇧🇷'}
                              fallbackClassName="text-lg tracking-normal"
                              name={team?.name || 'Brasil'}
                              title={team?.name || 'Brasil'}
                              src={getOfficialTeamFlagUrl(team?.code)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                    <div className="text-left">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 font-bold">Organizador</div>
                      <div className="mt-1 text-sm font-bold text-white">{pool.creator}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 font-bold">Bolão aquecido</div>
                      <div className="mt-1 text-sm font-semibold text-white">{pool.memberCount.toLocaleString('pt-BR')} participantes</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">
                        <Wallet className="w-3.5 h-3.5 text-[#75ff9e]" />
                        Entrada
                      </div>
                      <div className="mt-2 text-lg font-black text-white">R$ {formatCurrency(pool.entryFee)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">
                        <Coins className="w-3.5 h-3.5 text-[#ffe16d]" />
                        Estimado
                      </div>
                      <div className="mt-2 text-lg font-black text-[#ffe16d]">R$ {formatCurrency(pool.accumulatedPrize)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">
                        <Users className="w-3.5 h-3.5 text-[#75ff9e]" />
                        Vagas
                      </div>
                      <div className="mt-2 text-lg font-black text-white">
                        {pool.maxParticipants ? Math.max(pool.maxParticipants - pool.memberCount, 0).toLocaleString('pt-BR') : '--'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openAuth('login')}
                    className="mt-1 h-[50px] w-full rounded-xl border border-[#00e676]/20 bg-[#00e676]/12 text-[#75ff9e] font-black uppercase tracking-[0.18em] flex items-center justify-center gap-2 hover:bg-[#00e676]/18 transition-colors"
                  >
                    <span>Entrar para acessar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="w-full">
          <div className="bg-surface-container rounded-[24px] p-4 border border-outline-variant flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-secondary-container/10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
            <div className="flex items-center gap-2 text-secondary-fixed">
              <Coins className="w-5 h-5 text-[#ffdb3c]" />
              <h2 className="font-label-bold text-label-bold text-on-surface uppercase tracking-wider">Panorama Real dos Bolões</h2>
            </div>
            <div className="font-display-score text-3xl font-extrabold text-[#ffe16d]">
              R$ {totalPrizePool.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-outline-variant/60 bg-[#0b1017] px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-400 font-bold">
                  <Clock3 className="w-4 h-4 text-[#75ff9e]" />
                  Faixa de entrada
                </div>
                <div className="mt-2 text-sm font-bold text-white">
                  {entryFeeRange ? `R$ ${formatCurrency(entryFeeRange.min)} a R$ ${formatCurrency(entryFeeRange.max)}` : 'Carregando valores'}
                </div>
              </div>

              <div className="rounded-2xl border border-outline-variant/60 bg-[#0b1017] px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-400 font-bold">
                  <Users className="w-4 h-4 text-[#75ff9e]" />
                  Comunidade ativa
                </div>
                <div className="mt-2 text-sm font-bold text-white">{totalParticipants.toLocaleString('pt-BR')} apostas mapeadas</div>
              </div>

              <div className="rounded-2xl border border-outline-variant/60 bg-[#0b1017] px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-400 font-bold">
                  <Trophy className="w-4 h-4 text-[#ffe16d]" />
                  Mais disputado
                </div>
                <div className="mt-2 text-sm font-bold text-white">{hottestPool ? hottestPool.name : 'Sem bolão em destaque'}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-on-surface">Como Funciona</h2>
          <div className="flex flex-col gap-2">
            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-primary shrink-0">
                <LogIn className="w-6 h-6 text-[#75ff9e]" />
              </div>
              <div>
                <div className="font-label-bold text-label-bold text-primary mb-0.5">PASSO 1</div>
                <div className="font-body-lg text-body-lg text-on-surface">Faça login ou crie sua conta</div>
                <div className="text-sm text-on-surface-variant mt-1">A landing sempre leva primeiro para a tela de acesso. Quem ainda não tem conta usa o botão de cadastro.</div>
              </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-primary shrink-0">
                <Wallet className="w-6 h-6 text-[#75ff9e]" />
              </div>
              <div>
                <div className="font-label-bold text-label-bold text-primary mb-0.5">PASSO 2</div>
                <div className="font-body-lg text-body-lg text-on-surface">Escolha o bolão e confirme sua entrada</div>
                <div className="text-sm text-on-surface-variant mt-1">Cada bolão tem código, taxa e regras próprias. A entrada é liberada por Pix ou por saldo disponível em carteira.</div>
              </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-primary shrink-0">
                <Target className="w-6 h-6 text-[#75ff9e]" />
              </div>
              <div>
                <div className="font-label-bold text-label-bold text-primary mb-0.5">PASSO 3</div>
                <div className="font-body-lg text-body-lg text-on-surface">Monte e finalize sua aposta</div>
                <div className="text-sm text-on-surface-variant mt-1">Depois que a aposta é concluída, ela não é editada. Para uma nova combinação, é preciso ter nova entrada disponível.</div>
              </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-secondary-container shrink-0">
                <Trophy className="w-6 h-6 text-[#ffdb3c]" />
              </div>
              <div>
                <div className="font-label-bold text-label-bold text-secondary-container mb-0.5">PASSO 4</div>
                <div className="font-body-lg text-body-lg text-on-surface">Acompanhe ranking, jogos e histórico</div>
                <div className="text-sm text-on-surface-variant mt-1">Com a conta ativa, você acompanha resultados, ranking ao vivo, bolões pagos e o histórico das apostas registradas.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-on-surface">Perguntas Frequentes</h2>
          <div className="flex flex-col gap-2">
            {LANDING_FAQ.map((item, idx) => (
              <div key={idx} className="bg-surface-container rounded-lg border border-outline-variant overflow-hidden">
                <div
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-container-high transition-colors"
                >
                  <span className="font-label-bold text-on-surface font-medium">{item.q}</span>
                  <ChevronDown className={`w-5 h-5 text-primary transition-transform ${expandedFaq === idx ? 'rotate-180' : ''}`} />
                </div>
                {expandedFaq === idx && (
                  <div className="px-4 pb-4 text-sm text-on-surface-variant leading-relaxed border-t border-outline-variant/30 pt-2 animate-fadeIn bg-surface/50">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 items-center text-center mt-6 border-t border-surface-variant pt-6">
          <div className="flex items-center gap-3 bg-surface-container px-4 py-2 rounded-full border border-outline-variant">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-surface-variant border-2 border-surface flex items-center justify-center overflow-hidden">
                <img referrerPolicy="no-referrer" alt="User 1" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDgNJvGPlDognL-0425y3M-sg7mvE3RmvesYAYp9n7oEg42SesETlf29nqZJyPGVzr4byt682BTeuke1Jrzy8iH1Z_vFZTMWxEfQE0PkQWr5x54y8PboNqguZyFx_KfLJv3PgssDn1BxHOAhbvtSfrIJIPtZcEezg1giHPPINvmHL8lABbCCWaaUDF6q28q8kwUoeWLwYVG_f7kcSPmTY8QMSBSAyW_1kvsVSaf2KB90kXH4SzQxaFuUkFWQAm1EydmJTmF3M_Pcp8" />
              </div>
              <div className="w-8 h-8 rounded-full bg-surface-variant border-2 border-surface flex items-center justify-center overflow-hidden">
                <img referrerPolicy="no-referrer" alt="User 2" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGBzNa7UHDx5snIA0jaKFVo9wAykHEuqVJVTOfIdAkrD7A90wMXgsJeyasfmrel3bv4eBwrFreJsngPKd-WwB4w6wLYiqCzJ88CxSScScf6tWxgAXAthGYbG9jBB_E5a5E84b9VQJLdeyM1ky72323iKulpte60pd5f1ODykHL2UNfTZsNWvquzgE64CbLKXAqosWmHlaqOjBMiJ5zbBU7VmK_0oR5wxx8HaNmoviahQx5yENUAsNDFMIcG4KPqHPmhSIXieyJu7I" />
              </div>
              <div className="w-10 h-8 rounded-full bg-primary border-2 border-surface flex items-center justify-center text-[10px] text-on-primary font-bold">
                +1.2k
              </div>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Mais de 1.200 apostadores já começaram</span>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <h3 className="text-lg font-bold text-on-surface">Entre no BolãoPro e escolha seu bolão na próxima tela.</h3>
            <p className="text-sm text-on-surface-variant">Se você ainda não for cadastrado, basta tocar em <strong className="text-white">Cadastrar</strong> na tela de login.</p>
            <button
              onClick={() => openAuth('login')}
              id="lobby-register-trigger"
              className="w-full h-[48px] bg-[#121311] text-[#f8f87c] font-label-bold text-label-bold uppercase rounded-lg flex items-center justify-center hover:bg-[#62ff96] active:scale-95 transition-transform"
            >
              Abrir Tela de Login
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col justify-center items-center px-4 py-8 w-full pb-36 relative z-10">
      <div className="w-full max-w-md flex flex-col animate-[fadeIn_0.3s_ease-out]">
        <div className="text-center mb-6 flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111723]/90 px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
            <TeamAvatar
              accent="rgba(27, 166, 81, 0.55)"
              accentDark="#07140d"
              className="h-11 w-11"
              fallback={brazilTeam?.flag || '🇧🇷'}
              fallbackClassName="text-lg tracking-normal"
              name={brazilTeam?.name || 'Brasil'}
              title="Seleção Brasileira"
            />
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#75ff9e] font-bold">Acesso oficial</div>
              <div className="text-lg font-black italic text-white">BolãoPro</div>
            </div>
          </div>
          <h1 className="font-display-score text-4xl text-primary font-extrabold tracking-tighter italic text-center">BolãoPro</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {authMode === 'signup' ? 'Crie sua conta para entrar no Bolão Oficial da Copa.' : 'Faça login com sua conta real para gerenciar seus palpites.'}
          </p>
        </div>

        <div className="flex bg-[#161B22] p-1 rounded-xl border border-outline-variant mb-4 font-mono">
          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'signup'
                ? 'bg-[#00E676]/15 text-[#00e676] border border-[#00E676]/30 font-bold'
                : 'text-on-surface-variant hover:text-white text-gray-400'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Cadastrar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'login'
                ? 'bg-[#00E676]/15 text-[#00e676] border border-[#00E676]/30 font-bold'
                : 'text-on-surface-variant hover:text-white text-gray-400'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Entrar / Login</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 bg-red-950/40 border border-red-500/40 text-red-300 p-4 rounded-xl flex items-start gap-3 animate-fadeIn text-xs">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Atenção:</strong>
              <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5 bg-surface-container-low p-6 border border-surface-variant rounded-xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00e676]/30 to-transparent"></div>

          {authMode === 'signup' && (
            <div className="flex flex-col gap-1.5 animate-fadeIn">
              <label className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider text-xs font-semibold text-gray-400" htmlFor="fullName">Nome Completo</label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Digite seu nome completo"
                className="h-[48px] bg-surface-container-lowest border border-outline-variant text-[#dfe2eb] px-4 rounded-lg focus:outline-none focus:border-[#00e676] focus:ring-1 focus:ring-[#00e676] transition-all placeholder:text-[#3d4756]"
              />
            </div>
          )}

          {authMode === 'signup' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider text-xs font-semibold text-gray-400" htmlFor="cpf">CPF</label>
                <input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  required
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="h-[48px] bg-surface-container-lowest border border-outline-variant text-[#dfe2eb] px-4 rounded-lg focus:outline-none focus:border-[#00e676] focus:ring-1 focus:ring-[#00e676] transition-all placeholder:text-[#3d4756] font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider text-xs font-semibold text-gray-400" htmlFor="telefone">Telefone (com DDD)</label>
                <input
                  id="telefone"
                  type="text"
                  inputMode="tel"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhone(e.target.value))}
                  placeholder="(91) 99999-9999"
                  className="h-[48px] bg-surface-container-lowest border border-outline-variant text-[#dfe2eb] px-4 rounded-lg focus:outline-none focus:border-[#00e676] focus:ring-1 focus:ring-[#00e676] transition-all placeholder:text-[#3d4756] font-mono"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider text-xs font-semibold text-gray-400" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
              className="h-[48px] bg-surface-container-lowest border border-outline-variant text-[#dfe2eb] px-4 rounded-lg focus:outline-none focus:border-[#00e676] focus:ring-1 focus:ring-[#00e676] transition-all placeholder:text-[#3d4756]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider text-xs font-semibold text-gray-400" htmlFor="password">Senha</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={authMode === 'signup' ? 'Mínimo de 6 caracteres' : 'Digite sua senha'}
                className="h-[48px] w-full bg-surface-container-lowest border border-outline-variant text-[#dfe2eb] px-4 pr-12 rounded-lg focus:outline-none focus:border-[#00e676] focus:ring-1 focus:ring-[#00e676] transition-all placeholder:text-[#3d4756]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-0 h-[48px] px-4 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-5 h-5 text-on-surface-variant text-gray-400" /> : <Eye className="w-5 h-5 text-on-surface-variant text-gray-400" />}
              </button>
            </div>

            {authMode === 'signup' && password && (
              <div className="mt-2 text-xs flex flex-col gap-1.5 bg-background/50 p-2 rounded border border-outline-variant/30 animate-fadeIn text-[11px]">
                <div className="flex gap-1.5">
                  <div className="h-1 flex-1 bg-surface-variant rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${strengthObj.color}`} style={{ width: strengthObj.percent >= 33 ? '100%' : '0%' }}></div>
                  </div>
                  <div className="h-1 flex-1 bg-surface-variant rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${strengthObj.color}`} style={{ width: strengthObj.percent >= 66 ? '100%' : '0%' }}></div>
                  </div>
                  <div className="h-1 flex-1 bg-surface-variant rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${strengthObj.color}`} style={{ width: strengthObj.percent >= 100 ? '100%' : '0%' }}></div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className={`${strengthObj.labelColor} font-bold`}>Força: {strengthObj.text}</span>
                  <span className="text-on-surface-variant italic text-gray-500">Letras maiúsculas, números e símbolos ajudam</span>
                </div>
              </div>
            )}
          </div>

          {authMode === 'signup' && (
            <div className="bg-[#1c2026] p-4 rounded-lg border border-outline-variant flex flex-col gap-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#75ff9e]">
                <ShieldAlert className="w-4 h-4 text-[#00E676]" />
                <span className="font-label-bold text-label-bold text-on-background uppercase tracking-wider text-xs font-semibold text-[#00e676]">Proteção Anti-Spam</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold text-on-background tracking-tight text-xs">Desafio: Quanto é 3 + 4?</span>
                <input
                  type="number"
                  required
                  value={antiSpamAnswer}
                  onChange={(e) => setAntiSpamAnswer(e.target.value)}
                  placeholder="?"
                  className="h-[48px] w-20 text-center font-bold text-xl bg-[#0a0e14] border border-[#3b4a3d] text-on-background rounded-lg focus:outline-none focus:border-[#00e676] focus:ring-1 focus:ring-[#00e676]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`mt-2 h-[48px] w-full bg-primary-container hover:bg-[#62ff96] text-[#00210b] font-label-bold text-label-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] focus:outline-none shadow-[0_0_15px_rgba(0,230,118,0.2)] hover:shadow-[0_0_20px_rgba(0,230,118,0.4)] cursor-pointer ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <span className="text-base text-[#b7edb8]">Processando...</span>
            ) : (
              <>
                <span className="text-[#b7edb8] text-base leading-[21px]">
                  {authMode === 'signup' ? 'Criar Minha Conta' : 'Acessar o Bolão'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode('lobby')}
            className="inline-flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant hover:text-[#00e676] transition-colors cursor-pointer text-gray-400"
          >
            <span>Voltar para o Menu Anterior</span>
          </button>
        </div>
      </div>
    </div>
  );
}
