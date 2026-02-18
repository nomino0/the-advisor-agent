"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const { token, user } = useAuth({ requireAuth: true });
  
  const [totpSetup, setTotpSetup] = useState<{ qr_code: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Auto-start setup or fetch current status
  useEffect(() => {
    if (!token) return;
    // If already enabled, maybe redirect or show status?
    // For now, let's allow re-setup or just showing the setup UI.
    // If the user lands here, they probably want to setup 2FA.
    
    // Check if 2FA is already enabled to warn/redirect?
    // The user object in useAuth might be stale, but let's trust it for a quick check or fetch fresh.
    if (user?.totp_enabled) {
        // Option: Redirect back to settings if already enabled? 
        // Or allow re-configuring (which overwrites the old secret).
        // Let's just show the UI for now, maybe with a warning or just standard flow.
    }
  }, [token, user]);

  const handleStartSetup = async () => {
    setLoading(true);
    try {
      const data = await api("/api/v1/auth/2fa/setup", { method: "POST", token: token! });
      setTotpSetup(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to start 2FA setup");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    try {
      await api("/api/v1/auth/2fa/verify", {
        method: "POST",
        token: token!,
        body: { token: totpCode },
      });
      toast.success("2FA enabled successfully!");
      
      // Update local storage/session user data
      const stored = sessionStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        u.totp_enabled = true;
        sessionStorage.setItem("user", JSON.stringify(u));
      }
      
      // Redirect back to settings or dashboard
      router.push("/settings");
    } catch (e: any) {
      toast.error(e.message || "Invalid code");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition text-sm"
            >
              &#8592; Settings
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">2FA Setup</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Secure your account
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Two-factor authentication adds an extra layer of security to your account.
            </p>
          </div>

          {!totpSetup ? (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-lg text-sm">
                You will need an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator.
              </div>
              <button
                onClick={handleStartSetup}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? "Preparing..." : "Start Setup"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-slate-200 dark:border-slate-800">
                 {totpSetup.qr_code && (
                  <img
                    src={`data:image/png;base64,${totpSetup.qr_code}`}
                    alt="2FA QR Code"
                    className="w-48 h-48 rounded dark:mix-blend-multiply" 
                    // Note: dark mode might need background adjustment for QR to be readable if transparent, 
                    // but base64 usually sends white background. 
                    // Safe bet is to put a white bg container if needed.
                    style={{ background: 'white', padding: '10px' }}
                  />
                )}
              </div>
              
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  Or enter this code manually:
                </p>
                <code className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-sm font-mono select-all">
                  {totpSetup.secret}
                </code>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center font-mono text-lg tracking-widest focus:ring-2 focus:ring-blue-500 outline-none transition"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={verifying || totpCode.length !== 6}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {verifying ? "Verifying..." : "Enable 2FA"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
