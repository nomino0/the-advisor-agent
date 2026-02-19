"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
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

  // PAT / GitHub
  const [patToken, setPatToken] = useState("");
  const [patSaving, setPatSaving] = useState(false);

  // Account info
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);

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

  // ── GitHub PAT ─────────────────────────────────────────────────────────────

  const handleSavePAT = async (e: React.FormEvent) => {
    e.preventDefault();
    setPatSaving(true);
    try {
      await api("/api/v1/user/github/pat", {
        method: "POST",
        token: token!,
        body: { token: patToken },
      });
      toast.success("GitHub token saved successfully!");
      setPatToken("");
      setProfile((p) => (p ? { ...p, github_connected: true } : p));
    } catch (e: any) {
      toast.error(e.message || "Invalid token");
    } finally {
      setPatSaving(false);
    }
  };

  // ── Account ────────────────────────────────────────────────────────────────

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/v1/user/profile", {
        method: "PUT",
        token: token!,
        body: { full_name: fullName },
      });
      toast.success("Saved!");
      setProfile((p) => (p ? { ...p, full_name: fullName } : p));
      const stored = sessionStorage.getItem("user");
      if (stored) {
        sessionStorage.setItem("user", JSON.stringify({ ...JSON.parse(stored), full_name: fullName }));
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPassLoading(true);
    try {
      await api("/api/v1/user/password", {
        method: "PUT",
        token: token!,
        body: { current_password: currentPassword, new_password: newPassword },
      });
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e: any) {
      toast.error(e.message || "Failed to update password");
    } finally {
      setPassLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

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
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 text-sm"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
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

          {!profile?.totp_enabled && (
            <Link
              href="/2fa-setup"
              className="inline-block bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition text-sm"
            >
              Setup 2FA
            </Link>
          )}
        </section>

        {/* ── Security: Password ── */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Change Password</h2>
          <form className="space-y-4" onSubmit={handlePasswordChange}>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition" required minLength={8} />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Must be at least 8 characters.</p>
            </div>
            <button type="submit" disabled={passLoading || !currentPassword || !newPassword} className="bg-slate-900 dark:bg-slate-700 text-white px-5 py-2 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition disabled:opacity-50 text-sm">
              {passLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>

        {/* ── GitHub Connection ── */}
        {profile?.role !== 'admin' && (
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
        )}

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
