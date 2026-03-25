import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Shield, AlertCircle, CheckCircle, Disc } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Pill } from '../components/UIComponents';
import PaymentGateway from '../components/PaymentGateway';

export default function SwapPayment() {
  const { swapId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [swap, setSwap] = useState(null);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [otherUserPaid, setOtherUserPaid] = useState(false);
  const [item1, setItem1] = useState(null);
  const [item2, setItem2] = useState(null);

  useEffect(() => {
    init();
  }, [swapId]);

  const init = async () => {
    try {
      setLoading(true);

      // Buscar usuário autenticado
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error('Faça login para continuar');
        navigate('/');
        return;
      }
      setUser(authUser);

      // Buscar dados do swap
      const { data: swapData, error: swapError } = await supabase
        .from('swaps')
        .select('*')
        .eq('swap_id', swapId)
        .single();

      if (swapError || !swapData) {
        toast.error('Troca não encontrada');
        navigate('/');
        return;
      }

      // Validar se usuário pertence a essa troca
      if (swapData.user_1_id !== authUser.id && swapData.user_2_id !== authUser.id) {
        toast.error('Você não tem permissão para acessar essa troca');
        navigate('/');
        return;
      }

      // Verificar se já pagou
      const isUser1 = swapData.user_1_id === authUser.id;
      const alreadyPaid = isUser1 ? swapData.guarantee_fee_1_paid : swapData.guarantee_fee_2_paid;
      const otherPaid = isUser1 ? swapData.guarantee_fee_2_paid : swapData.guarantee_fee_1_paid;

      if (alreadyPaid) {
        setPaymentSuccess(true);
        // Verificar se o outro também pagou
        if (otherPaid) {
          toast.success('Ambos pagaram! A troca está autorizada.');
          setTimeout(() => navigate('/swaps'), 2000);
          return;
        }
      }

      setOtherUserPaid(otherPaid);
      setSwap(swapData);

      // Buscar itens da troca
      const [item1Data, item2Data] = await Promise.all([
        supabase.from('items').select('*').eq('id', swapData.item_1_id).single(),
        supabase.from('items').select('*').eq('id', swapData.item_2_id).single()
      ]);

      setItem1(item1Data.data);
      setItem2(item2Data.data);

      // Buscar settings
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', 1)
        .single();
      setSettings(settingsData);

      setLoading(false);
    } catch (error) {
      toast.error('Erro ao carregar dados');
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentData) => {
    try {
      // Processar pagamento de taxa de swap
      const { data, error } = await supabase.functions.invoke('process-transaction', {
        body: {
          transactionType: 'swap_fee',
          buyerId: user.id,
          swapId: swapId,
          totalAmount: settings.swap_guarantee_fee_fixed,
          paymentId: paymentData.paymentId,
          paymentProvider: paymentData.provider
        }
      });

      if (error) throw error;

      setPaymentSuccess(true);

      if (data.bothPaid) {
        toast.success('Taxa paga! Ambos usuários podem gerar etiquetas agora. 🎉', {
          duration: 5000
        });
        setTimeout(() => navigate('/swaps'), 3000);
      } else {
        toast.success('Taxa de garantia paga! Aguardando o outro usuário...', {
          description: 'Você receberá uma notificação quando a troca for autorizada.',
          duration: 5000
        });
        setTimeout(() => navigate('/swaps'), 3000);
      }
    } catch (error) {
      toast.error('Erro ao processar taxa', {
        description: error.message
      });
    }
  };

  const handlePaymentError = (error) => {
    toast.error('Erro no pagamento', {
      description: error.message || 'Tente novamente'
    });
    setShowPayment(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Disc className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!swap || !settings) return null;

  const isUser1 = swap.user_1_id === user.id;
  const myItem = isUser1 ? item1 : item2;
  const theirItem = isUser1 ? item2 : item1;

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 md:px-6 pt-20">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/40 hover:text-[#D4AF37] transition-all text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="mb-8">
          <Pill>Troca Segura</Pill>
          <h1 className="text-4xl font-black italic tracking-tighter mt-4 uppercase">Taxa de <span className="text-[#D4AF37]">Garantia</span></h1>
          <p className="text-white/40 text-[10px] uppercase tracking-[3px] mt-2">Pague a taxa para autorizar o envio dos itens</p>
        </div>

        {/* Info sobre a troca */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Seu Item */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <p className="text-xs text-white/60 uppercase font-bold">Você Oferece</p>
            {myItem && (
              <div className="flex gap-3">
                {myItem.image_url && (
                  <img src={myItem.image_url} alt={myItem.title} className="w-16 h-16 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <p className="font-bold text-sm">{myItem.title}</p>
                  <p className="text-white/60 text-xs">{myItem.artist}</p>
                  <p className="text-[#D4AF37] font-bold mt-1">R$ {parseFloat(myItem.price).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Item deles */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <p className="text-xs text-white/60 uppercase font-bold">Você Recebe</p>
            {theirItem && (
              <div className="flex gap-3">
                {theirItem.image_url && (
                  <img src={theirItem.image_url} alt={theirItem.title} className="w-16 h-16 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <p className="font-bold text-sm">{theirItem.title}</p>
                  <p className="text-white/60 text-xs">{theirItem.artist}</p>
                  <p className="text-[#D4AF37] font-bold mt-1">R$ {parseFloat(theirItem.price).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status do outro usuário */}
        {otherUserPaid && !paymentSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="text-green-400" size={24} />
            <div className="flex-1">
              <p className="font-bold text-green-300">Outro usuário já pagou!</p>
              <p className="text-white/60 text-sm">Pague sua parte para liberar a troca</p>
            </div>
          </div>
        )}

        {!otherUserPaid && !paymentSuccess && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="text-yellow-400" size={24} />
            <div className="flex-1">
              <p className="font-bold text-yellow-300">Aguardando outro usuário</p>
              <p className="text-white/60 text-sm">Ambos devem pagar a taxa de garantia</p>
            </div>
          </div>
        )}

        {/* Explicação da Taxa */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm uppercase font-bold tracking-widest">Taxa de Garantia</p>
              <p className="text-3xl font-black text-[#D4AF37] mt-1">
                R$ {parseFloat(settings.swap_guarantee_fee_fixed).toFixed(2)}
              </p>
            </div>
            <Shield size={40} className="text-[#D4AF37]/30" />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2 text-sm">
            <p className="font-bold text-blue-300">💡 Como funciona?</p>
            <ul className="text-blue-100/80 space-y-1 text-xs">
              <li>✓ Ambos pagam uma taxa de garantia</li>
              <li>✓ Taxa garante que ambos enviarão os itens</li>
              <li>✓ Após confirmação de entrega, taxas são reembolsadas</li>
              <li>✓ Se alguém cancelar, quem cumpriu recebe reembolso total</li>
            </ul>
          </div>
        </div>

        {/* Payment Gateway */}
        {!paymentSuccess && (
          <div className="bg-gradient-to-b from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/30 rounded-3xl p-6 space-y-4">
            {!showPayment ? (
              <button
                onClick={() => setShowPayment(true)}
                className="w-full bg-[#D4AF37] text-black py-4 rounded-2xl font-black uppercase text-sm hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all"
              >
                Pagar Taxa de Garantia
              </button>
            ) : (
              <PaymentGateway
                amount={parseFloat(settings.swap_guarantee_fee_fixed)}
                metadata={{
                  transactionType: 'swap_fee',
                  swapId: swapId,
                  userId: user.id,
                  myItemId: myItem.id,
                  theirItemId: theirItem.id
                }}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            )}
          </div>
        )}

        {/* Sucesso */}
        {paymentSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-3xl p-8 text-center space-y-4">
            <CheckCircle size={64} className="text-green-400 mx-auto" />
            <div>
              <p className="text-2xl font-black text-green-300 mb-2">Taxa Paga com Sucesso!</p>
              {otherUserPaid ? (
                <p className="text-white/80">
                  Ambos pagaram! Agora vocês podem gerar etiquetas de envio. Redirecionando...
                </p>
              ) : (
                <p className="text-white/80">
                  Aguardando pagamento do outro usuário. Você receberá uma notificação.
                </p>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-white/40 text-center flex items-center justify-center gap-2">
          <Shield size={14} />
          Transação protegida pelo RareGroove
        </p>
      </div>
    </div>
  );
}
