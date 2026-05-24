import axios from 'axios';

// Centralised HTTP client for all PACT backend calls.
// - No baseURL: callers use full paths (/api/pact/... or /v1/...) for clarity.
// - 401 redirect: unauthenticated responses send the user to /login.
// - Do NOT use for Next.js API routes (/api/auth/*), external APIs, or S3
//   presigned URLs — those have different auth semantics.
export const httpClient = axios.create({
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      typeof window !== 'undefined'
    ) {
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);
