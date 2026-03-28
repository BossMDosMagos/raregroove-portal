import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Disc, Edit3, Trash2, Eye, AlertTriangle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Pill } from '../components/UIComponents';
import AddItemModal from '../components/AddItemModal';
import { useI18n } from '../contexts/I18nContext.jsx';

export default function MyItems() {
  const { t, formatCurrency } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmData, setDeleteConfirmData] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const navigate = useNavigate();
  const confirmWord = t('myItems.delete.confirmWord');

  const fetchMyItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const filtered = (data || []).filter(item => {
        if (item.metadata?.source === 'catalog') return true;
        if (item.metadata?.source === 'grooveflix') return false;
        if (item.metadata?.grooveflix?.isAlbum === true) return false;
        return true;
      });
      setItems(filtered);
    } catch (error) {
      toast.error(t('myItems.toast.loadError.title'), {
        description: t('myItems.toast.loadError.desc'),
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyItems();
  }, []);

  useEffect(() => {
    const handleFocus = () => fetchMyItems();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleDelete = async (id) => {
    const itemToDelete = items.find(item => item.id === id);
    if (!itemToDelete) return;
    
    setDeleteConfirmData({
      id,
      title: itemToDelete.title,
      artist: itemToDelete.artist
    });
    setDeleteConfirmText('');
  };

  const confirmDelete = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== confirmWord) {
      toast.error(t('myItems.toast.invalidConfirm.title'), {
        description: t('myItems.toast.invalidConfirm.desc'),
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    try {
      // Buscar usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('myItems.errors.notAuthenticated'));

      // Buscar perfil para verificar role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;

      // Buscar item para verificar status/is_sold
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('status, is_sold')
        .eq('id', deleteConfirmData.id)
        .single();
      if (itemError) throw itemError;

      // Permitir exclusão de itens vendidos apenas para admin
      const isSold = itemData?.status === 'vendido' || itemData?.is_sold === true;
      const isAdmin = profile?.is_admin === true;

      if (isSold && !isAdmin) {
        toast.error(t('myItems.toast.deleteBlocked.title'), {
          description: t('myItems.toast.deleteBlocked.desc'),
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        return;
      }

      const { error } = await supabase.from('items').delete().eq('id', deleteConfirmData.id);
      
      if (error) {
        console.error('Delete error:', error);
        if (error.code === '23503') {
          throw new Error(t('myItems.errors.fkBlocked'));
        }
        throw new Error(`Erro ao deletar: ${error.message}`);
      }

      toast.success(t('myItems.toast.deleted.title'), {
        description: t('myItems.toast.deleted.desc'),
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });

      setDeleteConfirmData(null);
      setDeleteConfirmText('');
      fetchMyItems();
    } catch (error) {
      toast.error(t('myItems.toast.deleteError.title'), {
        description: error.message || t('myItems.toast.deleteError.desc'),
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Disc className="animate-spin text-[#D4AF37]" size={40} />
    </div>
  );

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setItemToEdit(null);
  };

  const formatPrice = (value) => formatCurrency(value);

  return (
    <div className="min-h-screen bg-charcoal-deep text-white py-12 px-4 md:px-8 pt-28 selection:bg-gold-premium/30 selection:text-gold-light">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="space-y-4">
            <Pill color="gold">{t('nav.myItems')}</Pill>
            <div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none text-luxury">
                {t('myItems.title.prefix')} <span className="text-gold-premium">{t('myItems.title.highlight')}</span>
              </h1>
              <p className="text-silver-premium/60 text-lg font-medium tracking-wide mt-1">
                {t('myItems.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-3 bg-gold-premium text-charcoal-deep px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all duration-500 shadow-xl active:scale-95"
          >
            <Plus size={16} /> {t('myItems.actions.add')}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="border-2 border-dashed border-white/10 rounded-[2rem] p-20 text-center">
            <p className="text-white/20 uppercase font-black tracking-widest">{t('myItems.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div key={item.id} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:border-[#D4AF37]/50 transition-all">
                <div className="aspect-square rounded-2xl overflow-hidden mb-4 relative">
                  <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
                  
                  {/* Badge de Status - Sobre a imagem */}
                  {item.status === 'reservado' && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                      <div className="bg-yellow-500/20 border-2 border-yellow-500 px-4 py-2 rounded-xl">
                        <p className="text-yellow-400 font-black text-sm uppercase tracking-wider">{t('myItems.status.negotiation')}</p>
                      </div>
                    </div>
                  )}
                  {item.status === 'vendido' && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="bg-red-500/20 border-2 border-red-500 px-4 py-2 rounded-xl">
                        <p className="text-red-400 font-black text-sm uppercase tracking-wider">{t('myItems.status.sold')}</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute top-4 left-4 flex gap-2 z-10">
                    {item.allow_sale && <span className="bg-[#D4AF37] text-black text-[8px] font-black px-2 py-1 rounded-full uppercase">{t('myItems.badge.sale')}</span>}
                    {item.allow_swap && <span className="bg-white text-black text-[8px] font-black px-2 py-1 rounded-full uppercase">{t('myItems.badge.swap')}</span>}
                  </div>
                </div>

                <h3 className="font-black uppercase truncate">{item.title}</h3>
                <p className="text-white/40 text-xs uppercase mb-4">{item.artist}</p>
                <p className="text-[#D4AF37] text-sm font-black mb-4">{formatPrice(item.price)}</p>

                <div className="flex gap-2">
                  <button onClick={() => navigate(`/item/${item.id}`)} className="flex-1 bg-white/5 hover:bg-white/10 p-3 rounded-xl flex justify-center border border-white/5">
                    <Eye size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      setItemToEdit(item);
                      setIsModalOpen(true);
                    }}
                    className="flex-1 bg-white/5 hover:bg-white/10 p-3 rounded-xl flex justify-center border border-white/5 text-blue-400"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="flex-1 bg-white/5 hover:bg-red-500/20 p-3 rounded-xl flex justify-center border border-white/5 text-red-500">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddItemModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onRefresh={fetchMyItems}
        itemToEdit={itemToEdit}
      />

      {deleteConfirmData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#050505] border border-[#ef4444]/40 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#ef4444]/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white mb-1">{t('myItems.deleteModal.title')}</h3>
                <p className="text-white/60 text-[10px] uppercase tracking-wider">{t('myItems.deleteModal.subtitle')}</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white/60 text-xs uppercase tracking-wider mb-2">{t('myItems.deleteModal.itemLabel')}</p>
                <p className="text-white font-bold text-sm">{deleteConfirmData.title}</p>
                {deleteConfirmData.artist && (
                  <p className="text-white/80 text-xs mt-1">{deleteConfirmData.artist}</p>
                )}
              </div>

              <div>
                <label className="block text-white/60 text-xs uppercase tracking-wider mb-2">
                  {t('myItems.deleteModal.typePrefix')} <span className="text-[#ef4444] font-bold">{confirmWord}</span> {t('myItems.deleteModal.typeSuffix')}
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#ef4444]/50"
                  placeholder={confirmWord}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteConfirmData(null);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all"
              >
                {t('myItems.actions.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmText.trim().toUpperCase() !== confirmWord}
                className="flex-1 px-4 py-3 bg-[#ef4444] hover:bg-[#ef4444]/80 text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('myItems.actions.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
