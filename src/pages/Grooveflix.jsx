import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { Sparkles, Plus, RotateCw, Disc, Trash2, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Howler } from 'howler';
import GrooveflixUploader from '../components/GrooveflixUploader';
import CoverFlow3D from '../components/CoverFlow3D';
import EqualizerBackground from '../components/EqualizerBackground';
import { useI18n } from '../contexts/I18nContext.jsx';

import { useGrooveflixPlayer } from '../hooks/useGrooveflixPlayer.js';
import AudioControlPanel from '../components/AudioControlPanel.jsx';

const CATEGORY_OPTIONS = ['all', 'single', 'album', 'coletanea', 'iso'];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
  const player = useGrooveflixPlayer();
  const { 
    playTrackFromQueue,
    currentTrack: globalCurrentTrack, 
    isPlaying: isAudioContextPlaying, 
    clearQueue,
    loadAndPlayTrack,
    playAlbum,
    volume,
    setVolume,
    play,
    pause,
    stop,
    seek,
    queue,
    currentTime,
    duration,
  } = player;

  const [focusedAlbum, setFocusedAlbum] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const focusedAlbumRef = useRef(null);
  const currentTrackIndexRef = useRef(-1);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);

  const handleOpenDeleteModal = () => {
    if (!focusedAlbum) {
      toast.error('Selecione um álbum primeiro');
      return;
    }
    setDeletingItem(focusedAlbum);
    setShowDeleteModal(true);
  };

  const handleDeleteFiles = async () => {
    if (!deletingItem) return;
    
    setIsDeleting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/grooveflix-delete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}`, 
          'apikey': SUPABASE_ANON_KEY 
        },
        body: JSON.stringify({ itemId: deletingItem.id }),
      });
      
      const result = await response.json();
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      toast.success(`Arquivos de "${deletingItem.title}" deletados com sucesso!`);
      
      setItems(prev => prev.filter(item => item.id !== deletingItem.id));
      setShowDeleteModal(false);
      setDeletingItem(null);
      
      if (focusedAlbum?.id === deletingItem.id) {
        setFocusedAlbum(null);
      }
      
      loadItems();
      
    } catch (e) {
      console.error('Delete error:', e);
      toast.error('Erro ao deletar arquivos');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePlayTrack = useCallback((album, trackIndex) => {
    console.log('[Grooveflix] handlePlayTrack:', album?.title, 'track:', trackIndex);
    setCurrentTrackIndex(trackIndex);
    playAlbum(album, trackIndex);
  }, [playAlbum]);

  const handlePlay = useCallback(() => {
    console.log('[Grooveflix] handlePlay called');
    console.log('[Grooveflix] isPlaying:', isAudioContextPlaying);
    console.log('[Grooveflix] focusedAlbum:', focusedAlbumRef.current?.title || 'NULL');
    
    if (isAudioContextPlaying) {
      pause();
      return;
    }
    
    const album = focusedAlbumRef.current;
    if (!album) {
      console.warn('[Grooveflix] No album focused!');
      return;
    }
    
    const grooveflixData = album.metadata?.grooveflix || {};
    const audioFiles = grooveflixData.audio_files || [];
    
    if (audioFiles.length === 0) {
      console.warn('[Grooveflix] Album has no audio files!');
      return;
    }
    
    const trackIdx = currentTrackIndexRef.current >= 0 ? currentTrackIndexRef.current : 0;
    handlePlayTrack(album, trackIdx);
  }, [isAudioContextPlaying, pause, handlePlayTrack]);

  useEffect(() => {
    focusedAlbumRef.current = focusedAlbum;
  }, [focusedAlbum]);

  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);

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

  const handlePause = useCallback(() => pause(), [pause]);
  const handleStop = useCallback(() => { stop(); clearQueue(); }, [stop, clearQueue]);
  const handleEject = useCallback(() => clearQueue(), [clearQueue]);

  const handlePreviousTrack = useCallback(() => {
    const currentIdx = currentTrackIndexRef.current;
    if (currentIdx > 0) {
      const album = focusedAlbumRef.current;
      if (album) {
        handlePlayTrack(album, currentIdx - 1);
      }
    }
  }, [handlePlayTrack]);

  const handleNextTrack = useCallback(() => {
    const currentIdx = currentTrackIndexRef.current;
    if (currentIdx >= 0) {
      const album = focusedAlbumRef.current;
      if (album) {
        const grooveflixData = album.metadata?.grooveflix || {};
        const audioFiles = grooveflixData.audio_files || [];
        if (currentIdx < audioFiles.length - 1) {
          handlePlayTrack(album, currentIdx + 1);
        }
      }
    }
  }, [handlePlayTrack]);

  const lastTrackIdRef = useRef(null);

  useEffect(() => {
    const trackId = globalCurrentTrack?.id;
    if (trackId && trackId !== lastTrackIdRef.current && globalCurrentTrack.audioPath) {
      lastTrackIdRef.current = trackId;
      loadAndPlayTrack(globalCurrentTrack);
    }
  }, [globalCurrentTrack, loadAndPlayTrack]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [showUploader, setShowUploader] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return items;
    return items.filter(item => item.category === categoryFilter);
  }, [items, categoryFilter]);

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

      if (error) throw error;

      const allItems = data || [];
      const grooveflixItems = allItems.filter(item =>
        item.metadata?.source === 'grooveflix' && item.metadata?.grooveflix?.category
      );

      setDebugInfo({
        totalItems: allItems.length,
        grooveflixItems: grooveflixItems.length,
      });

      setItems(normalizeTracks(grooveflixItems));
      setLoading(false);

    } catch (e) {
      toast.error(t('grooveflix.error.load'), { description: e.message });
      setItems([]);
    }
  }, [userId, t]);

  useEffect(() => {
    if (userId) loadItems();
  }, [userId, loadItems]);

  useEffect(() => {
    if (items.length > 0 && !focusedAlbum) {
      console.log('[Grooveflix] Setting first album as focused:', items[0].title);
      setFocusedAlbum(items[0]);
    }
  }, [items, focusedAlbum]);

  return (
    <div className="min-h-screen bg-black text-white overflow-y-auto">
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

      <div className="relative mx-auto px-4 md:px-6 pt-24 pb-8" style={{ marginLeft: '340px', marginRight: '340px' }}>
        <header className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-4 mb-6">
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
              <button onClick={() => loadItems()} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/10 transition">
                <RotateCw className="w-4 h-4" /> {t('grooveflix.reload')}
              </button>
              <button 
                onClick={handleOpenDeleteModal} 
                disabled={!focusedAlbum}
                className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-300 hover:bg-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" /> Deletar
              </button>
              {isAdmin && (
                <button onClick={() => setShowUploader(true)} className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-fuchsia-200 hover:bg-fuchsia-500/20 transition">
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
              {!userId ? t('grooveflix.empty.login') : debugInfo?.grooveflixItems === 0 ? t('grooveflix.empty.upload') : t('grooveflix.empty.filter')}
            </p>
            {isAdmin && (
              <button onClick={() => setShowUploader(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-full font-bold">
                <Plus className="w-5 h-5" />
                Adicionar Primeiro Álbum
              </button>
            )}
          </div>
        ) : (
          <CoverFlow3D
            items={filteredItems}
            focusedIndex={focusedIndex}
            onUpdateFocus={(item, index) => {
              setFocusedAlbum(item);
              setFocusedIndex(index);
            }}
            onAlbumSelect={(item, index) => {
              setFocusedAlbum(item);
              setFocusedIndex(index);
            }}
            isAdmin={isAdmin}
            onAlbumDeleted={(id) => setItems(prev => prev.filter(item => item.id !== id))}
            currentTrack={globalCurrentTrack}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isAudioContextPlaying}
            currentTime={currentTime}
            duration={duration}
            onSeek={seek}
            playAlbum={playAlbum}
          />
        )}
      </div>

      <GrooveflixUploader
        isOpen={showUploader}
        onClose={() => setShowUploader(false)}
        onSuccess={() => { setShowUploader(false); loadItems(); }}
        isAdmin={isAdmin}
      />

      {showDeleteModal && deletingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !isDeleting && setShowDeleteModal(false)} />
          <div className="relative bg-gradient-to-b from-gray-900 to-black border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-red-500/20">
            <button 
              onClick={() => !isDeleting && setShowDeleteModal(false)}
              disabled={isDeleting}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirmar Exclusão</h3>
                <p className="text-sm text-white/60">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <div className="bg-black/30 rounded-xl p-4 mb-6">
              <p className="text-white font-medium mb-2">{deletingItem.title}</p>
              <p className="text-white/60 text-sm">{deletingItem.artist}</p>
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-red-400 text-xs">Isso deletará permanentemente:</p>
                <ul className="text-white/50 text-xs mt-1 space-y-1">
                  <li>• Capa do álbum</li>
                  <li>• Todos os arquivos de áudio</li>
                  <li>• Dados do banco de dados</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 font-bold text-sm hover:bg-white/5 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteFiles}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm hover:shadow-lg hover:shadow-red-500/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deletando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Deletar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
