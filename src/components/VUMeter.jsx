import { useRef, useEffect, useCallback } from 'react';

const REST_ANGLE = -45;
const MAX_ANGLE = 45;
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
  const peakDecayL = useRef(0);
  const peakDecayR = useRef(0);

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

    const draw = () => {
      const w = rect.width;
      const h = rect.height;
      const centerX = w / 2;
      const centerY = h - 10;
      const needleLength = h - 30;

      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = 'linear-gradient(180deg, #f8f8e8 0%, #e8e8d8 100%)';
      ctx.fillStyle = '#f5f5dc';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0, 0, w, h);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      const dbMarks = [3, 0, -3, -6, -12, -20, -40, -60];
      dbMarks.forEach((db) => {
        const angle = dbToAngle(db) * (Math.PI / 180);
        const x = centerX + Math.cos(angle) * (needleLength - 5);
        const y = centerY + Math.sin(angle) * (needleLength - 5);
        ctx.fillText(db.toString(), x, y + 2);
        
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * (needleLength - 15), centerY + Math.sin(angle) * (needleLength - 15));
        ctx.lineTo(centerX + Math.cos(angle) * needleLength, centerY + Math.sin(angle) * needleLength);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      ctx.beginPath();
      ctx.arc(centerX, centerY, needleLength, Math.PI + 0.3, -0.3, true);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, needleLength * 0.95, Math.PI + 0.3, -0.3, true);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.3;
      ctx.stroke();

      if (analyserData && analyserData.length >= 32 && isPlaying) {
        const leftAvg = Array.from(analyserData).slice(0, 16).reduce((a, v) => a + v, 0) / 16;
        const rightAvg = Array.from(analyserData).slice(16, 32).reduce((a, v) => a + v, 0) / 16;
        
        const leftDb = amplitudeToDb(leftAvg);
        const rightDb = amplitudeToDb(rightAvg);
        
        targetAngleL.current = dbToAngle(leftDb);
        targetAngleR.current = dbToAngle(rightDb);

        if (targetAngleL.current > peakL.current) {
          peakL.current = targetAngleL.current;
          peakDecayL.current = 30;
        }
        if (targetAngleR.current > peakR.current) {
          peakR.current = targetAngleR.current;
          peakDecayR.current = 30;
        }

        if (peakDecayL.current > 0) peakDecayL.current--;
        else peakL.current += (REST_ANGLE - peakL.current) * PICO_DAMPING;
        
        if (peakDecayR.current > 0) peakDecayR.current--;
        else peakR.current += (REST_ANGLE - peakR.current) * PICO_DAMPING;
      } else {
        targetAngleL.current = REST_ANGLE;
        targetAngleR.current = REST_ANGLE;
        peakL.current += (REST_ANGLE - peakL.current) * PICO_DAMPING;
        peakR.current += (REST_ANGLE - peakR.current) * PICO_DAMPING;
      }

      currentAngleL.current += (targetAngleL.current - currentAngleL.current) * DAMPING;
      currentAngleR.current += (targetAngleR.current - currentAngleR.current) * DAMPING;

      const drawNeedle = (angle, color) => {
        const rad = angle * (Math.PI / 180);
        const endX = centerX + Math.cos(rad) * needleLength;
        const endY = centerY + Math.sin(rad) * needleLength;

        const grad = ctx.createLinearGradient(centerX, centerY, endX, endY);
        grad.addColorStop(0, '#cc0000');
        grad.addColorStop(0.7, '#ff0000');
        grad.addColorStop(1, '#ff3333');

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#cc0000';
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(centerX, centerY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4444';
        ctx.fill();
      };

      ctx.save();
      ctx.translate(w * 0.25, 0);
      drawNeedle(currentAngleL.current, '#ff0000');
      ctx.restore();

      ctx.save();
      ctx.translate(w * 0.75, 0);
      drawNeedle(currentAngleR.current, '#ff0000');
      ctx.restore();

      ctx.fillStyle = '#222';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('L', w * 0.25, h - 2);
      ctx.fillText('R', w * 0.75, h - 2);
    };

    const animate = () => {
      draw();
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
    <div className="w-full h-[90px] relative rounded-lg overflow-hidden shadow-lg" style={{
      background: 'linear-gradient(180deg, #f8f8e8 0%, #e8e8d8 50%, #d4d4c0 100%)',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 0 20px rgba(255,100,100,0.15)'
    }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
      <div className="absolute top-1 left-0 right-0 flex justify-center">
        <span className="text-[8px] text-yellow-600/80 font-bold tracking-widest">◉ VU STEREO ◉</span>
      </div>
    </div>
  );
}
