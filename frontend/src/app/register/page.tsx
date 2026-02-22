"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeProvider";
import { useEffect } from "react";
import { toast } from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [pendingCaptchaSubmit, setPendingCaptchaSubmit] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (siteKey && (!captchaToken || captchaToken.length < 10)) {
      const rendered = renderTurnstileWidget();
      (window as any).__pendingCaptchaSubmit = true;
      setPendingCaptchaSubmit(true);
      if (!rendered) {
        setError('CAPTCHA failed to load. Try reloading the page.');
      }
      return;
    }

    setLoading(true);
    try {
      const res = await api("/api/v1/auth/register", {
        method: "POST",
        body: { email, password, full_name: fullName, captcha_token: captchaToken },
      });

      // Backend returns whether email was sent; surface an informative message
      if (res?.email_sent) {
        toast.success("Account created — check your inbox for a verification link.", { id: "register-success" });
        // redirect to activation-wait page
        router.push(`/verify-email/sent?email=${encodeURIComponent(email)}`);
        return;
      } else {
        toast.error("Account created. Verification email failed to send; you can resend from the verification page.", { id: "register-warning" });
      }
    } catch (err: any) {
      toast.error(err.message || "Registration failed", { id: "register-error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (window as any).__setTurnstileToken = (t: string) => setCaptchaToken(t);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return () => { (window as any).__setTurnstileToken = undefined; };

    const src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    let scriptEl = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.src = src;
      scriptEl.async = true;
      scriptEl.defer = true;
      // Render widget once the script loads so users can interact immediately
      scriptEl.onload = () => renderTurnstileWidget();
      document.body.appendChild(scriptEl);
      // Small retry in case turnstile isn't available instantly
      setTimeout(() => renderTurnstileWidget(), 500);
    }

    return () => { (window as any).__setTurnstileToken = undefined; };
  }, []);

  const renderTurnstileWidget = () => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return false;
    try {
      if ((window as any).turnstile) {
        const container = document.getElementById('turnstile-widget');
        if (container) container.innerHTML = '';
        (window as any).turnstile.render('#turnstile-widget', {
          sitekey: siteKey,
          callback: function (token: string) { (window as any).__setTurnstileToken && (window as any).__setTurnstileToken(token); },
        });
        return true;
      }
    } catch (e) {
      console.warn('turnstile render error', e);
    }
    return false;
  };

  useEffect(() => {
    if (captchaToken && pendingCaptchaSubmit) {
      setPendingCaptchaSubmit(false);
      // proceed with registration now that we have a captcha token
      (async () => {
        setLoading(true);
        try {
          const res = await api("/api/v1/auth/register", {
            method: "POST",
            body: { email, password, full_name: fullName, captcha_token: captchaToken },
          });
          if (res?.email_sent) {
            toast.success("Account created — check your inbox for a verification link.", { id: "register-success" });
            router.push(`/verify-email/sent?email=${encodeURIComponent(email)}`);
            return;
          } else {
            toast.error("Account created. Verification email failed to send; you can resend from the verification page.", { id: "register-warning" });
          }
        } catch (err: any) {
          toast.error(err.message || "Registration failed", { id: "register-error" });
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [captchaToken, pendingCaptchaSubmit]);

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create account</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Start optimizing your cloud today
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800"
        >
          {/* toasts are used for feedback */}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="John Doe"
            />
          </div>

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

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="••••••••"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="••••••••"
            />
          </div>

          {/* Cloudflare Turnstile widget (if configured) - placed where it was before */}
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
            {loading ? "Creating account..." : "Create Account"}
          </button>

          {/* Turnstile loads via client useEffect and is rendered on-demand on submit */}

          <p className="text-center text-slate-600 dark:text-slate-400 mt-4 text-sm">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>

        {/* Turnstile intentionally placed inside the form above submit */}
      </div>
    </div>
  );
}
