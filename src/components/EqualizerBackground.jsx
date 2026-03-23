import React, { useEffect, useRef, useState } from 'react';

export default function EqualizerBackground({ isPlaying }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [bars] = useState(() => {
    const arr = [];
    for (let i = 0; i < 32; i++) {
      arr.push({
        baseHeight: Math.random() * 60 + 20,
        speed: Math.random() * 0.02 + 0.01,
        offset: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  });

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let time = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      time += 0.016;
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      ctx.clearRect(0, 0, width, height);

      const barWidth = width / bars.length;
      const gap = 2;

      bars.forEach((bar, i) => {
        const x = i * barWidth;
        const wave = Math.sin(time * bar.speed * 60 + bar.offset);
        const barHeight = bar.baseHeight + wave * 30;

        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, 'rgba(217, 49, 175, 0.3)');
        gradient.addColorStop(0.5, 'rgba(147, 51, 234, 0.2)');
        gradient.addColorStop(1, 'rgba(217, 49, 175, 0.1)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x + gap / 2, height - barHeight, barWidth - gap, barHeight, 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, bars]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
      style={{
        filter: 'blur(1px)',
      }}
    />
  );
}
