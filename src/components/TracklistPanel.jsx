import React, { useMemo, useEffect } from 'react';
import { Play, Pause, Music } from 'lucide-react';

export default function TracklistPanel({ album, currentTrack, isPlaying, onPlayTrack }) {
  useEffect(() => {
    console.log('[TracklistPanel] RENDERED - album:', album?.title || 'NULL', 'currentTrack:', currentTrack?.title || 'NULL');
  }, [album, currentTrack]);

  const tracklist = useMemo(() => {
    if (!album) return [];
    const grooveflixData = album.metadata?.grooveflix || {};
    const list = grooveflixData.tracklist || [];
    return Array.isArray(list) ? list : [];
  }, [album]);

  const audioFiles = useMemo(() => {
    if (!album) return [];
    const grooveflixData = album.metadata?.grooveflix || {};
    const files = grooveflixData.audio_files || [];
    return Array.isArray(files) ? files : [];
  }, [album]);

  const sortedTracklist = useMemo(() => {
    return [...tracklist].sort((a, b) => {
      const trackA = a.trackNumber || parseInt(a.position?.split('-')[1]) || 0;
      const trackB = b.trackNumber || parseInt(b.position?.split('-')[1]) || 0;
      return trackA - trackB;
    });
  }, [tracklist]);

  if (!album) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-6">
        <div className="bg-gradient-to-b from-gray-900/80 to-black/90 border border-amber-500/20 rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center justify-center py-12 text-amber-500/50">
            <Music className="w-8 h-8 mr-3" />
            <span className="text-lg font-medium">Nenhum álbum selecionado</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="bg-gradient-to-b from-gray-900/80 to-black/90 border border-amber-500/20 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-900/30 via-amber-800/20 to-amber-900/30 px-6 py-4 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
            <div>
              <h3 className="text-amber-400 font-bold text-lg tracking-wide">
                {album.title}
              </h3>
              <p className="text-amber-500/70 text-sm">{album.artist}</p>
            </div>
            <div className="ml-auto text-amber-500/50 text-sm">
              {sortedTracklist.length} faixas
            </div>
          </div>
        </div>

        {/* Tracklist */}
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          {sortedTracklist.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-amber-500/50">
              <span className="text-sm">Nenhuma faixa disponível</span>
            </div>
          ) : (
            <div className="divide-y divide-amber-500/10">
              {sortedTracklist.map((track, index) => {
                const trackId = `${album.id}-${index}`;
                const isActive = currentTrack?.id === trackId;
                const hasAudio = audioFiles[index]?.path || audioFiles[index];
                const duration = track.duration || '';

                return (
                  <button
                    key={index}
                    onClick={() => hasAudio && onPlayTrack && onPlayTrack(album, index)}
                    disabled={!hasAudio}
                    className={`w-full flex items-center gap-4 px-6 py-3 transition-all duration-200 group ${
                      isActive
                        ? 'bg-amber-500/20 border-l-4 border-amber-400'
                        : 'hover:bg-amber-500/10 border-l-4 border-transparent'
                    } ${!hasAudio ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {/* Track Number / Play Icon */}
                    <div className="w-8 h-8 flex items-center justify-center">
                      {isActive && isPlaying ? (
                        <div className="flex items-end gap-0.5 h-4">
                          <span className="w-1 bg-amber-400 rounded-full animate-pulse" style={{ height: '60%' }} />
                          <span className="w-1 bg-amber-400 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.1s' }} />
                          <span className="w-1 bg-amber-400 rounded-full animate-pulse" style={{ height: '80%', animationDelay: '0.2s' }} />
                        </div>
                      ) : hasAudio ? (
                        <Play className="w-4 h-4 text-amber-500/0 group-hover:text-amber-500 transition-colors" />
                      ) : (
                        <span className="text-amber-500/30 text-sm font-mono">{index + 1}</span>
                      )}
                      {isActive && !isPlaying && (
                        <Play className="w-4 h-4 text-amber-400" />
                      )}
                      {!isActive && !hasAudio && (
                        <span className="text-amber-500/30 text-sm font-mono">{index + 1}</span>
                      )}
                    </div>

                    {/* Track Title */}
                    <div className="flex-1 text-left">
                      <p className={`font-medium truncate ${
                        isActive ? 'text-amber-400' : 'text-amber-100/80 group-hover:text-amber-300'
                      }`}>
                        {track.title || `Faixa ${index + 1}`}
                      </p>
                    </div>

                    {/* Duration */}
                    <div className="text-amber-500/50 text-sm font-mono">
                      {duration}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-black/30 border-t border-amber-500/10">
          <p className="text-amber-500/30 text-xs text-center">
            Clique em uma faixa para reproduzir
          </p>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(245, 158, 11, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(245, 158, 11, 0.5);
        }
      `}</style>
    </div>
  );
}
