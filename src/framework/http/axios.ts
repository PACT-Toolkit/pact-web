import axios from 'axios';

export const httpClient = axios.create({
  baseURL: '/api/pact',
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);
