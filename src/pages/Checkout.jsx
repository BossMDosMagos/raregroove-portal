import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CreditCard, CheckCircle, Disc, Shield, Loader2, AlertTriangle, QrCode, ShoppingBag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Pill } from '../components/UIComponents';
import PaymentGateway from '../components/PaymentGateway';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';

export default function Checkout() {
  const { t, formatCurrency, exchangeRate, locale } = useI18n();
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { clearLocalCart, cartItems, itemsDetails } = useCart();

  // 💰 SELETOR DE MOEDA
  const [currency, setCurrency] = useState(locale === 'en-US' ? 'USD' : 'BRL');

  useEffect(() => {
    setCurrency(locale === 'en-US' ? 'USD' : 'BRL');
  }, [locale]);
  
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [sellers, setSellers] = useState({});
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  
  // Pagamento
  const [paying, setPaying] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [availableGateways, setAvailableGateways] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        // Buscar usuário autenticado primeiro
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          toast.error('Faça login para continuar');
          navigate('/');
          return;
        }
        setUser(authUser);

        let itemsData = [];
        let itemsToProcess = [];

        // Se temos itemId, verificar se está no carrinho ou buscar direto
        if (itemId) {
          const cartItem = cartItems.find(ci => ci.itemId === itemId);
          
          if (cartItem) {
            // Item está no carrinho
            const { data, error } = await supabase
              .from('items')
              .select('*')
              .eq('id', itemId)
              .single();
            
            if (error || !data) {
              toast.error('Item não encontrado');
              navigate('/catalogo');
              return;
            }
            itemsData = [data];
            itemsToProcess = [cartItem];
          } else {
            // Item não está no carrinho - buscar direto e reservar
            const { data: itemData, error: itemError } = await supabase
              .from('items')
              .select('*')
              .eq('id', itemId)
              .single();
            
            if (itemError || !itemData) {
              toast.error('Item não encontrado');
              navigate('/catalogo');
              return;
            }

            // Fazer reserva
            const { error: reserveError } = await supabase.rpc('reserve_item', {
              item_uuid: itemId,
              duration_minutes: 30,
            });

            if (reserveError) {
              // Fallback: update direto
              await supabase
                .from('items')
                .update({ status: 'reservado', reserved_by: authUser.id })
                .eq('id', itemId)
                .eq('is_sold', false)
                .not('status', 'in', '("vendido","reservado")');
            }

            itemsData = [itemData];
            itemsToProcess = [{ itemId, reservedUntilMs: Date.now() + 30 * 60 * 1000 }];
          }
        } else {
          // Carrinho multi-item
          itemsToProcess = cartItems;
          
          if (itemsToProcess.length === 0) {
            toast.error('Nenhum item no carrinho');
            navigate('/catalogo');
            return;
          }

          const itemIds = itemsToProcess.map(ci => ci.itemId);
          const { data, error } = await supabase
            .from('items')
            .select('*')
            .in('id', itemIds);
          
          itemsData = data || [];
        }

        if (itemsData.length === 0) {
          toast.error('Nenhum item encontrado');
          navigate('/catalogo');
          return;
        }

        // Validar cada item
        for (const itemData of itemsData) {
          if (itemData.is_sold) {
            toast.error(`"${itemData.title}" já foi vendido`);
            navigate('/catalogo');
            return;
          }

          if (itemData.status === 'reservado') {
            const cartItem = itemsToProcess.find(ci => ci.itemId === itemData.id);
            const reservedUntilMs = cartItem?.reservedUntilMs || null;
            const hasActiveReserve = Boolean(reservedUntilMs && reservedUntilMs > Date.now());
            const isReservedByMe = itemData.reserved_by && itemData.reserved_by === authUser.id;

            if (hasActiveReserve && !isReservedByMe) {
              toast.error('ITEM RESERVADO', {
                description: `"${itemData.title}" está reservado por outro colecionador.`,
              });
              navigate('/catalogo');
              return;
            }
          }
        }

        setItems(itemsData);

        // Buscar perfis dos vendedores
        const sellerIds = [...new Set(itemsData.map(i => i.seller_id))];
        const { data: sellersData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', sellerIds);
        
        const sellersMap = {};
        (sellersData || []).forEach(s => sellersMap[s.id] = s);
        setSellers(sellersMap);

        // Buscar perfil do comprador para validações
        const { data: buyerProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (!buyerProfile?.cpf_cnpj) {
          toast.error('Complete seu perfil com CPF/CNPJ antes de comprar');
          navigate('/profile');
          return;
        }

        // Buscar configurações de frete e taxas - BUSCA GARANTIDA
        let settingsData = null;
        let settingsError = null;

        // Tentar buscar por id=1 primeiro
        const { data: settingsById, error: settingsByIdError } = await supabase
          .from('platform_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        settingsData = settingsById;
        settingsError = settingsByIdError;

        if (!settingsData) {
          // Fallback: pegar o primeiro registro
          const { data: firstSettings, error: firstSettingsError } = await supabase
            .from('platform_settings')
            .select('*')
            .order('id', { ascending: true })
            .limit(1)
            .maybeSingle();
            
          settingsData = firstSettings;
          settingsError = firstSettingsError;
        }

        if (settingsError) throw settingsError;

        // Se ainda não tiver settings, usar default
        const finalSettings = settingsData || {
          sale_fee_pct: 10,
          processing_fee_fixed: 2.0,
          swap_guarantee_fee_fixed: 5.0,
          gateway_provider: 'stripe',
          gateway_mode: 'sandbox' // Default seguro
        };
        
        setSettings(finalSettings);

        // FORÇA TODOS OS 4 MÉTODOS DE PAGAMENTO - CATÁLOGO DE CDs
        const available = [];
        
        // Stripe - Cartão de Crédito
        available.push({ 
          id: 'stripe', 
          name: 'Cartão de Crédito', 
          icon: CreditCard 
        });

        // Mercado Pago
        available.push({ 
          id: 'mercado_pago', 
          name: 'Mercado Pago', 
          icon: Disc 
        });
        
        // PayPal
        available.push({ 
          id: 'paypal', 
          name: 'PayPal', 
          icon: Shield 
        });

        // PIX do Portal
        available.push({ 
          id: 'pix_portal', 
          name: 'PIX do Portal', 
          icon: QrCode 
        });
        
        setAvailableGateways(available);

        // Padrão: Mercado Pago
        setSelectedGateway('mercado_pago');

        setLoading(false);
      } catch (error) {
        console.error('Erro ao carregar checkout:', error);
        toast.error('Erro ao carregar dados do checkout');
        navigate('/catalogo');
      }
    };
    init();
  }, [itemId, navigate]);

