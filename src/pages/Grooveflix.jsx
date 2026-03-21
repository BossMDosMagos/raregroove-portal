import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Film, Sparkles, Plus, Music } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import GrooveflixRow from '../components/GrooveflixRow';
import GrooveflixUploader from '../components/GrooveflixUploader';
import GrooveflixWebampPlayer from '../components/GrooveflixWebampPlayer';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useSubscription } from '../contexts/SubscriptionContext.jsx';

const CATEGORY_OPTIONS = ['all', 'single', 'album', 'coletanea', 'iso'];

function normalizeTracks(items = []) {
  return (items || []).map((item) => {
    const metadata = item?.metadata || {};
    const grooveflix = metadata.grooveflix || {};

    const category = String(grooveflix.category || 'single').toLowerCase();
    const audioPath = grooveflix.audio_path || grooveflix.flac_path || grooveflix.preview_path || grooveflix.iso_path || null;
    const coverPath = grooveflix.cover_path || grooveflix.coverUrl || '';
    const coverUrl = item.image_url || coverPath || '';
    const previewPath = grooveflix.preview_path || null;

    return {
      id: item.id,
      title: item.title || 'Sem título',
      artist: item.artist || 'Desconhecido',
      coverUrl,
      coverPath,
      category,
      audioPath,
      previewPath,
      metadata,
      raw: item,
    };
  }).filter((track) => track.id && (track.audioPath || track.coverUrl || track.coverPath));
}

