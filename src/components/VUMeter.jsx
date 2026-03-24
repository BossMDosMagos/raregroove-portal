import { useRef, useEffect, useCallback } from 'react';

const REST_ANGLE = -50;
const MAX_ANGLE = 50;
const MIN_DB = -60;
const MAX_DB = 3;
const DAMPING = 0.15;
const PICO_DAMPING = 0.05;

export function VUMeter({ analyserData, isPlaying }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const currentAngleL = useRef(REST_ANGLE);
  const currentAngleR = useRef(REST_ANGLE);
  const targetAngleL = useRef(REST_ANGLE);
  const targetAngleR = useRef(REST_ANGLE);
  const peakL = useRef(REST_ANGLE);
  const peakR = useRef(REST_ANGLE);
  const peakHoldL = useRef(0);
  const peakHoldR = useRef(0);

  const dbToAngle = useCallback((db) => {
    const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
    return REST_ANGLE + ((clamped - MIN_DB) / (MAX_DB - MIN_DB)) * (MAX_ANGLE - REST_ANGLE);
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

    const drawSingleVU = (cx, label) => {
      ctx.clearRect(cx - 90, 0, 180, h);

      const grad = ctx.createLinearGradient(cx - 85, 0, cx + 85, 0);
      grad.addColorStop(0, '#d4c8b0');
      grad.addColorStop(0.5, '#f5f0e5');
      grad.addColorStop(1, '#d4c8b0');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 85, 2, 170, h - 4);

      ctx.strokeStyle = '#8b7355';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 85, 2, 170, h - 4);

      ctx.strokeStyle = '#2a2520';
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 82, 5, 164, h - 10);

      const dialCx = cx;
      const dialCy = h - 15;
      const dialRadius = h - 35;

      const bgGrad = ctx.createRadialGradient(dialCx, dialCy, 0, dialCx, dialCy, dialRadius + 10);
      bgGrad.addColorStop(0, '#1a1510');
      bgGrad.addColorStop(0.8, '#0a0500');
      bgGrad.addColorStop(1, '#000000');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(dialCx, dialCy, dialRadius + 8, Math.PI, 0, false);
      ctx.fill();

      ctx.strokeStyle = '#4a4035';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(dialCx, dialCy, dialRadius + 5, Math.PI, 0, false);
      ctx.stroke();

      ctx.strokeStyle = '#3a3025';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(dialCx, dialCy, dialRadius - 5, Math.PI, 0, false);
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
        const arcRadius = dialRadius - 8;
        
        const innerX = dialCx + Math.cos(angle) * (arcRadius - 3);
        const innerY = dialCy + Math.sin(angle) * (arcRadius - 3);
        const outerX = dialCx + Math.cos(angle) * (arcRadius + (major ? 10 : 5));
        const outerY = dialCy + Math.sin(angle) * (arcRadius + (major ? 10 : 5));
        
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.strokeStyle = major ? '#1a1a1a' : '#3a3a3a';
        ctx.lineWidth = major ? 1.5 : 0.8;
        ctx.stroke();
        
        if (major) {
          const textRadius = dialRadius - 18;
          const textX = dialCx + Math.cos(angle) * textRadius;
          const textY = dialCy + Math.sin(angle) * textRadius;
          
          ctx.fillStyle = '#1a1a1a';
          ctx.font = 'bold 6px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, textX, textY);
        }
      });

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(dialCx, dialCy, dialRadius - 20, Math.PI * 1.1, Math.PI * -0.1, false);
      ctx.stroke();

      return { dialCx, dialCy, dialRadius };
    };

    const drawNeedle = (dialCx, dialCy, dialRadius, angle, peakAngle) => {
      const needleLength = dialRadius - 12;
      const rad = angle * (Math.PI / 180);
      
      const tipX = dialCx + Math.cos(rad) * needleLength;
      const tipY = dialCy + Math.sin(rad) * needleLength;
      
      ctx.save();
      ctx.shadowColor = 'rgba(255, 50, 50, 0.8)';
      ctx.shadowBlur = 8;
      
      const needleGrad = ctx.createLinearGradient(dialCx, dialCy, tipX, tipY);
      needleGrad.addColorStop(0, '#cc0000');
      needleGrad.addColorStop(0.5, '#ff2200');
      needleGrad.addColorStop(0.8, '#ff4444');
      needleGrad.addColorStop(1, '#ff6666');
      
      ctx.beginPath();
      ctx.moveTo(dialCx, dialCy);
      ctx.lineTo(tipX - 1, tipY);
      ctx.lineTo(tipX, tipY - 1);
      ctx.lineTo(tipX + 1, tipY);
      ctx.lineTo(dialCx, dialCy);
      ctx.closePath();
      ctx.fillStyle = needleGrad;
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(dialCx, dialCy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      
      const knobGrad = ctx.createRadialGradient(dialCx - 1, dialCy - 1, 0, dialCx, dialCy, 4);
      knobGrad.addColorStop(0, '#ff4444');
      knobGrad.addColorStop(0.5, '#cc0000');
      knobGrad.addColorStop(1, '#880000');
      ctx.beginPath();
      ctx.arc(dialCx, dialCy, 3, 0, Math.PI * 2);
      ctx.fillStyle = knobGrad;
      ctx.fill();
      
      ctx.restore();

      if (peakAngle > angle + 1) {
        const peakRad = peakAngle * (Math.PI / 180);
        const peakX = dialCx + Math.cos(peakRad) * (needleLength - 3);
        const peakY = dialCy + Math.sin(peakRad) * (needleLength - 3);
        
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(peakX, peakY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawLabel = (cx, label, y) => {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, cx, y);
    };

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      const vuL = drawSingleVU(w * 0.25, 'L');
      const vuR = drawSingleVU(w * 0.75, 'R');

      if (analyserData && analyserData.length >= 32 && isPlaying) {
        const leftAvg = Array.from(analyserData).slice(0, 16).reduce((a, v) => a + v, 0) / 16;
        const rightAvg = Array.from(analyserData).slice(16, 32).reduce((a, v) => a + v, 0) / 16;
        
        const leftDb = amplitudeToDb(leftAvg);
        const rightDb = amplitudeToDb(rightAvg);
        
        targetAngleL.current = dbToAngle(leftDb);
        targetAngleR.current = dbToAngle(rightDb);

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
        else peakR.current += (targetAngleR.current - peakR.current) * PICO_DAMPING;
      } else {
        targetAngleL.current = REST_ANGLE;
        targetAngleR.current = REST_ANGLE;
        peakL.current += (REST_ANGLE - peakL.current) * PICO_DAMPING;
        peakR.current += (REST_ANGLE - peakR.current) * PICO_DAMPING;
      }

      currentAngleL.current += (targetAngleL.current - currentAngleL.current) * DAMPING;
      currentAngleR.current += (targetAngleR.current - currentAngleR.current) * DAMPING;

      drawNeedle(vuL.dialCx, vuL.dialCy, vuL.dialRadius, currentAngleL.current, peakL.current);
      drawNeedle(vuR.dialCx, vuR.dialCy, vuR.dialRadius, currentAngleR.current, peakR.current);

      drawLabel(w * 0.25, 'L', h - 2);
      drawLabel(w * 0.75, 'R', h - 2);

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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      <div className="absolute top-1 left-0 right-0 flex justify-center">
        <span className="text-[8px] text-yellow-800 font-bold tracking-widest uppercase">VU Stereo</span>
      </div>
    </div>
  );
}
