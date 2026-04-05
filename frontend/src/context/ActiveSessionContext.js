import React, { createContext, useContext, useState } from 'react';

const ActiveSessionContext = createContext(null);

export function ActiveSessionProvider({ children }) {
  const [session, setSession] = useState(null);

  // Saves (or updates) the in-progress session in context.
  // startTimestamp is stored so the real elapsed time can be recomputed
  // even after the screen unmounts.
  const saveSession = ({ trainingId, trainingName, exerciseData, elapsedSeconds }) => {
    setSession({
      trainingId,
      trainingName,
      exerciseData,
      startTimestamp: Date.now() - elapsedSeconds * 1000,
    });
  };

  const discardSession = () => setSession(null);

  return (
    <ActiveSessionContext.Provider value={{ session, saveSession, discardSession }}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession() {
  return useContext(ActiveSessionContext);
}
