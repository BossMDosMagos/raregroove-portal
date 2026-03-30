import { useEffect, useRef } from 'react';
import { useGlobalAudioAnalyser } from '../hooks/useGlobalAudioAnalyser.js';

const SCALE_MIN = 1.0;
const SCALE_MAX = 1.12;
const SMOOTH = 0.85;

export function VirtualWooferLeft({ isPlaying }) {
  const speakerRef = useRef(null);
  const animationRef = useRef(null);
  const smoothRef = useRef(0);
  
  const { isReady, getBassEnergy, update } = useGlobalAudioAnalyser();

  useEffect(() => {
    const speaker = speakerRef.current;
    if (!speaker) return;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      if (!isReady || !isPlaying) {
        smoothRef.current *= 0.9;
        const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
        const glow = smoothRef.current * 15;
        speaker.style.transform = `scale(${scale.toFixed(4)})`;
        speaker.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.6}))`;
        return;
      }
      
      update();
      const bass = getBassEnergy();
      
      smoothRef.current = smoothRef.current * SMOOTH + bass * (1 - SMOOTH);
      
      const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
      const glow = smoothRef.current * 20;
      
      speaker.style.transform = `scale(${scale.toFixed(4)})`;
      speaker.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.7}))`;
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, isPlaying, getBassEnergy, update]);

  return (
    <div className="flex items-center justify-center">
      <img 
        ref={speakerRef}
        src="/images/speaker/falante.png"
        alt="Speaker L"
        className="w-52 h-52 object-contain transition-transform duration-75"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
      />
    </div>
  );
}

export function VirtualWooferRight({ isPlaying }) {
  const speakerRef = useRef(null);
  const animationRef = useRef(null);
  const smoothRef = useRef(0);
  
  const { isReady, getBassEnergy, update } = useGlobalAudioAnalyser();

  useEffect(() => {
    const speaker = speakerRef.current;
    if (!speaker) return;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      if (!isReady || !isPlaying) {
        smoothRef.current *= 0.9;
        const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
        const glow = smoothRef.current * 15;
        speaker.style.transform = `scale(${scale.toFixed(4)})`;
        speaker.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.6}))`;
        return;
      }
      
      update();
      const bass = getBassEnergy();
      
      smoothRef.current = smoothRef.current * SMOOTH + bass * (1 - SMOOTH);
      
      const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
      const glow = smoothRef.current * 20;
      
      speaker.style.transform = `scale(${scale.toFixed(4)})`;
      speaker.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.7}))`;
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, isPlaying, getBassEnergy, update]);

  return (
    <div className="flex items-center justify-center">
      <img 
        ref={speakerRef}
        src="/images/speaker/falante.png"
        alt="Speaker R"
        className="w-52 h-52 object-contain transition-transform duration-75"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
      />
    </div>
  );
}
