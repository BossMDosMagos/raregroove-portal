import React, { memo, useCallback } from 'react';

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const ProgressBar = memo(function ProgressBar({ 
  currentTime = 0, 
  duration = 0, 
  onSeek 
}) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  const handleClick = useCallback((e) => {
    if (!onSeek || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(percent * duration);
  }, [onSeek, duration]);

  const handleMouseMove = useCallback((e) => {
    if (!onSeek || duration <= 0 || !e.buttons) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(percent * duration);
  }, [onSeek, duration]);

  return (
    <div 
      className="w-full px-6 py-3 bg-black/40 rounded-xl border border-white/10 shadow-2xl"
      style={{ minWidth: '300px', zIndex: 99999, position: 'relative' }}
    >
      <div 
        className="relative h-3 bg-gradient-to-b from-white/5 to-white/10 rounded-full cursor-pointer group"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        style={{ overflow: 'visible' }}
      >
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 via-cyan-500 to-fuchsia-500 rounded-full shadow-lg shadow-cyan-500/30 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg shadow-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ left: `calc(${progress}% - 8px)`, zIndex: 10 }}
        />
      </div>
      <div className="flex justify-between text-xs text-white/60 mt-1.5 px-1 font-mono">
        <span>{formatTime(currentTime)}</span>
        <span className="text-cyan-400/70">{formatTime(duration)}</span>
      </div>
    </div>
  );
});

export default ProgressBar;
