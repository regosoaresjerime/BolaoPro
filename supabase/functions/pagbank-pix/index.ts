// Deno Edge Function: pagbank-pix
// Gerador de Cobrança Pix via API Rest do PagBank
// Hospedada em Supabase Edge Functions (Deno Runtime)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Headers CORS padrão para permitir chamadas do Frontend
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CheckoutPayload {
  groupId: string;
  userId: string;
  amount: number;
  fullName: string;
  email: string;
}

serve(async (req) => {
  // Tratar requisição preflight OPTIONS do browser (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Inicializar Supabase Client de modo seguro com chaves de ambiente
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Extrair dados da requisição
    const { groupId, userId, amount, fullName, email }: CheckoutPayload = await req.json();

    if (!groupId || !userId || !amount) {
      throw new Error("Parâmetros 'groupId', 'userId' e 'amount' são obrigatórios.");
    }

    // 3. Montar as credenciais da API do PagBank
    const pagbankSandbox = Deno.env.get("PAGBANK_SANDBOX") === "true";
    const pagbankToken = Deno.env.get("PAGBANK_TOKEN") ?? "MOCK_PAGBANK_TOKEN_2026";
    const supabaseUrlForWebhook = Deno.env.get("SUPABASE_URL") ?? "";
    const pagbankUrl = pagbankSandbox
      ? "https://sandbox.api.pagseguro.com/orders"
      : "https://api.pagseguro.com/orders";

    // 4. Estruturar o objeto JSON esperado pela API do PagBank para pagamento via Pix
    // O CPF/CNPJ de teste será definido de forma segura demonstrando conformidade regulatória
    const pagbankPayload = {
      reference_id: `BPRO-${groupId.substring(0, 8)}-${userId.substring(0, 8)}`,
      customer: {
        name: fullName || "Apostador BolãoPro",
        email: email || "usuario@bolaopro.com.br",
        tax_id: "12345678909", // CPF fictício de teste homologado para sandbox
        phones: [
          {
            country: "55",
            area: "11",
            number: "999999999",
            type: "MOBILE"
          }
        ]
      },
      qr_codes: [
        {
          amount: {
            value: Math.round(amount * 100) // Representado em centavos (ex: R$ 50,00 -> 5000 centavos)
          },
          expiration_date: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Expiração de 5 minutos
        }
      ],
      notification_urls: [
        `${supabaseUrlForWebhook}/functions/v1/pagbank-webhook`
      ]
    };

    console.log(`Iniciando checkout PagBank para o usuário ${userId} no valor de R$ ${amount}`);

    // Como as chaves podem ser fictícias em preview, preparamos um fallback de simulação robusto
    let responseData;
    
    if (Deno.env.get("PAGBANK_PROD_ENABLED") === "true") {
      const response = await fetch(pagbankUrl, {
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
        throw new Error(`Erro na API do PagBank: ${response.status} - ${errorText}`);
      }

      responseData = await response.json();
    } else {
      // Simulação Determinística de Sandbox Integrada
      // Facilita os testes de homologação pelo designer e garantias de preview sem travar
      const referenceId = pagbankPayload.reference_id;
      const copiaEColaRandom = `00020101021226830014br.gov.bcb.pix2561api.pagseguro.com/pix/v2/cobv/BPRO2026_${Math.floor(Math.random()*900000+100000)}5204000053039865405${amount.toFixed(2)}5802BR5912BOLAOPRO20266009SAOPAULO62070503***6304ECE3`;
      
      responseData = {
        id: `OR-${Math.floor(Math.random()*9000000+1000000)}`,
        reference_id: referenceId,
        customer: pagbankPayload.customer,
        qr_codes: [
          {
            id: `QR-${Math.floor(Math.random()*90000+10000)}`,
            amount: { value: Math.round(amount * 100) },
            text: copiaEColaRandom,
            links: [
              {
                rel: "QRCODE.PNG",
                href: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(copiaEColaRandom)}`,
                media: "image/png",
                type: "GET"
              }
            ]
          }
        ]
      };
    }

    const orderId = responseData.id;
    const qrCode = responseData.qr_codes[0];
    const qrCodeText = qrCode.text;
    const qrCodeImage = qrCode.links.find((l: any) => l.rel === "QRCODE.PNG")?.href || "";

    // 5. Inserir a transação em nosso Supabase com os dados gerados
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
      console.error("Erro ao gravar transação no banco de dados:", dbError);
      throw new Error(`Falha no banco de dados local: ${dbError.message}`);
    }

    // 6. Retornar resposta de sucesso estruturada
    return new Response(
      JSON.stringify({
        success: true,
        transactionId: orderId,
        qrCodeText,
        qrCodeImage,
        expiresIn: 300, // 5 minutos
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Erro interno no processamento do checkout pix:", error);
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
