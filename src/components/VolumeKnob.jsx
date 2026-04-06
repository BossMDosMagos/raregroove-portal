import { useState, useCallback, useRef, useEffect } from 'react';
import { Howler } from 'howler';

const LED_COLORS = {
  green: { on: '#00ff00', glow: 'rgba(0, 255, 0, 1)', glowOuter: 'rgba(0, 255, 0, 0.6)' },
  yellow: { on: '#ffff00', glow: 'rgba(255, 255, 0, 1)', glowOuter: 'rgba(255, 255, 0, 0.6)' },
  orange: { on: '#ff8000', glow: 'rgba(255, 128, 0, 1)', glowOuter: 'rgba(255, 128, 0, 0.6)' },
  red: { on: '#ff0000', glow: 'rgba(255, 0, 0, 1)', glowOuter: 'rgba(255, 0, 0, 0.6)' },
};

export function VolumeKnob({ 
  value = 0.8, 
  onChange,
  size = 120 
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

  const getLedState = (index) => {
    const ledValue = (angle - MIN_ANGLE) / angleRange;
    const ledThreshold = (index + 1) / 12;
    return ledValue >= ledThreshold;
  };

  const knobRotation = angle;

  const ledColors = ['green', 'green', 'green', 'yellow', 'yellow', 'yellow', 'orange', 'orange', 'orange', 'red', 'red', 'red'];

  return (
    <div 
      ref={containerRef}
      className="relative select-none cursor-pointer"
      style={{ width: size, height: size, touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onTouchStart={(e) => { e.preventDefault(); setIsDragging(true); }}
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
      {/* Very thin base ring - just 1px border effect */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: '#1a1a1a',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      />

      {/* LED ring - positioned above base, below knob - NO overflow hidden */}
      <div 
        className="absolute inset-0"
        style={{ zIndex: 10 }}
      >
        {ledColors.map((colorKey, i) => {
          const isOn = getLedState(i);
          const ledAngle = -135 + (i * 270 / 11);
          const rad = (ledAngle * Math.PI) / 180;
          const radius = 46;
          const x = 50 + radius * Math.sin(rad);
          const y = 50 - radius * Math.cos(rad);
          const color = LED_COLORS[colorKey];
          
          return (
            <div
              key={i}
              className="absolute rounded-full transition-all duration-100"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: 3,
                height: 3,
                transform: 'translate(-50%, -50%)',
                background: isOn ? color.on : '#0a0a0a',
                boxShadow: isOn 
                  ? `0 0 4px ${color.glow}, 0 0 8px ${color.glowOuter}` 
                  : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Center dark circle */}
      <div 
        className="absolute rounded-full"
        style={{
          top: '50%',
          left: '50%',
          width: '60%',
          height: '60%',
          transform: 'translate(-50%, -50%)',
          background: '#151515',
          zIndex: 15,
        }}
      />

      {/* Gold Knob - top layer */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          width: '60%',
          height: '60%',
          transform: `translate(-50%, -50%) rotate(${knobRotation}deg)`,
          zIndex: 20,
        }}
      >
        <img 
          src="/images/knob/knob.png"
          alt="Volume Knob"
          className="w-full h-full"
          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
          draggable={false}
        />
        <div 
          className="absolute rounded-full"
          style={{
            top: '8%',
            left: '50%',
            width: 5,
            height: 5,
            transform: 'translateX(-50%)',
            background: 'radial-gradient(circle, #ff0000 0%, #ff0000 40%, transparent 70%)',
            boxShadow: '0 0 4px #ff0000, 0 0 8px #ff0000, 0 0 12px rgba(255, 0, 0, 0.5)',
          }}
        />
      </div>
    </div>
  );
}

export default VolumeKnob;