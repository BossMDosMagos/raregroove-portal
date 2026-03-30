import { useRef, useCallback, useEffect, useState } from 'react';
import { Howler } from 'howler';

let globalAnalyserInstance = null;
let globalAnalyserState = null;
let initializationPromise = null;

function createGlobalAnalyser() {
  if (globalAnalyserInstance) return globalAnalyserInstance;
  
  const ctx = Howler.ctx;
  if (!ctx) return null;

  const masterGain = Howler.masterGain;
  if (!masterGain) return null;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const timeData = new Uint8Array(analyser.frequencyBinCount);
  
  masterGain.connect(analyser);
  analyser.connect(ctx.destination);
  
  globalAnalyserInstance = {
    analyser,
    freqData,
    timeData,
    ctx,
    
    update() {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);
    },
    
    getRMS() {
      analyser.getByteTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const val = (timeData[i] - 128) / 128;
        sum += val * val;
      }
      return Math.sqrt(sum / timeData.length);
    },
    
    getBassEnergy() {
      analyser.getByteFrequencyData(freqData);
      const nyquist = ctx.sampleRate / 2;
      const binSize = nyquist / (analyser.frequencyBinCount / 2);
      const bassMinBin = Math.floor(20 / binSize);
      const bassMaxBin = Math.ceil(60 / binSize);
      
      let sum = 0;
      const count = bassMaxBin - bassMinBin;
      for (let i = bassMinBin; i < bassMaxBin && i < freqData.length; i++) {
        const norm = freqData[i] / 255;
        sum += norm * norm;
      }
      return Math.sqrt(sum / Math.max(count, 1));
    },
    
    getSpectrum() {
      analyser.getByteFrequencyData(freqData);
      return freqData;
    },
    
    getWaveform() {
      analyser.getByteTimeDomainData(timeData);
      return timeData;
    },
    
    isReady() {
      return ctx.state === 'running';
    },
    
    destroy() {
      try { analyser.disconnect(); } catch (e) {}
      masterGain.disconnect(analyser);
      globalAnalyserInstance = null;
    }
  };
  
  return globalAnalyserInstance;
}

function initAnalyser() {
  if (initializationPromise) return initializationPromise;
  
  initializationPromise = new Promise((resolve) => {
    const tryInit = () => {
      const instance = createGlobalAnalyser();
      if (instance) {
        resolve(instance);
      } else {
        setTimeout(tryInit, 100);
      }
    };
    tryInit();
  });
  
  return initializationPromise;
}

export function useGlobalAudioAnalyser() {
  const analyserRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  useEffect(() => {
    initAnalyser().then((instance) => {
      analyserRef.current = instance;
      setIsReady(instance.isReady());
    });
    
    const checkState = setInterval(() => {
      if (analyserRef.current) {
        const ready = analyserRef.current.isReady();
        setIsReady(ready);
        if (!ready) {
          setIsPlaying(false);
        }
      }
    }, 500);
    
    return () => {
      clearInterval(checkState);
    };
  }, []);
  
  const setPlayingState = useCallback((playing) => {
    setIsPlaying(playing);
  }, []);
  
  return {
    analyser: analyserRef.current,
    isReady,
    isPlaying,
    setPlayingState,
    update: () => analyserRef.current?.update(),
    getRMS: () => analyserRef.current?.getRMS() || 0,
    getBassEnergy: () => analyserRef.current?.getBassEnergy() || 0,
    getSpectrum: () => analyserRef.current?.getSpectrum() || new Uint8Array(0),
    getWaveform: () => analyserRef.current?.getWaveform() || new Uint8Array(0),
  };
}

export function getGlobalAnalyser() {
  return globalAnalyserInstance;
}

export function initGlobalAnalyser() {
  return initAnalyser();
}
