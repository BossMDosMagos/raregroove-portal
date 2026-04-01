import React, { useMemo, useRef, useCallback } from 'react';

const FREQUENCY_LABELS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

function DraggableSlider({ value, onChange, frequency, index }) {
  const sliderRef = useRef(null);
  const isDragging = useRef(false);
  
  const trackHeight = 140;
  const normalizedValue = (value + 12) / 24;
  const knobY = trackHeight - (normalizedValue * trackHeight);
  
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    
    const updateValue = (clientY) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(trackHeight, clientY - rect.top));
      const newNormalized = 1 - (relativeY / trackHeight);
      const newValue = Math.round(newNormalized * 24 - 12);
      onChange(Math.max(-12, Math.min(12, newValue)));
    };
    
    const handleMouseMove = (moveEvent) => {
      updateValue(moveEvent.clientY);
    };
    
    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    updateValue(e.clientY);
  }, [onChange, trackHeight]);
  
  const handleTrackClick = useCallback((e) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const newNormalized = 1 - (relativeY / trackHeight);
    const newValue = Math.round(newNormalized * 24 - 12);
    onChange(Math.max(-12, Math.min(12, newValue)));
  }, [onChange, trackHeight]);
  
  const ledColor = value > 0 ? '#22c55e' : value < 0 ? '#3b82f6' : '#22c55e';
  const glowColor = value > 0 ? 'rgba(34, 197, 94, 0.8)' : value < 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(34, 197, 94, 0.5)';
  
  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div 
        ref={sliderRef}
        className="relative cursor-pointer"
        style={{ width: '32px', height: `${trackHeight}px` }}
        onClick={handleTrackClick}
      >
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-2 rounded-full"
          style={{
            top: '4px',
            height: `${trackHeight - 8}px`,
            background: 'linear-gradient(180deg, #1f1f1f 0%, #0a0a0a 50%, #1f1f1f 100%)',
            borderLeft: '1px solid #333',
            borderRight: '1px solid #333',
          }}
        />
        
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-2 rounded-full transition-all"
          style={{
            bottom: '4px',
            height: `${Math.abs(knobY - trackHeight/2 + 8)}px`,
            background: value >= 0 
              ? `linear-gradient(180deg, #ec4899 0%, #a855f7 100%)`
              : `linear-gradient(180deg, #3b82f6 0%, #60a5fa 100%)`,
            opacity: 0.7,
          }}
        />
        
        <div
          className="absolute left-1/2 -translate-x-1/2 transition-all duration-75 cursor-grab active:cursor-grabbing"
          style={{
            top: `${knobY}px`,
            width: '28px',
            height: '28px',
            transform: 'translate(-50%, -50%)',
          }}
          onMouseDown={handleMouseDown}
        >
          <div 
            className="w-full h-full rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #4a4a4a, #1a1a1a)',
              boxShadow: `
                0 2px 4px rgba(0,0,0,0.8),
                inset 0 1px 2px rgba(255,255,255,0.1),
                inset 0 -1px 2px rgba(0,0,0,0.3),
                0 0 15px ${glowColor}
              `,
              border: '1px solid #555',
            }}
          >
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all"
              style={{
                background: ledColor,
                boxShadow: `0 0 6px ${ledColor}, 0 0 12px ${ledColor}`,
              }}
            />
          </div>
        </div>
        
        <div className="absolute -left-1 top-0 bottom-0 w-1 flex flex-col justify-between py-1">
          <span className="text-[6px] text-white/20">+12</span>
          <span className="text-[6px] text-white/20">-12</span>
        </div>
      </div>
      
      <div className="text-center">
        <div className="text-[9px] font-bold text-white/80">{frequency}</div>
        <div className={`text-[10px] font-black ${value > 0 ? 'text-pink-400' : value < 0 ? 'text-blue-400' : 'text-green-400'}`}>
          {value > 0 ? '+' : ''}{value}
        </div>
      </div>
    </div>
  );
}

function PresetButton({ name, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
        isActive 
          ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-500/30' 
          : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
      }`}
    >
      {name}
    </button>
  );
}

export default function EqualizerPanel({
  gains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  activePreset = 'flat',
  isEnabled = true,
  onBandChange,
  onPresetChange,
  onReset,
  onToggle,
}) {
  const presets = useMemo(() => [
    { key: 'flat', name: 'Flat' },
    { key: 'rock', name: 'Rock' },
    { key: 'pop', name: 'Pop' },
    { key: 'jazz', name: 'Jazz' },
    { key: 'classical', name: 'Clássico' },
    { key: 'electronic', name: 'EDM' },
    { key: 'hiphop', name: 'Hip-Hop' },
    { key: 'acoustic', name: 'Acústico' },
    { key: 'vocal', name: 'Vocal' },
    { key: 'bass', name: 'Bass' },
  ], []);

  return (
    <div 
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #1a1a1a, #0d0d0d)',
        boxShadow: `
          inset 0 1px 2px rgba(255,255,255,0.05),
          inset 0 -1px 2px rgba(0,0,0,0.5),
          0 4px 20px rgba(0,0,0,0.6)
        `,
        padding: '14px',
        minWidth: '360px',
      }}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" style={{ boxShadow: '0 0 10px #22c55e' }} />
          <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">Equalizer</span>
        </div>
        <button
          onClick={onToggle}
          className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
            isEnabled 
              ? 'bg-green-500/20 text-green-400 border border-green-500/40' 
              : 'bg-red-500/20 text-red-400 border border-red-500/40'
          }`}
        >
          {isEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="flex justify-center gap-3 mb-4 px-2">
        {FREQUENCY_LABELS.map((freq, idx) => (
          <DraggableSlider
            key={idx}
            frequency={freq}
            value={gains[idx]}
            onChange={(val) => onBandChange(idx, val)}
            index={idx}
          />
        ))}
      </div>

      <div className="mb-3">
        <div className="text-[9px] text-white/40 uppercase tracking-wider mb-2 px-1">Presets</div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(preset => (
            <PresetButton
              key={preset.key}
              name={preset.name}
              isActive={activePreset === preset.key && isEnabled}
              onClick={() => onPresetChange(preset.key)}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white transition"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between text-[9px] text-white/40 px-1">
          <span>10 Band Graphic EQ</span>
          <span className={isEnabled ? 'text-green-400' : 'text-red-400'}>
            {isEnabled ? '● ACTIVE' : '○ DISABLED'}
          </span>
        </div>
      </div>
    </div>
  );
}
