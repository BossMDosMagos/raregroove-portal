import React, { useEffect, useRef } from 'react';

export default function WebampPlayer({ track, isPlaying, onPlay, onPause, volume }) {
  const containerRef = useRef(null);
  const webampRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || webampRef.current) return;

    const initWebamp = async () => {
      const Webamp = (await import('webamp/butterchurn')).default;
      
      webampRef.current = new Webamp({
        initialTracks: [],
        enableEqualizer: true,
        enablePlaylist: true,
      });

      webampRef.current.onClose(() => {
        // Optionally handle close
      });

      webampRef.current.renderWhenReady(containerRef.current);
    };

    initWebamp();

    return () => {
      if (webampRef.current) {
        webampRef.current.dispose();
        webampRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!webampRef.current) return;

    if (track?.audioPath) {
      webampRef.current.setTracksToPlay([{
        url: track.audioPath,
        metaData: {
          title: track.title || 'Unknown',
          artist: track.artist || 'Unknown Artist',
        },
      }]);
    }
  }, [track?.audioPath]);

  useEffect(() => {
    if (!webampRef.current) return;
    
    if (isPlaying) {
      webampRef.current.play();
    } else {
      webampRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!webampRef.current) return;
    
    const vol = Math.round((volume || 0.85) * 100);
    webampRef.current.setVolume(vol);
  }, [volume]);

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-24 right-4 z-50"
      style={{ width: '320px', height: '240px' }}
    />
  );
}
