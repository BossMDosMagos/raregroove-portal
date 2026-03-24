import { useRef, useEffect, useCallback } from 'react';

const REST_ANGLE = -45;
const MAX_ANGLE = 45;
const MIN_DB = -60;
const MAX_DB = 3;
const DAMPING = 0.12;
const PICO_DAMPING = 0.03;

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

    const drawDial = () => {
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f5f0e0');
      grad.addColorStop(0.3, '#ebe6d6');
      grad.addColorStop(0.7, '#d8d3c3');
      grad.addColorStop(1, '#c5c0b0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#8b7355';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, w, h);

      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(2, 2, w - 4, h - 4);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      const dialGrad = ctx.createRadialGradient(w/2, h + 20, 5, w/2, h + 20, h - 20);
      dialGrad.addColorStop(0, '#2a2520');
      dialGrad.addColorStop(0.7, '#1a1510');
      dialGrad.addColorStop(1, '#0a0500');
      ctx.fillStyle = dialGrad;
      ctx.beginPath();
      ctx.arc(w/2, h + 15, h - 25, Math.PI, 0, false);
      ctx.fill();

      ctx.strokeStyle = '#3a3530';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w/2, h + 15, h - 25, Math.PI, 0, false);
      ctx.stroke();

      ctx.strokeStyle = '#4a4540';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(w/2, h + 15, h - 30, Math.PI, 0, false);
      ctx.stroke();

      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 7px "Courier New", monospace';
      ctx.textAlign = 'center';
      
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
        const arcRadius = h - 28;
        const textRadius = h - 38;
        
        const x = w/2 + Math.cos(angle) * textRadius;
        const y = h + 15 + Math.sin(angle) * textRadius;
        
        const innerX = w/2 + Math.cos(angle) * (arcRadius - 5);
        const innerY = h + 15 + Math.sin(angle) * (arcRadius - 5);
        const outerX = w/2 + Math.cos(angle) * (arcRadius + (major ? 8 : 3));
        const outerY = h + 15 + Math.sin(angle) * (arcRadius + (major ? 8 : 3));
        
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.strokeStyle = major ? '#8b7355' : '#5a5550';
        ctx.lineWidth = major ? 1.5 : 0.8;
        ctx.stroke();
        
        if (major) {
          ctx.fillStyle = '#c4a882';
          ctx.font = 'bold 6px "Courier New", monospace';
          ctx.fillText(label, x, y + 2);
        }
      });

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(w/2, h + 15, h - 40, Math.PI * 1.08, Math.PI * -0.08, false);
      ctx.stroke();
    };

    const drawNeedle = (angle, peakAngle, isLeft) => {
      const centerX = w/2;
      const centerY = h + 15;
      const needleLength = h - 30;
      const rad = angle * (Math.PI / 180);
      
      const tipX = centerX + Math.cos(rad) * needleLength;
      const tipY = centerY + Math.sin(rad) * needleLength;
      
      const baseWidth = 4;
      const baseRad = (angle + 90) * (Math.PI / 180);
      const base1X = centerX + Math.cos(baseRad) * baseWidth;
      const base1Y = centerY + Math.sin(baseRad) * baseWidth;
      const base2X = centerX - Math.cos(baseRad) * baseWidth;
      const base2Y = centerY - Math.sin(baseRad) * baseWidth;
      
      ctx.save();
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 12;
      
      const needleGrad = ctx.createLinearGradient(centerX, centerY, tipX, tipY);
      needleGrad.addColorStop(0, '#cc0000');
      needleGrad.addColorStop(0.3, '#ff0000');
      needleGrad.addColorStop(0.7, '#ff2222');
      needleGrad.addColorStop(1, '#ff4444');
      
      ctx.beginPath();
      ctx.moveTo(base1X, base1Y);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(base2X, base2Y);
      ctx.closePath();
      ctx.fillStyle = needleGrad;
      ctx.fill();
      
      ctx.restore();
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      
      const knobGrad = ctx.createRadialGradient(centerX - 1, centerY - 1, 0, centerX, centerY, 5);
      knobGrad.addColorStop(0, '#ff3333');
      knobGrad.addColorStop(0.5, '#cc0000');
      knobGrad.addColorStop(1, '#880000');
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fillStyle = knobGrad;
      ctx.fill();

      if (peakAngle > angle + 2) {
        const peakRad = peakAngle * (Math.PI / 180);
        const peakX = centerX + Math.cos(peakRad) * (needleLength - 5);
        const peakY = centerY + Math.sin(peakRad) * (needleLength - 5);
        
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(peakX, peakY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawLabel = (x, label) => {
      ctx.fillStyle = '#c4a882';
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, h - 4);
    };

    const animate = () => {
      if (analyserData && analyserData.length >= 32 && isPlaying) {
        const leftAvg = Array.from(analyserData).slice(0, 16).reduce((a, v) => a + v, 0) / 16;
        const rightAvg = Array.from(analyserData).slice(16, 32).reduce((a, v) => a + v, 0) / 16;
        
        const leftDb = amplitudeToDb(leftAvg);
        const rightDb = amplitudeToDb(rightAvg);
        
        targetAngleL.current = dbToAngle(leftDb);
        targetAngleR.current = dbToAngle(rightDb);

        if (targetAngleL.current > peakL.current) {
          peakL.current = targetAngleL.current;
          peakHoldL.current = 20;
        }
        if (targetAngleR.current > peakR.current) {
          peakR.current = targetAngleR.current;
          peakHoldR.current = 20;
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

      drawDial();
      
      ctx.save();
      ctx.translate(w * 0.25, 0);
      drawNeedle(currentAngleL.current, peakL.current, true);
      drawLabel(w * 0.25, 'L');
      ctx.restore();
      
      ctx.save();
      ctx.translate(w * 0.75, 0);
      drawNeedle(currentAngleR.current, peakR.current, false);
      drawLabel(w * 0.75, 'R');
      ctx.restore();

      animationRef.current = requestAnimationFrame(animate);
    };

    drawDial();
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserData, isPlaying, dbToAngle, amplitudeToDb]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
        style={{ height: '85px' }}
      />
      <div className="absolute top-1 left-0 right-0 flex justify-center">
        <span className="text-[7px] text-yellow-700/80 font-bold tracking-widest uppercase">VU Stereo</span>
      </div>
    </div>
  );
}
