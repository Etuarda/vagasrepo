const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const API_URL = isLocalDevelopment
  ? "https://gerenciadorpessoaldevagas.onrender.com"
  : "/api";
