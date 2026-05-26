import { useRef, useEffect, useState, useCallback } from 'react';

let audioContextRef = null;
let sharedAnalyserL = null;
let sharedAnalyserR = null;
let vuGainNode = null;
let sharedState = null;
let externalAnalyserL = null;
let externalAnalyserR = null;
let externalVuGain = null;
let currentSplitterRef = null;

export function initAudioAnalysers(audioContext, gainNode, externalAnalysers = null) {
  externalAnalyserL = externalAnalysers?.analyserL || null;
  externalAnalyserR = externalAnalysers?.analyserR || null;
  externalVuGain = externalAnalysers?.vuGain || null;
  
  if (externalAnalyserL && externalAnalyserR) {
    if (!sharedState) {
      sharedState = { isConnected: true, listeners: new Set() };
    }
    sharedState.isConnected = true;
    sharedState.listeners.forEach(fn => fn());
    return { analyserL: externalAnalyserL, analyserR: externalAnalyserR };
  }
  
  if (sharedAnalyserL && sharedAnalyserR) {
    return { analyserL: sharedAnalyserL, analyserR: sharedAnalyserR };
  }
  
  audioContextRef = audioContext;
  
  if (!audioContext) return { analyserL: null, analyserR: null };
  
  sharedAnalyserL = audioContext.createAnalyser();
  sharedAnalyserL.fftSize = 2048;
  sharedAnalyserL.smoothingTimeConstant = 0.85;
  sharedAnalyserL.minDecibels = -90;
  sharedAnalyserL.maxDecibels = 0;
  
  sharedAnalyserR = audioContext.createAnalyser();
  sharedAnalyserR.fftSize = 2048;
  sharedAnalyserR.smoothingTimeConstant = 0.85;
  sharedAnalyserR.minDecibels = -90;
  sharedAnalyserR.maxDecibels = 0;
  
  vuGainNode = gainNode;
  
  if (!sharedState) {
    sharedState = {
      isConnected: true,
      listeners: new Set(),
    };
  }
  sharedState.isConnected = true;
  sharedState.listeners.forEach(fn => fn());
  
  return { analyserL: sharedAnalyserL, analyserR: sharedAnalyserR };
}

export function getAnalysers() {
  return {
    analyserL: externalAnalyserL || sharedAnalyserL,
    analyserR: externalAnalyserR || sharedAnalyserR,
    vuGainNode: externalVuGain || vuGainNode,
  };
}

export function connectToAnalysers(source) {
  if (!sharedAnalyserL || !sharedAnalyserR || !vuGainNode || !audioContextRef) {
    return false;
  }
  
  if (currentSplitterRef) {
    try { currentSplitterRef.disconnect(); } catch (e) {}
  }
  
  const splitter = audioContextRef.createChannelSplitter(2);
  currentSplitterRef = splitter;
  source.connect(vuGainNode);
  vuGainNode.connect(splitter);
  splitter.connect(sharedAnalyserL, 0);
  splitter.connect(sharedAnalyserR, 1);
  
  return true;
}

export function registerAnalysers({ analyserL, analyserR, splitter, merger, onData }) {
  if (analyserL) sharedAnalyserL = analyserL;
  if (analyserR) sharedAnalyserR = analyserR;
  if (!sharedState) {
    sharedState = { isConnected: true, listeners: new Set() };
  } else {
    sharedState.isConnected = true;
  }
  sharedState.listeners.forEach(fn => fn());
}

export function unregisterAnalysers() {
  if (sharedAnalyserL) { try { sharedAnalyserL.disconnect(); } catch (e) {} sharedAnalyserL = null; }
  if (sharedAnalyserR) { try { sharedAnalyserR.disconnect(); } catch (e) {} sharedAnalyserR = null; }
  if (sharedState) {
    sharedState.isConnected = false;
    sharedState.listeners.clear();
  }
  vuGainNode = null;
}

export function resetAnalysers() {
  if (sharedState) {
    sharedState.isConnected = false;
    sharedState.listeners.clear();
  }
  sharedAnalyserL = null;
  sharedAnalyserR = null;
  vuGainNode = null;
  sharedState = null;
  audioContextRef = null;
}

const BUFFER_POOL = {};

function getBuffer(size) {
  if (!BUFFER_POOL[size] || BUFFER_POOL[size].length !== size) {
    BUFFER_POOL[size] = new Uint8Array(size);
  }
  return BUFFER_POOL[size];
}

const FALLBACK_WAVEFORM = new Uint8Array(1024).fill(128);

export function useGlobalAudioAnalyser() {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    const checkReady = () => {
      setIsReady(sharedState?.isConnected && !!sharedAnalyserL && !!sharedAnalyserR);
    };
    
    if (sharedState) {
      sharedState.listeners.add(checkReady);
      checkReady();
    } else {
      const interval = setInterval(() => {
        if (sharedState?.isConnected) {
          checkReady();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
    
    return () => {
      if (sharedState) {
        sharedState.listeners.delete(checkReady);
      }
    };
  }, []);
  
  const getRMSL = useCallback(() => {
    if (!sharedAnalyserL) return 0;
    
    const dataL = getBuffer(sharedAnalyserL.frequencyBinCount);
    sharedAnalyserL.getByteTimeDomainData(dataL);
    
    let sumL = 0;
    for (let i = 0; i < dataL.length; i++) {
      const vL = (dataL[i] - 128) / 128;
      sumL += vL * vL;
    }
    
    return Math.sqrt(sumL / dataL.length);
  }, []);
  
  const getRMSR = useCallback(() => {
    if (!sharedAnalyserR) return 0;
    
    const dataR = getBuffer(sharedAnalyserR.frequencyBinCount);
    sharedAnalyserR.getByteTimeDomainData(dataR);
    
    let sumR = 0;
    for (let i = 0; i < dataR.length; i++) {
      const vR = (dataR[i] - 128) / 128;
      sumR += vR * vR;
    }
    
    return Math.sqrt(sumR / dataR.length);
  }, []);
  
  const getBassEnergyL = useCallback(() => {
    if (!sharedAnalyserL) return 0;
    
    const freqL = getBuffer(sharedAnalyserL.frequencyBinCount);
    sharedAnalyserL.getByteFrequencyData(freqL);
    
    const binSize = 48000 / sharedAnalyserL.frequencyBinCount;
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
    
    return Math.sqrt(sumL / Math.max(count, 1));
  }, []);
  
  const getBassEnergyR = useCallback(() => {
    if (!sharedAnalyserR) return 0;
    
    const freqR = getBuffer(sharedAnalyserR.frequencyBinCount);
    sharedAnalyserR.getByteFrequencyData(freqR);
    
    const binSize = 48000 / sharedAnalyserR.frequencyBinCount;
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
    if (!sharedAnalyserL) return FALLBACK_WAVEFORM;
    const data = getBuffer(sharedAnalyserL.frequencyBinCount);
    sharedAnalyserL.getByteTimeDomainData(data);
    return data;
  }, []);

  const getWaveformR = useCallback(() => {
    if (!sharedAnalyserR) return FALLBACK_WAVEFORM;
    const data = getBuffer(sharedAnalyserR.frequencyBinCount);
    sharedAnalyserR.getByteTimeDomainData(data);
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
  };
}
