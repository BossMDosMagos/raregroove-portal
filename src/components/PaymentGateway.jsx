import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Disc, CreditCard, CheckCircle, Lock } from 'lucide-react';
import { getGatewayConfig, createStripePaymentIntent } from '../utils/paymentGateway';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

/**
 * COMPONENTE DE PAGAMENTO REAL - STRIPE
 */
function StripePaymentForm({ amount, selectedGateway, metadata, onSuccess, onError, currency = 'BRL' }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const cfg = await getGatewayConfig(selectedGateway);
    setConfig(cfg);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements || !config) {
      console.error('❌ [Stripe] Faltam dependências:', { stripe: !!stripe, elements: !!elements, config: !!config });
      return;
    }

    try {
      setProcessing(true);

      console.log('📤 [Stripe] Enviando requisição com config:', {
        secretKey: config.secretKey ? '✅ Presente' : '❌ Faltando',
        secretKeyLength: config.secretKey?.length,
        publishableKey: config.publishableKey ? '✅ Presente' : '❌ Faltando',
        amount: Math.round(amount * 100),
        currency
      });

      // 1. Criar Payment Intent
      const { clientSecret, paymentIntentId } = await createStripePaymentIntent(
        amount,
        metadata,
        config,
        currency
      );

      console.log('📥 [Stripe] Payment Intent criado:', { paymentIntentId, hasClientSecret: !!clientSecret });

      // 2. Confirmar pagamento com card
      const cardNumberElement = elements.getElement(CardNumberElement);
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
        },
        // Adicionar return_url para redirecionamento 3D Secure se necessário
        return_url: `${window.location.origin.includes('localhost') ? 'https://portalraregroove.com' : window.location.origin}/payment/success`,
      });

      if (error) {
        console.error('❌ [Stripe] Erro na confirmação do pagamento:', error);
        throw new Error(error.message);
      }

      console.log('✅ [Stripe] Pagamento confirmado:', paymentIntent);

      if (paymentIntent.status === 'succeeded') {
        onSuccess({
          paymentId: paymentIntent.id,
          provider: 'stripe',
          status: 'succeeded'
        });
      } else {
        throw new Error('Pagamento não foi aprovado');
      }
    } catch (error) {
      console.error('❌ [Stripe] Erro completo no pagamento:', error);
      onError(error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={20} className="text-[#D4AF37]" />
          <label className="text-sm text-white/80 font-semibold">
            Dados do Cartão
          </label>
          <Lock size={14} className="text-green-400 ml-auto" />
          <span className="text-xs text-green-400">Criptografado</span>
        </div>

        {/* Campo Número do Cartão */}
        <div>
          <label className="text-xs text-white/60 uppercase font-bold tracking-widest block mb-2">
            Número do Cartão
          </label>
          <div className="bg-gray-900 border border-white/10 rounded-lg p-4 focus-within:border-[#D4AF37] focus-within:shadow-lg focus-within:shadow-[#D4AF37]/20 transition-all">
            <CardNumberElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#fff',
                    fontFamily: "'Inter', sans-serif",
                    '::placeholder': {
                      color: '#6b7280',
                    },
                  },
                  invalid: {
                    color: '#ef4444',
                  },
                },
                placeholder: '1234 5678 9012 3456',
              }}
            />
          </div>
        </div>

        {/* Grid Validade e CVC */}
        <div className="grid grid-cols-2 gap-4">
          {/* Validade */}
          <div>
            <label className="text-xs text-white/60 uppercase font-bold tracking-widest block mb-2">
              Validade
            </label>
            <div className="bg-gray-900 border border-white/10 rounded-lg p-4 focus-within:border-[#D4AF37] focus-within:shadow-lg focus-within:shadow-[#D4AF37]/20 transition-all">
              <CardExpiryElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#fff',
                      fontFamily: "'Inter', sans-serif",
                      '::placeholder': {
                        color: '#6b7280',
                      },
                    },
                    invalid: {
                      color: '#ef4444',
                    },
                  },
                  placeholder: 'MM / YY',
                }}
              />
            </div>
          </div>

          {/* CVC */}
          <div>
            <label className="text-xs text-white/60 uppercase font-bold tracking-widest block mb-2">
              CVC
            </label>
            <div className="bg-gray-900 border border-white/10 rounded-lg p-4 focus-within:border-[#D4AF37] focus-within:shadow-lg focus-within:shadow-[#D4AF37]/20 transition-all">
              <CardCvcElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#fff',
                      fontFamily: "'Inter', sans-serif",
                      '::placeholder': {
                        color: '#6b7280',
                      },
                    },
                    invalid: {
                      color: '#ef4444',
                    },
                  },
                  placeholder: '123',
                }}
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-white/40 text-center pt-2">
          Seus dados são processados de forma segura pelo Stripe
        </p>
      </div>

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-[#D4AF37] text-black py-4 rounded-2xl font-black uppercase text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Disc className="animate-spin" size={18} />
            Processando...
          </>
        ) : (
          <>
            <CreditCard size={18} />
            Pagar R$ {amount.toFixed(2)}
          </>
        )}
      </button>

      <p className="text-xs text-white/40 text-center">
        🔒 Pagamento processado de forma segura pelo Stripe
      </p>
    </form>
  );
}

