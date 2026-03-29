import { useEffect, useRef } from 'react';
import { Howler } from 'howler';

export function VirtualWooferLeft() {
  const coneRef = useRef(null);

  useEffect(() => {
    const setupPhysics = () => {
      const howl = Howler._src;
      if (!howl?._node) return;

      const audioEl = Howler._src._node;
      if (!audioEl || !audioEl.captureStream) return;

      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const src = context.createMediaElementSource(audioEl);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;

        src.connect(analyser);
        analyser.connect(context.destination);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const coneL = coneRef.current;
        const neonRing = coneL?.parentElement?.parentElement?.querySelector('.neon-ring');

        const render = () => {
          analyser.getByteFrequencyData(dataArray);

          let bass = 0;
          for (let i = 0; i < 10; i++) {
            bass += dataArray[i] || 0;
          }
          bass = bass / 10;

          const intensity = bass / 255;
          const scale = 1 + (intensity * 0.2);

          if (coneL) {
            coneL.style.transform = `scale(${scale})`;
          }
          if (neonRing) {
            neonRing.style.opacity = 0.3 + (intensity * 0.7);
            neonRing.style.boxShadow = `0 0 ${intensity * 25}px #00FFFF`;
          }

          requestAnimationFrame(render);
        };
        render();
      } catch (e) {
        console.log('Woofer setup error:', e);
      }
    };

    const interval = setInterval(setupPhysics, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="woofer-box">
      <div ref={coneRef} className="woofer-cone">
        <div className="dust-cap"></div>
      </div>
      <div className="neon-ring"></div>
    </div>
  );
}

export function VirtualWooferRight() {
  const coneRef = useRef(null);

  useEffect(() => {
    const setupPhysics = () => {
      const audioEl = Howler._src?._node;
      if (!audioEl) return;

      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const src = context.createMediaElementSource(audioEl);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;

        src.connect(analyser);
        analyser.connect(context.destination);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const coneR = coneRef.current;
        const neonRing = coneR?.parentElement?.parentElement?.querySelector('.neon-ring');

        let isConnected = false;

        const render = () => {
          if (!isConnected) {
            try {
              src.connect(analyser);
              isConnected = true;
            } catch {}
          }

          analyser.getByteFrequencyData(dataArray);

          let bass = 0;
          for (let i = 0; i < 10; i++) {
            bass += dataArray[i] || 0;
          }
          bass = bass / 10;

          const intensity = bass / 255;
          const scale = 1 + (intensity * 0.2);

          if (coneR) {
            coneR.style.transform = `scale(${scale})`;
          }
          if (neonRing) {
            neonRing.style.opacity = 0.3 + (intensity * 0.7);
            neonRing.style.boxShadow = `0 0 ${intensity * 25}px #00FFFF`;
          }

          requestAnimationFrame(render);
        };
        render();
      } catch (e) {}
    };

    const interval = setInterval(setupPhysics, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="woofer-box">
      <div ref={coneRef} className="woofer-cone">
        <div className="dust-cap"></div>
      </div>
      <div className="neon-ring"></div>
    </div>
  );
}
