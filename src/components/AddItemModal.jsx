import React, { useEffect, useState } from 'react';
import { X, Upload, Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useI18n } from '../contexts/I18nContext.jsx';
import { DiscogsSearch } from './DiscogsSearch.jsx';
import { getExchangeRates, formatBRL, psychologicalRound } from '../utils/currency';

const emptyFormData = {
  title: '',
  artist: '',
  year: '',
  genre: '',
  price: '',
  condition: 'MINT',
  image_url: '',
  coverUrlThumbnail: '',
  allow_sale: true,
  allow_swap: false,
  file: null,
  discogsId: '',
  discogsMasterId: '',
  description: '',
};

export default function AddItemModal({ isOpen, onClose, onRefresh, itemToEdit }) {
  if (!isOpen) return null;

  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(emptyFormData);
  const [priceSuggestions, setPriceSuggestions] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [applyingPrice, setApplyingPrice] = useState(false);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);

  useEffect(() => {
    getExchangeRates().then(setExchangeRates);
  }, []);

  useEffect(() => {
    if (itemToEdit) {
      setFormData({
        title: itemToEdit.title || '',
        artist: itemToEdit.artist || '',
        year: itemToEdit.year || '',
        genre: itemToEdit.genre || '',
        price: itemToEdit.price != null ? String(itemToEdit.price) : '',
        condition: itemToEdit.condition || 'MINT',
        image_url: itemToEdit.image_url || '',
        coverUrlThumbnail: itemToEdit.metadata?.coverUrlThumbnail || '',
        allow_sale: Boolean(itemToEdit.allow_sale),
        allow_swap: Boolean(itemToEdit.allow_swap),
        file: null,
        discogsId: itemToEdit.metadata?.grooveflix?.discogsId || '',
        discogsMasterId: itemToEdit.metadata?.grooveflix?.discogsMasterId || '',
        description: itemToEdit.metadata?.description || '',
      });
    } else {
      setFormData(emptyFormData);
    }
  }, [itemToEdit, isOpen]);

  const handleDiscogsImport = (data) => {
    setFormData(prev => ({
      ...prev,
      title: data.title || prev.title,
      artist: data.artist || prev.artist,
      year: data.year || prev.year,
      genre: data.genre || prev.genre,
      image_url: data.image_url || prev.image_url,
      coverUrlThumbnail: data.coverUrlThumbnail || prev.coverUrlThumbnail,
      discogsId: data.discogsId || prev.discogsId,
      discogsMasterId: data.discogsMasterId || prev.discogsMasterId,
      description: data.description || prev.description,
    }));
  };

  const handlePriceUpdate = (suggestions) => {
    setPriceSuggestions(suggestions);
  };

  const handleApplyMedianPrice = async () => {
    if (!priceSuggestions?.lowestPriceUSD || !exchangeRates) return;
    
    setApplyingPrice(true);
    const currency = priceSuggestions.priceCurrency || 'USD';
    const rate = exchangeRates[currency] || exchangeRates.USD;
    
    const baseValue = priceSuggestions.lowestPriceUSD;
    const baseBRL = baseValue * rate;
    
    const conditionMultipliers = {
      'MINT': { label: 'Mint', increase: 0.4 },
      'NM': { label: 'Near Mint', increase: 0.2 },
      'VG+': { label: 'Very Good Plus', increase: 0.1 },
      'VG': { label: 'Very Good', increase: 0 },
    };
    
    const condition = conditionMultipliers[formData.condition] || conditionMultipliers['VG'];
    const increaseBRL = baseBRL * condition.increase;
    const rawTotal = baseBRL + increaseBRL;
    const finalPrice = psychologicalRound(rawTotal);
    
    setFormData(prev => ({ ...prev, price: finalPrice.toFixed(2) }));
    
    window.priceCalculation = {
      baseValue,
      currency,
      rate,
      baseBRL: baseBRL.toFixed(2),
      condition: condition.label,
      increasePct: (condition.increase * 100).toFixed(0),
      increaseBRL: increaseBRL.toFixed(2),
      rawTotal: rawTotal.toFixed(2),
      finalPrice: finalPrice.toFixed(2),
    };
    
    setShowPriceBreakdown(true);
    setApplyingPrice(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('addItem.errors.notAuthenticated'));

      let finalImageUrl = formData.image_url;

      if (formData.file) {
        const fileExt = formData.file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('items-images')
          .upload(filePath, formData.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('items-images')
          .getPublicUrl(filePath);
        
        finalImageUrl = publicUrl;
      }

      const payload = {
        title: formData.title,
        artist: formData.artist,
        year: formData.year ? parseInt(formData.year) : null,
        genre: formData.genre,
        price: parseFloat(formData.price) || 0,
        condition: formData.condition,
        image_url: finalImageUrl || '',
        allow_sale: Boolean(formData.allow_sale),
        allow_swap: Boolean(formData.allow_swap),
        seller_id: user.id,
        metadata: {
          source: 'catalog',
          grooveflix: {
            isAlbum: false,
            discogsId: formData.discogsId || null,
            discogsMasterId: formData.discogsMasterId || null,
          },
          coverUrlThumbnail: formData.coverUrlThumbnail || null,
          description: formData.description || null,
        }
      };

      if (itemToEdit) {
        const { error: updateError } = await supabase
          .from('items')
          .update(payload)
          .eq('id', itemToEdit.id);

        if (updateError) throw updateError;
        toast.success(t('addItem.toast.updated.title'), {
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
      } else {
        const { error: insertError } = await supabase.from('items').insert([payload]);
        if (insertError) throw insertError;
        toast.success(t('addItem.toast.created.title'), {
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
      }

      if (onRefresh) onRefresh();
      onClose();
    } catch (error) {
      toast.error(t('addItem.toast.error.title'), {
        description: error.message || t('addItem.toast.error.desc'),
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0A0A0A] border border-[#D4AF37]/20 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-white/5 flex justify-between items-center flex-shrink-0">
          <h2 className="text-[#D4AF37] font-black uppercase tracking-widest text-sm">
            {itemToEdit ? t('addItem.title.edit') : t('addItem.title.new')}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-6 pt-4">
            <DiscogsSearch onImport={handleDiscogsImport} onPriceUpdate={handlePriceUpdate} />
          </div>

          <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest ml-1">{t('addItem.fields.title')}</label>
                <input required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#D4AF37]/50 outline-none transition-all" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest ml-1">{t('addItem.fields.artist')}</label>
                <input required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#D4AF37]/50 outline-none transition-all"
                  value={formData.artist}
                  onChange={e => setFormData({...formData, artist: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest ml-1">Ano</label>
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#D4AF37]/50 outline-none transition-all"
                  value={formData.year}
                  onChange={e => setFormData({...formData, year: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest ml-1">Gênero</label>
                <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#D4AF37]/50 outline-none transition-all"
                  value={formData.genre}
                  onChange={e => setFormData({...formData, genre: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest ml-1">Sobre a Relíquia</label>
                <textarea 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#D4AF37]/50 outline-none transition-all resize-none"
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Informações sobre a relíquia..."
                />
              </div>
              <div className="relative">
                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest ml-1">{t('addItem.fields.price')}</label>
                <div className="relative">
                  <input required type="number" step="0.01" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#D4AF37]/50 outline-none transition-all"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})} />
                  {priceSuggestions && priceSuggestions.lowestPriceUSD ? (
                    <button
                      type="button"
                      onClick={handleApplyMedianPrice}
                      disabled={applyingPrice}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-[10px] font-bold text-amber-400 transition-colors z-10"
                    >
                      <TrendingUp className="w-3 h-3" />
                      {applyingPrice ? 'Calculando...' : 'Sugerir Preço'}
                    </button>
                  ) : (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-white/30">
                      Buscar no Discogs →
                    </div>
                  )}
                </div>
                {priceSuggestions && priceSuggestions.lowestPriceUSD && exchangeRates ? (
                  <div className="mt-3 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-2 relative z-0">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-amber-400/80 font-bold uppercase">Piso de Mercado</div>
                      <div className="text-[9px] text-white/40">(Geralmente itens VG/G)</div>
                    </div>
                    <div className="text-xl font-bold text-emerald-400 text-center py-1">
                      {formatBRL(priceSuggestions.lowestPriceUSD * (exchangeRates[priceSuggestions.priceCurrency] || exchangeRates.USD))}
                      <span className="text-xs text-white/50 ml-2">{priceSuggestions.priceCurrency} {priceSuggestions.lowestPriceUSD.toFixed(2)}</span>
                    </div>
                    <div className="text-[9px] text-white/30 text-center">
                      {priceSuggestions.numForSale ? `${priceSuggestions.numForSale} itens à venda no Discogs` : 'Preço mínimo disponível'}
                    </div>
                    
                    <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/10">
                      <select
                        className="bg-white/5 border border-white/20 rounded px-2 py-1.5 text-[10px] text-white/80 focus:border-amber-500/50 outline-none cursor-pointer"
                        value={formData.condition}
                        onChange={e => setFormData({...formData, condition: e.target.value})}
                      >
                        <option value="MINT">Mint (+40%)</option>
                        <option value="NM">Near Mint (+20%)</option>
                        <option value="VG+">VG+ (+10%)</option>
                        <option value="VG">VG (base)</option>
                      </select>
                      <a
                        href={`https://www.discogs.com/sell/history/${priceSuggestions.releaseId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded"
                      >
                        <TrendingUp className="w-3 h-3" />
                        Ver Histórico
                      </a>
                    </div>
                    
                    {showPriceBreakdown && window.priceCalculation && (
                      <div className="mt-2 p-2 bg-black/40 rounded-lg border border-white/10 text-[9px]">
                        <div className="font-bold text-white/70 mb-1">Detalhamento do Cálculo:</div>
                        <div className="text-white/50">USD {window.priceCalculation.baseUSD} × taxa {window.priceCalculation.rate} = <span className="text-emerald-400">R$ {window.priceCalculation.baseBRL}</span></div>
                        <div className="text-white/50">{window.priceCalculation.condition} (+{window.priceCalculation.increasePct}%): <span className="text-amber-400">+R$ {window.priceCalculation.increaseBRL}</span></div>
                        <div className="border-t border-white/10 mt-1 pt-1 font-bold text-white flex justify-between">
                          <span>Total Sugerido:</span>
                          <span className="text-emerald-400">R$ {window.priceCalculation.finalPrice}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="text-[8px] text-white/25 text-center pt-1">
                      Dados baseados no menor valor global disponível na Discogs API
                    </div>
                  </div>
                ) : (
                  priceSuggestions === null && (
                    <div className="mt-2 p-2 bg-white/5 rounded-lg text-center">
                      <div className="text-[9px] text-white/40">Busque um lançamento no Discogs acima para suggestions de preço</div>
                    </div>
                  )
                )}
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest ml-1">{t('addItem.fields.condition')}</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#D4AF37]/50 outline-none transition-all appearance-none"
                  value={formData.condition}
                  onChange={e => setFormData({...formData, condition: e.target.value})}>
                  <option value="MINT">{t('addItem.condition.MINT')}</option>
                  <option value="NM">{t('addItem.condition.NM')}</option>
                  <option value="VG+">{t('addItem.condition.VG_PLUS')}</option>
                  <option value="VG">{t('addItem.condition.VG')}</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest ml-1">{t('addItem.fields.coverUrl')}</label>
                <input type="url" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#D4AF37]/50 outline-none transition-all"
                  value={formData.image_url}
                  onChange={e => setFormData({...formData, image_url: e.target.value})} />
              </div>

              <div className="col-span-2 flex gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={formData.allow_sale} 
                    onChange={e => setFormData({...formData, allow_sale: e.target.checked})}
                    className="accent-[#D4AF37]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white">{t('addItem.fields.allowSale')}</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={formData.allow_swap} 
                    onChange={e => setFormData({...formData, allow_swap: e.target.checked})}
                    className="accent-[#D4AF37]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white">{t('addItem.fields.allowSwap')}</span>
                </label>
              </div>

              <div className="col-span-2">
                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest ml-1">{t('addItem.fields.realPhoto')}</label>
                <div className="mt-2 flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-white/10 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 hover:border-[#D4AF37]/30 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 text-white/20 mb-2" />
                      <p className="text-[9px] text-white/40 uppercase font-black tracking-widest">
                        {formData.file ? formData.file.name : t('addItem.upload.selectFile')}
                      </p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" 
                      onChange={e => setFormData({...formData, file: e.target.files[0]})} />
                  </label>
                </div>
              </div>
            </div>

            <button disabled={loading} className="w-full py-4 bg-[#D4AF37] text-black rounded-xl font-black uppercase tracking-[2px] text-xs hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 mt-4">
              {loading ? <Loader2 className="animate-spin" /> : (itemToEdit ? t('addItem.actions.save') : t('addItem.actions.publish'))}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
