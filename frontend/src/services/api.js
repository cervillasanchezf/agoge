import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const token = await AsyncStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

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

    if (error.response?.status === 401 && !originalRequest._retry) {
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
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.token;

        await AsyncStorage.setItem('token', newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('refreshToken');
        await AsyncStorage.removeItem('user');
        if (onSessionExpired) onSessionExpired();
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

  getSessionHistory: async (trainingId, params = {}) => {
    const response = await api.get(`/training-sessions/history/${trainingId}`, { params });
    return response.data;
  },

  createSession: async (sessionData) => {
    const response = await api.post('/training-sessions', sessionData);
    return response.data;
  },
};

export default api;
