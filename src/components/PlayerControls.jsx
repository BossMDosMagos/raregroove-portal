export function PlayerControls({ 
  isPlaying, 
  onPlay, 
  onPause, 
  onStop, 
  onPreviousTrack, 
  onNextTrack,
  onEject 
}) {
  const handlePlayClick = (e) => {
    console.log('[PlayerControls] Play button clicked');
    if (onPlay) onPlay();
  };

  return (
    <div className="flex items-center justify-center gap-2 relative z-50">
      <button
        onClick={onStop}
        className="w-10 h-10 hover:scale-110 transition-transform relative z-50"
        title="Stop"
      >
        <img 
          src="/images/knob/stop.png" 
          alt="Stop" 
          className="w-full h-full object-contain"
        />
      </button>

      <button
        onClick={onPreviousTrack}
        className="w-10 h-10 hover:scale-110 transition-transform relative z-50"
        title="Faixa Anterior"
      >
        <img 
          src="/images/knob/back.png" 
          alt="Anterior" 
          className="w-full h-full object-contain"
        />
      </button>

      {isPlaying ? (
        <button
          onClick={onPause}
          className="w-12 h-12 hover:scale-110 transition-transform relative z-50"
          title="Pause"
        >
          <img 
            src="/images/knob/pause.png" 
            alt="Pause" 
            className="w-full h-full object-contain"
          />
        </button>
      ) : (
        <button
          onClick={handlePlayClick}
          className="w-12 h-12 hover:scale-110 transition-transform relative z-50"
          title="Play"
        >
          <img 
            src="/images/knob/play.png" 
            alt="Play" 
            className="w-full h-full object-contain"
          />
        </button>
      )}

      <button
        onClick={onNextTrack}
        className="w-10 h-10 hover:scale-110 transition-transform relative z-50"
        title="Próxima Faixa"
      >
        <img 
          src="/images/knob/next.png" 
          alt="Próxima" 
          className="w-full h-full object-contain"
        />
      </button>

      <button
        onClick={onEject}
        className="w-10 h-10 hover:scale-110 transition-transform relative z-50"
        title="Eject"
      >
        <img 
          src="/images/knob/eject.png" 
          alt="Eject" 
          className="w-full h-full object-contain"
        />
      </button>
    </div>
  );
}

export default PlayerControls;
