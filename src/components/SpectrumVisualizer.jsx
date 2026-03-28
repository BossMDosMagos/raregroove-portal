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

    const drawOscilloscope = (ctx, timeData, freqData, label) => {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const midY = h / 2;

      ctx.fillStyle = '#0a0f0a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#1a2f1a';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let y = midY - 10; y > 4; y -= 10) {
        ctx.strokeStyle = '#152515';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let y = midY + 10; y < h - 4; y += 10) {
        ctx.strokeStyle = '#152515';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const pixelSize = 2;

      const drawWave = (data, color, glowColor, opacity) => {
        if (!data || data.length === 0) return;
        
        ctx.globalAlpha = opacity;

        for (let x = 0; x < w; x += pixelSize) {
          const dataIdx = Math.floor((x / w) * data.length);
          const sample = (data[dataIdx] || 128) / 128 - 1;
          const amplitude = freqData && freqData.length > 0 
            ? (freqData[Math.floor((x / w) * freqData.length)] / 255) * 0.6 + 0.4
            : 0.6;
          const y = midY + sample * midY * 0.9 * amplitude;

          ctx.fillStyle = glowColor;
          ctx.fillRect(Math.floor(x / pixelSize) * pixelSize, Math.floor(y / pixelSize) * pixelSize - 1, pixelSize, pixelSize + 2);

          ctx.fillStyle = color;
          ctx.fillRect(Math.floor(x / pixelSize) * pixelSize, Math.floor(y / pixelSize) * pixelSize, pixelSize, pixelSize);

          if (sample > 0.3) {
            ctx.fillStyle = glowColor;
            ctx.fillRect(Math.floor(x / pixelSize) * pixelSize, Math.floor(y / pixelSize) * pixelSize - pixelSize, pixelSize, pixelSize);
          } else if (sample < -0.3) {
            ctx.fillStyle = glowColor;
            ctx.fillRect(Math.floor(x / pixelSize) * pixelSize, Math.floor(y / pixelSize) * pixelSize + pixelSize, pixelSize, pixelSize);
          }
        }

        ctx.globalAlpha = 1;
      };

      if (timeData && timeData.length > 0) {
        drawWave(timeData, '#00ffb3', 'rgba(0, 255, 179, 0.3)', 1);
      } else {
        const syntheticWave = new Uint8Array(w);
        for (let i = 0; i < w; i++) {
          const t = (i / w) * Math.PI * 6 + phaseRef.current;
          const freq = freqData && freqData.length > 0 
            ? (freqData[Math.floor((i / w) * freqData.length)] / 255)
            : 0.5;
          const wave = (Math.sin(t) * 0.4 + Math.sin(t * 2.3) * 0.2 + Math.sin(t * 0.7) * 0.2) * freq;
          syntheticWave[i] = Math.floor(((wave + 1) / 2) * 255);
        }
        drawWave(syntheticWave, '#00ffb3', 'rgba(0, 255, 179, 0.3)', 0.7);
      }

      ctx.fillStyle = '#d4a84b';
      ctx.font = '6px monospace';
      ctx.fillText(label, 3, 8);
    };

    const animate = () => {
      if (!isPlaying) {
        drawOscilloscope(ctxL, null, spectrumL, '◄ L ►');
        drawOscilloscope(ctxR, null, spectrumR, '◄ R ►');
      } else {
        phaseRef.current += 0.08;
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
          style={{ display: 'block', imageRendering: 'pixelated', borderRadius: '2px', border: '1px solid #1a2f1a' }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[6px] font-mono w-6 text-right" style={{ color: '#00ffb3' }}>CH2</span>
        <canvas
          ref={canvasRRef}
          width={340}
          height={48}
          className="flex-1 h-12"
          style={{ display: 'block', imageRendering: 'pixelated', borderRadius: '2px', border: '1px solid #1a2f1a' }}
        />
      </div>
    </div>
  );
}