/**
 * COMPONENTE DE PAGAMENTO REAL - MERCADO PAGO
 */
function MercadoPagoPaymentForm({ amount, selectedGateway, metadata, onSuccess, onError, currency = 'BRL' }) {
  const [processing, setProcessing] = useState(false);
  const [config, setConfig] = useState(null);
  const [manualCheckoutUrl, setManualCheckoutUrl] = useState('');
  const [manualReturnUrl, setManualReturnUrl] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [pollingInterval, setPollingInterval] = useState(null);

  useEffect(() => {
    if (currency !== 'BRL') {
      onError(new Error('Mercado Pago suporta apenas BRL'));
      return;
    }
    loadConfig();

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [currency, pollingInterval]);

  const loadConfig = async () => {
    // ... (mesmo código de loadConfig)
    const cfg = await getGatewayConfig(selectedGateway);
    setConfig(cfg);

    if (!window.MercadoPago && cfg.publicKey) {
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => {
        window.MercadoPago = new window.MercadoPago(cfg.publicKey);
      };
      document.body.appendChild(script);
    }
  };

  const startPolling = (ref) => {
    console.log('🔄 [MP] Iniciando polling para referência:', ref);
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment-status', {
          body: {
            provider: 'mercado_pago',
            externalReference: ref
          }
        });

        if (error) {
          console.warn('⚠️ [MP] Erro no polling:', error);
          return;
        }

        if (data && (data.status === 'approved' || data.status === 'succeeded')) {
          console.log('✅ [MP] Pagamento confirmado via polling!', data);
          clearInterval(interval);
          setPollingInterval(null);
          onSuccess({
            paymentId: data.id,
            provider: 'mercado_pago',
            status: data.status
          });
        } else if (data && data.status) {
          console.log('⏳ [MP] Status do pagamento:', data.status);
        }
      } catch (e) {
        console.error('Erro polling:', e);
      }
    }, 5000); // Checar a cada 5 segundos

    setPollingInterval(interval);
  };

  const handlePayment = async () => {
    try {
      setProcessing(true);

      const newExternalRef = metadata.transactionId || `TRX-${Date.now()}`;
      setExternalReference(newExternalRef);

      console.log('📤 [MP] Iniciando pagamento com config:', {
        accessToken: config.accessToken ? '✅ Presente' : '❌ Faltando',
        accessTokenLength: config.accessToken?.length,
        mode: config.mode,
        publicKey: config.publicKey ? '✅ Presente' : '❌ Faltando'
      });

      const returnParams = new URLSearchParams({
        payment_provider: 'mercado_pago',
        item_id: String(metadata.itemId || ''),
        buyer_id: String(metadata.buyerId || ''),
        seller_id: String(metadata.sellerId || ''),
        item_price: String(metadata.itemPrice ?? ''),
        platform_fee: String(metadata.platformFee ?? ''),
        processing_fee: String(metadata.processingFee ?? ''),
        total_amount: String(metadata.totalAmount ?? amount),
        external_reference: String(newExternalRef),
      });

      const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);

      // Criar preferência (formato simplificado)
      const requestBody = {
        item: {
          title: metadata.itemTitle,
          quantity: 1,
          unit_price: amount
        },
        payer: {
          email: metadata.buyerEmail
        },
        // Back URLs agora são forçadas pelo backend para evitar localhost
        back_urls: {
          success: `${window.location.origin}/payment/success?${returnParams.toString()}`,
          failure: `${window.location.origin}/payment/failure?${returnParams.toString()}`,
          pending: `${window.location.origin}/payment/pending?${returnParams.toString()}`
        },
        auto_return: 'approved', // Sempre aprovado, backend trata se deve ou não usar
        external_reference: newExternalRef,
        // IMPORTANTE: Passar metadata explicitamente para o backend do MP
        metadata: {
            ...metadata,
            transaction_type: 'venda', // Forçar tipo para garantir
            net_amount: metadata.netAmount, // Garantir snake_case se backend esperar
            platform_fee: metadata.platformFee
        }
      };

      console.log('📤 [MP] Body enviado para Edge Function:', {
        itemTitle: requestBody.item.title,
        amount: requestBody.item.unit_price,
        buyerEmail: requestBody.payer.email,
        externalReference: requestBody.external_reference,
        hasMetadata: !!requestBody.metadata
      });

      const { data, error } = await supabase.functions.invoke('mp-create-preference', {
        body: requestBody
      });

      console.log('📥 [MP] Resposta da Edge Function:', { data, error });

      if (error) {
        // ... (código de erro existente)
        console.error('❌ [MP] Edge Function retornou erro:', error);

        let detailedMessage = error.message || 'Erro ao processar pagamento no Mercado Pago';

        // Tentar extrair mensagem detalhada do backend
        if (error.context) {
          try {
            const errorBody = await error.context.json();
            console.error('❌ [MP] Detalhe do erro (JSON):', errorBody);
            
            if (errorBody.error) {
              if (typeof errorBody.error === 'string') {
                detailedMessage = errorBody.error;
              } else if (errorBody.error.message) {
                detailedMessage = errorBody.error.message;
              } else {
                detailedMessage = JSON.stringify(errorBody.error);
              }
            }
          } catch (e) {
            console.warn('⚠️ [MP] Não foi possível ler JSON do erro:', e);
          }
        }

        // Exibir toast com erro detalhado
        toast.error(`Erro no Mercado Pago: ${detailedMessage}`);
        throw new Error(detailedMessage);
      }

      // Iniciar polling IMEDIATAMENTE após receber a URL de checkout
      startPolling(newExternalRef);

      // Redirecionar para checkout do Mercado Pago
      // IMPORTANTE: usar init_point como prioridade aumenta a confiabilidade
      // do retorno automático, inclusive em modo sandbox.
      const checkoutUrl = data.init_point || data.sandbox_init_point;

      if (checkoutUrl && isLocalDev) {
        const manualUrl = `${window.location.origin}/payment/success?${returnParams.toString()}&status=approved`;

        setManualCheckoutUrl(checkoutUrl);
        setManualReturnUrl(manualUrl);
        // setProcessing(false); // Manter processando enquanto espera o polling ou usuário voltar

        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        toast.success('Checkout aberto em nova aba. O sistema verificará o pagamento automaticamente.');
        return;
      }

      if (data.init_point) {
        console.log('🔄 [MP] Redirecionando para init_point:', data.init_point);
        window.location.href = data.init_point;
      } else if (data.sandbox_init_point) {
        console.log('🔄 [MP] Redirecionando para sandbox_init_point:', data.sandbox_init_point);
        window.location.href = data.sandbox_init_point;
      } else {
        throw new Error('Nenhuma URL de checkout retornada pelo Mercado Pago');
      }
    } catch (error) {
      console.error('❌ [MP] Erro completo no pagamento:', error);
      onError(error);
      setProcessing(false);
      if (pollingInterval) clearInterval(pollingInterval);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
        <p className="text-white/80">
          Você será redirecionado para o checkout seguro do <strong>Mercado Pago</strong>
        </p>
        <ul className="text-sm text-white/60 space-y-1">
          <li>✓ Pague com cartão, boleto ou Pix</li>
          <li>✓ Parcelamento em até 12x</li>
          <li>✓ Proteção MercadoPago</li>
        </ul>
      </div>

      <button
        onClick={handlePayment}
        disabled={processing || !config}
        className="w-full bg-[#D4AF37] text-black py-4 rounded-2xl font-black uppercase text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Disc className="animate-spin" size={18} />
            {manualCheckoutUrl ? 'Aguardando Pagamento...' : 'Redirecionando...'}
          </>
        ) : (
          <>
            Pagar com Mercado Pago
          </>
        )}
      </button>

      <p className="text-xs text-white/40 text-center">
        🔒 Pagamento processado de forma segura pelo Mercado Pago
      </p>

      {manualCheckoutUrl && manualReturnUrl && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs text-white/70 text-center">
            Ambiente local: o Mercado Pago abriu em nova aba.
            O sistema está verificando o pagamento automaticamente.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => window.open(manualCheckoutUrl, '_blank', 'noopener,noreferrer')}
              className="w-full bg-white/10 text-white py-3 rounded-xl font-bold text-sm border border-white/20"
            >
              Abrir checkout novamente
            </button>
            <button
              onClick={() => { window.location.href = manualReturnUrl; }}
              className="w-full bg-[#D4AF37] text-black py-3 rounded-xl font-black text-sm"
            >
              Simular Retorno Sucesso
            </button>
          </div>
          <div className="flex justify-center pt-2">
             <div className="animate-pulse flex items-center text-green-400 text-xs gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400"></span>
                Verificando status do pagamento...
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * COMPONENTE DE PAGAMENTO REAL - PAYPAL
 */
