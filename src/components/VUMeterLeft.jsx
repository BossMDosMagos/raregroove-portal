import { useRef, useEffect } from 'react';
import vuLImg from '../assets/images/vu/vu-l.png';
import { useGlobalAudioAnalyser } from '../hooks/useGlobalAudioAnalyser.js';

const ANSI = {
  OMEGA_N: 21.0,
  ZETA: 0.80,
  REF_DBFS: -18.0,
  SCALE_MIN: -20,
  SCALE_MAX: 3,
  RMS_FRAMES: 18,
};

export function VUMeterLeft({ isPlaying }) {
  const canvasRef = useRef(null);
  const ballRef = useRef({ pos: 0, vel: 0 });
  const rmsBufRef = useRef(new Float32Array(ANSI.RMS_FRAMES));
  const targetRef = useRef(0);
  const lastTimeRef = useRef(null);
  const animationRef = useRef(null);
  const debugCountRef = useRef(0);
  
  const { isReady, getRMSL } = useGlobalAudioAnalyser();

  const vuToPos = (vu) => {
    return (vu - ANSI.SCALE_MIN) / (ANSI.SCALE_MAX - ANSI.SCALE_MIN);
  };

  const rmsToPos = (rms) => {
    if (rms < 0.000031623) return 0;
    const dbfs = 20 * Math.log10(rms);
    const vu = dbfs - ANSI.REF_DBFS;
    return Math.max(0, Math.min(1, vuToPos(vu)));
  };

  const stepBall = (target, dt) => {
    const ball = ballRef.current;
    const acc = ANSI.OMEGA_N * ANSI.OMEGA_N * (target - ball.pos) - 2 * ANSI.ZETA * ANSI.OMEGA_N * ball.vel;
    ball.vel += acc * dt;
    ball.pos += ball.vel * dt;
    ball.pos = Math.max(-0.02, Math.min(1.05, ball.pos));
    return ball.pos;
  };

  const drawNeedle = (canvas, posNorm) => {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const cx = W * 0.5;
    const cy = H * 1.18;
    const len = H * 1.12;

    const ANG_L = -Math.PI * 0.38;
    const ANG_R = Math.PI * 0.38;
    const range = ANG_R - ANG_L;

    const pos = Math.max(-0.02, Math.min(1.05, posNorm));
    const needAng = ANG_L + pos * range;
    const ex = cx + Math.sin(needAng) * len;
    const ey = cy - Math.cos(needAng) * len;

    let c1, c2, glow;
    if (pos >= vuToPos(0)) { c1 = '#ff0000'; c2 = '#ff3333'; glow = 'rgba(255,0,0,0.9)'; }
    else if (pos >= vuToPos(-3)) { c1 = '#ff1111'; c2 = '#ff4444'; glow = 'rgba(255,50,50,0.7)'; }
    else { c1 = '#ff2222'; c2 = '#ff5555'; glow = 'rgba(255,80,80,0.5)'; }

    const grad = ctx.createLinearGradient(cx, cy, ex, ey);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);

    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const ledX = W * 0.88;
    const ledY = H * 0.12;
    const ledR = W * 0.021;

    let ledColor, ledGlow;
    if (pos >= vuToPos(0)) {
      ledColor = '#ff0000';
      ledGlow = 'rgba(255,0,0,0.9)';
    } else if (pos >= vuToPos(-3)) {
      ledColor = '#ffff00';
      ledGlow = 'rgba(255,255,0,0.8)';
    } else {
      ledColor = '#00ff00';
      ledGlow = 'rgba(0,255,0,0.7)';
    }

    ctx.beginPath();
    ctx.arc(ledX, ledY, ledR + 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ledX, ledY, ledR, 0, Math.PI * 2);
    ctx.fillStyle = ledColor;
    ctx.shadowColor = ledGlow;
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const animate = (timestamp) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      let leftRMS = 0;
      
      if (isReady && isPlaying) {
        leftRMS = getRMSL();
        
        // DEBUG: Log a cada 60 frames + check de sinal zero
        debugCountRef.current++;
        if (debugCountRef.current % 60 === 0) {
          if (leftRMS === 0) {
            console.warn('⚠️ VU L - ANALYSER RECEBENDO SILÊNCIO - verificar source.connect(vuGainNode)');
          }
          console.log("VU L - isReady:", isReady, "isPlaying:", isPlaying, "RMS:", leftRMS.toFixed(6));
        }
      }

      targetRef.current = leftRMS;

      const rmsBuf = rmsBufRef.current;
      const idx = Math.floor(timestamp / 16) % ANSI.RMS_FRAMES;
      rmsBuf[idx] = targetRef.current * targetRef.current;

      let sL = 0;
      for (let i = 0; i < ANSI.RMS_FRAMES; i++) {
        sL += rmsBuf[i];
      }
      const rmsL = Math.sqrt(sL / ANSI.RMS_FRAMES);

      const targetL = rmsToPos(rmsL);
      const posL = stepBall(targetL, dt);

      drawNeedle(canvas, posL);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, isPlaying, getRMSL]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-black text-yellow-600 tracking-wider">L</span>
      <canvas 
        ref={canvasRef} 
        className="w-[175px] h-[90px]"
        style={{ 
          backgroundImage: `url(${vuLImg})`,
          backgroundSize: '100% 100%',
        }}
      />
    </div>
  );
}

export default VUMeterLeft;
