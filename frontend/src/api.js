// Leave VITE_API_URL empty in development (Vite proxies /api to Flask).
// For a deployed build, set it to the backend's address, e.g. http://localhost:5000
const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the Flask backend running?");
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.details = body?.details;
    throw err;
  }
  return body;
}

export const api = {
  login: (username, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
  list: (params = {}) => request(`/inventory?${new URLSearchParams(params)}`),
  summary: () => request("/inventory/summary"),
  get: (id) => request(`/inventory/${id}`),
  create: (data) => request("/inventory", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/inventory/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => request(`/inventory/${id}`, { method: "DELETE" }),
  adjust: (id, data) =>
    request(`/inventory/${id}/adjust`, { method: "POST", body: JSON.stringify(data) }),
  movements: (id) => request(`/inventory/${id}/movements`),
  allMovements: () => request("/movements"),
};
