import React, { useMemo } from 'react';

const FREQUENCY_LABELS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

function SliderKnob({ value, onChange, frequency }) {
  const trackHeight = 100;
  const normalizedValue = (value + 12) / 24;
  const fillHeight = normalizedValue * trackHeight;
  
  const handleIncrement = (e) => {
    e.stopPropagation();
    if (value < 12) onChange(value + 1);
  };
  
  const handleDecrement = (e) => {
    e.stopPropagation();
    if (value > -12) onChange(value - 1);
  };
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        <button
          onClick={handleDecrement}
          onMouseDown={(e) => e.preventDefault()}
          className="w-4 h-4 rounded bg-white/5 hover:bg-white/20 text-white/50 hover:text-white text-[8px] flex items-center justify-center transition"
        >
          ▼
        </button>
      </div>
      
      <div 
        className="relative w-4 rounded-full cursor-pointer"
        style={{ height: `${trackHeight}px` }}
      >
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-3 rounded-full transition-all duration-75"
          style={{ 
            height: '14px',
            top: `${trackHeight - fillHeight - 7}px`,
            background: value > 0 
              ? `linear-gradient(180deg, #f0abfc 0%, #d946ef 50%, #c026d3 100%)`
              : value < 0
                ? `linear-gradient(180deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)`
                : 'linear-gradient(180deg, #d4d4d4 0%, #a3a3a3 50%, #737373 100%)',
            boxShadow: value !== 0 
              ? `0 0 8px ${value > 0 ? '#d946ef' : '#3b82f6'}`
              : '0 2px 4px rgba(0,0,0,0.3)',
          }}
        />
        <input
          type="range"
          min="-12"
          max="12"
          step="1"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
        />
        <div 
          className="absolute left-0 right-0 top-0 bottom-0 rounded-full"
          style={{
            background: 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 50%, #2a2a2a 100%)',
            border: '1px solid #404040',
          }}
        />
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-white/10 rounded-full"
          style={{ top: '3px', height: `${trackHeight - 6}px` }}
        />
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-0.5 rounded-full"
          style={{ 
            bottom: '3px', 
            height: `${fillHeight}px`,
            background: value > 0 
              ? 'linear-gradient(180deg, #d946ef 0%, #a855f7 100%)'
              : value < 0
                ? 'linear-gradient(180deg, #3b82f6 0%, #60a5fa 100%)'
                : 'linear-gradient(180deg, #737373 0%, #525252 100%)',
            opacity: 0.6,
          }}
        />
      </div>
      
      <div className="flex gap-0.5">
        <button
          onClick={handleIncrement}
          onMouseDown={(e) => e.preventDefault()}
          className="w-4 h-4 rounded bg-white/5 hover:bg-white/20 text-white/50 hover:text-white text-[8px] flex items-center justify-center transition"
        >
          ▲
        </button>
      </div>
      
      <div className="text-center -mt-0.5">
        <div className="text-[8px] font-bold text-white/60">{frequency}</div>
        <div className={`text-[7px] font-black ${value > 0 ? 'text-fuchsia-400' : value < 0 ? 'text-blue-400' : 'text-white/30'}`}>
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
      className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all duration-200 ${
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
    { key: 'classical', name: 'Cláss' },
    { key: 'electronic', name: 'EDM' },
    { key: 'hiphop', name: 'Hip-H' },
    { key: 'acoustic', name: 'Acúst' },
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
        padding: '10px',
      }}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">Equalizer</span>
        </div>
        <button
          onClick={onToggle}
          className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
            isEnabled 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {isEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="flex justify-center gap-1 mb-3">
        {FREQUENCY_LABELS.map((freq, idx) => (
          <SliderKnob
            key={idx}
            frequency={freq}
            value={gains[idx]}
            onChange={(val) => onBandChange(idx, val)}
          />
        ))}
      </div>

      <div className="mb-2">
        <div className="text-[8px] text-white/40 uppercase tracking-wider mb-1.5 px-1">Presets</div>
        <div className="flex flex-wrap gap-1">
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
          className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white transition"
        >
          Reset
        </button>
      </div>

      <div className="mt-2 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between text-[8px] text-white/40 px-1">
          <span>10 Band EQ</span>
          <span className={isEnabled ? 'text-fuchsia-400' : 'text-red-400'}>
            {isEnabled ? '● Active' : '○ Disabled'}
          </span>
        </div>
      </div>
    </div>
  );
}
