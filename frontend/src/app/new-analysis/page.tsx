"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Provider = "github" | "gitlab" | "google_drive" | "local";
type RepoVisibility = "public" | "private";
type TargetOS = "windows" | "macos" | "linux";
type GrantStep = "select-os" | "command" | "waiting" | "ready";

interface GitHubStatus {
  connected: boolean;
  provider_username?: string;
  scope?: string;
  connected_at?: string;
}

interface GrantData {
  token: string;
  expires_at: string;
  ttl_minutes: number;
  remaining_seconds: number;
  command: string;
  short_command: string;
  os: string;
  instructions: string;
  status: string;
}

interface GrantStatus {
  token: string;
  status: string;
  project_path: string | null;
  project_name: string | null;
  remaining_seconds: number;
  is_expired: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewAnalysisPage() {
  const router = useRouter();
  const { token } = useAuth({ requireAuth: true });
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Connect form state
  const [repoUrl, setRepoUrl] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");

  // GitHub-specific state
  const [repoVisibility, setRepoVisibility] =
    useState<RepoVisibility>("public");
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [ghStatusLoading, setGhStatusLoading] = useState(false);
  const [patToken, setPatToken] = useState("");
  const [patSaving, setPatSaving] = useState(false);
  const [showPatForm, setShowPatForm] = useState(false);

  // Grant Access state
  const [grantStep, setGrantStep] = useState<GrantStep>("select-os");
  const [targetOS, setTargetOS] = useState<TargetOS>("windows");
  const [grantData, setGrantData] = useState<GrantData | null>(null);
  const [grantStatus, setGrantStatus] = useState<GrantStatus | null>(null);
  const [commandCopied, setCommandCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // ------------------------------------------------------------------
  // GitHub connection check
  // ------------------------------------------------------------------

  const checkGitHubStatus = useCallback(async () => {
    if (!token) return;
    setGhStatusLoading(true);
    try {
      const data = await api("/api/v1/auth/github/status", {
        method: "GET",
        token,
      });
      setGithubStatus(data);
    } catch {
      setGithubStatus({ connected: false });
    } finally {
      setGhStatusLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (provider === "github") {
      checkGitHubStatus();
    }
  }, [provider, checkGitHubStatus]);

  // ------------------------------------------------------------------
  // Cleanup polling on unmount
  // ------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ------------------------------------------------------------------
  // GitHub OAuth
  // ------------------------------------------------------------------

  async function handleGitHubOAuth() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/v1/auth/github", {
        method: "GET",
        token,
      });
      if (data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        setError(
          "OAuth is not configured. Use a Personal Access Token instead."
        );
        setShowPatForm(true);
      }
    } catch (err: any) {
      if (err.message?.includes("not configured")) {
        setShowPatForm(true);
        setError(
          "GitHub OAuth App not configured. Use a Personal Access Token instead."
        );
      } else {
        setError(err.message || "Failed to start GitHub authorization");
      }
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------------
  // Save PAT
  // ------------------------------------------------------------------

  async function handleSavePAT(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !patToken.trim()) return;
    setPatSaving(true);
    setError("");
    try {
      await api("/api/v1/auth/github/pat", {
        method: "POST",
        body: { token: patToken.trim() },
        token,
      });
      setPatToken("");
      setShowPatForm(false);
      await checkGitHubStatus();
    } catch (err: any) {
      setError(err.message || "Invalid token");
    } finally {
      setPatSaving(false);
    }
  }

