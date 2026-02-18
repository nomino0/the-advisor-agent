"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeProvider";

interface Analysis {
  id: string;
  project_name: string;
  status: string;
  source_type: string;
  total_files: number;
  total_lines: number;
  languages: Record<string, number> | null;
  overall_score: number | null;
  is_unlocked: boolean;
  created_at: string;
  completed_at: string | null;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400">—</span>;
  const grade =
    score >= 90
      ? "A"
      : score >= 80
      ? "B"
      : score >= 70
      ? "C"
      : score >= 60
      ? "D"
      : "F";
  const color =
    score >= 80
      ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400"
      : score >= 60
      ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400"
      : "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400";

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold ${color}`}>
      {score.toFixed(0)}/100 ({grade})
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
    processing: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
    completed: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400",
    failed: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
      {status === "processing" ? "Processing..." : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const fetchAnalyses = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/api/v1/analysis/history", { token });
      setAnalyses(data.analyses);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser || !token) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(storedUser));
    fetchAnalyses().finally(() => setLoading(false));

    const interval = setInterval(fetchAnalyses, 5000);
    return () => clearInterval(interval);
  }, [router, token, fetchAnalyses]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CW</span>
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">CloudWise AI</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {user?.full_name || user?.email}
            </span>
            <Link
              href="/settings"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              Settings
            </Link>
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                Admin Panel
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Your code analyses and cloud recommendations
            </p>
          </div>
          <button
            onClick={() => router.push("/new-analysis")}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2"
          >
            <span className="text-lg">+</span> New Analysis
          </button>
        </div>

        {/* Analyses List */}
        {analyses.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-16 border border-slate-200 dark:border-slate-800 text-center">
            <div className="mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              No analyses yet
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Start a new analysis to get your first cloud optimization report.
            </p>
            <button
              onClick={() => router.push("/new-analysis")}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              New Analysis
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {analyses.map((a) => (
              <Link
                key={a.id}
                href={`/analysis/${a.id}`}
                className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition block"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {a.project_name}
                      </h3>
                      <StatusBadge status={a.status} />
                      {a.is_unlocked && (
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">
                          Full Report
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                      <span>{a.total_files} files</span>
                      <span>{a.total_lines.toLocaleString()} lines</span>
                      {a.languages && (
                        <span>{Object.keys(a.languages).join(", ")}</span>
                      )}
                      <span>
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ScoreBadge score={a.overall_score} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
