import { API_URL } from "./config.js";
import { toast } from "./toast.js";

export async function api(endpoint, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.error || "Erro de comunicação";
    toast(message, "error");
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}
