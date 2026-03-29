import { useRef, useEffect } from 'react';

export function SpectrumVisualizer({ spectrumL, spectrumR, timeDomainL, timeDomainR, isPlaying, isStopped }) {
  const canvasLRef = useRef(null);
  const canvasRRef = useRef(null);
  const animRef = useRef(null);
  const prevLRef = useRef(null);
  const prevRRef = useRef(null);
  const isSilentRef = useRef(true);

  const midY = 24;
  const GAIN = 3.0;
  const LERP = 0.25;
  const NOISE_GATE = 0.01;

  const clearCanvas = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, w, h);
  };

  const drawGrid = (ctx, w, h) => {
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
  };

  const drawSilentLine = (ctx, w, label) => {
    ctx.strokeStyle = '#00aa77';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.fillStyle = '#d4a84b';
    ctx.font = '6px monospace';
    ctx.fillText(label + ' ◼', 3, 8);
  };

  const drawActiveWave = (ctx, data, prevData, w, label) => {
    ctx.strokeStyle = '#00ffb3';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#00ffb3';
    ctx.shadowBlur = 4;
    
    ctx.beginPath();
    
    const newPrevData = new Float32Array(w);
    let isQuiet = true;
    
    for (let i = 0; i < w; i++) {
      const dataIdx = Math.floor((i / w) * data.length);
      let v = (data[dataIdx] || 128) / 128.0;
      
      if (Math.abs(v - 1) < 0.003) v = 1;
      
      const amplitude = v - 1;
      
      if (Math.abs(amplitude) > NOISE_GATE) {
        isQuiet = false;
      }
      
      const y = midY + amplitude * midY * GAIN;
      
      let finalY = y;
      if (prevData && prevData[i] !== undefined) {
        finalY = prevData[i] + (y - prevData[i]) * LERP;
      }
      
      newPrevData[i] = finalY;
      
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
    
    return { data: newPrevData, isQuiet };
  };

  useEffect(() => {
    const canvasL = canvasLRef.current;
    const canvasR = canvasRRef.current;
    if (!canvasL || !canvasR) return;

    const ctxL = canvasL.getContext('2d');
    const ctxR = canvasR.getContext('2d');
    const w = canvasL.width;
    const h = canvasL.height;

    const animate = () => {
      if (!isPlaying) {
        if (!isSilentRef.current) {
          prevLRef.current = null;
          prevRRef.current = null;
          isSilentRef.current = true;
        }
        
        clearCanvas(ctxL, w, h);
        drawGrid(ctxL, w, h);
        clearCanvas(ctxR, w, h);
        drawGrid(ctxR, w, h);
        drawSilentLine(ctxL, w, '◄ L ►');
        drawSilentLine(ctxR, w, '◄ R ►');
        
        return;
      }
      
      isSilentRef.current = false;
      
      clearCanvas(ctxL, w, h);
      drawGrid(ctxL, w, h);
      clearCanvas(ctxR, w, h);
      drawGrid(ctxR, w, h);
      
      const resultL = drawActiveWave(ctxL, timeDomainL, prevLRef.current, w, '◄ L ►');
      const resultR = drawActiveWave(ctxR, timeDomainR, prevRRef.current, w, '◄ R ►');
      
      prevLRef.current = resultL.data;
      prevRRef.current = resultR.data;
      
      if (resultL.isQuiet && resultR.isQuiet) {
        if (!isSilentRef.current) {
          prevLRef.current = null;
          prevRRef.current = null;
          isSilentRef.current = true;
        }
        return;
      }
      
      isSilentRef.current = false;
      animRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      isSilentRef.current = false;
      animate();
    } else {
      isSilentRef.current = true;
      clearCanvas(ctxL, w, h);
      drawGrid(ctxL, w, h);
      clearCanvas(ctxR, w, h);
      drawGrid(ctxR, w, h);
      drawSilentLine(ctxL, w, '◄ L ►');
      drawSilentLine(ctxR, w, '◄ R ►');
    }

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [timeDomainL, timeDomainR, isPlaying]);

  useEffect(() => {
    if (isStopped) {
      prevLRef.current = null;
      prevRRef.current = null;
      isSilentRef.current = true;
      
      const canvasL = canvasLRef.current;
      const canvasR = canvasRRef.current;
      if (canvasL && canvasR) {
        const ctxL = canvasL.getContext('2d');
        const ctxR = canvasR.getContext('2d');
        const w = canvasL.width;
        const h = canvasL.height;
        
        clearCanvas(ctxL, w, h);
        drawGrid(ctxL, w, h);
        clearCanvas(ctxR, w, h);
        drawGrid(ctxR, w, h);
        drawSilentLine(ctxL, w, '◄ L ►');
        drawSilentLine(ctxR, w, '◄ R ►');
      }
      
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    }
  }, [isStopped]);

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
