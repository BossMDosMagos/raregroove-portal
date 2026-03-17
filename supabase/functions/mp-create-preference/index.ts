import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders })
}

  try {
    const { item, items, payer, back_urls, external_reference, auto_return, metadata } = await req.json();

    // 🔒 COFRE INVISÍVEL: Buscar token dos Secrets
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');

    const firstItem = item || (Array.isArray(items) ? items[0] : null);

    if (!firstItem?.title || !firstItem?.unit_price) {
      return new Response(
        JSON.stringify({ error: 'Item inválido. Informe title e unit_price.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
      return new Response(
        JSON.stringify({ error: 'Access token do Mercado Pago não configurado no servidor (MP_ACCESS_TOKEN).' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

// Processar unit_price com precisão decimal
const unitPrice = Number(parseFloat(firstItem.unit_price).toFixed(2));
const quantity = Number(firstItem.quantity || 1);

const normalizedEmail = typeof payer?.email === 'string' ? payer.email.trim() : '';
const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

    // 🚀 FORÇAR URLs DE PRODUÇÃO (Hardcoded para segurança)
    // Ignoramos o que vem do frontend para evitar que localhost vaze para o Mercado Pago em produção.
    const productionUrl = "https://portalraregroove.com";
    
    const safeBackUrls = {
      success: `${productionUrl}/payment/success`,
      failure: `${productionUrl}/payment/failure`,
      pending: `${productionUrl}/payment/pending`
    };

    console.log("[mp-create-preference] Forçando back_urls para produção:", safeBackUrls);

    // Auto-return sempre habilitado se for produção
    const canUseAutoReturn = true; 
    
    const mpPayload: Record<string, unknown> = {
      items: [
        {
          title: firstItem.title,
          description: firstItem.description || firstItem.title,
          quantity: quantity,
          unit_price: unitPrice,
          currency_id: "BRL" // Forçar BRL inicialmente
        }
      ],
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12
      },
      back_urls: safeBackUrls,
      external_reference: external_reference || `REF-${Date.now()}`,
    };

  if (auto_return === "approved" && canUseAutoReturn) {
    mpPayload.auto_return = "approved";
  }

  if (hasValidEmail) {
    mpPayload.payer = {
      email: normalizedEmail,
      name: payer?.name || "Usuario",
      surname: payer?.surname || "Teste"
    };
  }

  // 🏷️ METADATA (Crucial para Webhook)
  // Repassa os metadados recebidos para o Mercado Pago, permitindo recuperar buyerId, itemId, etc. no webhook.
  if (metadata && typeof metadata === 'object') {
    mpPayload.metadata = metadata;
    console.log("[mp-create-preference] Metadata anexados à preferência:", JSON.stringify(metadata));
  }

  // ... (código existente) ...

// 💰 SUPORTE A MOEDA DINÂMICA
// O Mercado Pago é estrito com moedas. Se a conta for brasileira, SÓ ACEITA BRL.
// Vamos ignorar a moeda enviada pelo frontend se for diferente de BRL para evitar erro 400.
// Se o valor estiver em USD, o frontend já deve ter convertido (ou não, vamos assumir que o valor numérico é o que deve ser cobrado).
// Mas enviar currency_id: 'USD' vai quebrar a requisição se a conta for BR.

const requestedCurrency = firstItem.currency_id || "BRL";

// Lógica de segurança: Se for BRL, usa BRL. Se for outra coisa, força BRL (assumindo que o valor numérico é o valor a cobrar).
// Isso evita o erro "currency_id invalid" do Mercado Pago.
const safeCurrencyId = "BRL"; 

// Atualiza o payload com a moeda segura
const itemsArray = mpPayload.items as Array<any>;
if (itemsArray && itemsArray.length > 0) {
  itemsArray[0].currency_id = safeCurrencyId;
}

if (requestedCurrency !== 'BRL') {
  console.warn(`[mp-create-preference] Atenção: Moeda solicitada era ${requestedCurrency}, mas foi forçada para ${safeCurrencyId} para evitar rejeição.`);
}

console.log("[mp-create-preference] Criando preferência no Mercado Pago");
console.log("[mp-create-preference] Access token presente:", !!accessToken);
console.log("[mp-create-preference] Moeda final:", safeCurrencyId);
console.log("[mp-create-preference] back_urls:", safeBackUrls);
console.log("[mp-create-preference] auto_return habilitado:", auto_return === "approved" && canUseAutoReturn);

// 🔑 ADICIONAR IDEMPOTENCY KEY
// Importante para evitar duplicidade de pagamentos se a rede falhar
const idempotencyKey = `IDE-${Date.now()}-${Math.random().toString(36).substring(7)}`;

// 🔔 NOTIFICATION URL (WEBHOOK)
// Importante: Esta URL DEVE apontar para uma Edge Function pública e acessível
// Não pode ser localhost nem o domínio do site frontend, tem que ser o backend do Supabase
const notificationUrl = "https://hlfirfukbrisfpebaaur.supabase.co/functions/v1/process-transaction";
mpPayload.notification_url = notificationUrl;

console.log("[mp-create-preference] notification_url configurada:", notificationUrl);

const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${accessToken.trim()}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": idempotencyKey
  },
  body: JSON.stringify(mpPayload),
});

const data = await response.json();

if (!response.ok) {
  console.error("[mp-create-preference] ❌ ERRO FATAL Mercado Pago:", {
    status: response.status,
    statusText: response.statusText,
    errorBody: JSON.stringify(data, null, 2),
    payloadSent: JSON.stringify(mpPayload, null, 2) // Log do payload para debug
  });
  
  // Retornar erro detalhado para o frontend entender o que houve
  return new Response(JSON.stringify({ 
    error: "Erro na API do Mercado Pago", 
    details: data,
    status: response.status 
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
}

return new Response(
  JSON.stringify({
    id: data.id,
    preference_id: data.id,
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point,
    point_of_interaction: data.point_of_interaction,
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
);
} catch (err) {
console.error("[mp-create-preference] Erro de execução:", err.message);
return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
}
})
