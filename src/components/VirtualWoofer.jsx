import { useEffect, useRef, useState } from 'react';
import { useGlobalAudioAnalyser } from '../hooks/useGlobalAudioAnalyser.js';

const SCALE_MIN = 1.0;
const SCALE_MAX = 1.12;
const SMOOTH = 0.85;
const CONTAINER_SIZE = 208;

export function VirtualWooferLeft({ isPlaying }) {
  const coneRef = useRef(null);
  const aroRef = useRef(null);
  const animationRef = useRef(null);
  const smoothRef = useRef(0);
  const [aroScale, setAroScale] = useState(1);
  
  const { isReady, getBassEnergyL } = useGlobalAudioAnalyser();

  useEffect(() => {
    const aroImg = aroRef.current;
    const coneImg = coneRef.current;
    if (!aroImg || !coneImg) return;

    const handleLoad = () => {
      const naturalWidth = aroImg.naturalWidth;
      if (naturalWidth > 0) {
        const scale = CONTAINER_SIZE / naturalWidth;
        setAroScale(scale);
      }
    };

    if (aroImg.complete) {
      handleLoad();
    } else {
      aroImg.addEventListener('load', handleLoad);
      return () => aroImg.removeEventListener('load', handleLoad);
    }
  }, []);

  useEffect(() => {
    const cone = coneRef.current;
    if (!cone) return;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      if (!isReady || !isPlaying) {
        smoothRef.current *= 0.9;
        const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
        const glow = smoothRef.current * 15;
        cone.style.transform = `scale(${aroScale * scale})`;
        cone.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.6}))`;
        return;
      }
      
      const bass = getBassEnergyL();
      
      smoothRef.current = smoothRef.current * SMOOTH + bass * (1 - SMOOTH);
      
      const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
      const glow = smoothRef.current * 20;
      
      cone.style.transform = `scale(${aroScale * scale})`;
      cone.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.7}))`;
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, isPlaying, getBassEnergyL, aroScale]);

  return (
    <div className="relative w-52 h-52 flex items-center justify-center">
      <img 
        ref={aroRef}
        src="/images/speaker/aro.png"
        alt="Aro"
        className="absolute inset-0 w-full h-full z-10"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
      />
      <img 
        ref={coneRef}
        src="/images/speaker/conemovel.png"
        alt="Cone"
        className="absolute inset-0 w-full h-full z-20"
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
  const aroRef = useRef(null);
  const animationRef = useRef(null);
  const smoothRef = useRef(0);
  const [aroScale, setAroScale] = useState(1);
  
  const { isReady, getBassEnergyR } = useGlobalAudioAnalyser();

  useEffect(() => {
    const aroImg = aroRef.current;
    const coneImg = coneRef.current;
    if (!aroImg || !coneImg) return;

    const handleLoad = () => {
      const naturalWidth = aroImg.naturalWidth;
      if (naturalWidth > 0) {
        const scale = CONTAINER_SIZE / naturalWidth;
        setAroScale(scale);
      }
    };

    if (aroImg.complete) {
      handleLoad();
    } else {
      aroImg.addEventListener('load', handleLoad);
      return () => aroImg.removeEventListener('load', handleLoad);
    }
  }, []);

  useEffect(() => {
    const cone = coneRef.current;
    if (!cone) return;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      if (!isReady || !isPlaying) {
        smoothRef.current *= 0.9;
        const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
        const glow = smoothRef.current * 15;
        cone.style.transform = `scale(${aroScale * scale})`;
        cone.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.6}))`;
        return;
      }
      
      const bass = getBassEnergyR();
      
      smoothRef.current = smoothRef.current * SMOOTH + bass * (1 - SMOOTH);
      
      const scale = SCALE_MIN + smoothRef.current * (SCALE_MAX - SCALE_MIN);
      const glow = smoothRef.current * 20;
      
      cone.style.transform = `scale(${aroScale * scale})`;
      cone.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 180, 0, ${smoothRef.current * 0.7}))`;
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, isPlaying, getBassEnergyR, aroScale]);

  return (
    <div className="relative w-52 h-52 flex items-center justify-center">
      <img 
        ref={aroRef}
        src="/images/speaker/aro.png"
        alt="Aro"
        className="absolute inset-0 w-full h-full z-10"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
      />
      <img 
        ref={coneRef}
        src="/images/speaker/conemovel.png"
        alt="Cone"
        className="absolute inset-0 w-full h-full z-20"
        style={{ 
          transformOrigin: 'center',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
          transition: 'transform 0.05s ease-out'
        }}
      />
    </div>
  );
}