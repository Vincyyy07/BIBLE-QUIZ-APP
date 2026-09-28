import axios from 'axios';

const getBaseUrl = () => {
  let url = (import.meta.env.VITE_API_URL || '').trim();

  if (url) {
    url = url.replace(/\/+$/, '');
    url = url.replace(/\/api$/, '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      url = url.replace('http://', 'https://');
    }
    return url;
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
    // Production fallback: default to Railway server URL
    return 'https://server-production-0c3b.up.railway.app';
  }

  return 'http://localhost:3001';
};

const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach user/host token to all requests if present
api.interceptors.request.use((config) => {
  const userToken = localStorage.getItem('userToken');
  const hostToken = localStorage.getItem('hostToken');
  const token = userToken || hostToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');

// Quiz
export const getAllQuizzes = () => api.get('/quizzes');
export const createQuiz = (data) => api.post('/quizzes', data);
export const getQuizByCode = (code) => api.get(`/quizzes/code/${code}`);
export const getQuizById = (id) => api.get(`/quizzes/${id}`);
export const updateQuiz = (id, data) => api.put(`/quizzes/${id}`, data);
export const setQuizWaiting = (id) => api.post(`/quizzes/${id}/waiting`);
export const deleteQuiz = (id) => api.delete(`/quizzes/${id}`);
export const duplicateQuiz = (id) => api.post(`/quizzes/${id}/duplicate`);
export const resetQuiz = (id) => api.post(`/quizzes/${id}/reset`);

// Questions
export const addQuestion = (quizId, data) => api.post(`/quizzes/${quizId}/questions`, data);
export const updateQuestion = (id, data) => api.put(`/questions/${id}`, data);
export const deleteQuestion = (id) => api.delete(`/questions/${id}`);
export const reorderQuestions = (quizId, orderedIds) =>
  api.post(`/quizzes/${quizId}/questions/reorder`, { orderedIds });
export const duplicateQuestion = (id) => api.post(`/questions/${id}/duplicate`);

// Results
export const getResults = (quizId) => api.get(`/quizzes/${quizId}/results`);
export const exportResults = (quizId) =>
  api.get(`/quizzes/${quizId}/export`, { responseType: 'blob' });

// Network info for QR codes
export const getNetworkInfo = () => api.get('/network-info');

export default api;


