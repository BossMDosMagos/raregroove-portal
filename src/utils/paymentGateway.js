import { supabase } from '../lib/supabase';
import { loadStripe } from '@stripe/stripe-js';

/**
 * SERVIÇO DE INTEGRAÇÃO COM GATEWAYS DE PAGAMENTO
 * 🔐 COFRE INVISÍVEL: Chaves de API são carregadas EXCLUSIVAMENTE de variáveis de ambiente
 * 
 * Chaves Públicas (seguras no frontend):
 *   - VITE_STRIPE_PUBLISHABLE_KEY
 *   - VITE_MP_PUBLIC_KEY
 *   - VITE_PAYPAL_CLIENT_ID
 * 
 * Chaves Secretas (NUNCA no frontend):
 *   - STRIPE_SECRET_KEY (apenas Edge Functions via Supabase Secrets)
 *   - MP_ACCESS_TOKEN (apenas Edge Functions)
 *   - PAYPAL_CLIENT_SECRET (apenas Edge Functions)
 */

/**
 * Buscar configurações do gateway selecionado
 * Chaves públicas vêm de variáveis de ambiente (.env.local)
 * @param {string} selectedGateway - 'stripe', 'mercado_pago', ou 'paypal'
 */
export const getGatewayConfig = async (selectedGateway) => {
  const { data: settingsById } = await supabase
    .from('platform_settings')
    .select('id, gateway_mode, gateway_provider, sale_fee_pct, processing_fee_fixed, swap_guarantee_fee_fixed, insurance_percentage')
    .eq('id', 1)
    .maybeSingle();

  let data = settingsById;

  if (!data) {
    const { data: firstSettings } = await supabase
      .from('platform_settings')
      .select('id, gateway_mode, gateway_provider, sale_fee_pct, processing_fee_fixed, swap_guarantee_fee_fixed, insurance_percentage')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    data = firstSettings;
  }

  const safeData = data || {
    gateway_mode: 'production',
    gateway_provider: 'stripe',
    sale_fee_pct: 10,
    processing_fee_fixed: 2.0,
    swap_guarantee_fee_fixed: 5.0,
    insurance_percentage: 5,
  };

  const mode = safeData.gateway_mode || 'production';
  const provider = selectedGateway || safeData.gateway_provider || 'stripe';

  let config = {
    provider,
    mode,
    saleFeePercentage: safeData.sale_fee_pct,
    processingFeeFixed: safeData.processing_fee_fixed,
    swapGuaranteeFee: safeData.swap_guarantee_fee_fixed,
    insurancePercentage: safeData.insurance_percentage
  };

  if (provider === 'stripe') {
    config.publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  } else if (provider === 'mercado_pago') {
    config.publicKey = import.meta.env.VITE_MP_PUBLIC_KEY;
  } else if (provider === 'paypal') {
    config.clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
  }

  return config;
};

/**
 * ============================================================================
 * STRIPE - INTEGRAÇÃO REAL
 * ============================================================================
 */

let stripeInstance = null;

export const initStripe = async (publishableKey) => {
  if (!stripeInstance) {
    stripeInstance = await loadStripe(publishableKey);
  }
  return stripeInstance;
};

/**
 * Criar Payment Intent no Stripe
 * 🔐 A chave secreta é obtida pela Edge Function via Supabase Secrets
 */
export const createStripePaymentIntent = async (amount, metadata, config, currency = 'BRL') => {
  const { data, error } = await supabase.functions.invoke('stripe-create-payment-intent', {
    body: {
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata
    }
  });

  if (error) throw error;
  return data;
};

/**
 * Confirmar pagamento Stripe
 */
export const confirmStripePayment = async (clientSecret, cardElement, stripe) => {
  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement,
    },
  });

  if (error) throw error;

  return {
    success: true,
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status
  };
};

/**
 * ============================================================================
 * MERCADO PAGO - INTEGRAÇÃO REAL
 * ============================================================================
 */

let mercadoPagoInstance = null;

export const initMercadoPago = async (publicKey) => {
  if (!mercadoPagoInstance && window.MercadoPago) {
    mercadoPagoInstance = new window.MercadoPago(publicKey);
  }
  return mercadoPagoInstance;
};

/**
 * Criar preferência de pagamento no Mercado Pago
 */
