import { useRef, useEffect, useState, useCallback } from 'react';
import { getVuGainNode } from './useGrooveflixSettings.js';

let audioContextRef = null;
let sharedAnalyserL = null;
let sharedAnalyserR = null;
let vuGainNode = null;
let sharedState = null;

export function initAudioAnalysers(audioContext, gainNode) {
  if (sharedAnalyserL && sharedAnalyserR) {
    return { analyserL: sharedAnalyserL, analyserR: sharedAnalyserR };
  }
  
  audioContextRef = audioContext;
  
  sharedAnalyserL = audioContext.createAnalyser();
  sharedAnalyserL.fftSize = 2048;
  sharedAnalyserL.smoothingTimeConstant = 0.8;
  sharedAnalyserL.minDecibels = -90;
  sharedAnalyserL.maxDecibels = 0;
  
  sharedAnalyserR = audioContext.createAnalyser();
  sharedAnalyserR.fftSize = 2048;
  sharedAnalyserR.smoothingTimeConstant = 0.8;
  sharedAnalyserR.minDecibels = -90;
  sharedAnalyserR.maxDecibels = 0;
  
  vuGainNode = getVuGainNode();
  console.log('[Analyser] Using shared vuGainNode from settings:', vuGainNode ? 'OK' : 'NULL');
  
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
    analyserL: sharedAnalyserL,
    analyserR: sharedAnalyserR,
    vuGainNode: vuGainNode,
  };
}

export function connectToAnalysers(source) {
  console.log('[Analyser] connectToAnalysers called');
  console.log('[Analyser] sharedAnalyserL:', sharedAnalyserL ? 'OK' : 'NULL');
  console.log('[Analyser] sharedAnalyserR:', sharedAnalyserR ? 'OK' : 'NULL');
  console.log('[Analyser] vuGainNode:', vuGainNode ? 'OK' : 'NULL');
  console.log('[Analyser] audioContextRef:', audioContextRef ? 'OK' : 'NULL');
  console.log('[Analyser] source:', source ? 'OK' : 'NULL');
  
  if (!sharedAnalyserL || !sharedAnalyserR || !vuGainNode) {
    console.error('[Analyser] Analysers not initialized!');
    return false;
  }
  
  console.log('[Analyser] Connecting source → vuGainNode → splitter → analysers...');
  
  const splitter = audioContextRef.createChannelSplitter(2);
  source.connect(vuGainNode);
  vuGainNode.connect(splitter);
  splitter.connect(sharedAnalyserL, 0); // Canal Esquerdo (Left)
  splitter.connect(sharedAnalyserR, 1); // Canal Direito (Right)
  
  console.log('[Analyser] ✓ All connections made');
  console.log('[Analyser] vuGainNode.gain.value:', vuGainNode.gain.value);
  
  return true;
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

export function useGlobalAudioAnalyser() {
  const [isReady, setIsReady] = useState(false);
  const [, forceUpdate] = useState(0);
  const debugLogRef = useRef({ frameCount: 0 });
  
  useEffect(() => {
    const checkReady = () => {
      const ready = sharedState?.isConnected && sharedAnalyserL && sharedAnalyserR;
      setIsReady(ready);
      console.log('[Analyser] Hook checkReady - isConnected:', sharedState?.isConnected, 'analyserL:', sharedAnalyserL ? 'OK' : 'NULL');
      forceUpdate(n => n + 1);
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
    if (!sharedAnalyserL) {
      debugLogRef.current.frameCount++;
      if (debugLogRef.current.frameCount % 120 === 0) {
        console.warn('[Analyser] getRMSL: analyserL is NULL!');
      }
      return 0;
    }
    
    const dataL = new Uint8Array(sharedAnalyserL.frequencyBinCount);
    sharedAnalyserL.getByteTimeDomainData(dataL);
    
    let sumL = 0;
    let maxL = 0;
    let nonZeroCount = 0;
    for (let i = 0; i < dataL.length; i++) {
      const vL = (dataL[i] - 128) / 128;
      sumL += vL * vL;
      maxL = Math.max(maxL, Math.abs(vL));
      if (dataL[i] !== 128) nonZeroCount++;
    }
    
    const rms = Math.sqrt(sumL / dataL.length);
    
    debugLogRef.current.frameCount++;
    if (debugLogRef.current.frameCount % 60 === 0) {
      console.log('[Analyser] getRMSL - max:', maxL.toFixed(4), 'rms:', rms.toFixed(6), 'nonZero:', nonZeroCount, 'of', dataL.length);
    }
    
    return rms;
  }, []);
  
  const getRMSR = useCallback(() => {
    if (!sharedAnalyserR) return 0;
    
    const dataR = new Uint8Array(sharedAnalyserR.frequencyBinCount);
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
    
    const freqL = new Uint8Array(sharedAnalyserL.frequencyBinCount);
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
    
    const freqR = new Uint8Array(sharedAnalyserR.frequencyBinCount);
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
    if (!sharedAnalyserL) return new Uint8Array(1024).fill(128);
    const data = new Uint8Array(sharedAnalyserL.frequencyBinCount);
    sharedAnalyserL.getByteTimeDomainData(data);
    return data;
  }, []);

  const getWaveformR = useCallback(() => {
    if (!sharedAnalyserR) return new Uint8Array(1024).fill(128);
    const data = new Uint8Array(sharedAnalyserR.frequencyBinCount);
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
