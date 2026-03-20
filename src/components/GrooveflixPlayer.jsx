import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { 
  Download, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, 
  ListMusic, Maximize, Minimize, Radio, Headphones, Disc3, 
  Shuffle, Repeat, Repeat1, Heart, Share2, MoreHorizontal,
  ChevronUp, ChevronDown, X, Upload, Clock, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import WebampPlayer from './WebampPlayer';

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

export default function GrooveflixPlayer({ queue, activeId, onChangeActiveId, onProgress, canDownload = false, trialing = false }) {
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showWebamp, setShowWebamp] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isPlaying, setIsPlaying] = useState(false);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState('none');
  const [shuffleOn, setShuffleOn] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [audioQuality, setAudioQuality] = useState('HI-RES');

  const tracks = useMemo(() => queue || [], [queue]);
  const activeIndex = useMemo(() => tracks.findIndex((t) => t.id === activeId), [tracks, activeId]);
  const active = activeIndex >= 0 ? tracks[activeIndex] : null;

  const presign = async ({ filePath, mode, filename }) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const user = (await supabase.auth.getUser()).data.user;
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token || supabaseAnonKey;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/b2-presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({ file_path: filePath, mode, filename: filename || undefined, userId: user?.id })
    });
    
    const data = await response.json();
    if (!response.ok || !data?.url) {
      console.error('[B2-Presign] Erro:', response.status, data);
      const err = new Error(String(data?.error || `Erro ${response.status}`));
      err.code = data?.error || null;
      throw err;
    }
    return String(data.url || '');
  };

  const resolveAudioUrl = async ({ autoPlay }) => {
    const filePath = active?.audioPath ? String(active.audioPath) : '';
    if (!filePath) { setResolvedAudioUrl(null); return; }
    if (resolving) return;
    setResolving(true);
    try {
      const url = await presign({ filePath, mode: 'stream' });
      if (!url) throw new Error('Link inválido');
      setResolvedAudioUrl(url);
      setAudioQuality('FLAC');
      const el = audioRef.current;
      if (el && autoPlay) {
        try { await el.play(); } catch { void 0; }
      }
    } catch (e) {
      if (String(e?.code || '').toLowerCase() === 'trial_expired') {
        toast.error('TRIAL EXPIRADO', { description: 'O limite do trial foi atingido.', style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' } });
        window.location.href = '/plans?restricted=1';
        return;
      }
      toast.error('ERRO NO COFRE', { description: e.message, style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' } });
      setResolvedAudioUrl(null);
    } finally { setResolving(false); }
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    setResolvedAudioUrl(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    if (!active?.audioPath) return;
    void resolveAudioUrl({ autoPlay: false });
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || !active) return;
    if (!active.audioPath) {
      toast.error('INDISPONÍVEL', { description: 'Este CD ainda não possui streaming.', style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' } });
      return;
    }
    if (resolving) return; // Evitar multi-chamadas
    if (!resolvedAudioUrl) {
      try {
        await resolveAudioUrl({ autoPlay: true });
      } catch (e) {
        // Erro já mostrado no resolveAudioUrl
        return;
      }
    }
    if (el.paused) {
      try { await el.play(); } catch {
        toast.error('FALHA NO PLAYER', { description: 'Clique novamente.', style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' } });
      }
      return;
    }
    el.pause();
  };

  const prev = useCallback(() => {
    if (activeIndex <= 0) return;
    const nextIndex = shuffleOn ? Math.floor(Math.random() * tracks.length) : activeIndex - 1;
    onChangeActiveId(tracks[nextIndex].id);
  }, [activeIndex, shuffleOn, tracks, onChangeActiveId]);

  const next = useCallback(() => {
    if (activeIndex < 0 || activeIndex >= tracks.length - 1) return;
    if (repeatMode === 'one') {
      const el = audioRef.current;
      if (el) { el.currentTime = 0; el.play().catch(() => {}); }
      return;
    }
    const nextIndex = shuffleOn ? Math.floor(Math.random() * tracks.length) : activeIndex + 1;
    if (nextIndex >= tracks.length) {
      if (repeatMode === 'all') onChangeActiveId(tracks[0].id);
      return;
    }
    onChangeActiveId(tracks[nextIndex].id);
  }, [activeIndex, shuffleOn, tracks, repeatMode, onChangeActiveId]);

  const seek = (value) => {
    const el = audioRef.current;
    if (!el) return;
    const v = Number(value || 0);
    el.currentTime = v;
    setCurrentTime(v);
  };

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const onBlockedDownload = () => {
    toast.message('ASSINATURA REQUERIDA', { description: trialing ? 'Trial ativo.' : 'Ative um plano para downloads.', style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' } });
  };

  const onDownload = async ({ filePath, filename }) => {
    if (!filePath) return;
    if (!canDownload) { onBlockedDownload(); return; }
    try {
      const url = await presign({ filePath, mode: 'download', filename });
      if (!url) throw new Error('Link inválido');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error('ERRO NO DOWNLOAD', { description: e.message, style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' } });
    }
  };

  const toggleMute = () => setIsMuted(!isMuted);

  const cycleRepeat = () => {
    const modes = ['none', 'all', 'one'];
    const idx = modes.indexOf(repeatMode);
    setRepeatMode(modes[(idx + 1) % modes.length]);
  };

  const progressBars = useMemo(() => Array.from({ length: 32 }), []);

  return (
    <>
      <audio
        ref={audioRef}
        src={resolvedAudioUrl || undefined}
        preload="metadata"
        onLoadStart={() => { setCurrentTime(0); setDuration(0); setIsPlaying(false); setIsBuffering(true); }}
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration || 0); setIsBuffering(false); }}
        onTimeUpdate={(e) => {
          const seconds = e.currentTarget.currentTime || 0;
          setCurrentTime(seconds);
          onProgress?.(active?.id, seconds, e.currentTarget.duration || 0);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); next(); }}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
      />

      {!isExpanded ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black via-black/95 to-black/80 backdrop-blur-2xl border-t border-white/5">
          <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-3">
            <div className="flex items-center gap-4">
              <div 
                className="group relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0 cursor-pointer shadow-2xl"
                onClick={() => setIsExpanded(true)}
              >
                {active?.coverUrl ? (
                  <img src={active.coverUrl} alt={active.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-fuchsia-500/30 via-purple-500/20 to-black flex items-center justify-center">
                    <Disc3 className="w-8 h-8 text-fuchsia-400/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize className="w-5 h-5 text-white/70" />
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold uppercase tracking-wide text-sm truncate">
                        {active?.title || 'GROOVEFLIX'}
                      </span>
                      {audioQuality && (
                        <span className="px-2 py-0.5 rounded bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                          {audioQuality}
                        </span>
                      )}
                    </div>
                    <div className="text-white/50 text-xs truncate flex items-center gap-2">
                      {active?.artist || (active ? 'RareGroove Vault' : 'Selecione um álbum')}
                      {isBuffering && <span className="text-fuchsia-400 text-[10px]">• Buffering...</span>}
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-3">
                    <div className="flex items-center gap-1 h-8">
                      {progressBars.map((_, i) => (
                        <div
                          key={i}
                          className={`gf-vu-bar w-1 rounded-full transition-all duration-150 ${
                            (i / 32) * 100 < progressPct 
                              ? 'bg-gradient-to-t from-fuchsia-500 to-purple-400' 
                              : 'bg-white/10'
                          }`}
                          style={{ height: `${8 + Math.sin(i * 0.3) * 6}px` }}
                        />
                      ))}
                    </div>
                    <div className="led-display text-[11px]">
                      <span className="led-text text-fuchsia-300">{formatTime(currentTime)}</span>
                      <span className="led-text text-white/30 mx-1">/</span>
                      <span className="led-text text-white/50">{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>

                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden relative group">
                  <div className="h-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-fuchsia-400 rounded-full transition-all duration-100" style={{ width: `${progressPct}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `calc(${progressPct}% - 6px)` }} />
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.25}
                    value={Math.min(duration || 0, currentTime)}
                    onChange={(e) => seek(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="seek"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 md:gap-2">
                <button type="button" onClick={prev} disabled={activeIndex <= 0} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition disabled:opacity-30">
                  <SkipBack className="w-5 h-5 mx-auto" />
                </button>
                <button type="button" onClick={toggle} className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 border border-fuchsia-400/30 text-white hover:scale-105 hover:border-fuchsia-400/60 transition-all duration-300 shadow-lg shadow-fuchsia-500/20 relative overflow-hidden">
                  {isBuffering ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-6 h-6 mx-auto" />
                  ) : (
                    <Play className="w-6 h-6 mx-auto ml-0.5" />
                  )}
                </button>
                <button type="button" onClick={next} disabled={activeIndex < 0 || activeIndex >= tracks.length - 1} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition disabled:opacity-30">
                  <SkipForward className="w-5 h-5 mx-auto" />
                </button>
              </div>

              <div className="hidden lg:flex items-center gap-3">
                <button type="button" onClick={() => setShuffleOn(!shuffleOn)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${shuffleOn ? 'text-fuchsia-400' : 'text-white/40 hover:text-white/70'}`}>
                  <Shuffle className="w-4 h-4" />
                </button>
                <button type="button" onClick={cycleRepeat} className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${repeatMode !== 'none' ? 'text-fuchsia-400' : 'text-white/40 hover:text-white/70'}`}>
                  {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </button>
                
                <div className="relative" onMouseEnter={() => setShowVolumeSlider(true)} onMouseLeave={() => setShowVolumeSlider(false)}>
                  <button type="button" onClick={toggleMute} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition">
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  {showVolumeSlider && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-charcoal-deep border border-white/10 rounded-2xl p-4 shadow-2xl w-40">
                      <input type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume} onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }} className="w-full accent-fuchsia-500" />
                      <div className="text-center text-[10px] text-white/50 mt-2">{Math.round((isMuted ? 0 : volume) * 100)}%</div>
                    </div>
                  )}
                </div>

                <button type="button" onClick={() => setShowQueue(!showQueue)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${showQueue ? 'text-fuchsia-400 bg-fuchsia-500/10' : 'text-white/60 hover:text-white'}`}>
                  <ListMusic className="w-5 h-5" />
                </button>

                <button type="button" onClick={() => setIsExpanded(true)} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition">
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-black via-charcoal-deep to-black flex">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/30" />
            {active?.coverUrl && <img src={active.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl" />}
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-fuchsia-500/10 rounded-full blur-[150px]" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
          </div>

          <div className="relative w-full h-full flex">
            <div className="flex-1 flex flex-col p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                    <Radio className="w-4 h-4 text-fuchsia-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Grooveflix</span>
                  </div>
                  {audioQuality && (
                    <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <Headphones className="w-3 h-3" /> {audioQuality} LOSSLESS
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => setIsExpanded(false)} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition">
                  <Minimize className="w-5 h-5 mx-auto" />
                </button>
              </div>

              <div className="flex-1 flex items-center justify-center">
                <div className="relative">
                  <div className="w-[400px] h-[400px] md:w-[500px] md:h-[500px] rounded-3xl overflow-hidden shadow-2xl shadow-fuchsia-500/20 border border-white/10">
                    {active?.coverUrl ? (
                      <img src={active.coverUrl} alt={active.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-fuchsia-500/30 via-purple-500/20 to-black flex items-center justify-center">
                        <Disc3 className="w-32 h-32 text-fuchsia-400/30" />
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
                    <button type="button" className="w-12 h-12 rounded-full bg-white/10 border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition">
                      <Heart className="w-5 h-5 mx-auto" />
                    </button>
                    <button type="button" className="w-12 h-12 rounded-full bg-white/10 border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition">
                      <Share2 className="w-5 h-5 mx-auto" />
                    </button>
                    <button type="button" className="w-12 h-12 rounded-full bg-white/10 border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition">
                      <MoreHorizontal className="w-5 h-5 mx-auto" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="text-center">
                  <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">{active?.title || 'GROOVEFLIX'}</h2>
                  <p className="text-white/50 text-lg mt-1">{active?.artist || 'RareGroove Vault'}</p>
                </div>

                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-fuchsia-400 rounded-full transition-all duration-100" style={{ width: `${progressPct}%` }} />
                  <input type="range" min={0} max={duration || 0} step={0.25} value={Math.min(duration || 0, currentTime)} onChange={(e) => seek(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-fuchsia-300 font-medium">{formatTime(currentTime)}</span>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-white/30" />
                    <span className="text-white/50">{formatDuration(duration)}</span>
                  </div>
                  <span className="text-white/50">{formatTime(duration)}</span>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <button type="button" onClick={() => setShuffleOn(!shuffleOn)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${shuffleOn ? 'text-fuchsia-400 bg-fuchsia-500/10' : 'text-white/40 hover:text-white/70'}`}>
                    <Shuffle className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={prev} disabled={activeIndex <= 0} className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition disabled:opacity-30">
                    <SkipBack className="w-6 h-6 mx-auto" />
                  </button>
                  <button type="button" onClick={toggle} className="w-20 h-20 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-purple-600 border border-fuchsia-400/30 text-white hover:scale-105 hover:border-fuchsia-400/60 transition-all duration-300 shadow-xl shadow-fuchsia-500/30 relative overflow-hidden">
                    {isBuffering ? (
                      <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-10 h-10 mx-auto" />
                    ) : (
                      <Play className="w-10 h-10 mx-auto ml-1" />
                    )}
                  </button>
                  <button type="button" onClick={next} disabled={activeIndex < 0 || activeIndex >= tracks.length - 1} className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition disabled:opacity-30">
                    <SkipForward className="w-6 h-6 mx-auto" />
                  </button>
                  <button type="button" onClick={cycleRepeat} className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${repeatMode !== 'none' ? 'text-fuchsia-400 bg-fuchsia-500/10' : 'text-white/40 hover:text-white/70'}`}>
                    {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={toggleMute} className="text-white/40 hover:text-white transition">
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume} onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }} className="w-24 accent-fuchsia-500" />
                  </div>
                  
                  <button
                    onClick={() => setShowWebamp(!showWebamp)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition ${showWebamp ? 'border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-300' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40'}`}
                  >
                    <Radio className="w-3 h-3" /> Webamp
                  </button>
                  
                  {(active?.isoPath || active?.bookletPath) && (
                    <div className="flex items-center gap-2">
                      {active?.bookletPath && (
                        <button onClick={() => onDownload({ filePath: active.bookletPath, filename: `${active.title || 'encarte'}.pdf` })} disabled={!canDownload} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition ${canDownload ? 'border-white/20 text-white/70 hover:text-white hover:border-white/40' : 'border-white/10 text-white/30'}`}>
                          <Upload className="w-3 h-3" /> Encarte
                        </button>
                      )}
                      {active?.isoPath && (
                        <button onClick={() => onDownload({ filePath: active.isoPath, filename: `${active.title || 'cd'}.iso` })} disabled={!canDownload} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition ${canDownload ? 'border-white/20 text-white/70 hover:text-white hover:border-white/40' : 'border-white/10 text-white/30'}`}>
                          <Download className="w-3 h-3" /> ISO
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQueue && (
        <div className="fixed bottom-20 right-4 w-80 max-h-96 bg-charcoal-deep/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/70 flex items-center gap-2">
              <ListMusic className="w-4 h-4" /> Queue
            </h3>
            <button onClick={() => setShowQueue(false)} className="text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-72 p-2">
            {tracks.map((trk, idx) => (
              <div key={trk.id} onClick={() => { onChangeActiveId(trk.id); setShowQueue(false); }} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${idx === activeIndex ? 'bg-fuchsia-500/10 border border-fuchsia-500/20' : 'hover:bg-white/5'}`}>
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                  {trk.coverUrl ? <img src={trk.coverUrl} alt="" className="w-full h-full object-cover" /> : <Disc3 className="w-5 h-5 text-white/20 mx-auto my-2" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${idx === activeIndex ? 'text-fuchsia-300' : 'text-white'}`}>{trk.title}</p>
                  <p className="text-[10px] text-white/40 truncate">{trk.artist}</p>
                </div>
                {idx === activeIndex && isPlaying && <div className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {showWebamp && (
        <WebampPlayer 
          track={active} 
          isPlaying={isPlaying}
          onPlay={toggle}
          onPause={toggle}
          volume={isMuted ? 0 : volume}
        />
      )}
    </>
  );
}