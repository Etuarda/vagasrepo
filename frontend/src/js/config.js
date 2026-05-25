const localHosts = new Set(["localhost", "127.0.0.1"]);

export const API_URL = localHosts.has(window.location.hostname)
  ? "http://localhost:3000"
  : "/api";