const handlePaymentSuccess = async (paymentData) => {
    try {
      setPaying(true);
      setPaymentSuccess(true);

      const isWaitingApproval = paymentData?.isPending || paymentData?.status === 'waiting_approval';
      const transactionIds = [];
      
      for (const item of items) {
        const itemPrice = parseFloat(item.price);
        const itemPlatformFee = settings ? parseFloat((itemPrice * settings.sale_fee_pct / 100).toFixed(2)) : 0;
        const itemProcessingFee = settings?.processing_fee_fixed || 2.0;
        const itemTotal = itemPrice + itemPlatformFee + itemProcessingFee;
        
        let transactionId = null;
        
        try {
          // Try edge function first
          const { data, error: fnError } = await supabase.functions.invoke('process-transaction', {
            body: {
              transactionType: 'venda',
              buyerId: user.id,
              sellerId: item.seller_id,
              itemId: item.id,
              itemPrice: itemPrice,
              shippingCost: 0,
              insuranceCost: 0,
              platformFee: itemPlatformFee,
              processingFee: itemProcessingFee,
              gatewayFee: 0,
              totalAmount: itemTotal,
              netAmount: itemPrice - itemPlatformFee,
              paymentId: paymentData.paymentId,
              paymentProvider: paymentData.provider,
              comprovanteUrl: paymentData.comprovanteUrl
            }
          });

          if (fnError) {
            console.warn('Edge function failed, creating transaction directly:', fnError);
            
            // Fallback: create transaction directly
            const { data: tx, error: txError } = await supabase.from('transactions').insert([{
              buyer_id: user.id,
              seller_id: item.seller_id,
              item_id: item.id,
              price: itemPrice,
              platform_fee: itemPlatformFee,
              gateway_fee: 0,
              total_amount: itemTotal,
              net_amount: itemPrice - itemPlatformFee,
              status: isWaitingApproval ? 'waiting_approval' : 'vendido',
              payment_id: paymentData.paymentId,
              payment_method: paymentData.provider
            }]).select().single();
            
            if (txError) {
              console.error('Transaction insert failed:', txError);
              alert('Erro ao criar transação: ' + txError.message);
            } else {
              transactionId = tx.id;
              console.log('Transaction created:', tx.id);
              
              if (isWaitingApproval) {
                // Mark item as PENDENTE (invisible in catalog, waiting approval)
                await supabase.from('items').update({
                  status: 'pendente'
                }).eq('id', item.id);
              } else {
                // Mark item as SOLD immediately
                await supabase.from('items').update({
                  is_sold: true,
                  status: 'vendido'
                }).eq('id', item.id);
                
                // Add profit to seller's balance
                const { data: sellerBalance } = await supabase
                  .from('user_balances')
                  .select('*')
                  .eq('user_id', item.seller_id)
                  .single();
                
                if (sellerBalance) {
                  await supabase.from('user_balances').update({
                    available_balance: (sellerBalance.available_balance || 0) + (itemPrice - itemPlatformFee),
                    pending_balance: (sellerBalance.pending_balance || 0)
                  }).eq('user_id', item.seller_id);
                } else {
                  await supabase.from('user_balances').insert([{
                    user_id: item.seller_id,
                    available_balance: itemPrice - itemPlatformFee,
                    pending_balance: 0
                  }]);
                }
              }
            }
          } else {
            transactionId = data?.transactionId;
          }
        } catch (err) {
          console.warn('process-transaction exception (ignoring):', err);
          transactionId = `tx-${Date.now()}`;
        }
        
        if (transactionId) {
          transactionIds.push(transactionId);
        }
      }

      // Create notification for each seller
      if (isWaitingApproval) {
        toast.info('Comprovante enviado! Aguarde aprovação do vendedor.', {
          duration: 5000,
        });
        
        // Notify each unique seller
        const sellerIds = [...new Set(items.map(i => i.seller_id))];
        for (const sellerId of sellerIds) {
          const sellerItems = items.filter(i => i.seller_id === sellerId);
          const titles = sellerItems.map(i => i.title).join(', ');
          await supabase.from('notifications').insert({
            user_id: sellerId,
            type: 'comprovante_received',
            title: 'Novo comprovante PIX',
            message: `Novo comprovante para: ${titles}. Clique para verificar.`,
            link_url: '/profile?tab=sales'
          });
        }
      } else {
        toast.success('Compra realizada com sucesso!', {
          description: `${items.length} item(ns) comprado(s). O(s) vendedor(es) foi(ram) notificado(s).`,
          duration: 5000,
        });
      }

      // Limpar carrinho
      for (const item of items) {
        await clearLocalCart(item.id);
      }

      // Redirecionar para página de sucesso (com status na URL)
      setTimeout(() => {
        const statusParam = isWaitingApproval ? '&status=pending' : '';
        navigate(`/payment/success?transactionId=${transactionIds.join(',')}${statusParam}`);
      }, 2000);

    } catch (error) {
      toast.error('Erro ao finalizar compra', {
        description: error.message || 'Tente novamente ou entre em contato com o suporte'
      });
      setPaymentSuccess(false);
    } finally {
      setPaying(false);
    }
  };

  const handlePaymentError = (error) => {
    toast.error('Erro no pagamento', {
      description: error.message || 'Verifique seus dados e tente novamente'
    });
    setShowPayment(false);
  };

  // 🧮 CÁLCULO DE VALORES (múltiplos itens) - Conversão feita pelo formatCurrency do I18nContext
  const baseItemPrice = items.reduce((sum, item) => sum + parseFloat(item?.price || 0), 0);
  const basePlatformFee = settings ? parseFloat((baseItemPrice * settings.sale_fee_pct / 100).toFixed(2)) : 0;
  const baseProcessingFee = (settings?.processing_fee_fixed || 2.0) * items.length;
  const baseTotal = baseItemPrice + basePlatformFee + baseProcessingFee;

  // Usar valores base - a conversão BRL->USD é feita pelo formatCurrency quando locale é en-US
  const itemPrice = baseItemPrice;
  const platformFee = basePlatformFee;
  const processingFee = baseProcessingFee;
  const totalBuyer = baseTotal;

  // Todos os gateways disponíveis para o catálogo
  const displayedGateways = availableGateways;

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal-deep flex items-center justify-center">
        <div className="relative">
          <Loader2 className="animate-spin text-gold-premium opacity-20" size={64} />
          <Disc className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gold-premium animate-pulse" size={32} />
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="min-h-screen bg-charcoal-deep text-white py-12 px-4 md:px-8 pt-28 selection:bg-gold-premium/30 selection:text-gold-light">
      <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-1000">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="space-y-4">
            <Pill color="gold">{t('checkout.badge') || 'TRANSAÇÃO SEGURA'}</Pill>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none text-luxury">
              {t('checkout.title') || 'Finalizar'} <span className="block sm:inline text-gold-premium">{t('checkout.title.gold') || 'Aquisição'}</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className="h-[1px] w-12 bg-gold-premium/30"></div>
              <p className="text-silver-premium/40 text-[10px] uppercase tracking-[0.3em] font-bold">
                {t('checkout.subtitle') || 'AUTENTICIDADE E SEGURANÇA GARANTIDAS'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-charcoal-mid/30 border border-gold-premium/10 px-6 py-4 rounded-2xl shadow-xl">
            <Shield className="text-gold-premium animate-pulse" size={24} />
            <div>
              <p className="text-white font-bold text-xs uppercase tracking-tight">{t('checkout.protection.title')}</p>
              <p className="text-silver-premium/40 text-[9px] uppercase font-black tracking-widest">{t('checkout.protection.desc')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Item Details */}
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card rounded-[3rem] p-8 md:p-10 border-gold-premium/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gold-premium/5 rounded-full -mr-32 -mt-32 blur-3xl transition-all duration-1000 group-hover:bg-gold-premium/10" />
              
              <h2 className="text-xl font-black uppercase tracking-tighter text-luxury mb-8 flex items-center gap-3">
                <Disc className="text-gold-premium" size={20} /> {t('checkout.itemSummary') || `Itens no Carrinho (${items.length})`}
              </h2> 

              <div className="space-y-6">
                {items.map((item) => {
                  const seller = sellers[item.seller_id];
                  return (
                    <div key={item.id} className="flex flex-col md:flex-row gap-6 relative pb-6 border-b border-gold-premium/10 last:border-0 last:pb-0">
                      <div className="w-full md:w-32 aspect-square rounded-2xl overflow-hidden border border-gold-premium/10 shadow-xl shrink-0 group">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full bg-charcoal-mid/50 flex items-center justify-center">
                            <Disc size={32} className="text-gold-premium/20" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                          <h3 className="text-xl font-black uppercase tracking-tighter text-white leading-tight">{item.title}</h3>
                          <p className="text-gold-premium/60 font-black uppercase tracking-[0.15em] text-xs">{item.artist}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-silver-premium/30 text-[9px] uppercase font-black tracking-widest mb-1">{t('checkout.labels.condition')}</p>
                            <span className="px-2 py-0.5 bg-gold-premium/10 border border-gold-premium/20 text-gold-premium text-[10px] rounded-lg font-black uppercase tracking-widest">
                              {item.condition || 'Mint'}
                            </span>
                          </div>
                          <div>
                            <p className="text-silver-premium/30 text-[9px] uppercase font-black tracking-widest mb-1">{t('checkout.labels.seller')}</p>
                            <div className="flex items-center gap-1">
                              <span className="text-white font-bold text-xs tracking-tight">{seller?.full_name || 'Colecionador'}</span>
                              {seller?.is_elite && <CheckCircle className="text-info" size={10} />}
                            </div>
                          </div>
                          <div>
                            <p className="text-silver-premium/30 text-[9px] uppercase font-black tracking-widest mb-1">Preço</p>
                            <p className="text-emerald-400 font-black text-lg">
                              {formatCurrency(parseFloat(item.price), 'BRL')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Method Selection - Refined for Luxury Feel */}
            <div className="glass-card rounded-[3rem] p-8 md:p-10 border-gold-premium/5 shadow-2xl">
              <h2 className="text-xl font-black uppercase tracking-tighter text-luxury mb-8 flex items-center gap-3">
                <CreditCard className="text-gold-premium" size={20} /> {t('checkout.paymentMethod') || 'Método de Pagamento'}
              </h2>

              {displayedGateways.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {displayedGateways.map((gateway) => (
                    <button
                      key={gateway.id}
                      onClick={() => setSelectedGateway(gateway.id)}
                      className={`relative group p-6 rounded-[2rem] border-2 transition-all duration-500 flex flex-col items-center text-center gap-4 overflow-hidden
                        ${selectedGateway === gateway.id
                          ? 'bg-gold-premium/10 border-gold-premium shadow-[0_0_40px_rgba(212,175,55,0.1)] scale-105'
                          : 'bg-charcoal-mid/30 border-gold-premium/5 hover:border-gold-premium/20 hover:bg-gold-premium/[0.02]'
                        }`}
                    >
                      {selectedGateway === gateway.id && (
                        <div className="absolute top-4 right-4 animate-in zoom-in duration-300">
                          <CheckCircle size={20} className="text-gold-premium" />
                        </div>
                      )}
                      
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-500
                        ${selectedGateway === gateway.id ? 'bg-gold-premium text-charcoal-deep shadow-xl' : 'bg-charcoal-deep text-gold-premium/40 group-hover:text-gold-premium'}`}>
                        {gateway.id === 'stripe' && <CreditCard size={32} />}
                        {gateway.id === 'mercado_pago' && <Disc size={32} />}
                        {gateway.id === 'paypal' && <Shield size={32} />}
                        {gateway.id === 'pix_portal' && <QrCode size={32} />}
                      </div>

                      <div className="space-y-1">
                        <p className={`font-black uppercase tracking-widest text-[10px] ${selectedGateway === gateway.id ? 'text-gold-premium' : 'text-silver-premium/40'}`}>
                          {gateway.id === 'stripe' ? t('checkout.payment.creditCard') : gateway.id === 'mercado_pago' ? t('checkout.payment.mercadoPago') : gateway.id === 'pix_portal' ? 'PIX do Portal' : t('checkout.payment.paypal')}
                        </p>
                        <p className="text-white font-bold text-xs tracking-tight">
                          {gateway.id === 'stripe' ? t('checkout.payment.creditCardDesc') : gateway.id === 'mercado_pago' ? t('checkout.payment.mercadoPagoDesc') : gateway.id === 'pix_portal' ? 'Pagamento direto para o portal' : t('checkout.payment.paypalDesc')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-danger/5 border border-danger/20 rounded-3xl p-8 text-center space-y-4">
                  <AlertTriangle className="text-danger mx-auto" size={48} />
                  <div className="space-y-2">
                    <p className="text-danger font-black uppercase tracking-widest text-xs">{t('checkout.error.config')}</p>
                    <p className="text-silver-premium/60 text-sm max-w-sm mx-auto">{t('checkout.error.noGateway')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary & Checkout Action */}
          <div className="lg:col-span-1 h-fit">
            <div className="glass-card rounded-[3rem] p-8 md:p-10 border-gold-premium/20 shadow-2xl sticky top-28 bg-gradient-to-b from-gold-premium/[0.08] to-transparent space-y-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter text-luxury flex items-center gap-3">
                  <CheckCircle className="text-gold-premium" size={20} /> {t('checkout.orderSummary') || 'Resumo Financeiro'}
                </h2>
                
                {/* 💰 Currency Selector */}
                <div className="flex bg-charcoal-deep rounded-lg p-1 border border-gold-premium/10">
                  <button
                    onClick={() => setCurrency('BRL')}
                    className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${currency === 'BRL' ? 'bg-gold-premium text-charcoal-deep shadow-md' : 'text-silver-premium/40 hover:text-white'}`}
                  >
                    BRL
                  </button>
                  <button
                    onClick={() => setCurrency('USD')}
                    className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${currency === 'USD' ? 'bg-gold-premium text-charcoal-deep shadow-md' : 'text-silver-premium/40 hover:text-white'}`}
                  >
                    USD
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center group">
                  <span className="text-silver-premium/40 text-[10px] font-black uppercase tracking-widest group-hover:text-silver-premium/60 transition-colors">{t('checkout.labels.itemValue')}</span>
                  <span className="text-white font-bold">{formatCurrency(itemPrice, currency)}</span>
                </div>
                <div className="flex justify-between items-center group">
                  <span className="text-silver-premium/40 text-[10px] font-black uppercase tracking-widest group-hover:text-silver-premium/60 transition-colors">{t('checkout.labels.fee')}</span>
                  <span className="text-white font-bold">{formatCurrency(platformFee, currency)}</span>
                </div>
                <div className="flex justify-between items-center group pb-4 border-b border-gold-premium/10">
                  <span className="text-silver-premium/40 text-[10px] font-black uppercase tracking-widest group-hover:text-silver-premium/60 transition-colors">{t('checkout.labels.processing')}</span>
                  <span className="text-white font-bold">{formatCurrency(processingFee, currency)}</span>
                </div>
                
                <div className="flex justify-between items-end pt-2">
                  <div className="space-y-1">
                    <p className="text-gold-premium/40 text-[10px] font-black uppercase tracking-widest leading-none">{t('checkout.labels.total')}</p>
                    <p className="text-luxury font-black text-4xl leading-none">{formatCurrency(totalBuyer, currency)}</p>
                  </div>
                </div>
              </div>

              {/* Action Area */}
              <div className="space-y-4 pt-4">
                {!showPayment && !paymentSuccess && (
                  <button
                    disabled={displayedGateways.length === 0}
                    onClick={() => setShowPayment(true)}
                    className="w-full bg-gold-premium text-charcoal-deep py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:scale-105 transition-all duration-500 disabled:opacity-30 disabled:grayscale active:scale-95 flex items-center justify-center gap-3"
                  >
                    <CreditCard size={18} />
                    {t('checkout.actions.continue') || 'Confirmar e Pagar'}
                  </button>
                )}

                {showPayment && !paymentSuccess && (
                  <div className="animate-in fade-in zoom-in-95 duration-500">
                    <PaymentGateway
                      amount={totalBuyer}
                      selectedGateway={selectedGateway}
                      currency={currency}
                      metadata={{
                        transactionType: 'venda',
                        itemIds: items.map(i => i.id),
                        itemTitles: items.map(i => i.title),
                        itemCount: items.length,
                        buyerId: user.id,
                        buyerName: user.email,
                        buyerEmail: user.email,
                        sellerIds: [...new Set(items.map(i => i.seller_id))],
                        itemPrices: items.map(i => parseFloat(i.price)),
                        totalItemsPrice: baseItemPrice,
                        platformFee,
                        processingFee,
                        totalAmount: totalBuyer,
                        transactionId: `TRX-${user.id}-${Date.now()}`,
                        currency
                      }}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                    <button 
                      onClick={() => setShowPayment(false)}
                      className="w-full mt-4 text-silver-premium/30 hover:text-gold-premium text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                      {t('checkout.actions.back') || 'Voltar para seleção'}
                    </button>
                  </div>
                )}

                {paymentSuccess && (
                  <div className="bg-success/10 border border-success/30 rounded-3xl p-8 text-center space-y-4 animate-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="text-success" size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-success font-black uppercase tracking-widest text-xs">{t('checkout.success.title')}</p>
                      <p className="text-silver-premium/60 text-[10px] uppercase font-bold tracking-tight">{t('checkout.success.desc')}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-gold-premium/5 flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                  <Shield size={16} className="text-gold-premium" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-silver-premium/60">
                    {t('checkout.securePayment') || 'Pagamento 100% Criptografado'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
