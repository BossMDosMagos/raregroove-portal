import { useEffect, useRef } from 'react';
import { Howler } from 'howler';

let wooferInitialized = false;

function initWooferPhysics() {
  if (wooferInitialized) return;
  if (!Howler.ctx || !Howler.masterGain) {
    setTimeout(initWooferPhysics, 100);
    return;
  }

  try {
    const masterNode = Howler.masterGain;
    const audioCtx = Howler.ctx;

    if (!window.wooferAnalyser) {
      window.wooferAnalyser = audioCtx.createAnalyser();
      window.wooferAnalyser.fftSize = 256;
      masterNode.connect(window.wooferAnalyser);
      window.wooferAnalyser.connect(audioCtx.destination);
    }

    const dataArray = new Uint8Array(window.wooferAnalyser.frequencyBinCount);

    function animarFalantes() {
      requestAnimationFrame(animarFalantes);
      window.wooferAnalyser.getByteFrequencyData(dataArray);

      let bass = 0;
      for (let i = 0; i < 8; i++) {
        bass += dataArray[i] || 0;
      }
      const intensity = (bass / 8) / 255;

      const scale = 1 + (intensity * 0.20);
      const coneL = document.getElementById('cone-l');
      const coneR = document.getElementById('cone-r');

      if (coneL && coneR) {
        coneL.style.transform = `scale(${scale})`;
        coneR.style.transform = `scale(${scale})`;
        coneL.style.filter = `drop-shadow(0 0 ${intensity * 30}px #00FFFF)`;
        coneR.style.filter = `drop-shadow(0 0 ${intensity * 30}px #00FFFF)`;
      }
    }

    animarFalantes();
    wooferInitialized = true;
  } catch (e) {
    console.log('Woofer init error:', e);
    setTimeout(initWooferPhysics, 200);
  }
}

export function VirtualWooferLeft() {
  useEffect(() => {
    initWooferPhysics();
  }, []);

  return (
    <div className="woofer-box">
      <div className="woofer-cone" id="cone-l">
        <div className="dust-cap"></div>
      </div>
      <div className="neon-ring"></div>
    </div>
  );
}

export function VirtualWooferRight() {
  return (
    <div className="woofer-box">
      <div className="woofer-cone" id="cone-r">
        <div className="dust-cap"></div>
      </div>
      <div className="neon-ring"></div>
    </div>
  );
}
