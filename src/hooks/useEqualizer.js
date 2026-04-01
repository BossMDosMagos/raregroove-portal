import { useRef, useCallback, useEffect, useState } from 'react';

let audioContextInstance = null;
let sharedEqualizerFilters = [];
let sharedGainNode = null;

const BAND_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const EQUALIZER_PRESETS = {
  flat: { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  rock: { name: 'Rock', gains: [4, 3, 1, -1, -2, 0, 2, 3, 4, 4] },
  pop: { name: 'Pop', gains: [-1, 1, 3, 4, 3, 1, -1, -1, -1, -2] },
  jazz: { name: 'Jazz', gains: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3] },
  classical: { name: 'Clássico', gains: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4] },
  electronic: { name: 'EDM', gains: [5, 4, 1, -2, -3, -1, 2, 4, 5, 5] },
  hiphop: { name: 'Hip-Hop', gains: [5, 4, 1, 2, -1, -1, 1, 2, 3, 2] },
  acoustic: { name: 'Acústico', gains: [4, 3, 1, 1, 2, 2, 2, 3, 2, 1] },
  vocal: { name: 'Vocal', gains: [-2, -3, -1, 2, 4, 4, 2, 0, -1, -2] },
  bass: { name: 'Bass Boost', gains: [6, 5, 4, 2, 0, -1, -1, -1, -1, -1] },
};

function initEqualizerFilters(audioContext) {
  if (sharedEqualizerFilters.length === 10) return sharedEqualizerFilters;
  
  sharedEqualizerFilters = BAND_FREQUENCIES.map(freq => {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.4;
    filter.gain.value = 0;
    return filter;
  });
  
  for (let i = 0; i < sharedEqualizerFilters.length - 1; i++) {
    sharedEqualizerFilters[i].connect(sharedEqualizerFilters[i + 1]);
  }
  
  sharedGainNode = audioContext.createGain();
  sharedGainNode.gain.value = 1;
  sharedEqualizerFilters[sharedEqualizerFilters.length - 1].connect(sharedGainNode);
  
  return sharedEqualizerFilters;
}

export function getEqualizerFilters() {
  return sharedEqualizerFilters;
}

export function getEqualizerGainNode() {
  return sharedGainNode;
}

export function initEqualizer(audioContext) {
  audioContextInstance = audioContext;
  return initEqualizerFilters(audioContext);
}

export function useEqualizer() {
  const [gains, setGains] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [activePreset, setActivePreset] = useState('flat');
  const [isEnabled, setIsEnabled] = useState(true);
  
  const applyGains = useCallback((newGains) => {
    sharedEqualizerFilters.forEach((filter, i) => {
      if (filter) {
        filter.gain.value = isEnabled ? newGains[i] : 0;
      }
    });
    setGains(newGains);
  }, [isEnabled]);
  
  const setBandGain = useCallback((bandIndex, value) => {
    const clampedValue = Math.max(-12, Math.min(12, value));
    const newGains = [...gains];
    newGains[bandIndex] = clampedValue;
    applyGains(newGains);
    setActivePreset(null);
  }, [gains, applyGains]);
  
  const applyPreset = useCallback((presetName) => {
    const preset = EQUALIZER_PRESETS[presetName];
    if (preset) {
      applyGains(preset.gains);
      setActivePreset(presetName);
    }
  }, [applyGains]);
  
  const resetEqualizer = useCallback(() => {
    applyGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    setActivePreset('flat');
  }, [applyGains]);
  
  const toggleEqualizer = useCallback(() => {
    setIsEnabled(prev => {
      const newState = !prev;
      sharedEqualizerFilters.forEach(filter => {
        if (filter) {
          filter.gain.value = newState ? gains[sharedEqualizerFilters.indexOf(filter)] : 0;
        }
      });
      return newState;
    });
  }, [gains]);
  
  return {
    gains,
    activePreset,
    isEnabled,
    presets: EQUALIZER_PRESETS,
    bandFrequencies: BAND_FREQUENCIES,
    setBandGain,
    applyPreset,
    resetEqualizer,
    toggleEqualizer,
  };
}
