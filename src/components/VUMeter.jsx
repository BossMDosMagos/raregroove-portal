import { useRef, useEffect, useState } from 'react';

const STORAGE_KEY = 'raregroove_vu_calibration';

const defaults = {
  zeroOffset: -55,
  inputGain: 0,
  damping: 0.18,
  needleBase: 0,
  amplitudeRange: 1.0,
  peakDecay: 0.95,
  peakHoldFrames: 30,
};

export function VUMeter({ timeDomainData, isPlaying }) {
  const [showCalibration, setShowCalibration] = useState(false);
  const [calibration, setCalibration] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaults;
  });
  
  const timeDomainDataRef = useRef(timeDomainData);
  const isPlayingRef = useRef(isPlaying);
  const calibrationRef = useRef(calibration);
  
  useEffect(() => {
    timeDomainDataRef.current = timeDomainData;
  }, [timeDomainData]);
  
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  
  useEffect(() => {
    calibrationRef.current = calibration;
  }, [calibration]);

  const saveCalibration = (newCal) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCal));
    setCalibration(newCal);
  };

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const initialAngle = calibration.zeroOffset || -55;
  const currentAngleL = useRef(initialAngle);
  const currentAngleR = useRef(initialAngle);
  const targetAngleL = useRef(initialAngle);
  const targetAngleR = useRef(initialAngle);
  const ledBrightnessL = useRef(0);
  const ledBrightnessR = useRef(0);

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

    const drawVU = (cx) => {
      const arcCenterX = cx;
      const needleBase = 5 + (calibrationRef.current.needleBase || 0);
      const arcCenterY = h - 15 + needleBase;
      const arcRadius = h - 35;

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 82, 2, 164, h - 4);

      return { arcCenterX, arcCenterY, arcRadius };
    };

    const drawScale = (ctx, cx, arcCenterX, arcCenterY, arcRadius) => {
      const MIN_ANGLE = calibrationRef.current.zeroOffset || -55;
      const ARC_RANGE = 110 * (calibrationRef.current.amplitudeRange || 1);
      const MAX_ANGLE = MIN_ANGLE + ARC_RANGE;
      
      const levelMarks = [0, 20, 40, 60, 80, 100];
      
      ctx.save();
      ctx.font = '5px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#d4af37';
      
      levelMarks.forEach(level => {
        const normalized = level / 100;
        const angle = MIN_ANGLE + (normalized * ARC_RANGE);
        const angleRad = (angle - 90) * (Math.PI / 180);
        const labelR = arcRadius + 8;
        const labelX = arcCenterX + Math.cos(angleRad) * labelR;
        const labelY = arcCenterY + Math.sin(angleRad) * labelR;
        
        ctx.fillText(level.toString(), labelX, labelY);
      });
      
      ctx.restore();
    };

    const drawNeedle = (arcCenterX, arcCenterY, arcRadius, angle) => {
      const angleRad = (angle - 90) * (Math.PI / 180);
      const needleLength = arcRadius - 8;
      
      const baseX = arcCenterX + Math.cos(angleRad) * 5;
      const baseY = arcCenterY + Math.sin(angleRad) * 5;
      const tipX = arcCenterX + Math.cos(angleRad) * needleLength;
      const tipY = arcCenterY + Math.sin(angleRad) * needleLength;

      const perpRad = angleRad + Math.PI / 2;
      const baseWidth = 1.2;

      ctx.save();
      ctx.shadowColor = 'rgba(220, 50, 50, 0.8)';
      ctx.shadowBlur = 6;

      const needleGrad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
      needleGrad.addColorStop(0, '#660000');
      needleGrad.addColorStop(0.2, '#aa0000');
      needleGrad.addColorStop(0.5, '#cc1100');
      needleGrad.addColorStop(0.8, '#ee2200');
      needleGrad.addColorStop(1, '#ff3311');

      ctx.beginPath();
      ctx.moveTo(baseX + Math.cos(perpRad) * baseWidth, baseY + Math.sin(perpRad) * baseWidth);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseX - Math.cos(perpRad) * baseWidth, baseY - Math.sin(perpRad) * baseWidth);
      ctx.closePath();
      ctx.fillStyle = needleGrad;
      ctx.fill();
      
      ctx.restore();

      const centerGrad = ctx.createRadialGradient(arcCenterX - 1, arcCenterY - 1, 0, arcCenterX, arcCenterY, 6);
      centerGrad.addColorStop(0, '#ff4422');
      centerGrad.addColorStop(0.5, '#cc1100');
      centerGrad.addColorStop(1, '#660000');
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, 4, 0, Math.PI * 2);
      ctx.fillStyle = centerGrad;
      ctx.fill();
    };

    const drawLedPeak = (cx, brightness) => {
      const ledX = cx + 70;
      const ledY = 12;
      const ledSize = 6;
      
      if (brightness > 0.1) {
        ctx.save();
        ctx.shadowColor = `rgba(255, 0, 0, ${brightness})`;
        ctx.shadowBlur = 10 * brightness;
        
        const ledGrad = ctx.createRadialGradient(ledX, ledY, 0, ledX, ledY, ledSize);
        ledGrad.addColorStop(0, `rgba(255, 100, 100, ${brightness})`);
        ledGrad.addColorStop(0.5, `rgba(255, 0, 0, ${brightness})`);
        ledGrad.addColorStop(1, `rgba(150, 0, 0, ${brightness * 0.5})`);
        
        ctx.beginPath();
        ctx.arc(ledX, ledY, ledSize, 0, Math.PI * 2);
        ctx.fillStyle = ledGrad;
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(ledX, ledY, ledSize, 0, Math.PI * 2);
        ctx.fillStyle = '#330000';
        ctx.fill();
        ctx.strokeStyle = '#440000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.font = '5px monospace';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.fillText('PK', ledX, ledY + ledSize + 6);
    };

    const calculateRMS = (data) => {
      if (!data || data.length === 0) return 0;
      let sumSquares = 0.0;
      for (let i = 0; i < data.length; i++) {
        sumSquares += data[i] * data[i];
      }
      return Math.sqrt(sumSquares / data.length);
    };

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      const vu1 = drawVU(w * 0.25);
      const vu2 = drawVU(w * 0.75);

      drawScale(ctx, w * 0.25, vu1.arcCenterX, vu1.arcCenterY, vu1.arcRadius);
      drawScale(ctx, w * 0.75, vu2.arcCenterX, vu2.arcCenterY, vu2.arcRadius);

      const cal = calibrationRef.current;
      const sliderDamping = cal.damping || 0.18;
      const sliderGain = cal.inputGain || 1;
      const MIN_ANGLE = cal.zeroOffset || -55;
      const ARC_RANGE = 110 * (cal.amplitudeRange || 1);
      const MAX_ANGLE = MIN_ANGLE + ARC_RANGE;
      const td = timeDomainDataRef.current;
      const playing = isPlayingRef.current;

      if (td && td.length > 0 && playing) {
        const halfLen = Math.floor(td.length / 2);
        
        const leftData = td.slice(0, halfLen);
        const rightData = td.slice(halfLen);
        
        const leftRms = calculateRMS(leftData);
        const rightRms = calculateRMS(rightData);
        
        let leftPeak = 0;
        let rightPeak = 0;
        for (let i = 0; i < leftData.length; i++) {
          if (Math.abs(leftData[i]) > leftPeak) leftPeak = Math.abs(leftData[i]);
        }
        for (let i = 0; i < rightData.length; i++) {
          if (Math.abs(rightData[i]) > rightPeak) rightPeak = Math.abs(rightData[i]);
        }
        
        const calibratedLevelL = leftRms * sliderGain * 100;
        const calibratedLevelR = rightRms * sliderGain * 100;
        
        targetAngleL.current = MIN_ANGLE + (calibratedLevelL * ARC_RANGE);
        targetAngleR.current = MIN_ANGLE + (calibratedLevelR * ARC_RANGE);
        
        targetAngleL.current = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, targetAngleL.current));
        targetAngleR.current = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, targetAngleR.current));

        const leftPeakNorm = leftPeak * sliderGain;
        const rightPeakNorm = rightPeak * sliderGain;
        
        const peakThreshold = 0.7;
        const leftLedBrightness = leftPeakNorm > peakThreshold ? 
          Math.min(1, (leftPeakNorm - peakThreshold) / 0.3) : 0;
        const rightLedBrightness = rightPeakNorm > peakThreshold ? 
          Math.min(1, (rightPeakNorm - peakThreshold) / 0.3) : 0;
        
        ledBrightnessL.current += (leftLedBrightness - ledBrightnessL.current) * 0.3;
        ledBrightnessR.current += (rightLedBrightness - ledBrightnessR.current) * 0.3;

      } else {
        targetAngleL.current = MIN_ANGLE;
        targetAngleR.current = MIN_ANGLE;
        
        ledBrightnessL.current *= 0.8;
        ledBrightnessR.current *= 0.8;
      }

      currentAngleL.current += (targetAngleL.current - currentAngleL.current) * sliderDamping;
      currentAngleR.current += (targetAngleR.current - currentAngleR.current) * sliderDamping;

      drawNeedle(vu1.arcCenterX, vu1.arcCenterY, vu1.arcRadius, currentAngleL.current);
      drawNeedle(vu2.arcCenterX, vu2.arcCenterY, vu2.arcRadius, currentAngleR.current);

      drawLedPeak(w * 0.25, ledBrightnessL.current);
      drawLedPeak(w * 0.75, ledBrightnessR.current);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

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
          ⚙ Calibrar VU
        </button>
      </div>

      {showCalibration && (
        <div className="mt-2 p-3 bg-black/80 rounded-lg border border-yellow-600/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] text-yellow-500 block mb-1">Zero Offset</label>
              <input
                type="range"
                min="-65"
                max="-45"
                value={calibration.zeroOffset}
                onChange={(e) => saveCalibration({ ...calibration, zeroOffset: Number(e.target.value) })}
                className="w-full h-1 accent-yellow-500"
              />
              <span className="text-[8px] text-white/50">{calibration.zeroOffset}°</span>
            </div>
            <div>
              <label className="text-[9px] text-yellow-500 block mb-1">Input Gain (×RMS)</label>
              <input
                type="range"
                min="-12"
                max="12"
                value={calibration.inputGain}
                onChange={(e) => saveCalibration({ ...calibration, inputGain: Number(e.target.value) })}
                className="w-full h-1 accent-yellow-500"
              />
              <span className="text-[8px] text-white/50">{calibration.inputGain > 0 ? '+' : ''}{calibration.inputGain}dB</span>
            </div>
            <div>
              <label className="text-[9px] text-yellow-500 block mb-1">Damping (Needle)</label>
              <input
                type="range"
                min="0.05"
                max="0.35"
                step="0.01"
                value={calibration.damping}
                onChange={(e) => saveCalibration({ ...calibration, damping: Number(e.target.value) })}
                className="w-full h-1 accent-yellow-500"
              />
              <span className="text-[8px] text-white/50">{calibration.damping.toFixed(2)}</span>
            </div>
            <div>
              <label className="text-[9px] text-yellow-500 block mb-1">Range (Arc)</label>
              <input
                type="range"
                min="0.3"
                max="1.5"
                step="0.05"
                value={calibration.amplitudeRange}
                onChange={(e) => saveCalibration({ ...calibration, amplitudeRange: Number(e.target.value) })}
                className="w-full h-1 accent-yellow-500"
              />
              <span className="text-[8px] text-white/50">{(calibration.amplitudeRange * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10">
            <label className="text-[9px] text-yellow-500 block mb-1">Base Position</label>
            <input
              type="range"
              min="-5"
              max="10"
              value={calibration.needleBase}
              onChange={(e) => saveCalibration({ ...calibration, needleBase: Number(e.target.value) })}
              className="w-full h-1 accent-yellow-500"
            />
            <span className="text-[8px] text-white/50">{calibration.needleBase}px</span>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10">
            <label className="text-[9px] text-yellow-500 block mb-1">Peak Decay</label>
            <input
              type="range"
              min="0.90"
              max="0.99"
              step="0.01"
              value={calibration.peakDecay}
              onChange={(e) => saveCalibration({ ...calibration, peakDecay: Number(e.target.value) })}
              className="w-full h-1 accent-yellow-500"
            />
            <span className="text-[8px] text-white/50">{(calibration.peakDecay * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-2 flex justify-between items-center">
            <button
              onClick={() => saveCalibration(defaults)}
              className="text-[8px] text-red-400 hover:text-red-300"
            >
              Resetar
            </button>
            <button
              onClick={() => setShowCalibration(false)}
              className="px-3 py-1 text-[8px] bg-yellow-600 hover:bg-yellow-500 text-black rounded font-bold"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
