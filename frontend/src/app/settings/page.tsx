"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  totp_enabled: boolean;
  github_connected: boolean;
}

export default function SettingsPage() {
  const { token, logout } = useAuth({ requireAuth: true });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // 2FA
  const [totpSetup, setTotpSetup] = useState<{ qr_code: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpMsg, setTotpMsg] = useState("");

  // PAT / GitHub
  const [patToken, setPatToken] = useState("");
  const [patSaving, setPatSaving] = useState(false);
  const [patMsg, setPatMsg] = useState("");

  // Session token display
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  // Account info
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    api("/api/v1/auth/me", { token })
      .then((data) => {
        setProfile(data);
        setFullName(data.full_name || "");
      })
      .catch(() => {
        // invalid token — middleware redirects
      })
      .finally(() => setProfileLoading(false));
  }, [token]);

  // ── 2FA ────────────────────────────────────────────────────────────────────

  const handleSetup2FA = async () => {
    setTotpLoading(true);
    setTotpMsg("");
    try {
      const data = await api("/api/v1/auth/2fa/setup", { method: "POST", token: token! });
      setTotpSetup(data);
    } catch (e: any) {
      setTotpMsg(e.message || "Failed to start 2FA setup");
    } finally {
      setTotpLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpLoading(true);
    setTotpMsg("");
    try {
      await api("/api/v1/auth/2fa/verify", {
        method: "POST",
        token: token!,
        body: { totp_code: totpCode },
      });
      setTotpMsg("2FA enabled successfully!");
      setTotpSetup(null);
      setTotpCode("");
      setProfile((p) => (p ? { ...p, totp_enabled: true } : p));
    } catch (e: any) {
      setTotpMsg(e.message || "Invalid code");
    } finally {
      setTotpLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm("Disable two-factor authentication?")) return;
    setTotpLoading(true);
    setTotpMsg("");
    try {
      await api("/api/v1/auth/2fa/disable", { method: "POST", token: token! });
      setTotpMsg("2FA disabled.");
      setProfile((p) => (p ? { ...p, totp_enabled: false } : p));
    } catch (e: any) {
      setTotpMsg(e.message || "Failed to disable 2FA");
    } finally {
      setTotpLoading(false);
    }
  };

  // ── GitHub PAT ─────────────────────────────────────────────────────────────

  const handleSavePAT = async (e: React.FormEvent) => {
    e.preventDefault();
    setPatSaving(true);
    setPatMsg("");
    try {
      await api("/api/v1/auth/github/pat", {
        method: "POST",
        token: token!,
        body: { token: patToken },
      });
      setPatMsg("GitHub token saved successfully!");
      setPatToken("");
      setProfile((p) => (p ? { ...p, github_connected: true } : p));
    } catch (e: any) {
      setPatMsg(e.message || "Invalid token");
    } finally {
      setPatSaving(false);
    }
  };

  // ── Account ────────────────────────────────────────────────────────────────

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    try {
      await api("/api/v1/auth/me", {
        method: "PATCH",
        token: token!,
        body: { full_name: fullName },
      });
      setSaveMsg("Saved!");
      setProfile((p) => (p ? { ...p, full_name: fullName } : p));
      const stored = localStorage.getItem("user");
      if (stored) {
        localStorage.setItem("user", JSON.stringify({ ...JSON.parse(stored), full_name: fullName }));
      }
    } catch (e: any) {
      setSaveMsg(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const maskedToken = token ? token.slice(0, 14) + "•••••••••••••••" + token.slice(-6) : "";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition text-sm"
            >
              &#8592; Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">CW</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">Settings</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* ── Account Info ── */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Account</h2>
          <div className="flex items-center gap-3 mb-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">{profile?.email}</p>
            {profile?.role === "admin" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                Admin
              </span>
            )}
          </div>
          <form onSubmit={handleSaveAccount} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>
            {saveMsg && (
              <p className={`text-sm ${saveMsg === "Saved!" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {saveMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 text-sm"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </section>

        {/* ── Session Token ── */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Session Token</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Your active JWT — used in the CLI grant command.
              </p>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Active
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3">
            <svg
              className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
              />
            </svg>
            <code className="flex-1 text-xs text-slate-700 dark:text-slate-300 font-mono truncate select-all">
              {showToken ? token : maskedToken}
            </code>
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="shrink-0 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
            >
              {showToken ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={handleCopyToken}
              className={`shrink-0 text-xs transition px-2.5 py-1 rounded border ${
                copied
                  ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Keep this token secret. It grants authenticated API access.
          </p>
        </section>

        {/* ── Two-Factor Authentication ── */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Two-Factor Authentication</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {profile?.totp_enabled ? "2FA is currently enabled." : "Add an extra layer of security to your account."}
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${profile?.totp_enabled ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
              {profile?.totp_enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          {totpMsg && (
            <p className={`text-sm mb-4 ${totpMsg.includes("success") || totpMsg.includes("enabled") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {totpMsg}
            </p>
          )}

          {!profile?.totp_enabled && !totpSetup && (
            <button
              onClick={handleSetup2FA}
              disabled={totpLoading}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 text-sm"
            >
              {totpLoading ? "Setting up..." : "Enable 2FA"}
            </button>
          )}

          {totpSetup && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              {totpSetup.qr_code && (
                <img
                  src={totpSetup.qr_code}
                  alt="2FA QR Code"
                  className="w-48 h-48 rounded-lg border border-slate-200 dark:border-slate-700"
                />
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                Manual key: {totpSetup.secret}
              </p>
              <form onSubmit={handleVerify2FA} className="flex gap-3">
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition font-mono"
                />
                <button
                  type="submit"
                  disabled={totpLoading}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 text-sm"
                >
                  {totpLoading ? "Verifying..." : "Verify"}
                </button>
              </form>
            </div>
          )}

          {profile?.totp_enabled && !totpSetup && (
            <button
              onClick={handleDisable2FA}
              disabled={totpLoading}
              className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-5 py-2 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition disabled:opacity-50 text-sm"
            >
              {totpLoading ? "Disabling..." : "Disable 2FA"}
            </button>
          )}
        </section>

        {/* ── GitHub Connection ── */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">GitHub Connection</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Connect GitHub to analyze private repositories.
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${profile?.github_connected ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
              {profile?.github_connected ? "Connected" : "Not connected"}
            </span>
          </div>

          {patMsg && (
            <p className={`text-sm mb-4 ${patMsg.includes("success") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {patMsg}
            </p>
          )}

          <form onSubmit={handleSavePAT} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Personal Access Token
              </label>
              <input
                type="password"
                value={patToken}
                onChange={(e) => setPatToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono placeholder:font-sans focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Generate a token at{" "}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=CloudWise+AI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  github.com/settings/tokens
                </a>{" "}
                with{" "}
                <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-700 dark:text-slate-300">
                  repo
                </code>{" "}
                scope.
              </p>
            </div>
            <button
              type="submit"
              disabled={patSaving || !patToken.trim()}
              className="bg-slate-900 dark:bg-slate-700 text-white px-5 py-2 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition disabled:opacity-50 text-sm"
            >
              {patSaving ? "Saving..." : "Save Token"}
            </button>
          </form>
        </section>

        {/* ── Danger Zone ── */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/50 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Danger Zone</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">These actions are irreversible.</p>
          <button
            onClick={() => { if (confirm("Sign out and clear all session data?")) logout(); }}
            className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-5 py-2 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm"
          >
            Sign Out
          </button>
        </section>
      </div>
    </div>
  );
}
