import { useRef, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'raregroove_vu_calibration';

const ANSI = {
  ZERO_VU_DB: -18,
  PEAK_THRESHOLD_DB: -0.5,
  RISE_TIME_MS: 300,
  PEAK_HOLD_MS: 500,
  OVERSHOOT: 0.015,
  MIN_DB: -60,
  MAX_DB: 3,
  ARC_START_DEG: -55,
  ARC_RANGE_DEG: 110,
};

const DEFAULTS = {
  inputGain: 1.0,
  damping: 0.35,
  offset: 0,
};

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function linearToDb(linear) {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

function rmsToVu(rmsDb) {
  return rmsDb - ANSI.ZERO_VU_DB;
}

function vuToAngle(vu) {
  const minVu = ANSI.MIN_DB - ANSI.ZERO_VU_DB;
  const maxVu = ANSI.MAX_DB - ANSI.ZERO_VU_DB;
  const clampedVu = Math.max(minVu, Math.min(maxVu, vu));
  const normalized = (clampedVu - minVu) / (maxVu - minVu);
  return ANSI.ARC_START_DEG + normalized * ANSI.ARC_RANGE_DEG;
}

function springOvershoot(current, target, overshoot) {
  if (target > current) {
    return target * (1 + overshoot);
  }
  return target;
}

export function VUMeter({ vuMeterData, isPlaying }) {
  const [vuBgL, setVuBgL] = useState(null);
  const [vuBgR, setVuBgR] = useState(null);
  const [showCalibration, setShowCalibration] = useState(false);
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

  const vuBgLRef = useRef(null);
  const vuBgRRef = useRef(null);

  const needleAngleL = useRef(ANSI.ARC_START_DEG);
  const needleAngleR = useRef(ANSI.ARC_START_DEG);
  const targetAngleL = useRef(ANSI.ARC_START_DEG);
  const targetAngleR = useRef(ANSI.ARC_START_DEG);
  const velocityL = useRef(0);
  const velocityR = useRef(0);
  const overshootL = useRef(false);
  const overshootR = useRef(false);

  const peakHoldL = useRef({ value: -60, holdUntil: 0 });
  const peakHoldR = useRef({ value: -60, holdUntil: 0 });
  const ledBrightnessL = useRef(0);
  const ledBrightnessR = useRef(0);

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastFrameTime = useRef(0);
  const calRef = useRef(calibration);

  useEffect(() => {
    vuBgLRef.current = vuBgL;
  }, [vuBgL]);

  useEffect(() => {
    vuBgRRef.current = vuBgR;
  }, [vuBgR]);

  useEffect(() => {
    calRef.current = calibration;
  }, [calibration]);

  const saveCalibration = useCallback((newCal) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCal));
    setCalibration(newCal);
    calRef.current = newCal;
  }, []);

  useEffect(() => {
    const loadBg = async () => {
      try {
        const bgL = new Image();
        bgL.src = '/images/vu/vu-l.png';
        await new Promise((resolve, reject) => {
          bgL.onload = resolve;
          bgL.onerror = reject;
        });
        setVuBgL(bgL);

        const bgR = new Image();
        bgR.src = '/images/vu/vu-r.png';
        await new Promise((resolve, reject) => {
          bgR.onload = resolve;
          bgR.onerror = reject;
        });
        setVuBgR(bgR);
      } catch {
        // Silent fail - will draw fallback
      }
    };
    loadBg();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    const drawVUBackground = (cx, bgImage) => {
      const cal = calRef.current;
      const arcCenterY = h - 15 + (cal.offset || 0);
      const arcRadius = h - 35;

      if (bgImage && bgImage.complete) {
        ctx.drawImage(bgImage, cx - 82, 2, 164, h - 4);
      } else {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(cx - 82, 2, 164, h - 4);

        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 82, 2, 164, h - 4);

        const dbMarks = [-48, -36, -24, -18, -12, -6, -3, 0];
        const ZERO_VU = ANSI.ZERO_VU_DB;

        ctx.font = '5px monospace';
        ctx.textAlign = 'center';

        dbMarks.forEach(db => {
          const vu = rmsToVu(db);
          const angle = vuToAngle(vu);
          const angleRad = (angle - 90) * (Math.PI / 180);
          const labelR = arcRadius + 10;
          const labelX = cx + Math.cos(angleRad) * labelR;
          const labelY = arcCenterY + Math.sin(angleRad) * labelR;

          ctx.beginPath();
          ctx.moveTo(
            cx + Math.cos(angleRad) * (arcRadius - 5),
            arcCenterY + Math.sin(angleRad) * (arcRadius - 5)
          );
          ctx.lineTo(
            cx + Math.cos(angleRad) * (arcRadius + 2),
            arcCenterY + Math.sin(angleRad) * (arcRadius + 2)
          );

          if (db >= ZERO_VU) {
            ctx.strokeStyle = '#ff4444';
          } else if (db >= ZERO_VU - 6) {
            ctx.strokeStyle = '#ffcc00';
          } else {
            ctx.strokeStyle = db === ZERO_VU ? '#00ff00' : '#444444';
          }
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = db === ZERO_VU ? '#00ff00' : '#666666';
          ctx.fillText(db.toString(), labelX, labelY);
        });
      }

      return { arcCenterX: cx, arcCenterY, arcRadius };
    };

    const drawNeedle = (cx, cy, radius, angle) => {
      const angleRad = (angle - 90) * (Math.PI / 180);
      const needleLength = radius - 8;

      const baseX = cx + Math.cos(angleRad) * 5;
      const baseY = cy + Math.sin(angleRad) * 5;
      const tipX = cx + Math.cos(angleRad) * needleLength;
      const tipY = cy + Math.sin(angleRad) * needleLength;

      const perpRad = angleRad + Math.PI / 2;
      const baseWidth = 1.2;

      ctx.save();
      ctx.shadowColor = 'rgba(255, 60, 30, 0.9)';
      ctx.shadowBlur = 8;

      const needleGrad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
      needleGrad.addColorStop(0, '#550000');
      needleGrad.addColorStop(0.15, '#aa0000');
      needleGrad.addColorStop(0.4, '#dd1100');
      needleGrad.addColorStop(0.7, '#ff2200');
      needleGrad.addColorStop(1, '#ff4422');

      ctx.beginPath();
      ctx.moveTo(baseX + Math.cos(perpRad) * baseWidth, baseY + Math.sin(perpRad) * baseWidth);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseX - Math.cos(perpRad) * baseWidth, baseY - Math.sin(perpRad) * baseWidth);
      ctx.closePath();
      ctx.fillStyle = needleGrad;
      ctx.fill();
      ctx.restore();

      const centerGrad = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, 6);
      centerGrad.addColorStop(0, '#ff6644');
      centerGrad.addColorStop(0.4, '#cc2200');
      centerGrad.addColorStop(1, '#440000');
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = centerGrad;
      ctx.fill();
    };

    const drawLedPeak = (cx, brightness, label) => {
      const ledX = cx + 70;
      const ledY = 12;
      const ledSize = 5;

      if (brightness > 0.05) {
        ctx.save();
        ctx.shadowColor = `rgba(255, 0, 0, ${brightness})`;
        ctx.shadowBlur = 12 * brightness;

        const ledGrad = ctx.createRadialGradient(ledX, ledY, 0, ledX, ledY, ledSize);
        ledGrad.addColorStop(0, `rgba(255, 150, 150, ${brightness})`);
        ledGrad.addColorStop(0.4, `rgba(255, 30, 0, ${brightness})`);
        ledGrad.addColorStop(1, `rgba(100, 0, 0, ${brightness * 0.5})`);

        ctx.beginPath();
        ctx.arc(ledX, ledY, ledSize, 0, Math.PI * 2);
        ctx.fillStyle = ledGrad;
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(ledX, ledY, ledSize, 0, Math.PI * 2);
        ctx.fillStyle = '#1a0000';
        ctx.fill();
        ctx.strokeStyle = '#330000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.font = '4px monospace';
      ctx.fillStyle = '#555';
      ctx.textAlign = 'center';
      ctx.fillText(label, ledX, ledY + ledSize + 5);
    };

    const animate = () => {
      const now = performance.now();
      const deltaTime = Math.min((now - lastFrameTime.current) / 1000, 0.1);
      lastFrameTime.current = now;

      ctx.clearRect(0, 0, w, h);

      const vu1 = drawVUBackground(w * 0.25, vuBgLRef.current);
      const vu2 = drawVUBackground(w * 0.75, vuBgRRef.current);

      const cal = calRef.current;
      const gain = cal.inputGain || 1;
      const damping = cal.damping || 0.35;

      let leftRMSDb = -60;
      let rightRMSDb = -60;
      let leftPeakDb = -60;
      let rightPeakDb = -60;

      if (vuMeterData) {
        leftRMSDb = (vuMeterData.leftRMSDb || -60) + Math.log10(gain) * 20;
        rightRMSDb = (vuMeterData.rightRMSDb || -60) + Math.log10(gain) * 20;
        leftPeakDb = vuMeterData.leftPeakDb || -60;
        rightPeakDb = vuMeterData.rightPeakDb || -60;
      }

      leftRMSDb = Math.max(ANSI.MIN_DB, Math.min(ANSI.MAX_DB, leftRMSDb));
      rightRMSDb = Math.max(ANSI.MIN_DB, Math.min(ANSI.MAX_DB, rightRMSDb));

      const leftVu = rmsToVu(leftRMSDb);
      const rightVu = rmsToVu(rightRMSDb);

      let targetL = vuToAngle(leftVu);
      let targetR = vuToAngle(rightVu);

      const smoothingFactor = 1 - Math.exp(-deltaTime / (ANSI.RISE_TIME_MS / 1000));

      const prevTargetL = targetAngleL.current;
      const prevTargetR = targetAngleR.current;

      if (targetL > needleAngleL.current && !overshootL.current) {
        targetAngleL.current = springOvershoot(needleAngleL.current, targetL, ANSI.OVERSHOOT);
        overshootL.current = true;
      } else {
        targetAngleL.current = targetL;
      }

      if (targetR > needleAngleR.current && !overshootR.current) {
        targetAngleR.current = springOvershoot(needleAngleR.current, targetR, ANSI.OVERSHOOT);
        overshootR.current = true;
      } else {
        targetAngleR.current = targetR;
      }

      const overshootRecoverL = targetAngleL.current <= needleAngleL.current;
      const overshootRecoverR = targetAngleR.current <= needleAngleR.current;

      if (overshootL.current && overshootRecoverL) {
        overshootL.current = false;
      }
      if (overshootR.current && overshootRecoverR) {
        overshootR.current = false;
      }

      needleAngleL.current += (targetAngleL.current - needleAngleL.current) * smoothingFactor * damping;
      needleAngleR.current += (targetAngleR.current - needleAngleR.current) * smoothingFactor * damping;

      const minAngle = ANSI.ARC_START_DEG;
      const maxAngle = ANSI.ARC_START_DEG + ANSI.ARC_RANGE_DEG;
      needleAngleL.current = Math.max(minAngle, Math.min(maxAngle, needleAngleL.current));
      needleAngleR.current = Math.max(minAngle, Math.min(maxAngle, needleAngleR.current));

      if (!isPlaying || leftRMSDb < ANSI.MIN_DB + 5) {
        const decayFactor = Math.pow(0.02, deltaTime);
        needleAngleL.current = minAngle + (needleAngleL.current - minAngle) * decayFactor;
        needleAngleR.current = minAngle + (needleAngleR.current - minAngle) * decayFactor;
        overshootL.current = false;
        overshootR.current = false;
      }

      const peakThreshold = ANSI.PEAK_THRESHOLD_DB;
      const nowMs = performance.now();

      if (leftPeakDb > peakThreshold) {
        peakHoldL.current = { value: leftPeakDb, holdUntil: nowMs + ANSI.PEAK_HOLD_MS };
      }
      if (rightPeakDb > peakThreshold) {
        peakHoldR.current = { value: rightPeakDb, holdUntil: nowMs + ANSI.PEAK_HOLD_MS };
      }

      if (nowMs > peakHoldL.current.holdUntil) {
        peakHoldL.current.value *= 0.95;
      }
      if (nowMs > peakHoldR.current.holdUntil) {
        peakHoldR.current.value *= 0.95;
      }

      const peakNormL = Math.max(0, Math.min(1, (peakHoldL.current.value - peakThreshold) / (-ANSI.MIN_DB - peakThreshold)));
      const peakNormR = Math.max(0, Math.min(1, (peakHoldR.current.value - peakThreshold) / (-ANSI.MIN_DB - peakThreshold)));

      const ledAttack = 0.4;
      const ledDecay = 0.15;
      ledBrightnessL.current += (peakNormL - ledBrightnessL.current) * (peakNormL > ledBrightnessL.current ? ledAttack : ledDecay);
      ledBrightnessR.current += (peakNormR - ledBrightnessR.current) * (peakNormR > ledBrightnessR.current ? ledAttack : ledDecay);

      drawNeedle(vu1.arcCenterX, vu1.arcCenterY, vu1.arcRadius, needleAngleL.current);
      drawNeedle(vu2.arcCenterX, vu2.arcCenterY, vu2.arcRadius, needleAngleR.current);

      drawLedPeak(w * 0.25, ledBrightnessL.current, 'PK');
      drawLedPeak(w * 0.75, ledBrightnessR.current, 'PK');

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

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
        <canvas ref={canvasRef} className="w-[328px] h-[88px]" />
        <span className="text-[12px] font-black text-yellow-600 tracking-wider">R</span>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => setShowCalibration(!showCalibration)}
          className="text-[8px] text-yellow-700/50 hover:text-yellow-600 transition"
        >
          ANSI C16.5 Calibrar
        </button>
      </div>

      {showCalibration && (
        <div className="mt-2 p-3 bg-black/90 rounded-lg border border-yellow-600/40">
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="text-[9px] text-yellow-500 block mb-1">Damping (Needle) - 300ms rise</label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={calibration.damping}
                onChange={(e) => saveCalibration({ ...calibration, damping: Number(e.target.value) })}
                className="w-full h-2 bg-gray-800 rounded appearance-none cursor-pointer accent-yellow-500"
              />
              <span className="text-[8px] text-yellow-400">{calibration.damping.toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10">
            <label className="text-[9px] text-yellow-500 block mb-1">Offset (px) - Ajuste vertical</label>
            <input
              type="range"
              min="-5"
              max="10"
              step="1"
              value={calibration.offset}
              onChange={(e) => saveCalibration({ ...calibration, offset: Number(e.target.value) })}
              className="w-full h-2 bg-gray-800 rounded appearance-none cursor-pointer accent-yellow-500"
            />
            <span className="text-[8px] text-yellow-400">{calibration.offset}px</span>
          </div>
          <div className="mt-2 text-[8px] text-yellow-600/50 space-y-1">
            <p>ANSI C16.5-1942: 0 VU = -18 dBFS</p>
            <p>Peak: -0.5 dBFS | Rise: 300ms | Overshoot: 1.5%</p>
          </div>
          <div className="mt-3 flex justify-between items-center">
            <button
              onClick={() => saveCalibration(DEFAULTS)}
              className="text-[9px] text-red-400 hover:text-red-300 px-2 py-1"
            >
              Resetar Padrão
            </button>
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
