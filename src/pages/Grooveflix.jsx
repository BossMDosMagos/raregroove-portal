import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Film, Sparkles, Plus, Music, RotateCw, Disc } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Howler } from 'howler';
import GrooveflixUploader from '../components/GrooveflixUploader';
import CoverFlow3D from '../components/CoverFlow3D';
import EqualizerBackground from '../components/EqualizerBackground';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useSubscription } from '../contexts/SubscriptionContext.jsx';

import { useGrooveflixPlayer } from '../hooks/useGrooveflixPlayer.js';
import AudioControlPanel from '../components/AudioControlPanel.jsx';

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
    const tracklist = grooveflix.tracklist || [];

    return {
      id: item.id,
      title: item.title || 'Sem título',
      artist: item.artist || 'Desconhecido',
      coverUrl,
      coverPath,
      category,
      audioPath,
      audioFiles,
      tracklist,
      metadata,
      raw: item,
    };
  }).filter((track) => track.id);
}

export default function Grooveflix() {
  const { t } = useI18n();
  const { isTrialing, isActive } = useSubscription();
  const player = useGrooveflixPlayer();
  const { 
    setQueue, 
    playTrack, 
    currentTrack: globalCurrentTrack, 
    isPlaying: isAudioContextPlaying, 
    playAlbum, 
    pauseTrack, 
    resumeTrack, 
    clearQueue,
    loadAndPlayTrack,
    volume,
    setVolume,
    currentTime,
    duration,
    seek,
    play,
    pause,
    stop,
    queue
  } = player;

  const handlePlay = useCallback(() => {
    if (isAudioContextPlaying) {
      pause();
    } else if (globalCurrentTrack) {
      play();
    }
  }, [isAudioContextPlaying, globalCurrentTrack, pause, play]);

  useEffect(() => {
    const unlockAudio = () => {
      const ctx = Howler.ctx;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const handlePause = useCallback(() => {
    pause();
  }, [pause]);

  const handleStop = useCallback(() => {
    stop();
    clearQueue();
  }, [stop, clearQueue]);

  const handlePreviousTrack = useCallback(() => {
    const currentIndex = queue.findIndex(t => t.id === globalCurrentTrack?.id);
    if (currentIndex > 0) {
      const prevTrack = queue[currentIndex - 1];
      playTrack(prevTrack);
    }
  }, [queue, globalCurrentTrack, playTrack]);

  const handleNextTrack = useCallback(() => {
    const currentIndex = queue.findIndex(t => t.id === globalCurrentTrack?.id);
    if (currentIndex >= 0 && currentIndex < queue.length - 1) {
      const nextTrack = queue[currentIndex + 1];
      playTrack(nextTrack);
    }
  }, [queue, globalCurrentTrack, playTrack]);

  const handleEject = useCallback(() => {
    clearQueue();
  }, [clearQueue]);

  const lastTrackIdRef = useRef(null);

  useEffect(() => {
    const trackId = globalCurrentTrack?.id;
    if (trackId && trackId !== lastTrackIdRef.current && globalCurrentTrack.audioPath) {
      lastTrackIdRef.current = trackId;
      loadAndPlayTrack(globalCurrentTrack);
    }
  }, [globalCurrentTrack]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [focusedItem, setFocusedItem] = useState(null);
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
      }
    };
    init();
  }, []);

  const loadItems = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setDebugInfo(null);

    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, title, artist, image_url, metadata, created_at')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(120);

      if (error) {
        throw error;
      }

      const allItems = data || [];
      const grooveflixItems = allItems.filter(item =>
        item.metadata?.source === 'grooveflix' && item.metadata?.grooveflix?.category
      );

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

      setItems(tracks);
      setLoading(false);

    } catch (e) {
      toast.error(t('grooveflix.error.load'), { description: e.message });
      setItems([]);
    }
  }, [userId, t]);

  useEffect(() => {
    if (userId) {
      loadItems();
    }
  }, [userId]);

  const filteredItems = items.filter((item) => {
    if (categoryFilter === 'all') return true;
    return item.category === categoryFilter;
  });

  return (
    <div className="h-screen bg-black text-white overflow-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <EqualizerBackground isPlaying={isAudioContextPlaying} />
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal-deep via-black to-black" />
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-fuchsia-600/10 blur-[150px]" />
        <div className="absolute top-20 right-[-200px] w-[700px] h-[700px] bg-purple-600/8 blur-[160px]" />
      </div>

      <AudioControlPanel
        isPlaying={isAudioContextPlaying}
        volume={volume}
        onVolumeChange={setVolume}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onPreviousTrack={handlePreviousTrack}
        onNextTrack={handleNextTrack}
        onEject={handleEject}
      />

      <div className="relative mx-auto px-4 md:px-6 pt-20 overflow-hidden" style={{ marginLeft: '340px', marginRight: '340px', maxHeight: 'calc(100vh - 80px)' }}>
        <header className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-[10px] uppercase tracking-widest text-fuchsia-300">
                <Sparkles className="w-3 h-3" /> HI-FI STREAMING
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight">GROOVEFLIX<span className="text-fuchsia-400">.</span></h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-2 rounded-full text-xs uppercase tracking-widest border ${categoryFilter === cat ? 'bg-fuchsia-500/25 border-fuchsia-500 text-fuchsia-100' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}>
                {cat === 'all' ? t('grooveflix.filter.all') : cat}
              </button>
            ))}
            
            <div className="flex items-center gap-2 ml-4">
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
          </div>
        </header>

        {loading ? (
          <div className="p-12 rounded-2xl bg-white/5 border border-white/10 text-center">
            <div className="w-12 h-12 border-4 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin mx-auto mb-4" />
            {t('grooveflix.loading')}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white/5 border border-white/10 text-center">
            <Disc className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-xl font-bold mb-2">{t('grooveflix.empty.title')}</p>
            <p className="text-white/60 mb-6">
              {!userId ? t('grooveflix.empty.login') :
               debugInfo?.grooveflixItems === 0 ? t('grooveflix.empty.upload') :
               t('grooveflix.empty.filter')}
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowUploader(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-full font-bold"
              >
                <Plus className="w-5 h-5" />
                Adicionar Primeiro Álbum
              </button>
            )}
          </div>
        ) : (
          <CoverFlow3D
            items={filteredItems}
            onUpdateFocus={setFocusedItem}
            onOpenUploader={() => setShowUploader(true)}
            isAdmin={isAdmin}
            onAlbumDeleted={(id) => {
              setItems(prev => prev.filter(item => item.id !== id));
            }}
            currentTrack={globalCurrentTrack}
            isPlaying={isAudioContextPlaying}
          />
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
