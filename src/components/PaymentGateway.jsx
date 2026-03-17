import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Disc, CreditCard, CheckCircle, Lock, QrCode } from 'lucide-react';
import { getGatewayConfig, createStripePaymentIntent } from '../utils/paymentGateway';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { generatePixBrcode, getQRCodeURL } from '../utils/pixBrcode';

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
 * COMPONENTE DE PAGAMENTO REAL - MERCADO PAGO (Payment Brick)
 */
function MercadoPagoPaymentForm({ amount, selectedGateway, metadata, onSuccess, onError, currency = 'BRL' }) {
  const [processing, setProcessing] = useState(false);
  const [config, setConfig] = useState(null);
  const [mpLoaded, setMpLoaded] = useState(false);
  const [preferenceId, setPreferenceId] = useState(null);
  const [brickReady, setBrickReady] = useState(false);
  const [error, setError] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (currency !== 'BRL') {
      onError(new Error('Mercado Pago suporta apenas BRL'));
      return;
    }
    init();
  }, [currency]);

  const init = async () => {
    setInitializing(true);
    try {
      const cfg = await getGatewayConfig(selectedGateway);
      setConfig(cfg);

      if (!window.MercadoPago && cfg.publicKey) {
        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.async = true;
        script.onload = () => {
          window.MercadoPago = new window.MercadoPago(cfg.publicKey, {
            locale: 'pt-BR'
          });
          setMpLoaded(true);
        };
        script.onerror = () => {
          setError('Erro ao carregar SDK do Mercado Pago');
          setInitializing(false);
        };
        document.body.appendChild(script);
      } else if (window.MercadoPago) {
        setMpLoaded(true);
      }

      const transactionId = `RG${Date.now()}`;
      
      const { data, error: fnError } = await supabase.functions.invoke('mp-create-preference', {
        body: {
          items: [{
            title: metadata.itemTitle || 'Compra RareGroove',
            quantity: 1,
            unit_price: amount,
            currency_id: 'BRL'
          }],
          payer: {
            email: metadata.buyerEmail,
            name: metadata.buyerName || 'Comprador'
          },
          external_reference: transactionId,
          metadata: {
            ...metadata,
            transactionId
          }
        }
      });

      if (fnError) {
        console.error('❌ [MP] Erro ao criar preferência:', fnError);
        throw new Error(fnError.message);
      }

      if (data?.preference_id) {
        setPreferenceId(data.preference_id);
      } else if (data?.id) {
        setPreferenceId(data.id);
      } else {
        throw new Error('Não foi possível criar a preferência de pagamento');
      }
    } catch (err) {
      console.error('❌ [MP] Erro na inicialização:', err);
      setError(err.message);
      onError(err);
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    if (config?.publicKey && mpLoaded && preferenceId && !brickReady) {
      renderPaymentBrick();
    }
  }, [config, mpLoaded, preferenceId]);

  const renderPaymentBrick = () => {
    const container = document.getElementById('mp-payment-brick-container');
    if (!container || !window.MercadoPago || !preferenceId) return;

    container.innerHTML = '';

    window.MercadoPago.bricks().create('payment', 'mp-payment-brick-container', {
      initialization: {
        preferenceId: preferenceId,
        amount: amount,
        payer: {
          email: metadata.buyerEmail || 'comprador@email.com'
        }
      },
      customization: {
        visual: {
          style: {
            customVariables: {
              theme: 'dark',
              themePrimaryColor: '#D4AF37',
              backgroundColor: '#1a1a1a',
              backgroundColorCard: '#2a2a2a',
              backgroundColorInput: '#333333',
              backgroundColorApp: '#1a1a1a',
              textColor: '#ffffff',
              textColorSecondary: '#cccccc',
              textColorThird: '#999999',
              fontColorPrimary: '#ffffff',
              fontColorSecondary: '#cccccc',
              fontFamily: 'Inter, sans-serif',
              borderRadiusMedium: '12px',
              borderRadiusSmall: '8px'
            }
          }
        },
        paymentMethods: {
          creditCard: { 
            cardholders: { 
              identificationType: 'CPF' 
            },
            installments: { 
              maxInstallments: 12 
            }
          },
          debitCard: { 
            cardholders: { 
              identificationType: 'CPF' 
            } 
          },
          pix: {
            enabled: true
          },
          ticket: {
            enabled: true
          }
        }
      },
      callbacks: {
        onReady: () => {
          console.log('✅ Payment Brick pronto');
          setBrickReady(true);
        },
        onError: (err) => {
          console.error('❌ Erro no Payment Brick:', err);
          setError('Erro ao processar pagamento');
          onError(err);
        },
        onSubmit: async (formData) => {
          console.log('📤 [MP] Pagamento submetido:', formData);
        }
      }
    });
  };

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-12 text-white/60">
        <Disc className="animate-spin mr-2" size={24} />
        <span>Iniciando Mercado Pago...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center space-y-4">
        <p className="text-red-300">{error}</p>
        <button 
          onClick={() => { setError(null); init(); }}
          className="bg-[#D4AF37] text-black px-6 py-2 rounded-lg font-bold text-sm"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div id="mp-payment-brick-container" className="min-h-[350px]"></div>
      </div>

      <p className="text-xs text-white/40 text-center">
        🔒 Pagamento processado de forma segura pelo Mercado Pago
      </p>
    </div>
  );
}

