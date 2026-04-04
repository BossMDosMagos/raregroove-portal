import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'raregroove_settings';

const DEFAULTS = {
  volume: 0.7,
  bass: 0,
  mid: 0,
  treble: 0,
  vuSensitivity: 1.0,
  eq_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

let audioContextRef = null;
let bassFilter = null;
let midFilter = null;
let trebleFilter = null;
let eqFilters = [];
let sharedGainNode = null;
let vuGainNode = null;

export function resetAudioSettings() {
  audioContextRef = null;
  bassFilter = null;
  midFilter = null;
  trebleFilter = null;
  eqFilters = [];
  sharedGainNode = null;
  vuGainNode = null;
}

export function initToneFilters(audioContext) {
  if (bassFilter) return;
  
  audioContextRef = audioContext;
  
  bassFilter = audioContext.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 100;
  bassFilter.gain.value = 0;
  
  midFilter = audioContext.createBiquadFilter();
  midFilter.type = 'peaking';
  midFilter.frequency.value = 1000;
  midFilter.Q.value = 1;
  midFilter.gain.value = 0;
  
  trebleFilter = audioContext.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 8000;
  trebleFilter.gain.value = 0;
  
  bassFilter.connect(midFilter);
  midFilter.connect(trebleFilter);
}

export function getToneFilters() {
  return { bass: bassFilter, mid: midFilter, treble: trebleFilter };
}

export function initEqFilters(audioContext) {
  if (eqFilters.length === 10) return eqFilters;
  
  const BAND_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  
  eqFilters = BAND_FREQUENCIES.map(freq => {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.4;
    filter.gain.value = 0;
    return filter;
  });
  
  for (let i = 0; i < eqFilters.length - 1; i++) {
    eqFilters[i].connect(eqFilters[i + 1]);
  }
  
  sharedGainNode = audioContext.createGain();
  sharedGainNode.gain.value = 1;
  eqFilters[eqFilters.length - 1].connect(sharedGainNode);
  
  vuGainNode = audioContext.createGain();
  vuGainNode.gain.value = 1.0;
  vuGainNode.channelCount = 2;
  vuGainNode.channelInterpretation = 'speakers';
  
  return eqFilters;
}

export function getEqFilters() {
  return eqFilters;
}

export function getSharedGain() {
  return sharedGainNode;
}

export function getVuGainNode() {
  return vuGainNode;
}

export function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {}
  return { ...DEFAULTS };
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function applyAllSettings(settings, isEnabled = true) {
  const now = audioContextRef?.currentTime || 0;
  
  if (bassFilter) {
    bassFilter.gain.setTargetAtTime(isEnabled ? settings.bass : 0, now, 0.01);
  }
  if (midFilter) {
    midFilter.gain.setTargetAtTime(isEnabled ? settings.mid : 0, now, 0.01);
  }
  if (trebleFilter) {
    trebleFilter.gain.setTargetAtTime(isEnabled ? settings.treble : 0, now, 0.01);
  }
  
  eqFilters.forEach((filter, i) => {
    if (filter) {
      filter.gain.setTargetAtTime(isEnabled ? (settings.eq_bands[i] || 0) : 0, now, 0.01);
    }
  });
  
  if (sharedGainNode) {
    sharedGainNode.gain.setTargetAtTime(settings.volume, now, 0.01);
  }
  
  if (vuGainNode) {
    const sensitivity = settings.vuSensitivity !== undefined ? settings.vuSensitivity : 1.0;
    vuGainNode.gain.setTargetAtTime(sensitivity, now, 0.01);
  }
}

export function useGrooveflixSettings() {
  const [settings, setSettings] = useState(loadSettings);
  const [settingsRestored, setSettingsRestored] = useState(false);
  const isInitializedRef = useRef(false);
  
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    
    const current = loadSettings();
    setSettings(current);
    applyAllSettings(current);
    
    setTimeout(() => {
      setSettingsRestored(true);
      setTimeout(() => setSettingsRestored(false), 3000);
    }, 500);
  }, []);
  
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      saveSettings(updated);
      return updated;
    });
  }, []);
  
  const setVolume = useCallback((value) => {
    updateSetting('volume', value);
    if (sharedGainNode && audioContextRef) {
      const now = audioContextRef.currentTime;
      sharedGainNode.gain.setTargetAtTime(value, now, 0.01);
    }
  }, [updateSetting]);
  
  const setToneGain = useCallback((type, value) => {
    updateSetting(type, value);
    const filter = getToneFilters()[type];
    if (filter && audioContextRef) {
      const now = audioContextRef.currentTime;
      filter.gain.setTargetAtTime(value, now, 0.01);
    }
  }, [updateSetting]);
  
  const setVuSensitivity = useCallback((value) => {
    updateSetting('vuSensitivity', value);
    if (vuGainNode && audioContextRef) {
      const now = audioContextRef.currentTime;
      vuGainNode.gain.setTargetAtTime(value, now, 0.01);
    }
  }, [updateSetting]);
  
  const setEqBand = useCallback((index, value) => {
    setSettings(prev => {
      const newBands = [...prev.eq_bands];
      newBands[index] = value;
      const updated = { ...prev, eq_bands: newBands };
      saveSettings(updated);
      return updated;
    });
    const filter = eqFilters[index];
    if (filter && audioContextRef) {
      const now = audioContextRef.currentTime;
      filter.gain.setTargetAtTime(value, now, 0.01);
    }
  }, []);
  
  const setAllEqBands = useCallback((bands) => {
    updateSetting('eq_bands', bands);
    bands.forEach((value, i) => {
      const filter = eqFilters[i];
      if (filter && audioContextRef) {
        const now = audioContextRef.currentTime;
        filter.gain.setTargetAtTime(value, now, 0.01);
      }
    });
  }, [updateSetting]);
  
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULTS);
    saveSettings(DEFAULTS);
    applyAllSettings(DEFAULTS);
  }, []);
  
  return {
    settings,
    settingsRestored,
    setVolume,
    setToneGain,
    setVuSensitivity,
    setEqBand,
    setAllEqBands,
    resetToDefaults,
    updateSetting,
  };
}
