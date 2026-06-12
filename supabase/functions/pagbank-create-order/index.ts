// Deno Edge Function: pagbank-create-order
// Criação de Cobrança Pix via API REST PagBank
// Documentação: https://dev.pagseguro.com.br

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreatePixOrderParams {
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

    const {
      amount,
      userId,
      userEmail,
      userName,
      groupId,
      groupName,
      userCpf,
      userPhone,
      description
    }: CreatePixOrderParams = await req.json();

    if (!amount || !userId || !groupId) {
      throw new Error("Parâmetros obrigatórios: amount, userId, groupId");
    }

    // Sanitiza CPF/telefone (só dígitos). Fallback para fictícios se não vierem
    const cpfDigits = (userCpf ?? "").replace(/\D/g, "");
    const phoneDigits = (userPhone ?? "").replace(/\D/g, "");
    const taxId = cpfDigits.length === 11 ? cpfDigits : "12345678909";
    const areaCode = phoneDigits.length >= 10 ? phoneDigits.slice(0, 2) : "11";
    const phoneNumber = phoneDigits.length >= 10 ? phoneDigits.slice(2) : "999999999";

    const pagbankSandbox = Deno.env.get("PAGBANK_SANDBOX") === "true";
    const pagbankToken = Deno.env.get("PAGBANK_TOKEN");

    const pagbankBaseUrl = pagbankSandbox
      ? "https://sandbox.api.pagseguro.com"
      : "https://api.pagseguro.com";

    const referenceId = `BPRO-${groupId.substring(0, 8)}-${userId.substring(0, 8)}-${Date.now()}`;
    const amountCents = Math.round(amount * 100);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Payload conforme documentação: SEM charges, apenas qr_codes
    const pagbankPayload = {
      reference_id: referenceId,
      customer: {
        name: userName || "Apostador BolãoPro",
        email: userEmail || "usuario@bolaopro.com.br",
        tax_id: taxId,
        phones: [
          {
            country: "55",
            area: areaCode,
            number: phoneNumber,
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
          expiration_date: expiresAt
        }
      ],
      notification_urls: [
        `${supabaseUrl}/functions/v1/pagbank-webhook`
      ]
    };

    console.log(`[PagBank] Criando order Pix para user=${userId}, amount=R$ ${amount}, group=${groupId}`);

    let responseData;

    if (pagbankToken && Deno.env.get("PAGBANK_PROD_ENABLED") === "true") {
      // Chamada real para API do PagBank
      let retries = 3;
      let delay = 1000;
      let response;

      while (retries > 0) {
        response = await fetch(`${pagbankBaseUrl}/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${pagbankToken}`,
            "accept": "application/json"
          },
          body: JSON.stringify(pagbankPayload)
        });

        if (response.status === 429) {
          console.warn(`[PagBank] Too Many Requests (429). Retentando em ${delay}ms... Restam ${retries - 1} tentativas.`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          retries--;
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`PagBank API error: ${response.status} - ${errorText}`);
        }
        
        break; // Sai do loop se sucesso
      }

      if (!response || !response.ok) {
        throw new Error(`PagBank API error: Falha de comunicação após múltiplas tentativas (429)`);
      }

      responseData = await response.json();
      console.log(`[PagBank] Resposta da API:`, JSON.stringify(responseData));
    } else {
      // Simulação para ambiente de teste (MOCK)
      console.log(`[PagBank] Modo simulação - usando dados mock`);
      
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
            expiration_date: expiresAt,
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

    // Extrair dados da resposta
    const orderId = responseData.id;
    const qrCode = responseData.qr_codes?.[0];
    
    if (!qrCode) {
      throw new Error("Resposta do PagBank não contém QR Code");
    }

    const qrCodeText = qrCode.text;
    const qrCodeImage = qrCode.links?.find((l: any) => l.rel === "QRCODE.PNG")?.href || "";
    const resolvedExpiresAt = qrCode.expiration_date || expiresAt;
    const statusResponse = responseData.status || "WAITING";

    // Salvar transação no banco
    const { data: dbTx, error: dbError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        group_id: groupId,
        amount: amount,
        status: "pending",
        funding_mode: "wallet_topup",
        pagbank_id: orderId,
        qrcode_text: qrCodeText,
        qrcode_image: qrCodeImage,
        expires_at: resolvedExpiresAt,
      })
      .select("id")
      .single();

    if (dbError || !dbTx) {
      console.error("[PagBank] Erro ao salvar transação:", dbError);
      throw new Error(`Database error: ${dbError?.message}`);
    }

    console.log(`[PagBank] Transação criada: ${orderId}, Status: ${statusResponse}`);

    // Retornar no formato esperado pelo frontend
    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        transaction_id: dbTx.id,
        reference_id: referenceId,
        status: statusResponse,
        qr_code: {
          qr_code_text: qrCodeText,
          qr_code_image: qrCodeImage
        },
        expires_at: resolvedExpiresAt,
        amount: {
          value: amountCents,
          currency: "BRL"
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("[PagBank] Erro em pagbank-create-order:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
