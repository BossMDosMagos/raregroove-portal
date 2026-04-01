import React, { useMemo, useRef, useCallback, useState } from 'react';

const FREQUENCY_LABELS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

const PRESETS = [
  { key: 'flat', name: 'Flat' },
  { key: 'rock', name: 'Rock' },
  { key: 'pop', name: 'Pop' },
  { key: 'jazz', name: 'Jazz' },
  { key: 'classical', name: 'Clássico' },
  { key: 'electronic', name: 'EDM' },
  { key: 'hiphop', name: 'Hip-Hop' },
  { key: 'acoustic', name: 'Acústico' },
  { key: 'vocal', name: 'Vocal' },
  { key: 'bass', name: 'Bass Boost' },
];

function DraggableSlider({ value, onChange, frequency, isEnabled }) {
  const sliderRef = useRef(null);
  
  const trackHeight = 100;
  const trackWidth = 16;
  const normalizedValue = (value + 12) / 24;
  const knobY = trackHeight - (normalizedValue * trackHeight);
  const knobHeight = 24;
  const knobWidth = 20;
  
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    
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
  
  const ledColor = !isEnabled ? '#333333' : value > 0 ? '#22c55e' : value < 0 ? '#3b82f6' : '#22c55e';
  const glowColor = !isEnabled ? 'transparent' : value > 0 ? 'rgba(34, 197, 94, 0.8)' : value < 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(34, 197, 94, 0.5)';
  const knobOpacity = !isEnabled ? 0.4 : 1;
  
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div 
        ref={sliderRef}
        className="relative cursor-pointer"
        style={{ 
          width: `${trackWidth}px`, 
          height: `${trackHeight}px` 
        }}
        onClick={handleTrackClick}
      >
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-1.5 rounded-full"
          style={{
            top: '2px',
            height: `${trackHeight - 4}px`,
            background: 'linear-gradient(180deg, #1f1f1f 0%, #0a0a0a 50%, #1f1f1f 100%)',
            borderLeft: '1px solid #333',
            borderRight: '1px solid #333',
          }}
        />
        
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-1.5 rounded-full transition-all"
          style={{
            bottom: '2px',
            height: `${Math.abs(knobY - trackHeight/2)}px`,
            background: value >= 0 
              ? 'linear-gradient(180deg, #ec4899 0%, #a855f7 100%)'
              : 'linear-gradient(180deg, #3b82f6 0%, #60a5fa 100%)',
            opacity: 0.6,
          }}
        />
        
        <div
          className="absolute left-1/2 transition-all duration-75 cursor-grab active:cursor-grabbing"
          style={{
            top: `${knobY}px`,
            width: `${knobWidth}px`,
            height: `${knobHeight}px`,
            transform: 'translate(-50%, -50%)',
          }}
          onMouseDown={handleMouseDown}
        >
          <div 
            className="w-full h-full rounded-[40%]"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #5a5a5a, #1a1a1a)',
              boxShadow: `
                0 2px 4px rgba(0,0,0,0.8),
                inset 0 1px 2px rgba(255,255,255,0.15),
                inset 0 -1px 2px rgba(0,0,0,0.3),
                0 0 12px ${glowColor}
              `,
              border: '1px solid #555',
              opacity: knobOpacity,
            }}
          >
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all"
              style={{
                background: ledColor,
                boxShadow: isEnabled ? `0 0 6px ${ledColor}, 0 0 10px ${ledColor}` : 'none',
              }}
            />
          </div>
        </div>
      </div>
      
      <div className="text-center">
        <div className="text-[8px] font-bold text-white/70">{frequency}</div>
        <div className={`text-[9px] font-black ${!isEnabled ? 'text-white/20' : value > 0 ? 'text-pink-400' : value < 0 ? 'text-blue-400' : 'text-green-400'}`}>
          {!isEnabled ? '-' : value > 0 ? '+' + value : value}
        </div>
      </div>
    </div>
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
  const [showDropdown, setShowDropdown] = useState(false);
  
  const activePresetName = useMemo(() => {
    const preset = PRESETS.find(p => p.key === activePreset);
    return preset ? preset.name : 'Flat';
  }, [activePreset]);

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
        padding: '12px',
        width: '100%',
      }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" style={{ boxShadow: '0 0 8px #22c55e' }} />
          <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">Equalizer</span>
        </div>
        <button
          onClick={onToggle}
          className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider ${
            isEnabled 
              ? 'bg-green-500/20 text-green-400 border border-green-500/40' 
              : 'bg-red-500/20 text-red-400 border border-red-500/40'
          }`}
        >
          {isEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="flex justify-center gap-2 mb-3 px-1">
        {FREQUENCY_LABELS.map((freq, idx) => (
          <DraggableSlider
            key={idx}
            frequency={freq}
            value={gains[idx]}
            onChange={(val) => onBandChange(idx, val)}
            isEnabled={isEnabled}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full py-1.5 px-3 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10 hover:text-white transition flex items-center justify-between"
          >
            <span>{activePresetName}</span>
            <span className="text-white/40">▼</span>
          </button>
          
          {showDropdown && (
            <div 
              className="absolute bottom-full left-0 right-0 mb-1 bg-charcoal-deep border border-white/10 rounded-lg overflow-hidden shadow-xl z-50"
              style={{ maxHeight: '150px', overflowY: 'auto' }}
            >
              {PRESETS.map(preset => (
                <button
                  key={preset.key}
                  onClick={() => {
                    onPresetChange(preset.key);
                    setShowDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider transition ${
                    activePreset === preset.key 
                      ? 'bg-fuchsia-500/20 text-fuchsia-300' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button
          onClick={onReset}
          className="py-1.5 px-3 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white transition"
        >
          Reset
        </button>
      </div>

      <div className="mt-1 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between text-[8px] text-white/40 px-1">
          <span>10 Band EQ</span>
          <span className={isEnabled ? 'text-green-400' : 'text-red-400'}>
            {isEnabled ? '● Active' : '○ Disabled'}
          </span>
        </div>
      </div>
    </div>
  );
}
