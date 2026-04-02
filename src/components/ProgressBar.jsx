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
    <div className="w-full px-4 py-2">
      <div 
        className="relative h-2 bg-white/10 rounded-full cursor-pointer group"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
      >
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-fuchsia-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/50 mt-1 px-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
});

export default ProgressBar;
