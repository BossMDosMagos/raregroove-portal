import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Disc, Search, Shield, Users, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ItemCard } from '../components/ItemCard';
import { Pill } from '../components/UIComponents';
import AddItemModal from '../components/AddItemModal';
import { WishlistModal } from '../components/WishlistComponents';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';

export default function Catalogo() {
  const [currentUser, setCurrentUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    minPrice: '',
    maxPrice: ''
  });
  const { t } = useI18n();
  const { cartItem } = useCart();

  const fetchItems = async () => {
    setLoadingItems(true);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .neq('status', 'vendido')
      .eq('is_sold', false)
      .order('created_at', { ascending: false });
    if (!error) {
      let list = data || [];
      const expiredReserved = list.filter((i) => i.status === 'reservado' && i.reserved_until && new Date(i.reserved_until).toISOString() < nowIso);
      if (expiredReserved.length > 0) {
        await Promise.allSettled(expiredReserved.map(async (i) => {
          const { error: rpcError } = await supabase.rpc('release_item_reservation', { item_uuid: i.id });
          if (!rpcError) return;
          await supabase.from('items').update({ status: 'disponivel', reserved_by: null, reserved_until: null }).eq('id', i.id);
        }));
        const releasedIds = new Set(expiredReserved.map((i) => i.id));
        list = list.map((i) => releasedIds.has(i.id) ? { ...i, status: 'disponivel', reserved_by: null, reserved_until: null } : i);
      }

      const visible = list.filter((i) => {
        if (i.status !== 'reservado') return true;
        if (cartItem?.itemId === i.id) return true;
        if (!i.reserved_until) return true;
        if (i.reserved_until && new Date(i.reserved_until).toISOString() < nowIso) return true;
        return false;
      });

      setItems(visible);
    }
    setLoadingItems(false);
  };

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(async ({ data }) => {
      setCurrentUser(data.user);

      if (data?.user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', data.user.id)
          .single();

        setIsAdmin(Boolean(profileData?.is_admin));
      }
    });

    // Fetch items from database
    const id = setTimeout(fetchItems, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = setInterval(fetchItems, 15000);
    return () => clearInterval(id);
  }, [cartItem?.itemId]);

  const filteredProducts = items.filter(product => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!product.title?.toLowerCase().includes(search) && 
          !product.artist?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (filters.minPrice && product.price < parseFloat(filters.minPrice)) return false;
    if (filters.maxPrice && product.price > parseFloat(filters.maxPrice)) return false;
    return true;
  });

  const clearFilters = () => {
    setFilters({
      search: '',
      minPrice: '',
      maxPrice: ''
    });
  };

  return (
    <div className="min-h-screen bg-charcoal-deep text-white py-12 px-4 md:px-8 pt-28 selection:bg-gold-premium/30 selection:text-gold-light">
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Luxury Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="space-y-4">
            <Pill color="gold">{t('catalog.title')}</Pill>
            <div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none text-luxury">
                {t('catalog.header')} <span className="text-gold-premium">{t('catalog.header.gold')}</span>
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <div className="h-[1px] w-8 bg-gold-premium/30"></div>
                <p className="text-silver-premium/60 text-sm font-medium tracking-wide">
                  {filteredProducts.length} {t('catalog.itemsAvailable') || 'CDs disponíveis para negociação'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {isAdmin && (
              <div className="flex gap-2">
                <Link
                  to="/admin"
                  className="group flex items-center justify-center gap-3 bg-charcoal-mid/50 text-gold-premium border border-gold-premium/20 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold-premium hover:text-charcoal-deep transition-all duration-500 shadow-xl"
                >
                  <Shield size={16} className="group-hover:rotate-12 transition-transform" /> {t('nav.admin.bank') || 'Banco RareGroove'}
                </Link>
                <Link
                  to="/admin/users"
                  className="group flex items-center justify-center gap-3 bg-charcoal-mid/50 text-info border border-info/20 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-info hover:text-white transition-all duration-500 shadow-xl"
                >
                  <Users size={16} className="group-hover:scale-110 transition-transform" /> {t('nav.admin.profiles') || 'Gestor de Perfis'}
                </Link>
              </div>
            )}
            <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-3 bg-gold-premium text-charcoal-deep px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:scale-105 transition-all duration-500">
              <Plus size={18} /> {t('catalog.actions.add') || 'Anunciar Relíquia'}
            </button>
          </div>
        </div>

        {/* Professional Filters */}
        <div className="glass-card rounded-[2.5rem] p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/60 ml-1">
                <Search size={12} /> {t('catalog.filters.searchLabel')}
              </label>
              <input 
                type="text"
                placeholder={t('catalog.filters.searchPlaceholder')}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full bg-charcoal-deep/50 border border-gold-premium/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-4 focus:ring-gold-premium/5 transition-all duration-300 placeholder:text-white/10"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/60 ml-1">
                {t('catalog.filters.minPrice')}
              </label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gold-premium/40 text-xs font-bold">R$</span>
                <input 
                  type="number"
                  placeholder="0"
                  value={filters.minPrice}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  className="w-full bg-charcoal-deep/50 border border-gold-premium/10 rounded-2xl pl-12 pr-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-4 focus:ring-gold-premium/5 transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/60 ml-1">
                {t('catalog.filters.maxPrice')}
              </label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gold-premium/40 text-xs font-bold">R$</span>
                <input 
                  type="number"
                  placeholder="99999"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  className="w-full bg-charcoal-deep/50 border border-gold-premium/10 rounded-2xl pl-12 pr-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-4 focus:ring-gold-premium/5 transition-all duration-300"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button 
                onClick={clearFilters}
                className="w-full py-4 bg-charcoal-mid/50 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-silver-premium/40 hover:text-gold-premium hover:border-gold-premium/30 hover:bg-gold-premium/5 transition-all duration-500 shadow-lg"
              >
                {t('catalog.actions.clearFilters')}
              </button>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {loadingItems ? (
          <div className="flex h-96 items-center justify-center">
            <div className="relative">
              <Loader2 className="animate-spin text-gold-premium opacity-20" size={64} />
              <Disc className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gold-premium animate-pulse" size={32} />
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="glass-card rounded-[3rem] p-24 text-center animate-in fade-in zoom-in-95 duration-1000 border-dashed border-2 border-gold-premium/20">
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-[2.5rem] bg-gold-premium/5 border border-gold-premium/10 mb-8 shadow-inner">
              <Disc size={56} className="text-gold-premium/20 animate-spin-slow" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">{t('catalog.empty.title')}</h2>
            <p className="text-silver-premium/40 mb-10 max-w-md mx-auto text-sm leading-relaxed uppercase tracking-widest font-medium">
              {filters.search 
                ? `${t('catalog.empty.noneFound')} "${filters.search}" ${t('catalog.empty.inCollection')}`
                : t('catalog.empty.suggestion')
              }
            </p>
            {filters.search && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={clearFilters}
                  className="px-8 py-4 glass-card border-gold-premium/20 text-gold-premium/60 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-gold-premium hover:border-gold-premium transition-all duration-500"
                >
                  {t('catalog.actions.clearFilters')}
                </button>
                <button
                  onClick={() => setShowWishlistModal(true)}
                  className="flex items-center gap-3 px-8 py-4 bg-gold-premium text-charcoal-deep font-black rounded-2xl text-[10px] uppercase tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all duration-500"
                >
                  <Heart className="w-4 h-4" />
                  {t('catalog.actions.addToWishlist')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredProducts.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      <AddItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onRefresh={fetchItems} 
      />
      
      <WishlistModal
        isOpen={showWishlistModal}
        onClose={() => setShowWishlistModal(false)}
        editingWish={filters.search ? { item_name: filters.search } : null}
        onWishAdded={() => {
          setShowWishlistModal(false);
        }}
      />
    </div>
  );
}
