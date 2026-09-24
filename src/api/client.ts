import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_URL } from "@/lib/config";
import { useAuth } from "@/store/auth";

export const api = axios.create({ baseURL: `${API_URL}/api/v1` });

api.interceptors.request.use((cfg) => {
  const t = useAuth.getState().access;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const { refresh, setAccess, clear } = useAuth.getState();
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${API_URL}/api/v1/auth/token/refresh/`, { refresh });
    setAccess(data.access, data.refresh);
    return data.access as string;
  } catch {
    clear();
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      refreshing ??= refreshAccess().finally(() => (refreshing = null));
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export const get = <T = any>(url: string, params?: any) => api.get<T>(url, { params }).then((r) => r.data);
export const post = <T = any>(url: string, body?: any) => api.post<T>(url, body ?? {}).then((r) => r.data);
export const patch = <T = any>(url: string, body?: any) => api.patch<T>(url, body ?? {}).then((r) => r.data);
export const del = <T = any>(url: string) => api.delete<T>(url).then((r) => r.data);
