import { VUMeterLeft } from './VUMeterLeft.jsx';
import { VUMeterRight } from './VUMeterRight.jsx';
import { VirtualWooferLeft, VirtualWooferRight } from './VirtualWoofer.jsx';
import { SpectrumLeft, SpectrumRight } from './SpectrumVisualizer.jsx';

export default function AudioControlPanel({ 
  vuMeterData,
  isPlaying,
  timeDomainBytesL,
  timeDomainBytesR
}) {
  return (
    <>
      {/* Painel Esquerdo - VU + Spectrum + Woofer */}
      <div className="fixed left-4 z-50" style={{ perspective: '1000px' }}>
        <div 
          className="rounded-xl"
          style={{
            background: 'linear-gradient(145deg, #1f1f1f, #151515)',
            boxShadow: `
              inset 0 2px 4px rgba(255,255,255,0.05),
              inset 0 -2px 4px rgba(0,0,0,0.5),
              0 10px 40px rgba(0,0,0,0.8),
              0 0 60px rgba(0,255,255,0.1)
            `,
            padding: '12px',
            width: '220px',
          }}
        >
          {/* VU Meter Esquerdo */}
          <div className="mb-3">
            <VUMeterLeft vuMeterData={vuMeterData} isPlaying={isPlaying} />
          </div>

          {/* Spectrum Esquerdo */}
          <div className="mb-3">
            <SpectrumLeft timeDomainL={timeDomainBytesL} isPlaying={isPlaying} />
          </div>

          {/* Woofer Esquerdo */}
          <div className="flex items-center justify-center">
            <VirtualWooferLeft />
          </div>
        </div>
      </div>

      {/* Painel Direito - VU + Spectrum + Woofer */}
      <div className="fixed right-4 z-50" style={{ perspective: '1000px' }}>
        <div 
          className="rounded-xl"
          style={{
            background: 'linear-gradient(145deg, #1f1f1f, #151515)',
            boxShadow: `
              inset 0 2px 4px rgba(255,255,255,0.05),
              inset 0 -2px 4px rgba(0,0,0,0.5),
              0 10px 40px rgba(0,0,0,0.8),
              0 0 60px rgba(0,255,255,0.1)
            `,
            padding: '12px',
            width: '220px',
          }}
        >
          {/* VU Meter Direito */}
          <div className="mb-3">
            <VUMeterRight vuMeterData={vuMeterData} isPlaying={isPlaying} />
          </div>

          {/* Spectrum Direito */}
          <div className="mb-3">
            <SpectrumRight timeDomainR={timeDomainBytesR} isPlaying={isPlaying} />
          </div>

          {/* Woofer Direito */}
          <div className="flex items-center justify-center">
            <VirtualWooferRight />
          </div>
        </div>
      </div>
    </>
  );
}
