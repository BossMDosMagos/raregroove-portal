import { useEffect, useRef } from 'react';
import { useGlobalAudioAnalyser } from '../hooks/useGlobalAudioAnalyser.js';

const SCALE_MIN = 1.0;
const SCALE_MAX = 1.12;
const SMOOTH = 0.85;

export function VirtualWooferLeft({ isPlaying }) {
  const coneRef = useRef(null);
  const animationRef = useRef(null);
  const smoothRef = useRef(0);
  
  const { isReady, getBassEnergyL } = useGlobalAudioAnalyser();

  useEffect(() => {
    const cone = coneRef.current;
    if (!cone) return;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      if (!isReady || !isPlaying) {
        smoothRef.current *= 0.9;
        const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
        const glow = smoothRef.current * 15;
        cone.style.transform = `scale(${scale.toFixed(4)})`;
        cone.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.6}))`;
        return;
      }
      
      const bass = getBassEnergyL();
      
      smoothRef.current = smoothRef.current * SMOOTH + bass * (1 - SMOOTH);
      
      const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
      const glow = smoothRef.current * 20;
      
      cone.style.transform = `scale(${scale.toFixed(4)})`;
      cone.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.7}))`;
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, isPlaying, getBassEnergyL]);

  return (
    <div className="relative w-52 h-52 flex items-center justify-center">
      <img 
        src="/images/speaker/aro.png"
        alt="Aro"
        className="absolute inset-0 w-full h-full object-contain z-10"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
      />
      <img 
        ref={coneRef}
        src="/images/speaker/conemovel.png"
        alt="Cone"
        className="absolute w-40 h-40 object-contain z-20"
        style={{ 
          transformOrigin: 'center',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
          transition: 'transform 0.05s ease-out'
        }}
      />
    </div>
  );
}

export function VirtualWooferRight({ isPlaying }) {
  const coneRef = useRef(null);
  const animationRef = useRef(null);
  const smoothRef = useRef(0);
  
  const { isReady, getBassEnergyR } = useGlobalAudioAnalyser();

  useEffect(() => {
    const cone = coneRef.current;
    if (!cone) return;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      if (!isReady || !isPlaying) {
        smoothRef.current *= 0.9;
        const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
        const glow = smoothRef.current * 15;
        cone.style.transform = `scale(${scale.toFixed(4)})`;
        cone.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.6}))`;
        return;
      }
      
      const bass = getBassEnergyR();
      
      smoothRef.current = smoothRef.current * SMOOTH + bass * (1 - SMOOTH);
      
      const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
      const glow = smoothRef.current * 20;
      
      cone.style.transform = `scale(${scale.toFixed(4)})`;
      cone.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.7}))`;
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, isPlaying, getBassEnergyR]);

  return (
    <div className="relative w-52 h-52 flex items-center justify-center">
      <img 
        src="/images/speaker/aro.png"
        alt="Aro"
        className="absolute inset-0 w-full h-full object-contain z-10"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
      />
      <img 
        ref={coneRef}
        src="/images/speaker/conemovel.png"
        alt="Cone"
        className="absolute w-40 h-40 object-contain z-20"
        style={{ 
          transformOrigin: 'center',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
          transition: 'transform 0.05s ease-out'
        }}
      />
    </div>
  );
}