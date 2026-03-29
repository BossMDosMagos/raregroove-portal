import { useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Square, SkipBack as Rewind, FastForward } from 'lucide-react';

export default function AudioControlPanel({ 
  volume, 
  onVolumeChange, 
  isPlaying, 
  onPlayPause, 
  onStop,
  onPrev,
  onNext,
  currentTime = 0, 
  duration = 1,
  onSeek 
}) {
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [faderValue, setFaderValue] = useState(75);
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [alt1, setAlt1] = useState(false);
  const [alt2, setAlt2] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(70);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleVolumeDrag = useCallback((e) => {
    if (!isPowerOn) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newVol = Math.max(0, Math.min(1, percent));
    onVolumeChange(newVol);
  }, [onVolumeChange, isPowerOn]);

  const handleFaderDrag = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = rect.bottom - e.clientY;
    const percent = Math.max(0, Math.min(100, (y / rect.height) * 100));
    setFaderValue(percent);
    setTooltipPos(Math.round(percent));
  }, []);

  const handleProgressClick = useCallback((e) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    onSeek(percent * duration);
  }, [onSeek, duration]);

  const NeonGlow = ({ color = '#00FFFF', intensity = 15, children }) => (
    <div style={{ 
      filter: `drop-shadow(0 0 ${intensity}px ${color}) drop-shadow(0 0 ${intensity * 2}px ${color})`,
      color 
    }}>
      {children}
    </div>
  );

  return (
    <div className="fixed bottom-4 left-4 z-50" style={{ perspective: '1000px' }}>
      <div 
        className="relative rounded-xl"
        style={{
          background: 'linear-gradient(145deg, #1f1f1f, #151515)',
          boxShadow: `
            inset 0 2px 4px rgba(255,255,255,0.05),
            inset 0 -2px 4px rgba(0,0,0,0.5),
            0 10px 40px rgba(0,0,0,0.8),
            0 0 60px rgba(0,255,255,0.1)
          `,
          padding: '12px',
          width: '260px',
        }}
      >
        {/* Coroa dourada */}
        <div className="absolute bottom-3 left-3 z-10">
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <path d="M9 0L11 5L16 3L14 8L18 12H0L4 8L2 3L7 5L9 0Z" fill="url(#goldGrad)" />
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFD700" />
                <stop offset="50%" stopColor="#FFA500" />
                <stop offset="100%" stopColor="#FFD700" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* MÓDULO SUPERIOR - Volume e Energia */}
        <div className="flex items-center justify-between mb-3">
          {/* Knob de Volume */}
          <div className="relative">
            {/* Anel Neon externo */}
            <div 
              className="absolute rounded-full"
              style={{
                width: '64px',
                height: '64px',
                top: '-6px',
                left: '-6px',
                background: 'transparent',
                boxShadow: `
                  0 0 15px #00FFFF,
                  0 0 30px rgba(0,255,255,0.5),
                  inset 0 0 20px rgba(0,255,255,0.2)
                `,
              }}
            />
            
            {/* Hotspot */}
            <div 
              className="absolute rounded-full"
              style={{
                width: '14px',
                height: '14px',
                top: '-3px',
                right: '4px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
                filter: 'blur(2px)',
              }}
            />

            {/* Knob principal */}
            <div 
              className="relative w-[52px] h-[52px] rounded-full cursor-pointer"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, #4a4a4a 0%, #2a2a2a 50%, #1a1a1a 100%)
                `,
                boxShadow: `
                  inset 0 3px 6px rgba(255,255,255,0.1),
                  inset 0 -3px 6px rgba(0,0,0,0.5),
                  0 3px 8px rgba(0,0,0,0.8)
                `,
              }}
              onMouseDown={(e) => {
                if (!isPowerOn) return;
                setIsDraggingVolume(true);
                handleVolumeDrag(e);
              }}
              onMouseMove={(e) => isDraggingVolume && handleVolumeDrag(e)}
              onMouseUp={() => setIsDraggingVolume(false)}
              onMouseLeave={() => setIsDraggingVolume(false)}
            >
              {/* Rebaixo circular interno */}
              <div 
                className="absolute rounded-full"
                style={{
                  width: '36px',
                  height: '36px',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: `
                    radial-gradient(circle at 30% 30%, #3a3a3a 0%, #1a1a1a 100%)
                  `,
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
                }}
              />
              
              {/* Ponto indicador */}
              <div 
                className="absolute w-1.5 h-3 rounded-full"
                style={{
                  top: '6px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#666',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3)',
                  transform: `translateX(-50%) rotate(${-135 + volume * 270}deg)`,
                  transformOrigin: 'center 20px',
                }}
              />
            </div>
          </div>

          {/* Botões de Energia e Fader */}
          <div className="flex flex-col items-center gap-2">
            {/* Botões de energia */}
            <div className="flex gap-2">
              {/* Power OFF */}
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
                  boxShadow: `
                    inset 0 2px 4px rgba(0,0,0,0.5),
                    0 2px 4px rgba(0,0,0,0.5)
                  `,
                }}
              >
                <div className="text-gray-600">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0" />
                  </svg>
                </div>
              </div>

              {/* Power ON - Neon Cyan */}
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                style={{
                  background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
                  boxShadow: `
                    0 0 10px #00FFFF,
                    0 0 20px rgba(0,255,255,0.4),
                    inset 0 0 8px rgba(0,255,255,0.2)
                  `,
                }}
                onClick={() => setIsPowerOn(!isPowerOn)}
              >
                <NeonGlow intensity={8}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0" />
                  </svg>
                </NeonGlow>
              </div>
            </div>

            {/* Fader Vertical */}
            <div className="relative flex items-center gap-1">
              {/* Marcas de escala */}
              <div className="flex flex-col justify-between h-16 text-[6px] text-gray-500">
                {[...Array(7)].map((_, i) => (
                  <span key={i} style={{ marginTop: i === 0 ? 0 : 'auto' }}>-</span>
                ))}
              </div>

              {/* Trilho do fader */}
              <div 
                className="relative w-4 h-16 rounded-full cursor-pointer"
                style={{
                  background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
                }}
                onClick={handleFaderDrag}
                onMouseMove={(e) => e.buttons === 1 && handleFaderDrag(e)}
              >
                {/* Preenchimento neon */}
                <div 
                  className="absolute bottom-0 left-0 right-0 rounded-full"
                  style={{
                    height: `${faderValue}%`,
                    background: 'linear-gradient(0deg, #00FFFF 0%, rgba(0,255,255,0.5) 100%)',
                    boxShadow: '0 0 8px #00FFFF',
                  }}
                />

                {/* Manípulo */}
                <div 
                  className="absolute left-0.5 right-0.5 h-3 rounded-sm"
                  style={{
                    bottom: `calc(${faderValue}% - 6px)`,
                    background: 'linear-gradient(180deg, #4a4a4a 0%, #2a2a2a 100%)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* MÓDULO CENTRAL - Transporte */}
        <div className="flex items-center justify-between mb-3">
          {/* Play, Skip Back, Skip Forward */}
          <div className="flex items-center gap-1">
            <div 
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
              }}
            >
              <NeonGlow intensity={8}>
                <SkipBack size={14} />
              </NeonGlow>
            </div>

            {/* Play Button */}
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
              style={{
                background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
                boxShadow: `
                  inset 0 2px 4px rgba(255,255,255,0.05),
                  inset 0 -2px 4px rgba(0,0,0,0.5),
                  0 0 10px rgba(0,255,255,0.3)
                `,
              }}
              onClick={onPlayPause}
            >
              <NeonGlow intensity={10}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </NeonGlow>
            </div>

            <div 
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
              }}
            >
              <NeonGlow intensity={8}>
                <SkipForward size={12} />
              </NeonGlow>
            </div>
          </div>

          {/* Alternadores e Rewind/FF */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1">
              {/* Alternador 1 */}
              <div 
                className="w-8 h-3 rounded-full relative cursor-pointer"
                style={{
                  background: '#0a0a0a',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                }}
                onClick={() => setAlt1(!alt1)}
              >
                <div 
                  className="absolute top-0.5 w-2 h-2 rounded-full transition-all"
                  style={{
                    left: alt1 ? 'calc(100% - 10px)' : '2px',
                    background: alt1 ? '#00FFFF' : '#4a4a4a',
                    boxShadow: alt1 ? '0 0 6px #00FFFF' : 'none',
                  }}
                />
              </div>

              {/* Alternador 2 */}
              <div 
                className="w-8 h-3 rounded-full relative cursor-pointer"
                style={{
                  background: '#0a0a0a',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                }}
                onClick={() => setAlt2(!alt2)}
              >
                <div 
                  className="absolute top-0.5 w-2 h-2 rounded-full transition-all"
                  style={{
                    left: alt2 ? 'calc(100% - 10px)' : '2px',
                    background: alt2 ? '#00FFFF' : '#4a4a4a',
                    boxShadow: alt2 ? '0 0 6px #00FFFF' : 'none',
                  }}
                />
              </div>
            </div>

            <div className="flex gap-1">
              <div 
                className="w-6 h-4 rounded flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                <NeonGlow intensity={6}>
                  <Rewind size={8} />
                </NeonGlow>
              </div>
              <div 
                className="w-6 h-4 rounded flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                <NeonGlow intensity={6}>
                  <FastForward size={8} />
                </NeonGlow>
              </div>
            </div>
          </div>
        </div>

        {/* Stop e Indicadores */}
        <div className="flex items-center justify-between mb-2">
          {/* Stop Button */}
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{
              background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
            }}
            onClick={onStop}
          >
            <NeonGlow intensity={8}>
              <Square size={12} />
            </NeonGlow>
          </div>

          {/* Indicadores de estado */}
          <div className="flex items-center gap-1">
            <div 
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: alt1 ? '#00FFFF' : '#333',
                boxShadow: alt1 ? '0 0 4px #00FFFF' : 'none',
              }}
            />
            <div 
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: alt2 ? '#00FFFF' : '#333',
                boxShadow: alt2 ? '0 0 4px #00FFFF' : 'none',
              }}
            />
            <div 
              className="w-1.5 h-1.5 rounded"
              style={{
                background: isPlaying ? '#00FFFF' : '#333',
                boxShadow: isPlaying ? '0 0 4px #00FFFF' : 'none',
              }}
            />
            <div 
              className="w-2 h-2 rounded-full"
              style={{
                background: isPowerOn ? '#00FFFF' : '#333',
                boxShadow: isPowerOn ? '0 0 8px #00FFFF' : 'none',
              }}
            />
          </div>
        </div>

        {/* BARRA DE PROGRESSO */}
        <div className="relative h-6 flex items-center">
          {/* Tooltip */}
          <div 
            className="absolute px-1.5 py-0.5 rounded text-[8px] text-white"
            style={{
              top: '-22px',
              left: `${progress}%`,
              transform: 'translateX(-50%)',
              background: '#2a2a2a',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              display: progress > 0 && progress < 100 ? 'block' : 'none',
            }}
          >
            {Math.round(progress)}%
          </div>

          {/* Trilho */}
          <div 
            className="flex-1 h-1 rounded-full cursor-pointer"
            style={{
              background: '#0a0a0a',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
            }}
            onClick={handleProgressClick}
          >
            {/* Progresso */}
            <div 
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #00FFFF 0%, #00CCCC 100%)',
                boxShadow: '0 0 6px #00FFFF',
              }}
            />
          </div>

          {/* Thumb */}
          <div 
            className="absolute w-2.5 h-2.5 rounded-full cursor-pointer"
            style={{
              left: `${progress}%`,
              transform: 'translateX(-50%)',
              background: 'radial-gradient(circle at 30% 30%, #fff 0%, #00FFFF 100%)',
              boxShadow: '0 0 8px #00FFFF',
            }}
          />
        </div>
      </div>
    </div>
  );
}
