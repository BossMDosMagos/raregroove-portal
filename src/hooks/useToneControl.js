import { useCallback, useState } from 'react';

let bassFilter = null;
let midFilter = null;
let trebleFilter = null;
let audioCtxRef = null;

export function initToneFilters(audioContext) {
  if (bassFilter) return;
  
  audioCtxRef = audioContext;
  
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

export function setToneGain(type, normalizedValue) {
  const filter = getToneFilters()[type];
  if (!filter || !audioCtxRef) return;
  
  const calculatedValue = normalizedValue * 24 - 12;
  filter.gain.setTargetAtTime(calculatedValue, audioCtxRef.currentTime, 0.01);
}

export function useToneControl(type) {
  const [value, setValue] = useState(0.5);
  
  const handleChange = useCallback((newValue) => {
    setValue(newValue);
    setToneGain(type, newValue);
  }, [type]);
  
  return { value, onChange: handleChange };
}
