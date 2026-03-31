import { useEffect, useRef, useState } from 'react';
import { useGlobalAudioAnalyser } from '../hooks/useGlobalAudioAnalyser.js';

const P = {
  sensitivity: 2.8,
  stiffness: 55,
  damping: 9,
  excursion: 20,
  bassMin: 20,
  bassMax: 200,
};

const MANUAL_SCALE = 0.80;

const PRESETS = {
  sub: { sensitivity: 3.8, stiffness: 35, damping: 7, excursion: 28 },
  hifi: { sensitivity: 2.0, stiffness: 90, damping: 18, excursion: 10 },
  studio: { sensitivity: 1.5, stiffness: 120, damping: 22, excursion: 7 },
  rock: { sensitivity: 2.5, stiffness: 65, damping: 12, excursion: 16 },
};

const mkCh = () => ({ x: 0, v: 0, a: 0, smooth: 0, peak: 0, transient: 0, prevRaw: 0 });
const ch = { L: mkCh(), R: mkCh() };
const DT = 1 / 60;

function stepMSD(c, raw) {
  const ATTACK = 0.94;
  const RELEASE = 0.76;
  
  c.smooth = raw > c.smooth
    ? c.smooth + (raw - c.smooth) * ATTACK
    : c.smooth * RELEASE;

  const delta = raw - c.prevRaw;
  c.prevRaw = raw;
  if (delta > 0.025) {
    c.transient = Math.min(c.transient + delta * 5.5, 1.2);
  } else {
    c.transient *= 0.78;
  }

  const F = (c.smooth + c.transient * 0.55) * P.sensitivity * 130;
  c.a = F - P.stiffness * c.x - P.damping * c.v;
  c.v += c.a * DT;
  c.x += c.v * DT;
  c.x = Math.max(-P.excursion * 0.4, Math.min(P.excursion, c.x));
}

function applyVisuals(coneEl, glowEl, shadowEl, wrapEl, c) {
  const x = c.x;
  const exc = P.excursion;
  const norm = Math.max(-1, Math.min(1, x / exc));
  const adv = Math.max(0, norm);
  const ret = Math.max(0, -norm);

  const sX = (1.0 + adv * 0.13 - ret * 0.05) * MANUAL_SCALE;
  const sY = (1.0 + adv * 0.18 - ret * 0.09) * MANUAL_SCALE;
  const tY = -x * 0.65;
  const rotX = norm * 5.0;
  const blurPx = Math.min(Math.abs(c.v) * 0.18, 5.5);

  const bright = 1.0 + adv * 0.65 - ret * 0.28;
  const sat = 100 + adv * 70;
  const contrast = 1.0 + adv * 0.22;

  coneEl.style.transform = `perspective(500px) rotateX(${rotX.toFixed(2)}deg) scaleX(${sX.toFixed(5)}) scaleY(${sY.toFixed(5)}) translateY(${tY.toFixed(2)}px)`;

  let filterStr = `brightness(${bright.toFixed(3)}) saturate(${sat.toFixed(0)}%) contrast(${contrast.toFixed(3)})`;
  if (blurPx > 0.5) filterStr += ` blur(${blurPx.toFixed(2)}px)`;
  coneEl.style.filter = filterStr;

  const glowIntensity = Math.min(adv * 0.90 + c.transient * 0.55, 1.0);
  glowEl.style.opacity = glowIntensity.toFixed(3);
  glowEl.style.transform = `scale(${(1 + adv * 0.28 + c.transient * 0.1).toFixed(3)})`;

  const shadowSx = 1.0 - adv * 0.55 + ret * 0.45;
  const shadowOp = 0.55 - adv * 0.42 + ret * 0.35;
  shadowEl.style.transform = `scaleX(${shadowSx.toFixed(3)})`;
  shadowEl.style.opacity = Math.max(0, shadowOp).toFixed(3);

  if (c.transient > 0.12) {
    const vib = (Math.random() - 0.5) * c.transient * 2.2;
    wrapEl.style.transform = `translateX(${vib.toFixed(2)}px)`;
  } else {
    wrapEl.style.transform = '';
  }
}

