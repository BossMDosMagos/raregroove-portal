import { useRef, useEffect, useCallback, useState } from 'react';

const MIN_DB = -60;
const MAX_DB = 3;
const MIN_ANGLE = -55;
const MAX_ANGLE = 55;
const DAMPING = 0.15;
const PICO_DAMPING = 0.05;

export function VUMeter({ analyserData, isPlaying }) {
  const [vuBgL, setVuBgL] = useState(null);
  const [vuBgR, setVuBgR] = useState(null);
  
  useEffect(() => {
    const loadBg = async () => {
      try {
        const bgL = new Image();
        bgL.src = '/images/vu/vu-l.png';
        await new Promise((resolve, reject) => {
          bgL.onload = resolve;
          bgL.onerror = reject;
        });
        setVuBgL(bgL);
        
        const bgR = new Image();
        bgR.src = '/images/vu/vu-r.png';
        await new Promise((resolve, reject) => {
          bgR.onload = resolve;
          bgR.onerror = reject;
        });
        setVuBgR(bgR);
      } catch (e) {
        console.warn('[VU] Background image not loaded:', e);
      }
    };
    loadBg();
  }, []);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const currentAngleL = useRef(MIN_ANGLE);
  const currentAngleR = useRef(MIN_ANGLE);
  const targetAngleL = useRef(MIN_ANGLE);
  const targetAngleR = useRef(MIN_ANGLE);
  const peakL = useRef(MIN_ANGLE);
  const peakR = useRef(MIN_ANGLE);
  const peakHoldL = useRef(0);
  const peakHoldR = useRef(0);

  const dbToAngle = useCallback((db) => {
    const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, db));
    const normalized = (clampedDb - MIN_DB) / (MAX_DB - MIN_DB);
    return MIN_ANGLE + normalized * (MAX_ANGLE - MIN_ANGLE);
  }, []);

  const amplitudeToDb = useCallback((amplitude) => {
    if (amplitude <= 0) return MIN_DB;
    return 20 * Math.log10(amplitude / 255);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    const drawVU = (cx, bgImage) => {
      const arcCenterX = cx;
      const arcCenterY = h - 18;
      const arcRadius = h - 38;

      if (bgImage) {
        ctx.drawImage(bgImage, cx - 82, 2, 164, h - 4);
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#e8e0d0');
        bgGrad.addColorStop(0.3, '#f5f0e5');
        bgGrad.addColorStop(0.7, '#ddd5c5');
        bgGrad.addColorStop(1, '#ccc4b4');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(cx - 82, 2, 164, h - 4);

        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 82, 2, 164, h - 4);
      }

      return { arcCenterX, arcCenterY, arcRadius };
    };

    const drawNeedle = (arcCenterX, arcCenterY, arcRadius, angle) => {
      const angleRad = (angle - 90) * (Math.PI / 180);
      const needleLength = arcRadius - 14;
      
      const baseX = arcCenterX + Math.cos(angleRad) * 6;
      const baseY = arcCenterY + Math.sin(angleRad) * 6;
      const tipX = arcCenterX + Math.cos(angleRad) * needleLength;
      const tipY = arcCenterY + Math.sin(angleRad) * needleLength;

      const perpRad = angleRad + Math.PI / 2;
      const baseWidth = 2;

      ctx.save();
      ctx.shadowColor = 'rgba(180, 20, 20, 0.6)';
      ctx.shadowBlur = 4;

      const needleGrad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
      needleGrad.addColorStop(0, '#880000');
      needleGrad.addColorStop(0.3, '#cc1100');
      needleGrad.addColorStop(0.7, '#dd2200');
      needleGrad.addColorStop(1, '#ff3322');

      ctx.beginPath();
      ctx.moveTo(baseX + Math.cos(perpRad) * baseWidth, baseY + Math.sin(perpRad) * baseWidth);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseX - Math.cos(perpRad) * baseWidth, baseY - Math.sin(perpRad) * baseWidth);
      ctx.closePath();
      ctx.fillStyle = needleGrad;
      ctx.fill();
      
      ctx.restore();

      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();

      const knobGrad = ctx.createRadialGradient(arcCenterX - 1, arcCenterY - 1, 0, arcCenterX, arcCenterY, 4);
      knobGrad.addColorStop(0, '#ee2211');
      knobGrad.addColorStop(1, '#880000');
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, 3, 0, Math.PI * 2);
      ctx.fillStyle = knobGrad;
      ctx.fill();
    };

    const drawPeak = (arcCenterX, arcCenterY, arcRadius, peakAngle) => {
      if (peakAngle <= MIN_ANGLE + 3) return;
      
      const angleRad = (peakAngle - 90) * (Math.PI / 180);
      const markerR = arcRadius - 12;
      const markerX = arcCenterX + Math.cos(angleRad) * markerR;
      const markerY = arcCenterY + Math.sin(angleRad) * markerR;
      
      ctx.fillStyle = '#dd0000';
      ctx.beginPath();
      ctx.arc(markerX, markerY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      const vu1 = drawVU(w * 0.25, vuBgL);
      const vu2 = drawVU(w * 0.75, vuBgR);

      if (analyserData && analyserData.length >= 32 && isPlaying) {
        const leftAvg = Array.from(analyserData).slice(0, 16).reduce((a, v) => a + v, 0) / 16;
        const rightAvg = Array.from(analyserData).slice(16, 32).reduce((a, v) => a + v, 0) / 16;
        
        targetAngleL.current = dbToAngle(amplitudeToDb(leftAvg));
        targetAngleR.current = dbToAngle(amplitudeToDb(rightAvg));

        if (targetAngleL.current > peakL.current) {
          peakL.current = targetAngleL.current;
          peakHoldL.current = 25;
        }
        if (targetAngleR.current > peakR.current) {
          peakR.current = targetAngleR.current;
          peakHoldR.current = 25;
        }

        if (peakHoldL.current > 0) peakHoldL.current--;
        else peakL.current += (targetAngleL.current - peakL.current) * PICO_DAMPING;
        
        if (peakHoldR.current > 0) peakHoldR.current--;
        else peakR.current += (targetAngleR.current - targetAngleR.current) * PICO_DAMPING;
      } else {
        targetAngleL.current = MIN_ANGLE;
        targetAngleR.current = MIN_ANGLE;
        peakL.current += (MIN_ANGLE - peakL.current) * PICO_DAMPING;
        peakR.current += (MIN_ANGLE - peakR.current) * PICO_DAMPING;
      }

      currentAngleL.current += (targetAngleL.current - currentAngleL.current) * DAMPING;
      currentAngleR.current += (targetAngleR.current - currentAngleR.current) * DAMPING;

      drawNeedle(vu1.arcCenterX, vu1.arcCenterY, vu1.arcRadius, currentAngleL.current);
      drawNeedle(vu2.arcCenterX, vu2.arcCenterY, vu2.arcRadius, currentAngleR.current);

      drawPeak(vu1.arcCenterX, vu1.arcCenterY, vu1.arcRadius, peakL.current);
      drawPeak(vu2.arcCenterX, vu2.arcCenterY, vu2.arcRadius, peakR.current);

      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('L', w * 0.25, h - 3);
      ctx.fillText('R', w * 0.75, h - 3);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserData, isPlaying, dbToAngle, amplitudeToDb, vuBgL, vuBgR]);

  return (
    <div className="w-full" style={{ height: '88px' }}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
