import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Package, Truck, Clock, ArrowRight, Home, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Pill } from '../components/UIComponents';
import { useI18n } from '../contexts/I18nContext.jsx';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [transaction, setTransaction] = useState(null);
  const [shipping, setShipping] = useState(null);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState('checking'); // checking | active | pending | failed

  const transactionId = searchParams.get('transaction_id') || searchParams.get('transactionId');
  const swapId = searchParams.get('swap_id');

  const paymentId =
    searchParams.get('payment_id') ||
    searchParams.get('collection_id') ||
    searchParams.get('external_reference');
  const externalReference = searchParams.get('external_reference') || searchParams.get('externalReference') || '';
  const mode = (searchParams.get('mode') || '').toLowerCase();
  const paymentStatus = searchParams.get('status') || searchParams.get('collection_status');
  const paymentProvider = searchParams.get('payment_provider') || 'mercado_pago';
  const planId = (searchParams.get('plan') || '').toLowerCase();

  const returnItemId = searchParams.get('item_id');
  const returnBuyerId = searchParams.get('buyer_id');
  const returnSellerId = searchParams.get('seller_id');
  const returnItemPrice = parseFloat(searchParams.get('item_price') || '0');
  const returnPlatformFee = parseFloat(searchParams.get('platform_fee') || '0');
  const returnProcessingFee = parseFloat(searchParams.get('processing_fee') || '0');
  const returnTotalAmount = parseFloat(searchParams.get('total_amount') || '0');

  const currentPath = window.location.pathname;
  const isFailure = currentPath.includes('/failure') || paymentStatus === 'rejected' || paymentStatus === 'cancelled' || !paymentStatus;
  const isPending = currentPath.includes('/pending') || paymentStatus === 'pending' || paymentStatus === 'in_process';
  const isApproved = paymentStatus === 'approved';
  const isSuccess = isApproved && transaction !== null;
  const isSubscriptionFlow = mode === 'subscription' || String(externalReference || '').startsWith('SUBS-');

  useEffect(() => {
    if (!isSubscriptionFlow) loadTransactionDetails();
  }, [transactionId, swapId, paymentId, paymentStatus, isSubscriptionFlow]);

  useEffect(() => {
    if (!isSubscriptionFlow) return;

    const run = async () => {
      if (!isApproved || isFailure) {
        setSubscriptionStatus('failed');
        setLoading(false);
        return;
      }

      setLoading(false);
      setSubscriptionStatus('pending');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setSubscriptionStatus('failed');
        return;
      }

      let tries = 0;
      const interval = window.setInterval(async () => {
        tries += 1;
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('user_level, subscription_status, subscription_plan')
            .eq('id', user.id)
            .single();

          if (!error) {
            const lvl = Number(profile?.user_level || 0);
            const status = String(profile?.subscription_status || '').toLowerCase();
            if (lvl > 0 && status === 'active') {
              window.clearInterval(interval);
              setSubscriptionStatus('active');
              window.setTimeout(() => navigate('/grooveflix'), 1200);
            }
          }
        } catch (e) {
          void e;
        }

        if (tries >= 24) {
          window.clearInterval(interval);
          setSubscriptionStatus('failed');
        }
      }, 2500);
    };

    run();
  }, [isSubscriptionFlow, isSuccess, isFailure, navigate]);

  const loadTransactionById = async (id) => {
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*, items(*)')
      .eq('id', id)
      .single();

    if (txError) throw txError;

    setTransaction(txData);
    setItem(txData.items);

    const { data: shipData } = await supabase
      .from('shipping')
      .select('*')
      .eq('transaction_id', id)
      .single();

    setShipping(shipData);
  };

  const loadTransactionDetails = async () => {
    try {
      setLoading(true);

      if (transactionId) {
        await loadTransactionById(transactionId);
      } else if (swapId) {
        // Carregar detalhes do swap
        const { data: swapData, error: swapError } = await supabase
          .from('swaps')
          .select(`
            *,
            item_1:items!swaps_item_1_id_fkey(*),
            item_2:items!swaps_item_2_id_fkey(*)
          `)
          .eq('id', swapId)
          .single();

        if (swapError) throw swapError;

        setTransaction(swapData);
      } else if (paymentStatus === 'approved' && paymentId && returnItemId && returnBuyerId) {
        // Buscar transação existente pelo payment_id
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('payment_id', paymentId)
          .maybeSingle();

        if (existingTx) {
          await loadTransactionById(existingTx.id);
        } else {
          // Buscar dados de endereço do comprador
          const { data: buyerProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', returnBuyerId)
            .single();

          // Buscar dados de endereço do vendedor
          const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', returnSellerId)
            .single();

          // Construir objeto de endereço do destinatário (comprador)
          const toAddress = {
            logradouro: buyerProfile?.address || '',
            numero: buyerProfile?.number || '',
            complemento: buyerProfile?.complement || '',
            bairro: buyerProfile?.neighborhood || '',
            localidade: buyerProfile?.city || '',
            uf: buyerProfile?.state || '',
            cep: buyerProfile?.cep || ''
          };

          // Construir objeto de endereço do remetente (vendedor)
          const fromAddress = {
            logradouro: sellerProfile?.address || '',
            numero: sellerProfile?.number || '',
            complemento: sellerProfile?.complement || '',
            bairro: sellerProfile?.neighborhood || '',
            localidade: sellerProfile?.city || '',
            uf: sellerProfile?.state || '',
            cep: sellerProfile?.cep || ''
          };

          const { data, error } = await supabase.functions.invoke('process-transaction', {
            body: {
              transactionType: 'venda',
              buyerId: returnBuyerId,
              sellerId: returnSellerId,
              itemId: returnItemId,
              itemPrice: returnItemPrice,
              shippingCost: 0,
              insuranceCost: 0,
              platformFee: returnPlatformFee,
              processingFee: returnProcessingFee,
              gatewayFee: 0,
              totalAmount: returnTotalAmount,
              netAmount: returnItemPrice - returnPlatformFee,
              paymentId: paymentId,
              shippingData: {
                fromAddress,
                fromCep: sellerProfile?.cep || '00000-000',
                toAddress,
                toCep: buyerProfile?.cep || '00000-000',
                carrier: 'correios'
              },
              paymentProvider,
            }
          });

          if (error) throw error;

          if (data?.transactionId) {
            await loadTransactionById(data.transactionId);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#D4AF37]"></div>
          <p className="text-white/60">Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (isSubscriptionFlow) {
    const isActive = subscriptionStatus === 'active';
    const isFailed = subscriptionStatus === 'failed';
    return (
      <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-black" />
          <div className="absolute -top-40 -left-40 w-[560px] h-[560px] bg-fuchsia-600/15 blur-[140px]" />
          <div className="absolute top-10 right-[-160px] w-[680px] h-[680px] bg-purple-600/14 blur-[160px]" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center space-y-8">
          <Pill>
            {isActive ? (t('checkout.subscription.unlocked.badge') || 'Acesso Liberado') : isFailed ? (t('checkout.subscription.unlocked.badgeFail') || 'Sincronização Pendente') : (t('checkout.subscription.unlocked.badgePending') || 'Liberando...')}
          </Pill>

          <h1 className="text-4xl md:text-6xl font-black tracking-tighter">
            {isActive ? (
              <>
                {t('checkout.subscription.unlocked.title') || 'Sarcófago'} <span className="text-fuchsia-400">{t('checkout.subscription.unlocked.title2') || 'Aberto'}</span>
              </>
            ) : isFailed ? (
              <>
                {t('checkout.subscription.unlocked.failTitle') || 'Quase lá'} <span className="text-fuchsia-400">…</span>
              </>
            ) : (
              <>
                {t('checkout.subscription.unlocked.pendingTitle') || 'Acesso'} <span className="text-fuchsia-400">{t('checkout.subscription.unlocked.pendingTitle2') || 'Sendo Liberado'}</span>
              </>
            )}
          </h1>

          <p className="text-white/60 text-sm max-w-2xl mx-auto">
            {isActive
              ? (t('checkout.subscription.unlocked.desc') || 'Sua assinatura foi ativada. Redirecionando para o Grooveflix…')
              : isFailed
              ? (t('checkout.subscription.unlocked.failDesc') || 'O webhook ainda está sincronizando. Aguarde alguns segundos e tente novamente.')
              : (t('checkout.subscription.unlocked.pendingDesc') || 'Estamos aguardando a confirmação final do gateway. Isso pode levar alguns segundos.')}
          </p>

          <div className="flex items-center justify-center gap-2">
            <div className="flex items-end gap-1 h-10 w-20">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="gf-vu-bar w-2 rounded-sm bg-gradient-to-t from-fuchsia-500 to-purple-500"
                  style={{ height: `${12 + i * 4}px` }}
                />
              ))}
            </div>
            <div className="led-display">
              <span className="led-text">{(planId || 'keeper').toUpperCase()}</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/grooveflix')}
              disabled={!isActive}
              className="w-full md:w-auto px-8 py-4 rounded-2xl font-black uppercase tracking-[0.22em] text-[10px] border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-500/25 to-purple-500/15 text-white hover:border-fuchsia-500/70 transition disabled:opacity-30"
            >
              {t('checkout.subscription.unlocked.cta') || 'Entrar no Grooveflix'}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full md:w-auto px-8 py-4 rounded-2xl font-black uppercase tracking-[0.22em] text-[10px] border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition"
            >
              {t('checkout.subscription.unlocked.retry') || 'Recarregar'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/plans')}
              className="w-full md:w-auto px-8 py-4 rounded-2xl font-black uppercase tracking-[0.22em] text-[10px] border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition"
            >
              {t('checkout.subscription.unlocked.plans') || 'Ver Planos'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSwap = !!swapId;

  const handleChatWithSeller = async () => {
    const itemId = returnItemId;
    const sellerId = returnSellerId;
    const buyerId = returnBuyerId;
    
    if (!itemId || !sellerId || !buyerId) {
      navigate('/mensagens');
      return;
    }
    
    try {
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('item_id', itemId)
        .eq('receiver_id', sellerId)
        .eq('sender_id', buyerId)
        .maybeSingle();
      
      if (existingMessages) {
        navigate(`/chat/${itemId}`);
      } else {
        const itemTitle = item?.title || transaction?.item_1?.title || 'Item';
        
        const { error: msgError } = await supabase.from('messages').insert([{
          sender_id: buyerId,
          receiver_id: sellerId,
          item_id: itemId,
          content: `Olá! Acabei de comprar seu item "${itemTitle}". Como podemos combinar o envio?`
        }]);
        
        if (!msgError) {
          navigate(`/chat/${itemId}`);
        } else {
          navigate(`/chat/${itemId}`);
        }
      }
    } catch (e) {
      console.error('[Chat] Erro:', e);
      navigate('/mensagens');
    }
  };

  if (!isApproved && !isSubscriptionFlow && !transaction) {
    return (
      <div className="min-h-screen bg-black text-white py-8 px-4 md:px-6 pt-20">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-2 bg-red-500/10 border-red-500">
            <svg className="w-14 h-14 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <Pill>
              Pagamento Não Concluído
            </Pill>
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold">
            Ops! O pagamento não foi concluído
          </h1>
          
          <p className="text-white/60">
            Parece que você abandonou o pagamento ou optou por não finalizar a compra.
          </p>
          
          <button
            onClick={() => navigate('/checkout')}
            className="w-full max-w-md bg-[#D4AF37] hover:bg-[#B8962F] text-black py-3 px-6 rounded-xl font-bold transition"
          >
            Tentar Novamente
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full max-w-md bg-white/10 hover:bg-white/20 text-white py-3 px-6 rounded-xl font-bold transition"
          >
            Voltar para Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 md:px-6 pt-20">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Success Header */}
        <div className="text-center space-y-6 animate-fade-in">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-2 animate-scale-in ${
            isFailure ? 'bg-red-500/10 border-red-500' :
            isPending ? 'bg-yellow-500/10 border-yellow-500' :
            'bg-green-500/10 border-green-500'
          }`}>
            {isFailure ? (
              <svg className="w-14 h-14 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : isPending ? (
              <Clock size={56} className="text-yellow-500" />
            ) : (
              <CheckCircle2 size={56} className="text-green-500" />
            )}
          </div>
          
          <div className="space-y-2">
            <Pill>
              {isFailure ? 'Pagamento Recusado' :
               isPending ? 'Pagamento Pendente' :
               isSwap ? 'Troca Processada' : 'Pagamento Confirmado'}
            </Pill>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 uppercase">
              {isFailure ? (
                <>
                  Pagamento <span className="text-red-500">Não Aprovado</span>
                </>
              ) : isPending ? (
                <>
                  Em <span className="text-yellow-500">Análise</span>
                </>
              ) : isSwap ? (
                <>
                  Taxa <span className="text-green-500">Paga!</span>
                </>
              ) : (
                <>
                  Pagamento <span className="text-green-500">Confirmado!</span>
                </>
              )}
            </h1>
            <p className="text-white/60 text-[10px] uppercase tracking-[3px] mt-2">
              {isFailure ?
                'O pagamento não foi aprovado. Tente novamente com outro método.'
              : isPending ?
                'Aguardando confirmação do pagamento. Você será notificado.'
              : isSwap ? 
                'Sua taxa de garantia foi processada. Aguardando o outro usuário.'
              : 'Seu pedido foi confirmado e está sendo processado.'}
            </p>
          </div>
        </div>

        {/* Transaction Details Card */}
        {!isSwap && transaction && item && (
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl p-8 space-y-6">
            {/* Alert: Item is now sold */}
            {item.is_sold && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-start gap-3">
                <div className="text-green-400 mt-1">✓</div>
                <div className="space-y-1">
                  <p className="font-bold text-green-300">Item marcado como vendido</p>
                  <p className="text-green-300/70 text-xs">Este item não aparecerá mais no catálogo e não está disponível para outros compradores.</p>
                </div>
              </div>
            )}
            {/* Order Info */}
            <div className="flex justify-between items-start border-b border-white/10 pb-6">
              <div className="space-y-1">
                <p className="text-xs text-white/40 uppercase font-bold tracking-widest">Pedido</p>
                <p className="text-2xl font-black text-[#D4AF37]">
                  #{transaction.id.substring(0, 8).toUpperCase()}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs text-white/40 uppercase font-bold tracking-widest">Total Pago</p>
                <p className="text-3xl font-black">
                  R$ {parseFloat(transaction.total_amount || transaction.amount || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Item Info */}
            {item && (
              <div className="flex gap-6 border-b border-white/10 pb-6">
                {item.image_url && (
                  <div className="relative">
                    <img 
                      src={item.image_url} 
                      alt={item.title}
                      className="w-32 h-32 rounded-2xl object-cover border-2 border-white/10"
                    />
                    {item.is_sold && (
                      <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-white font-black text-lg">✓</p>
                          <p className="text-white/90 text-xs font-bold">{t('paymentSuccess.sold')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold">{item.title}</h3>
                      <p className="text-white/60">{item.artist}</p>
                    </div>
                    {item.is_sold && (
                      <div className="bg-green-500/20 border border-green-500/50 rounded-lg px-3 py-1 whitespace-nowrap">
                        <p className="text-green-300 text-xs font-bold">✓ {t('paymentSuccess.sold')}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 text-sm">
                    {item.condition && (
                      <span className="px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                        {item.condition}
                      </span>
                    )}
                    {item.format && (
                      <span className="px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                        {item.format}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Shipping Status */}
            {shipping && (
              <div className="space-y-4">
                <p className="text-xs text-white/40 uppercase font-bold tracking-widest">Status do Envio</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                      <CheckCircle2 size={20} className="text-green-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-sm">Pagamento Confirmado</p>
                      <p className="text-white/40 text-xs">Pedido em processamento</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center">
                      <Clock size={20} className="text-yellow-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-sm">Aguardando Etiqueta</p>
                      <p className="text-white/40 text-xs">Vendedor gerando envio</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
                      <Truck size={20} className="text-white/40" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-white/60">Em Trânsito</p>
                      <p className="text-white/40 text-xs">Em breve</p>
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                {shipping.to_address && (
                  <div className="bg-white/5 rounded-2xl p-6 space-y-2">
                    <div className="flex items-center gap-2 text-[#D4AF37] mb-3">
                      <Package size={20} />
                      <p className="font-bold">Endereço de Entrega</p>
                    </div>
                    <p className="text-white/80">
                      {shipping.to_address.logradouro}, {shipping.to_address.numero}
                      {shipping.to_address.complemento && `, ${shipping.to_address.complemento}`}
                    </p>
                    <p className="text-white/80">
                      {shipping.to_address.bairro} - {shipping.to_address.localidade}/{shipping.to_address.uf}
                    </p>
                    <p className="text-white/80">CEP: {shipping.to_cep}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Swap Details Card */}
        {isSwap && transaction && (
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black">Taxa de Garantia Paga</h2>
              <p className="text-white/60">
                {transaction.guarantee_fee_1_paid && transaction.guarantee_fee_2_paid
                  ? '🎉 Ambos os usuários pagaram! Vocês podem gerar as etiquetas de envio agora.'
                  : '⏳ Aguardando o outro usuário pagar sua taxa de garantia.'}
              </p>
            </div>

            {transaction.guarantee_fee_1_paid && transaction.guarantee_fee_2_paid && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {transaction.item_1 && (
                  <div className="bg-white/5 rounded-2xl p-6 space-y-3">
                    <p className="text-xs text-white/40 uppercase font-bold tracking-widest">Você Oferece</p>
                    {transaction.item_1.image_url && (
                      <img 
                        src={transaction.item_1.image_url} 
                        alt={transaction.item_1.title}
                        className="w-full h-48 object-cover rounded-xl"
                      />
                    )}
                    <p className="font-bold">{transaction.item_1.title}</p>
                    <p className="text-white/60 text-sm">{transaction.item_1.artist}</p>
                  </div>
                )}
                {transaction.item_2 && (
                  <div className="bg-white/5 rounded-2xl p-6 space-y-3">
                    <p className="text-xs text-white/40 uppercase font-bold tracking-widest">Você Recebe</p>
                    {transaction.item_2.image_url && (
                      <img 
                        src={transaction.item_2.image_url} 
                        alt={transaction.item_2.title}
                        className="w-full h-48 object-cover rounded-xl"
                      />
                    )}
                    <p className="font-bold">{transaction.item_2.title}</p>
                    <p className="text-white/60 text-sm">{transaction.item_2.artist}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-4 px-6 transition-all group"
          >
            <Home size={20} />
            <span className="font-bold">Início</span>
          </button>

          {!isSwap && (
            <button
              onClick={() => navigate('/meu-acervo')}
              className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-4 px-6 transition-all group"
            >
              <Package size={20} />
              <span className="font-bold">Meu Acervo</span>
            </button>
          )}

          {isSwap && (
            <button
              onClick={() => navigate('/swaps')}
              className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-4 px-6 transition-all group"
            >
              <Package size={20} />
              <span className="font-bold">Minhas Trocas</span>
            </button>
          )}

          <button
            onClick={handleChatWithSeller}
            className="flex items-center justify-center gap-3 bg-[#D4AF37] hover:bg-[#B8941F] text-black rounded-2xl py-4 px-6 transition-all group font-bold"
          >
            <MessageCircle size={20} />
            <span>Chat com Vendedor</span>
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6 space-y-2">
          <p className="font-bold text-blue-400">ℹ️ Próximos Passos</p>
          <ul className="text-white/80 text-sm space-y-2 list-disc list-inside">
            {!isSwap ? (
              <>
                <li>O vendedor receberá uma notificação para gerar a etiqueta de envio</li>
                <li>Você receberá o código de rastreamento assim que o item for postado</li>
                <li>O pagamento fica em custódia até você confirmar o recebimento</li>
                <li>Use o chat para esclarecer dúvidas com o vendedor</li>
              </>
            ) : (
              <>
                <li>Ambos usuários devem pagar suas taxas de garantia</li>
                <li>Após ambos pagarem, vocês podem gerar etiquetas de envio</li>
                <li>As taxas serão devolvidas após confirmação dos envios</li>
                <li>Use o chat para coordenar a troca</li>
              </>
            )}
          </ul>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes scale-in {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  );
}