export const createMercadoPagoPreference = async (paymentData, config, currency = 'BRL') => {
  try {
    // Chamar Supabase Edge Function para criar preferência
    // Garantir que a URL de retorno seja sempre a de produção se estivermos em localhost
    const origin = window.location.origin.includes('localhost') ? 'https://portalraregroove.com' : window.location.origin;

    const { data, error } = await supabase.functions.invoke('mp-create-preference', {
      body: {
        items: [
          {
            title: paymentData.itemTitle,
            quantity: 1,
            unit_price: paymentData.totalAmount,
            currency_id: currency // Mercado Pago pode ter problemas com USD, recomendado apenas BRL
          }
        ],
        payer: {
          email: paymentData.buyerEmail,
          name: paymentData.buyerName
        },
        back_urls: {
          success: `${origin}/payment/success`,
          failure: `${origin}/payment/failure`,
          pending: `${origin}/payment/pending`
        },
        auto_return: 'approved',
        metadata: paymentData.metadata
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao criar preferência MP:', error);
    throw error;
  }
};

/**
 * Processar pagamento via Mercado Pago Checkout Pro
 */
export const processMercadoPagoPayment = async (preferenceId, mp) => {
  try {
    // Redireciona para checkout do Mercado Pago
    await mp.checkout({
      preference: {
        id: preferenceId
      },
      autoOpen: true
    });

    return {
      success: true,
      redirected: true
    };
  } catch (error) {
    console.error('Erro ao processar pagamento MP:', error);
    throw error;
  }
};

/**
 * ============================================================================
 * PAYPAL - INTEGRAÇÃO REAL
 * ============================================================================
 */

/**
 * Criar ordem PayPal
 */
export const createPayPalOrder = async (amount, metadata, config, currency = 'BRL') => {
  try {
    const { data, error } = await supabase.functions.invoke('paypal-create-order', {
      body: {
        amount: amount.toFixed(2),
        currency: currency,
        metadata,
        clientId: config.clientId
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao criar ordem PayPal:', error);
    throw error;
  }
};

/**
 * Capturar pagamento PayPal após aprovação
 */
export const capturePayPalOrder = async (orderId, config) => {
  try {
    const { data, error } = await supabase.functions.invoke('paypal-capture-order', {
      body: {
        orderId,
        clientId: config.clientId
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao capturar ordem PayPal:', error);
    throw error;
  }
};

/**
 * ============================================================================
 * ORQUESTRADOR DE PAGAMENTOS
 * ============================================================================
 */

/**
 * Processar pagamento com o gateway configurado
 */
export const processPayment = async (paymentData) => {
  try {
    const config = await getGatewayConfig();

    if (!config.publishableKey && !config.publicKey && !config.clientId) {
      throw new Error('Gateway de pagamento não configurado. Configure as chaves de API no Admin.');
    }

    let result;

    switch (config.provider) {
      case 'stripe':
        result = await processStripePayment(paymentData, config);
        break;

      case 'mercado_pago':
        result = await processMercadoPagoPaymentFlow(paymentData, config);
        break;

      case 'paypal':
        result = await processPayPalPaymentFlow(paymentData, config);
        break;

      default:
        throw new Error(`Gateway ${config.provider} não suportado`);
    }

    return result;
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    throw error;
  }
};

/**
 * Fluxo completo Stripe
 */
const processStripePayment = async (paymentData, config) => {
  // Stripe será processado via componente de UI (CardElement)
  // Esta função retorna apenas a config para o componente
  return {
    provider: 'stripe',
    config,
    requiresUI: true
  };
};

/**
 * Fluxo completo Mercado Pago
 */
const processMercadoPagoPaymentFlow = async (paymentData, config) => {
  const mp = await initMercadoPago(config.publicKey);
  
  const preference = await createMercadoPagoPreference(paymentData, config);
  
  return {
    provider: 'mercado_pago',
    preferenceId: preference.id,
    initPoint: preference.init_point,
    mp,
    requiresRedirect: true
  };
};

/**
 * Fluxo completo PayPal
 */
const processPayPalPaymentFlow = async (paymentData, config) => {
  return {
    provider: 'paypal',
    config,
    requiresUI: true // PayPal Buttons component
  };
};

/**
 * ============================================================================
 * VALIDAÇÃO DE PAGAMENTO (CHAMADO APÓS WEBHOOK)
 * ============================================================================
 */

/**
 * Verificar se pagamento foi aprovado
 */
export const verifyPaymentStatus = async (paymentId, provider) => {
  try {
    const { data, error } = await supabase.functions.invoke('verify-payment-status', {
      body: {
        paymentId,
        provider
      }
    });

    if (error) throw error;

    return {
      approved: data.status === 'approved' || data.status === 'succeeded',
      status: data.status,
      details: data
    };
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    throw error;
  }
};

export default {
  getGatewayConfig,
  processPayment,
  initStripe,
  initMercadoPago,
  createStripePaymentIntent,
  confirmStripePayment,
  createMercadoPagoPreference,
  processMercadoPagoPayment,
  createPayPalOrder,
  capturePayPalOrder,
  verifyPaymentStatus
};
