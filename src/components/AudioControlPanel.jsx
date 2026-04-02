import React from 'react';
import { VUMeterLeft } from './VUMeterLeft.jsx';
import { VUMeterRight } from './VUMeterRight.jsx';
import { VirtualWooferLeft, VirtualWooferRight, WooferDebugPanel } from './VirtualWoofer.jsx';
import { SpectrumLeft, SpectrumRight } from './SpectrumVisualizer.jsx';
import { VolumeKnob } from './VolumeKnob.jsx';
import { ToneKnob } from './ToneKnob.jsx';
import { PlayerControls } from './PlayerControls.jsx';
import EqualizerPanel from './EqualizerPanel.jsx';
import { useEqualizer } from '../hooks/useEqualizer.js';

const panelStyle = {
  background: 'linear-gradient(145deg, #1f1f1f, #151515)',
  boxShadow: `inset 0 2px 4px rgba(255,255,255,0.05), inset 0 -2px 4px rgba(0,0,0,0.5), 0 10px 40px rgba(0,0,0,0.8), 0 0 60px rgba(0,255,255,0.1)`,
  padding: '20px',
  width: '320px',
  height: 'calc(100vh - 100px)',
};

function CrownSvg({ id }) {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <path d="M9 0L11 5L16 3L14 8L18 12H0L4 8L2 3L7 5L9 0Z" fill={`url(#goldGrad${id})`} />
      <defs>
        <linearGradient id={`goldGrad${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#FFA500" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AudioControlPanel({ 
  isPlaying,
  volume,
  onVolumeChange,
  onPlay,
  onPause,
  onStop,
  onPreviousTrack,
  onNextTrack,
  onEject
}) {
  const equalizer = useEqualizer();
  
  return (
    <>
      <div className="fixed top-20 left-4 z-50" style={{ perspective: '1000px' }}>
        <div className="relative flex flex-col rounded-xl" style={panelStyle}>
          <div className="absolute bottom-3 left-3 z-10"><CrownSvg id="L" /></div>

          <div className="flex justify-center mb-3"><VUMeterLeft isPlaying={isPlaying} /></div>
          <div className="flex justify-center mb-3"><SpectrumLeft isPlaying={isPlaying} /></div>
          <div className="flex justify-center mb-3">
            <VolumeKnob value={volume || 0} onChange={onVolumeChange || (() => {})} size={120} />
          </div>
          <div className="flex justify-center gap-3 mb-3">
            <ToneKnob value={0.5} onChange={() => {}} size={70} label="Bass" />
            <ToneKnob value={0.5} onChange={() => {}} size={70} label="Low" />
            <ToneKnob value={0.5} onChange={() => {}} size={70} label="Mid" />
            <ToneKnob value={0.5} onChange={() => {}} size={70} label="High" />
          </div>
          <div className="flex justify-center mb-3">
            <PlayerControls
              isPlaying={isPlaying}
              onPlay={onPlay || (() => {})}
              onPause={onPause || (() => {})}
              onStop={onStop || (() => {})}
              onPreviousTrack={onPreviousTrack || (() => {})}
              onNextTrack={onNextTrack || (() => {})}
              onEject={onEject || (() => {})}
            />
          </div>
          <div className="flex items-center justify-center mt-auto mb-4">
            <VirtualWooferLeft isPlaying={isPlaying} />
          </div>
        </div>
      </div>

      <div className="fixed top-20 right-4 z-50" style={{ perspective: '1000px' }}>
        <div className="relative flex flex-col rounded-xl" style={panelStyle}>
          <div className="absolute bottom-3 right-3 z-10"><CrownSvg id="R" /></div>

          <div className="flex justify-center mb-3"><VUMeterRight isPlaying={isPlaying} /></div>
          <div className="flex justify-center mb-3"><SpectrumRight isPlaying={isPlaying} /></div>
          <div className="flex justify-center mb-3">
            <EqualizerPanel
              gains={equalizer.gains}
              activePreset={equalizer.activePreset}
              isEnabled={equalizer.isEnabled}
              onBandChange={equalizer.setBandGain}
              onPresetChange={equalizer.applyPreset}
              onReset={equalizer.resetEqualizer}
              onToggle={equalizer.toggleEqualizer}
            />
          </div>
          <div className="flex items-center justify-center mt-auto mb-4">
            <VirtualWooferRight isPlaying={isPlaying} />
          </div>
        </div>
      </div>

      <WooferDebugPanel />
    </>
  );
}
