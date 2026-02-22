"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeProvider";
import { saveAuth, getToken, getUser } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (token && user) {
      router.replace(user.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [pendingCaptchaSubmit, setPendingCaptchaSubmit] = useState(false);

  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const siteKey =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (siteKey && (!captchaToken || captchaToken.length < 10)) {
      const rendered = renderTurnstileWidget();
      (window as any).__pendingCaptchaSubmit = true;
      setPendingCaptchaSubmit(true);
      if (!rendered) {
        toast.error("CAPTCHA failed to load. Try reloading the page.");
      } else {
        toast("Please complete the CAPTCHA to continue");
      }
      return;
    }

    setLoading(true);
    try {
      const data = await api("/api/v1/auth/login", {
        method: "POST",
        body: { email, password, captcha_token: captchaToken },
      });
      if (data.requires_2fa) {
        setRequires2FA(true);
        setPendingToken(data.pending_token);
        setPassword("");
        toast.success("Please enter your 2FA code");
      } else {
        saveAuth(data);
        toast.success("Logged in successfully");
        const redirectPath =
          data.user?.role === "admin" ? "/admin" : "/dashboard";
        router.push(redirectPath);
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (window as any).__setTurnstileToken = (t: string) => setCaptchaToken(t);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey)
      return () => {
        (window as any).__setTurnstileToken = undefined;
      };

    const src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    let scriptEl = document.querySelector(
      `script[src="${src}"]`,
    ) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.src = src;
      scriptEl.async = true;
      scriptEl.defer = true;
        // Render widget once the script loads so users can interact immediately
        scriptEl.onload = () => renderTurnstileWidget();
        document.body.appendChild(scriptEl);
        // Small retry in case turnstile isn't available instantly
        setTimeout(() => renderTurnstileWidget(), 500);
    }

    return () => {
      (window as any).__setTurnstileToken = undefined;
    };
  }, []);

  const renderTurnstileWidget = () => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return false;
    try {
      if ((window as any).turnstile) {
        const container = document.getElementById("turnstile-widget");
        if (container) container.innerHTML = "";
        (window as any).turnstile.render("#turnstile-widget", {
          sitekey: siteKey,
          callback: function (token: string) {
            (window as any).__setTurnstileToken &&
              (window as any).__setTurnstileToken(token);
          },
        });
        return true;
      }
    } catch (e) {
      console.warn("turnstile render error", e);
    }
    return false;
  };

  useEffect(() => {
    if (captchaToken && pendingCaptchaSubmit) {
      setPendingCaptchaSubmit(false);
      (async () => {
        setLoading(true);
        try {
          const data = await api("/api/v1/auth/login", {
            method: "POST",
            body: { email, password, captcha_token: captchaToken },
          });
          if (data.requires_2fa) {
            setRequires2FA(true);
            setPendingToken(data.pending_token);
            setPassword("");
            toast.success("Please enter your 2FA code");
          } else {
            saveAuth(data);
            toast.success("Logged in successfully");
            const redirectPath =
              data.user?.role === "admin" ? "/admin" : "/dashboard";
            router.push(redirectPath);
          }
        } catch (err: any) {
          toast.error(err.message || "Login failed");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [captchaToken, pendingCaptchaSubmit]);

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api("/api/v1/auth/2fa/login", {
        method: "POST",
        body: {
          pending_token: pendingToken,
          totp_code: totpCode,
          trust_device: trustDevice,
        },
      });
      saveAuth(data);
      toast.success("2FA verified successfully");
      const redirectPath =
        data.user?.role === "admin" ? "/admin" : "/dashboard";
      router.push(redirectPath);
    } catch (err: any) {
      toast.error(err.message || "Invalid 2FA code");
      setTotpCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">CW</span>
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              CloudWise AI
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {requires2FA ? "Two-Factor Authentication" : "Welcome back"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {requires2FA
              ? "Enter the 6-digit code from your authenticator app"
              : "Sign in to your account"}
          </p>
        </div>

        {requires2FA ? (
          <form
            onSubmit={handle2FASubmit}
            className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                TOTP Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={(e) =>
                  setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                autoFocus
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-center text-2xl tracking-[0.5em] font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="000000"
              />
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Don't ask on this device for 7 days
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>

            <button
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setPendingToken("");
                setTotpCode("");
              }}
              className="w-full mt-3 text-slate-600 dark:text-slate-400 text-sm hover:underline"
            >
              Back to login
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="you@example.com"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="••••••••"
              />
            </div>

            {/* Cloudflare Turnstile widget (restored inside the login form) */}
            {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <div className="mb-6 flex justify-center" aria-hidden>
                <div id="turnstile-widget" />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <p className="text-center text-slate-600 dark:text-slate-400 mt-4 text-sm">
              Don't have an account?{" "}
              <Link
                href="/register"
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                Create one
              </Link>
            </p>
          </form>
        )}

        {/* Turnstile intentionally placed inside the login form above submit */}
      </div>
    </div>
  );
}
