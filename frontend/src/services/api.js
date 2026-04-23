import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/config';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Callback registrado desde AuthContext para forzar logout si el refresh también falla
let onSessionExpired = null;
export const setTokenExpiredCallback = (cb) => { onSessionExpired = cb; };

// Interceptor: adjunta el access token a cada petición
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Token expiry helpers ─────────────────────────────────────────────────────

/**
 * Decode the JWT payload without a library.
 * Returns the parsed payload or null on any error.
 */
function parseJwtPayload(token) {
  try {
    const segment = token.split('.')[1];
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/**
 * Returns true if the stored access token is missing, expired, or will expire
 * within `bufferSeconds` seconds (default 30).
 */
export const isAccessTokenExpiredOrExpiringSoon = async (bufferSeconds = 30) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (!token) return true;
    const payload = parseJwtPayload(token);
    if (!payload?.exp) return true;
    return payload.exp * 1000 < Date.now() + bufferSeconds * 1000;
  } catch {
    return true;
  }
};

/**
 * Proactively refresh the access token using the stored refresh token.
 * Updates AsyncStorage and the default header on success.
 * Throws on failure so the caller can decide what to do.
 */
export const attemptProactiveRefresh = async () => {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) throw new Error('No refresh token available');
  const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
  const newToken = data.data.token;
  await SecureStore.setItemAsync('token', newToken);
  api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
  return newToken;
};

// ─── Concurrent-refresh queue ─────────────────────────────────────────────────

// Flag para evitar bucles infinitos si el refresh también falla
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Interceptor de respuesta: renueva automáticamente el access token cuando expira
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // No intentar renovar token en rutas de autenticación
    const isAuthRoute = originalRequest.url?.includes('/auth/');
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        // Encolar la petición mientras se renueva
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) {
          processQueue(error, null);
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('refreshToken');
          await AsyncStorage.removeItem('user');
          if (onSessionExpired) onSessionExpired();
          return Promise.reject(error);
        }

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.token;

        await SecureStore.setItemAsync('token', newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Only clear session if the server explicitly rejected the refresh token (4xx).
        // Network errors (no internet, timeout) should NOT log the user out.
        const isServerRejection = refreshError.response?.status >= 400 && refreshError.response?.status < 500;
        if (isServerRejection) {
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('refreshToken');
          await AsyncStorage.removeItem('user');
          if (onSessionExpired) onSessionExpired();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data;
  },

  logout: async (refreshToken) => {
    const response = await api.post('/auth/logout', { refreshToken });
    return response.data;
  },
};

export const profileService = {
  updateProfile: async (userId, profileData) => {
    const response = await api.put(`/profile/${userId}`, profileData);
    return response.data;
  },

  getProfile: async (userId) => {
    const response = await api.get(`/profile/${userId}`);
    return response.data;
  },
};

export const exerciseService = {
  // params: { search, category, level, equipment, primaryMuscle, mechanic, force, page, limit }
  getExercises: async (params = {}) => {
    const response = await api.get('/exercises', { params });
    return response.data;
  },

  getExerciseById: async (id) => {
    const response = await api.get(`/exercises/${id}`);
    return response.data;
  },

  // Obtiene los valores disponibles para poblar los selectores de filtros
  getFilters: async () => {
    const response = await api.get('/exercises/filters');
    return response.data;
  },
};

export const trainingService = {
  getTrainings: async () => {
    const response = await api.get('/trainings');
    return response.data;
  },

  getTrainingById: async (id) => {
    const response = await api.get(`/trainings/${id}`);
    return response.data;
  },

  createTraining: async (trainingData) => {
    const response = await api.post('/trainings', trainingData);
    return response.data;
  },

  updateTraining: async (id, trainingData) => {
    const response = await api.put(`/trainings/${id}`, trainingData);
    return response.data;
  },

  deleteTraining: async (id) => {
    const response = await api.delete(`/trainings/${id}`);
    return response.data;
  },
};

export const sessionService = {
  // Obtiene la última sesión de una plantilla para pre-cargar valores
  getLastSession: async (trainingId) => {
    const response = await api.get(`/training-sessions/last/${trainingId}`);
    return response.data;
  },

  getExerciseMaxes: async (trainingId) => {
    const response = await api.get(`/training-sessions/exercise-maxes/${trainingId}`);
    return response.data;
  },

  getSessionHistory: async (trainingId, params = {}) => {
    const response = await api.get(`/training-sessions/history/${trainingId}`, { params });
    return response.data;
  },

  getAllSessions: async (params = {}) => {
    const response = await api.get('/training-sessions/all', { params });
    return response.data;
  },

  createSession: async (sessionData) => {
    const response = await api.post('/training-sessions', sessionData);
    return response.data;
  },

  updateSession: async (id, data) => {
    const response = await api.put(`/training-sessions/${id}`, data);
    return response.data;
  },

  deleteSession: async (id) => {
    const response = await api.delete(`/training-sessions/${id}`);
    return response.data;
  },
};

export const measurementService = {
  getMeasurements: async () => {
    const response = await api.get('/measurements');
    return response.data;
  },

  getMeasurementById: async (id) => {
    const response = await api.get(`/measurements/${id}`);
    return response.data;
  },

  createMeasurement: async (data) => {
    const response = await api.post('/measurements', data);
    return response.data;
  },

  updateMeasurement: async (id, data) => {
    const response = await api.put(`/measurements/${id}`, data);
    return response.data;
  },

  deleteMeasurement: async (id) => {
    const response = await api.delete(`/measurements/${id}`);
    return response.data;
  },
};

export const planService = {
  getPlans: async () => {
    const response = await api.get('/plans');
    return response.data;
  },

  getPlanById: async (id) => {
    const response = await api.get(`/plans/${id}`);
    return response.data;
  },

  createPlan: async (data) => {
    const response = await api.post('/plans', data);
    return response.data;
  },

  updatePlan: async (id, data) => {
    const response = await api.put(`/plans/${id}`, data);
    return response.data;
  },

  activatePlan: async (id) => {
    const response = await api.patch(`/plans/${id}/activate`);
    return response.data;
  },

  finishPlan: async (id) => {
    const response = await api.patch(`/plans/${id}/finish`);
    return response.data;
  },

  deletePlan: async (id) => {
    const response = await api.delete(`/plans/${id}`);
    return response.data;
  },
};

export default api;
