import React, { useEffect, useRef } from 'react';

export default function WebampPlayer({ track, isPlaying, volume }) {
  const containerRef = useRef(null);
  const webampRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    const init = async () => {
      try {
        const WebampModule = await import('webamp/butterchurn');
        const Webamp = WebampModule.default;

        if (!mounted) return;

        const webamp = new Webamp({
          initialTracks: [],
          enableEqualizer: true,
          enablePlaylist: true,
        });

        webampRef.current = webamp;
        webamp.renderWhenReady(containerRef.current);
      } catch (err) {
        console.error('Webamp init error:', err);
      }
    };

    init();

    return () => {
      mounted = false;
      if (webampRef.current) {
        webampRef.current.dispose();
        webampRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!webampRef.current || !track?.audioPath) return;

    webampRef.current.setTracksToPlay([{
      url: track.audioPath,
      metaData: {
        title: track.title || 'Unknown Track',
        artist: track.artist || 'Unknown Artist',
      },
    }]);
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

    const vol = Math.round((volume ?? 0.85) * 100);
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
