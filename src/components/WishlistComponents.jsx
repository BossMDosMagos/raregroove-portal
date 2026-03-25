import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Heart, DollarSign, Tag, Music, Sparkles, Trash2, Edit2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../contexts/I18nContext.jsx';

// ========================================
// MODAL: Adicionar/Editar Desejo
// ========================================
export function WishlistModal({ isOpen, onClose, onWishAdded, editingWish = null }) {
  const { t } = useI18n();
  const [itemName, setItemName] = useState(editingWish?.item_name || '');
  const [artist, setArtist] = useState(editingWish?.artist || '');
  const [maxPrice, setMaxPrice] = useState(editingWish?.max_price || '');
  const [category, setCategory] = useState(editingWish?.category || '');
  const [description, setDescription] = useState(editingWish?.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!itemName.trim()) {
      toast.error(t('wishlist.modal.errors.missingItemName'), {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('wishlist.errors.notAuthenticated'));

      const wishData = {
        user_id: user.id,
        item_name: itemName.trim(),
        artist: artist.trim() || null,
        max_price: maxPrice ? parseFloat(maxPrice) : null,
        category: category.trim() || null,
        description: description.trim() || null,
        active: true
      };

      let result;
      if (editingWish) {
        // Atualizar desejo existente
        result = await supabase
          .from('wishlist')
          .update(wishData)
          .eq('id', editingWish.id);
      } else {
        // Criar novo desejo
        result = await supabase
          .from('wishlist')
          .insert([wishData]);
      }

      if (result.error) throw result.error;

      toast.success(editingWish ? t('wishlist.toast.updated.title') : t('wishlist.toast.created.title'), {
        description: t('wishlist.toast.created.desc'),
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      
      onWishAdded?.();
      onClose();
    } catch (error) {
      toast.error(t('wishlist.toast.error.title'), {
        description: error.message || t('wishlist.toast.error.desc'),
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#050505] border border-[#D4AF37]/30 rounded-lg w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#D4AF37]/20">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-[#D4AF37]" />
            <h2 className="text-xl font-bold text-white">
              {editingWish ? t('wishlist.modal.title.edit') : t('wishlist.modal.title.add')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nome do Item */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Music className="w-4 h-4 text-[#D4AF37]" />
              {t('wishlist.modal.fields.itemName')} *
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={t('wishlist.modal.placeholders.itemName')}
              className="w-full px-4 py-2 bg-black border border-[#D4AF37]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('wishlist.modal.hints.itemName')}
            </p>
          </div>

          {/* Artista */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              {t('wishlist.modal.fields.artist')}
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder={t('wishlist.modal.placeholders.artist')}
              className="w-full px-4 py-2 bg-black border border-[#D4AF37]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
            />
          </div>

          {/* Preço Máximo */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <DollarSign className="w-4 h-4 text-[#D4AF37]" />
              {t('wishlist.modal.fields.maxPrice')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder={t('wishlist.modal.placeholders.maxPrice')}
              className="w-full px-4 py-2 bg-black border border-[#D4AF37]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('wishlist.modal.hints.maxPrice')}
            </p>
          </div>

          {/* Categoria */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Tag className="w-4 h-4 text-[#D4AF37]" />
              {t('wishlist.modal.fields.category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 bg-black border border-[#D4AF37]/30 rounded-lg text-white focus:outline-none focus:border-[#D4AF37] transition-colors"
            >
              <option value="">{t('wishlist.category.all')}</option>
              <option value="Novo">{t('wishlist.category.Novo')}</option>
              <option value="Seminovo">{t('wishlist.category.Seminovo')}</option>
              <option value="Usado">{t('wishlist.category.Usado')}</option>
              <option value="Colecionador">{t('wishlist.category.Colecionador')}</option>
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              {t('wishlist.modal.fields.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('wishlist.modal.placeholders.description')}
              rows={3}
              className="w-full px-4 py-2 bg-black border border-[#D4AF37]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors resize-none"
              maxLength={500}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-[#D4AF37]/30 rounded-lg text-gray-300 hover:bg-[#D4AF37]/10 transition-colors"
              disabled={isSubmitting}
            >
              {t('wishlist.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#D4AF37]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('wishlist.actions.saving') : (editingWish ? t('wishlist.actions.update') : t('wishlist.actions.add'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========================================
// CARD: Exibir cada desejo da lista
// ========================================
export function WishlistCard({ wish, onEdit, onDelete, onToggleActive }) {
  const { t, formatCurrency, formatDate } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(t('wishlist.card.confirmRemove'))) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('id', wish.id);

      if (error) throw error;
      
      toast.success(t('wishlist.toast.removed.title'), {
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      onDelete?.(wish.id);
    } catch (error) {
      toast.error(t('wishlist.toast.removeError.title'), {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      const { error } = await supabase
        .from('wishlist')
        .update({ active: !wish.active })
        .eq('id', wish.id);

      if (error) throw error;
      
      toast.success(wish.active ? t('wishlist.toast.paused.title') : t('wishlist.toast.activated.title'), {
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      onToggleActive?.(wish.id);
    } catch (error) {
      toast.error(t('wishlist.toast.toggleError.title'), {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const categoryLabel = (() => {
    if (!wish.category) return null;
    const key = `wishlist.category.${wish.category}`;
    const label = t(key);
    return label === key ? wish.category : label;
  })();

  return (
    <div 
      className={`bg-[#050505] border-2 rounded-lg p-4 transition-all hover:shadow-lg ${
        wish.active 
          ? 'border-dashed border-[#D4AF37] hover:border-[#D4AF37]/80' 
          : 'border-gray-700 opacity-60'
      }`}
    >
      {/* Header com ações */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart 
            className={`w-5 h-5 ${wish.active ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-gray-500'}`} 
          />
          <h3 className="font-bold text-white text-lg">
            {wish.item_name}
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleActive}
            className={`p-1 rounded transition-colors ${
              wish.active 
                ? 'text-green-400 hover:text-green-300' 
                : 'text-gray-500 hover:text-gray-400'
            }`}
            title={wish.active ? t('wishlist.actions.pause') : t('wishlist.actions.activate')}
          >
            <CheckCircle className="w-5 h-5" />
          </button>
          <button
            onClick={() => onEdit?.(wish)}
            className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
            title={t('wishlist.actions.edit')}
          >
            <Edit2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
            title={t('wishlist.actions.remove')}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Detalhes */}
      <div className="space-y-2 text-sm">
        {wish.artist && (
          <div className="flex items-center gap-2 text-gray-300">
            <Sparkles className="w-4 h-4 text-[#D4AF37]/70" />
            <span>{t('wishlist.card.artistLabel')} {wish.artist}</span>
          </div>
        )}
        
        {wish.max_price && (
          <div className="flex items-center gap-2 text-gray-300">
            <DollarSign className="w-4 h-4 text-[#D4AF37]/70" />
            <span>{t('wishlist.card.maxPriceLabel')} {formatCurrency(wish.max_price)}</span>
          </div>
        )}
        
        {categoryLabel && (
          <div className="flex items-center gap-2 text-gray-300">
            <Tag className="w-4 h-4 text-[#D4AF37]/70" />
            <span>{t('wishlist.card.categoryLabel')} {categoryLabel}</span>
          </div>
        )}
        
        {wish.description && (
          <p className="text-gray-400 text-xs mt-2 pt-2 border-t border-[#D4AF37]/20">
            {wish.description}
          </p>
        )}
      </div>

      {/* Status Badge */}
      <div className="mt-3 pt-3 border-t border-[#D4AF37]/20 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {t('wishlist.card.addedAt')} {formatDate(wish.created_at)}
        </span>
        <span 
          className={`text-xs font-semibold px-2 py-1 rounded ${
            wish.active 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          {wish.active ? `🔍 ${t('wishlist.card.status.searching')}` : `⏸️ ${t('wishlist.card.status.paused')}`}
        </span>
      </div>
    </div>
  );
}

// ========================================
// Empty State: Quando não há desejos
// ========================================
export function WishlistEmptyState({ onAddWish }) {
  const { t } = useI18n();
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#D4AF37]/10 mb-6">
        <Heart className="w-10 h-10 text-[#D4AF37]" />
      </div>
      
      <h3 className="text-2xl font-bold text-white mb-2">
        {t('wishlist.empty.title')}
      </h3>
      
      <p className="text-gray-400 mb-6 max-w-md mx-auto">
        {t('wishlist.empty.desc')}
      </p>
      
      <button
        onClick={onAddWish}
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#D4AF37]/90 transition-colors"
      >
        <Heart className="w-5 h-5" />
        {t('wishlist.empty.addFirst')}
      </button>
    </div>
  );
}