export default function Grooveflix() {
  const { t } = useI18n();
  const { profile, settings, isTrialing, isActive } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showUploader, setShowUploader] = useState(false);
  const [showWebampPlayer, setShowWebampPlayer] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    const init = async () => {
      console.log('[GROOVEFLIX] Checking admin, profile.id:', profile?.id);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', profile?.id)
          .single();

        console.log('[GROOVEFLIX] Profile check result:', { profileData, profileError, isAdmin: profileData?.is_admin });
        
        if (!profileError && profileData?.is_admin) {
          setIsAdmin(true);
          console.log('[GROOVEFLIX] Admin mode enabled');
        }
      } catch (e) {
        console.error('[GROOVEFLIX] Admin check error:', e);
      }
    };

    init();
  }, [profile?.id]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, title, artist, image_url, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(120);

      if (error) throw error;
      
      console.log('[GROOVEFLIX] Raw items from DB:', data?.length || 0);
      const tracks = normalizeTracks(data || []);
      console.log('[GROOVEFLIX] Normalized tracks:', tracks.length);
      console.log('[GROOVEFLIX] Sample track:', tracks[0]);
      
      setItems(tracks);
      setSelectedTrackId((prev) => (!prev && tracks.length > 0 ? tracks[0].id : prev));

    } catch (e) {
      toast.error('Erro ao carregar Grooveflix', {
        description: e?.message || 'Tente novamente mais tarde.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (categoryFilter === 'all') return items;
    return items.filter((item) => (item.category || 'single').toLowerCase() === categoryFilter);
  }, [items, categoryFilter]);

  const selectedTrack = useMemo(() => items.find((item) => item.id === selectedTrackId), [items, selectedTrackId]);

  const handleTrackPick = (track) => {
    if (!track?.id) return;
    setSelectedTrackId(track.id);
    toast.message('Faixa selecionada', { description: `“${track.title}” por ${track.artist}` });
  };
  const handlePlayTrack = (track) => {
    if (!track?.id || !track?.audioPath) {
      toast.error('Sem áudio disponível', { description: 'Esta faixa não possui arquivo de áudio.' });
      return;
    }
    setSelectedTrackId(track.id);
    setShowWebampPlayer(true);
  };
  const sections = [
    { title: 'Em destaque', items: filteredItems.slice(0, 30) },
    { title: 'Recém adicionados', items: filteredItems.slice(0, 18) },
    { title: 'Continue ouvindo', items: filteredItems.slice(18, 42) },
  ];

  return (
    <div className="min-h-screen bg-black text-white pb-28">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal-deep via-black to-black" />
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-fuchsia-600/10 blur-[150px]" />
        <div className="absolute top-20 right-[-200px] w-[700px] h-[700px] bg-purple-600/8 blur-[160px]" />
        <div className="absolute bottom-[-300px] left-1/4 w-[800px] h-[800px] bg-fuchsia-600/5 blur-[180px]" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/10 to-transparent" />
      </div>

      <div className="relative max-w-[1600px] mx-auto px-4 md:px-6 pt-28 space-y-8">
        <header className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-[10px] uppercase tracking-widest text-fuchsia-300">
                <Sparkles className="w-3 h-3" /> {t('grooveflix.badge') || 'HI-FI STREAMING'}
              </span>
            </div>
            <h1 className="text-6xl md:text-7xl font-black tracking-tight">GROOVEFLIX<span className="text-fuchsia-400">.</span></h1>
            <p className="mt-3 text-white/50 max-w-2xl">Conteúdo hi-fi em streaming com upload aprovado via Backblaze B2. Página reconstruída do zero para estabilidade.</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setShowUploader(true)} className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-fuchsia-200 hover:bg-fuchsia-500/20 transition">
              <Plus className="w-4 h-4" /> Upload
            </button>
            <button onClick={() => void loadItems()} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/10 transition">
              <Film className="w-4 h-4" /> Reload
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-2 rounded-full text-xs uppercase tracking-widest border ${categoryFilter === cat ? 'bg-fuchsia-500/25 border-fuchsia-500 text-fuchsia-100' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}>
              {cat === 'all' ? 'Todos' : cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          <main className="space-y-8">
            {loading ? (
              <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center">
                Carregando Grooveflix...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center">
                Nenhum conteúdo encontrado. Faça upload para começar.
              </div>
            ) : (
              sections.map((section) => (
                <GrooveflixRow
                  key={section.title}
                  title={section.title}
                  items={section.items}
                  onPick={handleTrackPick}
                  onDelete={isAdmin ? async (id) => {
                    const session = await supabase.auth.getSession();
                    if (!session?.data?.session?.access_token) {
                      toast.error('Autenticação necessária', { description: 'Faça login para deletar itens.' });
                      return;
                    }
                    const { error } = await supabase.functions.invoke('grooveflix-delete', {
                      body: { itemId: id, userId: userId },
                      headers: {
                        'Authorization': `Bearer ${session.data.session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                      }
                    });
                    if (error) {
                      toast.error('Erro ao deletar item', { description: error.message });
                    } else {
                      toast.success('Item deletado com sucesso!');
                      void loadItems();
                    }
                  } : undefined}
                  canDelete={isAdmin}
                />
              ))
            )}
          </main>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-white/80">Faixa selecionada</h2>
              {selectedTrack ? (
                <div className="mt-3 space-y-3">
                  <p className="text-lg font-bold truncate">{selectedTrack.title}</p>
                  <p className="text-sm text-white/60 truncate">{selectedTrack.artist}</p>
                  <p className="text-xs text-white/40">Categoria: {selectedTrack.category}</p>
                  {selectedTrack.audioPath && (
                    <button
                      onClick={() => handlePlayTrack(selectedTrack)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-xs font-black uppercase tracking-wider hover:shadow-lg hover:shadow-fuchsia-500/20 transition"
                    >
                      <Music className="w-4 h-4" /> Reproduzir com Webamp
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/60">Nenhuma faixa escolhida.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <h3 className="text-xs font-black uppercase tracking-wide mb-2">Webamp Integrado</h3>
              <p>Clique em uma faixa e use o botão "Reproduzir" para abrir o player Webamp com streaming HI-FI.</p>
              <p className="mt-2 text-xs text-white/50">Suportado: presigned URLs do Backblaze B2.</p>
            </div>
          </aside>
        </div>
      </div>

      <GrooveflixUploader
        isOpen={showUploader}
        onClose={() => setShowUploader(false)}
        onSuccess={() => {
          setShowUploader(false);
          void loadItems();
        }}
        isAdmin={isAdmin}
      />

      <GrooveflixWebampPlayer
        isOpen={showWebampPlayer}
        onClose={() => setShowWebampPlayer(false)}
        track={selectedTrack}
        queue={items}
        onTrackChange={setSelectedTrackId}
        isTrialing={isTrialing}
        canDownload={isActive}
        userId={userId}
      />
    </div>
  );
}
