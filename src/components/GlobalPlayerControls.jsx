import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music } from 'lucide-react';

export function GlobalPlayerControls({ player }) {
  const { currentTrack, isPlaying, currentTime, duration, play, pause, playNext, playPrevious } = player;
  const [displayTime, setDisplayTime] = useState('0:00');
  const [displayDuration, setDisplayDuration] = useState('0:00');
  const progressRef = useRef(null);
  
  useEffect(() => {
    if (currentTime !== undefined && !isNaN(currentTime)) {
      const mins = Math.floor(currentTime / 60);
      const secs = Math.floor(currentTime % 60);
      setDisplayTime(`${mins}:${secs.toString().padStart(2, '0')}`);
    }
  }, [currentTime]);
  
  useEffect(() => {
    if (duration !== undefined && !isNaN(duration) && duration > 0) {
      const mins = Math.floor(duration / 60);
      const secs = Math.floor(duration % 60);
      setDisplayDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
    }
  }, [duration]);
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  if (!currentTrack) {
    return null;
  }
  
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-gradient-to-r from-black/95 to-black/90 border-t border-amber-500/30 backdrop-blur-md"
      style={{ 
        boxShadow: '0 -4px 30px rgba(212, 175, 55, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
    >
      <div className="flex items-center justify-between px-6 py-3 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-4 min-w-[200px]">
          <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center overflow-hidden border border-amber-500/30">
            <Music className="w-6 h-6 text-amber-400" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate max-w-[200px]">
              {currentTrack.title || 'Unknown Track'}
            </p>
            <p className="text-xs text-amber-400/70 truncate max-w-[200px]">
              {currentTrack.artist || 'Unknown Artist'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={playPrevious}
            className="p-2 rounded-full hover:bg-amber-500/20 text-amber-400/70 hover:text-amber-400 transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => isPlaying ? pause() : play()}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg"
            style={{ boxShadow: '0 0 20px rgba(212, 175, 55, 0.4)' }}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>
          
          <button 
            onClick={playNext}
            className="p-2 rounded-full hover:bg-amber-500/20 text-amber-400/70 hover:text-amber-400 transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-3 min-w-[200px] justify-end">
          <span className="text-xs text-amber-400/70 font-mono">{displayTime}</span>
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              ref={progressRef}
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-amber-400/70 font-mono">{displayDuration}</span>
        </div>
      </div>
    </div>
  );
}

export default GlobalPlayerControls;