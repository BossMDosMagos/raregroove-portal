import { useRef, useEffect, useState, useCallback } from 'react';

let sharedState = null;

function initSharedState() {
  if (sharedState) return sharedState;
  
  sharedState = {
    analyserL: null,
    analyserR: null,
    vuGainNode: null,
    isConnected: false,
    listeners: new Set(),
  };
  
  return sharedState;
}

export function resetAnalysers() {
  sharedState = null;
}

export function registerAnalysers({ analyserL, analyserR, vuGainNode }) {
  const state = initSharedState();
  state.analyserL = analyserL;
  state.analyserR = analyserR;
  state.vuGainNode = vuGainNode;
  state.isConnected = true;
  
  state.listeners.forEach(fn => fn());
}

export function unregisterAnalysers() {
  if (sharedState) {
    sharedState.analyserL = null;
    sharedState.analyserR = null;
    sharedState.vuGainNode = null;
    sharedState.isConnected = false;
  }
}

export function useGlobalAudioAnalyser() {
  const state = initSharedState();
  const [isReady, setIsReady] = useState(false);
  const [, forceUpdate] = useState(0);
  const debugLogRef = { lastLog: 0, frameCount: 0 };
  
  useEffect(() => {
    const checkReady = () => {
      const ready = state.isConnected && state.analyserL && state.analyserR;
      setIsReady(ready);
      forceUpdate(n => n + 1);
      console.log('[Analyser] State updated - isConnected:', state.isConnected, 'analyserL:', state.analyserL ? 'OK' : 'NULL');
    };
    
    state.listeners.add(checkReady);
    checkReady();
    
    return () => {
      state.listeners.delete(checkReady);
    };
  }, []);
  
  const getRMSL = useCallback(() => {
    if (!state.analyserL) {
      debugLogRef.frameCount++;
      if (debugLogRef.frameCount % 120 === 0) {
        console.warn('[Analyser] getRMSL: analyserL is NULL!');
      }
      return 0;
    }
    
    const dataL = new Uint8Array(state.analyserL.frequencyBinCount);
    state.analyserL.getByteTimeDomainData(dataL);
    
    let sumL = 0;
    let maxL = 0;
    for (let i = 0; i < dataL.length; i++) {
      const vL = (dataL[i] - 128) / 128;
      sumL += vL * vL;
      maxL = Math.max(maxL, Math.abs(vL));
    }
    
    const rms = Math.sqrt(sumL / dataL.length);
    
    // Debug log a cada 2 segundos
    debugLogRef.frameCount++;
    if (debugLogRef.frameCount % 120 === 0) {
      console.log('[Analyser] getRMSL - max:', maxL.toFixed(4), 'rms:', rms.toFixed(6), 'firstSample:', dataL[0]);
    }
    
    return rms;
  }, []);
  
  const getRMSR = useCallback(() => {
    if (!state.analyserR) return 0;
    
    const dataR = new Uint8Array(state.analyserR.frequencyBinCount);
    state.analyserR.getByteTimeDomainData(dataR);
    
    let sumR = 0;
    for (let i = 0; i < dataR.length; i++) {
      const vR = (dataR[i] - 128) / 128;
      sumR += vR * vR;
    }
    
    return Math.sqrt(sumR / dataR.length);
  }, []);
  
  const getBassEnergyL = useCallback(() => {
    if (!state.analyserL) return 0;
    
    const freqL = new Uint8Array(state.analyserL.frequencyBinCount);
    state.analyserL.getByteFrequencyData(freqL);
    
    const binSize = 48000 / state.analyserL.frequencyBinCount;
    const bassMinBin = Math.floor(20 / binSize);
    const bassMaxBin = Math.ceil(60 / binSize);
    
    let sumL = 0;
    let count = bassMaxBin - bassMinBin;
    let maxFreqL = 0;
    
    for (let i = bassMinBin; i < bassMaxBin && i < freqL.length; i++) {
      const normL = freqL[i] / 255;
      sumL += normL * normL;
      maxFreqL = Math.max(maxFreqL, freqL[i]);
    }
    
    // Debug log a cada 2 segundos
    debugLogRef.frameCount++;
    if (debugLogRef.frameCount % 120 === 0) {
      console.log('[Analyser] getBassEnergyL - maxFreq:', maxFreqL, 'bassEnergy:', Math.sqrt(sumL / Math.max(count, 1)).toFixed(6));
    }
    
    return Math.sqrt(sumL / Math.max(count, 1));
  }, []);
  
  const getBassEnergyR = useCallback(() => {
    if (!state.analyserR) return 0;
    
    const freqR = new Uint8Array(state.analyserR.frequencyBinCount);
    state.analyserR.getByteFrequencyData(freqR);
    
    const binSize = 48000 / state.analyserR.frequencyBinCount;
    const bassMinBin = Math.floor(20 / binSize);
    const bassMaxBin = Math.ceil(60 / binSize);
    
    let sumR = 0;
    let count = bassMaxBin - bassMinBin;
    
    for (let i = bassMinBin; i < bassMaxBin && i < freqR.length; i++) {
      const normR = freqR[i] / 255;
      sumR += normR * normR;
    }
    
    return Math.sqrt(sumR / Math.max(count, 1));
  }, []);
  
  const getWaveformL = useCallback(() => {
    if (!state.analyserL) return new Uint8Array(0);
    
    const data = new Uint8Array(state.analyserL.frequencyBinCount);
    state.analyserL.getByteTimeDomainData(data);
    return data;
  }, []);
  
  const getWaveformR = useCallback(() => {
    if (!state.analyserR) return new Uint8Array(0);
    
    const data = new Uint8Array(state.analyserR.frequencyBinCount);
    state.analyserR.getByteTimeDomainData(data);
    return data;
  }, []);
  
  const getSpectrumL = useCallback(() => {
    if (!state.analyserL) return new Uint8Array(0);
    
    const data = new Uint8Array(state.analyserL.frequencyBinCount);
    state.analyserL.getByteFrequencyData(data);
    return data;
  }, []);
  
  const getSpectrumR = useCallback(() => {
    if (!state.analyserR) return new Uint8Array(0);
    
    const data = new Uint8Array(state.analyserR.frequencyBinCount);
    state.analyserR.getByteFrequencyData(data);
    return data;
  }, []);
  
  return {
    isReady,
    getRMSL,
    getRMSR,
    getBassEnergyL,
    getBassEnergyR,
    getWaveformL,
    getWaveformR,
    getSpectrumL,
    getSpectrumR,
  };
}