function PayPalPaymentForm({ amount, selectedGateway, metadata, onSuccess, onError, currency = 'BRL' }) {
  const [processing, setProcessing] = useState(false);
  const [config, setConfig] = useState(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [currency]);

  const loadConfig = async () => {
    const cfg = await getGatewayConfig(selectedGateway);
    setConfig(cfg);

    // Carregar script do PayPal
    if (!window.paypal && cfg.clientId) {
      const script = document.createElement('script');
      // Adicionar suporte a moeda
      const mode = cfg.mode === 'sandbox' ? '&buyer-country=BR' : '';
      script.src = `https://www.paypal.com/sdk/js?client-id=${cfg.clientId}&currency=${currency}${mode}`;
      script.onload = () => {
        setPaypalLoaded(true);
        renderPayPalButtons(cfg);
      };
      document.body.appendChild(script);
    } else if (window.paypal) {
      setPaypalLoaded(true);
      renderPayPalButtons(cfg);
    }
  };

  const renderPayPalButtons = (activeConfig = config) => {
    if (!window.paypal || !activeConfig) return;

    const container = document.getElementById('paypal-button-container');
    if (container) {
      container.innerHTML = '';
    }

    window.paypal.Buttons({
      createOrder: async () => {
        const { data, error } = await supabase.functions.invoke('paypal-create-order', {
          body: {
            amount: amount.toFixed(2),
            currency: currency,
            metadata: metadata,
            clientId: activeConfig.clientId,
            clientSecret: activeConfig.clientSecret,
            mode: activeConfig.mode
          }
        });

        if (error) throw error;
        return data.orderId;
      },
      onApprove: async (data) => {
        setProcessing(true);
        try {
          const { data: captureData, error } = await supabase.functions.invoke('paypal-capture-order', {
            body: {
              orderId: data.orderID,
              clientId: activeConfig.clientId,
              clientSecret: activeConfig.clientSecret,
              mode: activeConfig.mode
            }
          });

          if (error) throw error;

          if (captureData.status === 'COMPLETED') {
            onSuccess({
              paymentId: data.orderID,
              provider: 'paypal',
              status: 'completed'
            });
          } else {
            throw new Error('Pagamento não foi completado');
          }
        } catch (error) {
          onError(error);
        } finally {
          setProcessing(false);
        }
      },
      onError: (err) => {
        console.error('Erro PayPal:', err);
        onError(err);
      }
    }).render('#paypal-button-container');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
        <p className="text-white/80">
          Pague de forma segura com <strong>PayPal</strong>
        </p>
        <ul className="text-sm text-white/60 space-y-1">
          <li>✓ Proteção ao comprador PayPal</li>
          <li>✓ Pague com saldo ou cartão</li>
          <li>✓ Aceito mundialmente</li>
        </ul>
      </div>

      {processing && (
        <div className="flex items-center justify-center py-4 text-white/60">
          <Disc className="animate-spin mr-2" size={20} />
          Processando pagamento...
        </div>
      )}

      <div id="paypal-button-container" className="min-h-[150px]"></div>

      <p className="text-xs text-white/40 text-center">
        🔒 Pagamento processado de forma segura pelo PayPal
      </p>
    </div>
  );
}

