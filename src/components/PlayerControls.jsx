export function PlayerControls({ 
  isPlaying, 
  onPlay, 
  onPause, 
  onStop, 
  onSeekBackward, 
  onSeekForward,
  onEject 
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={onStop}
        className="w-10 h-10 hover:scale-110 transition-transform"
        title="Stop"
      >
        <img 
          src="/images/knob/stop.png" 
          alt="Stop" 
          className="w-full h-full object-contain"
        />
      </button>

      <button
        onClick={onSeekBackward}
        className="w-10 h-10 hover:scale-110 transition-transform"
        title="Retrocesso"
      >
        <img 
          src="/images/knob/retrocesso.png" 
          alt="Retrocesso" 
          className="w-full h-full object-contain"
        />
      </button>

      {isPlaying ? (
        <button
          onClick={onPause}
          className="w-12 h-12 hover:scale-110 transition-transform"
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
          onClick={onPlay}
          className="w-12 h-12 hover:scale-110 transition-transform"
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
        onClick={onSeekForward}
        className="w-10 h-10 hover:scale-110 transition-transform"
        title="Avanço"
      >
        <img 
          src="/images/knob/avanco.png" 
          alt="Avanço" 
          className="w-full h-full object-contain"
        />
      </button>

      <button
        onClick={onEject}
        className="w-10 h-10 hover:scale-110 transition-transform"
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
