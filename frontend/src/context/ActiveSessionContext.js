import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ActiveSessionContext = createContext(null);
const ACTIVE_SESSION_STORAGE_KEY = 'activeSession';

export function ActiveSessionProvider({ children }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const storedSession = await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        if (!storedSession || !isMounted) {
          return;
        }

        const parsedSession = JSON.parse(storedSession);
        if (parsedSession?.startTimestamp) {
          setSession(parsedSession);
        }
      } catch (error) {
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Saves (or updates) the in-progress session in context.
  // startTimestamp is stored so the real elapsed time can be recomputed
  // even after the screen unmounts.
  const saveSession = ({ trainingId, trainingName, exerciseData, elapsedSeconds, startTimestamp }) => {
    const nextSession = {
      trainingId,
      trainingName,
      exerciseData,
      startTimestamp: startTimestamp ?? Date.now() - elapsedSeconds * 1000,
    };

    setSession(nextSession);
    AsyncStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(nextSession)).catch(() => {});
  };

  const discardSession = () => {
    setSession(null);
    AsyncStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY).catch(() => {});
  };

  return (
    <ActiveSessionContext.Provider value={{ session, saveSession, discardSession }}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession() {
  return useContext(ActiveSessionContext);
}