function DebugPanel() {
  const [params, setParams] = useState({ ...P });
  const [isOpen, setIsOpen] = useState(true);
  const [activePreset, setActivePreset] = useState(null);

  const updateParam = (key, value) => {
    const newParams = { ...params, [key]: parseFloat(value) };
    setParams(newParams);
    P[key] = newParams[key];
    setActivePreset(null);
  };

  const applyPreset = (preset) => {
    setActivePreset(preset);
    const p = PRESETS[preset];
    setParams(p);
    Object.assign(P, p);
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
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 border border-yellow-600 rounded-lg p-4 w-72">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-yellow-500 font-bold text-sm">🔧 Woofer Physics v2</h3>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">✕</button>
      </div>

      <div className="mb-3">
        <div className="flex gap-2 flex-wrap">
          {Object.keys(PRESETS).map((preset) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className={`px-2 py-1 text-xs rounded ${
                activePreset === preset 
                  ? 'bg-yellow-600 text-black' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {preset.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {[
          ['sensitivity', 'Sensibilidade', '0.5', '6', '0.1', '×'],
          ['stiffness', 'Rigidez (k)', '10', '200', '5', ''],
          ['damping', 'Amortec.', '1', '30', '0.5', ''],
          ['excursion', 'Excursão', '4', '40', '1', 'px'],
        ].map(([key, label, min, max, step, unit]) => (
          <div key={key}>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{label}</span>
              <span>{params[key]}{unit}</span>
            </div>
            <input
              type="range" min={min} max={max} step={step}
              value={params[key]}
              onChange={(e) => updateParam(key, e.target.value)}
              className="w-full accent-yellow-500"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700">
        <button
          onClick={() => {
            setParams({ ...P });
            P.sensitivity = 2.8;
            P.stiffness = 55;
            P.damping = 9;
            P.excursion = 20;
            setActivePreset(null);
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
  const shadowRef = useRef(null);
  const wrapRef = useRef(null);
  const animationRef = useRef(null);

  const { isReady, getBassEnergyL } = useGlobalAudioAnalyser();

  useEffect(() => {
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      if (!isReady || !isPlaying) {
        stepMSD(ch.L, 0);
        applyVisuals(coneRef.current, glowRef.current, shadowRef.current, wrapRef.current, ch.L);
        return;
      }

      const rawL = getBassEnergyL();
      stepMSD(ch.L, rawL);
      applyVisuals(coneRef.current, glowRef.current, shadowRef.current, wrapRef.current, ch.L);
    };

    animate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isReady, isPlaying, getBassEnergyL]);

  return (
    <div ref={wrapRef} className="relative w-52 h-52" style={{ perspective: '420px' }}>
      <div 
        ref={shadowRef}
        className="absolute bottom-[-14px] left-[12%] w-[76%] h-5 rounded-full bg-black"
        style={{
          filter: 'blur(9px)',
          opacity: 0.5,
          transformOrigin: 'center center',
        }}
      />
      <div 
        ref={glowRef}
        className="absolute inset-[-22px] rounded-full z-0 pointer-events-none"
        style={{
          opacity: 0,
          background: 'radial-gradient(circle, rgba(255,130,0,0.42) 0%, rgba(255,60,0,0.12) 45%, transparent 70%)',
        }}
      />
      <img 
        src="/images/speaker/aro.png"
        alt="Aro"
        className="absolute inset-0 w-full h-full z-10"
        style={{ filter: 'drop-shadow(0 6px 28px rgba(0,0,0,0.95))' }}
      />
      <img 
        ref={coneRef}
        src="/images/speaker/conemovel.png"
        alt="Cone"
        className="absolute inset-0 w-full h-full z-20"
        style={{ 
          transformOrigin: 'center center',
          willChange: 'transform, filter',
        }}
      />
    </div>
  );
}

export function VirtualWooferRight({ isPlaying }) {
  const coneRef = useRef(null);
  const glowRef = useRef(null);
  const shadowRef = useRef(null);
  const wrapRef = useRef(null);
  const animationRef = useRef(null);

  const { isReady, getBassEnergyR } = useGlobalAudioAnalyser();

  useEffect(() => {
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      if (!isReady || !isPlaying) {
        stepMSD(ch.R, 0);
        applyVisuals(coneRef.current, glowRef.current, shadowRef.current, wrapRef.current, ch.R);
        return;
      }

      const rawR = getBassEnergyR();
      stepMSD(ch.R, rawR);
      applyVisuals(coneRef.current, glowRef.current, shadowRef.current, wrapRef.current, ch.R);
    };

    animate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isReady, isPlaying, getBassEnergyR]);

  return (
    <div ref={wrapRef} className="relative w-52 h-52" style={{ perspective: '420px' }}>
      <div 
        ref={shadowRef}
        className="absolute bottom-[-14px] left-[12%] w-[76%] h-5 rounded-full bg-black"
        style={{
          filter: 'blur(9px)',
          opacity: 0.5,
          transformOrigin: 'center center',
        }}
      />
      <div 
        ref={glowRef}
        className="absolute inset-[-22px] rounded-full z-0 pointer-events-none"
        style={{
          opacity: 0,
          background: 'radial-gradient(circle, rgba(255,130,0,0.42) 0%, rgba(255,60,0,0.12) 45%, transparent 70%)',
        }}
      />
      <img 
        src="/images/speaker/aro.png"
        alt="Aro"
        className="absolute inset-0 w-full h-full z-10"
        style={{ filter: 'drop-shadow(0 6px 28px rgba(0,0,0,0.95))' }}
      />
      <img 
        ref={coneRef}
        src="/images/speaker/conemovel.png"
        alt="Cone"
        className="absolute inset-0 w-full h-full z-20"
        style={{ 
          transformOrigin: 'center center',
          willChange: 'transform, filter',
        }}
      />
    </div>
  );
}

export function WooferDebugPanel() {
  return <DebugPanel />;
}