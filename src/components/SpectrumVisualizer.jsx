import { useRef, useEffect } from 'react';

export function SpectrumVisualizer({ spectrumL, spectrumR, isPlaying }) {
  const canvasLRef = useRef(null);
  const canvasRRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvasL = canvasLRef.current;
    const canvasR = canvasRRef.current;
    if (!canvasL || !canvasR) return;

    const ctxL = canvasL.getContext('2d');
    const ctxR = canvasR.getContext('2d');

    const draw = () => {
      const w = canvasL.width;
      const h = canvasL.height;
      const barCount = 64;
      const barWidth = (w / barCount) * 0.7;
      const gap = (w / barCount) * 0.3;

      ctxL.clearRect(0, 0, w, h);
      ctxR.clearRect(0, 0, w, h);

      const drawBars = (ctx, spectrum, isTop) => {
        if (!spectrum || spectrum.length === 0) {
          ctx.fillStyle = '#2a2520';
          for (let i = 0; i < barCount; i++) {
            ctx.fillRect(i * (barWidth + gap), isTop ? h - 3 : 0, barWidth, 3);
          }
          return;
        }

        for (let i = 0; i < spectrum.length; i++) {
          const value = spectrum[i] / 255;
          const barHeight = Math.max(2, value * h * 0.95);
          
          const gradient = ctx.createLinearGradient(0, isTop ? h : 0, 0, isTop ? h - barHeight : barHeight);
          gradient.addColorStop(0, '#ffd700');
          gradient.addColorStop(0.5, '#ff8800');
          gradient.addColorStop(1, '#ff4400');
          
          ctx.fillStyle = gradient;
          
          if (isTop) {
            ctx.fillRect(i * (barWidth + gap), h - barHeight, barWidth, barHeight);
          } else {
            ctx.fillRect(i * (barWidth + gap), 0, barWidth, barHeight);
          }
        }
      };

      drawBars(ctxL, spectrumL, true);
      drawBars(ctxR, spectrumR, false);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [spectrumL, spectrumR]);

  return (
    <div className="flex flex-col gap-0.5 px-2 py-1" style={{ backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
      <div className="flex items-center gap-2 px-1">
        <span className="text-[6px] font-mono" style={{ color: '#d4a84b' }}>L</span>
        <canvas
          ref={canvasLRef}
          width={320}
          height={24}
          className="flex-1 h-6"
          style={{ display: 'block', imageRendering: 'pixelated' }}
        />
      </div>
      <div className="flex items-center gap-2 px-1">
        <span className="text-[6px] font-mono" style={{ color: '#d4a84b' }}>R</span>
        <canvas
          ref={canvasRRef}
          width={320}
          height={24}
          className="flex-1 h-6"
          style={{ display: 'block', imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
}
