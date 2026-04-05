import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Music, ChevronRight, ChevronLeft } from 'lucide-react';

export default function AlbumDetailsContainer({ 
  album, 
  currentTrack, 
  isPlaying, 
  onPlayTrack,
  onClose,
  items,
  focusedIndex,
  onNavigate
}) {
  const [animationPhase, setAnimationPhase] = useState('idle');
  const [displayedAlbum, setDisplayedAlbum] = useState(null);

  useEffect(() => {
    if (album && album.id !== displayedAlbum?.id) {
      setDisplayedAlbum(album);
      setAnimationPhase('cover-enter');
      setTimeout(() => setAnimationPhase('panel-slide'), 50);
      setTimeout(() => setAnimationPhase('complete'), 600);
    } else if (!album && displayedAlbum) {
      setAnimationPhase('panel-hide');
      setTimeout(() => {
        setAnimationPhase('cover-exit');
        setTimeout(() => {
          setAnimationPhase('idle');
          setDisplayedAlbum(null);
        }, 400);
      }, 350);
    }
  }, [album, displayedAlbum]);

  const tracklist = useMemo(() => {
    if (!displayedAlbum) return [];
    const grooveflixData = displayedAlbum.metadata?.grooveflix || {};
    const list = grooveflixData.tracklist || displayedAlbum.tracklist || [];
    return Array.isArray(list) ? list : [];
  }, [displayedAlbum]);

  const audioFiles = useMemo(() => {
    if (!displayedAlbum) return [];
    const files = displayedAlbum.audioFiles || displayedAlbum.audio_files || displayedAlbum.metadata?.grooveflix?.audio_files || [];
    return Array.isArray(files) ? files : [];
  }, [displayedAlbum]);

  const sortedTracklist = useMemo(() => {
    return [...tracklist].sort((a, b) => {
      const trackA = a.trackNumber || parseInt(a.position?.split('-')[1]) || 0;
      const trackB = b.trackNumber || parseInt(b.position?.split('-')[1]) || 0;
      return trackA - trackB;
    });
  }, [tracklist]);

  const coverUrl = displayedAlbum?.coverUrl || displayedAlbum?.image_url || displayedAlbum?.coverPath || null;

  const handleCloseClick = () => {
    onClose();
  };

  const handleTrackClick = (trackIndex) => {
    if (!displayedAlbum || !onPlayTrack) return;
    const hasAudio = audioFiles[trackIndex]?.path || audioFiles[trackIndex];
    if (hasAudio) {
      onPlayTrack(displayedAlbum, trackIndex);
    }
  };

  if (animationPhase === 'idle' && !displayedAlbum) return null;

  const getCoverTransform = () => {
    switch (animationPhase) {
      case 'cover-enter':
        return 'translateX(150vw) scale(0.8)';
      case 'panel-slide':
      case 'complete':
        return 'translateX(-40px) scale(1)';
      case 'cover-exit':
        return 'translateX(-150vw) scale(0.8)';
      default:
        return 'translateX(0) scale(1)';
    }
  };

  const getPanelTransform = () => {
    switch (animationPhase) {
      case 'cover-enter':
        return 'translateX(100px) scaleX(0)';
      case 'panel-slide':
      case 'complete':
        return 'translateX(0) scaleX(1)';
      case 'panel-hide':
        return 'translateX(100px) scaleX(0)';
      default:
        return 'translateX(100px) scaleX(0)';
    }
  };

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${animationPhase !== 'idle' ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-md"
        style={{ opacity: animationPhase !== 'idle' ? 1 : 0 }}
        onClick={handleCloseClick}
      />
      
      <div className="relative h-full flex items-center justify-center">
        <div 
          className="relative flex items-center"
          style={{
            transform: getCoverTransform(),
            transition: animationPhase.includes('exit') 
              ? 'transform 0.4s cubic-bezier(0.4, 0, 1, 1)' 
              : animationPhase === 'cover-enter'
                ? 'transform 0s'
                : 'transform 0.5s cubic-bezier(0, 0, 0.2, 1)'
          }}
        >
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 via-transparent to-orange-500/30 blur-3xl scale-110" />
            
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-br from-amber-400 via-amber-600 to-orange-500 rounded-2xl opacity-75 blur-sm" />
              <div className="absolute -inset-2 bg-gradient-to-br from-amber-300 via-amber-500 to-orange-400 rounded-2xl opacity-50 blur-md" />
              
              <div 
                className="relative bg-black rounded-xl overflow-hidden shadow-2xl"
                style={{
                  width: '400px',
                  height: '400px',
                  boxShadow: '0 25px 80px rgba(245, 158, 11, 0.4), 0 0 120px rgba(245, 158, 11, 0.15)'
                }}
              >
                {coverUrl ? (
                  <img 
                    src={coverUrl} 
                    alt={displayedAlbum?.title} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.querySelector('.fallback-bg').style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="fallback-bg w-full h-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center"
                  style={{ display: coverUrl ? 'none' : 'flex' }}
                >
                  <Music className="w-32 h-32 text-amber-500/50" />
                </div>
                <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/30" />
              </div>

              <div className="mt-6 text-center px-4">
                <h2 className="text-2xl font-black text-amber-400 truncate max-w-[400px] drop-shadow-lg">
                  {displayedAlbum?.title}
                </h2>
                <p className="text-amber-500/70 text-lg mt-1">{displayedAlbum?.artist}</p>
                <div className="flex items-center justify-center gap-3 mt-4">
                  <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm">
                    {sortedTracklist.length} faixas
                  </span>
                  {audioFiles.length > 0 && (
                    <button 
                      onClick={() => displayedAlbum && onPlayTrack && onPlayTrack(displayedAlbum, 0)}
                      className="px-5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-black font-bold text-sm hover:shadow-lg hover:shadow-amber-500/30 transition-all flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" /> Play All
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div 
            className="ml-6 flex-shrink-0"
            style={{
              width: '400px',
              transform: getPanelTransform(),
              opacity: animationPhase === 'panel-slide' || animationPhase === 'complete' ? 1 : 0,
              transition: animationPhase === 'panel-hide'
                ? 'transform 0.35s cubic-bezier(0.4, 0, 1, 1), opacity 0.3s ease-out'
                : animationPhase === 'cover-exit'
                  ? 'transform 0.3s ease-in, opacity 0.2s ease-in'
                  : animationPhase === 'panel-slide'
                    ? 'transform 0.5s cubic-bezier(0, 0, 0.2, 1), opacity 0.4s ease-out'
                    : animationPhase === 'cover-enter'
                      ? 'transform 0s, opacity 0s'
                      : 'transform 0.5s cubic-bezier(0, 0, 0.2, 1), opacity 0.4s ease-out'
            }}
          >
            <div 
              className="bg-gradient-to-b from-gray-900/95 via-gray-950/95 to-black/95 backdrop-blur-2xl rounded-2xl overflow-hidden border border-amber-500/20 shadow-2xl shadow-amber-500/10"
              style={{ height: '520px', boxShadow: 'inset 0 0 80px rgba(245, 158, 11, 0.05), 0 0 100px rgba(0,0,0,0.9)' }}
            >
              <div className="bg-gradient-to-r from-amber-900/50 via-amber-800/40 to-amber-900/50 px-6 py-4 border-b border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-12 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full animate-pulse" />
                    <div>
                      <h3 className="text-amber-400 font-bold text-lg tracking-wide">Tracklist</h3>
                      <p className="text-amber-500/60 text-sm truncate max-w-[250px]">{displayedAlbum?.title}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleCloseClick}
                    className="p-2 rounded-full bg-black/40 hover:bg-amber-500/20 text-amber-500/70 hover:text-amber-400 transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="h-[calc(100%-85px)] overflow-y-auto custom-scrollbar-vinyl">
                {sortedTracklist.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-amber-500/50">
                    <Music className="w-16 h-16 mb-4" />
                    <p className="text-lg">Nenhuma faixa disponível</p>
                  </div>
                ) : (
                  <div className="divide-y divide-amber-500/10">
                    {sortedTracklist.map((track, index) => {
                      const trackId = `${displayedAlbum?.id}-${index}`;
                      const isActive = currentTrack?.id === trackId;
                      const hasAudio = audioFiles[index]?.path || audioFiles[index];
                      const duration = track.duration || '';

                      return (
                        <button
                          key={index}
                          onClick={() => handleTrackClick(index)}
                          className={`
                            w-full flex items-center gap-4 px-5 py-3.5 transition-all duration-200 group
                            ${isActive 
                              ? 'bg-gradient-to-r from-amber-500/30 to-orange-500/20 border-l-4 border-amber-400' 
                              : 'hover:bg-amber-500/10 border-l-4 border-transparent'
                            }
                            ${!hasAudio ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                            {isActive && isPlaying ? (
                              <div className="flex items-end gap-0.5 h-5">
                                <span className="w-1.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '60%', animationDelay: '0s' }} />
                                <span className="w-1.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                                <span className="w-1.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '75%', animationDelay: '0.3s' }} />
                              </div>
                            ) : isActive ? (
                              <Pause className="w-5 h-5 text-amber-400" />
                            ) : hasAudio ? (
                              <Play className="w-5 h-5 text-amber-500/0 group-hover:text-amber-500 transition-colors" />
                            ) : (
                              <span className="text-amber-500/40 text-sm font-mono">{index + 1}</span>
                            )}
                          </div>

                          <div className="flex-1 text-left min-w-0">
                            <p className={`font-medium truncate transition-colors ${
                              isActive 
                                ? 'text-amber-400' 
                                : 'text-amber-100/80 group-hover:text-amber-300'
                            }`}>
                              {track.title || `Faixa ${index + 1}`}
                            </p>
                            {isActive && (
                              <p className="text-amber-500/60 text-xs truncate">{currentTrack?.artist || displayedAlbum?.artist}</p>
                            )}
                          </div>

                          {duration && (
                            <div className="text-amber-500/50 text-sm font-mono flex-shrink-0">
                              {duration}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-amber-500/5 to-transparent pointer-events-none" />
            </div>

            <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-24 h-full bg-gradient-to-r from-amber-500/15 to-transparent blur-3xl pointer-events-none" />
          </div>
        </div>
      </div>

      {(animationPhase === 'panel-slide' || animationPhase === 'complete') && displayedAlbum && (
        <>
          <button 
            onClick={() => onNavigate && onNavigate('prev')}
            disabled={focusedIndex === 0}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/60 backdrop-blur-sm border border-amber-500/40 text-amber-500 hover:bg-amber-500/20 hover:border-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button 
            onClick={() => onNavigate && onNavigate('next')}
            disabled={focusedIndex >= items.length - 1}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/60 backdrop-blur-sm border border-amber-500/40 text-amber-500 hover:bg-amber-500/20 hover:border-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      <style>{`
        .custom-scrollbar-vinyl::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar-vinyl::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.4);
          border-radius: 3px;
        }
        .custom-scrollbar-vinyl::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, rgba(245, 158, 11, 0.6), rgba(234, 88, 12, 0.6));
          border-radius: 3px;
        }
        .custom-scrollbar-vinyl::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, rgba(245, 158, 11, 0.8), rgba(234, 88, 12, 0.8));
        }
      `}</style>
    </div>
  );
}
