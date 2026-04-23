import React, { createContext, useState, useContext, useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  authService,
  profileService,
  setTokenExpiredCallback,
  isAccessTokenExpiredOrExpiringSoon,
  attemptProactiveRefresh,
} from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
    // Registrar callback para cuando el token expire
    setTokenExpiredCallback(() => setUser(null));

    // Proactively refresh the access token whenever the app returns to foreground.
    // This avoids the burst of 401s that occur when all HomeScreen requests fire
    // simultaneously with an expired token after >1 h in the background.
    const handleAppStateChange = async (nextState) => {
      if (nextState === 'active') {
        try {
          const storedUser = await AsyncStorage.getItem('user');
          if (!storedUser) return; // Not logged in – nothing to refresh
          const needsRefresh = await isAccessTokenExpiredOrExpiringSoon();
          if (needsRefresh) {
            await attemptProactiveRefresh();
          }
        } catch (err) {
          // If the server explicitly rejected the refresh token (4xx), log out.
          // Network errors (no connectivity on resume) are swallowed – the
          // reactive 401 interceptor in api.js will handle them.
          const isServerRejection =
            err.response?.status >= 400 && err.response?.status < 500;
          if (isServerRejection) {
            await AsyncStorage.removeItem('user');
            await SecureStore.deleteItemAsync('token');
            await SecureStore.deleteItemAsync('refreshToken');
            setUser(null);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const loadStorageData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const token = await SecureStore.getItemAsync('token');

      if (storedUser && token) {
        // Proactively refresh if the access token is expired or expiring soon.
        // This prevents the burst of 401s on the first HomeScreen data load.
        const needsRefresh = await isAccessTokenExpiredOrExpiringSoon();
        if (needsRefresh) {
          try {
            await attemptProactiveRefresh();
          } catch (err) {
            const isServerRejection =
              err.response?.status >= 400 && err.response?.status < 500;
            if (isServerRejection) {
              // Refresh token is invalid – don't restore the session.
              await AsyncStorage.removeItem('user');
              await SecureStore.deleteItemAsync('token');
              await SecureStore.deleteItemAsync('refreshToken');
              return;
            }
            // Network error on startup: restore session anyway.
            // The reactive interceptor will handle 401s when requests fire.
          }
        }
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password);
      
      if (response.success) {
        const userData = response.data;
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await SecureStore.setItemAsync('token', userData.token);
        await SecureStore.setItemAsync('refreshToken', userData.refreshToken);
        setUser(userData);
        return { success: true };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      console.error('Error en login:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al iniciar sesión' 
      };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await authService.register(name, email, password);
      
      if (response.success) {
        const userData = response.data;
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await SecureStore.setItemAsync('token', userData.token);
        await SecureStore.setItemAsync('refreshToken', userData.refreshToken);
        setUser(userData);
        return { success: true };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      console.error('Error en registro:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al registrar usuario',
      };
    }
  };

  const updateUserProfile = async (profileData) => {
    try {
      const response = await profileService.updateProfile(user.id, profileData);
      
      if (response.success) {
        const updatedUser = response.data;
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        return { success: true };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al actualizar perfil' 
      };
    }
  };

  const logout = async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        // Invalidar el refresh token en el servidor (fire & forget)
        authService.logout(refreshToken).catch(() => {});
      }
      await AsyncStorage.removeItem('user');
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refreshToken');
      setUser(null);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateUserProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};
