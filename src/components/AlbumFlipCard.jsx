import React, { useState } from 'react';
import { Play, Pause, Music } from 'lucide-react';

export default function AlbumFlipCard({ 
  album, 
  coverUrl,
  isActive, 
  isPlaying, 
  currentTrack,
  currentTrackIndex,
  onPlayTrack,
  style,
  showFlipHint = false 
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleFlipClick = (e) => {
    e.stopPropagation();
    if (isAnimating) return;
    setIsAnimating(true);
    setIsFlipped(!isFlipped);
    setTimeout(() => setIsAnimating(false), 600);
  };

  const handleTrackClick = (trackIndex, e) => {
    e.stopPropagation();
    if (onPlayTrack && album) {
      console.log('[AlbumFlipCard] handleTrackClick:', album.title, 'trackIndex:', trackIndex);
      onPlayTrack(album, trackIndex);
    }
  };

  const tracklist = album?.tracklist || album?.metadata?.grooveflix?.tracklist || [];
  const audioFiles = album?.audioFiles || album?.audio_files || album?.metadata?.grooveflix?.audio_files || [];

  const size = style?.width || 280;

  return (
    <div 
      className="relative"
      style={{ 
        width: size, 
        height: size,
        perspective: '1000px'
      }}
      onClick={handleFlipClick}
    >
      {/* Flip Container */}
      <div 
        className="relative w-full h-full"
        style={{ 
          transformStyle: 'preserve-3d',
          perspective: '1000px'
        }}
      >
        {/* FRONT - Album Cover */}
        <div 
          className="absolute inset-0 rounded-xl overflow-hidden transition-all duration-500"
          style={{ 
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            border: isActive && isPlaying ? '3px solid #0ff' : isActive ? '3px solid rgba(212,175,55,0.6)' : 'none',
            boxShadow: isActive && isPlaying
              ? '0 0 35px #0ff, 0 0 70px rgba(0,255,255,0.3), inset 0 0 20px rgba(0,255,255,0.1)' 
              : isActive 
                ? '0 0 35px rgba(212,175,55,0.4), 0 0 70px rgba(212,175,55,0.2), inset 0 0 20px rgba(212,175,55,0.1)' 
                : 'none'
          }}
        >
          {coverUrl ? (
            <img 
              src={coverUrl} 
              alt={album?.title}
              className="w-full h-full object-cover"
              style={{ borderRadius: '12px' }}
              draggable={false}
            />
          ) : (
            <div 
              className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center"
              style={{ borderRadius: '12px' }}
            >
              <Music className="w-20 h-20 text-gray-600" />
            </div>
          )}

          {/* Playing indicator */}
          {isActive && isPlaying && (
            <div 
              className="absolute top-3 left-3 right-3 h-0.5 overflow-hidden"
            >
              <div className="w-full h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
            </div>
          )}
          {isActive && isPlaying && (
            <div 
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-5 px-3 py-1 bg-black/70 backdrop-blur-sm rounded-full"
              style={{
                boxShadow: '0 0 15px #0ff, 0 0 30px #0ff',
                border: '1px solid #0ff',
              }}
            >
              <span className="w-0.5 bg-cyan-400 rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0s' }} />
              <span className="w-0.5 bg-cyan-400 rounded-full animate-pulse" style={{ height: '80%', animationDelay: '0.1s' }} />
              <span className="w-0.5 bg-cyan-400 rounded-full animate-pulse" style={{ height: '60%', animationDelay: '0.2s' }} />
              <span className="w-0.5 bg-cyan-400 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.3s' }} />
            </div>
          )}
          {!isActive || !isPlaying ? (
            isActive && (
              <div 
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-5 px-3 py-1 bg-black/70 backdrop-blur-sm rounded-full"
              >
                <span className="w-0.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0s' }} />
                <span className="w-0.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '80%', animationDelay: '0.1s' }} />
                <span className="w-0.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '60%', animationDelay: '0.2s' }} />
                <span className="w-0.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.3s' }} />
              </div>
            )
          ) : null}

          {/* Flip hint */}
          {showFlipHint && (
            <div 
              className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100"
              style={{ borderRadius: '12px' }}
            >
              <div className="bg-black/80 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 border border-amber-500/30">
                <Music className="w-4 h-4 text-amber-400" />
                <span className="text-white text-sm font-medium">Ver Tracks</span>
              </div>
            </div>
          )}
        </div>

        {/* BACK - Tracklist */}
        <div 
          className="absolute inset-0 rounded-xl overflow-hidden transition-all duration-500"
          style={{ 
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(-180deg)',
            background: 'linear-gradient(180deg, #0a0a0a 0%, #111111 100%)',
            border: '3px solid rgba(212,175,55,0.5)',
            boxShadow: '0 0 50px rgba(212,175,55,0.25), inset 0 0 30px rgba(212,175,55,0.08)'
          }}
        >
          {/* Header */}
          <div 
            className="px-3 py-2 border-b border-amber-500/30"
            style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.2), transparent)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-0.5 h-6 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full animate-pulse flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-amber-400 font-bold text-xs truncate">{album?.title}</p>
                  <p className="text-amber-500/60 text-[10px] truncate">{album?.artist}</p>
                </div>
              </div>
              <button 
                onClick={handleFlipClick}
                className="p-1 rounded-full bg-black/40 hover:bg-amber-500/20 text-amber-500/70 hover:text-amber-400 transition-all flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tracklist */}
          <div 
            className="overflow-y-auto"
            style={{ 
              height: audioFiles.length > 0 ? 'calc(100% - 95px)' : 'calc(100% - 45px)'
            }}
          >
            <style>{`
              .flip-scroll::-webkit-scrollbar { width: 4px; }
              .flip-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
              .flip-scroll::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.5); border-radius: 2px; }
              .flip-scroll::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,0.8); }
            `}</style>
            
            {tracklist.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-amber-500/50">
                <Music className="w-8 h-8 mb-2" />
                <p className="text-xs">Sem tracks</p>
              </div>
            ) : (
              <div className="divide-y divide-amber-500/10 flip-scroll py-1">
                {tracklist.map((track, index) => {
                  const trackId = `${album?.id}-${index}`;
                  const isTrackActive = currentTrackIndex === index || currentTrack?.id === trackId;
                  const hasAudio = audioFiles[index]?.path || audioFiles[index];

                  return (
                    <button
                      key={index}
                      onClick={(e) => handleTrackClick(index, e)}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 transition-all duration-100 group
                        ${isTrackActive 
                          ? 'bg-gradient-to-r from-amber-500/30 to-amber-400/15 border-l-2 border-amber-400' 
                          : 'hover:bg-amber-500/10 border-l-2 border-transparent'
                        }
                        ${!hasAudio ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                        {isTrackActive && isPlaying ? (
                          <div className="flex items-end gap-0.5 h-4">
                            <span className="w-0.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '40%' }} />
                            <span className="w-0.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '100%' }} />
                            <span className="w-0.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '60%' }} />
                          </div>
                        ) : isTrackActive ? (
                          <Pause className="w-4 h-4 text-amber-400" />
                        ) : (
                          <span className="text-amber-500/60 text-[11px] font-mono">{index + 1}</span>
                        )}
                      </div>

                      <div className="flex-1 text-left min-w-0">
                        <p className={`text-[11px] truncate ${isTrackActive ? 'text-amber-400 font-medium' : 'text-gray-300 group-hover:text-amber-200'}`}>
                          {track.title || `Track ${index + 1}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Play all button */}
          {audioFiles.length > 0 && (
            <button
              onClick={(e) => handleTrackClick(0, e)}
              className="absolute bottom-2 left-2 right-2 py-1.5 rounded-lg text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              style={{ 
                background: 'linear-gradient(90deg, #d4af37, #b8960c)',
                boxShadow: '0 0 15px rgba(212,175,55,0.5)'
              }}
            >
              <Play className="w-3 h-3" /> Play All ({audioFiles.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
