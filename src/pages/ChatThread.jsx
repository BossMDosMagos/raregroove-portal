import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Avatar from '../components/Avatar';
import { RatingDisplay, EliteBadge } from '../components/RatingComponents';
import { Disc, Send, Archive, Handshake, AlertTriangle, Loader2, X, CheckCircle2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Pill } from '../components/UIComponents';
import PaymentGateway from '../components/PaymentGateway';
import { sanitizeMessage, isMessageEmptyAfterSanitize, isMessageTooShort, hasSuspiciousPattern, detectPatternInHistory, isSpamming } from '../utils/sanitizeMessage';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { useI18n } from '../contexts/I18nContext.jsx';

export default function ChatThread() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { refreshUnreadCount } = useUnreadMessages();
  const { t } = useI18n();
  const [item, setItem] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [otherUserRating, setOtherUserRating] = useState(null);
  const [otherUserIsElite, setOtherUserIsElite] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [closingDeal, setClosingDeal] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState(null);
  const [dealConfirmData, setDealConfirmData] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Auto-scroll para o fim quando novas mensagens chegam
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (itemError) {
        toast.error('ITEM NÃO ENCONTRADO', {
          description: 'Esta relíquia não foi localizada',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        navigate('/mensagens');
        return;
      }

      setItem(itemData);

      // Verificar se existe transação ativa para este item
      const { data: transactionData } = await supabase
        .from('transactions')
        .select('*')
        .eq('item_id', itemId)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in('status', ['pendente', 'pago', 'enviado'])
        .single();

      if (transactionData) {
        setActiveTransaction(transactionData);
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('item_id', itemId)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (messagesError) {
        toast.error('ERRO AO CARREGAR', {
          description: 'Não foi possível carregar as mensagens',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      } else {
        setMessages(messagesData || []);
      }

      // Determinar o outro usuário da conversa
      let otherUserId;
      if (itemData.seller_id === user.id) {
        // Se o usuário atual é o vendedor, o outro usuário é o comprador
        // Procurar pela primeira mensagem enviada para este item
        const buyerMessage = messagesData?.find(m => m.sender_id !== user.id);
        otherUserId = buyerMessage?.sender_id;
      } else {
        // Se o usuário atual não é o vendedor, então o outro usuário é o vendedor
        otherUserId = itemData.seller_id;
      }

      if (otherUserId) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', otherUserId)
          .single();

        setOtherUser(profileData);

        // Buscar rating do outro usuário
        const { data: ratingData } = await supabase
          .rpc('get_user_rating', { user_uuid: otherUserId })
          .single();

        setOtherUserRating(ratingData);

        // Verificar se é Elite Seller (com guarda de segurança)
        if (otherUserId) {
          try {
            const { data: eliteData, error } = await supabase
              .rpc('is_elite_seller', { user_uuid: otherUserId });
            
            if (error) {
              if (error.code !== 'PGRST202' && error.code !== '42883') {
                setOtherUserIsElite(false);
              }
            } else {
              setOtherUserIsElite(Boolean(eliteData?.is_elite));
            }
          } catch (e) {
            setOtherUserIsElite(false);
          }
        } else {
          setOtherUserIsElite(false);
        }

        // Marcar mensagens como lidas onde o usuário atual é o receiver
        const { data: updatedMessages, error: updateError } = await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('item_id', itemId)
          .eq('receiver_id', user.id)
          .is('read_at', null)
          .select();
        
        if (updateError) {
          // Handle error silently
        }
      }

      setLoading(false);
    };

    loadData();
  }, [itemId]);

  const handleSendMessage = async () => {
    if (isMessageEmptyAfterSanitize(message)) {
      toast.error('MENSAGEM INVÁLIDA', {
        description: 'Sua mensagem não pôde ser enviada',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    // Proteção 1: Tamanho mínimo (evita spam de 1 caractere)
    if (isMessageTooShort(message, 2)) {
      toast.error('Mensagem muito curta', {
        description: 'Envie pelo menos 2 caracteres'
      });
      return;
    }

    // Proteção 2: Detectar padrões suspeitos isolados
    if (hasSuspiciousPattern(message)) {
      toast.error('Conteúdo suspeito bloqueado', {
        description: 'Não envie números, emails ou links fragmentados'
      });
      return;
    }

    // Proteção 3: Analisar histórico para detectar construção de contato
    const userRecentMessages = messages.filter(m => m.sender_id === currentUser.id).slice(-10);
    if (detectPatternInHistory([...userRecentMessages, { content: message }])) {
      toast.error('Padrão de contato detectado', {
        description: 'Não é permitido compartilhar telefone, email ou links'
      });
      return;
    }

    // Proteção 4: Rate limiting (anti-spam)
    if (isSpamming(userRecentMessages)) {
      toast.error('Muitas mensagens em pouco tempo', {
        description: 'Aguarde alguns segundos antes de enviar novamente'
      });
      return;
    }

    try {
      setSending(true);
      const safeMessage = sanitizeMessage(message).trim();

      const { data: newMessage, error } = await supabase.from('messages').insert([
        {
          sender_id: currentUser.id,
          receiver_id: otherUser.id,
          item_id: itemId,
          content: safeMessage
        }
      ]).select();

      if (error) {
        throw error;
      }

      setMessage('');
    } catch (error) {
      toast.error('ERRO AO ENVIAR', {
        description: 'Ocorreu um erro ao processar sua mensagem',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setSending(false);
    }
  };

  const handleArchiveConversation = async () => {
    try {
      setArchiving(true);
      
      const { error } = await supabase
        .from('archived_conversations')
        .insert([{
          user_id: currentUser.id,
          item_id: itemId
        }]);

      if (error) throw error;

      toast.success('Conversa arquivada', {
        description: 'Removida da sua lista. Acesse a aba "Arquivadas" para desarquivar.'
      });
      
      // Voltar para lista de mensagens
      navigate('/mensagens');
    } catch (error) {
      console.error('Erro ao arquivar:', error);
      toast.error('ERRO AO ARQUIVAR', {
        description: 'Não foi possível arquivar a conversa',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleCloseDeal = async () => {
    if (!otherUser?.id) {
      toast.error('COMPRADOR NÃO IDENTIFICADO', {
        description: 'Aguarde uma mensagem do comprador antes de fechar o negócio',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    // Verificar se há proposta de SWAP no chat
    const swapProposal = messages?.find(m => 
      m.content?.includes('PROPOSTA DE TROCA') || 
      m.content?.includes('🔄 PROPOSTA DE TROCA')
    );

    if (swapProposal) {
      toast.error('FLUXO DE TROCA ATIVO', {
        description: 'Há uma proposta de troca em andamento. Use o fluxo de troca específico para negociar.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    // Abrir modal de confirmação personalizado
    setDealConfirmData({
      buyerName: otherUser.full_name,
      itemTitle: item.title,
      price: item.price
    });
  };

  const confirmDealTransaction = async () => {
    if (!dealConfirmData) return;

    try {
      setClosingDeal(true);

      // Validar dados antes de prosseguir
      if (!currentUser?.id) {
        throw new Error('Usuário atual não autenticado');
      }
      if (!otherUser?.id) {
        throw new Error('Outro usuário não identificado - aguarde uma mensagem do comprador');
      }
      if (!itemId) {
        throw new Error('Item não identificado');
      }

      const profileIds = [currentUser.id, otherUser.id].filter(Boolean);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, cpf_cnpj, rg')
        .in('id', profileIds);

      if (profilesError) {
        throw profilesError;
      }

      const missingDocs = (profilesData || []).filter(
        (profile) => !profile.cpf_cnpj || !profile.rg
      );

      if (missingDocs.length > 0) {
        toast.error('CADASTRO INCOMPLETO', {
          description: 'Ambos usuarios precisam ter CPF/CNPJ e RG validados para fechar negocio',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        return;
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from('platform_settings')
        .select('sale_fee_pct, processing_fee_fixed')
        .eq('id', 1)
        .single();

      if (settingsError) {
        throw settingsError;
      }

      const saleFeePct = Number(settingsData?.sale_fee_pct || 0);
      const processingFee = Number(settingsData?.processing_fee_fixed || 0);
      const price = Number(item.price || 0);
      const platformFee = Number(((price * saleFeePct) / 100).toFixed(2));
      const gatewayFee = Number(processingFee.toFixed(2));
      const netAmount = Number((price - platformFee - gatewayFee).toFixed(2));
      const totalAmount = Number((price + platformFee + gatewayFee).toFixed(2));

      // 1. Criar transação
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          item_id: itemId,
          buyer_id: otherUser.id,
          seller_id: currentUser.id,
          price: item.price,
          status: 'pendente',
          transaction_type: 'venda',
          platform_fee: platformFee,
          gateway_fee: gatewayFee,
          net_amount: netAmount,
          total_amount: totalAmount
        }])
        .select()
        .single();

      if (transactionError) {
        throw transactionError;
      }

      // 2. Atualizar status do item para 'reservado'
      const { error: itemError } = await supabase
        .from('items')
        .update({ status: 'reservado' })
        .eq('id', itemId);

      if (itemError) {
        throw itemError;
      }

      // 3. Enviar mensagem automática do sistema
      const systemMessage = `🤝 [SISTEMA]: O vendedor aceitou sua proposta! Aguarde as instruções para pagamento.\n\n📦 Item: ${item.title}\n💰 Valor: R$ ${item.price}\n💳 Taxas: R$ ${platformFee.toFixed(2)} + R$ ${gatewayFee.toFixed(2)}\n✅ Total: R$ ${totalAmount.toFixed(2)}`;
      
      const { error: messageError } = await supabase.from('messages').insert([{
        sender_id: currentUser.id,
        receiver_id: otherUser.id,
        item_id: itemId,
        content: systemMessage
      }]);

      if (messageError) {
        // Não falha aqui - mensagem é apenas informativa
      }

      // 4. Atualizar estados locais
      setActiveTransaction(transactionData);
      setItem({ ...item, status: 'reservado' });

      toast.success('NEGÓCIO FECHADO', {
        description: 'Transação criada com sucesso. O item foi reservado.',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      setDealConfirmData(null);

    } catch (error) {
      // Construir mensagem de erro mais informativa
      let errorMessage = 'Há um problema ao processar este negócio';
      if (error?.message) {
        errorMessage = error.message;
      }
      if (error?.code === 'PGRST116') {
        errorMessage = 'Erro de permissão - RLS rejeitou a operação';
      }
      if (error?.code === '23502') {
        errorMessage = 'Campo obrigatório não preenchido';
      }
      if (error?.code === '23505') {
        errorMessage = 'Transação duplicada para este item';
      }

      toast.error('ERRO AO CRIAR TRANSAÇÃO', {
        description: errorMessage,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setClosingDeal(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-charcoal-deep flex items-center justify-center">
      <div className="relative">
        <Loader2 className="animate-spin text-gold-premium opacity-20" size={64} />
        <Disc className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gold-premium animate-pulse" size={32} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-charcoal-deep text-white px-4 md:px-8 py-12 pt-28 selection:bg-gold-premium/30 selection:text-gold-light">
      <div className="max-w-5xl mx-auto flex flex-col h-[85vh] gap-6 animate-in fade-in duration-1000">
        
        {/* Top Actions & Status */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/mensagens')}
              className="p-3 bg-charcoal-mid/50 border border-gold-premium/10 rounded-2xl text-gold-premium/60 hover:text-gold-premium hover:border-gold-premium/30 transition-all shadow-xl"
            >
              <X size={20} />
            </button>
            <Pill color="gold">{t('chat.badge') || 'NEGOCIAÇÃO EM CURSO'}</Pill>
          </div>

          <div className="flex items-center gap-3">
            {/* Botão Fechar Negócio - Apenas para o vendedor */}
            {item?.seller_id === currentUser?.id && !activeTransaction && otherUser && (
              <button
                onClick={handleCloseDeal}
                disabled={closingDeal}
                className="group flex items-center gap-3 bg-gold-premium text-charcoal-deep px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_25px_rgba(212,175,55,0.3)] hover:scale-105 transition-all duration-500 disabled:opacity-50 active:scale-95"
              >
                <Handshake size={16} className="group-hover:rotate-12 transition-transform" /> 
                {closingDeal ? t('chat.processing') || 'PROCESSANDO...' : t('chat.closeDeal') || 'FECHAR NEGÓCIO'}
              </button>
            )}

            {/* Badge de Transação Ativa */}
            {activeTransaction && (
              <div className="flex items-center gap-3 bg-success/10 text-success border border-success/30 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                <CheckCircle2 size={16} className="animate-pulse" /> {t('chat.activeTransaction') || 'NEGÓCIO FECHADO'}
              </div>
            )}

            <button
              onClick={handleArchiveConversation}
              disabled={archiving}
              className="flex items-center gap-3 bg-charcoal-mid/50 text-silver-premium/40 border border-white/5 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-danger hover:border-danger/20 hover:bg-danger/5 transition-all duration-500 disabled:opacity-50"
            >
              <Archive size={16} /> {archiving ? t('chat.archiving') || 'ARQUIVANDO...' : t('chat.archive') || 'ARQUIVAR'}
            </button>
          </div>
        </div>

        {/* Item & User Header Card */}
        <div className="glass-card rounded-[2.5rem] p-6 md:p-8 border-gold-premium/5 shadow-2xl relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-premium/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          
          <div className="flex flex-col md:flex-row items-center gap-8 relative">
            <div className="w-24 h-24 rounded-3xl overflow-hidden border border-gold-premium/20 shadow-2xl group shrink-0">
              {item?.image_url ? (
                <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-charcoal-mid/50">
                  <Disc size={40} className="text-gold-premium/20 animate-spin-slow" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left space-y-3 min-w-0">
              <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-luxury truncate leading-none">{item?.title}</h1>
                <p className="text-gold-premium font-black text-lg tracking-tight">R$ {item?.price}</p>
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 border-t border-gold-premium/5">
                <div className="flex items-center gap-3">
                  <Avatar 
                    src={otherUser?.avatar_url} 
                    name={otherUser?.full_name}
                    size="md"
                    className="rounded-full ring-2 ring-gold-premium/20"
                  />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-silver-premium/60 text-[10px] font-black uppercase tracking-widest">
                        {t('chat.header.talkingTo') || 'COM'} <span className="text-white">{otherUser?.full_name || 'Colecionador'}</span>
                      </p>
                      {otherUserIsElite && <EliteBadge isElite={otherUserIsElite} size="xs" />}
                    </div>
                    {otherUserRating && otherUserRating.total_reviews > 0 && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <RatingDisplay 
                          rating={otherUserRating.avg_rating} 
                          totalReviews={otherUserRating.total_reviews}
                          size="xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Messages Container */}
        <div 
          ref={messagesContainerRef} 
          className="flex-1 overflow-y-auto glass-card rounded-[2.5rem] p-6 md:p-10 border-gold-premium/5 shadow-inner space-y-8 no-scrollbar scroll-smooth bg-charcoal-deep/40 backdrop-blur-xl"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
              <div className="w-20 h-20 rounded-[2rem] bg-gold-premium/5 border border-gold-premium/10 flex items-center justify-center">
                <MessageSquare size={32} className="text-gold-premium" />
              </div>
              <p className="uppercase text-[10px] font-black tracking-[0.3em] max-w-xs">{t('chat.emptyPrompt') || 'INICIE A NEGOCIAÇÃO COM ESTE COLECIONADOR'}</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isSender = msg.sender_id === currentUser.id;
                const showAvatar = !isSender && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);
                
                return (
                  <div key={msg.id} className={`flex items-end gap-4 ${isSender ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                    {!isSender && (
                      <div className="w-10 h-10 shrink-0">
                        {showAvatar ? (
                          <Avatar 
                            src={otherUser?.avatar_url} 
                            name={otherUser?.full_name}
                            size="md"
                            className="rounded-full ring-2 ring-gold-premium/10"
                          />
                        ) : <div className="w-10" />}
                      </div>
                    )}
                    
                    <div className={`max-w-[80%] md:max-w-md rounded-3xl px-6 py-4 shadow-xl relative group/msg ${
                      isSender 
                        ? 'bg-gold-premium text-charcoal-deep rounded-br-none font-medium' 
                        : 'bg-charcoal-mid/50 text-white border border-gold-premium/10 rounded-bl-none'
                    }`}>
                      <p className="break-words text-sm md:text-base leading-relaxed">{msg.content}</p>
                      <div className={`flex items-center gap-2 mt-3 opacity-40 text-[9px] font-black uppercase tracking-widest ${
                        isSender ? 'text-charcoal-deep justify-end' : 'text-silver-premium/60 justify-start'
                      }`}>
                        <span>{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {isSender && <CheckCircle2 size={10} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="flex gap-4 p-2 bg-charcoal-mid/30 rounded-[2.5rem] border border-gold-premium/5 shadow-2xl shrink-0">
          <textarea
            rows={1}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 bg-transparent border-none rounded-3xl px-6 py-4 text-white focus:ring-0 outline-none transition-all resize-none text-sm md:text-base placeholder:text-silver-premium/20"
            placeholder={t('chat.input.placeholder') || 'Escreva sua mensagem...'}
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !message.trim()}
            className="w-14 h-14 bg-gold-premium text-charcoal-deep rounded-[1.5rem] font-black flex items-center justify-center hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all duration-500 disabled:opacity-30 disabled:grayscale group active:scale-95"
          >
            {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
          </button>
        </div>
      </div>

      {/* Modern Deal Confirmation Modal */}
      {dealConfirmData && (
        <div className="fixed inset-0 bg-charcoal-deep/90 backdrop-blur-xl flex items-center justify-center p-6 z-50 animate-in fade-in duration-500">
          <div className="glass-card rounded-[3rem] p-10 w-full max-w-lg shadow-[0_0_100px_rgba(212,175,55,0.1)] border-gold-premium/20 animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-gold-premium to-transparent opacity-50" />
            
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-[2.5rem] bg-gold-premium/5 border border-gold-premium/10 flex items-center justify-center shadow-inner group">
                <Handshake size={48} className="text-gold-premium group-hover:scale-110 transition-transform duration-500" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-luxury uppercase tracking-tighter leading-none">{t('chat.modal.title') || 'Confirmar Negócio'}</h3>
                <p className="text-gold-premium/60 text-[10px] font-black uppercase tracking-[0.2em]">{t('chat.modal.lead') || 'PROPOSTA ACEITA'}</p>
              </div>

              <div className="w-full bg-charcoal-deep/50 border border-gold-premium/5 rounded-[2rem] p-8 space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-gold-premium/5">
                  <span className="text-silver-premium/40 text-[10px] font-black uppercase tracking-widest">{t('chat.modal.buyer') || 'Comprador'}</span>
                  <span className="text-white font-bold tracking-tight">{dealConfirmData.buyerName}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-gold-premium/5">
                  <span className="text-silver-premium/40 text-[10px] font-black uppercase tracking-widest">Item</span>
                  <span className="text-white font-bold tracking-tight truncate ml-4">{dealConfirmData.itemTitle}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-silver-premium/40 text-[10px] font-black uppercase tracking-widest">Valor de Troca</span>
                  <span className="text-luxury font-black text-2xl">R$ {dealConfirmData.price}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-warning/5 border border-warning/10 rounded-2xl">
                <AlertTriangle size={16} className="text-warning shrink-0" />
                <p className="text-[10px] text-warning/70 font-bold uppercase tracking-widest text-left leading-relaxed">
                  Isso criará uma transação oficial e reservará o item. O comprador receberá as instruções para pagamento.
                </p>
              </div>

              <div className="flex w-full gap-4 pt-4">
                <button
                  onClick={() => setDealConfirmData(null)}
                  className="flex-1 py-5 glass-card border-gold-premium/20 text-silver-premium/40 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:text-gold-premium hover:border-gold-premium transition-all duration-500"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDealTransaction}
                  disabled={closingDeal}
                  className="flex-1 py-5 bg-gold-premium text-charcoal-deep rounded-2xl text-[11px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all duration-500 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {closingDeal ? <Loader2 size={18} className="animate-spin" /> : <Handshake size={18} />}
                  Confirmar Negócio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
