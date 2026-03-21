import React, { useCallback, useEffect, useState } from 'react';
import { Film, Sparkles, Plus, Music, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import GrooveflixRow from '../components/GrooveflixRow';
import GrooveflixUploader from '../components/GrooveflixUploader';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useSubscription } from '../contexts/SubscriptionContext.jsx';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';

const CATEGORY_OPTIONS = ['all', 'single', 'album', 'coletanea', 'iso'];

function normalizeTracks(items = []) {
  return (items || []).map((item) => {
    const metadata = item?.metadata || {};
    const grooveflix = metadata.grooveflix || {};

    const category = String(grooveflix.category || 'single').toLowerCase();
    const audioPath = grooveflix.audio_path || grooveflix.flac_path || null;
    const coverPath = grooveflix.cover_path || null;
    const coverUrl = item.image_url || null;
    const audioFiles = grooveflix.audio_files || [];

    return {
      id: item.id,
      title: item.title || 'Sem título',
      artist: item.artist || 'Desconhecido',
      coverUrl,
      coverPath,
      category,
      audioPath,
      audioFiles,
      metadata,
      raw: item,
    };
  }).filter((track) => track.id);
}

export default function Grooveflix() {
  const { t } = useI18n();
  const { isTrialing, isActive } = useSubscription();
  const { setQueue, playTrack, currentTrack: globalCurrentTrack } = useAudioPlayer();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showUploader, setShowUploader] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);

      if (user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        setIsAdmin(Boolean(profileData?.is_admin));
        console.log('[GROOVEFLIX] Admin:', profileData?.is_admin);
      }
    };
    init();
  }, []);

  const loadItems = useCallback(async () => {
    if (!userId) {
      console.log('[GROOVEFLIX] No userId, skipping load');
      setLoading(false);
      return;
    }

    setLoading(true);
    setDebugInfo(null);

    try {
      console.log('[GROOVEFLIX] Loading items for user:', userId);

      const { data, error } = await supabase
        .from('items')
        .select('id, title, artist, image_url, metadata, created_at')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(120);

      if (error) {
        console.error('[GROOVEFLIX] DB Error:', error);
        throw error;
      }

      console.log('[GROOVEFLIX] Raw items from DB:', data?.length || 0);

      const allItems = data || [];
      const grooveflixItems = allItems.filter(item =>
        item.metadata?.grooveflix?.category
      );

      console.log('[GROOVEFLIX] Items with grooveflix metadata:', grooveflixItems.length);

      if (grooveflixItems.length > 0) {
        const sample = grooveflixItems[0];
        console.log('[GROOVEFLIX] Sample grooveflix item:', JSON.stringify({
          id: sample.id,
          title: sample.title,
          category: sample.metadata?.grooveflix?.category,
          hasAudio: !!sample.metadata?.grooveflix?.audio_path,
          hasAudioFiles: !!sample.metadata?.grooveflix?.audio_files,
          audioFilesCount: sample.metadata?.grooveflix?.audio_files?.length || 0,
          hasCover: !!sample.metadata?.grooveflix?.cover_path,
        }, null, 2));
      }

      setDebugInfo({
        totalItems: allItems.length,
        grooveflixItems: grooveflixItems.length,
        sampleItem: grooveflixItems[0] ? {
          id: grooveflixItems[0].id,
          title: grooveflixItems[0].title,
          audioPath: grooveflixItems[0].metadata?.grooveflix?.audio_path,
          coverPath: grooveflixItems[0].metadata?.grooveflix?.cover_path,
        } : null,
      });

      const tracks = normalizeTracks(grooveflixItems);
      console.log('[GROOVEFLIX] Normalized tracks:', tracks.length);

      setItems(tracks);
      setLoading(false);
      if (tracks.length > 0 && !selectedTrackId) {
        setSelectedTrackId(tracks[0].id);
      }

      } catch (e) {
      console.error('[GROOVEFLIX] Load error:', e);
      toast.error(t('grooveflix.error.load'), { description: e.message });
      setItems([]);
    }
  }, [userId, selectedTrackId, t]);

  useEffect(() => {
    if (userId) {
      loadItems();
    }
  }, [userId]);

  const filteredItems = items.filter((item) => {
    if (categoryFilter === 'all') return true;
    return item.category === categoryFilter;
  });

  const selectedTrack = items.find((item) => item.id === selectedTrackId);

  const handleTrackPick = (track) => {
    setSelectedTrackId(track.id);
  };

  const handlePlayTrack = () => {
    console.log('[GROOVEFLIX] handlePlayTrack called, selectedTrack:', {
      id: selectedTrack?.id,
      title: selectedTrack?.title,
      category: selectedTrack?.category,
      audioPath: selectedTrack?.audioPath,
      audioFiles: selectedTrack?.audioFiles,
      audioFilesLength: selectedTrack?.audioFiles?.length,
    });
    
    if (!selectedTrack?.audioPath && (!selectedTrack?.audioFiles || selectedTrack.audioFiles.length === 0)) {
      toast.error(t('grooveflix.noAudio'), { description: t('grooveflix.error.noAudio') });
      return;
    }
    
    if (selectedTrack.category === 'album' && selectedTrack.audioFiles?.length > 0) {
      toast.success(t('grooveflix.loadingAlbum'), {
        description: `${selectedTrack.title} - ${selectedTrack.audioFiles.length} ${t('grooveflix.tracks') || 'faixas'}`,
        duration: 2000,
      });
    } else {
      toast.success(t('grooveflix.playing'), {
        description: `${selectedTrack.title} - ${selectedTrack.artist}`,
        duration: 2000,
      });
    }
    
    playTrack(selectedTrack);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('grooveflix.delete.confirm'))) return;

    const { error } = await supabase.functions.invoke('grooveflix-delete', {
      body: { itemId: id, userId },
    });

    if (error) {
      toast.error(t('grooveflix.delete.error'));
    } else {
      toast.success(t('grooveflix.delete.success'));
      loadItems();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-28">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal-deep via-black to-black" />
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-fuchsia-600/10 blur-[150px]" />
        <div className="absolute top-20 right-[-200px] w-[700px] h-[700px] bg-purple-600/8 blur-[160px]" />
      </div>

      <div className="relative max-w-[1600px] mx-auto px-4 md:px-6 pt-28 space-y-8">
        <header className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-[10px] uppercase tracking-widest text-fuchsia-300">
                <Sparkles className="w-3 h-3" /> HI-FI STREAMING
              </span>
            </div>
            <h1 className="text-6xl md:text-7xl font-black tracking-tight">GROOVEFLIX<span className="text-fuchsia-400">.</span></h1>
            <p className="mt-3 text-white/50">{t('grooveflix.subtitle')}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadItems()}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/10 transition"
            >
              <RotateCw className="w-4 h-4" /> {t('grooveflix.reload')}
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowUploader(true)}
                className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-fuchsia-200 hover:bg-fuchsia-500/20 transition"
              >
                <Plus className="w-4 h-4" /> {t('grooveflix.upload')}
              </button>
            )}
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-2 rounded-full text-xs uppercase tracking-widest border ${categoryFilter === cat ? 'bg-fuchsia-500/25 border-fuchsia-500 text-fuchsia-100' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}>
              {cat === 'all' ? t('grooveflix.filter.all') : cat}
            </button>
          ))}
        </div>

        {debugInfo && (
          <div className="rounded-xl bg-white/5 border border-fuchsia-500/20 p-4 text-xs">
            <p className="text-fuchsia-300 font-bold mb-2">DEBUG INFO:</p>
            <p>Total itens DB: {debugInfo.totalItems}</p>
            <p>Itens Grooveflix: {debugInfo.grooveflixItems}</p>
            {debugInfo.sampleItem && (
              <div className="mt-2 text-white/70">
                <p>Sample ID: {debugInfo.sampleItem.id}</p>
                <p>Audio: {debugInfo.sampleItem.audioPath || 'N/A'}</p>
                <p>Cover: {debugInfo.sampleItem.coverPath || 'N/A'}</p>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="p-12 rounded-2xl bg-white/5 border border-white/10 text-center">
            <div className="w-12 h-12 border-4 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin mx-auto mb-4" />
            {t('grooveflix.loading')}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="text-xl font-bold mb-2">{t('grooveflix.empty.title')}</p>
            <p className="text-white/60">
              {!userId ? t('grooveflix.empty.login') :
               debugInfo?.grooveflixItems === 0 ? t('grooveflix.empty.upload') :
               t('grooveflix.empty.filter')}
            </p>
          </div>
        ) : (
          <>
            <GrooveflixRow
              title={`Todos (${filteredItems.length})`}
              items={filteredItems}
              onPick={handleTrackPick}
              onDelete={isAdmin ? handleDelete : undefined}
              canDelete={isAdmin}
            />
          </>
        )}

        {selectedTrack && (
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-4 border-t border-white/10">
            <div className="max-w-[1600px] mx-auto flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{selectedTrack.title}</p>
                <p className="text-sm text-white/60 truncate">{selectedTrack.artist}</p>
              </div>
              {selectedTrack.audioPath ? (
                <button
                  onClick={handlePlayTrack}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-bold uppercase tracking-wider hover:shadow-lg hover:shadow-fuchsia-500/30 transition"
                >
                  <Music className="w-5 h-5" /> {t('grooveflix.play')}
                </button>
              ) : (
                <span className="text-white/40 text-sm">{t('grooveflix.noAudio')}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <GrooveflixUploader
        isOpen={showUploader}
        onClose={() => setShowUploader(false)}
        onSuccess={() => {
          setShowUploader(false);
          loadItems();
        }}
        isAdmin={isAdmin}
      />
    </div>
  );
}
