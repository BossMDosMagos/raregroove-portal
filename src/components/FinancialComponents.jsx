import React, { useState } from 'react';
import { 
  DollarSign, TrendingUp, ShoppingCart, CreditCard, 
  ArrowUpRight, Calendar, User, Package, Clock,
  AlertCircle, CheckCircle, XCircle, Loader2, Eye,
  Truck, Send, Star, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { DeliveryTimeline, CompactTimeline } from './DeliveryTimeline';
import ReviewModal from './ReviewModal';
import ShippingLabelCard from './ShippingLabelCard';
import { validatePixKey, getPixTypeIcon, maskPixKeyDisplay } from '../utils/pixFormatter';

// ========================================
// CARD FINANCEIRO: Exibe métricas
// ========================================
export function FinanceMetricCard({ title, value, subtitle, icon: Icon, color = 'gold', trend }) {
  const colorClasses = {
    gold: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30',
    green: 'bg-green-500/10 text-green-400 border-green-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30'
  };

  return (
    <div className={`bg-black/40 border-2 ${colorClasses[color]} rounded-xl p-6 hover:border-opacity-50 transition-all`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-green-400 text-xs font-bold">
            <ArrowUpRight className="w-4 h-4" />
            {trend}
          </div>
        )}
      </div>
      
      <div>
        <p className="text-white/60 text-xs uppercase font-bold tracking-wider mb-1">
          {title}
        </p>
        <p className={`text-3xl font-black ${color === 'gold' ? 'text-[#D4AF37]' : `text-${color}-400`}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-white/40 text-xs mt-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// ========================================
// STATUS BADGE: Indicador visual de status
// ========================================
export function StatusBadge({ status }) {
  const statusConfig = {
    pendente: {
      label: 'Aguardando Pagamento',
      icon: Clock,
      color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
    },
    pago_em_custodia: {
      label: 'Pago em Custódia',
      icon: CheckCircle,
      color: 'text-blue-400 bg-blue-500/20 border-blue-500/30'
    },
    pago_custodia: {
      label: 'Pago em Custódia',
      icon: CheckCircle,
      color: 'text-blue-400 bg-blue-500/20 border-blue-500/30'
    },
    pago: {
      label: 'Pago - Enviar',
      icon: Package,
      color: 'text-blue-400 bg-blue-500/20 border-blue-500/30'
    },
    enviado: {
      label: 'Enviado',
      icon: ArrowUpRight,
      color: 'text-purple-400 bg-purple-500/20 border-purple-500/30'
    },
    concluido: {
      label: 'Concluído',
      icon: CheckCircle,
      color: 'text-green-400 bg-green-500/20 border-green-500/30'
    },
    cancelado: {
      label: 'Cancelado',
      icon: XCircle,
      color: 'text-red-400 bg-red-500/20 border-red-500/30'
    }
  };

  const config = statusConfig[status] || statusConfig.pendente;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

// ========================================
// TRANSACTION ROW: Linha de transação na lista
// ========================================
export function TransactionRow({ transaction, type = 'sale', onTrackingAdded, onDeliveryConfirmed }) {
  const [expanded, setExpanded] = useState(false);
  const [trackingCode, setTrackingCode] = useState(transaction.tracking_code || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDisputeSubmitting, setIsDisputeSubmitting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showShippingLabel, setShowShippingLabel] = useState(false);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const otherUser = type === 'sale' 
    ? { 
        id: transaction.buyer_id,
        name: transaction.buyer_name, 
        avatar: transaction.buyer_avatar 
      }
    : { 
        id: transaction.seller_id,
        name: transaction.seller_name, 
        avatar: transaction.seller_avatar 
      };

  const normalizedStatus = ['pago_em_custodia', 'pago_custodia'].includes(transaction.status)
    ? 'pago'
    : transaction.status;

  // Adicionar código de rastreio (vendedor)
  const handleAddTracking = async (e) => {
    e.preventDefault();
    
    if (!trackingCode.trim()) {
      toast.error('Insira o código de rastreio', {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .rpc('add_tracking_code', {
          p_transaction_id: transaction.transaction_id,
          p_tracking_code: trackingCode.trim()
        });

      if (error) throw error;

      if (data.success) {
        toast.success('✅ Código adicionado!', {
          description: 'Comprador foi notificado',
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
        onTrackingAdded?.();
      } else {
        toast.error(data.message, {
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
    } catch (error) {
      console.error('Erro ao adicionar tracking:', error);
      toast.error('Erro ao adicionar código', {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmar recebimento (comprador)
  const handleConfirmDelivery = async () => {
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .rpc('confirm_delivery', {
          p_transaction_id: transaction.transaction_id
        });

      if (error) throw error;

      if (data.success) {
        toast.success('✅ Recebimento confirmado!', {
          description: 'Agora avalie sua experiência',
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
        
        // Abrir modal de review ANTES de atualizar dados
        setShowReviewModal(true);
        
        // Atualizar dados apenas após fechar o modal (não agora)
        // onDeliveryConfirmed será chamado quando o modal for fechado
      } else {
        toast.error(data.message, {
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
    } catch (error) {
      console.error('Erro ao confirmar entrega:', error);
      toast.error('Erro ao confirmar recebimento', {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDispute = async () => {
    const reason = window.prompt('Descreva o problema para abrir a disputa:');
    if (!reason || !reason.trim()) return;

    setIsDisputeSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('open_dispute', {
        p_transaction_id: transaction.transaction_id,
        p_reason: reason.trim(),
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Disputa aberta', {
          description: 'Você pode acompanhar em /disputas',
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
      } else {
        toast.error(data?.message || 'Não foi possível abrir a disputa', {
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
    } catch (error) {
      console.error('Erro ao abrir disputa:', error);
      toast.error('Erro ao abrir disputa', {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setIsDisputeSubmitting(false);
    }
  };

  // Link para rastreamento nos Correios
  const getTrackingUrl = (code) => {
    if (!code) return null;
    // Formato Correios: BR123456789BR
    if (code.match(/^[A-Z]{2}\d{9}[A-Z]{2}$/i)) {
      return `https://rastreamento.correios.com.br/app/index.php?objeto=${code}`;
    }
    // Genérico
    return `https://www.google.com/search?q=rastrear+${code}`;
  };

  return (
    <>
      <div className="bg-black/20 border border-[#D4AF37]/10 rounded-lg overflow-hidden hover:border-[#D4AF37]/30 transition-all">
        {/* Header da Transação */}
        <div 
          className="p-4 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start gap-4">
            {/* Imagem do Item */}
            <div className="w-16 h-16 rounded-lg bg-[#0a0a0a] overflow-hidden flex-shrink-0">
              {transaction.item_image_url ? (
                <img 
                  src={transaction.item_image_url} 
                  alt={transaction.item_title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-[#D4AF37]/30" />
                </div>
              )}
            </div>

            {/* Detalhes */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h4 className="text-white font-bold text-sm truncate">
                    {transaction.item_title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1.5 text-xs text-white/60">
                      <User className="w-3.5 h-3.5" />
                      {otherUser.name}
                    </div>
                    <span className="text-white/40">•</span>
                    <div className="flex items-center gap-1.5 text-xs text-white/60">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(transaction.created_at)}
                    </div>
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0">
                  {type === 'sale' && transaction.net_amount ? (
                    <>
                      <p className="text-[#D4AF37] font-black text-lg" title="Valor Líquido a Receber">
                        R$ {parseFloat(transaction.net_amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-white/40 line-through" title="Valor Bruto da Venda">
                        R$ {parseFloat(transaction.price).toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="text-[#D4AF37] font-black text-lg">
                      R$ {parseFloat(transaction.price).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-3">
                <StatusBadge status={transaction.status} />
                
                {/* Timeline Compacto */}
                {['pago', 'pago_em_custodia', 'pago_custodia', 'enviado', 'concluido'].includes(transaction.status) && (
                  <div className="ml-4 flex-1 max-w-xs">
                    <CompactTimeline status={normalizedStatus} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Detalhes Expandidos */}
        {expanded && (
          <div className="border-t border-[#D4AF37]/10 p-4 space-y-4 bg-black/10">
            {/* Timeline Visual */}
            {['pago', 'pago_em_custodia', 'pago_custodia', 'enviado', 'concluido'].includes(transaction.status) && (
              <DeliveryTimeline transaction={{ ...transaction, status: normalizedStatus }} />
            )}

            {/* VENDEDOR: Gerar Etiqueta de Envio */}
            {type === 'sale' && ['pago', 'pago_em_custodia', 'pago_custodia'].includes(transaction.status) && !showShippingLabel && (
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-5 h-5 text-[#D4AF37]" />
                      <h4 className="text-white font-bold text-sm">
                        Próximo Passo: Gerar Etiqueta de Envio
                      </h4>
                    </div>
                    <p className="text-white/60 text-xs">
                      Gere a etiqueta com os dados do comprador e imprima para enviar
                    </p>
                  </div>
                  <button
                    onClick={() => setShowShippingLabel(true)}
                    className="px-6 py-3 bg-[#D4AF37] text-black font-black rounded-lg hover:bg-[#D4AF37]/90 transition-all shadow-lg hover:shadow-[#D4AF37]/50 flex items-center gap-2"
                  >
                    <Package className="w-5 h-5" />
                    GERAR ETIQUETA
                  </button>
                </div>
              </div>
            )}

            {/* VENDEDOR: Modal de Etiqueta de Envio */}
            {type === 'sale' && showShippingLabel && transaction.shipping_id && (
              <div className="space-y-4">
                <button
                  onClick={() => setShowShippingLabel(false)}
                  className="text-white/60 hover:text-white text-sm flex items-center gap-2"
                >
                  ← Voltar
                </button>
                <ShippingLabelCard 
                  transactionId={transaction.transaction_id}
                  shippingId={transaction.shipping_id}
                  onTrackingCodeSaved={() => {
                    setShowShippingLabel(false);
                    onTrackingAdded?.();
                  }}
                />
              </div>
            )}

            {/* VENDEDOR: Adicionar Código de Rastreio */}
            {type === 'sale' && ['pago', 'pago_em_custodia', 'pago_custodia'].includes(transaction.status) && !transaction.tracking_code && !showShippingLabel && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-5 h-5 text-blue-400" />
                  <h4 className="text-white font-bold text-sm">
                    Ou Adicionar Código de Rastreio Manualmente
                  </h4>
                </div>
                
                <form onSubmit={handleAddTracking} className="flex gap-2">
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                    placeholder="BR123456789PT"
                    className="flex-1 px-3 py-2 bg-black border border-blue-500/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 text-sm"
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Enviar
                  </button>
                </form>
              </div>
            )}

            {/* Exibir Código de Rastreio */}
            {transaction.tracking_code && transaction.status !== 'concluido' && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-5 h-5 text-purple-400" />
                      <h4 className="text-white font-bold text-sm">
                        Código de Rastreio
                      </h4>
                    </div>
                    <p className="text-purple-400 font-mono text-lg font-bold">
                      {transaction.tracking_code}
                    </p>
                    {transaction.shipped_at && (
                      <p className="text-white/60 text-xs mt-1">
                        Enviado em {formatDate(transaction.shipped_at)}
                      </p>
                    )}
                  </div>
                  
                  <a
                    href={getTrackingUrl(transaction.tracking_code)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Rastrear
                  </a>
                </div>
              </div>
            )}

            {/* Código de Rastreio - Após Conclusão */}
            {transaction.tracking_code && transaction.status === 'concluido' && (
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
                      <h4 className="text-white font-bold text-sm">
                        Entrega Confirmada
                      </h4>
                    </div>
                    <p className="text-white/60 text-xs">
                      Rastreamento finalizou com sucesso. Você confirmou o recebimento do produto.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* COMPRADOR: Confirmar Recebimento */}
            {type === 'purchase' && transaction.status === 'enviado' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <h4 className="text-white font-bold text-sm">
                        Recebeu o produto?
                      </h4>
                    </div>
                    <p className="text-white/60 text-xs">
                      Confirme o recebimento para avaliar o vendedor
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleOpenDispute}
                      disabled={isDisputeSubmitting || isSubmitting}
                      className="px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-300 font-black rounded-lg hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center gap-2"
                    >
                      {isDisputeSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <AlertCircle className="w-5 h-5" />
                      )}
                      ABRIR DISPUTA
                    </button>

                    <button
                      onClick={handleConfirmDelivery}
                      disabled={isSubmitting || isDisputeSubmitting}
                      className="px-6 py-3 bg-green-500 text-white font-black rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-green-500/50 flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}
                      CONFIRMAR RECEBIMENTO
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* COMPRADOR: Avaliar após conclusão */}
            {type === 'purchase' && transaction.status === 'concluido' && (
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-5 h-5 text-[#D4AF37]" />
                      <h4 className="text-white font-bold text-sm">
                        Avalie sua experiência
                      </h4>
                    </div>
                    <p className="text-white/60 text-xs">
                      Sua avaliação ajuda a comunidade
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="px-6 py-3 bg-[#D4AF37] text-black font-black rounded-lg hover:bg-[#D4AF37]/90 transition-all shadow-lg hover:shadow-[#D4AF37]/50 flex items-center gap-2"
                  >
                    <Star className="w-5 h-5" />
                    AVALIAR VENDEDOR
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Review */}
      {showReviewModal && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            // Atualizar dados APÓS fechar o modal
            onDeliveryConfirmed?.();
          }}
          transaction={transaction}
          reviewedUser={otherUser}
          onReviewSubmitted={() => {
            toast.success('Obrigado pela avaliação!', {
              style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
            });
          }}
        />
      )}
    </>
  );
}

// ========================================
// MODAL: Solicitação de Saque
// ========================================
export function WithdrawalModal({ isOpen, onClose, userProfile, availableBalance, hasActiveWithdrawal = false, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const withdrawalAmount = Number(availableBalance || 0);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (hasActiveWithdrawal) {
      toast.error('Você já possui um saque em análise', {
        description: 'Aguarde o processamento da solicitação atual para solicitar novamente.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    if (!withdrawalAmount || withdrawalAmount <= 0) {
      toast.error('Saldo indisponível para saque', {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    if (withdrawalAmount < 10) {
      toast.error('Valor mínimo para saque: R$ 10,00', {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    if (!userProfile?.pix_key) {
      toast.error('Cadastre uma chave PIX no perfil antes de solicitar saque', {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .rpc('create_withdrawal', {
          user_uuid: user.id,
          amount: withdrawalAmount,
          pix_key: userProfile.pix_key
        });

      if (error) throw error;

      const result = data?.[0];

      if (result?.success) {
        toast.success('🎉 Solicitação enviada!', {
          description: result.message,
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
        onSuccess?.();
        onClose();
      } else {
        toast.error(result?.message || 'Não foi possível solicitar o saque.', {
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
    } catch (error) {
      console.error('Erro ao solicitar saque:', error);
      toast.error('Erro ao processar saque: ' + error.message, {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#050505] border border-[#D4AF37]/30 rounded-lg w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[#D4AF37]/20">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-[#D4AF37]" />
            <h2 className="text-xl font-bold text-white">Solicitar Saque</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4">
            <p className="text-[#D4AF37]/70 text-xs uppercase font-bold mb-1">
              Saldo Disponível
            </p>
            <p className="text-[#D4AF37] font-black text-2xl">
              R$ {availableBalance.toFixed(2)}
            </p>
          </div>

          <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-4">
            <p className="text-xs text-white/50 uppercase font-bold tracking-widest mb-2">
              Valor do Saque (Automático)
            </p>
            <p className="text-[#D4AF37] font-black text-xl">
              R$ {withdrawalAmount.toFixed(2)}
            </p>
            <p className="text-xs text-white/40 mt-2">
              O sistema sempre solicita o saque do saldo total disponível (sem fracionamento).
            </p>
          </div>

          <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-[#D4AF37]" />
              <p className="text-white/80 text-sm font-medium">
                Chave PIX para Recebimento
              </p>
            </div>
            {userProfile?.pix_key ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">
                    {getPixTypeIcon(validatePixKey(userProfile.pix_key).type)}
                  </span>
                  <p className="text-[#D4AF37] font-mono text-sm break-all">
                    {maskPixKeyDisplay(userProfile.pix_key)}
                  </p>
                </div>
                <p className="text-white/40 text-xs">
                  {validatePixKey(userProfile.pix_key).message}
                </p>
              </>
            ) : (
              <p className="text-red-400 text-sm font-semibold">
                ⚠️ Nenhuma chave PIX cadastrada
              </p>
            )}
            <p className="text-white/40 text-xs mt-2">
              O valor será transferido para esta chave em até 2 dias úteis
            </p>
          </div>

          <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200">
              <p className="font-bold mb-1">Importante:</p>
              <ul className="space-y-1 text-blue-300/80">
                <li>• Processamento em até 2 dias úteis</li>
                <li>• Apenas chaves PIX cadastradas no seu CPF</li>
                <li>• Taxa de saque: R$ 0,00</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-[#D4AF37]/30 rounded-lg text-gray-300 hover:bg-[#D4AF37]/10 transition-colors"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || hasActiveWithdrawal || withdrawalAmount < 10 || !userProfile?.pix_key}
              className="flex-1 px-4 py-3 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#D4AF37]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando...
                </>
              ) : hasActiveWithdrawal ? (
                <>
                  <Clock className="w-4 h-4" />
                  Saque em análise
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Solicitar Saque Total
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========================================
// DASHBOARD PRINCIPAL: Container completo
// ========================================
export function FinancialDashboard({ userId }) {
  const [financials, setFinancials] = useState(null);
  const [receivables, setReceivables] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [activeWithdrawal, setActiveWithdrawal] = useState(null);
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'purchases'

  React.useEffect(() => {
    loadFinancialData();
  }, [userId]);

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      // Carregar dados financeiros
      const { data: finData, error: finError } = await supabase
        .rpc('get_user_financials', { user_uuid: userId })
        .single();

      if (finError) throw finError;
      setFinancials(finData);

      // Carregar recebíveis (vendas)
      const { data: recData, error: recError } = await supabase
        .rpc('get_user_receivables', { user_uuid: userId, limit_rows: 5 });

      if (recError) throw recError;
      setReceivables(recData || []);

      // Carregar compras
      const { data: purData, error: purError } = await supabase
        .rpc('get_user_purchases', { user_uuid: userId, limit_rows: 5 });

      if (purError) throw purError;
      setPurchases(purData || []);

      // Carregar perfil do usuário
      const { data: profileData } = await supabase
        .from('profiles')
        .select('pix_key')
        .eq('id', userId)
        .single();

      setUserProfile(profileData);

      const { data: activeWithdrawalData, error: activeWithdrawalError } = await supabase
        .from('withdrawals')
        .select('id, status, amount, requested_at')
        .eq('user_id', userId)
        .in('status', ['pendente', 'processando'])
        .order('requested_at', { ascending: false })
        .limit(1);

      if (activeWithdrawalError) throw activeWithdrawalError;
      setActiveWithdrawal(activeWithdrawalData?.[0] || null);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
      toast.error('Erro ao carregar dados financeiros', {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FinanceMetricCard
          title="Saldo Disponível"
          value={`R$ ${(financials?.saldo_disponivel || 0).toFixed(2)}`}
          subtitle={`${financials?.vendas_concluidas || 0} vendas concluídas`}
          icon={DollarSign}
          color="gold"
        />
        
        <FinanceMetricCard
          title="Vendas em Andamento"
          value={financials?.vendas_em_andamento || 0}
          subtitle={`R$ ${(financials?.saldo_pendente || 0).toFixed(2)} pendente`}
          icon={ShoppingCart}
          color="blue"
        />
        
        <FinanceMetricCard
          title="Ticket Médio"
          value={`R$ ${(financials?.ticket_medio || 0).toFixed(2)}`}
          subtitle={`${financials?.total_vendas || 0} vendas no total`}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Botão de Saque */}
      {financials?.saldo_disponivel >= 10 && (
        <div className="flex justify-end">
          <button
            onClick={async () => {
              const { data: activeWithdrawalData, error: activeWithdrawalError } = await supabase
                .from('withdrawals')
                .select('id, status, amount, requested_at')
                .eq('user_id', userId)
                .in('status', ['pendente', 'processando'])
                .order('requested_at', { ascending: false })
                .limit(1);

              if (activeWithdrawalError) {
                toast.error('Erro ao validar solicitação de saque', {
                  description: activeWithdrawalError.message,
                  style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
                });
                return;
              }

              const existingActive = activeWithdrawalData?.[0] || null;
              setActiveWithdrawal(existingActive);

              if (existingActive) {
                toast.info('Você já possui um saque em análise', {
                  description: 'Aguarde a conclusão da solicitação atual para abrir uma nova.',
                  style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
                });
                return;
              }
              // Recarregar perfil antes de abrir modal
              const { data: profileData } = await supabase
                .from('profiles')
                .select('pix_key')
                .eq('id', userId)
                .single();
              setUserProfile(profileData);
              setShowWithdrawalModal(true);
            }}
            disabled={!!activeWithdrawal}
            className="flex items-center gap-2 px-6 py-3 bg-[#D4AF37] text-black font-bold rounded-lg hover:bg-[#D4AF37]/90 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#D4AF37] disabled:hover:shadow-none"
          >
            {activeWithdrawal ? <Clock className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
            {activeWithdrawal ? 'Saque em Análise' : 'Solicitar Saque'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#D4AF37]/20">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 font-bold text-sm transition-colors ${
            activeTab === 'sales'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Minhas Vendas ({receivables.length})
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2 font-bold text-sm transition-colors ${
            activeTab === 'purchases'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Minhas Compras ({purchases.length})
        </button>
      </div>

      {/* Lista de Transações */}
      <div className="space-y-3">
        {activeTab === 'sales' ? (
          receivables.length > 0 ? (
            receivables.map(transaction => (
              <TransactionRow 
                key={transaction.transaction_id} 
                transaction={transaction}
                type="sale"
                onTrackingAdded={loadFinancialData}
                onDeliveryConfirmed={loadFinancialData}
              />
            ))
          ) : (
            <div className="text-center py-12 text-white/40">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Você ainda não realizou vendas</p>
            </div>
          )
        ) : (
          purchases.length > 0 ? (
            purchases.map(transaction => (
              <TransactionRow 
                key={transaction.transaction_id} 
                transaction={transaction}
                type="purchase"
                onTrackingAdded={loadFinancialData}
                onDeliveryConfirmed={loadFinancialData}
              />
            ))
          ) : (
            <div className="text-center py-12 text-white/40">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Você ainda não realizou compras</p>
            </div>
          )
        )}
      </div>

      {/* Modal de Saque */}
      <WithdrawalModal
        isOpen={showWithdrawalModal}
        onClose={() => setShowWithdrawalModal(false)}
        userProfile={userProfile}
        availableBalance={financials?.saldo_disponivel || 0}
        hasActiveWithdrawal={!!activeWithdrawal}
        onSuccess={loadFinancialData}
      />
    </div>
  );
}