/**
 * COMPONENTE DE PAGAMENTO - PIX PORTAL
 * Utiliza configuração do admin em /admin/fees
 */
function PixPortalPaymentForm({ amount, selectedGateway, metadata, onSuccess, onError, currency = 'BRL' }) {
  const [processing, setProcessing] = useState(false);
  const [pixConfig, setPixConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [brcode, setBrcode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadPixConfig();
  }, []);

  const loadPixConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('pix_enabled, pix_key, pix_beneficiary')
        .limit(1)
        .single();

      if (error) throw error;

      if (!data.pix_enabled || !data.pix_key) {
        throw new Error('PIX não está configurado pelo administrador');
      }

      setPixConfig(data);

      const txid = `RG${Date.now()}`;
      const generatedBrcode = generatePixBrcode(data.pix_key, amount, {
        merchantName: data.pix_beneficiary || 'RAREGROOVE',
        merchantCity: 'BRASIL',
        txid: txid
      });

      setBrcode(generatedBrcode);
      setQrCodeUrl(getQRCodeURL(generatedBrcode));
    } catch (error) {
      console.error('❌ [PIX Portal] Erro ao carregar config:', error);
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(brcode);
    setCopied(true);
    toast.success('Código PIX copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onSuccess({
        paymentId: `PIX-${Date.now()}`,
        provider: 'pix_portal',
        status: 'pending',
        pixBrcode: brcode,
        amount: amount
      });
    } catch (error) {
      onError(error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-white/60">
        <Disc className="animate-spin mr-2" size={20} />
        Carregando dados do PIX...
      </div>
    );
  }

  if (!pixConfig) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300">
        PIX não está disponível no momento. Entre em contato com o suporte.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-center">
          <QrCode size={48} className="text-[#D4AF37]" />
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-white font-semibold text-lg">Pague com PIX</p>
          <p className="text-white/60 text-sm">
            Escaneie o QR Code ou copie o código abaixo
          </p>
        </div>

        {qrCodeUrl && (
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl">
              <img 
                src={qrCodeUrl} 
                alt="QR Code PIX" 
                className="w-48 h-48"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-white/50 text-center uppercase tracking-widest">
            Valor
          </p>
          <p className="text-2xl text-[#D4AF37] font-bold text-center">
            R$ {amount.toFixed(2)}
          </p>
        </div>

        {pixConfig.pix_beneficiary && (
          <div className="text-center">
            <p className="text-xs text-white/50">Beneficiário</p>
            <p className="text-white font-medium">{pixConfig.pix_beneficiary}</p>
          </div>
        )}

        <div className="bg-gray-900/50 border border-white/10 rounded-lg p-3">
          <p className="text-xs text-white/50 text-center mb-2">Código PIX (copie e cole)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-white/70 font-mono break-all line-clamp-2">
              {brcode.substring(0, 50)}...
            </code>
            <button
              onClick={handleCopyPix}
              className="bg-[#D4AF37] text-black px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <p className="text-xs text-white/40 text-center">
          O pagamento será confirmado automaticamente após a transferência
        </p>
      </div>

      <button
        onClick={handleConfirmPayment}
        disabled={processing}
        className="w-full bg-[#D4AF37] text-black py-4 rounded-2xl font-black uppercase text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Disc className="animate-spin" size={18} />
            Confirmando...
          </>
        ) : (
          <>
            <CheckCircle size={18} />
            Já fiz o pagamento
          </>
        )}
      </button>

      <p className="text-xs text-white/40 text-center">
        🔒 Pagamento processado via PIX do Portal RareGroove
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

      {selectedGateway === 'pix_portal' && (
        <PixPortalPaymentForm
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
