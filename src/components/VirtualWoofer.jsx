import { useEffect, useRef } from 'react';
import { Howler } from 'howler';

export function VirtualWooferLeft() {
  const coneRef = useRef(null);
  const setupRef = useRef(false);

  useEffect(() => {
    if (setupRef.current) return;
    setupRef.current = true;

    const setupPhysics = () => {
      const context = Howler.ctx;
      const node = Howler.masterGain;

      if (!context || !node) {
        setTimeout(setupPhysics, 200);
        return;
      }

      try {
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;

        node.connect(analyser);
        analyser.connect(context.destination);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const coneL = document.getElementById('cone-l');
        const coneR = document.getElementById('cone-r');

        if (!coneL || !coneR) {
          setTimeout(setupPhysics, 200);
          return;
        }

        const renderVibration = () => {
          requestAnimationFrame(renderVibration);
          analyser.getByteFrequencyData(dataArray);

          let bass = 0;
          for (let i = 0; i < 10; i++) {
            bass += dataArray[i] || 0;
          }
          const avgBass = bass / 10;

          const intensity = avgBass / 255;
          const scale = 1 + (intensity * 0.18);

          coneL.style.transform = `scale(${scale})`;
          coneR.style.transform = `scale(${scale})`;
        };

        renderVibration();
      } catch (e) {
        console.log('Woofer setup error:', e);
        setupRef.current = false;
      }
    };

    setupPhysics();

    return () => {
      setupRef.current = false;
    };
  }, []);

  return (
    <div className="woofer-box">
      <div ref={coneRef} className="woofer-cone" id="cone-l">
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
