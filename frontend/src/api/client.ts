import axios, { InternalAxiosRequestConfig } from "axios";
import { trackRequest } from "./pending";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

/** Requests the user did not ask for and should not wait on (error reports, sign-out notice): never shown as "loading". */
const BACKGROUND_REQUESTS = ["/logs/client", "/auth/logout"];

/** The function that ends the tracking of a request, stored on its config until the response comes back. */
const finishers = new WeakMap<InternalAxiosRequestConfig, () => void>();

/**
 * Axios instance: adds the stored JWT to each request, sends the user to /login on a 401,
 * and counts the requests in flight (api/pending.ts) so the interface can say "please wait".
 */
export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!BACKGROUND_REQUESTS.includes(config.url ?? "")) finishers.set(config, trackRequest());
  return config;
});

api.interceptors.response.use(
  (res) => {
    finishers.get(res.config)?.();
    return res;
  },
  (err) => {
    if (err.config) finishers.get(err.config)?.();
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);
