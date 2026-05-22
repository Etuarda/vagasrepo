import { API_URL } from "./config.js";
import { toast } from "./toast.js";

export async function api(endpoint, options = {}, token = null) {
  const isFormData = options.body instanceof FormData;
  const headers = { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const details = Array.isArray(data?.issues)
      ? data.issues.map((issue) => issue.message).filter(Boolean).join("; ")
      : "";
    const message = details || data?.error || "Erro de comunicação";
    toast(message, "error");
    const err = new Error(message);
    err.status = res.status;
    err.issues = data?.issues || [];
    throw err;
  }

  return data;
}
