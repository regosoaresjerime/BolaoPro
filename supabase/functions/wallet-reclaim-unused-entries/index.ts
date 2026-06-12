import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseSerializedPoolName(serializedName: string | null, entryAmount: number) {
  let feeType: "percent" | "fixed" = "percent";
  let feeValue = 20;

  if (serializedName && serializedName.includes(" ::: ")) {
    const [, meta] = serializedName.split(" ::: ");
    const parts = meta.split(" | ");
    feeType = (parts[1] as "percent" | "fixed") || feeType;
    feeValue = parseFloat(parts[2]) || feeValue;
  }

  let commission = 0;
  if (feeType === "percent") {
    commission = entryAmount * (feeValue / 100);
  } else {
    commission = feeValue;
  }

  if (commission > entryAmount) commission = entryAmount;
  return { commission, netValue: entryAmount - commission };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId } = await req.json();
    if (!userId) {
      throw new Error("Parâmetro obrigatório: userId");
    }

    const { data: wallet, error: walletError } = await supabase
      .from("bettor_wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError) throw walletError;

    let nextWalletBalance = parseFloat(String(wallet?.balance ?? 0)) || 0;

    const { data: pendingEntries, error: pendingEntriesError } = await supabase
      .from("pool_entries")
      .select("id, group_id, amount")
      .eq("user_id", userId)
      .eq("status", "available")
      .is("bet_id", null);

    if (pendingEntriesError) throw pendingEntriesError;

    if (!pendingEntries?.length) {
      return new Response(JSON.stringify({
        success: true,
        reclaimed_amount: 0,
        wallet_balance: nextWalletBalance
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let reclaimedAmount = 0;

    for (const entry of pendingEntries) {
      const amount = parseFloat(String(entry.amount ?? 0)) || 0;
      if (amount <= 0) continue;

      const { data: group, error: groupError } = await supabase
        .from("bolao_groups")
        .select("id, name, tenant_id, prize_pool, net_prize_pool")
        .eq("id", entry.group_id)
        .maybeSingle();

      if (groupError) throw groupError;

      const { commission, netValue } = parseSerializedPoolName(group?.name ?? null, amount);

      nextWalletBalance += amount;
      reclaimedAmount += amount;

      const { error: ledgerError } = await supabase
        .from("bettor_wallet_ledger")
        .insert({
          user_id: userId,
          group_id: entry.group_id,
          pool_entry_id: entry.id,
          direction: "credit",
          reason: "pool_entry_release",
          amount
        });

      if (ledgerError) throw ledgerError;

      if (group?.id) {
        const nextPrizePool = Math.max(0, (parseFloat(String(group.prize_pool ?? 0)) || 0) - amount);
        const nextNetPrizePool = Math.max(0, (parseFloat(String(group.net_prize_pool ?? 0)) || 0) - netValue);

        const { error: updateGroupError } = await supabase
          .from("bolao_groups")
          .update({
            prize_pool: nextPrizePool,
            net_prize_pool: nextNetPrizePool
          })
          .eq("id", group.id);

        if (updateGroupError) throw updateGroupError;

        if (group.tenant_id && commission > 0) {
          const { data: tenantProfile } = await supabase
            .from("profiles")
            .select("balance")
            .eq("id", group.tenant_id)
            .maybeSingle();

          const tenantNextBalance = Math.max(0, (parseFloat(String(tenantProfile?.balance ?? 0)) || 0) - commission);
          await supabase
            .from("profiles")
            .update({ balance: tenantNextBalance })
            .eq("id", group.tenant_id);
        }
      }

      const { error: deleteEntryError } = await supabase
        .from("pool_entries")
        .delete()
        .eq("id", entry.id)
        .eq("user_id", userId)
        .is("bet_id", null)
        .eq("status", "available");

      if (deleteEntryError) throw deleteEntryError;
    }

    const { error: walletUpsertError } = await supabase
      .from("bettor_wallets")
      .upsert({
        user_id: userId,
        balance: nextWalletBalance,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (walletUpsertError) throw walletUpsertError;

    return new Response(JSON.stringify({
      success: true,
      reclaimed_amount: reclaimedAmount,
      wallet_balance: nextWalletBalance
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("[wallet-reclaim-unused-entries] Error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || "Erro ao devolver saldo pendente para a carteira"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
