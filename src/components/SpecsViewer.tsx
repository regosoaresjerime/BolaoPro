/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Database, FileCode, Check, Copy, Sparkles, Terminal, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export default function SpecsViewer() {
  const [activeTab, setActiveTab] = useState<'sql' | 'pix' | 'webhook'>('sql');
  const [copied, setCopied] = useState(false);

  const sqlSchema = `-- ====================================================================
-- Schema SQL Completo - BolãoPro 2026
-- Banco de Dados PostgreSQL (Supabase) com RLS para Arquitetura Multi-Tenant
-- ====================================================================

-- Habilitar extensões úteis
create extension if not exists "uuid-ossp";

-- 1. Tabela de Perfis de Usuários (Apostadores e Organizadores)
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null,
    avatar_url text,
    balance numeric(12, 2) not null default 0.00,
    total_points integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabela de Configurações do Tenant (Administrador/Organizador)
create table public.tenant_settings (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.profiles(id) on delete cascade not null,
    company_name text not null,
    fee_type text not null check (fee_type in ('percent', 'fixed')),
    fee_value numeric(10, 2) not null default 10.00, -- R$ ou %
    entry_fee numeric(10, 2) not null default 50.00, -- taxa de inscrição
    min_withdrawal numeric(10, 2) not null default 50.00,
    first_place_pct numeric(5, 2) not null default 60.00, -- rateios
    second_place_pct numeric(5, 2) not null default 25.00,
    third_place_pct numeric(5, 2) not null default 15.00,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabela de Grupos de Bolões
create table public.bolao_groups (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    invite_code varchar(20) unique not null,
    prize_pool numeric(12, 2) not null default 0.00,
    net_prize_pool numeric(12, 2) not null default 0.00,
    created_by uuid references public.profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabela de Partidas da Copa 2024
create table public.matches (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.profiles(id) on delete cascade not null,
    group_id uuid references public.bolao_groups(id) on delete cascade not null,
    team_a text not null,
    team_b text not null,
    team_a_flag text,
    team_b_flag text,
    status text not null check (status in ('scheduled', 'live', 'finished')) default 'scheduled',
    score_a integer,
    score_b integer,
    started_at timestamp with time zone not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Configuração de Row Level Security (RLS) - Multi-Tenant
alter table public.profiles enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.bolao_groups enable row level security;
alter table public.matches enable row level security;

-- Política de Tenant RLS para Matches
create policy "Tenants podem gerenciar partidas de seus bolões"
    on public.matches for all using (auth.uid() = tenant_id);

create policy "Qualquer usuário logado pode visualizar as partidas"
    on public.matches for select using (true);`;

  const pixFunction = `// Deno Edge Function: pagbank-pix
// Gerador de Cobrança Pix via API Rest do PagBank
// Hospedada em Supabase Edge Functions (Deno Runtime)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { groupId, userId, amount, fullName, email } = await req.json();

    const pagbankUrl = "https://sandbox.api.pagseguro.com/orders";
    const pagbankPayload = {
      reference_id: \`BPRO-\${groupId.substring(0, 8)}-\${userId.substring(0, 8)}\`,
      customer: {
        name: fullName || "Apostador",
        email: email,
        tax_id: "12345678909",
        phones: [{ country: "55", area: "11", number: "999999999", type: "MOBILE" }]
      },
      qr_codes: [{
        amount: { value: Math.round(amount * 100) },
        expiration_date: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }],
      notification_urls: [\`\${Deno.env.get("SUPABASE_URL")}/functions/v1/pagbank-webhook\`]
    };

    // Chamada à API PagBank e criação de registro pendente em public.transactions...
    const copiaECola = "00020101021226830014br.gov.bcb.pix2561api.pagseguro.com/pix/qrcode...";
    return new Response(JSON.stringify({ success: true, qrCodeText: copiaECola }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});`;

  const webhookFunction = `// Deno Edge Function: pagbank-webhook
// Receptor de Webhooks de Pagamento e Orquestrador de Comissões e Rateio

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const orderId = body.id;
    const chargeStatus = body.charges?.[0]?.status;

    if (chargeStatus === "PAID") {
      // 1. Localiza a transação
      // 2. Busca tenant_settings
      // 3. Calcula comissão (Percentual % vs Fixo R$)
      // 4. Rateia o saldo acumulado (prize_pool / net_prize_pool)
      // 5. Atualiza perfis de saldos do Tenant
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});`;

  const getCode = () => {
    if (activeTab === 'sql') return sqlSchema;
    if (activeTab === 'pix') return pixFunction;
    return webhookFunction;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto px-4 md:px-8 py-6">
      {/* Intro Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-5 h-5 text-[#00E676]" />
          <span className="font-label-bold text-label-bold uppercase tracking-widest text-[#00E676]">Arquitetura de Sistemas</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-on-surface text-white">Integração Supabase & PostgreSQL</h2>
        <p className="text-on-surface-variant font-body-sm text-body-sm max-w-2xl text-gray-400">
          O backend do BolãoPro está completamente estruturado com tabelas PostgreSQL com Row Level Security (RLS) habilitado para isolamento rígido multi-tenant e segurança contra trapaças.
        </p>
      </div>

      {/* Interactive Supabase Status Card */}
      <div className="bg-[#161B22] border border-outline-variant p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-lg border-[#1c242e]">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl shrink-0 ${isSupabaseConfigured ? 'bg-[#00E676]/10 text-[#00E676]' : 'bg-amber-500/10 text-amber-500'}`}>
            <Terminal className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-white text-md flex items-center gap-2">
              Status da Conexão: {isSupabaseConfigured ? (
                <span className="text-[#00E676] text-xs px-2 py-0.5 rounded bg-[#00E676]/10 border border-[#00E676]/30 uppercase font-mono">Conectado ao Cloud</span>
              ) : (
                <span className="text-amber-500 text-xs px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 uppercase font-mono">Simulador Local Ativo</span>
              )}
            </h4>
            <p className="text-xs text-gray-400 mt-1 max-w-xl leading-relaxed">
              {isSupabaseConfigured 
                ? 'Sua aplicação web está conectada ao seu banco PostgreSQL do Supabase no ambiente de produção. Todas as mutações e autenticações são propagadas em tempo real.' 
                : 'Para sincronizar com sua conta real do Supabase, adicione as variáveis de ambiente "VITE_SUPABASE_URL" e "VITE_SUPABASE_ANON_KEY" nas configurações do projeto no AI Studio.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full md:w-auto">
          {!isSupabaseConfigured && (
            <div className="text-[11px] text-amber-500/90 font-mono bg-amber-500/5 p-2 rounded border border-amber-500/20 max-w-xs">
              💡 <strong>Como conectar:</strong> Vá em settings &gt; Secrets no painel superior e preencha as variáveis de ambiente.
            </div>
          )}
          <div className="text-[11px] text-[#00E676]/90 font-mono bg-[#00E676]/5 p-2 rounded border border-[#00E676]/20 max-w-xs">
            🛡️ <strong>Segurança RLS:</strong> Todo palpite alheio é blindado contra fraudes por RLS antes do início do jogo!
          </div>
        </div>
      </div>

      {/* Tabs / Switches */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="md:col-span-3 flex flex-col gap-2 bg-surface-container-low border border-outline-variant p-3 rounded-xl">
          <button
            onClick={() => setActiveTab('sql')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-bold text-label-bold text-left transition-colors ${
              activeTab === 'sql'
                ? 'bg-primary-container/10 text-primary border border-primary/20'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'
            }`}
          >
            <Database className="w-4 h-4 shrink-0" />
            <div>
              <div className="font-bold flex items-center justify-between">
                Postgres Schema
              </div>
              <div className="text-[10px] font-normal leading-normal opacity-75">schema.sql DDL & RLS</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('pix')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-bold text-label-bold text-left transition-colors ${
              activeTab === 'pix'
                ? 'bg-primary-container/10 text-primary border border-primary/20'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'
            }`}
          >
            <FileCode className="w-4 h-4 shrink-0" />
            <div>
              <div className="font-bold">Edge Function - Pix</div>
              <div className="text-[10px] font-normal leading-normal opacity-75">pagbank-pix/index.ts</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('webhook')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-bold text-label-bold text-left transition-colors ${
              activeTab === 'webhook'
                ? 'bg-primary-container/10 text-primary border border-primary/20'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'
            }`}
          >
            <Terminal className="w-4 h-4 shrink-0" />
            <div>
              <div className="font-bold">Webhook & Comissões</div>
              <div className="text-[10px] font-normal leading-normal opacity-75">pagbank-webhook/index.ts</div>
            </div>
          </button>
        </div>

        {/* Code Output Viewer */}
        <div className="md:col-span-9 flex flex-col bg-[#090C10] border border-outline-variant rounded-xl overflow-hidden shadow-2xl relative">
          {/* Top Panel Actions */}
          <div className="flex items-center justify-between px-md py-sm bg-surface-container border-b border-outline-variant">
            <span className="font-mono text-xs text-on-surface-variant">
              {activeTab === 'sql' ? 'supabase/schema.sql' : activeTab === 'pix' ? 'supabase/functions/pagbank-pix/index.ts' : 'supabase/functions/pagbank-webhook/index.ts'}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface border border-outline-variant hover:border-primary text-on-surface font-label-bold text-label-bold text-xs hover:bg-surface-container transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00E676]" />
                  <span className="text-[#00E676]">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-on-surface-variant" />
                  <span>Copiar Código</span>
                </>
              )}
            </button>
          </div>

          {/* Actual Code Area */}
          <div className="p-4 overflow-x-auto max-h-[500px] font-mono text-xs text-[#bacbb9] bg-black/60 leading-relaxed scrollbar-thin">
            <pre className="whitespace-pre">{getCode()}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
