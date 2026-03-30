import { useRef, useEffect, useState, useCallback } from 'react';
import { Howler } from 'howler';

let sharedState = null;

function initSharedState() {
  if (sharedState) return sharedState;
  
  sharedState = {
    analyserL: null,
    analyserR: null,
    splitter: null,
    merger: null,
    isConnected: false,
    listeners: new Set(),
    updateAnalysers: null,
  };
  
  return sharedState;
}

export function registerAnalysers({ analyserL, analyserR, splitter, merger }) {
  const state = initSharedState();
  state.analyserL = analyserL;
  state.analyserR = analyserR;
  state.splitter = splitter;
  state.merger = merger;
  state.isConnected = true;
  
  state.listeners.forEach(fn => fn());
}

export function unregisterAnalysers() {
  if (sharedState) {
    sharedState.analyserL = null;
    sharedState.analyserR = null;
    sharedState.splitter = null;
    sharedState.merger = null;
    sharedState.isConnected = false;
  }
}

export function useGlobalAudioAnalyser() {
  const state = initSharedState();
  const [isReady, setIsReady] = useState(false);
  const [, forceUpdate] = useState(0);
  
  useEffect(() => {
    const checkReady = () => {
      const ready = state.isConnected && state.analyserL && state.analyserR;
      setIsReady(ready);
      forceUpdate(n => n + 1);
    };
    
    state.listeners.add(checkReady);
    checkReady();
    
    return () => {
      state.listeners.delete(checkReady);
    };
  }, []);
  
  const getRMS = useCallback(() => {
    if (!state.analyserL || !state.analyserR) return 0;
    
    const dataL = new Uint8Array(state.analyserL.frequencyBinCount);
    const dataR = new Uint8Array(state.analyserR.frequencyBinCount);
    
    state.analyserL.getByteTimeDomainData(dataL);
    state.analyserR.getByteTimeDomainData(dataR);
    
    let sumL = 0, sumR = 0;
    for (let i = 0; i < dataL.length; i++) {
      const vL = (dataL[i] - 128) / 128;
      const vR = (dataR[i] - 128) / 128;
      sumL += vL * vL;
      sumR += vR * vR;
    }
    
    const rmsL = Math.sqrt(sumL / dataL.length);
    const rmsR = Math.sqrt(sumR / dataR.length);
    
    return (rmsL + rmsR) / 2;
  }, []);
  
  const getBassEnergy = useCallback(() => {
    if (!state.analyserL || !state.analyserR) return 0;
    
    const ctx = Howler.ctx;
    if (!ctx) return 0;
    
    const freqL = new Uint8Array(state.analyserL.frequencyBinCount);
    const freqR = new Uint8Array(state.analyserR.frequencyBinCount);
    
    state.analyserL.getByteFrequencyData(freqL);
    state.analyserR.getByteFrequencyData(freqR);
    
    const nyquist = ctx.sampleRate / 2;
    const binSize = nyquist / (state.analyserL.frequencyBinCount / 2);
    const bassMinBin = Math.floor(20 / binSize);
    const bassMaxBin = Math.ceil(60 / binSize);
    
    let sumL = 0, sumR = 0;
    let count = bassMaxBin - bassMinBin;
    
    for (let i = bassMinBin; i < bassMaxBin && i < freqL.length; i++) {
      const normL = freqL[i] / 255;
      const normR = freqR[i] / 255;
      sumL += normL * normL;
      sumR += normR * normR;
    }
    
    const bassL = Math.sqrt(sumL / Math.max(count, 1));
    const bassR = Math.sqrt(sumR / Math.max(count, 1));
    
    return (bassL + bassR) / 2;
  }, []);
  
  const getWaveform = useCallback(() => {
    if (!state.analyserL) return new Uint8Array(0);
    
    const data = new Uint8Array(state.analyserL.frequencyBinCount);
    state.analyserL.getByteTimeDomainData(data);
    return data;
  }, []);
  
  const getSpectrum = useCallback(() => {
    if (!state.analyserL) return new Uint8Array(0);
    
    const data = new Uint8Array(state.analyserL.frequencyBinCount);
    state.analyserL.getByteFrequencyData(data);
    return data;
  }, []);
  
  return {
    isReady,
    getRMS,
    getBassEnergy,
    getWaveform,
    getSpectrum,
  };
}
