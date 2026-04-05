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
  onSeek,
  isPlaying = false 
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
      className="px-4 py-3 bg-black/40 rounded-xl border border-white/10 shadow-2xl"
      style={{ width: '580px', zIndex: 20, position: 'relative' }}
    >
      <style>{`
        @keyframes pulse-led {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #ff0000, 0 0 12px #ff0000, 0 0 18px #ff0000; }
          50% { opacity: 0.6; box-shadow: 0 0 3px #ff0000, 0 0 6px #ff0000; }
        }
      `}</style>
      
      <div 
        className="relative h-4 bg-gradient-to-b from-white/5 to-white/10 rounded-full cursor-pointer group"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        style={{ overflow: 'visible' }}
      >
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 via-cyan-500 to-fuchsia-500 rounded-full shadow-lg shadow-cyan-500/30 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
        
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-gradient-to-b from-gray-200 to-gray-400 rounded-full shadow-xl shadow-black/50 border-2 border-white/30 flex items-center justify-center"
          style={{ left: `calc(${progress}% - 10px)`, zIndex: 10 }}
        >
          <div 
            className="w-2 h-2 rounded-full"
            style={{
              background: '#ff0000',
              animation: isPlaying ? 'pulse-led 1s ease-in-out infinite' : 'none',
              boxShadow: isPlaying ? '0 0 6px #ff0000, 0 0 12px #ff0000' : '0 0 3px #ff0000',
            }}
          />
        </div>
      </div>
      
      <div className="flex justify-between text-xs text-white/60 mt-2 px-1 font-mono">
        <span>{formatTime(currentTime)}</span>
        <span className="text-cyan-400/70">{formatTime(duration)}</span>
      </div>
    </div>
  );
});

export default ProgressBar;
