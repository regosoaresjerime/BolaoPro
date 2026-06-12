// Deno Edge Function: pagbank-webhook
// Receptor de Webhooks do PagBank
// Documentação: https://dev.pagseguro.com.br
// Importante: Validar assinatura SHA-256 para segurança

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

    // Obter headers conforme documentação
    const productOrigin = req.headers.get("x-product-origin");
    const productId = req.headers.get("x-product-id");
    const signature = req.headers.get("x-pagbank-signature");

    // Obter body cru para validação de assinatura
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    console.log("[PagBank Webhook] Recebido:", JSON.stringify(body));
    console.log("[PagBank Webhook] Headers:", { productOrigin, productId, signature });

    // ========================================
    // VALIDAÇÃO DE SEGURANÇA (opcional mas recomendado)
    // ========================================
    // A documentação diz para validar SHA256(Token + "-" + PayloadBruto)
    if (signature && pagbankToken) {
      const crypto = await import("https://deno.land/std@0.177.0/crypto.ts");
      const expectedSignature = await crypto.sha256Hex(pagbankToken + "-" + rawBody);
      
      if (signature !== expectedSignature) {
        console.error("[PagBank Webhook] Assinatura inválida!");
        return new Response(JSON.stringify({ error: "assinatura_invalida" }), { status: 401 });
      }
      console.log("[PagBank Webhook] Assinatura válida!");
    }

    // ========================================
    // PROCESSAMENTO DO WEBHOOK
    // ========================================
    
    // Identificar o order ID (pela documentação, usar x-product-id ou id do body)
    const orderId = productId?.startsWith("ORDE_") ? productId : (body.id || body.reference_id);
    
    // Status conforme documentação: PAID = confirmação de pagamento
    const orderStatus = body.status;
    const chargeStatus = body.charges?.[0]?.status;
    
    // O status PAID indica pagamento confirmado
    const isPaid = orderStatus === "PAID" || chargeStatus === "PAID";

    console.log(`[PagBank Webhook] Order: ${orderId}, Status: ${orderStatus}, Charge: ${chargeStatus}`);

    // Se não conseguir identificar o order, retorna erro
    if (!orderId) {
      console.error("[PagBank Webhook] Order ID não encontrado");
      return new Response(JSON.stringify({ error: "order_id_nao_encontrado" }), { status: 400 });
    }

    // Buscar transação no banco
    const { data: dbTx, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("pagbank_id", orderId)
      .single();

    if (txError || !dbTx) {
      console.error(`[PagBank Webhook] Transação não encontrada: ${orderId}`);
      return new Response(JSON.stringify({ error: "transacao_nao_encontrada" }), { status: 404 });
    }

    // Verificar se já foi processado (idempotência)
    if (dbTx.status === "paid") {
      console.log(`[PagBank Webhook] Transação ${orderId} já processada`);
      return new Response(JSON.stringify({ success: true, message: "idempotent_already_processed" }), { status: 200 });
    }

    // Se não for pagamento confirmado, apenas registrar status
    if (!isPaid) {
      console.log(`[PagBank Webhook] Status não final: ${chargeStatus || orderStatus}`);
      
      // Atualizar status conforme o estado
      let newStatus = "pending";
      if (chargeStatus === "CANCELED" || chargeStatus === "DECLINED" || orderStatus === "CANCELED") {
        newStatus = "canceled";
      } else if (orderStatus === "EXPIRED") {
        newStatus = "expired";
      }
      
      await supabase
        .from("transactions")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString() 
        })
        .eq("id", dbTx.id);
      
      return new Response(JSON.stringify({ status: "processed", reason: "payment_" + newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    // ========================================
    // PROCESSAR PAGAMENTO CONFIRMADO (PAID)
    // ========================================
    const { user_id, group_id } = dbTx;
    const amount = parseFloat(String(dbTx.amount || 0));
    console.log(`[PagBank Webhook] Processando pagamento: user=${user_id}, amount=R$ ${amount}, mode=${dbTx.funding_mode || "legacy_entry"}`);

    const { error: updateTxErr } = await supabase
      .from("transactions")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", dbTx.id);

    if (updateTxErr) throw new Error(`Erro ao atualizar transação: ${updateTxErr.message}`);

    if (dbTx.funding_mode === "wallet_topup") {
      const { data: wallet } = await supabase
        .from("bettor_wallets")
        .select("balance")
        .eq("user_id", user_id)
        .maybeSingle();

      const nextWalletBalance = (parseFloat(String(wallet?.balance ?? 0)) || 0) + amount;

      const { error: walletUpsertErr } = await supabase
        .from("bettor_wallets")
        .upsert({
          user_id,
          balance: nextWalletBalance,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (walletUpsertErr) throw new Error(`Erro ao creditar carteira: ${walletUpsertErr.message}`);

      const { error: ledgerErr } = await supabase
        .from("bettor_wallet_ledger")
        .insert({
          user_id,
          transaction_id: dbTx.id,
          group_id,
          direction: "credit",
          reason: "pix_topup",
          amount
        });

      if (ledgerErr) throw new Error(`Erro ao registrar ledger: ${ledgerErr.message}`);

      return new Response(JSON.stringify({
        success: true,
        message: "wallet_topup_settled_successfully",
        walletBalance: nextWalletBalance
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    // Fluxo legado: pagamento direto já compõe o prêmio do bolão
    const { data: bGroup, error: groupError } = await supabase
      .from("bolao_groups")
      .select("*, tenant_settings:tenant_id(*)")
      .eq("id", group_id)
      .single();

    if (groupError || !bGroup) {
      console.error(`[PagBank Webhook] Erro ao buscar grupo:`, groupError);
      return new Response(JSON.stringify({ error: "grupo_bolao_nao_encontrado" }), { status: 404 });
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
    const nextPrizePool = parseFloat(bGroup.prize_pool || 0) + parseFloat(amount);
    const nextNetPrizePool = parseFloat(bGroup.net_prize_pool || 0) + parseFloat(netValue);

    const { error: updateGroupErr } = await supabase
      .from("bolao_groups")
      .update({
        prize_pool: nextPrizePool,
        net_prize_pool: nextNetPrizePool
      })
      .eq("id", group_id);

    if (updateGroupErr) throw new Error(`Erro ao atualizar premiações: ${updateGroupErr.message}`);

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

    console.log(`[PagBank Webhook] SUCESSO LEGADO! Prêmio: R$ ${nextNetPrizePool}, Comissão: R$ ${commission}`);

    return new Response(JSON.stringify({
      success: true,
      message: "payment_settled_successfully",
      prizePool: nextPrizePool,
      netPrizePool: nextNetPrizePool,
      tenantCommissionAwarded: commission
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (err: any) {
    console.error("[PagBank Webhook] Erro fatal:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
