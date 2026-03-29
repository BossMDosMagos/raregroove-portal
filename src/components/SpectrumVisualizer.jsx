import { useRef, useEffect } from 'react';

export function SpectrumLeft({ timeDomainL, isPlaying }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const prevRef = useRef(null);
  const isSilentRef = useRef(true);

  const midY = 28;
  const GAIN = 3.6;
  const LERP = 0.3;
  const NOISE_GATE = 0.008;

  const clearCanvas = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#020508';
    ctx.fillRect(0, 0, w, h);
  };

  const drawGrid = (ctx, w, h) => {
    ctx.strokeStyle = '#0a2a3a';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 12]);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    for (let y = midY - 14; y > 2; y -= 14) {
      ctx.strokeStyle = '#061820';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let y = midY + 14; y < h - 2; y += 14) {
      ctx.strokeStyle = '#061820';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  };

  const drawSilentLine = (ctx, w) => {
    const gradient = ctx.createLinearGradient(0, midY, w, midY);
    gradient.addColorStop(0, '#00ffff');
    gradient.addColorStop(0.5, '#00aaff');
    gradient.addColorStop(1, '#0044aa');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const drawNeonWave = (ctx, data, prevData, w) => {
    const newPrevData = new Float32Array(w);
    let isQuiet = true;
    const points = [];
    
    for (let i = 0; i < w; i++) {
      const dataIdx = Math.floor((i / w) * data.length);
      let v = (data[dataIdx] || 128) / 128.0;
      
      if (Math.abs(v - 1) < 0.002) v = 1;
      
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
      points.push({ x: i, y: finalY });
    }
    
    const drawPath = () => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      
      if (points.length > 1) {
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
      }
    };
    
    ctx.shadowBlur = 0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
    ctx.lineWidth = 12;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 40;
    drawPath();
    ctx.stroke();
    
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 5;
    ctx.shadowBlur = 20;
    drawPath();
    ctx.stroke();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    drawPath();
    ctx.stroke();
    
    return { data: newPrevData, isQuiet };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const animate = () => {
      if (!isPlaying) {
        if (!isSilentRef.current) {
          prevRef.current = null;
          isSilentRef.current = true;
        }
        
        clearCanvas(ctx, w, h);
        drawGrid(ctx, w, h);
        drawSilentLine(ctx, w);
        
        return;
      }
      
      isSilentRef.current = false;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h);
      
      const result = drawNeonWave(ctx, timeDomainL, prevRef.current, w);
      prevRef.current = result.data;
      
      if (!result.isQuiet) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = null;
        isSilentRef.current = true;
      }
    };

    if (isPlaying) {
      isSilentRef.current = false;
      animate();
    } else {
      clearCanvas(ctx, w, h);
      drawGrid(ctx, w, h);
      drawSilentLine(ctx, w);
    }

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [timeDomainL, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={56}
      style={{ 
        display: 'block', 
        imageRendering: 'pixelated', 
        borderRadius: '3px', 
        border: '1px solid #0a2a3a',
        backgroundColor: '#020508'
      }}
    />
  );
}

export function SpectrumRight({ timeDomainR, isPlaying }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const prevRef = useRef(null);
  const isSilentRef = useRef(true);

  const midY = 28;
  const GAIN = 3.6;
  const LERP = 0.3;
  const NOISE_GATE = 0.008;

  const clearCanvas = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#020508';
    ctx.fillRect(0, 0, w, h);
  };

  const drawGrid = (ctx, w, h) => {
    ctx.strokeStyle = '#0a2a3a';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 12]);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    for (let y = midY - 14; y > 2; y -= 14) {
      ctx.strokeStyle = '#061820';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let y = midY + 14; y < h - 2; y += 14) {
      ctx.strokeStyle = '#061820';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  };

  const drawSilentLine = (ctx, w) => {
    const gradient = ctx.createLinearGradient(0, midY, w, midY);
    gradient.addColorStop(0, '#00ffff');
    gradient.addColorStop(0.5, '#00aaff');
    gradient.addColorStop(1, '#0044aa');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const drawNeonWave = (ctx, data, prevData, w) => {
    const newPrevData = new Float32Array(w);
    let isQuiet = true;
    const points = [];
    
    for (let i = 0; i < w; i++) {
      const dataIdx = Math.floor((i / w) * data.length);
      let v = (data[dataIdx] || 128) / 128.0;
      
      if (Math.abs(v - 1) < 0.002) v = 1;
      
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
      points.push({ x: i, y: finalY });
    }
    
    const drawPath = () => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      
      if (points.length > 1) {
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
      }
    };
    
    ctx.shadowBlur = 0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
    ctx.lineWidth = 12;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 40;
    drawPath();
    ctx.stroke();
    
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 5;
    ctx.shadowBlur = 20;
    drawPath();
    ctx.stroke();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    drawPath();
    ctx.stroke();
    
    return { data: newPrevData, isQuiet };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const animate = () => {
      if (!isPlaying) {
        if (!isSilentRef.current) {
          prevRef.current = null;
          isSilentRef.current = true;
        }
        
        clearCanvas(ctx, w, h);
        drawGrid(ctx, w, h);
        drawSilentLine(ctx, w);
        
        return;
      }
      
      isSilentRef.current = false;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h);
      
      const result = drawNeonWave(ctx, timeDomainR, prevRef.current, w);
      prevRef.current = result.data;
      
      if (!result.isQuiet) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = null;
        isSilentRef.current = true;
      }
    };

    if (isPlaying) {
      isSilentRef.current = false;
      animate();
    } else {
      clearCanvas(ctx, w, h);
      drawGrid(ctx, w, h);
      drawSilentLine(ctx, w);
    }

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [timeDomainR, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={56}
      style={{ 
        display: 'block', 
        imageRendering: 'pixelated', 
        borderRadius: '3px', 
        border: '1px solid #0a2a3a',
        backgroundColor: '#020508'
      }}
    />
  );
}
