import { useState, useCallback, useRef, useEffect } from 'react';
import { Howler } from 'howler';

const LED_COLORS = {
  green: { on: '#00ff00', glow: 'rgba(0, 255, 0, 0.8)' },
  yellow: { on: '#ffff00', glow: 'rgba(255, 255, 0, 0.8)' },
  orange: { on: '#ff8000', glow: 'rgba(255, 128, 0, 0.8)' },
  red: { on: '#ff0000', glow: 'rgba(255, 0, 0, 0.8)' },
};

export function VolumeKnob({ 
  value = 0.8, 
  onChange,
  size = 180 
}) {
  const [angle, setAngle] = useState(-135 + value * 270);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const MIN_ANGLE = -135;
  const MAX_ANGLE = 135;
  const angleRange = MAX_ANGLE - MIN_ANGLE;

  const valueToAngle = useCallback((val) => {
    return MIN_ANGLE + val * angleRange;
  }, [angleRange]);

  const angleToValue = useCallback((ang) => {
    const normalized = (ang - MIN_ANGLE) / angleRange;
    return Math.max(0, Math.min(1, normalized));
  }, [angleRange]);

  const updateVolume = useCallback((newAngle) => {
    const clampedAngle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, newAngle));
    const newValue = angleToValue(clampedAngle);
    
    setAngle(clampedAngle);
    
    if (onChange) {
      onChange(newValue);
    }
    
    Howler.volume(newValue);
  }, [angleToValue, onChange]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;
    
    let newAngle = Math.atan2(deltaX, -deltaY) * (180 / Math.PI);
    
    updateVolume(newAngle);
  }, [isDragging, updateVolume]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    setAngle(valueToAngle(value));
  }, [value, valueToAngle]);

  const ledSegments = [
    { color: 'green', count: 3 },
    { color: 'yellow', count: 3 },
    { color: 'orange', count: 3 },
    { color: 'red', count: 3 },
  ];

  const getLedState = (index) => {
    const ledValue = (angle - MIN_ANGLE) / angleRange;
    const ledThreshold = (index + 1) / 12;
    return ledValue >= ledThreshold;
  };

  const knobRotation = angle;

  return (
    <div className="flex flex-col items-center">
      <div 
        ref={containerRef}
        className="relative select-none cursor-pointer"
        style={{ 
          width: size, 
          height: size,
          touchAction: 'none'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onTouchMove={(e) => {
          if (!isDragging || !containerRef.current) return;
          const touch = e.touches[0];
          const rect = containerRef.current.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const deltaX = touch.clientX - centerX;
          const deltaY = touch.clientY - centerY;
          const newAngle = Math.atan2(deltaX, -deltaY) * (180 / Math.PI);
          updateVolume(newAngle);
        }}
        onTouchEnd={() => setIsDragging(false)}
      >
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
            boxShadow: `
              inset 3px 3px 6px rgba(0, 0, 0, 0.8),
              inset -2px -2px 4px rgba(60, 60, 60, 0.2),
              0 4px 15px rgba(0, 0, 0, 0.5),
              0 0 30px rgba(0, 255, 255, 0.1)
            `,
          }}
        />

        <div className="absolute inset-3 rounded-full overflow-hidden" style={{
          background: 'radial-gradient(circle at 30% 30%, #252525, #0a0a0a)',
          boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.9)',
        }}>
          {[...Array(12)].map((_, i) => {
            const segmentIndex = i < 3 ? 0 : i < 6 ? 1 : i < 9 ? 2 : 3;
            const segment = ledSegments[segmentIndex];
            const isOn = getLedState(i);
            const angle = -135 + (i * 270 / 11);
            const rad = (angle * Math.PI) / 180;
            const radius = 38;
            const x = 50 + radius * Math.sin(rad);
            const y = 50 - radius * Math.cos(rad);
            const color = LED_COLORS[segment.color];
            
            return (
              <div
                key={i}
                className="absolute rounded-full transition-all duration-100"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: 8,
                  height: 8,
                  transform: 'translate(-50%, -50%)',
                  background: isOn ? color.on : '#1a1a1a',
                  boxShadow: isOn 
                    ? `0 0 8px ${color.glow}, 0 0 15px ${color.glow}, inset 0 0 3px rgba(255,255,255,0.5)`
                    : 'inset 0 0 2px rgba(0,0,0,0.8)',
                  border: isOn ? 'none' : '1px solid #333',
                }}
              />
            );
          })}
        </div>

        <div 
          className="absolute rounded-full"
          style={{
            top: '50%',
            left: '50%',
            width: '50%',
            height: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle at 30% 30%, #2d2d2d, #151515)',
            boxShadow: `
              inset 2px 2px 4px rgba(80, 80, 80, 0.3),
              inset -2px -2px 4px rgba(0, 0, 0, 0.8),
              0 0 10px rgba(0, 0, 0, 0.5)
            `,
          }}
        />

        <div
          className="absolute pointer-events-none"
          style={{
            top: '50%',
            left: '50%',
            width: '50%',
            height: '50%',
            transform: `translate(-50%, -50%) rotate(${knobRotation}deg)`,
          }}
        >
          <img 
            src="/images/knob/knob.png"
            alt="Volume Knob"
            className="w-full h-full"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            }}
            draggable={false}
          />
          <div 
            className="absolute rounded-full"
            style={{
              top: '8%',
              left: '50%',
              width: 10,
              height: 10,
              transform: 'translateX(-50%)',
              background: 'radial-gradient(circle, #ff0000 0%, #ff0000 40%, transparent 70%)',
              boxShadow: `
                0 0 8px #ff0000,
                0 0 15px #ff0000,
                0 0 25px rgba(255, 0, 0, 0.5),
                0 0 40px rgba(255, 0, 0, 0.3)
              `,
            }}
          />
        </div>
      </div>

      <div 
        className="absolute text-[10px] font-semibold text-cyan-400 tracking-wide mt-2"
        style={{ 
          textShadow: '0 0 10px rgba(0, 255, 255, 0.5)',
        }}
      >
        Volume
      </div>
    </div>
  );
}

export default VolumeKnob;
