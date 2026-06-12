// Deno Edge Function: pagbank-webhook-test
// Simula o disparo de um webhook de pagamento para testes
// Hospedada em Supabase Edge Functions (Deno Runtime)

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

    const { orderId } = await req.json();

    if (!orderId) {
      throw new Error("orderId é obrigatório");
    }

    // Buscar transação
    const { data: dbTx, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("pagbank_id", orderId)
      .single();

    if (txError || !dbTx) {
      // Fallback: buscar por qualquer transação pendente mais recente
      const { data: fallbackTx } = await supabase
        .from("transactions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!fallbackTx) {
        throw new Error("Transação não encontrada");
      }

      // Processar transação found
      return await processPayment(supabase, fallbackTx);
    }

    // Processar transação encontrada
    return await processPayment(supabase, dbTx);

  } catch (error: any) {
    console.error("[PagBank Test] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

async function processPayment(supabase: any, dbTx: any) {
  const { id: txId, user_id, group_id, amount } = dbTx;

  // Verificar se já foi processada
  if (dbTx.status === "paid") {
    return new Response(
      JSON.stringify({ success: true, message: "idempotent_already_processed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  // Atualizar transação
  await supabase
    .from("transactions")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", txId);

  if (dbTx.funding_mode === "wallet_topup") {
    const { data: wallet } = await supabase
      .from("bettor_wallets")
      .select("balance")
      .eq("user_id", user_id)
      .maybeSingle();

    const nextWalletBalance = (parseFloat(String(wallet?.balance ?? 0)) || 0) + amount;

    await supabase
      .from("bettor_wallets")
      .upsert({
        user_id,
        balance: nextWalletBalance,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    await supabase
      .from("bettor_wallet_ledger")
      .insert({
        user_id,
        transaction_id: txId,
        group_id,
        direction: "credit",
        reason: "pix_topup",
        amount
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: "wallet_topup_settled_successfully",
        transactionId: dbTx.pagbank_id,
        amount,
        walletBalance: nextWalletBalance
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  // Buscar configurações do grupo
  const { data: bGroup } = await supabase
    .from("bolao_groups")
    .select("*, tenant_settings:tenant_id(*)")
    .eq("id", group_id)
    .single();

  const settings = bGroup?.tenant_settings?.[0] || { fee_type: "percent", fee_value: 20 };

  let commission = 0;
  if (settings.fee_type === "percent") {
    commission = amount * (parseFloat(settings.fee_value) / 100);
  } else {
    commission = parseFloat(settings.fee_value);
  }
  if (commission > amount) commission = amount;
  const netValue = amount - commission;

  const nextPrizePool = parseFloat(bGroup?.prize_pool || 0) + amount;
  const nextNetPrizePool = parseFloat(bGroup?.net_prize_pool || 0) + netValue;

  await supabase
    .from("bolao_groups")
    .update({ prize_pool: nextPrizePool, net_prize_pool: nextNetPrizePool })
    .eq("id", group_id);

  if (bGroup?.tenant_id) {
    const { data: tenantProfile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", bGroup.tenant_id)
      .single();

    if (tenantProfile) {
      const tenantNextBalance = parseFloat(tenantProfile.balance || 0) + commission;
      await supabase
        .from("profiles")
        .update({ balance: tenantNextBalance })
        .eq("id", bGroup.tenant_id);
    }
  }

  console.log(`[PagBank Test] Pagamento processado: tx=${dbTx.pagbank_id}, amount=R$ ${amount}`);

  return new Response(
    JSON.stringify({
      success: true,
      message: "payment_settled_successfully",
      transactionId: dbTx.pagbank_id,
      amount,
      commission,
      netValue
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
}
