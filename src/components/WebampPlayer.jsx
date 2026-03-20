import React, { useEffect, useRef, useState } from 'react';
import Webamp from 'webamp/butterchurn';

const WEBAMP_SKIN_URL = 'https://webamp.org/skins/winamp3.np';

export default function WebampPlayer({ track, isPlaying, onPlay, onPause, volume }) {
  const containerRef = useRef(null);
  const webampRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const initWebamp = async () => {
      const webamp = new Webamp({
        initialSkin: {
          url: WEBAMP_SKIN_URL,
        },
        initialTracks: [],
        enableEqualizer: true,
        enablePlaylist: true,
      });

      webampRef.current = webamp;

      webamp.onClose(() => {
        setIsMinimized(true);
      });

      await webamp.initCompleted;
      webamp.renderWhenReady(containerRef.current);
      setIsReady(true);
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
    if (!webampRef.current || !isReady || !track?.audioPath) return;

    const trackUrl = track.audioPath;

    webampRef.current.setTracksToPlay([
      {
        url: trackUrl,
        metaData: {
          title: track.title || 'Unknown Title',
          artist: track.artist || 'Unknown Artist',
        },
      },
    ]);
  }, [track?.audioPath, isReady]);

  useEffect(() => {
    if (!webampRef.current || !isReady) return;

    if (isPlaying) {
      webampRef.current.play();
    } else {
      webampRef.current.pause();
    }
  }, [isPlaying, isReady]);

  useEffect(() => {
    if (!webampRef.current || !isReady) return;

    const volumePercent = Math.round((volume || 0.85) * 100);
    webampRef.current.setVolume(volumePercent);
  }, [volume, isReady]);

  const handleOpenWebamp = () => {
    if (webampRef.current) {
      webampRef.current.reopen();
      setIsMinimized(false);
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={handleOpenWebamp}
        className="fixed bottom-24 right-4 z-50 w-12 h-12 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-full shadow-lg shadow-fuchsia-500/30 flex items-center justify-center hover:scale-110 transition-transform"
        title="Abrir Webamp"
      >
        <span className="text-white text-lg">W</span>
      </button>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="fixed bottom-24 right-4 z-50"
      style={{ width: '300px', height: '200px' }}
    />
  );
}
