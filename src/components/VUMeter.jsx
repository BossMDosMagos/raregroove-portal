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
      } catch {
        console.log('[VUMeter] Fundo não carregado');
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

  const drawNeedle = (canvas, posNorm, bgImg) => {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth * dpr;
    const H = canvas.offsetHeight * dpr;
    
    canvas.width = W;
    canvas.height = H;

    ctx.clearRect(0, 0, W, H);

    if (bgImg && bgImg.complete) {
      ctx.drawImage(bgImg, 0, 0, W, H);
    }

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
    if (pos >= vuToPos(0)) { c1 = '#cc0000'; c2 = '#ff5555'; glow = 'rgba(200,0,0,0.5)'; }
    else if (pos >= vuToPos(-3)) { c1 = '#b8860b'; c2 = '#FFD700'; glow = 'rgba(218,165,32,0.4)'; }
    else { c1 = '#ffffff'; c2 = '#ffffff'; glow = 'rgba(255,255,255,0.3)'; }

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

      drawNeedle(canvasL, posL, bgImageRef.current);
      drawNeedle(canvasR, posR, bgImageRef.current);

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
        <canvas ref={canvasLRef} className="w-[156px] h-[80px]" />
        <canvas ref={canvasRRef} className="w-[156px] h-[80px]" />
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
