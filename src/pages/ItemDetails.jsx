import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Avatar from '../components/Avatar';
import SwapProposalModal from '../components/SwapProposalModal';
import { RatingDisplay, EliteBadge } from '../components/RatingComponents';
import { Disc, MessageSquare, ShieldCheck, ArrowLeft, Heart, Share2, Tag, Calendar, Music, Loader2, ShoppingCart, Check } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeMessage, isMessageEmptyAfterSanitize, isMessageTooShort, hasSuspiciousPattern } from '../utils/sanitizeMessage';
import { useI18n } from '../contexts/I18nContext.jsx';
import { Pill } from '../components/UIComponents';
import { useCart } from '../contexts/CartContext.jsx';
import { formatRemaining } from '../utils/time.js';

export default function ItemDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, formatCurrency } = useI18n();
  const { addToCart, cartItems, remainingText, setOpen } = useCart();
  const [item, setItem] = useState(null);
  const [seller, setSeller] = useState(null);
  const [sellerRating, setSellerRating] = useState(null);
  const [isElite, setIsElite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isInWishlist, setIsInWishlist] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      // Buscar usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Buscar o item
      let { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single();

      if (itemError) {
        toast.error(t('item.notFound') || 'ITEM NÃO ENCONTRADO', {
          description: t('item.notFoundDesc') || 'Esta relíquia não foi localizada',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        navigate('/catalogo');
        setLoading(false);
        return;
      }

      if (itemData?.status === 'reservado' && itemData?.reserved_until) {
        const untilMs = new Date(itemData.reserved_until).getTime();
        if (Number.isFinite(untilMs) && untilMs <= Date.now()) {
          const { error: rpcError } = await supabase.rpc('release_item_reservation', { item_uuid: itemData.id });
          if (rpcError) {
            await supabase
              .from('items')
              .update({ status: 'disponivel', reserved_by: null, reserved_until: null })
              .eq('id', itemData.id);
          }

          const refreshed = await supabase
            .from('items')
            .select('*')
            .eq('id', id)
            .single();

          if (refreshed?.data) itemData = refreshed.data;
        }
      }

      if (itemData?.metadata?.description) {
        itemData.description = itemData.metadata.description;
      }

      setItem(itemData);

      // Verificar wishlist
      try {
        const wishlist = JSON.parse(localStorage.getItem('rg_wishlist') || '[]');
        setIsInWishlist(Array.isArray(wishlist) && wishlist.includes(itemData.id));
      } catch {
        setIsInWishlist(false);
      }

      // Buscar o perfil do vendedor
      if (itemData?.seller_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, status, suspension_end')
          .eq('id', itemData.seller_id)
          .single();

        // Verificar se vendedor está ativo
        if (profileData?.status === 'banned') {
          toast.error('VENDEDOR BLOQUEADO', {
            description: 'Este vendedor está temporariamente suspenso.',
            style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
          });
          navigate('/catalogo');
          return;
        }

        if (profileData?.status === 'suspended' && profileData?.suspension_end) {
          const suspendEnd = new Date(profileData.suspension_end);
          if (suspendEnd > new Date()) {
            toast.error('VENDEDOR SUSPENSO', {
              description: 'Este vendedor está temporariamente suspenso.',
              style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
            });
            navigate('/catalogo');
            return;
          }
        }

        setSeller(profileData);

        // Buscar rating do vendedor
        const { data: ratingData } = await supabase
          .rpc('get_user_rating', { user_uuid: itemData.seller_id })
          .single();

        setSellerRating(ratingData);

        // Verificar se é Elite Seller (com guarda de segurança)
        const sellerId = itemData.seller_id;
        if (sellerId) {
          try {
            const { data: eliteData, error } = await supabase
              .rpc('is_elite_seller', { user_uuid: sellerId });
            
            if (error) {
              if (error.code !== 'PGRST202' && error.code !== '42883') {
                setIsElite(false);
              }
            } else {
              setIsElite(Boolean(eliteData?.is_elite));
            }
          } catch (e) {
            setIsElite(false);
          }
        } else {
          setIsElite(false);
        }
      }

      setLoading(false);
    };

    fetchItem();
  }, [id, navigate, t]);

  const toggleWishlist = () => {
    if (!item) return;
    const wishlist = JSON.parse(localStorage.getItem('rg_wishlist') || '[]');
    
    if (isInWishlist) {
      const updatedWishlist = wishlist.filter(wishId => wishId !== item.id);
      localStorage.setItem('rg_wishlist', JSON.stringify(updatedWishlist));
      setIsInWishlist(false);
      toast.success(t('catalog.actions.removedFromWishlist'));
    } else {
      wishlist.push(item.id);
      localStorage.setItem('rg_wishlist', JSON.stringify(wishlist));
      setIsInWishlist(true);
      toast.success(t('catalog.actions.addedToWishlist'));
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copiado para a área de transferência');
  };

  const handleSendProposal = async () => {
    if (!item) return;

    try {
      setSending(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Faça login para enviar propostas');
        return;
      }

      if (user.id === item.seller_id) {
        toast.error('Você não pode enviar mensagem para si mesmo');
        return;
      }

      if (isMessageEmptyAfterSanitize(message)) {
        toast.error('Mensagem vazia ou inválida');
        return;
      }

      const safeMessage = sanitizeMessage(message).trim();

      const { error } = await supabase.from('messages').insert([
        {
          sender_id: user.id,
          receiver_id: item.seller_id,
          item_id: item.id,
          content: safeMessage
        }
      ]);

      if (error) throw error;

      toast.success('Proposta enviada com sucesso!');
      setMessage('');
    } catch (error) {
      toast.error('Erro ao enviar proposta');
    } finally {
      setSending(false);
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

  const reservedUntilMs = item?.reserved_until ? new Date(item.reserved_until).getTime() : null;
  const reserveRemainingMs = reservedUntilMs ? reservedUntilMs - Date.now() : null;
  const reserveActive = Boolean(item?.status === 'reservado' && typeof reserveRemainingMs === 'number' && reserveRemainingMs > 0);
  const reserveTextFromDb = reserveActive ? formatRemaining(reserveRemainingMs) : null;

  let localCart = null;
  try {
    localCart = JSON.parse(localStorage.getItem('rg_cart_v1') || 'null');
  } catch {
    localCart = null;
  }

  const localReserveForThis = Boolean(localCart?.itemId === item?.id && Number(localCart?.reservedUntilMs || 0) > Date.now());
  const reservedByMe = reserveActive && item?.reserved_by && currentUser?.id && item.reserved_by === currentUser.id;
  const reservedByOther = reserveActive && item?.reserved_by && currentUser?.id && item.reserved_by !== currentUser.id;
  const reservedUnknown = reserveActive && !item?.reserved_by;
  const blockedByReserve = item?.allow_sale && item?.status === 'reservado' && !reservedByMe && !localReserveForThis && (reservedByOther || reservedUnknown);

  return (
    <div className="min-h-screen bg-charcoal-deep text-white py-12 px-4 md:px-8 pt-28 selection:bg-gold-premium/30 selection:text-gold-light">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-gold-premium/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-charcoal-light/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Navigation & Actions Header */}
        <div className="flex justify-between items-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-3 text-silver-premium/60 hover:text-gold-premium transition-colors group"
          >
            <div className="p-2 rounded-full border border-white/5 bg-white/5 group-hover:border-gold-premium/30 group-hover:bg-gold-premium/10 transition-all">
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">{t('messages.backToCatalog') || 'VOLTAR'}</span>
          </button>

          <div className="flex gap-4">
            <button 
              onClick={toggleWishlist}
              className={`p-3 rounded-2xl border transition-all duration-300 ${
                isInWishlist 
                  ? 'bg-gold-premium text-charcoal-deep border-gold-premium shadow-[0_0_20px_rgba(212,175,55,0.3)]' 
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-gold-premium/30 hover:bg-gold-premium/5'
              }`}
            >
              <Heart size={20} className={isInWishlist ? 'fill-current' : ''} />
            </button>
            <button 
              onClick={handleShare}
              className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-gold-premium/30 hover:bg-gold-premium/5 transition-all duration-300"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left Column: Image (5 cols) */}
          <div className="lg:col-span-5 space-y-8 animate-in fade-in slide-in-from-left-4 duration-1000 delay-100">
            <div className="relative group perspective-1000">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-gold-premium/30 to-charcoal-light rounded-[2.5rem] blur opacity-30 group-hover:opacity-60 transition duration-1000 animate-pulse-slow"></div>
              
              <div className="relative aspect-square rounded-[2.5rem] overflow-hidden border border-white/10 bg-charcoal-mid shadow-2xl transform transition-transform duration-700 group-hover:scale-[1.02] group-hover:rotate-1">
                {/* Badges on Image */}
                <div className="absolute top-6 left-6 z-20 flex flex-col gap-3 items-start">
                  <div className="flex items-center gap-2 px-4 py-2 bg-charcoal-deep/80 backdrop-blur-md border border-gold-premium/20 rounded-xl shadow-lg">
                    <Disc size={14} className="text-gold-premium" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gold-premium">
                      {item?.condition}
                    </span>
                  </div>
                  {item?.year && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl shadow-lg">
                      <Calendar size={14} className="text-white/60" />
                      <span className="text-[10px] font-bold text-white/80">
                        {item.year}
                      </span>
                    </div>
                  )}
                </div>

                {item?.image_url ? (
                  <img 
                    src={item.image_url} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-charcoal-mid">
                    <Disc size={100} className="text-white/5 animate-spin-slow" />
                  </div>
                )}

                {/* Status Overlay */}
                {item?.status === 'vendido' && (
                  <div className="absolute inset-0 bg-charcoal-deep/90 backdrop-blur-md z-30 flex items-center justify-center">
                    <div className="border-2 border-danger/50 bg-danger/10 px-10 py-6 rounded-2xl rotate-[-5deg] shadow-2xl backdrop-blur-xl">
                      <p className="text-danger font-black text-3xl uppercase tracking-[0.3em] drop-shadow-lg">{t('paymentSuccess.sold') || 'VENDIDO'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description Card */}
            <div className="glass-card p-8 rounded-3xl border-white/5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-silver-premium/40 flex items-center gap-2">
                <Tag size={14} /> Sobre a Relíquia
              </h3>
              <p className="text-sm text-silver-premium/70 leading-relaxed font-medium">
                {item?.description || "Nenhuma descrição fornecida pelo vendedor."}
              </p>
              {item?.genre && (
                <div className="pt-4 border-t border-white/5 flex gap-2">
                  <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] uppercase tracking-wider font-bold text-silver-premium/60 flex items-center gap-2">
                    <Music size={12} /> {item.genre}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Details & Actions (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-center animate-in fade-in slide-in-from-right-4 duration-1000 delay-200">
            <div className="mb-10">
              <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase mb-4 text-white leading-[0.9]">
                {item?.title}
              </h1>
              <h2 className="text-2xl md:text-3xl text-gold-premium/80 font-medium uppercase tracking-tight flex items-center gap-4">
                {item?.artist}
                <div className="h-[1px] flex-1 bg-gradient-to-r from-gold-premium/30 to-transparent"></div>
              </h2>
            </div>

            {/* Price & Seller Card */}
            <div className="glass-card rounded-[2.5rem] p-8 md:p-10 border-gold-premium/10 shadow-2xl relative overflow-hidden mb-8">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gold-premium/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-8 relative z-10">
                <div className="space-y-2">
                  <span className="text-silver-premium/40 text-[10px] uppercase font-black tracking-[0.3em]">
                    {t('item.priceLabel') || 'VALOR DE MERCADO'}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl md:text-6xl font-black text-white tracking-tighter">
                      {formatCurrency ? formatCurrency(item?.price) : `R$ ${item?.price}`}
                    </span>
                  </div>
                </div>
                
                {/* Seller Info */}
                <div className="flex items-center gap-4 bg-charcoal-deep/50 p-4 rounded-2xl border border-white/5">
                  <Avatar 
                    src={seller?.avatar_url} 
                    name={seller?.full_name}
                    size="md"
                    goldBorder={isElite}
                    showEliteBadge={isElite}
                    isElite={isElite}
                  />
                  <div>
                    <p className="text-[9px] text-silver-premium/40 uppercase font-black tracking-wider mb-0.5">
                      {t('item.sellerLabel') || 'ACERVO DE'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold uppercase text-white">
                        {seller?.full_name || 'Colecionador Anônimo'}
                      </p>
                      {isElite && <EliteBadge isElite={isElite} size="sm" />}
                    </div>
                    {sellerRating && (
                      <RatingDisplay 
                        rating={sellerRating.avg_rating} 
                        totalReviews={sellerRating.total_reviews}
                        size="xs"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {(cartItems.some(ci => ci.itemId === item?.id) || reservedByMe || localReserveForThis) && (
                <div className="mb-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl px-5 py-4 flex items-center justify-between">
                  <p className="text-orange-200 text-[10px] font-black uppercase tracking-[0.25em]">Reserva garantida por:</p>
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="text-orange-200 font-black text-sm tabular-nums hover:text-white transition-colors"
                  >
                    {remainingText || (localReserveForThis ? formatRemaining(Number(localCart?.reservedUntilMs || 0) - Date.now()) : reserveTextFromDb) || '00:00'}
                  </button>
                </div>
              )}
              {blockedByReserve && (
                <div className="mb-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.25em]">Reservado por outro colecionador</p>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.25em] mt-1 tabular-nums">
                      {reserveTextFromDb ? `Volta em ${reserveTextFromDb}` : 'Indisponível no momento'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/catalogo')}
                    className="px-4 py-3 rounded-xl bg-gold-premium text-charcoal-deep font-black uppercase tracking-widest text-[10px] hover:shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all"
                  >
                    Voltar
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8 border-t border-white/5 relative z-10">
                {item?.allow_sale && (
                  <button 
                    onClick={async () => {
                      if (!currentUser) {
                        toast.error(t('auth.required') || 'Faça login para continuar');
                        navigate('/');
                        return;
                      }
                      if (currentUser.id === item.seller_id) {
                        toast.error(t('item.ownItemError') || 'Você não pode comprar seu próprio item');
                        return;
                      }
                      if (blockedByReserve) {
                        toast.error('ITEM RESERVADO', {
                          description: 'Outro colecionador está com reserva ativa.',
                          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
                        });
                        return;
                      }
                      const reserved = await addToCart(item.id);
                      if (reserved) navigate(`/checkout/${item.id}`);
                    }}
                    disabled={blockedByReserve}
                    className={`group relative overflow-hidden py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all duration-500 ${
                      blockedByReserve
                        ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'
                        : 'bg-gold-premium text-charcoal-deep hover:shadow-[0_0_40px_rgba(212,175,55,0.4)]'
                    }`}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      <Tag size={16} /> {blockedByReserve ? 'RESERVADO' : (t('item.buyAction') || 'COMPRAR AGORA')}
                    </span>
                    {!blockedByReserve && (
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                    )}
                  </button>
                )}

                <button
                  onClick={() => {
                    if (!currentUser) {
                      toast.error(t('auth.required') || 'Faça login para continuar');
                      navigate('/');
                      return;
                    }
                    if (currentUser.id === item.seller_id) {
                      toast.error('Você não pode adicionar seu próprio item');
                      return;
                    }
                    addToCart(item);
                    toast.success('Item adicionado ao carrinho!', {
                      description: item.title,
                      action: {
                        label: 'Ver carrinho',
                        onClick: () => navigate('/checkout'),
                      },
                    });
                  }}
                  className="group relative overflow-hidden py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all duration-500 border bg-charcoal-mid border-gold-premium/30 text-white hover:border-gold-premium hover:text-gold-premium hover:bg-charcoal-deep"
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    <ShoppingCart size={16} /> ADICIONAR AO CARRINHO
                  </span>
                  <div className="absolute inset-0 bg-gold-premium/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                </button>
                
                <button 
                  onClick={() => {
                    if (!currentUser) {
                      toast.error(t('auth.required') || 'Faça login para continuar');
                      navigate('/');
                      return;
                    }
                    if (currentUser.id === item.seller_id) {
                      toast.error(t('item.ownItemError') || 'Você não pode trocar com seu próprio item');
                      return;
                    }
                    setSwapModalOpen(true);
                  }}
                  disabled={!item?.allow_swap}
                  className={`group relative overflow-hidden py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all duration-500 border flex items-center justify-center gap-3 ${
                    item?.allow_swap 
                    ? 'bg-charcoal-mid border-gold-premium/30 text-white hover:border-gold-premium hover:text-gold-premium hover:bg-charcoal-deep' 
                    : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Disc size={16} className={item?.allow_swap ? "group-hover:rotate-180 transition-transform duration-700" : ""} />
                  {t('item.swapAction') || 'PROPOR TROCA'}
                </button>
              </div>
            </div>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-3 opacity-40 mb-8 hover:opacity-100 transition-opacity duration-500">
              <ShieldCheck size={14} className="text-gold-premium" />
              <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-silver-premium">
                {t('item.protectedTransaction') || 'Transação Protegida pelo Protocolo Rare Groove'}
              </p>
            </div>

            {/* Chat Proposal Section */}
            <div className="glass-card border-white/5 rounded-3xl p-1">
              <div className="bg-charcoal-deep/50 rounded-[1.3rem] p-6">
                <label className="text-[10px] text-gold-premium/60 uppercase font-black tracking-[0.2em] flex items-center gap-2 mb-4">
                  <MessageSquare size={12} /> {t('item.chatTitle') || 'NEGOCIAÇÃO DIRETA'}
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-charcoal-mid/50 border border-white/5 rounded-xl px-5 py-4 text-sm text-white focus:border-gold-premium/30 focus:bg-charcoal-mid focus:ring-1 focus:ring-gold-premium/10 outline-none transition-all resize-none placeholder:text-white/10"
                    placeholder={t('item.chatPlaceholder') || "Olá, tenho interesse nessa relíquia..."}
                  />
                  <button
                    onClick={handleSendProposal}
                    disabled={sending}
                    className="absolute right-2 bottom-2 p-2 bg-gold-premium text-charcoal-deep rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                  >
                    {sending ? <Loader2 className="animate-spin" size={16} /> : <ArrowLeft size={16} className="rotate-180" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Swap Modal */}
      {item && currentUser && (
        <SwapProposalModal 
          isOpen={swapModalOpen}
          onClose={() => setSwapModalOpen(false)}
          item={item}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
}
