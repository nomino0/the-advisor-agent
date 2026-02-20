import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface ApiOptions {
  method?: string;
  body?: any;
  token?: string;
  isFormData?: boolean;
}

export async function api(endpoint: string, options: ApiOptions = {}) {
  const { method = "GET", body, token, isFormData = false } = options;

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${endpoint}`, config);

  if (res.status === 401 && typeof window !== "undefined") {
    // ── Session expired logic ────────────────────────────────────────────────
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("user");
    document.cookie = `access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
    document.cookie = `user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;

    toast.error("Session expired. Please log in again.", { id: "session-expired" });
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "An error occurred");
  }

  return data;
}
