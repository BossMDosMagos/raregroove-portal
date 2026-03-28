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
      const barCount = spectrumL?.length || 64;
      const barWidth = (w / barCount) * 0.7;
      const gap = (w / barCount) * 0.3;

      ctxL.clearRect(0, 0, w, h);
      ctxR.clearRect(0, 0, w, h);

      const drawBars = (ctx, spectrum, isTop) => {
        if (!spectrum || spectrum.length === 0) {
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(0, isTop ? h - 2 : 0, w, 2);
          return;
        }

        for (let i = 0; i < spectrum.length; i++) {
          const value = spectrum[i] / 255;
          const barHeight = value * h * 0.9;
          
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

        ctx.fillStyle = '#2a2520';
        if (isTop) {
          ctx.fillRect(0, h - 2, w, 2);
        } else {
          ctx.fillRect(0, 0, w, 2);
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
    <div className="flex flex-col gap-px px-2">
      <canvas
        ref={canvasLRef}
        width={280}
        height={40}
        className="w-full h-10 rounded-t-sm"
        style={{ imageRendering: 'pixelated' }}
      />
      <canvas
        ref={canvasRRef}
        width={280}
        height={40}
        className="w-full h-10 rounded-b-sm"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
