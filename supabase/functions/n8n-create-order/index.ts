import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateN8nPixOrderParams {
  amount: number;
  userId: string;
  userEmail: string;
  userName: string;
  groupId: string;
  groupName: string;
  userCpf?: string;
  userPhone?: string;
  description?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");

    if (!n8nWebhookUrl) {
      throw new Error("N8N_WEBHOOK_URL não está configurada nos secrets.");
    }

    const payload: CreateN8nPixOrderParams = await req.json();
    const { amount, userId, groupId, userName, userEmail, userCpf, description } = payload;

    if (!amount || !userId || !groupId) {
      throw new Error("Parâmetros obrigatórios: amount, userId, groupId");
    }

    // Criar um ID de referência único
    const referenceId = `BPRO-${groupId.substring(0, 8)}-${userId.substring(0, 8)}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Passo 1: Salvar a transação como pendente no banco de dados PRIMEIRO
    const { data: dbTx, error: dbError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        group_id: groupId,
        amount: amount,
        status: "pending",
        funding_mode: "wallet_topup",
        pagbank_id: referenceId, // Será usado pelo n8n para atualizar o status depois
        qrcode_text: "",
        qrcode_image: "",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (dbError || !dbTx) {
      console.error("[N8N] Erro ao salvar transação:", dbError);
      throw new Error(`Database error: ${dbError?.message}`);
    }
    // Passo 2: Enviar requisição para o Webhook do n8n
    // Formatando os dados conforme exigência do n8n:
    const amountInCents = Math.round(amount * 100);
    const cpfDigits = (userCpf ?? "").replace(/\D/g, "");
    const finalCpf = cpfDigits.length === 11 ? cpfDigits : "12345678909";
    const finalEmail = userEmail || "usuario@bolaopro.com.br";

    const n8nPayload = {
      ...payload,
      email: finalEmail,
      cpf: finalCpf,
      amount: amountInCents, // Valor formatado em centavos sem vírgula (ex: 1500)
      transactionId: dbTx.id,
      referenceId: referenceId,
      expiresAt,
      pix_expiration_date_time: expiresAt,
    };

    console.log(`[N8N] Chamando webhook n8n para a transação ${dbTx.id}...`);

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload)
    });

    if (!n8nResponse.ok) {
      throw new Error(`Erro na API do n8n: ${n8nResponse.status}`);
    }

    // Espera-se que o n8n retorne o JSON configurado (chave-pix-copia-cola, qr-code, id-pix)
    const n8nData = await n8nResponse.json();
    const qrCodeText = n8nData["chave-pix-copia-cola"] || n8nData.qr_code_text || n8nData.qrcode || n8nData.text || n8nData.brcode;
    const qrCodeImage = n8nData["qr-code"] || n8nData.qr_code_image || n8nData.image || n8nData.qrCodeImage || "";
    const idPix = n8nData["id-pix"];

    if (!qrCodeText) {
      throw new Error("O webhook do n8n não retornou o código Pix (chave-pix-copia-cola).");
    }

    // Passo 3: Atualizar a transação no banco com o QR Code recebido e o id do PagBank retornado pelo n8n
    const updatePayload: any = {
      qrcode_text: qrCodeText,
      qrcode_image: qrCodeImage,
      expires_at: expiresAt,
    };

    if (idPix) {
      updatePayload.pagbank_id = idPix;
    }

    await supabase
      .from("transactions")
      .update(updatePayload)
      .eq("id", dbTx.id);

    console.log(`[N8N] Pix gerado com sucesso! Transação: ${dbTx.id}`);

    // Passo 4: Retornar o formato esperado pelo frontend (o mesmo do PagBankService)
    return new Response(
      JSON.stringify({
        success: true,
        order_id: dbTx.id, // Retornamos o ID do banco
        transaction_id: dbTx.id,
        reference_id: referenceId,
        status: "WAITING",
        qr_code: {
          qr_code_text: qrCodeText,
          qr_code_image: qrCodeImage,
          expiration_date: expiresAt
        },
        expires_at: expiresAt
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (err: any) {
    console.error("[N8N] Error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
