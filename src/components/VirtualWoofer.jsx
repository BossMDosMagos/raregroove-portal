import { useEffect, useRef, useState } from 'react';
import { useGlobalAudioAnalyser } from '../hooks/useGlobalAudioAnalyser.js';

const P = {
  sensitivity: 2.2,
  stiffness: 80,
  damping: 12,
  excursion: 14,
  bassMin: 20,
  bassMax: 200,
};

const ch = {
  L: { x: 0, v: 0, a: 0, smooth: 0 },
  R: { x: 0, v: 0, a: 0, smooth: 0 },
};

const DT = 1 / 60;

function stepMSD(c, force) {
  const F = force * P.sensitivity * 100;
  c.a = F - P.stiffness * c.x - P.damping * c.v;
  c.v += c.a * DT;
  c.x += c.v * DT;
  c.x = Math.max(-P.excursion * 0.2, Math.min(P.excursion, c.x));
}

function applyCone(el, glowEl, x) {
  const norm = Math.max(0, x / P.excursion);
  const scaleY = 1.0 + norm * 0.09;
  const scaleX = 1.0 + norm * 0.04;
  const transY = -x * 0.35;
  const bright = 1.0 + norm * 0.35;

  el.style.transform = `scaleX(${scaleX.toFixed(5)}) scaleY(${scaleY.toFixed(5)}) translateY(${transY.toFixed(2)}px)`;
  el.style.filter = `brightness(${bright.toFixed(3)})`;

  if (glowEl) {
    glowEl.style.opacity = (norm * 0.9).toFixed(3);
    glowEl.style.transform = `scale(${1 + norm * 0.15})`;
  }
}

export function VirtualWooferLeft({ isPlaying }) {
  const coneRef = useRef(null);
  const glowRef = useRef(null);
  const animationRef = useRef(null);
  const [manualScale, setManualScale] = useState(1);

  const { isReady, getBassEnergyL } = useGlobalAudioAnalyser();

  useEffect(() => {
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      if (!isReady || !isPlaying) {
        stepMSD(ch.L, 0);
        applyCone(coneRef.current, glowRef.current, ch.L.x * 0.9);
        return;
      }

      const rawL = getBassEnergyL();

      const attk = 0.7;
      ch.L.smooth = rawL > ch.L.smooth ? ch.L.smooth + (rawL - ch.L.smooth) * attk : ch.L.smooth * 0.85;

      stepMSD(ch.L, ch.L.smooth);
      
      const cone = coneRef.current;
      if (cone) {
        const norm = Math.max(0, ch.L.x / P.excursion);
        const scaleY = (1.0 + norm * 0.09) * manualScale;
        const scaleX = (1.0 + norm * 0.04) * manualScale;
        const transY = -ch.L.x * 0.35;
        const bright = 1.0 + norm * 0.35;
        cone.style.transform = `scaleX(${scaleX.toFixed(5)}) scaleY(${scaleY.toFixed(5)}) translateY(${transY.toFixed(2)}px)`;
        cone.style.filter = `brightness(${bright.toFixed(3)})`;
      }
      
      if (glowRef.current) {
        const norm = Math.max(0, ch.L.x / P.excursion);
        glowRef.current.style.opacity = (norm * 0.9).toFixed(3);
        glowRef.current.style.transform = `scale(${1 + norm * 0.15})`;
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, isPlaying, getBassEnergyL, manualScale]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-52 h-52">
        <div 
          ref={glowRef}
          className="absolute inset-[-12px] rounded-full z-0 pointer-events-none"
          style={{
            opacity: 0,
            background: 'radial-gradient(circle, rgba(255,160,0,0.18) 0%, transparent 70%)',
            transition: 'opacity 0.04s linear',
          }}
        />
        <img 
          src="/images/speaker/aro.png"
          alt="Aro"
          className="absolute inset-0 w-full h-full z-10"
          style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.9))' }}
        />
        <img 
          ref={coneRef}
          src="/images/speaker/conemovel.png"
          alt="Cone"
          className="absolute inset-0 w-full h-full z-20"
          style={{ 
            transformOrigin: 'center center',
            willChange: 'transform, filter',
            transition: 'none',
            filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.9))',
          }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>Scale:</span>
        <input 
          type="range" 
          min="0.1" 
          max="15" 
          step="0.01"
          value={manualScale}
          onChange={(e) => setManualScale(parseFloat(e.target.value))}
          className="w-24"
        />
        <span>{manualScale.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function VirtualWooferRight({ isPlaying }) {
  const coneRef = useRef(null);
  const glowRef = useRef(null);
  const animationRef = useRef(null);
  const [manualScale, setManualScale] = useState(1);

  const { isReady, getBassEnergyR } = useGlobalAudioAnalyser();

  useEffect(() => {
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      if (!isReady || !isPlaying) {
        stepMSD(ch.R, 0);
        applyCone(coneRef.current, glowRef.current, ch.R.x * 0.9);
        return;
      }

      const rawR = getBassEnergyR();

      const attk = 0.7;
      ch.R.smooth = rawR > ch.R.smooth ? ch.R.smooth + (rawR - ch.R.smooth) * attk : ch.R.smooth * 0.85;

      stepMSD(ch.R, ch.R.smooth);
      
      const cone = coneRef.current;
      if (cone) {
        const norm = Math.max(0, ch.R.x / P.excursion);
        const scaleY = (1.0 + norm * 0.09) * manualScale;
        const scaleX = (1.0 + norm * 0.04) * manualScale;
        const transY = -ch.R.x * 0.35;
        const bright = 1.0 + norm * 0.35;
        cone.style.transform = `scaleX(${scaleX.toFixed(5)}) scaleY(${scaleY.toFixed(5)}) translateY(${transY.toFixed(2)}px)`;
        cone.style.filter = `brightness(${bright.toFixed(3)})`;
      }
      
      if (glowRef.current) {
        const norm = Math.max(0, ch.R.x / P.excursion);
        glowRef.current.style.opacity = (norm * 0.9).toFixed(3);
        glowRef.current.style.transform = `scale(${1 + norm * 0.15})`;
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, isPlaying, getBassEnergyR, manualScale]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-52 h-52">
        <div 
          ref={glowRef}
          className="absolute inset-[-12px] rounded-full z-0 pointer-events-none"
          style={{
            opacity: 0,
            background: 'radial-gradient(circle, rgba(255,160,0,0.18) 0%, transparent 70%)',
            transition: 'opacity 0.04s linear',
          }}
        />
        <img 
          src="/images/speaker/aro.png"
          alt="Aro"
          className="absolute inset-0 w-full h-full z-10"
          style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.9))' }}
        />
        <img 
          ref={coneRef}
          src="/images/speaker/conemovel.png"
          alt="Cone"
          className="absolute inset-0 w-full h-full z-20"
          style={{ 
            transformOrigin: 'center center',
            willChange: 'transform, filter',
            transition: 'none',
            filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.9))',
          }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>Scale:</span>
        <input 
          type="range" 
          min="0.1" 
          max="15" 
          step="0.01"
          value={manualScale}
          onChange={(e) => setManualScale(parseFloat(e.target.value))}
          className="w-24"
        />
        <span>{manualScale.toFixed(2)}</span>
      </div>
    </div>
  );
}