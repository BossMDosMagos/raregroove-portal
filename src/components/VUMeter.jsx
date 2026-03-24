import { useRef, useEffect, useCallback } from 'react';

const MIN_DB = -60;
const MAX_DB = 3;
const MIN_ANGLE = -55;
const MAX_ANGLE = 55;
const DAMPING = 0.15;
const PICO_DAMPING = 0.05;

export function VUMeter({ analyserData, isPlaying }) {
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

    const drawVU = (cx) => {
      const arcCenterX = cx;
      const arcCenterY = h - 20;
      const arcRadius = h - 42;

      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#ddd8c8');
      bgGrad.addColorStop(0.4, '#f0ebe0');
      bgGrad.addColorStop(1, '#c8c0b0');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(cx - 80, 0, 160, h);

      ctx.strokeStyle = '#8b7355';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 80, 0, 160, h);

      ctx.strokeStyle = '#4a3a2a';
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 77, 3, 154, h - 6);

      const lightEffect = ctx.createRadialGradient(arcCenterX, arcCenterY - arcRadius/2, 0, arcCenterX, arcCenterY, arcRadius + 30);
      lightEffect.addColorStop(0, 'rgba(255, 250, 235, 0.25)');
      lightEffect.addColorStop(0.5, 'rgba(255, 245, 220, 0.1)');
      lightEffect.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lightEffect;
      ctx.fillRect(cx - 77, 3, 154, h - 6);

      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, arcRadius + 5, Math.PI, 0, false);
      ctx.fillStyle = '#1a1510';
      ctx.fill();

      ctx.strokeStyle = '#3a3025';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, arcRadius + 3, Math.PI, 0, false);
      ctx.stroke();

      ctx.strokeStyle = '#2a2015';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, arcRadius - 3, Math.PI, 0, false);
      ctx.stroke();

      const dbMarks = [
        { db: 3, label: '+3', major: true },
        { db: 0, label: '0', major: true },
        { db: -3, label: '-3', major: true },
        { db: -6, label: '-6', major: false },
        { db: -12, label: '-12', major: true },
        { db: -20, label: '-20', major: false },
        { db: -40, label: '-40', major: false },
        { db: -60, label: '-60', major: true },
      ];

      dbMarks.forEach(({ db, label, major }) => {
        const angle = dbToAngle(db);
        const angleRad = (angle - 90) * (Math.PI / 180);
        
        const innerR = arcRadius - 6;
        const outerR = arcRadius + (major ? 8 : 4);
        
        const x1 = arcCenterX + Math.cos(angleRad) * innerR;
        const y1 = arcCenterY + Math.sin(angleRad) * innerR;
        const x2 = arcCenterX + Math.cos(angleRad) * outerR;
        const y2 = arcCenterY + Math.sin(angleRad) * outerR;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = major ? '#1a1a1a' : '#4a4a4a';
        ctx.lineWidth = major ? 1.5 : 0.8;
        ctx.stroke();
        
        if (major) {
          const textR = arcRadius - 16;
          const textX = arcCenterX + Math.cos(angleRad) * textR;
          const textY = arcCenterY + Math.sin(angleRad) * textR;
          
          ctx.fillStyle = '#1a1a1a';
          ctx.font = 'bold 5.5px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, textX, textY);
        }
      });

      return { arcCenterX, arcCenterY, arcRadius };
    };

    const drawNeedle = (arcCenterX, arcCenterY, arcRadius, angle) => {
      const angleRad = (angle - 90) * (Math.PI / 180);
      const needleLength = arcRadius - 12;
      
      const tipX = arcCenterX + Math.cos(angleRad) * needleLength;
      const tipY = arcCenterY + Math.sin(angleRad) * needleLength;

      ctx.save();
      ctx.shadowColor = 'rgba(200, 30, 30, 0.8)';
      ctx.shadowBlur = 5;

      const needleGrad = ctx.createLinearGradient(arcCenterX, arcCenterY, tipX, tipY);
      needleGrad.addColorStop(0, '#aa0000');
      needleGrad.addColorStop(0.3, '#cc1100');
      needleGrad.addColorStop(0.6, '#dd2200');
      needleGrad.addColorStop(1, '#ff3322');

      ctx.beginPath();
      ctx.moveTo(arcCenterX, arcCenterY);
      ctx.lineTo(tipX - 0.3, tipY);
      ctx.lineTo(tipX + 0.3, tipY);
      ctx.closePath();
      ctx.fillStyle = needleGrad;
      ctx.fill();
      
      ctx.restore();

      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();

      const knobGrad = ctx.createRadialGradient(arcCenterX - 1, arcCenterY - 1, 0, arcCenterX, arcCenterY, 3);
      knobGrad.addColorStop(0, '#ff2211');
      knobGrad.addColorStop(1, '#880000');
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = knobGrad;
      ctx.fill();
    };

    const drawPeak = (arcCenterX, arcCenterY, arcRadius, peakAngle) => {
      if (peakAngle <= MIN_ANGLE + 2) return;
      
      const angleRad = (peakAngle - 90) * (Math.PI / 180);
      const markerR = arcRadius - 10;
      const markerX = arcCenterX + Math.cos(angleRad) * markerR;
      const markerY = arcCenterY + Math.sin(angleRad) * markerR;
      
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(markerX, markerY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      const vu1 = drawVU(w * 0.25);
      const vu2 = drawVU(w * 0.75);

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

      ctx.fillStyle = '#2a2520';
      ctx.font = 'bold 9px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('L', w * 0.25, h - 2);
      ctx.fillText('R', w * 0.75, h - 2);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserData, isPlaying, dbToAngle, amplitudeToDb]);

  return (
    <div className="relative w-full" style={{ height: '90px' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute top-0.5 left-0 right-0 flex justify-center">
        <span className="text-[6px] text-yellow-800 font-bold tracking-widest uppercase">VU Stereo</span>
      </div>
    </div>
  );
}