/**
 * ORQUESTRADOR DE PAGAMENTO
 */
export default function PaymentGateway({ amount, selectedGateway, metadata, onSuccess, onError, currency = 'BRL' }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stripePromise, setStripePromise] = useState(null);

  useEffect(() => {
    init();
  }, [selectedGateway]);

  const init = async () => {
    try {
      const cfg = await getGatewayConfig(selectedGateway);
      console.log('🔍 [PaymentGateway] Config carregada:', {
        gateway: selectedGateway,
        currency,
        amount,
        hasPublishableKey: !!cfg.publishableKey,
        hasPublicKey: !!cfg.publicKey,
        hasClientId: !!cfg.clientId,
        mode: cfg.mode
      });
      setConfig(cfg);

      if (selectedGateway === 'stripe' && cfg.publishableKey) {
        const stripe = await loadStripe(cfg.publishableKey);
        setStripePromise(stripe);
      }
    } catch (error) {
      console.error('❌ [PaymentGateway] Erro ao carregar config:', error);
      toast.error('Erro ao carregar método de pagamento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-white/60">
        <Disc className="animate-spin mr-2" size={20} />
        Carregando método de pagamento...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300">
        Gateway de pagamento não configurado. Entre em contato com o suporte.
      </div>
    );
  }

  return (
    <div>
      {selectedGateway === 'stripe' && stripePromise && (
        <Elements stripe={stripePromise}>
          <StripePaymentForm
            amount={amount}
            selectedGateway={selectedGateway}
            metadata={metadata}
            onSuccess={onSuccess}
            onError={onError}
            currency={currency}
          />
        </Elements>
      )}

      {selectedGateway === 'stripe' && !stripePromise && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
          Stripe não está disponível no momento. Verifique a chave pública configurada para este ambiente.
        </div>
      )}

      {selectedGateway === 'mercado_pago' && (
        <MercadoPagoPaymentForm
          amount={amount}
          selectedGateway={selectedGateway}
          metadata={metadata}
          onSuccess={onSuccess}
          onError={onError}
          currency={currency}
        />
      )}

      {selectedGateway === 'paypal' && (
        <PayPalPaymentForm
          amount={amount}
          selectedGateway={selectedGateway}
          metadata={metadata}
          onSuccess={onSuccess}
          onError={onError}
          currency={currency}
        />
      )}
    </div>
  );
}
