import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Disc, CreditCard, CheckCircle, Lock, QrCode } from 'lucide-react';
import { getGatewayConfig, createStripePaymentIntent } from '../utils/paymentGateway';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { generatePixBrcode } from '../utils/pixBrcode';
import { QRCodeSVG } from 'qrcode.react';

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
 * COMPONENTE DE PAGAMENTO REAL - PAYPAL
 */
function PayPalPaymentForm({ amount, selectedGateway, metadata, onSuccess, onError, currency = 'BRL' }) {
  const [processing, setProcessing] = useState(false);
  const [config, setConfig] = useState(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [orderCreated, setOrderCreated] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (selectedGateway === 'paypal') {
      init();
    }
  }, [selectedGateway]);

  useEffect(() => {
    if (paypalLoaded && containerRef.current && window.paypal && window.paypal.Buttons) {
      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'pay'
        },
        createOrder: (data, actions) => {
          return actions.order.create({
            intent: 'CAPTURE',
            purchase_units: [{
              amount: {
                currency_code: currency,
                value: amount.toFixed(2)
              },
              description: metadata?.itemTitle || 'Compra RareGroove',
            }],
            application_context: {
              brand_name: 'RareGroove',
              shipping_preference: 'NO_SHIPPING'
            }
          });
        },
        onApprove: async (data, actions) => {
          setProcessing(true);
          try {
            const details = await actions.order.capture();
            console.log('[PayPal] Pagamento aprovado:', details);
            onSuccess?.({
              paymentId: details.id,
              status: 'COMPLETED',
              gateway: 'paypal',
              details
            });
          } catch (err) {
            console.error('[PayPal] Erro ao capturar:', err);
            setError(err.message);
            onError?.(err);
          } finally {
            setProcessing(false);
          }
        },
        onError: (err) => {
          console.error('[PayPal] Erro:', err);
          setError('Erro no pagamento PayPal');
          onError?.(err);
        }
      });

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        buttons.render(containerRef.current);
      }
    }
  }, [paypalLoaded]);

  const init = async () => {
    try {
      const cfg = await getGatewayConfig(selectedGateway);
      setConfig(cfg);

      if (!cfg.clientId) {
        setError('PayPal não está configurado. Adicione o Client ID nas configurações.');
        return;
      }

      if (!window.paypal) {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${cfg.clientId}&currency=${currency}`;
        script.async = true;
        script.onload = () => {
          console.log('[PayPal] SDK carregado');
          setPaypalLoaded(true);
        };
        script.onerror = () => {
          setError('Erro ao carregar SDK do PayPal');
        };
        document.body.appendChild(script);
      } else {
        setPaypalLoaded(true);
      }
    } catch (err) {
      console.error('[PayPal] Erro ao inicializar:', err);
      setError(err.message);
    }
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!paypalLoaded ? (
        <div className="flex items-center justify-center py-8">
          <Disc className="animate-spin mr-2" size={20} />
          <span className="text-white/60">Carregando PayPal...</span>
        </div>
      ) : (
        <div ref={containerRef} className="min-h-[150px]" />
      )}
      <p className="text-xs text-white/40 text-center">
        🔒 Pagamento processado de forma segura pelo PayPal
      </p>
    </div>
  );
}

/**
 * COMPONENTE DE PAGAMENTO REAL - MERCADO PAGO (Payment Brick)
 * Com tratamento de erros robusto e mecanismo de recovery
 */
function MercadoPagoPaymentForm({ amount, selectedGateway, metadata, onSuccess, onError, currency = 'BRL' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const openCheckoutPro = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const transactionId = `RG${Date.now()}`;
      
      const { data, error: fnError } = await supabase.functions.invoke('mp-create-preference', {
        body: {
          items: [{ title: metadata.itemTitle || 'Compra RareGroove', quantity: 1, unit_price: amount, currency_id: 'BRL' }],
          payer: { email: metadata.buyerEmail, name: metadata.buyerName || 'Comprador' },
          external_reference: transactionId,
          auto_return: 'approved',
          metadata: { ...metadata, transactionId }
        }
      });

      if (fnError) throw new Error(fnError.message);
      
      const initPoint = data?.init_point || data?.sandbox_init_point;
      if (!initPoint) throw new Error('Não foi possível criar preferência de pagamento');
      
      console.log('[MP] Redirecionando para:', initPoint);
      
      window.location.href = initPoint;
      
      setLoading(false);
    } catch (err) {
      console.error('[MP] Erro:', err);
      setError(err.message);
      setLoading(false);
      onError?.(err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
        <Disc className="animate-spin mx-auto mb-4 text-[#D4AF37]" size={32} />
        <p className="text-white/60">Abrindo Mercado Pago...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center space-y-4">
        <p className="text-white/80 text-sm">
          Você será redirecionado para o Mercado Pago para concluir o pagamento.
        </p>
        
        <button
          onClick={openCheckoutPro}
          className="w-full bg-[#00BFFF] hover:bg-[#00AADD] text-black py-4 px-6 rounded-xl font-bold text-lg transition flex items-center justify-center gap-3"
        >
          <CreditCard size={24} />
          Pagar com Mercado Pago
        </button>
        
        <p className="text-white/40 text-xs">
          Pix • Cartão • Saldo • Conta Mercado Pago
        </p>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={openCheckoutPro} className="text-[#00BFFF] text-sm underline mt-2">
            Tentar novamente
          </button>
        </div>
      )}
      
      <p className="text-xs text-white/40 text-center">
        🔒 Pagamento processado de forma segura pelo Mercado Pago
      </p>
    </div>
);
}

/**
 * COMPONENTE DE PAGAMENTO - PIX PORTAL

      if (!cfg.publicKey) {
        const errorMsg = 'Chave pública do Mercado Pago não configurada. Adicione VITE_MP_PUBLIC_KEY no ambiente.';
        console.error('[MP]', errorMsg);
        setError(errorMsg);
        setInitializing(false);
        return;
      }

      if (!window.MercadoPago) {
        console.log('[MP] Carregando SDK...');
        setDebugInfo('Carregando SDK do Mercado Pago...');
        
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://sdk.mercadopago.com/js/v2';
          script.async = true;
          script.onload = () => {
            console.log('[MP] Script carregado');
            window.MercadoPago = new window.MercadoPago(cfg.publicKey, {
              locale: 'pt-BR'
            });
            setMpLoaded(true);
            resolve();
          };
          script.onerror = (err) => {
            console.error('[MP] Erro ao carregar script:', err);
            reject(new Error('Erro ao carregar SDK'));
          };
          document.body.appendChild(script);
        });
      } else {
        console.log('[MP] SDK já está disponível');
        setMpLoaded(true);
      }

      console.log('[MP] Criando preferência...');
      setDebugInfo('Criando preferência de pagamento...');
      
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
        console.error('[MP] Erro ao criar preferência:', fnError);
        throw new Error(fnError.message || 'Erro ao criar preferência');
      }

      console.log('[MP] Preferência criada:', data);
      setDebugInfo(`Preferência: ${data?.id || 'erro'}`);

      if (data?.preference_id) {
        setPreferenceId(data.preference_id);
      } else if (data?.id) {
        setPreferenceId(data.id);
      } else {
        throw new Error('Não foi possível criar a preferência de pagamento');
      }
    } catch (err) {
      console.error('[MP] Erro na inicialização:', err);
      setError(err.message);
      setDebugInfo(`Erro: ${err.message}`);
      onError?.(err);
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    console.log('[MP] Estado:', { mpLoaded, preferenceId, brickReady, config: !!config });
    
    if (config && mpLoaded && preferenceId && !brickReady) {
      console.log('[MP] Tentando renderizar brick...');
      requestAnimationFrame(() => {
        setTimeout(() => renderPaymentBrick(), 100);
      });
    }
  }, [config, mpLoaded, preferenceId, brickReady]);

  const resetAndRetry = () => {
    setError(null);
    setBrickReady(false);
    setMpLoaded(false);
    setPreferenceId(null);
    window.MercadoPago = null;
    
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
    
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      init();
    }
  };

  const renderPaymentBrick = () => {
    console.log('[MP] renderPaymentBrick chamado');
    console.log('[MP] window.MercadoPago:', !!window.MercadoPago);
    console.log('[MP] preferenceId:', preferenceId);
    console.log('[MP] amount:', amount);
    
    const tryRender = (attempts = 0) => {
      const container = document.getElementById(containerId);
      console.log(`[MP] Tentativa ${attempts + 1} - Container encontrado:`, !!container);
      
      if (!container) {
        if (attempts < 10) {
          console.log(`[MP] Container não encontrado, tentando novamente em 300ms...`);
          setTimeout(() => tryRender(attempts + 1), 300);
        } else {
          console.error('[MP] Container não encontrado após 10 tentativas!');
          setError('Container não encontrado. Recarregue a página.');
        }
        return;
      }

      if (!window.MercadoPago) {
        console.error('[MP] SDK não carregou!');
        setError('SDK do Mercado Pago não carregou.');
        return;
      }

      if (!preferenceId) {
        console.error('[MP] Preference ID não definido!');
        setError('Preferência de pagamento não criada.');
        return;
      }

      container.innerHTML = '';
      console.log('[MP] Criando brick no container:', containerId, 'mode:', paymentMode);

      const isWalletMode = paymentMode === 'wallet';
      
      if (isWalletMode) {
        console.log('[MP] Configurando Payment Brick com modo Wallet');
        
        window.MercadoPago.bricks().create('payment', containerId, {
          initialization: {
            preferenceId: preferenceId,
            paymentMethods: {
              wallet: ['account_money'],
            }
          },
          callbacks: {
            onReady: () => {
              console.log('✅ Payment Brick (Wallet) pronto!');
              setBrickReady(true);
              setRetryCount(0);
            },
            onError: (error) => {
              console.error('❌ Erro no Payment Brick:', JSON.stringify(error, null, 2));
              const errorMsg = error?.message || JSON.stringify(error);
              setError(`Erro: ${errorMsg}`);
              onError?.(error);
            },
            onSubmit: (formData) => {
              console.log('📤 [MP] Pagamento via Wallet:', formData);
              onSuccess?.({
                paymentId: formData?.paymentId || preferenceId,
                provider: 'mercadopago',
                status: 'processing'
              });
            }
          }
        });
      } else {
        console.log('[MP] Configurando Payment Brick para cartão');

        window.MercadoPago.bricks().create('payment', containerId, {
          initialization: {
            amount: parseFloat(amount),
            preferenceId: preferenceId,
            payer: {
              email: metadata?.buyerEmail || 'comprador@email.com',
            },
          },
          customization: {
            paymentMethods: {
              creditCard: ['master', 'visa', 'elo', 'amex'],
              debitCard: ['master', 'visa', 'elo'],
            },
          },
          callbacks: {
            onReady: () => {
              console.log('✅ Payment Brick (Card) pronto!');
              setBrickReady(true);
              setRetryCount(0);
            },
            onError: (error) => {
              console.error('❌ Erro no Payment Brick:', JSON.stringify(error, null, 2));
              const errorMsg = error?.message || JSON.stringify(error);
              setError(`Erro: ${errorMsg}`);
              onError?.(error);
            },
            onSubmit: (formData) => {
              console.log('📤 [MP] Pagamento via Cartão:', formData);
              if (formData?.token) {
                onSuccess?.({
                  paymentId: formData.token || preferenceId,
                  provider: 'mercadopago',
                  status: 'processing'
                });
              }
            }
          }
        });
      }
    };

    tryRender();
  };

  if (initializing) {
    return (
      <div className="space-y-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <Disc className="animate-spin mx-auto mb-4 text-[#D4AF37]" size={32} />
          <p className="text-white/60 mb-2">Iniciando Mercado Pago...</p>
          <p className="text-white/30 text-xs font-mono">{debugInfo}</p>
        </div>
      </div>
    );
  }
}

/**
 * COMPONENTE DE PAGAMENTO - PIX PORTAL
 * Utiliza configuração do admin em /admin/fees
 */
function PixPortalPaymentForm({ amount, selectedGateway, metadata, onSuccess, onError, currency = 'BRL' }) {
  const [processing, setProcessing] = useState(false);
  const [pixConfig, setPixConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [brcode, setBrcode] = useState('');
  const [copied, setCopied] = useState(false);
  const [comprovante, setComprovante] = useState(null);
  const [comprovantePreview, setComprovantePreview] = useState(null);
  const [enviado, setEnviado] = useState(false);

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

  const handleComprovanteChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setComprovante(file);
      const reader = new FileReader();
      reader.onload = (ev) => setComprovantePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      let comprovanteUrl = null;
      
      if (comprovante) {
        try {
          const fileName = `comprovantes/${Date.now()}_${comprovante.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(fileName, comprovante);
          
          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
            comprovanteUrl = publicUrl;
          }
        } catch (uploadErr) {
          console.warn('Upload comprovante falhou (ignorando):', uploadErr);
        }
      }
      
      onSuccess({
        paymentId: `PIX-${Date.now()}`,
        provider: 'pix_portal',
        status: 'waiting_approval',
        pixBrcode: brcode,
        amount: amount,
        comprovanteUrl: comprovanteUrl
      });
      
      setEnviado(true);
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

        {brcode && (
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG 
                value={brcode}
                size={180}
                level="M"
                includeMargin={false}
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
          Após pagar, envie o comprovante para análise manual
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
        <p className="text-xs text-white/60">Anexar comprovante (opcional)</p>
        <input
          type="file"
          accept="image/*"
          onChange={handleComprovanteChange}
          className="text-sm text-white/60 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#D4AF37] file:text-black file:font-bold file:cursor-pointer"
        />
        {comprovantePreview && (
          <div className="flex justify-center">
            <img src={comprovantePreview} alt="Comprovante" className="h-24 rounded-lg object-contain" />
          </div>
        )}
      </div>

      <button
        onClick={handleConfirmPayment}
        disabled={processing || enviado}
        className="w-full bg-[#D4AF37] text-black py-4 rounded-2xl font-black uppercase text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Disc className="animate-spin" size={18} />
            Enviando...
          </>
        ) : enviado ? (
          <>
            <CheckCircle size={18} />
            Comprovante enviado! Aguarde aprovação.
          </>
        ) : (
          <>
            <CheckCircle size={18} />
            Já paguei e enviei o comprovante
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
