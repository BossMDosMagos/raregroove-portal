import { useState, useCallback, useRef } from 'react';
import { SpectrumVisualizer } from './SpectrumVisualizer';

const KnobPanel = ({ 
  volume, handleVolumeChange, 
  eqBands, handleEqBand,
  getVolumeDb,
  spectrumL,
  spectrumR,
  timeDomainL,
  timeDomainR,
  isPlaying,
  currentTime
}) => {
  const isStopped = currentTime === 0 && !isPlaying;
  const [dragging, setDragging] = useState(null);
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

  const VolumeKnob = () => {
    const rotation = valueToRotation(volume, 0, 1);
    const isActive = dragging === 'volume';
    const ledCount = 12;
    const ledThreshold = volume * ledCount;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative" style={{ width: '140px', height: '140px' }}>
          {Array.from({ length: ledCount }).map((_, i) => {
            const angle = -135 + (i / (ledCount - 1)) * 270;
            const radian = (angle * Math.PI) / 180;
            const radius = 55;
            const x = Math.sin(radian) * radius;
            const y = -Math.cos(radian) * radius;
            const isLit = i < ledThreshold;
            
            return (
              <div
                key={i}
                className="absolute rounded-full transition-all duration-100"
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: isLit ? '#ffcc00' : '#3a2a1a',
                  boxShadow: isLit 
                    ? '0 0 8px #ffcc00, 0 0 12px #ff8800' 
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                  left: `calc(50% + ${x}px - 3px)`,
                  top: `calc(50% + ${y}px - 3px)`,
                }}
              />
            );
          })}

          <div 
            className={`absolute cursor-grab ${isActive ? 'cursor-grabbing' : ''}`}
            style={{
              width: '100px',
              height: '100px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              filter: isActive ? 'brightness(1.15)' : 'none',
            }}
            onMouseDown={(e) => handleMouseDown(e, 'volume', volume, 0, 1, null)}
          >
            <div 
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(
                  from 0deg,
                  #b8860b 0deg,
                  #ffd700 30deg,
                  #daa520 60deg,
                  #b8860b 90deg,
                  #ffd700 120deg,
                  #daa520 150deg,
                  #b8860b 180deg,
                  #ffd700 210deg,
                  #daa520 240deg,
                  #b8860b 270deg,
                  #ffd700 300deg,
                  #daa520 330deg,
                  #b8860b 360deg
                )`,
                boxShadow: `
                  0 4px 8px rgba(0,0,0,0.6),
                  0 2px 4px rgba(0,0,0,0.4),
                  inset 0 2px 4px rgba(255,255,255,0.3),
                  inset 0 -2px 4px rgba(0,0,0,0.3)
                `,
              }}
            />
            <div 
              className="absolute inset-[4px] rounded-full"
              style={{
                background: `conic-gradient(
                  from 0deg,
                  #8b6914 0deg,
                  #c9a227 30deg,
                  #b8940f 60deg,
                  #8b6914 90deg,
                  #c9a227 120deg,
                  #b8940f 150deg,
                  #8b6914 180deg,
                  #c9a227 210deg,
                  #b8940f 240deg,
                  #8b6914 270deg,
                  #c9a227 300deg,
                  #b8940f 330deg,
                  #8b6914 360deg
                )`,
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)',
              }}
            />
            <div 
              className="absolute w-[3px] rounded-full"
              style={{
                height: '32px',
                background: 'linear-gradient(to bottom, #fff8dc, #ffd700)',
                boxShadow: '0 0 6px rgba(255,215,0,0.8)',
                left: '50%',
                top: '10px',
                transform: `translateX(-50%) rotate(${rotation}deg)`,
                transformOrigin: 'center bottom',
              }}
            />
            <div 
              className="absolute rounded-full"
              style={{
                width: '16px',
                height: '16px',
                background: 'radial-gradient(circle at 40% 40%, #2a1a0a, #0a0505)',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
              }}
            />
          </div>
        </div>
        <span className="text-[7px] uppercase tracking-wider" style={{ color: '#d4a84b', fontFamily: 'monospace' }}>
          VOLUME
        </span>
        <span className="text-[9px] font-mono" style={{ color: '#ffcc00', textShadow: '0 0 6px rgba(255,200,0,0.4)' }}>
          {getVolumeDb()}dB
        </span>
      </div>
    );
  };

  const SmallKnob = ({ id, value, min, max, label, bands }) => {
    const rotation = valueToRotation(value, min, max);
    const isActive = dragging === id;
    
    return (
      <div className="flex flex-col items-center gap-1">
        <div 
          className={`relative cursor-grab ${isActive ? 'cursor-grabbing' : ''}`}
          style={{
            width: '50px',
            height: '50px',
            filter: isActive ? 'brightness(1.15)' : 'none',
          }}
          onMouseDown={(e) => handleMouseDown(e, id, value, min, max, bands)}
        >
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(
                from 0deg,
                #b8860b 0deg,
                #ffd700 30deg,
                #daa520 60deg,
                #b8860b 90deg,
                #ffd700 120deg,
                #daa520 150deg,
                #b8860b 180deg,
                #ffd700 210deg,
                #daa520 240deg,
                #b8860b 270deg,
                #ffd700 300deg,
                #daa520 330deg,
                #b8860b 360deg
              )`,
              boxShadow: `
                0 3px 6px rgba(0,0,0,0.6),
                0 1px 3px rgba(0,0,0,0.4),
                inset 0 2px 3px rgba(255,255,255,0.25),
                inset 0 -2px 3px rgba(0,0,0,0.25)
              `,
            }}
          />
          <div 
            className="absolute inset-[3px] rounded-full"
            style={{
              background: `conic-gradient(
                from 0deg,
                #8b6914 0deg,
                #c9a227 30deg,
                #b8940f 60deg,
                #8b6914 90deg,
                #c9a227 120deg,
                #b8940f 150deg,
                #8b6914 180deg,
                #c9a227 210deg,
                #b8940f 240deg,
                #8b6914 270deg,
                #c9a227 300deg,
                #b8940f 330deg,
                #8b6914 360deg
              )`,
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
            }}
          />
          <div 
            className="absolute w-[2px] rounded-full"
            style={{
              height: '16px',
              background: 'linear-gradient(to bottom, #fff8dc, #ffd700)',
              boxShadow: '0 0 4px rgba(255,215,0,0.6)',
              left: '50%',
              top: '5px',
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              transformOrigin: 'center bottom',
            }}
          />
          <div 
            className="absolute rounded-full"
            style={{
              width: '10px',
              height: '10px',
              background: 'radial-gradient(circle at 40% 40%, #2a1a0a, #0a0505)',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
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
      className="px-4 py-3"
      style={{
        background: 'linear-gradient(180deg, rgba(25,25,25,0.95) 0%, rgba(15,15,15,0.98) 100%)',
        borderTop: '1px solid rgba(255,200,0,0.15)',
        borderBottom: '1px solid rgba(0,0,0,0.8)',
      }}
    >
      <div className="flex items-center justify-center mb-3">
        <SpectrumVisualizer 
          spectrumL={spectrumL} 
          spectrumR={spectrumR}
          timeDomainL={timeDomainL}
          timeDomainR={timeDomainR}
          isPlaying={isPlaying}
          isStopped={isStopped}
        />
      </div>
      
      <div className="flex items-center justify-center gap-8">
        <VolumeKnob />
      
        <div className="flex items-center gap-4">
          <SmallKnob 
            id="bass" 
            value={bassValue} 
            min={-12} 
            max={12} 
            label="BASS"
            bands={BASS_BANDS}
          />
          <SmallKnob 
            id="mid" 
            value={midValue} 
            min={-12} 
            max={12} 
            label="MID"
            bands={MID_BANDS}
          />
          <SmallKnob 
            id="treble" 
            value={trebleValue} 
            min={-12} 
            max={12} 
            label="TREBLE"
            bands={TREBLE_BANDS}
          />
        </div>
      </div>
    </div>
  );
};

export default KnobPanel;
