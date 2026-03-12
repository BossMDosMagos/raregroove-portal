import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function GrooveflixPlayer({ queue, activeId, onChangeActiveId, onProgress }) {
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isPlaying, setIsPlaying] = useState(false);

  const tracks = useMemo(() => queue || [], [queue]);
  const activeIndex = useMemo(() => tracks.findIndex((t) => t.id === activeId), [tracks, activeId]);
  const active = activeIndex >= 0 ? tracks[activeIndex] : null;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
  }, [volume]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || !active) return;
    if (!active.audioUrl) {
      toast.error('INDISPONÍVEL', {
        description: 'Este CD ainda não possui streaming configurado.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    if (el.paused) {
      try {
        await el.play();
      } catch {
        toast.error('FALHA NO PLAYER', {
          description: 'Seu navegador bloqueou o autoplay. Clique novamente.',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
      return;
    }

    el.pause();
  };

  const prev = () => {
    if (activeIndex <= 0) return;
    onChangeActiveId(tracks[activeIndex - 1].id);
  };

  const next = () => {
    if (activeIndex < 0 || activeIndex >= tracks.length - 1) return;
    onChangeActiveId(tracks[activeIndex + 1].id);
  };

  const seek = (value) => {
    const el = audioRef.current;
    if (!el) return;
    const v = Number(value || 0);
    el.currentTime = v;
    setCurrentTime(v);
  };

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 border-t border-fuchsia-500/20 backdrop-blur-xl">
      <audio
        ref={audioRef}
        src={active?.audioUrl || undefined}
        preload="metadata"
        onLoadStart={() => {
          setCurrentTime(0);
          setDuration(0);
          setIsPlaying(false);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const seconds = e.currentTarget.currentTime || 0;
          setCurrentTime(seconds);
          onProgress?.(active?.id, seconds, e.currentTarget.duration || 0);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (activeIndex >= 0 && activeIndex < tracks.length - 1) onChangeActiveId(tracks[activeIndex + 1].id);
        }}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0">
            {active?.coverUrl ? (
              <img src={active.coverUrl} alt={active.title || 'cover'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-fuchsia-500/20 via-purple-500/10 to-black" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-white font-black uppercase tracking-wider text-xs truncate">
                  {active?.title || 'GROOVEFLIX'}
                </div>
                <div className="text-white/50 text-[11px] truncate">
                  {active?.artist || (active ? 'RareGroove Vault' : 'Selecione um álbum')}
                </div>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <div className="led-display">
                  <span className="led-text">{formatTime(currentTime)}</span>
                  <span className="led-text" style={{ opacity: 0.35, margin: '0 8px' }}>/</span>
                  <span className="led-text">{formatTime(duration)}</span>
                </div>
              </div>
            </div>

            <div className="mt-2">
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500 rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.25}
                value={Math.min(duration || 0, currentTime)}
                onChange={(e) => seek(e.target.value)}
                className="w-full mt-2 accent-fuchsia-500"
                aria-label="seek"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={activeIndex <= 0}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition disabled:opacity-30"
            >
              <SkipBack className="w-5 h-5 mx-auto" />
            </button>
            <button
              type="button"
              onClick={toggle}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-purple-500/20 border border-fuchsia-500/30 text-white hover:border-fuchsia-500/60 transition gf-glow"
            >
              {isPlaying ? <Pause className="w-6 h-6 mx-auto" /> : <Play className="w-6 h-6 mx-auto" />}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={activeIndex < 0 || activeIndex >= tracks.length - 1}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition disabled:opacity-30"
            >
              <SkipForward className="w-5 h-5 mx-auto" />
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-end gap-1 h-10 w-16">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="gf-vu-bar w-2 rounded-sm bg-gradient-to-t from-fuchsia-500 to-purple-500"
                  style={{ height: `${12 + i * 4}px` }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-white/60" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 accent-fuchsia-500"
                aria-label="volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

