import { useRef, useEffect } from 'react';

export function SpectrumVisualizer({ spectrumL, spectrumR, timeDomainL, timeDomainR, isPlaying }) {
  const canvasLRef = useRef(null);
  const canvasRRef = useRef(null);
  const animRef = useRef(null);
  const smoothedLRef = useRef(null);
  const smoothedRRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvasL = canvasLRef.current;
    const canvasR = canvasRRef.current;
    if (!canvasL || !canvasR) return;

    const ctxL = canvasL.getContext('2d');
    const ctxR = canvasR.getContext('2d');

    const AMPLITUDE = 3.5;
    const PIXEL_SIZE = 4;
    const LERP_FACTOR = 0.15;
    const STEP = 3;

    const initSmoothed = (length) => {
      const arr = new Float32Array(length);
      arr.fill(128);
      return arr;
    };

    const drawOscilloscope = (ctx, timeData, freqData, label, smoothedData) => {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const midY = h / 2;

      ctx.fillStyle = '#0a0f0a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#1a3f1a';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let y = midY - 12; y > 2; y -= 12) {
        ctx.strokeStyle = '#152515';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let y = midY + 12; y < h - 2; y += 12) {
        ctx.strokeStyle = '#152515';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (!smoothedData || smoothedData.length === 0) {
        smoothedData = initSmoothed(timeData?.length || w);
      }

      if (timeData && timeData.length > 0) {
        if (smoothedData.length !== timeData.length) {
          smoothedData = initSmoothed(timeData.length);
        }
      }

      const drawWave = (data, isPrimary) => {
        if (!data || data.length === 0) {
          const syntheticWave = new Uint8Array(Math.floor(w / STEP));
          for (let i = 0; i < syntheticWave.length; i++) {
            const t = (i / syntheticWave.length) * Math.PI * 4 + phaseRef.current;
            const wave = Math.sin(t) * 0.2 + Math.sin(t * 2) * 0.1;
            syntheticWave[i] = Math.floor(((wave + 1) / 2) * 255);
          }
          data = syntheticWave;
        }

        if (smoothedData.length !== data.length) {
          smoothedData = initSmoothed(data.length);
        }

        const color = isPrimary ? '#00ffb3' : '#00aa77';

        ctx.strokeStyle = color;
        ctx.lineWidth = PIXEL_SIZE;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#00ffb3';
        ctx.shadowBlur = isPrimary ? 12 : 6;

        ctx.beginPath();

        let firstPoint = true;
        let prevX = 0;
        let prevY = midY;
        let prevSmoothY = midY;

        for (let x = 0; x < w; x += STEP) {
          const dataIdx = Math.floor((x / w) * data.length);
          let sample = (data[dataIdx] || 128) / 128 - 1;

          const freqAmplitude = freqData && freqData.length > 0
            ? (freqData[Math.floor((x / w) * freqData.length)] / 255) * 0.5 + 0.5
            : 1;

          const amplitude = Math.min(freqAmplitude * AMPLITUDE, 4);
          sample *= amplitude;

          const targetY = midY + sample * (h / 2 - 4);

          smoothedData[dataIdx] = smoothedData[dataIdx] + (targetY - smoothedData[dataIdx]) * LERP_FACTOR;

          const smoothY = smoothedData[dataIdx];

          if (firstPoint) {
            ctx.moveTo(x, smoothY);
            firstPoint = false;
          } else {
            const cpX = (prevX + x) / 2;
            const cpY = (prevSmoothY + smoothY) / 2;
            ctx.quadraticCurveTo(prevX, prevSmoothY, cpX, cpY);
          }

          prevX = x;
          prevY = targetY;
          prevSmoothY = smoothY;
        }

        ctx.lineTo(w, prevSmoothY);
        ctx.stroke();

        ctx.shadowBlur = 0;
      };

      if (timeData && timeData.length > 0) {
        drawWave(timeData, true);
      } else {
        drawWave(null, false);
      }

      ctx.fillStyle = '#d4a84b';
      ctx.font = '6px monospace';
      ctx.shadowBlur = 0;
      ctx.fillText(label, 3, 8);

      return smoothedData;
    };

    const animate = () => {
      if (!isPlaying) {
        phaseRef.current += 0.02;
        smoothedLRef.current = drawOscilloscope(ctxL, null, spectrumL, '◄ L ►', smoothedLRef.current);
        smoothedRRef.current = drawOscilloscope(ctxR, null, spectrumR, '◄ R ►', smoothedRRef.current);
      } else {
        phaseRef.current += 0.03;
        smoothedLRef.current = drawOscilloscope(ctxL, timeDomainL, spectrumL, '◄ L ►', smoothedLRef.current);
        smoothedRRef.current = drawOscilloscope(ctxR, timeDomainR, spectrumR, '◄ R ►', smoothedRRef.current);
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [spectrumL, spectrumR, timeDomainL, timeDomainR, isPlaying]);

  return (
    <div className="flex flex-col gap-0.5 px-2 py-1" style={{ backgroundColor: '#0a0f0a', borderRadius: '4px' }}>
      <div className="flex items-center gap-2">
        <span className="text-[6px] font-mono w-6 text-right" style={{ color: '#00ffb3' }}>CH1</span>
        <canvas
          ref={canvasLRef}
          width={340}
          height={48}
          className="flex-1 h-12"
          style={{ display: 'block', imageRendering: 'pixelated', borderRadius: '2px', border: '1px solid #1a3f1a' }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[6px] font-mono w-6 text-right" style={{ color: '#00ffb3' }}>CH2</span>
        <canvas
          ref={canvasRRef}
          width={340}
          height={48}
          className="flex-1 h-12"
          style={{ display: 'block', imageRendering: 'pixelated', borderRadius: '2px', border: '1px solid #1a3f1a' }}
        />
      </div>
    </div>
  );
}
