# 🚀 Roteiro Manual - Integração PagBank PIX no BolãoPro

> **Projeto Supabase correto:** `iwwlkqqgdtarkmstlcov` (https://supabase.com/dashboard/project/iwwlkqqgdtarkmstlcov)
>
> ⚠️ A IDE está conectada em outra conta. Faça **tudo** abaixo manualmente no painel.

---

## PASSO 1 — Criar/Atualizar as Tabelas (SQL Editor)

Acesse: **SQL Editor → New query** no painel do Supabase e execute **cada bloco** abaixo (em queries separadas é mais seguro).

### 1.1 Extensões e Profiles

```sql
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null,
    avatar_url text,
    balance numeric(12, 2) not null default 0.00,
    total_points integer not null default 0,
    is_admin boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 1.2 Tenant Settings

```sql
create table if not exists public.tenant_settings (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.profiles(id) on delete cascade not null,
    company_name text not null,
    fee_type text not null check (fee_type in ('percent', 'fixed')),
    fee_value numeric(10, 2) not null default 10.00,
    entry_fee numeric(10, 2) not null default 50.00,
    min_withdrawal numeric(10, 2) not null default 50.00,
    first_place_pct numeric(5, 2) not null default 60.00,
    second_place_pct numeric(5, 2) not null default 25.00,
    third_place_pct numeric(5, 2) not null default 15.00,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint sum_distribution check (first_place_pct + second_place_pct + third_place_pct = 100.00)
);
```

### 1.3 Bolão Groups

```sql
create table if not exists public.bolao_groups (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    invite_code varchar(20) unique not null,
    prize_pool numeric(12, 2) not null default 0.00,
    net_prize_pool numeric(12, 2) not null default 0.00,
    created_by uuid references public.profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 1.4 Matches

```sql
create table if not exists public.matches (
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
```

### 1.5 User Picks

```sql
create table if not exists public.user_picks (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    match_id uuid references public.matches(id) on delete cascade not null,
    score_a integer not null check (score_a >= 0),
    score_b integer not null check (score_b >= 0),
    points_awarded integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_user_match_pick unique (user_id, match_id)
);
```

### 1.6 Transactions (CRÍTICA para o PagBank)

```sql
create table if not exists public.transactions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    group_id uuid references public.bolao_groups(id) on delete cascade not null,
    amount numeric(10, 2) not null,
    status text not null check (status in ('pending', 'paid', 'failed', 'expired')) default 'pending',
    payment_method text not null default 'pix',
    pagbank_id text,
    qrcode_text text,
    qrcode_image text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 1.6.1 Adicionar coluna `cpf` em profiles (obrigatório para PagBank)

```sql
alter table public.profiles
    add column if not exists cpf text;

create unique index if not exists idx_profiles_cpf_unique
    on public.profiles (cpf)
    where cpf is not null;

comment on column public.profiles.cpf is 'CPF do usuário (somente dígitos, 11 caracteres) - usado para emissão de cobrança PagBank';
```

### 1.7 RLS (Row Level Security) + Políticas

```sql
alter table public.profiles enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.bolao_groups enable row level security;
alter table public.matches enable row level security;
alter table public.user_picks enable row level security;
alter table public.transactions enable row level security;

-- Profiles
drop policy if exists "Usuários podem visualizar todos os perfis" on public.profiles;
create policy "Usuários podem visualizar todos os perfis" on public.profiles for select using (true);

drop policy if exists "Usuários podem atualizar seus próprios perfis" on public.profiles;
create policy "Usuários podem atualizar seus próprios perfis" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Usuários podem criar seus próprios perfis" on public.profiles;
create policy "Usuários podem criar seus próprios perfis" on public.profiles for insert with check (auth.uid() = id);

-- Tenant Settings
drop policy if exists "Tenants podem gerenciar suas próprias configurações" on public.tenant_settings;
create policy "Tenants podem gerenciar suas próprias configurações" on public.tenant_settings for all using (auth.uid() = tenant_id);

drop policy if exists "Apostadores do bolão podem visualizar configurações do tenant" on public.tenant_settings;
create policy "Apostadores do bolão podem visualizar configurações do tenant" on public.tenant_settings for select using (true);

-- Bolão Groups
drop policy if exists "Tenants podem gerenciar seus bolões" on public.bolao_groups;
create policy "Tenants podem gerenciar seus bolões" on public.bolao_groups for all using (auth.uid() = tenant_id);

drop policy if exists "Qualquer usuário logado pode visualizar grupos por convite" on public.bolao_groups;
create policy "Qualquer usuário logado pode visualizar grupos por convite" on public.bolao_groups for select using (true);

-- Matches
drop policy if exists "Tenants podem gerenciar partidas de seus bolões" on public.matches;
create policy "Tenants podem gerenciar partidas de seus bolões" on public.matches for all using (auth.uid() = tenant_id);

drop policy if exists "Qualquer usuário logado pode visualizar as partidas" on public.matches;
create policy "Qualquer usuário logado pode visualizar as partidas" on public.matches for select using (true);

-- User Picks
drop policy if exists "Usuários podem gerenciar seus próprios palpites" on public.user_picks;
create policy "Usuários podem gerenciar seus próprios palpites" on public.user_picks for all using (auth.uid() = user_id);

drop policy if exists "Apostadores podem ver palpites alheios somente se a partida estiver iniciada/encerrada" on public.user_picks;
create policy "Apostadores podem ver palpites alheios somente se a partida estiver iniciada/encerrada" on public.user_picks for select using (
    auth.uid() = user_id
    or exists (
        select 1 from public.matches
        where matches.id = match_id
        and (matches.status = 'live' or matches.status = 'finished' or matches.started_at < now())
    )
);

-- Transactions
drop policy if exists "Usuários visualizam suas próprias transações" on public.transactions;
create policy "Usuários visualizam suas próprias transações" on public.transactions for select using (auth.uid() = user_id);

drop policy if exists "System/Edge functions podem gerenciar transações" on public.transactions;
create policy "System/Edge functions podem gerenciar transações" on public.transactions for all using (true);
```

### 1.8 Índices

```sql
create index if not exists idx_tenant_settings_id on public.tenant_settings(tenant_id);
create index if not exists idx_bolao_groups_tenant on public.bolao_groups(tenant_id);
create index if not exists idx_matches_tenant_group on public.matches(tenant_id, group_id);
create index if not exists idx_user_picks_match on public.user_picks(match_id);
create index if not exists idx_user_picks_user on public.user_picks(user_id);
create index if not exists idx_transactions_user_group on public.transactions(user_id, group_id);
create index if not exists idx_groups_invite_code on public.bolao_groups(invite_code);
```

---

## PASSO 2 — Variáveis de Ambiente das Edge Functions

Acesse: **Edge Functions → Manage secrets** (ou **Settings → API** → **Edge Functions secrets**).

Crie (ou atualize) as seguintes secrets:

| Nome                       | Valor                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `PAGBANK_TOKEN`            | (seu token de produção do PagBank) — **comece vazio para usar o modo simulação**              |
| `PAGBANK_PROD_ENABLED`     | `true` para produção; `false` para simulação                                                   |
| `PAGBANK_SANDBOX`          | `true` para sandbox; `false` para produção                                                     |
| `SUPABASE_URL`             | (já existe automaticamente)                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`| (já existe automaticamente)                                                                    |

> 💡 **Dica para testar primeiro:** deixe `PAGBANK_PROD_ENABLED=false`. Nesse modo, a função retorna um QR Code simulado (mock) **sem** chamar a API do PagBank, e você pode validar todo o fluxo antes de colocar a chave real.

---

## PASSO 3 — Deploy das Edge Functions (via Dashboard)

Acesse: **Edge Functions → Create a new function** (ou **Deploy a new function**).

### 3.1 Função: `pagbank-create-order`

- Slug: `pagbank-create-order`
- **Verify JWT with legacy secret:** deixe **DESLIGADO** (OFF) — esta função precisa ser chamada pelo frontend com a anon key.
- Cole o código abaixo (em **Edit source**):

```typescript
// Deno Edge Function: pagbank-create-order
// Criação de Cobrança Pix via API REST PagBank

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { amount, userId, userEmail, userName, groupId, groupName, description } = body;

    if (!amount || !userId || !groupId) {
      throw new Error("Parâmetros obrigatórios: amount, userId, groupId");
    }

    const pagbankSandbox = Deno.env.get("PAGBANK_SANDBOX") === "true";
    const pagbankToken = Deno.env.get("PAGBANK_TOKEN");

    const pagbankBaseUrl = pagbankSandbox
      ? "https://sandbox.api.pagseguro.com"
      : "https://api.pagseguro.com";

    const referenceId = `BPRO-${groupId.substring(0, 8)}-${userId.substring(0, 8)}-${Date.now()}`;
    const amountCents = Math.round(amount * 100);

    // ✅ CORREÇÃO: usa SUPABASE_URL (não SUPABASE_FUNCTIONS_URL que não existe)
    const pagbankPayload = {
      reference_id: referenceId,
      customer: {
        name: userName || "Apostador BolãoPro",
        email: userEmail || "usuario@bolaopro.com.br",
        tax_id: "12345678909",
        phones: [
          {
            country: "55",
            area: "11",
            number: "999999999",
            type: "MOBILE"
          }
        ]
      },
      items: [
        {
          name: description || `Taxa de inscrição - ${groupName}`,
          quantity: 1,
          unit_amount: amountCents
        }
      ],
      qr_codes: [
        {
          amount: {
            value: amountCents
          },
          expiration_date: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        }
      ],
      notification_urls: [
        `${supabaseUrl}/functions/v1/pagbank-webhook`
      ]
    };

    console.log(`[PagBank] Criando order Pix user=${userId} amount=R$${amount} group=${groupId}`);

    let responseData;

    if (pagbankToken && Deno.env.get("PAGBANK_PROD_ENABLED") === "true") {
      // Modo produção: chama PagBank de verdade
      const response = await fetch(`${pagbankBaseUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${pagbankToken}`,
          "accept": "application/json"
        },
        body: JSON.stringify(pagbankPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PagBank API error: ${response.status} - ${errorText}`);
      }

      responseData = await response.json();
    } else {
      // Modo simulação (mock) - ideal para testes
      const mockQrCodeText = `00020101021226830014br.gov.bcb.pix2561api.pagseguro.com/pix/v2/cobv/BPRO2026_${Math.floor(Math.random()*900000+100000)}5204000053039865405${amount.toFixed(2)}5802BR5912BOLAOPRO20266009SAOPAULO62070503***6304${Math.floor(Math.random()*9000 + 1000)}`;

      responseData = {
        id: `OR-${Math.floor(Math.random()*9000000+1000000)}`,
        reference_id: referenceId,
        status: "WAITING",
        customer: pagbankPayload.customer,
        items: pagbankPayload.items,
        qr_codes: [
          {
            id: `QR-${Math.floor(Math.random()*90000+10000)}`,
            amount: { value: amountCents },
            text: mockQrCodeText,
            expiration_date: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            links: [
              {
                rel: "QRCODE.PNG",
                href: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockQrCodeText)}`,
                media: "image/png",
                type: "GET"
              }
            ]
          }
        ]
      };
    }

    const orderId = responseData.id;
    const qrCode = responseData.qr_codes?.[0];

    if (!qrCode) {
      throw new Error("Resposta do PagBank não contém QR Code");
    }

    const qrCodeText = qrCode.text;
    const qrCodeImage = qrCode.links?.find((l: any) => l.rel === "QRCODE.PNG")?.href || "";
    const expiresAt = qrCode.expiration_date || new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Gravar transação no banco
    const { error: dbError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        group_id: groupId,
        amount: amount,
        status: "pending",
        pagbank_id: orderId,
        qrcode_text: qrCodeText,
        qrcode_image: qrCodeImage,
      });

    if (dbError) {
      console.error("[PagBank] Erro ao salvar transação:", dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        reference_id: referenceId,
        status: responseData.status || "WAITING",
        qr_code: {
          qr_code_text: qrCodeText,
          qr_code_image: qrCodeImage
        },
        expires_at: expiresAt,
        amount: { value: amountCents, currency: "BRL" }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("[PagBank] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
```

Clique em **Deploy**.

### 3.2 Função: `pagbank-webhook`

- Slug: `pagbank-webhook`
- **Verify JWT:** **DESLIGADO** (o PagBank chama diretamente; não envia JWT).
- Cole:

```typescript
// Deno Edge Function: pagbank-webhook
// Receptor de webhooks do PagBank

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pagbank-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const pagbankToken = Deno.env.get("PAGBANK_TOKEN") ?? "";

    const signature = req.headers.get("x-pagbank-signature");
    const productId = req.headers.get("x-product-id");
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    console.log("[PagBank Webhook] Recebido:", JSON.stringify(body));

    // Validação opcional de assinatura SHA-256
    if (signature && pagbankToken) {
      const encoder = new TextEncoder();
      const data = encoder.encode(pagbankToken + "-" + rawBody);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const expectedSignature = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (signature !== expectedSignature) {
        console.error("[PagBank Webhook] Assinatura inválida!");
        return new Response(JSON.stringify({ error: "assinatura_invalida" }), { status: 401 });
      }
    }

    const orderId = productId?.startsWith("ORDE_") ? productId : (body.id || body.reference_id);
    const orderStatus = body.status;
    const chargeStatus = body.charges?.[0]?.status;
    const isPaid = orderStatus === "PAID" || chargeStatus === "PAID";

    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id_nao_encontrado" }), { status: 400 });
    }

    const { data: dbTx, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("pagbank_id", orderId)
      .single();

    if (txError || !dbTx) {
      console.error(`[PagBank Webhook] Transação não encontrada: ${orderId}`);
      return new Response(JSON.stringify({ error: "transacao_nao_encontrada" }), { status: 404 });
    }

    if (dbTx.status === "paid") {
      return new Response(JSON.stringify({ success: true, message: "idempotent" }), { status: 200 });
    }

    if (!isPaid) {
      let newStatus = "pending";
      if (chargeStatus === "CANCELED" || chargeStatus === "DECLINED" || orderStatus === "CANCELED") {
        newStatus = "failed";
      } else if (orderStatus === "EXPIRED") {
        newStatus = "expired";
      }

      await supabase
        .from("transactions")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", dbTx.id);

      return new Response(JSON.stringify({ status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Pagamento confirmado: atualizar transação e premiar pool
    const { user_id, group_id, amount } = dbTx;

    const { data: bGroup, error: groupError } = await supabase
      .from("bolao_groups")
      .select("*, tenant_settings:tenant_id(*)")
      .eq("id", group_id)
      .single();

    if (groupError || !bGroup) {
      return new Response(JSON.stringify({ error: "grupo_nao_encontrado" }), { status: 404 });
    }

    const settings = bGroup.tenant_settings?.[0] || { fee_type: "percent", fee_value: 20.00 };
    let commission = 0;
    if (settings.fee_type === "percent") {
      commission = amount * (parseFloat(settings.fee_value) / 100);
    } else {
      commission = parseFloat(settings.fee_value);
    }
    if (commission > amount) commission = amount;
    const netValue = amount - commission;

    await supabase
      .from("transactions")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", dbTx.id);

    const nextPrizePool = parseFloat(bGroup.prize_pool || 0) + parseFloat(amount);
    const nextNetPrizePool = parseFloat(bGroup.net_prize_pool || 0) + parseFloat(netValue);

    await supabase
      .from("bolao_groups")
      .update({ prize_pool: nextPrizePool, net_prize_pool: nextNetPrizePool })
      .eq("id", group_id);

    if (bGroup.tenant_id) {
      const { data: tenantProfile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", bGroup.tenant_id)
        .single();

      if (tenantProfile) {
        const tenantNextBalance = parseFloat(tenantProfile.balance || 0) + parseFloat(commission);
        await supabase
          .from("profiles")
          .update({ balance: tenantNextBalance })
          .eq("id", bGroup.tenant_id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      prizePool: nextPrizePool,
      netPrizePool: nextNetPrizePool,
      commission,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("[PagBank Webhook] Erro fatal:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
```

Clique em **Deploy**.

### 3.3 Função: `pagbank-webhook-test` (opcional, para testes)

- Slug: `pagbank-webhook-test`
- **Verify JWT:** **DESLIGADO**
- Cole o código de [supabase/functions/pagbank-webhook-test/index.ts](file:///c:/Users/Jerime/Documents/App-Bol%C3%A3oPro/bol%C3%A3opro-2026/supabase/functions/pagbank-webhook-test/index.ts) (já está correto, sem uso de `SUPABASE_FUNCTIONS_URL`).

---

## PASSO 4 — Testar

Após deploy, execute no PowerShell:

```powershell
$headers = @{
    'Content-Type' = 'application/json'
    'Authorization' = 'Bearer SUA_SUPABASE_ANON_KEY'
}
$body = '{"amount":50,"userId":"seu-user-id-aqui","userEmail":"voce@email.com","userName":"Seu Nome","groupId":"seu-group-uuid-aqui","groupName":"Bolão Teste"}'

Invoke-RestMethod -Method POST -Uri 'https://iwwlkqqgdtarkmstlcov.supabase.co/functions/v1/pagbank-create-order' -Headers $headers -Body $body
```

> **Importante:** substitua `seu-user-id-aqui` pelo ID real de um usuário em `auth.users` e `seu-group-uuid-aqui` por um UUID válido de `bolao_groups`. Pegue esses valores no **Table Editor** do Supabase.

### Resposta esperada (modo simulação):

```json
{
  "success": true,
  "order_id": "OR-1234567",
  "reference_id": "BPRO-xxxxxxxx-yyyyyyyy-1234567890",
  "status": "WAITING",
  "qr_code": {
    "qr_code_text": "00020101021226...",
    "qr_code_image": "https://api.qrserver.com/..."
  },
  "expires_at": "2025-...",
  "amount": { "value": 5000, "currency": "BRL" }
}
```

---

## Resumo do erro original

A função `pagbank-create-order` (versão antiga) usava:

```typescript
notification_urls: [`${Deno.env.get("SUPABASE_FUNCTIONS_URL")}/pagbank-webhook`]
```

`SUPABASE_FUNCTIONS_URL` **não existe** como env var no Deno/Supabase. O resultado era `null/functions/v1/pagbank-webhook`, e o PagBank rejeitava com o erro **HTTP 400 — código 40002 `invalid_notification_url`**.

A correção foi trocar para `SUPABASE_URL` (a env var que **existe** e contém a URL completa do projeto).
