import { useState, useCallback, useRef } from 'react';

const KnobPanel = ({ 
  volume, handleVolumeChange, 
  eqBands, handleEqBand,
  getVolumeDb 
}) => {
  const [dragging, setDragging] = useState(null);
  const knobRefs = useRef({});
  const startPosRef = useRef(0);
  const startValRef = useRef(0);

  const BASS_BANDS = [32, 64, 125];
  const MID_BANDS = [250, 500, 1000];
  const TREBLE_BANDS = [2000, 4000, 8000, 16000];

  const valueToRotation = (val, min, max) => {
    const percent = (val - min) / (max - min);
    return -135 + percent * 270;
  };

  const handleMouseDown = useCallback((e, knobId, currentValue, min, max, bands) => {
    e.preventDefault();
    setDragging(knobId);
    startPosRef.current = e.clientY;
    startValRef.current = currentValue;
    
    const handleMouseMove = (moveEvent) => {
      const delta = (startPosRef.current - moveEvent.clientY) / 100;
      const newVal = Math.max(min, Math.min(max, startValRef.current + delta * (max - min)));
      
      if (knobId === 'volume') {
        handleVolumeChange({ target: { value: newVal } });
      } else if (bands) {
        bands.forEach(band => handleEqBand(band, newVal));
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleVolumeChange, handleEqBand]);

  const getAverage = (bands) => {
    return bands.reduce((sum, b) => sum + (eqBands[b] || 0), 0) / bands.length;
  };

  const bassValue = getAverage(BASS_BANDS);
  const midValue = getAverage(MID_BANDS);
  const trebleValue = getAverage(TREBLE_BANDS);

  const Knob = ({ id, value, min, max, label, size = 'small', bands }) => {
    const rotation = valueToRotation(value, min, max);
    const isLarge = size === 'large';
    const isActive = dragging === id;
    
    return (
      <div className="flex flex-col items-center gap-1">
        <div 
          ref={el => knobRefs.current[id] = el}
          className={`relative cursor-grab ${isActive ? 'cursor-grabbing' : ''}`}
          style={{
            width: isLarge ? '56px' : '36px',
            height: isLarge ? '56px' : '36px',
            filter: isActive ? 'brightness(1.2)' : 'none',
          }}
          onMouseDown={(e) => handleMouseDown(e, id, value, min, max, bands)}
        >
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(145deg, #3a3a3a, #1a1a1a)',
              boxShadow: isActive 
                ? '0 0 10px rgba(255,200,0,0.5), inset 0 1px 1px rgba(255,255,255,0.15)' 
                : '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)',
            }}
          />
          <div 
            className="absolute inset-[3px] rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #4a4a4a, #1a1a1a)',
            }}
          />
          <div 
            className="absolute w-1 rounded-full"
            style={{
              height: isLarge ? '18px' : '11px',
              background: 'linear-gradient(to bottom, #ffcc00, #ff8800)',
              boxShadow: '0 0 4px rgba(255,200,0,0.5)',
              left: '50%',
              top: isLarge ? '8px' : '4px',
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              transformOrigin: 'center bottom',
            }}
          />
          <div 
            className="absolute rounded-full"
            style={{
              width: isLarge ? '10px' : '6px',
              height: isLarge ? '10px' : '6px',
              background: '#0a0a0a',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              border: '1px solid #333',
            }}
          />
        </div>
        <span 
          className="text-[5px] uppercase tracking-wider"
          style={{ 
            color: isActive ? '#ffcc00' : '#666', 
            fontFamily: 'monospace',
            textShadow: isActive ? '0 0 4px rgba(255,200,0,0.5)' : 'none',
          }}
        >
          {label}
        </span>
      </div>
    );
  };

  return (
    <div 
      className="flex items-end justify-center gap-3 px-4 py-3"
      style={{
        background: 'linear-gradient(180deg, rgba(25,25,25,0.95) 0%, rgba(15,15,15,0.98) 100%)',
        borderTop: '1px solid rgba(255,200,0,0.15)',
        borderBottom: '1px solid rgba(0,0,0,0.8)',
      }}
    >
      <div className="flex-1" />
      
      <Knob 
        id="volume" 
        value={volume} 
        min={0} 
        max={1} 
        label="VOLUME" 
        size="large"
      />
      
      <div className="flex items-center gap-4">
        <Knob 
          id="bass" 
          value={bassValue} 
          min={-12} 
          max={12} 
          label="BASS"
          bands={BASS_BANDS}
        />
        <Knob 
          id="mid" 
          value={midValue} 
          min={-12} 
          max={12} 
          label="MID"
          bands={MID_BANDS}
        />
        <Knob 
          id="treble" 
          value={trebleValue} 
          min={-12} 
          max={12} 
          label="TREBLE"
          bands={TREBLE_BANDS}
        />
      </div>
      
      <div className="flex-1 flex justify-end items-center">
        <span 
          className="text-[9px] font-mono"
          style={{ 
            color: '#ffcc00',
            textShadow: '0 0 6px rgba(255,200,0,0.4)',
          }}
        >
          {getVolumeDb()}dB
        </span>
      </div>
    </div>
  );
};

export default KnobPanel;