  // ------------------------------------------------------------------
  // Connect (GitHub / GitLab / Google Drive)
  // ------------------------------------------------------------------

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !provider) return;
    setLoading(true);
    setError("");

    try {
      const body: any = {
        provider,
        repo_url: repoUrl || undefined,
      };
      if (provider === "google_drive") {
        body.drive_folder_id = driveFolderId;
      }

      const data = await api("/api/v1/analysis/connect", {
        method: "POST",
        body,
        token,
      });
      router.push(`/analysis/${data.id}`);
    } catch (err: any) {
      setError(err.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------------
  // Grant Access flow
  // ------------------------------------------------------------------

  async function handleGenerateGrant() {
    if (!token) return;
    setLoading(true);
    setError("");
    setCommandCopied(false);

    try {
      const data: GrantData = await api("/api/v1/analysis/grant/generate", {
        method: "POST",
        body: { target_os: targetOS, ttl_minutes: 30 },
        token,
      });
      setGrantData(data);
      setCountdown(data.remaining_seconds);
      setGrantStep("command");

      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to generate access token");
    } finally {
      setLoading(false);
    }
  }

  function startPolling(grantToken: string) {
    setGrantStep("waiting");

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status: GrantStatus = await api(
          `/api/v1/analysis/grant/status/${grantToken}`,
          { method: "GET", token: token! }
        );
        setGrantStatus(status);

        if (status.status === "active") {
          if (pollRef.current) clearInterval(pollRef.current);
          setGrantStep("ready");
        } else if (status.is_expired || status.status === "expired") {
          if (pollRef.current) clearInterval(pollRef.current);
          setError("Access token has expired. Please generate a new one.");
          setGrantStep("select-os");
          setGrantData(null);
        }
      } catch {
        // Silent retry
      }
    }, 2000);
  }

  async function handleStartGrantScan() {
    if (!token || !grantData) return;
    setLoading(true);
    setError("");

    try {
      const data = await api(
        `/api/v1/analysis/grant/scan/${grantData.token}`,
        { method: "POST", token }
      );
      router.push(`/analysis/${data.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to start analysis");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyCommand() {
    if (!grantData) return;
    try {
      await navigator.clipboard.writeText(grantData.command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 3000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = grantData.command;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 3000);
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function resetGrantFlow() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setGrantStep("select-os");
    setGrantData(null);
    setGrantStatus(null);
    setCommandCopied(false);
    setCountdown(0);
    setError("");
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition"
          >
            &larr; Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CW</span>
            </div>
            <span className="font-bold text-slate-900 dark:text-white tracking-tight">
              New Analysis
            </span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* ============================================================= */}
        {/* Step 1: Provider Selection                                      */}
        {/* ============================================================= */}
        {!provider && (
          <div>
            <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2 tracking-tight">
              Connect Your Code
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-center mb-10 max-w-lg mx-auto">
              Your code stays on your machine. CloudWise AI connects
              peer-to-peer with read-only access. Select a source to begin.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* GitHub */}
              <button
                onClick={() => setProvider("github")}
                className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-blue-500/40 hover:bg-slate-50 dark:hover:bg-slate-900 transition duration-200"
              >
                <svg
                  className="w-10 h-10 text-slate-800 dark:text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z" />
                </svg>
                <span className="font-semibold text-slate-900 dark:text-white">GitHub</span>
                <span className="text-xs text-slate-500">
                  Public or private repository
                </span>
              </button>

              {/* GitLab */}
              <button
                onClick={() => setProvider("gitlab")}
                className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-orange-500/40 hover:bg-slate-50 dark:hover:bg-slate-900 transition duration-200"
              >
                <svg
                  className="w-10 h-10 text-orange-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
                </svg>
                <span className="font-semibold text-slate-900 dark:text-white">GitLab</span>
                <span className="text-xs text-slate-500 dark:text-slate-500">
                  Connect a GitLab repository
                </span>
              </button>

              {/* Google Drive */}
              <button
                onClick={() => setProvider("google_drive")}
                className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-green-500/40 hover:bg-slate-50 dark:hover:bg-slate-900 transition duration-200"
              >
                <svg
                  className="w-10 h-10 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M7.71 3.5L1.15 15l3.43 5.96h6.86l-3.43-5.96L7.71 3.5zm1.14 0l6.57 11.46H24l-3.43-5.96L14.29 3.5H8.85zM12 8.42L8.57 14.5h6.86L12 8.42zM1.14 15l3.43 5.96h13.14l-3.43-5.96H1.14z" />
                </svg>
                <span className="font-semibold text-slate-900 dark:text-white">Google Drive</span>
                <span className="text-xs text-slate-500">
                  Connect a Drive folder
                </span>
              </button>

              {/* Grant Access (P2P Local) */}
              <button
                onClick={() => setProvider("local")}
                className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-cyan-500/40 hover:bg-slate-50 dark:hover:bg-slate-900 transition duration-200"
              >
                <svg
                  className="w-10 h-10 text-cyan-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
                <span className="font-semibold text-slate-900 dark:text-white">Grant Access</span>
                <span className="text-xs text-slate-500">
                  Temporary read-only access via CLI
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* GitHub Provider Form                                            */}
        {/* ============================================================= */}
        {provider === "github" && (
          <div>
            <button
              onClick={() => {
                setProvider(null);
                setError("");
              }}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm mb-6 block transition"
            >
              &larr; Back to provider selection
            </button>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              Connect GitHub Repository
            </h2>

            {/* Visibility toggle */}
            <div className="flex gap-3 mb-6">
              <button
                type="button"
                onClick={() => setRepoVisibility("public")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                  repoVisibility === "public"
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600"
                }`}
              >
                Public Repo
              </button>
              <button
                type="button"
                onClick={() => setRepoVisibility("private")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                  repoVisibility === "private"
                    ? "border-purple-500 bg-purple-500/10 text-purple-400"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600"
                }`}
              >
                Private Repo
              </button>
            </div>

            {/* Private repo - GitHub connection panel */}
            {repoVisibility === "private" && (
              <div className="mb-6 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  GitHub Account Access
                </h3>

                {ghStatusLoading ? (
                  <p className="text-sm text-slate-500">
                    Checking connection...
                  </p>
                ) : githubStatus?.connected ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-green-400 font-medium">
                        Connected as{" "}
                        <span className="text-slate-900 dark:text-white">
                          {githubStatus.provider_username}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Your private repositories are accessible
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Connect your GitHub account to access private
                      repositories.
                    </p>

                    <button
                      type="button"
                      onClick={handleGitHubOAuth}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-medium py-2.5 rounded-lg transition disabled:opacity-50 text-sm"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z" />
                      </svg>
                      {loading ? "Redirecting..." : "Sign in with GitHub"}
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 border-t border-slate-300 dark:border-slate-700" />
                      <span className="text-xs text-slate-500">or</span>
                      <div className="flex-1 border-t border-slate-300 dark:border-slate-700" />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPatForm(!showPatForm)}
                      className="text-sm text-blue-400 hover:text-blue-300 transition"
                    >
                      {showPatForm
                        ? "Hide token form"
                        : "Use a Personal Access Token"}
                    </button>

                    {showPatForm && (
                      <form onSubmit={handleSavePAT} className="space-y-3">
                        <div>
                          <input
                            type="password"
                            value={patToken}
                            onChange={(e) => setPatToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            required
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                          />
                          <p className="text-xs text-slate-500 mt-1.5">
                            Generate a token at{" "}
                            <a
                              href="https://github.com/settings/tokens/new?scopes=repo&description=CloudWise+AI"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
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
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                        >
                          {patSaving ? "Validating..." : "Save Token"}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Repo URL form */}
            <form onSubmit={handleConnect} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Repository URL *
                </label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="https://github.com/owner/repo"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {repoVisibility === "public"
                    ? "Paste any public GitHub repository URL -- no authentication needed."
                    : "Paste your private repository URL -- requires GitHub account connection above."}
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  (repoVisibility === "private" && !githubStatus?.connected)
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? "Cloning and Analyzing..."
                  : "Connect and Start Analysis"}
              </button>

              {repoVisibility === "private" && !githubStatus?.connected && (
                <p className="text-xs text-amber-400 text-center">
                  Connect your GitHub account above to analyze private
                  repositories.
                </p>
              )}

              <div className="flex items-start gap-2 bg-green-50/60 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg p-3.5">
                <svg
                  className="w-4 h-4 text-green-400 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-700 dark:text-slate-300">
                    Peer-to-peer and ephemeral.
                  </strong>{" "}
                  Code is cloned into a secure sandbox, analyzed, then
                  permanently deleted. Nothing is stored on our servers.
                </p>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================= */}
        {/* GitLab / Google Drive Provider Form                             */}
        {/* ============================================================= */}
        {provider && provider !== "github" && provider !== "local" && (
          <div>
            <button
              onClick={() => {
                setProvider(null);
                setError("");
              }}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm mb-6 block transition"
            >
              &larr; Back to provider selection
            </button>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 capitalize">
              Connect{" "}
              {provider === "google_drive" ? "Google Drive" : provider}{" "}
              Repository
            </h2>

            <form onSubmit={handleConnect} className="space-y-5">
              {provider !== "google_drive" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Repository URL *
                  </label>
                  <input
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="https://gitlab.com/owner/repo"
                  />
                </div>
              )}

              {provider === "google_drive" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Drive Folder ID *
                  </label>
                  <input
                    type="text"
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="1A2B3C4D5E6F..."
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Found in the URL of your Google Drive folder.
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? "Connecting and Analyzing..."
                  : "Connect and Start Analysis"}
              </button>

              <p className="text-xs text-slate-500 text-center">
                CloudWise AI will connect peer-to-peer to your repository. Your
                code is never stored on our servers.
              </p>
            </form>
          </div>
        )}

        {/* ============================================================= */}
        {/* Grant Access (P2P Local Scan) Flow                              */}
        {/* ============================================================= */}
        {provider === "local" && (
          <div>
            <button
              onClick={() => {
                setProvider(null);
                resetGrantFlow();
              }}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm mb-6 block transition"
            >
              &larr; Back to provider selection
            </button>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
              Grant Read-Only Access
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-8">
              Generate a temporary access token, run the command on your
              machine, and CloudWise will analyze your project files. No
              uploads. No persistent storage. Token self-destructs after use.
            </p>

            {/* Progress steps */}
            <div className="flex items-center gap-0 mb-8">
              {(
                [
                  { step: "select-os" as GrantStep, label: "Select OS" },
                  { step: "command" as GrantStep, label: "Run Command" },
                  { step: "waiting" as GrantStep, label: "Waiting" },
                  { step: "ready" as GrantStep, label: "Analyze" },
                ] as const
              ).map((s, i, arr) => {
                const steps: GrantStep[] = [
                  "select-os",
                  "command",
                  "waiting",
                  "ready",
                ];
                const currentIdx = steps.indexOf(grantStep);
                const stepIdx = steps.indexOf(s.step);
                const isActive = stepIdx === currentIdx;
                const isDone = stepIdx < currentIdx;

                return (
                  <div key={s.step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          isDone
                            ? "bg-green-500 text-white"
                            : isActive
                            ? "bg-cyan-600 text-white ring-2 ring-cyan-400/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        {isDone ? (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span
                        className={`text-xs mt-1.5 transition-colors ${
                          isActive
                            ? "text-cyan-400 font-medium"
                            : isDone
                            ? "text-green-400"
                            : "text-slate-600"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <div
                        className={`h-px flex-1 mx-1 mt-[-1rem] transition-colors ${
                          stepIdx < currentIdx
                            ? "bg-green-500"
                            : "bg-slate-200 dark:bg-slate-800"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* ---- Step 1: Select OS ---- */}
            {grantStep === "select-os" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Select your operating system
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        {
                          os: "windows" as TargetOS,
                          label: "Windows",
                          sub: "PowerShell",
                        },
                        {
                          os: "macos" as TargetOS,
                          label: "macOS",
                          sub: "Terminal",
                        },
                        {
                          os: "linux" as TargetOS,
                          label: "Linux",
                          sub: "Terminal",
                        },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.os}
                        type="button"
                        onClick={() => setTargetOS(item.os)}
                        className={`p-4 rounded-xl border text-center transition duration-200 ${
                          targetOS === item.os
                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600"
                        }`}
                      >
                        <svg
                          className={`w-8 h-8 mx-auto mb-2 ${
                            targetOS === item.os
                              ? "text-cyan-400"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
                          />
                        </svg>
                        <div className="font-medium text-sm">{item.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item.sub}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleGenerateGrant}
                  disabled={loading}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Generating Token..." : "Generate Access Token"}
                </button>
              </div>
            )}

            {/* ---- Step 2: Command display ---- */}
            {grantStep === "command" && grantData && (
              <div className="space-y-6">
                {/* Token status bar */}
                <div className="flex items-center justify-between bg-green-50/60 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Token active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span
                      className={`text-sm font-mono ${
                        countdown < 120 ? "text-amber-400" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {formatTime(countdown)}
                    </span>
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Run this command in your{" "}
                    {targetOS === "windows" ? "PowerShell" : "terminal"}
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    {grantData.instructions}
                  </p>

                  {/* Command block */}
                  <div className="relative group">
                    <div className="bg-slate-900 dark:bg-slate-950 border border-slate-700 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
                      <pre className="whitespace-pre-wrap break-all leading-relaxed">
                        {grantData.command}
                      </pre>
                    </div>
                    <button
                      onClick={handleCopyCommand}
                      className={`absolute top-3 right-3 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                        commandCopied
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500"
                      }`}
                    >
                      {commandCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Security info */}
                <div className="bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/50 rounded-lg p-4 flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                    />
                  </svg>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Zero-Trust Security
                    </h4>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 mt-1 space-y-0.5">
                      <li>
                        -- Read-only access, no modifications to your files
                      </li>
                      <li>
                        -- Token self-destructs in {grantData.ttl_minutes}{" "}
                        minutes
                      </li>
                      <li>-- Single-use: consumed after analysis completes</li>
                      <li>
                        -- Your code is never uploaded or persisted on our
                        servers
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={resetGrantFlow}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => startPolling(grantData.token)}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2.5 rounded-lg transition"
                  >
                    I have run the command
                  </button>
                </div>
              </div>
            )}

            {/* ---- Step 3: Waiting for activation ---- */}
            {grantStep === "waiting" && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
                    <div className="relative w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-cyan-500/50 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-cyan-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                        />
                      </svg>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    Waiting for access grant
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Run the command in your terminal. CloudWise is listening for
                    the activation signal.
                  </p>

                  <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                      {formatTime(countdown)} remaining
                    </span>
                  </div>
                </div>

                <button
                  onClick={resetGrantFlow}
                  className="w-full py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500 transition"
                >
                  Cancel and start over
                </button>
              </div>
            )}

            {/* ---- Step 4: Ready to analyze ---- */}
            {grantStep === "ready" && grantStatus && (
              <div className="space-y-6">
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-7 h-7 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    Access Granted
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Read-only access to your project has been established.
                  </p>

                  <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 inline-block">
                    <div className="flex items-center gap-3 text-sm">
                      <svg
                        className="w-4 h-4 text-slate-400 dark:text-slate-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                        />
                      </svg>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {grantStatus.project_name || grantStatus.project_path}
                      </span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleStartGrantScan}
                  disabled={loading}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Starting Analysis..." : "Start Analysis"}
                </button>

                <p className="text-xs text-slate-500 dark:text-slate-500 text-center">
                  CloudWise will read your project files, analyze
                  infrastructure, security, and cloud readiness, then destroy
                  the access token.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
