import React, { useEffect, useState, useCallback } from 'react';
import { X, Upload, Loader2, Search, Check, Disc, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useI18n } from '../contexts/I18nContext.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsZmlyZnVrYnJpc2ZwZWJhYXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzIwNTUsImV4cCI6MjA4Njg0ODA1NX0.vXadY-YLsKGuWXEb2UmHAqoDEx0vD_FpFkrTs55CiuU';

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
};

async function searchDiscogs(query, limit = 20) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/discogs-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ query, type: 'search', limit }),
  });

  if (!response.ok) throw new Error(`Erro ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.data;
}

async function getReleaseDetails(releaseId) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/discogs-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: 'release', releaseId }),
  });

  if (!response.ok) throw new Error(`Erro ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.data;
}

export default function AddItemModal({ isOpen, onClose, onRefresh, itemToEdit }) {
  if (!isOpen) return null;
  
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(emptyFormData);
  
  const [showDiscogs, setShowDiscogs] = useState(false);
  const [discogsQuery, setDiscogsQuery] = useState('');
  const [discogsResults, setDiscogsResults] = useState([]);
  const [discogsLoading, setDiscogsLoading] = useState(false);
  const [discogsSelected, setDiscogsSelected] = useState(null);
  const [discogsDetails, setDiscogsDetails] = useState(null);
  const [discogsFetching, setDiscogsFetching] = useState(false);

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
      });
    } else {
      setFormData(emptyFormData);
    }
    setShowDiscogs(false);
    setDiscogsResults([]);
    setDiscogsSelected(null);
    setDiscogsDetails(null);
  }, [itemToEdit, isOpen]);

  const handleDiscogsSearch = async (e) => {
    e.preventDefault();
    if (!discogsQuery.trim()) return;

    setDiscogsLoading(true);
    setDiscogsSelected(null);
    setDiscogsDetails(null);
    setDiscogsResults([]);

    try {
      const data = await searchDiscogs(discogsQuery, 20);
      setDiscogsResults(data || []);
      if (!data || data.length === 0) {
        toast.info(t('grooveflix.discogs.noResults'));
      }
    } catch (error) {
      toast.error(t('grooveflix.discogs.fetchError'), { description: error.message });
    }
    setDiscogsLoading(false);
  };

  const handleDiscogsSelect = async (release) => {
    setDiscogsSelected(release);
    setDiscogsFetching(true);
    setDiscogsDetails(null);

    try {
      const details = await getReleaseDetails(release.id);
      setDiscogsDetails(details);
    } catch (error) {
      toast.error(t('grooveflix.discogs.fetchError'), { description: error.message });
    }
    setDiscogsFetching(false);
  };

  const handleDiscogsImport = useCallback(() => {
    if (!discogsSelected || !discogsDetails) return;

    const artistName = discogsDetails.artists_sort || discogsDetails.artists?.[0]?.name || discogsSelected.title.split(' - ')[0] || '';
    const albumTitle = discogsDetails.title || discogsSelected.title;
    const coverUrl = discogsDetails.images?.[0]?.uri || discogsSelected.thumb || discogsDetails.thumb || '';
    const coverUrlThumbnail = discogsDetails.images?.[0]?.uri150 || discogsSelected.thumb || '';

    setFormData(prev => ({
      ...prev,
      title: albumTitle,
      artist: artistName,
      year: discogsDetails.year || discogsSelected.year || '',
      genre: [...(discogsDetails.genres || []), ...(discogsDetails.styles || [])].slice(0, 2).join(', '),
      image_url: coverUrl,
      coverUrlThumbnail: coverUrlThumbnail,
      discogsId: discogsSelected.id,
      discogsMasterId: discogsDetails.master_id,
    }));

    setShowDiscogs(false);
    setDiscogsQuery('');
    setDiscogsResults([]);
    setDiscogsSelected(null);
    setDiscogsDetails(null);

    toast.success(t('grooveflix.discogs.importSuccess'), {
      description: `${albumTitle} - ${artistName}`,
    });
  }, [discogsSelected, discogsDetails, t]);

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
          grooveflix: {
            discogsId: formData.discogsId || null,
            discogsMasterId: formData.discogsMasterId || null,
          },
          coverUrlThumbnail: formData.coverUrlThumbnail || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] border border-[#D4AF37]/20 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-white/5 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-[#D4AF37] font-black uppercase tracking-widest text-sm">
              {itemToEdit ? t('addItem.title.edit') : t('addItem.title.new')}
            </h2>
            {formData.discogsId && (
              <a 
                href={`https://www.discogs.com/release/${formData.discogsId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[8px] text-white/30 hover:text-[#D4AF37] transition-colors"
              >
                <ExternalLink size={10} />
                Discogs
              </a>
            )}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-4">
            {!showDiscogs ? (
              <button
                type="button"
                onClick={() => setShowDiscogs(true)}
                className="w-full py-3 bg-gradient-to-r from-fuchsia-500/20 to-purple-500/20 border border-fuchsia-500/30 rounded-xl text-fuchsia-300 font-bold text-xs uppercase tracking-widest hover:from-fuchsia-500/30 hover:to-purple-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Search size={14} />
                Buscar no Discogs
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-fuchsia-400 text-xs font-bold uppercase tracking-wider">Busca Discogs</span>
                  <button type="button" onClick={() => { setShowDiscogs(false); setDiscogsResults([]); setDiscogsSelected(null); }} className="text-white/40 hover:text-white text-xs">
                    <X size={14} />
                  </button>
                </div>
                <form onSubmit={handleDiscogsSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={discogsQuery}
                    onChange={(e) => setDiscogsQuery(e.target.value)}
                    placeholder="Ex: Miles Davis Kind of Blue..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-fuchsia-500 outline-none"
                  />
                  <button type="submit" disabled={discogsLoading} className="px-4 py-2 bg-fuchsia-500 rounded-lg text-black text-xs font-bold hover:bg-fuchsia-400 disabled:opacity-50">
                    {discogsLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </button>
                </form>

                {discogsResults.length > 0 && !discogsSelected && (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {discogsResults.map((release) => (
                      <button
                        key={release.id}
                        type="button"
                        onClick={() => handleDiscogsSelect(release)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-left"
                      >
                        <div className="w-10 h-10 bg-white/5 rounded overflow-hidden flex-shrink-0">
                          {release.thumb ? (
                            <img src={release.thumb} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Disc size={16} className="text-white/30" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs truncate">{release.title}</p>
                          <p className="text-white/40 text-[10px]">{release.year}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {discogsSelected && (
                  <div className="border-t border-white/10 pt-3 space-y-3">
                    <div className="flex gap-3">
                      <div className="w-20 h-20 bg-white/5 rounded-lg overflow-hidden flex-shrink-0 relative">
                        {(discogsDetails?.images?.[0]?.uri || discogsSelected.thumb) ? (
                          <img src={discogsDetails?.images?.[0]?.uri || discogsSelected.thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Disc size={24} className="text-white/20" />
                          </div>
                        )}
                        {discogsFetching && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 size={16} className="animate-spin text-fuchsia-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{discogsDetails?.title || discogsSelected.title}</p>
                        <p className="text-white/60 text-xs mt-1">{discogsDetails?.artists_sort || discogsSelected.title.split(' - ')[0]}</p>
                        <div className="flex gap-2 mt-2">
                          {discogsDetails?.year && <span className="text-[10px] text-white/40">{discogsDetails.year}</span>}
                          {discogsDetails?.country && <span className="text-[10px] text-white/40">{discogsDetails.country}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDiscogsImport}
                      disabled={!discogsDetails || discogsFetching}
                      className="w-full py-2 bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-lg text-white text-xs font-bold hover:from-fuchsia-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Check size={12} />
                      Importar Dados
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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
            <div>
              <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest ml-1">{t('addItem.fields.price')}</label>
              <input required type="number" step="0.01" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#D4AF37]/50 outline-none transition-all"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})} />
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
  );
}
