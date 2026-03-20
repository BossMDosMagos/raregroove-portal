import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Disc, Search, Music, Calendar, Play, Upload, Library, Sparkles, Crown, Gem, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ItemCard } from '../components/ItemCard';
import { Pill } from '../components/UIComponents';
import AddItemModal from '../components/AddItemModal';
import { useI18n } from '../contexts/I18nContext.jsx';

export default function Catalogo() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    genre: '',
    year: ''
  });
  const { t } = useI18n();

  const fetchItems = async () => {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('is_sold', false)
      .neq('status', 'vendido')
      .order('created_at', { ascending: false });
    
    if (!error) {
      const filtered = (data || []).filter(item => !item.metadata?.grooveflix);
      setItems(filtered);
    }
    setLoadingItems(false);
  };

  useEffect(() => {
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

    const id = setTimeout(fetchItems, 0);
    return () => clearTimeout(id);
  }, []);

  const filteredProducts = items.filter(product => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!product.title?.toLowerCase().includes(search) && 
          !product.artist?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (filters.genre && product.genre !== filters.genre) return false;
    if (filters.year && product.year !== parseInt(filters.year)) return false;
    return true;
  });

  const uniqueGenres = useMemo(() => {
    const genres = items.map(i => i.genre).filter(Boolean);
    return [...new Set(genres)].sort();
  }, [items]);

  const uniqueYears = useMemo(() => {
    const years = items.map(i => i.year).filter(Boolean);
    return [...new Set(years)].sort((a, b) => b - a);
  }, [items]);

  const clearFilters = () => {
    setFilters({
      search: '',
      genre: '',
      year: ''
    });
  };

  const handlePlay = (item) => {
    setCurrentlyPlaying(item.id);
    navigate(`/play/${item.id}`);
  };

  return (
    <div className="min-h-screen bg-charcoal-deep text-white selection:bg-gold-premium/30 selection:text-gold-light overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-gold-premium/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-40 right-[-200px] w-[500px] h-[500px] bg-gold-premium/3 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gold-premium/10 to-transparent" />
      </div>

      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 pt-28 pb-16 space-y-12">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
          <div className="relative">
            <div className="absolute -top-4 -left-2 w-20 h-20 bg-gold-premium/10 rounded-full blur-2xl" />
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-premium/10 border border-gold-premium/30">
                <Crown className="w-3 h-3 text-gold-premium" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-gold-premium">{t('catalog.title') || 'Catálogo Premium'}</span>
              </div>
            </div>
            <div className="relative">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase leading-none">
                <span className="bg-gradient-to-br from-white via-white to-gold-premium/50 bg-clip-text text-transparent">Rare</span>
                <span className="text-gold-premium">Groove</span>
              </h1>
              <div className="flex items-center gap-4 mt-4">
                <div className="h-[2px] w-16 bg-gradient-to-r from-gold-premium to-transparent" />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold-premium/10 border border-gold-premium/30 flex items-center justify-center">
                    <Library size={14} className="text-gold-premium" />
                  </div>
                  <span className="text-white/50 text-sm font-medium tracking-wide">
                    <span className="text-gold-premium font-bold">{filteredProducts.length}</span> {t('catalog.itemsAvailable') || ' Pérolas Disponíveis'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {isAdmin && (
              <Link
                to="/admin"
                className="group relative flex items-center justify-center gap-3 bg-charcoal-mid/30 text-gold-premium border border-gold-premium/20 px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold-premium hover:text-charcoal-deep transition-all duration-500 overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-gold-premium/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Upload size={16} className="relative z-10" /> 
                <span className="relative z-10">Admin</span>
              </Link>
            )}
            {currentUser && (
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="group relative flex items-center justify-center gap-3 bg-gradient-to-r from-gold-premium to-yellow-500 text-charcoal-deep px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-gold-premium opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Sparkles size={16} className="relative z-10 text-charcoal-deep" />
                <span className="relative z-10 flex items-center gap-2">
                  Adicionar <span className="hidden sm:inline">Item</span>
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="relative rounded-[2.5rem] p-1 bg-gradient-to-br from-gold-premium/20 via-charcoal-deep to-transparent">
          <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-gold-premium/5 to-transparent" />
          <div className="relative glass-card rounded-[2.5rem] p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="group space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/70 ml-1">
                  <Search size={12} /> Busca
                </label>
                <div className="relative">
                  <div className="absolute inset-0 bg-gold-premium/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <input 
                    type="text"
                    placeholder="Buscar por título ou artista..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="relative w-full bg-charcoal-deep/60 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-2 focus:ring-gold-premium/10 transition-all duration-300 placeholder:text-white/20"
                  />
                </div>
              </div>

              <div className="group space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/70 ml-1">
                  <Music size={12} /> Gênero
                </label>
                <div className="relative">
                  <select
                    value={filters.genre}
                    onChange={(e) => setFilters({ ...filters, genre: e.target.value })}
                    className="w-full bg-charcoal-deep/60 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-2 focus:ring-gold-premium/10 transition-all duration-300 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-charcoal-deep">Todos os Gêneros</option>
                    {uniqueGenres.map(genre => (
                      <option key={genre} value={genre} className="bg-charcoal-deep">{genre}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Gem size={14} className="text-gold-premium/50" />
                  </div>
                </div>
              </div>

              <div className="group space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/70 ml-1">
                  <Calendar size={12} /> Ano
                </label>
                <div className="relative">
                  <select
                    value={filters.year}
                    onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                    className="w-full bg-charcoal-deep/60 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-2 focus:ring-gold-premium/10 transition-all duration-300 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-charcoal-deep">Todos os Anos</option>
                    {uniqueYears.map(year => (
                      <option key={year} value={year} className="bg-charcoal-deep">{year}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Gem size={14} className="text-gold-premium/50" />
                  </div>
                </div>
              </div>

              <div className="flex items-end">
                <button 
                  onClick={clearFilters}
                  className="group w-full py-4 bg-gradient-to-r from-charcoal-mid/50 to-charcoal-deep/50 border border-white/5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white/40 hover:text-gold-premium hover:border-gold-premium/30 hover:bg-gold-premium/5 transition-all duration-500 flex items-center justify-center gap-2"
                >
                  <span className="w-4 h-4 rounded-full border border-current group-hover:bg-gold-premium/20 transition-colors" />
                  Limpar Filtros
                </button>
              </div>
            </div>
          </div>
        </div>

        {loadingItems ? (
          <div className="flex h-[60vh] items-center justify-center">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-2 border-gold-premium/10 border-t-gold-premium animate-spin" />
              <Disc className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gold-premium" size={32} />
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="relative rounded-[3rem] p-1 bg-gradient-to-br from-gold-premium/10 via-charcoal-deep to-transparent">
            <div className="glass-card rounded-[3rem] p-24 text-center border border-white/5">
              <div className="relative inline-flex items-center justify-center w-28 h-28 mb-8">
                <div className="absolute inset-0 bg-gold-premium/10 rounded-full animate-pulse" />
                <div className="w-20 h-20 rounded-full bg-gold-premium/5 border border-gold-premium/20 flex items-center justify-center">
                  <Disc size={48} className="text-gold-premium/30" />
                </div>
              </div>
              <h2 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">
                {filters.search ? 'Sem Resultados' : 'Vitrine Vazia'}
              </h2>
              <p className="text-white/40 mb-8 max-w-md mx-auto text-sm leading-relaxed uppercase tracking-widest font-medium">
                {filters.search 
                  ? `Nenhuma pérola encontrada para "${filters.search}"`
                  : 'Esta coleção ainda não tem tesouros. Seja o primeiro a adicionar!'
                }
              </p>
              {!currentUser && (
                <p className="text-gold-premium/60 text-xs tracking-widest uppercase">
                  Faça login para começar sua coleção
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gold-premium/20 to-transparent" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 pt-8">
              {filteredProducts.map((item, index) => (
                <div 
                  key={item.id} 
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <ItemCard item={item} onPlay={handlePlay} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onRefresh={fetchItems} 
      />
    </div>
  );
}
