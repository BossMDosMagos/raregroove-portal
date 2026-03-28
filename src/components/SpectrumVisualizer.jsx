import { useRef, useEffect } from 'react';

export function SpectrumVisualizer({ spectrumL, spectrumR, timeDomainL, timeDomainR, isPlaying }) {
  const canvasLRef = useRef(null);
  const canvasRRef = useRef(null);
  const animRef = useRef(null);
  const prevLRef = useRef(null);
  const prevRRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvasL = canvasLRef.current;
    const canvasR = canvasRRef.current;
    if (!canvasL || !canvasR) return;

    const ctxL = canvasL.getContext('2d');
    const ctxR = canvasR.getContext('2d');

    const draw = (ctx, data, prevData, midY, label) => {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      
      ctx.clearRect(0, 0, w, h);
      
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
      
      if (!data || data.length === 0) {
        ctx.strokeStyle = '#00aa77';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();
        ctx.fillStyle = '#d4a84b';
        ctx.font = '6px monospace';
        ctx.fillText(label + ' ◼', 3, 8);
        return prevData;
      }
      
      const GAIN = 2.5;
      const LERP = 0.2;
      
      ctx.strokeStyle = '#00ffb3';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#00ffb3';
      ctx.shadowBlur = 6;
      
      ctx.beginPath();
      
      for (let i = 0; i < w; i++) {
        const dataIdx = Math.floor((i / w) * data.length);
        let v = (data[dataIdx] || 128) / 128.0;
        
        if (Math.abs(v - 1) < 0.005) v = 1;
        
        const y = midY + (v - 1) * midY * GAIN;
        
        let finalY = y;
        if (prevData && prevData[i] !== undefined) {
          finalY = prevData[i] + (y - prevData[i]) * LERP;
        }
        
        if (prevData) prevData[i] = finalY;
        
        if (i === 0) {
          ctx.moveTo(i, finalY);
        } else {
          ctx.lineTo(i, finalY);
        }
      }
      
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = '#d4a84b';
      ctx.font = '6px monospace';
      ctx.fillText(label + ' ●', 3, 8);
      
      return prevData || new Float32Array(w);
    };

    const animate = () => {
      const midY = 24;
      
      if (!isPlaying) {
        phaseRef.current += 0.03;
        
        const syntheticL = new Uint8Array(512);
        const syntheticR = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
          const t = (i / 512) * Math.PI * 6 + phaseRef.current;
          const wave = Math.sin(t) * 0.1 + Math.sin(t * 2) * 0.05;
          syntheticL[i] = Math.floor(((wave + 1) / 2) * 255);
          syntheticR[i] = Math.floor(((wave + 1) / 2) * 255);
        }
        
        prevLRef.current = draw(ctxL, syntheticL, prevLRef.current, midY, '◄ L ►');
        prevRRef.current = draw(ctxR, syntheticR, prevRRef.current, midY, '◄ R ►');
      } else {
        prevLRef.current = draw(ctxL, timeDomainL, prevLRef.current, midY, '◄ L ►');
        prevRRef.current = draw(ctxR, timeDomainR, prevRRef.current, midY, '◄ R ►');
      }
      
      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [timeDomainL, timeDomainR, isPlaying]);

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
