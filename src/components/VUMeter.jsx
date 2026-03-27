import { useRef, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'raregroove_vu_calibration';

const ANSI = {
  OMEGA_N: 21.0,
  ZETA: 0.80,
  REF_DBFS: -18.0,
  SCALE_MIN: -20,
  SCALE_MAX: 3,
  RMS_FRAMES: 18,
};

const MARKS = [
  { vu: -20, label: '-20', minor: false },
  { vu: -10, label: '-10', minor: false },
  { vu: -7, label: '-7', minor: true },
  { vu: -5, label: '-5', minor: false },
  { vu: -3, label: '-3', minor: false },
  { vu: -2, label: '-2', minor: true },
  { vu: -1, label: '-1', minor: true },
  { vu: 0, label: '0', minor: false },
  { vu: 1, label: '+1', minor: true },
  { vu: 2, label: '+2', minor: true },
  { vu: 3, label: '+3', minor: false },
];

const DEFAULTS = {
  inputGain: 1.0,
  damping: 0.35,
};

export function VUMeter({ vuMeterData, isPlaying }) {
  const [showCalibration, setShowCalibration] = useState(false);
  const [bgImage, setBgImage] = useState(null);
  const [calibration, setCalibration] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULTS, ...JSON.parse(saved) };
      } catch {
        return DEFAULTS;
      }
    }
    return DEFAULTS;
  });

  const ballRef = useRef({ L: { pos: 0, vel: 0 }, R: { pos: 0, vel: 0 } });
  const rmsBufRef = useRef({
    L: new Float32Array(ANSI.RMS_FRAMES),
    R: new Float32Array(ANSI.RMS_FRAMES),
    idx: 0,
  });
  const targetRef = useRef({ L: 0, R: 0 });

  const canvasLRef = useRef(null);
  const canvasRRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);
  const calRef = useRef(calibration);
  const isPlayingRef = useRef(isPlaying);
  const bgImageRef = useRef(null);
  const imageSizeRef = useRef({ width: 502, height: 534 });

  useEffect(() => {
    calRef.current = calibration;
  }, [calibration]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const loadBg = async () => {
      try {
        const img = new Image();
        img.src = '/images/vu/base vintage.png';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        setBgImage(img);
        bgImageRef.current = img;
        const halfWidth = Math.floor(img.naturalWidth / 2);
        imageSizeRef.current = { width: halfWidth, height: img.naturalHeight };
      } catch {
        console.log('[VUMeter] Fundo vintage não carregado');
      }
    };
    loadBg();
  }, []);

  const saveCalibration = useCallback((newCal) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCal));
    setCalibration(newCal);
    calRef.current = newCal;
  }, []);

  const vuToPos = (vu) => {
    return (vu - ANSI.SCALE_MIN) / (ANSI.SCALE_MAX - ANSI.SCALE_MIN);
  };

  const rmsToPos = (rms) => {
    if (rms < 0.000031623) return 0;
    const dbfs = 20 * Math.log10(rms);
    const vu = dbfs - ANSI.REF_DBFS;
    return Math.max(0, Math.min(1, vuToPos(vu)));
  };

  const stepBall = (ch, target, dt) => {
    const ball = ballRef.current[ch];
    const acc = ANSI.OMEGA_N * ANSI.OMEGA_N * (target - ball.pos) - 2 * ANSI.ZETA * ANSI.OMEGA_N * ball.vel;
    ball.vel += acc * dt;
    ball.pos += ball.vel * dt;
    ball.pos = Math.max(-0.02, Math.min(1.05, ball.pos));
    return ball.pos;
  };

  useEffect(() => {
    const canvasL = canvasLRef.current;
    const canvasR = canvasRRef.current;
    if (!canvasL || !canvasR) return;

    const animate = (timestamp) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const gain = calRef.current.inputGain || 1;
      let leftRMS = 0;
      let rightRMS = 0;

      if (vuMeterData && vuMeterData.leftRMS !== undefined) {
        leftRMS = (vuMeterData.leftRMS || 0) * gain;
        rightRMS = (vuMeterData.rightRMS || 0) * gain;
      }

      if (!isPlayingRef.current) {
        leftRMS = 0;
        rightRMS = 0;
      }

      targetRef.current.L = leftRMS;
      targetRef.current.R = rightRMS;

      const rmsBuf = rmsBufRef.current;
      const idx = rmsBuf.idx % ANSI.RMS_FRAMES;
      rmsBuf.L[idx] = targetRef.current.L * targetRef.current.L;
      rmsBuf.R[idx] = targetRef.current.R * targetRef.current.R;
      rmsBuf.idx++;

      let sL = 0, sR = 0;
      for (let i = 0; i < ANSI.RMS_FRAMES; i++) {
        sL += rmsBuf.L[i];
        sR += rmsBuf.R[i];
      }
      const rmsL = Math.sqrt(sL / ANSI.RMS_FRAMES);
      const rmsR = Math.sqrt(sR / ANSI.RMS_FRAMES);

      const targetL = rmsToPos(rmsL);
      const targetR = rmsToPos(rmsR);

      const posL = stepBall('L', targetL, dt);
      const posR = stepBall('R', targetR, dt);

      const drawVU = (canvas, posNorm, ch, bgImg, offsetX) => {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const imgSize = imageSizeRef.current;
        
        const W = imgSize.width * dpr;
        const H = imgSize.height * dpr;
        
        if (canvas.width !== W || canvas.height !== H) {
          canvas.width = W;
          canvas.height = H;
          canvas.style.width = `${imgSize.width}px`;
          canvas.style.height = `${imgSize.height}px`;
        }

        ctx.clearRect(0, 0, W, H);

        if (bgImg && bgImg.complete) {
          ctx.drawImage(bgImg, offsetX * dpr, 0, W, H, 0, 0, W, H);
        } else {
          ctx.fillStyle = '#1a1510';
          ctx.fillRect(0, 0, W, H);
        }

        const cx = W * 0.5;
        const cy = H * 1.18;
        const len = H * 1.12;
        const arcR = len - 7 * dpr;

        const ANG_L = -Math.PI * 0.38;
        const ANG_R = Math.PI * 0.38;
        const range = ANG_R - ANG_L;
        const ang = (vu) => ANG_L + vuToPos(vu) * range;

        ctx.strokeStyle = 'rgba(180,20,20,0.12)';
        ctx.lineWidth = 12 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, ang(0), ANG_R);
        ctx.stroke();

        ctx.strokeStyle = '#2a2520';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, ANG_L, ANG_R);
        ctx.stroke();

        MARKS.forEach((m) => {
          const a = ang(m.vu);
          const isRed = m.vu >= 0;
          const tLen = m.minor ? 4 * dpr : 9 * dpr;

          const x1 = cx + Math.sin(a) * (arcR - tLen);
          const y1 = cy - Math.cos(a) * (arcR - tLen);
          const x2 = cx + Math.sin(a) * (arcR + 3 * dpr);
          const y2 = cy - Math.cos(a) * (arcR + 3 * dpr);

          ctx.strokeStyle = isRed ? '#aa2222' : m.minor ? '#3a3530' : '#5a5550';
          ctx.lineWidth = m.minor ? 0.9 * dpr : 1.6 * dpr;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          if (!m.minor) {
            const dist = arcR - tLen - 10 * dpr;
            ctx.fillStyle = isRed ? '#993333' : '#6a6550';
            ctx.font = `${7.5 * dpr}px 'Georgia', serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(m.label, cx + Math.sin(a) * dist, cy - Math.cos(a) * dist);
          }
        });

        const pos = Math.max(-0.02, Math.min(1.05, posNorm));
        const needAng = ANG_L + pos * range;
        const ex = cx + Math.sin(needAng) * len;
        const ey = cy - Math.cos(needAng) * len;

        let c1, c2, glow;
        if (pos >= vuToPos(0)) { c1 = '#cc0000'; c2 = '#ff5555'; glow = 'rgba(200,0,0,0.5)'; }
        else if (pos >= vuToPos(-3)) { c1 = '#b8860b'; c2 = '#FFD700'; glow = 'rgba(218,165,32,0.4)'; }
        else { c1 = '#8a8070'; c2 = '#c0b8a8'; glow = 'transparent'; }

        const grad = ctx.createLinearGradient(cx, cy, ex, ey);
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);

        ctx.shadowColor = glow;
        ctx.shadowBlur = 10 * dpr;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.2 * dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#DAA520';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5 * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#5a5550';
        ctx.font = `bold ${9 * dpr}px 'Georgia', serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(ch, 7 * dpr, 6 * dpr);
      };

      drawVU(canvasL, posL, 'L', bgImageRef.current, 0);
      drawVU(canvasR, posR, 'R', bgImageRef.current, imageSizeRef.current.width);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [vuMeterData, isPlaying]);

  return (
    <div className="w-full">
      <div className="flex items-end justify-center gap-2 mb-1">
        <span className="text-[12px] font-black text-yellow-600 tracking-wider">L</span>
        <canvas ref={canvasLRef} className="rounded" />
        <canvas ref={canvasRRef} className="rounded" />
        <span className="text-[12px] font-black text-yellow-600 tracking-wider">R</span>
      </div>

      <div className="text-center">
        <span className="text-[7px] text-yellow-600/40">
          ANSI C16.5 · ζ=0.80 · ωn=21 rad/s · Rise 300ms
        </span>
      </div>

      <div className="flex justify-center mt-1">
        <button
          onClick={() => setShowCalibration(!showCalibration)}
          className="text-[8px] text-yellow-700/50 hover:text-yellow-600 transition"
        >
          Calibrar
        </button>
      </div>

      {showCalibration && (
        <div className="mt-2 p-3 bg-black/90 rounded-lg border border-yellow-600/40">
          <div>
            <label className="text-[9px] text-yellow-500 block mb-1">Input Gain (×dB)</label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.05"
              value={calibration.inputGain}
              onChange={(e) => saveCalibration({ ...calibration, inputGain: Number(e.target.value) })}
              className="w-full h-2 bg-gray-800 rounded appearance-none cursor-pointer accent-yellow-500"
            />
            <span className="text-[8px] text-yellow-400">{calibration.inputGain.toFixed(2)}×</span>
          </div>
          <div className="mt-2 text-[8px] text-yellow-600/50">
            <p>ANSI C16.5-1942: 0 VU = -18 dBFS</p>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setShowCalibration(false)}
              className="px-4 py-1 text-[9px] bg-yellow-600 hover:bg-yellow-500 text-black rounded font-bold"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
