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

const MANUAL_SCALE = 0.80;

function DebugPanel() {
  const [params, setParams] = useState({ ...P });
  const [isOpen, setIsOpen] = useState(true);

  const updateParam = (key, value) => {
    const newParams = { ...params, [key]: parseFloat(value) };
    setParams(newParams);
    P[key] = newParams[key];
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-yellow-600 text-black px-4 py-2 rounded-lg font-bold text-sm"
      >
        ⚙️ Tuning
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 border border-yellow-600 rounded-lg p-4 w-64">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-yellow-500 font-bold text-sm">🔧 Woofer Tuning</h3>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">✕</button>
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Sensibilidade</span>
            <span>{params.sensitivity.toFixed(1)}×</span>
          </div>
          <input
            type="range" min="0.5" max="10" step="0.1"
            value={params.sensitivity}
            onChange={(e) => updateParam('sensitivity', e.target.value)}
            className="w-full accent-yellow-500"
          />
        </div>
        
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Rigidez (k)</span>
            <span>{params.stiffness}</span>
          </div>
          <input
            type="range" min="10" max="300" step="5"
            value={params.stiffness}
            onChange={(e) => updateParam('stiffness', e.target.value)}
            className="w-full accent-yellow-500"
          />
        </div>
        
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Amortecimento</span>
            <span>{params.damping.toFixed(1)}</span>
          </div>
          <input
            type="range" min="1" max="50" step="0.5"
            value={params.damping}
            onChange={(e) => updateParam('damping', e.target.value)}
            className="w-full accent-yellow-500"
          />
        </div>
        
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Excursão</span>
            <span>{params.excursion}</span>
          </div>
          <input
            type="range" min="2" max="40" step="1"
            value={params.excursion}
            onChange={(e) => updateParam('excursion', e.target.value)}
            className="w-full accent-yellow-500"
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-700">
        <button
          onClick={() => {
            setParams({ ...P });
            P.sensitivity = 2.2;
            P.stiffness = 80;
            P.damping = 12;
            P.excursion = 14;
          }}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-2 rounded"
        >
          Resetar
        </button>
      </div>
    </div>
  );
}

export function VirtualWooferLeft({ isPlaying }) {
  const coneRef = useRef(null);
  const glowRef = useRef(null);
  const animationRef = useRef(null);

  const { isReady, getBassEnergyL } = useGlobalAudioAnalyser();

  useEffect(() => {
    const cone = coneRef.current;
    if (!cone) return;
    
    const applyScale = () => {
      const norm = Math.max(0, ch.L.x / P.excursion);
      const scaleY = (1.0 + norm * 0.09) * MANUAL_SCALE;
      const scaleX = (1.0 + norm * 0.04) * MANUAL_SCALE;
      const transY = -ch.L.x * 0.35;
      const bright = 1.0 + norm * 0.35;
      cone.style.transform = `translate(2px, ${transY.toFixed(2)}px) scaleX(${scaleX.toFixed(5)}) scaleY(${scaleY.toFixed(5)})`;
      cone.style.filter = `brightness(${bright.toFixed(3)})`;
    };

    applyScale();
    
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      if (!isReady || !isPlaying) {
        stepMSD(ch.L, 0);
        applyScale();
        return;
      }

      const rawL = getBassEnergyL();

      const attk = 0.7;
      ch.L.smooth = rawL > ch.L.smooth ? ch.L.smooth + (rawL - ch.L.smooth) * attk : ch.L.smooth * 0.85;

      stepMSD(ch.L, ch.L.smooth);
      applyScale();
      
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
  }, [isReady, isPlaying, getBassEnergyL]);

  return (
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
  );
}

export function VirtualWooferRight({ isPlaying }) {
  const coneRef = useRef(null);
  const glowRef = useRef(null);
  const animationRef = useRef(null);

  const { isReady, getBassEnergyR } = useGlobalAudioAnalyser();

  useEffect(() => {
    const cone = coneRef.current;
    if (!cone) return;
    
    const applyScale = () => {
      const norm = Math.max(0, ch.R.x / P.excursion);
      const scaleY = (1.0 + norm * 0.09) * MANUAL_SCALE;
      const scaleX = (1.0 + norm * 0.04) * MANUAL_SCALE;
      const transY = -ch.R.x * 0.35;
      const bright = 1.0 + norm * 0.35;
      cone.style.transform = `translate(2px, ${transY.toFixed(2)}px) scaleX(${scaleX.toFixed(5)}) scaleY(${scaleY.toFixed(5)})`;
      cone.style.filter = `brightness(${bright.toFixed(3)})`;
    };

    applyScale();
    
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      if (!isReady || !isPlaying) {
        stepMSD(ch.R, 0);
        applyScale();
        return;
      }

      const rawR = getBassEnergyR();

      const attk = 0.7;
      ch.R.smooth = rawR > ch.R.smooth ? ch.R.smooth + (rawR - ch.R.smooth) * attk : ch.R.smooth * 0.85;

      stepMSD(ch.R, ch.R.smooth);
      applyScale();
      
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
  }, [isReady, isPlaying, getBassEnergyR]);

  return (
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
  );
}

export function WooferDebugPanel() {
  return <DebugPanel />;
}