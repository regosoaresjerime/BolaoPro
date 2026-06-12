import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseSerializedPoolName(serializedName: string | null) {
  let entryFee = 50;
  let feeType: "percent" | "fixed" = "percent";
  let feeValue = 20;

  if (serializedName && serializedName.includes(" ::: ")) {
    const [, meta] = serializedName.split(" ::: ");
    const parts = meta.split(" | ");
    entryFee = parseFloat(parts[0]) || entryFee;
    feeType = (parts[1] as "percent" | "fixed") || feeType;
    feeValue = parseFloat(parts[2]) || feeValue;
  }

  return { entryFee, feeType, feeValue };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, groupId, betId } = await req.json();
    if (!userId || !groupId) {
      throw new Error("Parâmetros obrigatórios: userId e groupId");
    }

    if (betId) {
      const { data: assignedEntry, error: assignedEntryError } = await supabase
        .from("pool_entries")
        .select("id")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .eq("bet_id", betId)
        .maybeSingle();

      if (assignedEntryError) throw assignedEntryError;

      if (assignedEntry?.id) {
        const { data: walletSnapshot } = await supabase
          .from("bettor_wallets")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle();

        return new Response(JSON.stringify({
          success: true,
          entry_id: assignedEntry.id,
          wallet_balance: parseFloat(String(walletSnapshot?.balance ?? 0)) || 0,
          reused_existing_entry: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const { data: existingEntry, error: existingEntryError } = await supabase
      .from("pool_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .is("bet_id", null)
      .eq("status", "available")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingEntryError) throw existingEntryError;

    const { data: wallet, error: walletError } = await supabase
      .from("bettor_wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError) throw walletError;
    const currentBalance = parseFloat(String(wallet?.balance ?? 0)) || 0;

    if (existingEntry?.id && betId) {
      const { error: assignExistingEntryError } = await supabase
        .from("pool_entries")
        .update({
          bet_id: betId,
          status: "consumed",
          updated_at: new Date().toISOString()
        })
        .eq("id", existingEntry.id)
        .eq("user_id", userId)
        .is("bet_id", null);

      if (assignExistingEntryError) throw assignExistingEntryError;

      return new Response(JSON.stringify({
        success: true,
        entry_id: existingEntry.id,
        wallet_balance: currentBalance,
        reused_existing_entry: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (existingEntry?.id) {
      return new Response(JSON.stringify({
        success: true,
        entry_id: existingEntry.id,
        wallet_balance: currentBalance,
        reused_existing_entry: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: group, error: groupError } = await supabase
      .from("bolao_groups")
      .select("id, name, tenant_id, prize_pool, net_prize_pool")
      .eq("id", groupId)
      .single();

    if (groupError || !group) {
      throw new Error("Bolão não encontrado");
    }

    const { entryFee, feeType, feeValue } = parseSerializedPoolName(group.name);
    if (currentBalance < entryFee) {
      return new Response(JSON.stringify({
        success: false,
        error: "Saldo insuficiente para entrar neste bolão",
        wallet_balance: currentBalance,
        required_amount: entryFee
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let commission = 0;
    if (feeType === "percent") {
      commission = entryFee * (feeValue / 100);
    } else {
      commission = feeValue;
    }
    if (commission > entryFee) commission = entryFee;
    const netValue = entryFee - commission;
    const nextWalletBalance = currentBalance - entryFee;

    const { error: walletUpsertError } = await supabase
      .from("bettor_wallets")
      .upsert({
        user_id: userId,
        balance: nextWalletBalance,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (walletUpsertError) throw walletUpsertError;

    const { data: poolEntry, error: poolEntryError } = await supabase
      .from("pool_entries")
      .insert({
        user_id: userId,
        group_id: groupId,
        amount: entryFee,
        bet_id: betId ?? null,
        status: betId ? "consumed" : "available"
      })
      .select("id")
      .single();

    if (poolEntryError || !poolEntry) {
      throw new Error(poolEntryError?.message || "Erro ao criar entrada do bolão");
    }

    const { error: ledgerError } = await supabase
      .from("bettor_wallet_ledger")
      .insert({
        user_id: userId,
        group_id: groupId,
        pool_entry_id: poolEntry.id,
        direction: "debit",
        reason: "pool_entry_allocation",
        amount: entryFee
      });

    if (ledgerError) throw ledgerError;

    const nextPrizePool = parseFloat(String(group.prize_pool ?? 0)) + entryFee;
    const nextNetPrizePool = parseFloat(String(group.net_prize_pool ?? 0)) + netValue;

    const { error: updateGroupError } = await supabase
      .from("bolao_groups")
      .update({
        prize_pool: nextPrizePool,
        net_prize_pool: nextNetPrizePool
      })
      .eq("id", groupId);

    if (updateGroupError) throw updateGroupError;

    const { data: tenantProfile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", group.tenant_id)
      .single();

    if (tenantProfile) {
      const tenantNextBalance = parseFloat(String(tenantProfile.balance ?? 0)) + commission;
      await supabase
        .from("profiles")
        .update({ balance: tenantNextBalance })
        .eq("id", group.tenant_id);
    }

    return new Response(JSON.stringify({
      success: true,
      entry_id: poolEntry.id,
      wallet_balance: nextWalletBalance,
      commission,
      prize_pool: nextPrizePool,
      net_prize_pool: nextNetPrizePool
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("[wallet-use-balance] Error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || "Erro ao usar saldo da carteira"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
