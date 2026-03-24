import { useRef, useEffect, useCallback } from 'react';

const MIN_ANGLE = -45;
const MAX_ANGLE = 45;
const MIN_DB = -60;
const MAX_DB = 3;
const DAMPING = 0.12;
const PICO_DAMPING = 0.04;

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

    const drawSingleVU = (centerX) => {
      const centerY = h - 18;
      const arcRadius = h - 38;

      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#e8e0d0');
      bgGrad.addColorStop(0.3, '#f5f0e8');
      bgGrad.addColorStop(0.7, '#d8d0c0');
      bgGrad.addColorStop(1, '#c0b8a8');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(centerX - 82, 2, 164, h - 4);

      ctx.strokeStyle = '#8b7355';
      ctx.lineWidth = 2;
      ctx.strokeRect(centerX - 82, 2, 164, h - 4);

      ctx.strokeStyle = '#5a4a3a';
      ctx.lineWidth = 4;
      ctx.strokeRect(centerX - 78, 5, 156, h - 10);

      const lightGrad = ctx.createRadialGradient(centerX, centerY - arcRadius/2, 0, centerX, centerY, arcRadius + 20);
      lightGrad.addColorStop(0, 'rgba(255, 250, 230, 0.15)');
      lightGrad.addColorStop(0.5, 'rgba(255, 245, 220, 0.08)');
      lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lightGrad;
      ctx.fillRect(centerX - 78, 5, 156, h - 10);

      ctx.beginPath();
      ctx.arc(centerX, centerY, arcRadius + 6, Math.PI, 0, false);
      ctx.fillStyle = '#1a1510';
      ctx.fill();

      ctx.strokeStyle = '#3a3025';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, arcRadius + 4, Math.PI, 0, false);
      ctx.stroke();

      ctx.strokeStyle = '#2a2015';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, arcRadius - 2, Math.PI, 0, false);
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
        const angle = dbToAngle(db) * (Math.PI / 180);
        const innerR = arcRadius - 5;
        const outerR = arcRadius + (major ? 10 : 5);
        
        const x1 = centerX + Math.cos(angle) * innerR;
        const y1 = centerY + Math.sin(angle) * innerR;
        const x2 = centerX + Math.cos(angle) * outerR;
        const y2 = centerY + Math.sin(angle) * outerR;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = major ? '#1a1a1a' : '#4a4a4a';
        ctx.lineWidth = major ? 1.5 : 0.8;
        ctx.stroke();
        
        if (major) {
          const textR = arcRadius - 18;
          const textX = centerX + Math.cos(angle) * textR;
          const textY = centerY + Math.sin(angle) * textR;
          
          ctx.fillStyle = '#1a1a1a';
          ctx.font = 'bold 6px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, textX, textY);
        }
      });

      return { centerX, centerY, arcRadius };
    };

    const drawNeedle = (centerX, centerY, arcRadius, angle) => {
      const needleLength = arcRadius - 10;
      const needleRad = angle * (Math.PI / 180);
      
      const tipX = centerX + Math.cos(needleRad) * needleLength;
      const tipY = centerY + Math.sin(needleRad) * needleLength;

      ctx.save();
      ctx.shadowColor = 'rgba(220, 30, 30, 0.7)';
      ctx.shadowBlur = 6;

      const needleGrad = ctx.createLinearGradient(centerX, centerY, tipX, tipY);
      needleGrad.addColorStop(0, '#cc0000');
      needleGrad.addColorStop(0.4, '#dd1100');
      needleGrad.addColorStop(0.7, '#ff2200');
      needleGrad.addColorStop(1, '#ff4433');

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(tipX - 0.5, tipY);
      ctx.lineTo(tipX + 0.5, tipY);
      ctx.closePath();
      ctx.fillStyle = needleGrad;
      ctx.fill();
      
      ctx.restore();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();

      const knobGrad = ctx.createRadialGradient(centerX - 1, centerY - 1, 0, centerX, centerY, 3);
      knobGrad.addColorStop(0, '#ff3322');
      knobGrad.addColorStop(1, '#aa0000');
      ctx.beginPath();
      ctx.arc(centerX, centerY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = knobGrad;
      ctx.fill();
    };

    const drawPeakMarker = (centerX, centerY, arcRadius, peakAngle) => {
      if (peakAngle <= MIN_ANGLE + 1) return;
      
      const markerR = arcRadius - 8;
      const markerRad = peakAngle * (Math.PI / 180);
      const markerX = centerX + Math.cos(markerRad) * markerR;
      const markerY = centerY + Math.sin(markerRad) * markerR;
      
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(markerX, markerY, 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      const vu1 = drawSingleVU(w * 0.25);
      const vu2 = drawSingleVU(w * 0.75);

      if (analyserData && analyserData.length >= 32 && isPlaying) {
        const leftAvg = Array.from(analyserData).slice(0, 16).reduce((a, v) => a + v, 0) / 16;
        const rightAvg = Array.from(analyserData).slice(16, 32).reduce((a, v) => a + v, 0) / 16;
        
        const leftDb = amplitudeToDb(leftAvg);
        const rightDb = amplitudeToDb(rightAvg);
        
        targetAngleL.current = dbToAngle(leftDb);
        targetAngleR.current = dbToAngle(rightDb);

        if (targetAngleL.current > peakL.current) {
          peakL.current = targetAngleL.current;
          peakHoldL.current = 30;
        }
        if (targetAngleR.current > peakR.current) {
          peakR.current = targetAngleR.current;
          peakHoldR.current = 30;
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

      drawNeedle(vu1.centerX, vu1.centerY, vu1.arcRadius, currentAngleL.current);
      drawNeedle(vu2.centerX, vu2.centerY, vu2.arcRadius, currentAngleR.current);

      drawPeakMarker(vu1.centerX, vu1.centerY, vu1.arcRadius, peakL.current);
      drawPeakMarker(vu2.centerX, vu2.centerY, vu2.arcRadius, peakR.current);

      ctx.fillStyle = '#2a2520';
      ctx.font = 'bold 10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('L', w * 0.25, h - 4);
      ctx.fillText('R', w * 0.75, h - 4);

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
    <div className="relative w-full" style={{ height: '88px' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      <div className="absolute top-0.5 left-0 right-0 flex justify-center">
        <span className="text-[7px] text-yellow-800 font-bold tracking-widest uppercase">VU Stereo</span>
      </div>
    </div>
  );
}
