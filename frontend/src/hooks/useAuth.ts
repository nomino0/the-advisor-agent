"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  totp_enabled: boolean;
}

// ─── Cookie helpers ────────────────────────────────────────────────────────────
function setCookie(name: string, value: string) {
  // Use session cookie (removed on browser close).
  // Note: Tab close != Browser close for cookies often, but sessionStorage clears on tab close.
  // We keep cookies in sync with sessionStorage as much as possible, primarily for middleware.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Strict`;
}

function deleteCookie(name: string) {
  // Expire immediately
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Call this after a successful login API response to persist auth state. */
export function saveAuth(data: { access_token: string; refresh_token: string; user: User }) {
  // sessionStorage (cleared on tab close)
  sessionStorage.setItem("access_token", data.access_token);
  sessionStorage.setItem("refresh_token", data.refresh_token);
  sessionStorage.setItem("user", JSON.stringify(data.user));

  // cookies (session cookies for middleware)
  setCookie("access_token", data.access_token);
  setCookie("user", JSON.stringify({ role: data.user.role }));
}

/** Clear all auth state on logout. */
export function clearAuth() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
  sessionStorage.removeItem("user");
  deleteCookie("access_token");
  deleteCookie("user");
}

/** Get the current token synchronously (client-side only). */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("access_token");
}

/** Get the stored user synchronously (client-side only). */
export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAuth — returns { user, token, isAdmin, loading, logout }
 * Also handles redirecting unauthenticated users to /login.
 */
export function useAuth(options: { requireAuth?: boolean; requireAdmin?: boolean } = {}) {
  const { requireAuth = true, requireAdmin = false } = options;
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const t = getToken();
    const u = getUser();

    // Let's do a quick initial check based on potentially stale/spoofed local storage
    if (requireAuth && (!t || !u)) {
      clearAuth();
      toast.error("Session expired. Please log in again.");
      router.replace("/login");
      return;
    }

    if (!requireAuth && !t && typeof document !== "undefined" && (document.cookie.includes("access_token=") || document.cookie.includes("user="))) {
      clearAuth();
    }

    setToken(t);
    setUser(u);

    // Now securely fetch the real profile from the backend to prevent localStorage spoofing
    let mounted = true;
    if (t) {
      import("@/lib/api").then(({ api }) => {
        api("/api/v1/auth/me", { token: t })
          .then((realUser) => {
            if (!mounted) return;
            setUser(realUser);
            sessionStorage.setItem("user", JSON.stringify(realUser));

            // Enforce secure checks on the REAL verified user data
            if (requireAuth && !realUser.totp_enabled && pathname !== "/2fa-setup") {
              router.replace("/2fa-setup");
              return;
            }

            if (requireAdmin && realUser.role !== "admin") {
              router.replace("/dashboard");
              return;
            }
            setLoading(false);
          })
          .catch((err) => {
            if (!mounted) return;
            // If 401 or network error, let the api.ts handler or fallback cover it.
            setLoading(false);
          });
      });
    } else {
      setLoading(false);
    }

    return () => { mounted = false; };
  }, [requireAuth, requireAdmin, router, pathname]);

  const logout = useCallback(async () => {
    if (token) {
      try {
        const { api } = await import("@/lib/api");
        await api("/api/v1/auth/logout", { method: "POST", token });
      } catch (err) {
        // Ignore network or 401 errors during logout, we want to clear local state regardless
      }
    }
    clearAuth();
    router.push("/");
  }, [router, token]);

  const isAdmin = user?.role === "admin";

  return { user, token, isAdmin, loading, logout };
}
