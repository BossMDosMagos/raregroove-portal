import { useRef, useEffect } from 'react';

export function SpectrumVisualizer({ spectrumL, spectrumR, timeDomainL, timeDomainR, isPlaying }) {
  const canvasLRef = useRef(null);
  const canvasRRef = useRef(null);
  const animRef = useRef(null);
  const smoothedLRef = useRef(null);
  const smoothedRRef = useRef(null);
  const phaseRef = useRef(0);
  const lastAudioRef = useRef(0);

  useEffect(() => {
    const canvasL = canvasLRef.current;
    const canvasR = canvasRRef.current;
    if (!canvasL || !canvasR) return;

    const ctxL = canvasL.getContext('2d');
    const ctxR = canvasR.getContext('2d');

    const AMPLITUDE = 3.5;
    const PIXEL_SIZE = 4;
    const LERP_FACTOR = 0.06;
    const STEP = 4;
    const NOISE_GATE = 0.02;
    const AVG_WINDOW = 4;

    const initSmoothed = (length) => {
      const arr = new Float32Array(length);
      const midVal = 128;
      arr.fill(midVal);
      return arr;
    };

    const calculateAverage = (data, start, end) => {
      let sum = 0;
      let count = 0;
      for (let i = start; i < end && i < data.length; i++) {
        sum += data[i];
        count++;
      }
      return count > 0 ? sum / count : 128;
    };

    const drawFlatLine = (ctx, midY, color) => {
      const w = ctx.canvas.width;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();
      ctx.shadowBlur = 0;
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

      let hasAudio = false;
      let avgLevel = 0;

      if (timeData && timeData.length > 0) {
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          sum += Math.abs((timeData[i] / 128) - 1);
        }
        avgLevel = sum / timeData.length;
        hasAudio = avgLevel > NOISE_GATE;
      }

      lastAudioRef.current = hasAudio ? Date.now() : lastAudioRef.current;

      if (!hasAudio) {
        if (smoothedData) {
          smoothedData.fill(128);
        }
        drawFlatLine(ctx, midY, '#00aa77');
        ctx.fillStyle = '#d4a84b';
        ctx.font = '6px monospace';
        ctx.fillText(label + ' ◼', 3, 8);
        return smoothedData;
      }

      if (!smoothedData || smoothedData.length === 0) {
        smoothedData = initSmoothed(timeData?.length || 256);
      }

      const data = timeData;
      if (!data || data.length === 0) {
        drawFlatLine(ctx, midY, '#00ffb3');
        ctx.fillStyle = '#d4a84b';
        ctx.font = '6px monospace';
        ctx.fillText(label, 3, 8);
        return smoothedData;
      }

      if (smoothedData.length !== data.length) {
        smoothedData = initSmoothed(data.length);
      }

      const color = '#00ffb3';

      ctx.strokeStyle = color;
      ctx.lineWidth = PIXEL_SIZE;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#00ffb3';
      ctx.shadowBlur = 10;

      ctx.beginPath();

      let firstPoint = true;
      let prevX = 0;
      let prevSmoothY = midY;

      for (let x = 0; x < w; x += STEP) {
        const avgStart = Math.floor((x / w) * data.length);
        const avgEnd = Math.min(avgStart + AVG_WINDOW, data.length);
        const avgSample = calculateAverage(data, avgStart, avgEnd);
        
        let sample = (avgSample / 128) - 1;

        const freqIdx = Math.floor((x / w) * (freqData?.length || 1));
        const freqAmplitude = freqData && freqData.length > 0
          ? (freqData[freqIdx] / 255) * 0.5 + 0.5
          : 1;

        const amplitude = Math.min(freqAmplitude * AMPLITUDE, 4);
        sample *= amplitude;

        const targetY = midY + sample * (h / 2 - 4);

        smoothedData[avgStart] = smoothedData[avgStart] + (targetY - smoothedData[avgStart]) * LERP_FACTOR;

        const smoothY = smoothedData[avgStart];

        if (firstPoint) {
          ctx.moveTo(x, smoothY);
          firstPoint = false;
        } else {
          const cpX = (prevX + x) / 2;
          const cpY = (prevSmoothY + smoothY) / 2;
          ctx.quadraticCurveTo(prevX, prevSmoothY, cpX, cpY);
        }

        prevX = x;
        prevSmoothY = smoothY;
      }

      ctx.lineTo(w, prevSmoothY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#d4a84b';
      ctx.font = '6px monospace';
      ctx.fillText(label + ' ●', 3, 8);

      return smoothedData;
    };

    const animate = () => {
      const now = Date.now();
      const timeSinceLastAudio = now - lastAudioRef.current;

      if (!isPlaying || timeSinceLastAudio > 500) {
        if (animRef.current) {
          cancelAnimationFrame(animRef.current);
          animRef.current = null;
        }
        if (canvasL && canvasR) {
          drawFlatLine(ctxL, 24, '#00aa77');
          ctxL.fillStyle = '#d4a84b';
          ctxL.font = '6px monospace';
          ctxL.fillText('◄ L ► ◼', 3, 8);
          drawFlatLine(ctxR, 24, '#00aa77');
          ctxR.fillStyle = '#d4a84b';
          ctxR.font = '6px monospace';
          ctxR.fillText('◄ R ► ◼', 3, 8);
        }
        return;
      }

      phaseRef.current += 0.02;

      if (!animRef.current) {
        animRef.current = requestAnimationFrame(animate);
      }

      smoothedLRef.current = drawOscilloscope(ctxL, timeDomainL, spectrumL, '◄ L ►', smoothedLRef.current);
      smoothedRRef.current = drawOscilloscope(ctxR, timeDomainR, spectrumR, '◄ R ►', smoothedRRef.current);

      animRef.current = requestAnimationFrame(animate);
    };

    smoothedLRef.current = initSmoothed(256);
    smoothedRRef.current = initSmoothed(256);

    animate();

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
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
