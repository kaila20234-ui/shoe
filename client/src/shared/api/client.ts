import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import type { ApiFailure, ApiSuccess, ErrorCode, PageMeta } from '../types';

export interface ApiResult<T> {
  data: T;
  meta?: PageMeta;
}

export class ApiClientError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, string>;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type ApiConfig<D = unknown> = AxiosRequestConfig<D>;

interface ApiClient extends Omit<AxiosInstance, 'get' | 'post' | 'put' | 'patch' | 'delete'> {
  get<T = unknown>(url: string, config?: ApiConfig): Promise<ApiResult<T>>;
  post<T = unknown, D = unknown>(url: string, data?: D, config?: ApiConfig<D>): Promise<ApiResult<T>>;
  put<T = unknown, D = unknown>(url: string, data?: D, config?: ApiConfig<D>): Promise<ApiResult<T>>;
  patch<T = unknown, D = unknown>(url: string, data?: D, config?: ApiConfig<D>): Promise<ApiResult<T>>;
  delete<T = unknown>(url: string, config?: ApiConfig): Promise<ApiResult<T>>;
  getBlob(url: string, config?: ApiConfig): Promise<Blob>;
}

const TOKEN_KEY = 'shoestore_token';
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

instance.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError<ApiFailure>(error)) return Promise.reject(error);
    const status = error.response?.status ?? 0;
    const failure = error.response?.data;
    if (status === 401) {
      window.localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    if (failure && 'error' in failure) {
      return Promise.reject(new ApiClientError(
        failure.error.code,
        failure.error.message,
        status,
        failure.error.details,
      ));
    }
    return Promise.reject(new ApiClientError('INTERNAL', error.message || 'The request failed.', status));
  },
);

function unwrap<T>(response: AxiosResponse<ApiSuccess<T> | ApiFailure>): ApiResult<T> {
  const body = response.data;
  if (!body.success) {
    throw new ApiClientError(body.error.code, body.error.message, response.status, body.error.details);
  }
  return { data: body.data, ...(body.meta ? { meta: body.meta } : {}) };
}

function request<T, D = unknown>(config: ApiConfig<D>): Promise<ApiResult<T>> {
  return instance.request<ApiSuccess<T> | ApiFailure>(config).then(unwrap);
}

export const api = Object.assign(instance, {
  get: <T = unknown>(url: string, config?: ApiConfig) => request<T>({ ...config, method: 'GET', url }),
  post: <T = unknown, D = unknown>(url: string, data?: D, config?: ApiConfig<D>) => request<T, D>({ ...config, method: 'POST', url, data }),
  put: <T = unknown, D = unknown>(url: string, data?: D, config?: ApiConfig<D>) => request<T, D>({ ...config, method: 'PUT', url, data }),
  patch: <T = unknown, D = unknown>(url: string, data?: D, config?: ApiConfig<D>) => request<T, D>({ ...config, method: 'PATCH', url, data }),
  delete: <T = unknown>(url: string, config?: ApiConfig) => request<T>({ ...config, method: 'DELETE', url }),
  getBlob: async (url: string, config?: ApiConfig) => (await instance.get<Blob>(url, { ...config, responseType: 'blob' })).data,
}) as ApiClient;
