import { useRef, useEffect } from 'react';

export function SpectrumVisualizer({ spectrumL, spectrumR, timeDomainL, timeDomainR, isPlaying }) {
  const canvasLRef = useRef(null);
  const canvasRRef = useRef(null);
  const animRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvasL = canvasLRef.current;
    const canvasR = canvasRRef.current;
    if (!canvasL || !canvasR) return;

    const ctxL = canvasL.getContext('2d');
    const ctxR = canvasR.getContext('2d');

    const AMPLITUDE = 3.5;
    const PIXEL_SIZE = 3;
    const GLOW_INTENSITY = 1.5;

    const drawOscilloscope = (ctx, timeData, freqData, label) => {
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

      const drawWave = (data, isPrimary) => {
        if (!data || data.length === 0) return;

        const color = isPrimary ? '#00ffb3' : '#00aa77';
        const glowColor = isPrimary ? 'rgba(0, 255, 179, 0.5)' : 'rgba(0, 170, 119, 0.3)';

        if (isPrimary) {
          ctx.shadowColor = '#00ffb3';
          ctx.shadowBlur = 8 * GLOW_INTENSITY;
        }

        ctx.fillStyle = glowColor;
        for (let x = 0; x < w; x += PIXEL_SIZE) {
          const dataIdx = Math.floor((x / w) * data.length);
          let sample = (data[dataIdx] || 128) / 128 - 1;
          
          const freqAmplitude = freqData && freqData.length > 0 
            ? (freqData[Math.floor((x / w) * freqData.length)] / 255) * 0.5 + 0.5
            : 1;
          
          const amplitude = Math.min(freqAmplitude * AMPLITUDE, 4);
          sample *= amplitude;
          
          const y = midY + sample * (h / 2 - 4);

          ctx.fillRect(
            Math.floor(x / PIXEL_SIZE) * PIXEL_SIZE,
            Math.floor(y / PIXEL_SIZE) * PIXEL_SIZE,
            PIXEL_SIZE,
            PIXEL_SIZE * 2
          );

          if (sample > 0.5) {
            ctx.fillRect(
              Math.floor(x / PIXEL_SIZE) * PIXEL_SIZE,
              Math.floor((y - PIXEL_SIZE) / PIXEL_SIZE) * PIXEL_SIZE,
              PIXEL_SIZE,
              PIXEL_SIZE
            );
          }
          if (sample < -0.5) {
            ctx.fillRect(
              Math.floor(x / PIXEL_SIZE) * PIXEL_SIZE,
              Math.floor((y + PIXEL_SIZE) / PIXEL_SIZE) * PIXEL_SIZE,
              PIXEL_SIZE,
              PIXEL_SIZE
            );
          }
        }

        ctx.shadowBlur = 0;
      };

      if (timeData && timeData.length > 0) {
        drawWave(timeData, true);
      } else {
        const syntheticWave = new Uint8Array(w);
        for (let i = 0; i < w; i++) {
          const t = (i / w) * Math.PI * 8 + phaseRef.current;
          const freq = freqData && freqData.length > 0 
            ? (freqData[Math.floor((i / w) * freqData.length)] / 255) * 0.6 + 0.4
            : 0.3;
          const wave = (Math.sin(t) * 0.5 + Math.sin(t * 2.7) * 0.2 + Math.sin(t * 0.5) * 0.15) * freq;
          syntheticWave[i] = Math.floor(((wave + 1) / 2) * 255);
        }
        drawWave(syntheticWave, false);
      }

      ctx.fillStyle = '#d4a84b';
      ctx.font = '6px monospace';
      ctx.fillText(label, 3, 8);
    };

    const animate = () => {
      if (!isPlaying) {
        drawOscilloscope(ctxL, null, spectrumL, '◄ L ►');
        drawOscilloscope(ctxR, null, spectrumR, '◄ R ►');
        phaseRef.current += 0.03;
      } else {
        phaseRef.current += 0.05;
        drawOscilloscope(ctxL, timeDomainL, spectrumL, '◄ L ►');
        drawOscilloscope(ctxR, timeDomainR, spectrumR, '◄ R ►');
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
