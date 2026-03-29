import { useRef, useEffect, useState } from 'react';

const BASS_BINS = 8;
const MIN_SCALE = 1.0;
const MAX_SCALE = 1.15;
const INERTIA_FACTOR = 0.3;

function calculateBassLevel(bassData) {
  if (!bassData || bassData.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < Math.min(bassData.length, BASS_BINS); i++) {
    sum += bassData[i];
  }
  const avg = sum / Math.min(bassData.length, BASS_BINS);
  return Math.max(0, Math.min(1, avg / 255));
}

export function VirtualWooferLeft({ bassData, isPlaying }) {
  const targetBassRef = useRef(0);
  const currentBassRef = useRef(0);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    const bassLevel = calculateBassLevel(bassData);
    targetBassRef.current = isPlaying ? bassLevel : 0;
  }, [bassData, isPlaying]);

  useEffect(() => {
    const animate = (timestamp) => {
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const target = targetBassRef.current;
      const current = currentBassRef.current;
      const diff = target - current;
      currentBassRef.current += diff * INERTIA_FACTOR;
      currentBassRef.current = Math.max(0, Math.min(1.1, currentBassRef.current));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const bassLevel = currentBassRef.current;
  const scale = MIN_SCALE + bassLevel * (MAX_SCALE - MIN_SCALE);
  const neonGlow = bassLevel * 40;
  const shadowBlur = 15 + bassLevel * 35;
  const coneShadow = bassLevel * 20;

  return (
    <div className="relative" style={{ width: '100px', height: '100px' }}>
      <style>{`
        .woofer-cone {
          transition: transform 0.05s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .woofer-neon-ring {
          transition: box-shadow 0.03s ease-out, border-color 0.03s ease-out;
        }
        @keyframes woofer-idle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.008); }
        }
        .woofer-idle {
          animation: woofer-idle 2.5s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`relative w-full h-full ${!isPlaying ? 'woofer-idle' : ''}`}>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 50%, #121212 100%)',
              boxShadow: `
                inset 0 2px 4px rgba(255,255,255,0.05),
                inset 0 -4px 8px rgba(0,0,0,0.8),
                0 0 20px rgba(0,0,0,0.9),
                0 4px 20px rgba(0,0,0,0.6)
              `,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '6px',
              background: 'radial-gradient(circle at 30% 30%, #1a1a1a 0%, #000000 60%, #0a0a0a 100%)',
              boxShadow: 'inset 0 3px 6px rgba(255,255,255,0.03), inset 0 -3px 8px rgba(0,0,0,0.9)',
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '10px',
              background: `
                radial-gradient(circle at 35% 35%, #2a2a2a 0%, #0d0d0d 30%, #000000 70%),
                repeating-radial-gradient(circle at center, #000000 0px, #050505 2px, #000000 4px)
              `,
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.02), inset 0 -2px 6px rgba(0,0,0,0.9)',
            }}
          />

          <div
            className="woofer-cone absolute rounded-full"
            style={{
              inset: '18px',
              transform: `scale(${scale})`,
              background: 'radial-gradient(circle at 40% 40%, #1a1a1a 0%, #0a0a0a 40%, #000000 100%)',
              boxShadow: `
                inset 0 2px 6px rgba(255,255,255,0.04),
                inset 0 -3px 8px rgba(0,0,0,0.9),
                0 ${coneShadow}px ${shadowBlur}px rgba(0,255,255,${bassLevel * 0.4})
              `,
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                inset: '18%',
                background: 'radial-gradient(circle at 35% 30%, #3a3a3a 0%, #1a1a1a 40%, #0a0a0a 70%, #000000 100%)',
                boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.08), inset 0 -2px 4px rgba(0,0,0,0.9)',
              }}
            >
              <div
                className="absolute rounded-full"
                style={{
                  inset: '12%',
                  background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18) 0%, rgba(100,100,100,0.12) 30%, rgba(30,30,30,0.25) 60%, transparent 100%)',
                }}
              />
            </div>
          </div>

          <div
            className="woofer-neon-ring absolute rounded-full"
            style={{
              inset: '14px',
              border: `${1.5 + bassLevel * 2}px solid rgba(0,255,255,${0.15 + bassLevel * 0.7})`,
              boxShadow: `
                0 0 ${neonGlow}px rgba(0,255,255,${bassLevel * 0.6}),
                0 0 ${neonGlow * 1.5}px rgba(0,255,255,${bassLevel * 0.3}),
                inset 0 0 ${neonGlow * 0.5}px rgba(0,255,255,${bassLevel * 0.4})
              `,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '88px',
              width: '10px',
              height: '10px',
              background: 'linear-gradient(145deg, #2a2a2a, #151515)',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1), 0 1px 3px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function VirtualWooferRight({ bassData, isPlaying }) {
  const targetBassRef = useRef(0);
  const currentBassRef = useRef(0);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    const bassLevel = calculateBassLevel(bassData);
    targetBassRef.current = isPlaying ? bassLevel : 0;
  }, [bassData, isPlaying]);

  useEffect(() => {
    const animate = (timestamp) => {
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const target = targetBassRef.current;
      const current = currentBassRef.current;
      const diff = target - current;
      currentBassRef.current += diff * INERTIA_FACTOR;
      currentBassRef.current = Math.max(0, Math.min(1.1, currentBassRef.current));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const bassLevel = currentBassRef.current;
  const scale = MIN_SCALE + bassLevel * (MAX_SCALE - MIN_SCALE);
  const neonGlow = bassLevel * 40;
  const shadowBlur = 15 + bassLevel * 35;
  const coneShadow = bassLevel * 20;

  return (
    <div className="relative" style={{ width: '100px', height: '100px' }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`relative w-full h-full ${!isPlaying ? 'woofer-idle' : ''}`}>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 50%, #121212 100%)',
              boxShadow: `
                inset 0 2px 4px rgba(255,255,255,0.05),
                inset 0 -4px 8px rgba(0,0,0,0.8),
                0 0 20px rgba(0,0,0,0.9),
                0 4px 20px rgba(0,0,0,0.6)
              `,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '6px',
              background: 'radial-gradient(circle at 30% 30%, #1a1a1a 0%, #000000 60%, #0a0a0a 100%)',
              boxShadow: 'inset 0 3px 6px rgba(255,255,255,0.03), inset 0 -3px 8px rgba(0,0,0,0.9)',
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '10px',
              background: `
                radial-gradient(circle at 35% 35%, #2a2a2a 0%, #0d0d0d 30%, #000000 70%),
                repeating-radial-gradient(circle at center, #000000 0px, #050505 2px, #000000 4px)
              `,
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.02), inset 0 -2px 6px rgba(0,0,0,0.9)',
            }}
          />

          <div
            className="woofer-cone absolute rounded-full"
            style={{
              inset: '18px',
              transform: `scale(${scale})`,
              background: 'radial-gradient(circle at 40% 40%, #1a1a1a 0%, #0a0a0a 40%, #000000 100%)',
              boxShadow: `
                inset 0 2px 6px rgba(255,255,255,0.04),
                inset 0 -3px 8px rgba(0,0,0,0.9),
                0 ${coneShadow}px ${shadowBlur}px rgba(0,255,255,${bassLevel * 0.4})
              `,
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                inset: '18%',
                background: 'radial-gradient(circle at 35% 30%, #3a3a3a 0%, #1a1a1a 40%, #0a0a0a 70%, #000000 100%)',
                boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.08), inset 0 -2px 4px rgba(0,0,0,0.9)',
              }}
            >
              <div
                className="absolute rounded-full"
                style={{
                  inset: '12%',
                  background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18) 0%, rgba(100,100,100,0.12) 30%, rgba(30,30,30,0.25) 60%, transparent 100%)',
                }}
              />
            </div>
          </div>

          <div
            className="woofer-neon-ring absolute rounded-full"
            style={{
              inset: '14px',
              border: `${1.5 + bassLevel * 2}px solid rgba(0,255,255,${0.15 + bassLevel * 0.7})`,
              boxShadow: `
                0 0 ${neonGlow}px rgba(0,255,255,${bassLevel * 0.6}),
                0 0 ${neonGlow * 1.5}px rgba(0,255,255,${bassLevel * 0.3}),
                inset 0 0 ${neonGlow * 0.5}px rgba(0,255,255,${bassLevel * 0.4})
              `,
            }}
          />

          <div
            className="absolute rounded-full"
            style={{
              inset: '88px',
              width: '10px',
              height: '10px',
              background: 'linear-gradient(145deg, #2a2a2a, #151515)',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1), 0 1px 3px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
