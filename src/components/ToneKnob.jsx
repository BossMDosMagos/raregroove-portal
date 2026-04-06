import { useState, useCallback, useRef, useEffect } from 'react';

const LED_COLORS = {
  green: { on: '#00ff00', glow: 'rgba(0, 255, 0, 0.8)' },
  yellow: { on: '#ffff00', glow: 'rgba(255, 255, 0, 0.8)' },
  orange: { on: '#ff8000', glow: 'rgba(255, 128, 0, 0.8)' },
  red: { on: '#ff0000', glow: 'rgba(255, 0, 0, 0.8)' },
};

export function ToneKnob({ 
  value = 0.5, 
  onChange,
  size = 70,
  label
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

  const updateValue = useCallback((newAngle) => {
    const clampedAngle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, newAngle));
    const newValue = angleToValue(clampedAngle);
    
    setAngle(clampedAngle);
    
    if (onChange) {
      onChange(newValue);
    }
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
    
    updateValue(newAngle);
  }, [isDragging, updateValue]);

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
    <div className="flex flex-col items-center">
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
          updateValue(newAngle);
        }}
        onTouchEnd={() => setIsDragging(false)}
      >
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: '#1a1a1a',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
          }}
        />

        <div className="absolute inset-3.5 rounded-full overflow-hidden z-5" style={{
          background: '#0f0f0f',
        }}>
          {ledColors.map((colorKey, i) => {
            const isOn = getLedState(i);
            const ledAngle = -135 + (i * 270 / 11);
            const rad = (ledAngle * Math.PI) / 180;
            const radius = 44;
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
                  width: 5,
                  height: 5,
                  transform: 'translate(-50%, -50%)',
                  background: isOn ? color.on : '#151515',
                  boxShadow: isOn ? `0 0 4px ${color.glow}, 0 0 8px ${color.glow}` : 'none',
                  border: '1px solid #333',
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
            width: '65%',
            height: '65%',
            transform: 'translate(-50%, -50%)',
            background: '#151515',
          }}
        />

        <div
          className="absolute pointer-events-none z-20"
          style={{
            top: '50%',
            left: '50%',
            width: '65%',
            height: '65%',
            transform: `translate(-50%, -50%) rotate(${knobRotation}deg)`,
          }}
        >
          <img 
            src="/images/knob/knob.png"
            alt="Tone Knob"
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
      {label && (
        <span className="text-[9px] text-gray-400 mt-1 font-medium">{label}</span>
      )}
    </div>
  );
}

export default ToneKnob;
