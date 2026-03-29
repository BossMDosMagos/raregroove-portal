import { VUMeterLeft } from './VUMeterLeft.jsx';
import { VUMeterRight } from './VUMeterRight.jsx';
import { VirtualWooferLeft, VirtualWooferRight } from './VirtualWoofer.jsx';
import { SpectrumLeft, SpectrumRight } from './SpectrumVisualizer.jsx';
import { VolumeKnob } from './VolumeKnob.jsx';

export default function AudioControlPanel({ 
  vuMeterData,
  isPlaying,
  timeDomainBytesL,
  timeDomainBytesR,
  volume,
  onVolumeChange
}) {
  return (
    <>
      {/* Painel Esquerdo */}
      <div className="fixed top-20 left-4 z-50" style={{ perspective: '1000px' }}>
        <div 
          className="relative flex flex-col rounded-xl"
          style={{
            background: 'linear-gradient(145deg, #1f1f1f, #151515)',
            boxShadow: `
              inset 0 2px 4px rgba(255,255,255,0.05),
              inset 0 -2px 4px rgba(0,0,0,0.5),
              0 10px 40px rgba(0,0,0,0.8),
              0 0 60px rgba(0,255,255,0.1)
            `,
            padding: '16px',
            width: '260px',
            height: 'calc(100vh - 140px)',
          }}
        >
          {/* Coroa dourada */}
          <div className="absolute bottom-3 left-3 z-10">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <path d="M9 0L11 5L16 3L14 8L18 12H0L4 8L2 3L7 5L9 0Z" fill="url(#goldGradL)" />
              <defs>
                <linearGradient id="goldGradL" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="50%" stopColor="#FFA500" />
                  <stop offset="100%" stopColor="#FFD700" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* VU Meter Esquerdo */}
          <div className="flex justify-center mb-3">
            <VUMeterLeft vuMeterData={vuMeterData} isPlaying={isPlaying} />
          </div>

          {/* Spectrum Esquerdo */}
          <div className="flex justify-center mb-3">
            <SpectrumLeft timeDomainL={timeDomainBytesL} isPlaying={isPlaying} />
          </div>

          {/* Volume Knob */}
          <div className="flex justify-center mb-3">
            <VolumeKnob 
              volume={volume || 0} 
              onVolumeChange={onVolumeChange || (() => {})} 
              size={70}
            />
          </div>

          {/* Woofer Esquerdo */}
          <div className="flex items-center justify-center mt-auto mb-4">
            <VirtualWooferLeft />
          </div>
        </div>
      </div>

      {/* Painel Direito */}
      <div className="fixed top-20 right-4 z-50" style={{ perspective: '1000px' }}>
        <div 
          className="relative flex flex-col rounded-xl"
          style={{
            background: 'linear-gradient(145deg, #1f1f1f, #151515)',
            boxShadow: `
              inset 0 2px 4px rgba(255,255,255,0.05),
              inset 0 -2px 4px rgba(0,0,0,0.5),
              0 10px 40px rgba(0,0,0,0.8),
              0 0 60px rgba(0,255,255,0.1)
            `,
            padding: '16px',
            width: '260px',
            height: 'calc(100vh - 140px)',
          }}
        >
          {/* Coroa dourada */}
          <div className="absolute bottom-3 right-3 z-10">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <path d="M9 0L11 5L16 3L14 8L18 12H0L4 8L2 3L7 5L9 0Z" fill="url(#goldGradR)" />
              <defs>
                <linearGradient id="goldGradR" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="50%" stopColor="#FFA500" />
                  <stop offset="100%" stopColor="#FFD700" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* VU Meter Direito */}
          <div className="flex justify-center mb-3">
            <VUMeterRight vuMeterData={vuMeterData} isPlaying={isPlaying} />
          </div>

          {/* Spectrum Direito */}
          <div className="flex justify-center mb-3">
            <SpectrumRight timeDomainR={timeDomainBytesR} isPlaying={isPlaying} />
          </div>

          {/* Woofer Direito */}
          <div className="flex items-center justify-center mt-auto mb-4">
            <VirtualWooferRight />
          </div>
        </div>
      </div>
    </>
  );
}
