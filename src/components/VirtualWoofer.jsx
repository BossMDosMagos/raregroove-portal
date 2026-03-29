import { useRef, useEffect, useState } from 'react';

function getBassLevel(spectrum, isLeft) {
  if (!spectrum || spectrum.length < 12) return 0;
  
  const bassBins = isLeft ? spectrum.slice(0, 12) : spectrum.slice(0, 12);
  const avgBass = bassBins.reduce((a, b) => a + b, 0) / bassBins.length;
  return Math.max(0, Math.min(1, avgBass / 255));
}

export function VirtualWooferLeft({ spectrum, isPlaying }) {
  const [bassLevel, setBassLevel] = useState(0);
  const [jitterX, setJitterX] = useState(0);
  const [jitterY, setJitterY] = useState(0);
  const animationRef = useRef(null);
  const lastJitterRef = useRef(Date.now());

  useEffect(() => {
    const animate = () => {
      const bass = getBassLevel(spectrum, true);
      setBassLevel(bass);

      if (bass > 0.4 && isPlaying) {
        const now = Date.now();
        if (now - lastJitterRef.current > 50) {
          setJitterX((Math.random() - 0.5) * bass * 4);
          setJitterY((Math.random() - 0.5) * bass * 4);
          lastJitterRef.current = now;
        }
      } else {
        setJitterX(0);
        setJitterY(0);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [spectrum, isPlaying]);

  const scale = 1 + bassLevel * 0.08;
  const neonIntensity = bassLevel * 30;
  const shadowBlur = 10 + bassLevel * 25;
  const coneDepth = bassLevel * 8;

  return (
    <div 
      className="relative"
      style={{
        width: '160px',
        height: '160px',
        transform: `translate(${jitterX}px, ${jitterY}px)`,
        transition: 'transform 0.05s ease-out',
      }}
    >
      <style>{`
        @keyframes speakerPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .woofer-idle {
          animation: speakerPulse 3s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className={`relative rounded-full ${!isPlaying ? 'woofer-idle' : ''}`}
          style={{ width: '100%', height: '100%' }}
        >
          <div
            className="absolute rounded-full"
            style={{
              inset: 0,
              background: 'linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 50%, #121212 100%)',
              boxShadow: `
                inset 0 2px 4px rgba(255,255,255,0.05),
                inset 0 -4px 8px rgba(0,0,0,0.8),
                0 0 20px rgba(0,0,0,0.9),
                0 8px 32px rgba(0,0,0,0.6)
              `,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '8px',
              background: `
                radial-gradient(circle at 30% 30%, #1a1a1a 0%, #000000 60%, #0a0a0a 100%)
              `,
              boxShadow: `
                inset 0 4px 8px rgba(255,255,255,0.03),
                inset 0 -4px 12px rgba(0,0,0,0.9)
              `,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '12px',
              background: `
                radial-gradient(circle at 35% 35%, #2a2a2a 0%, #0d0d0d 30%, #000000 70%)
              `,
              backgroundImage: `
                radial-gradient(circle at 35% 35%, #2a2a2a 0%, #0d0d0d 30%, #000000 70%),
                repeating-radial-gradient(
                  circle at center,
                  #000000 0px,
                  #050505 2px,
                  #000000 4px
                )
              `,
              boxShadow: `
                inset 0 2px 6px rgba(255,255,255,0.02),
                inset 0 -3px 8px rgba(0,0,0,0.9)
              `,
            }}
          />

          <div
            className="absolute rounded-full transition-transform duration-75"
            style={{
              inset: '24px',
              transform: `scale(${scale})`,
              background: `
                radial-gradient(
                  circle at 40% 40%,
                  #1a1a1a 0%,
                  #0a0a0a 40%,
                  #000000 100%
                )
              `,
              boxShadow: `
                inset 0 3px 8px rgba(255,255,255,0.04),
                inset 0 -4px 10px rgba(0,0,0,0.9),
                0 ${coneDepth}px ${shadowBlur}px rgba(0,255,255,${bassLevel * 0.3})
              `,
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                inset: '20%',
                background: `
                  radial-gradient(
                    circle at 35% 30%,
                    #3a3a3a 0%,
                    #1a1a1a 40%,
                    #0a0a0a 70%,
                    #000000 100%
                  )
                `,
                boxShadow: `
                  inset 0 2px 4px rgba(255,255,255,0.08),
                  inset 0 -2px 6px rgba(0,0,0,0.9)
                `,
              }}
            >
              <div
                className="absolute rounded-full"
                style={{
                  inset: '15%',
                  background: `
                    radial-gradient(
                      circle at 30% 25%,
                      rgba(255,255,255,0.15) 0%,
                      rgba(100,100,100,0.1) 30%,
                      rgba(30,30,30,0.2) 60%,
                      transparent 100%
                    )
                  `,
                }}
              />
            </div>
          </div>

          <div
            className="absolute rounded-full transition-all duration-75"
            style={{
              inset: '18px',
              border: `${1 + bassLevel * 1.5}px solid transparent`,
              borderColor: `rgba(0,255,255,${0.1 + bassLevel * 0.6})`,
              boxShadow: `
                0 0 ${neonIntensity}px rgba(0,255,255,${bassLevel * 0.5}),
                inset 0 0 ${neonIntensity / 2}px rgba(0,255,255,${bassLevel * 0.3})
              `,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '140px',
              width: '16px',
              height: '16px',
              background: 'linear-gradient(145deg, #2a2a2a, #151515)',
              boxShadow: `
                inset 0 1px 2px rgba(255,255,255,0.1),
                0 2px 4px rgba(0,0,0,0.5)
              `,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function VirtualWooferRight({ spectrum, isPlaying }) {
  const [bassLevel, setBassLevel] = useState(0);
  const [jitterX, setJitterX] = useState(0);
  const [jitterY, setJitterY] = useState(0);
  const animationRef = useRef(null);
  const lastJitterRef = useRef(Date.now());

  useEffect(() => {
    const animate = () => {
      const bass = getBassLevel(spectrum, false);
      setBassLevel(bass);

      if (bass > 0.4 && isPlaying) {
        const now = Date.now();
        if (now - lastJitterRef.current > 50) {
          setJitterX((Math.random() - 0.5) * bass * 4);
          setJitterY((Math.random() - 0.5) * bass * 4);
          lastJitterRef.current = now;
        }
      } else {
        setJitterX(0);
        setJitterY(0);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [spectrum, isPlaying]);

  const scale = 1 + bassLevel * 0.08;
  const neonIntensity = bassLevel * 30;
  const shadowBlur = 10 + bassLevel * 25;
  const coneDepth = bassLevel * 8;

  return (
    <div 
      className="relative"
      style={{
        width: '160px',
        height: '160px',
        transform: `translate(${jitterX}px, ${jitterY}px)`,
        transition: 'transform 0.05s ease-out',
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className={`relative rounded-full ${!isPlaying ? 'woofer-idle' : ''}`}
          style={{ width: '100%', height: '100%' }}
        >
          <div
            className="absolute rounded-full"
            style={{
              inset: 0,
              background: 'linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 50%, #121212 100%)',
              boxShadow: `
                inset 0 2px 4px rgba(255,255,255,0.05),
                inset 0 -4px 8px rgba(0,0,0,0.8),
                0 0 20px rgba(0,0,0,0.9),
                0 8px 32px rgba(0,0,0,0.6)
              `,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '8px',
              background: `
                radial-gradient(circle at 30% 30%, #1a1a1a 0%, #000000 60%, #0a0a0a 100%)
              `,
              boxShadow: `
                inset 0 4px 8px rgba(255,255,255,0.03),
                inset 0 -4px 12px rgba(0,0,0,0.9)
              `,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '12px',
              background: `
                radial-gradient(circle at 35% 35%, #2a2a2a 0%, #0d0d0d 30%, #000000 70%)
              `,
              backgroundImage: `
                radial-gradient(circle at 35% 35%, #2a2a2a 0%, #0d0d0d 30%, #000000 70%),
                repeating-radial-gradient(
                  circle at center,
                  #000000 0px,
                  #050505 2px,
                  #000000 4px
                )
              `,
              boxShadow: `
                inset 0 2px 6px rgba(255,255,255,0.02),
                inset 0 -3px 8px rgba(0,0,0,0.9)
              `,
            }}
          />

          <div
            className="absolute rounded-full transition-transform duration-75"
            style={{
              inset: '24px',
              transform: `scale(${scale})`,
              background: `
                radial-gradient(
                  circle at 40% 40%,
                  #1a1a1a 0%,
                  #0a0a0a 40%,
                  #000000 100%
                )
              `,
              boxShadow: `
                inset 0 3px 8px rgba(255,255,255,0.04),
                inset 0 -4px 10px rgba(0,0,0,0.9),
                0 ${coneDepth}px ${shadowBlur}px rgba(0,255,255,${bassLevel * 0.3})
              `,
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                inset: '20%',
                background: `
                  radial-gradient(
                    circle at 35% 30%,
                    #3a3a3a 0%,
                    #1a1a1a 40%,
                    #0a0a0a 70%,
                    #000000 100%
                  )
                `,
                boxShadow: `
                  inset 0 2px 4px rgba(255,255,255,0.08),
                  inset 0 -2px 6px rgba(0,0,0,0.9)
                `,
              }}
            >
              <div
                className="absolute rounded-full"
                style={{
                  inset: '15%',
                  background: `
                    radial-gradient(
                      circle at 30% 25%,
                      rgba(255,255,255,0.15) 0%,
                      rgba(100,100,100,0.1) 30%,
                      rgba(30,30,30,0.2) 60%,
                      transparent 100%
                    )
                  `,
                }}
              />
            </div>
          </div>

          <div
            className="absolute rounded-full transition-all duration-75"
            style={{
              inset: '18px',
              border: `${1 + bassLevel * 1.5}px solid transparent`,
              borderColor: `rgba(0,255,255,${0.1 + bassLevel * 0.6})`,
              boxShadow: `
                0 0 ${neonIntensity}px rgba(0,255,255,${bassLevel * 0.5}),
                inset 0 0 ${neonIntensity / 2}px rgba(0,255,255,${bassLevel * 0.3})
              `,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '140px',
              width: '16px',
              height: '16px',
              background: 'linear-gradient(145deg, #2a2a2a, #151515)',
              boxShadow: `
                inset 0 1px 2px rgba(255,255,255,0.1),
                0 2px 4px rgba(0,0,0,0.5)
              `,
            }}
          />
        </div>
      </div>
    </div>
  );
}
