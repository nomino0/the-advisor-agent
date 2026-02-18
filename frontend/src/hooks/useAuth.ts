"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  totp_enabled: boolean;
}

// ─── Cookie helpers ────────────────────────────────────────────────────────────
function setCookie(name: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Call this after a successful login API response to persist auth state. */
export function saveAuth(data: { access_token: string; refresh_token: string; user: User }) {
  // localStorage (for API calls)
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  localStorage.setItem("user", JSON.stringify(data.user));

  // cookies (for middleware / SSR route protection)
  setCookie("access_token", data.access_token);
  setCookie("user", JSON.stringify({ role: data.user.role }));
}

/** Clear all auth state on logout. */
export function clearAuth() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  deleteCookie("access_token");
  deleteCookie("user");
}

/** Get the current token synchronously (client-side only). */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

/** Get the stored user synchronously (client-side only). */
export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
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

  useEffect(() => {
    const t = getToken();
    const u = getUser();

    if (requireAuth && (!t || !u)) {
      router.replace("/login");
      return;
    }

    if (requireAdmin && u?.role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    setToken(t);
    setUser(u);
    setLoading(false);
  }, [requireAuth, requireAdmin, router]);

  const logout = useCallback(() => {
    clearAuth();
    router.push("/login");
  }, [router]);

  const isAdmin = user?.role === "admin";

  return { user, token, isAdmin, loading, logout };
}
