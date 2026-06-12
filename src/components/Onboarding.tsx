/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldAlert, ArrowRight, Eye, EyeOff, ShieldCheck, ChevronDown, Trophy, Coins, UserCheck, Smartphone, Target, LogIn } from 'lucide-react';
import { FAQ_ITEMS } from '../data/mockData';
import { SupabaseService } from '../lib/supabaseService';

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
}

export default function Onboarding({ onSuccess, lgpdAccepted, onAcceptLgpd, accumulatedFeePool }: OnboardingProps) {
  const [mode, setMode] = useState<'lobby' | 'register'>('lobby');
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  
  // Registration / Login States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [antiSpamAnswer, setAntiSpamAnswer] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Máscaras CPF e Telefone
  const formatCpf = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };
  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  // Connection & Auth UI feeds
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password strength logic
  const getPasswordStrength = () => {
    if (!password) return { percent: 0, text: 'Força da senha', color: 'bg-surface-variant', labelColor: 'text-on-surface-variant' };
    let score = 0;
    if (password.length > 5) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

    if (score === 1) {
      return { percent: 33, text: 'Fraca', color: 'bg-[#ffb4ab]', labelColor: 'text-error' };
    } else if (score === 2) {
      return { percent: 66, text: 'Média', color: 'bg-[#ffdb3c]', labelColor: 'text-secondary-container' };
    } else if (score >= 3) {
      return { percent: 100, text: 'Forte', color: 'bg-[#00e676]', labelColor: 'text-primary-container' };
    }
    return { percent: 15, text: 'Fraca', color: 'bg-[#ffb4ab]', labelColor: 'text-error' };
  };

  const strengthObj = getPasswordStrength();

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

        // Real Supabase signUp
        const res = await SupabaseService.signUp(fullName, email, password, cpfDigits, phoneDigits);
        if (res.error) {
          setErrorMessage(res.error);
        } else if (res.user) {
          onSuccess(res.user.fullName, res.user.email, res.user.id, res.user.isAdmin, cpfDigits, phoneDigits);
        }
      } else {
        // Real Supabase signIn
        if (!email || !password) {
          setErrorMessage('E-mail e senha são obrigatórios para acessar.');
          setIsLoading(false);
          return;
        }

        const res = await SupabaseService.signIn(email, password);
        if (res.error) {
          setErrorMessage(res.error);
        } else if (res.user) {
          onSuccess(res.user.fullName, res.user.email, res.user.id, res.user.isAdmin);
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
      <div className="flex-1 flex flex-col gap-6 w-full max-w-[600px] mx-auto overflow-hidden px-4 py-6">
        {/* Hero Section */}
        <section className="relative pt-4 pb-2 flex flex-col items-start gap-4 overflow-hidden">
          {/* Decorative background blur */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#00e676]/10 blur-3xl rounded-full pointer-events-none"></div>
          
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">
            O Maior Bolão da Copa 2026
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-sm">
            Mostre seu conhecimento, suba no ranking e ganhe prêmios em dinheiro.
          </p>

          <div className="w-full relative mt-2 rounded-xl overflow-hidden aspect-video border border-surface-variant">
            <img 
              alt="Estádio da Copa" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfXC2N3igFfHPhRn4Yrdgpk9ORQL5yYnocPdOVKbReAZ5-cTX81rNMFHiSvXKxOtCHPzhMKJDCCtQk37pb-wP77rP702W6IJwMvMkzEw9mbbfAtEwI92IAvY_GCXn550yO1ZHRUrva1-7x_rHz1KMR_87URoNliOla28rWyTyRt6MSsbqmFVz5PyysGIWLz2hnXF4-pvCdbT-0MlktYlEGN_D1iDhGR9Tt0vwUfvVC8DewcySQ0sTLQkrU7SXaNLTmDNzRIETf24I"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-80"></div>
          </div>

          <button 
            onClick={() => setMode('register')}
            id="cta-start-lobby"
            className="mt-2 w-full h-[48px] bg-primary-container hover:bg-[#62ff96] text-on-primary-container font-label-bold text-label-bold uppercase rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_15px_rgba(0,230,118,0.3)] cursor-pointer"
          >
            <span>Começar Agora</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>

        {/* Prize Pool Section */}
        <section className="w-full">
          <div className="bg-surface-container rounded-xl p-4 border border-outline-variant flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-secondary-container/10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
            <div className="flex items-center gap-2 text-secondary-fixed">
              <Coins className="w-5 h-5 text-[#ffdb3c]" />
              <h2 className="font-label-bold text-label-bold text-on-surface uppercase tracking-wider">Prêmio Acumulado Estimado</h2>
            </div>
            <div className="font-display-score text-3xl font-extrabold text-[#ffe16d]">
              R$ {accumulatedFeePool.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            
            <div className="w-full h-2.5 bg-surface-variant rounded-full mt-1 overflow-hidden border border-outline-variant">
              <div className="h-full w-[75%] bg-[#00e676] rounded-full relative">
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            <div className="w-full flex justify-between font-label-sm text-label-sm text-on-surface-variant">
              <span>Arrecadação Base: R$ 12.000</span>
              <span className="text-[#75ff9e]">Metas Elevadas (75% Atingido)</span>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-on-surface">Como Funciona</h2>
          <div className="flex flex-col gap-2">
            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-primary shrink-0">
                <UserCheck className="w-6 h-6 text-[#75ff9e]" />
              </div>
              <div>
                <div className="font-label-bold text-label-bold text-primary mb-0.5">PASSO 1</div>
                <div className="font-body-lg text-body-lg text-on-surface">Cadastre-se na Plataforma</div>
              </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-primary shrink-0">
                <Target className="w-6 h-6 text-[#75ff9e]" />
              </div>
              <div>
                <div className="font-label-bold text-label-bold text-primary mb-0.5">PASSO 2</div>
                <div className="font-body-lg text-body-lg text-on-surface">Dê seus palpites e salve com autosave</div>
              </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-secondary-container shrink-0">
                <Trophy className="w-6 h-6 text-[#ffdb3c]" />
              </div>
              <div>
                <div className="font-label-bold text-label-bold text-secondary-container mb-0.5">PASSO 3</div>
                <div className="font-body-lg text-body-lg text-on-surface">Suba no Ranking Live e Ganhe Prêmios</div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-on-surface">Perguntas Frequentes</h2>
          <div className="flex flex-col gap-2">
            {FAQ_ITEMS.map((item, idx) => (
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

        {/* Floating Social Proof footer inside Lobby */}
        <section className="flex flex-col gap-4 items-center text-center mt-6 border-t border-surface-variant pt-6">
          <div className="flex items-center gap-3 bg-surface-container px-4 py-2 rounded-full border border-outline-variant">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-surface-variant border-2 border-surface flex items-center justify-center overflow-hidden">
                <img referrerPolicy="no-referrer" alt="User 1" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDgNJvGPlDognL-0425y3M-sg7mvE3RmvesYAYp9n7oEg42SesETlf29nqZJyPGVzr4byt682BTeuke1Jrzy8iH1Z_vFZTMWxEfQE0PkQWr5x54y8PboNqguZyFx_KfLJv3PgssDn1BxHOAhbvtSfrIJIPtZcEezg1giHPPINvmHL8lABbCCWaaUDF6q28q8kwUoeWLwYVG_f7kcSPmTY8QMSBSAyW_1kvsVSaf2KB90kXH4SzQxaFuUkFWQAm1EydmJTmF3M_Pcp8"/>
              </div>
              <div className="w-8 h-8 rounded-full bg-surface-variant border-2 border-surface flex items-center justify-center overflow-hidden">
                <img referrerPolicy="no-referrer" alt="User 2" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGBzNa7UHDx5snIA0jaKFVo9wAykHEuqVJVTOfIdAkrD7A90wMXgsJeyasfmrel3bv4eBwrFreJsngPKd-WwB4w6wLYiqCzJ88CxSScScf6tWxgAXAthGYbG9jBB_E5a5E84b9VQJLdeyM1ky72323iKulpte60pd5f1ODykHL2UNfTZsNWvquzgE64CbLKXAqosWmHlaqOjBMiJ5zbBU7VmK_0oR5wxx8HaNmoviahQx5yENUAsNDFMIcG4KPqHPmhSIXieyJu7I"/>
              </div>
              <div className="w-10 h-8 rounded-full bg-primary border-2 border-surface flex items-center justify-center text-[10px] text-on-primary font-bold">
                +1.2k
              </div>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Mais de 1.200 apostadores já começaram</span>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <h3 className="text-lg font-bold text-on-surface">Não fique de fora do jogo. Junte-se a nós!</h3>
            <button 
              onClick={() => setMode('register')}
              id="lobby-register-trigger"
              className="w-full h-[48px] bg-[#121311] text-[#f8f87c] font-label-bold text-label-bold uppercase rounded-lg flex items-center justify-center hover:bg-[#62ff96] active:scale-95 transition-transform"
            >
              Criar Minha Conta
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col justify-center items-center px-4 py-8 w-full pb-36 relative z-10">
      <div className="w-full max-w-md flex flex-col animate-[fadeIn_0.3s_ease-out]">
        <div className="text-center mb-6">
          <h1 className="font-display-score text-4xl text-primary font-extrabold tracking-tighter uppercase italic text-center">BOLÃOPRO 2026</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
            {authMode === 'signup' ? 'Crie sua conta para entrar no Bolão Oficial da Copa.' : 'Faça login com sua conta real para gerenciar seus palpites.'}
          </p>
        </div>

        {/* Auth Mode Toggle Tabs */}
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

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="mb-4 bg-red-950/40 border border-red-500/40 text-red-300 p-4 rounded-xl flex items-start gap-3 animate-fadeIn text-xs">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Atenção:</strong>
              <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Auth Container */}
        <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5 bg-surface-container-low p-6 border border-surface-variant rounded-xl relative overflow-hidden shadow-2xl">
          {/* Top subtle visual anchor */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00e676]/30 to-transparent"></div>

          {/* Nome Completo (Only on Signup) */}
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

          {/* CPF e Telefone (Only on Signup) — exigidos pelo PagBank */}
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

          {/* Email */}
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

          {/* Senha */}
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

            {/* Simulated password strength indicator - exactly requested in A1 (Only on Signup) */}
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

          {/* Mathematical anti-spam verify challenge (Only on Signup) */}
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

          {/* Action CTA register */}
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

        {/* Voltar para Lobby */}
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
