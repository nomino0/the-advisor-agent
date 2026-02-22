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

  if ((res.status === 401 || res.status === 403) && typeof window !== "undefined") {
    if (res.status === 403) {
      if (window.location.pathname.startsWith("/admin")) {
        toast.error("Access denied. Admin privileges required.", { id: "admin-denied" });
        window.location.href = "/dashboard";
        throw new Error("Access denied (403)");
      }
      // other 403s maybe "email not verified" so just don't log out.
    } else {
      // 401 Unauthorized handling
      const skipSessionExpired = endpoint === "/api/v1/auth/login" || endpoint === "/api/v1/auth/register" || endpoint.includes("/auth/verify-email") || endpoint.includes("/auth/resend") || endpoint.includes("/auth/2fa") || endpoint === "/api/v1/auth/logout";
      if (!skipSessionExpired) {
        // Attempt to clear HttpOnly cookies securely using the backend
        await fetch(`${API_URL}/api/v1/auth/logout`, {
          method: "POST",
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        }).catch(() => { });

        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("refresh_token");
        sessionStorage.removeItem("user");
        document.cookie = `access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
        document.cookie = `user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;

        toast.error("Session expired. Please log in again.", { id: "session-expired" });
        window.location.href = "/login";
        throw new Error("Session expired (401)");
      }
    }
  }

  const data = await res.json();

  if (!res.ok) {
    let message = "An error occurred";
    if (data && data.detail) {
      if (typeof data.detail === "string") {
        message = data.detail;
      } else {
        try {
          message = JSON.stringify(data.detail);
        } catch (e) {
          message = String(data.detail);
        }
      }
    }
    throw new Error(message);
  }

  return data;
}
