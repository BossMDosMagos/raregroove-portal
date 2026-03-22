import React, { createContext, useContext, useState, useCallback } from 'react';

const DiscogsContext = createContext(null);

export function DiscogsProvider({ children }) {
  const [importedData, setImportedData] = useState(null);
  const [hasImported, setHasImported] = useState(false);

  const importFromDiscogs = useCallback((data) => {
    setImportedData(data);
    setHasImported(true);
  }, []);

  const clearImportedData = useCallback(() => {
    setImportedData(null);
    setHasImported(false);
  }, []);

  const updateImportedTrack = useCallback((index, field, value) => {
    setImportedData(prev => {
      if (!prev?.tracklist) return prev;
      const newTracklist = [...prev.tracklist];
      newTracklist[index] = { ...newTracklist[index], [field]: value };
      return { ...prev, tracklist: newTracklist };
    });
  }, []);

  return (
    <DiscogsContext.Provider value={{
      importedData,
      hasImported,
      importFromDiscogs,
      clearImportedData,
      updateImportedTrack,
    }}>
      {children}
    </DiscogsContext.Provider>
  );
}

export function useDiscogs() {
  const context = useContext(DiscogsContext);
  if (!context) {
    throw new Error('useDiscogs must be used within DiscogsProvider');
  }
  return context;
}
