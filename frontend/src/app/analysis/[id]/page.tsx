"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PillarScore {
  name: string;
  score: number;
  grade: string;
  findings_count: number;
  critical_count: number;
}

interface Finding {
  id: string;
  pillar: string;
  severity: string;
  title: string;
  description: string;
  file_path: string | null;
  line_number: number | null;
  recommendation: string;
}

interface AnalysisLog {
  id: string;
  agent_name: string;
  action: string;
  details: string;
  timestamp: string;
}

interface CloudService {
  provider: string;
  service: string;
  reason: string;
  estimated_monthly_cost: number;
  config: Record<string, any>;
}

interface ProviderComparison {
  provider: string;
  total_monthly_cost: number;
  score: number;
  pros: string[];
  cons: string[];
  services: CloudService[];
}

interface Report {
  id: string;
  project_name: string;
  status: string;
  overall_score: number | null;
  overall_grade: string | null;
  pillar_scores: PillarScore[] | null;
  findings: Finding[] | null;
  cloud_recommendations: ProviderComparison[] | null;
  deployment_guide: string | null;
  total_files: number;
  total_lines: number;
  languages: Record<string, number> | null;
  is_unlocked: boolean;
  top_findings: Finding[] | null;
  best_provider: string | null;
}

// ── Agent colour map — no emojis ──────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  Planner:          "text-violet-600 dark:text-violet-400",
  Security:         "text-red-600 dark:text-red-400",
  "Cloud Architect":"text-blue-600 dark:text-blue-400",
  "Quality Auditor":"text-amber-600 dark:text-amber-400",
  Critic:           "text-emerald-600 dark:text-emerald-400",
  Reporter:         "text-slate-600 dark:text-slate-300",
  System:           "text-slate-500 dark:text-slate-500",
};

const PIPELINE_AGENTS = [
  "Planner",
  "Security",
  "Cloud Architect",
  "Quality Auditor",
  "Critic",
  "Reporter",
] as const;

// ── Small helpers ─────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400",
    high:     "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-400",
    medium:   "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400",
    low:      "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
    info:     "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[severity] || styles.info}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function PillarBar({ pillar }: { pillar: PillarScore }) {
  const color =
    pillar.score >= 80 ? "bg-green-500"
    : pillar.score >= 60 ? "bg-yellow-500"
    : "bg-red-500";

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-36 text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">
        {pillar.name}
      </div>
      <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pillar.score}%` }}
        />
      </div>
      <div className="w-24 text-right text-sm font-semibold text-slate-900 dark:text-white">
        {pillar.score.toFixed(0)}/100 ({pillar.grade})
      </div>
      {pillar.critical_count > 0 && (
        <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">
          {pillar.critical_count} critical
        </span>
      )}
    </div>
  );
}

// ── Agent log panel (shared by processing + trace tab) ────────────────────────

function AgentLogPanel({ logs, isLive }: { logs: AnalysisLog[]; isLive: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="relative h-56 overflow-y-auto bg-slate-950 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-xs p-3 space-y-1">
      {/* Terminal chrome */}
      <div className="sticky top-0 left-0 right-0 flex items-center gap-1.5 mb-2 -mx-3 -mt-3 px-3 py-2 bg-slate-900 border-b border-slate-800">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        <span className="ml-2 text-slate-500 text-[10px]">agent-trace</span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            live
          </span>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="text-slate-600 italic">Initializing agents...</p>
      ) : (
        logs.map((log, idx) => {
          const isLatest = idx === logs.length - 1 && isLive;
          const color = AGENT_COLORS[log.agent_name] ?? AGENT_COLORS.System;

          return (
            <div key={log.id || idx} className="flex gap-2 leading-relaxed">
              <span className="text-slate-600 shrink-0 w-14 text-[10px] pt-0.5">
                {new Date(log.timestamp).toLocaleTimeString("en-US", {
                  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
                })}
              </span>
              <span className={`font-bold shrink-0 w-28 ${color}`}>
                [{log.agent_name}]
              </span>
              <span className="text-slate-400 shrink-0 w-24 italic">
                {log.action}
              </span>
              <span className="text-slate-300 break-all flex-1">
                {log.details || log.action}
                {isLatest && (
                  <span className="inline-block w-1.5 h-3 ml-0.5 bg-slate-300 align-middle animate-pulse" />
                )}
              </span>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Project structure panel shown during processing ───────────────────────────

function ProjectStructurePanel({ report }: { report: Report }) {
  const languages = report.languages ?? {};
  const totalLangLines = Object.values(languages).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {/* Stats */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Project Structure
        </p>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr>
              <td className="py-1.5 text-slate-500 dark:text-slate-400">Total files</td>
              <td className="py-1.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                {report.total_files}
              </td>
            </tr>
            <tr>
              <td className="py-1.5 text-slate-500 dark:text-slate-400">Total lines</td>
              <td className="py-1.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                {report.total_lines.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td className="py-1.5 text-slate-500 dark:text-slate-400">Languages</td>
              <td className="py-1.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                {Object.keys(languages).length}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tech stack */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Technology Stack
        </p>
        {Object.keys(languages).length === 0 ? (
          <p className="text-xs text-slate-400 italic">Detecting...</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(languages)
              .sort(([, a], [, b]) => b - a)
              .map(([lang, lines]) => {
                const pct = Math.round((lines / totalLangLines) * 100);
                return (
                  <div key={lang}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{lang}</span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {lines.toLocaleString()} lines ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pipeline status bar ───────────────────────────────────────────────────────

function PipelineStatusBar({ logs, isLive }: { logs: AnalysisLog[]; isLive: boolean }) {
  const activeAgents = new Set(logs.map((l) => l.agent_name));
  const lastAgent = logs[logs.length - 1]?.agent_name;

  return (
    <div className="flex items-center gap-1 flex-wrap mt-3">
      {PIPELINE_AGENTS.map((agent, idx) => {
        const isActive   = agent === lastAgent && isLive;
        const isDone     = activeAgents.has(agent) && !isActive;
        const isPending  = !isDone && !isActive;
        const color      = AGENT_COLORS[agent] ?? AGENT_COLORS.System;

        return (
          <div key={agent} className="flex items-center gap-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded border transition-all ${
                isActive
                  ? `border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400`
                  : isDone
                  ? `border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400`
                  : `border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-700`
              }`}
            >
              {isDone && <span className="mr-1 text-green-500">✓</span>}
              {agent}
              {isActive && (
                <span className="ml-1 inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </span>
            {idx < PIPELINE_AGENTS.length - 1 && (
              <span className="text-slate-300 dark:text-slate-700 text-xs">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalysisPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [logs, setLogs]     = useState<AnalysisLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "findings" | "cloud" | "deploy" | "trace">("overview");

  const token   = typeof window !== "undefined" ? sessionStorage.getItem("access_token") : null;
  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/analysis/${id}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: AnalysisLog[] = await res.json();
        if (data.length > 0) setLogs(data);
      }
    } catch {}
  }, [id, token, API_BASE]);

  useEffect(() => {
    if (!token) { router.push("/login"); return; }

    let interval: NodeJS.Timeout;

    const fetchReport = async () => {
      if (typeof window === "undefined") return;
      try {
        const data = await api(`/api/v1/analysis/${id}`, { token });
        setReport(data);
        setLoading(false);

        // Always poll logs — both during processing and after (for the trace tab)
        await fetchLogs();

        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      } catch {
        if (!report) router.push("/dashboard");
        setLoading(false);
      }
    };

    fetchReport();
    interval = setInterval(fetchReport, 1500);
    return () => clearInterval(interval);
  }, [id, token]);

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      await api(`/api/v1/analysis/${id}/unlock`, { method: "POST", token: token! });
      const data = await api(`/api/v1/analysis/${id}`, { token: token! });
      setReport(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to unlock");
    } finally {
      setUnlocking(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const isProcessing = report.status === "pending" || report.status === "processing";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Nav — unchanged from original */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              &#8592; Back
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">CW</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">CloudWise AI</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Processing state — stays inline, no dedicated page ── */}
        {isProcessing && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8 mb-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full shrink-0" />
              <div>
                <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300">
                  AI Agents Analyzing Your Code
                </h2>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  6 specialist agents are running in sequence. This usually takes 10–30 seconds.
                </p>
              </div>
            </div>

            {/* Pipeline step tracker */}
            <PipelineStatusBar logs={logs} isLive={true} />

            {/* Project structure + tech stack */}
            <ProjectStructurePanel report={report} />

            {/* Live agent trace */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Agent Activity
              </p>
              <AgentLogPanel logs={logs} isLive={true} />
            </div>
          </div>
        )}

        {/* ── Completed report ── */}
        {report.status === "completed" && (
          <>
            {/* Header with score */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-800 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                    {report.project_name}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                    <span>{report.total_files} files</span>
                    <span>{report.total_lines.toLocaleString()} lines</span>
                    {report.languages && (
                      <span>{Object.keys(report.languages).join(", ")}</span>
                    )}
                    {logs.length > 0 && (
                      <span className="text-blue-600 dark:text-blue-400">
                        {logs.length} agent events
                      </span>
                    )}
                  </div>
                </div>
                {report.overall_score !== null && (
                  <div className="text-center">
                    <div
                      className={`text-5xl font-bold ${
                        report.overall_score >= 80
                          ? "text-green-600 dark:text-green-400"
                          : report.overall_score >= 60
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {report.overall_score.toFixed(0)}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Grade {report.overall_grade}
                    </div>
                  </div>
                )}
              </div>

              {/* 7-pillar bars */}
              {report.pillar_scores && (
                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                  <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                    7-Pillar Analysis
                  </h2>
                  {report.pillar_scores.map((p) => (
                    <PillarBar key={p.name} pillar={p} />
                  ))}
                </div>
              )}
            </div>

            {/* Unlock banner */}
            {!report.is_unlocked && (
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                      Unlock Full Report
                    </h3>
                    <p className="text-blue-100">
                      Get all findings, cloud configurations, cost projections, and step-by-step deployment guide.
                    </p>
                  </div>
                  <button
                    onClick={handleUnlock}
                    disabled={unlocking}
                    className="bg-white text-blue-600 px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-50 transition disabled:opacity-50 shrink-0"
                  >
                    {unlocking ? "Unlocking..." : "Unlock Report — $9.99"}
                  </button>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-white dark:bg-slate-900 rounded-t-xl border border-b-0 border-slate-200 dark:border-slate-800 p-1 mb-0">
              {(["overview", "findings", "cloud", "deploy", "trace"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === tab
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {tab === "overview"  ? "Overview"
                   : tab === "findings" ? "Findings"
                   : tab === "cloud"    ? "Cloud Recommendations"
                   : tab === "deploy"   ? "Deployment Guide"
                   :                     "Agent Trace"}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-b-xl border border-slate-200 dark:border-slate-800 p-6">

              {/* Overview */}
              {activeTab === "overview" && (
                <div>
                  {/* Project structure + stack */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                      Project Summary
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Structure stats */}
                      <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Structure
                        </p>
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            <tr>
                              <td className="py-1.5 text-slate-500 dark:text-slate-400">Files scanned</td>
                              <td className="py-1.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                                {report.total_files}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-slate-500 dark:text-slate-400">Lines of code</td>
                              <td className="py-1.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                                {report.total_lines.toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Tech stack */}
                      <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Technology Stack
                        </p>
                        {report.languages && Object.keys(report.languages).length > 0 ? (
                          <div className="space-y-2">
                            {Object.entries(report.languages)
                              .sort(([, a], [, b]) => b - a)
                              .map(([lang, lines]) => {
                                const total = Object.values(report.languages!).reduce((a, b) => a + b, 1);
                                const pct = Math.round((lines / total) * 100);
                                return (
                                  <div key={lang}>
                                    <div className="flex justify-between text-xs mb-0.5">
                                      <span className="font-medium text-slate-700 dark:text-slate-300">{lang}</span>
                                      <span className="text-slate-400 font-mono">{pct}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-600 rounded-full"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No language data</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Free Preview — Top Findings
                  </h3>
                  {report.top_findings && report.top_findings.length > 0 ? (
                    <div className="space-y-3">
                      {report.top_findings.map((f) => (
                        <div key={f.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <SeverityBadge severity={f.severity} />
                            <span className="text-xs text-slate-400">{f.pillar}</span>
                          </div>
                          <h4 className="font-semibold text-slate-900 dark:text-white">{f.title}</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{f.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400">No preview findings.</p>
                  )}

                  {report.best_provider && (
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <h4 className="font-semibold text-green-900 dark:text-green-300">
                        Best Cloud Provider: {report.best_provider}
                      </h4>
                      <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                        Based on your code analysis, {report.best_provider} offers the best value for your project.
                        Unlock the full report to see the complete comparison.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Findings */}
              {activeTab === "findings" && (
                <div>
                  {report.is_unlocked && report.findings ? (
                    <div className="space-y-3">
                      {report.findings.map((f) => (
                        <div key={f.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <SeverityBadge severity={f.severity} />
                            <span className="text-xs text-slate-400">{f.pillar}</span>
                            {f.file_path && (
                              <span className="text-xs font-mono text-slate-400">
                                {f.file_path}{f.line_number ? `:${f.line_number}` : ""}
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-slate-900 dark:text-white">{f.title}</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{f.description}</p>
                          <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mb-1">
                              Recommendation
                            </h5>
                            <p className="text-sm text-blue-900 dark:text-blue-300">{f.recommendation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-slate-500 dark:text-slate-400 text-lg">
                        Unlock the full report to see all findings
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Cloud */}
              {activeTab === "cloud" && (
                <div>
                  {report.is_unlocked && report.cloud_recommendations ? (
                    <div className="space-y-6">
                      {report.cloud_recommendations.map((provider, idx) => (
                        <div
                          key={provider.provider}
                          className={`border rounded-xl p-6 ${
                            idx === 0
                              ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                {idx === 0 && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-5 h-5 inline-block mr-1 text-yellow-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                                    />
                                  </svg>
                                )}
                                {provider.provider}
                              </h3>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Score: {provider.score}/100 · Est. ${provider.total_monthly_cost}/mo
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">Pros</h4>
                              <ul className="space-y-1">
                                {provider.pros.map((p, i) => (
                                  <li key={i} className="text-sm text-slate-600 dark:text-slate-400">&#10003; {p}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Cons</h4>
                              <ul className="space-y-1">
                                {provider.cons.map((c, i) => (
                                  <li key={i} className="text-sm text-slate-600 dark:text-slate-400">&#10007; {c}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Recommended Services
                          </h4>
                          <div className="grid gap-2">
                            {provider.services.map((s, si) => (
                              <div key={si} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h5 className="font-medium text-slate-900 dark:text-white">{s.service}</h5>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.reason}</p>
                                  </div>
                                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                    ${s.estimated_monthly_cost}/mo
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-slate-500 dark:text-slate-400 text-lg">
                        Unlock the full report to see cloud recommendations
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Deploy */}
              {activeTab === "deploy" && (
                <div>
                  {report.is_unlocked && report.deployment_guide ? (
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                      <pre className="bg-slate-900 text-slate-100 p-6 rounded-lg overflow-auto text-sm whitespace-pre-wrap">
                        {report.deployment_guide}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-slate-500 dark:text-slate-400 text-lg">
                        Unlock the full report to see the deployment guide
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Trace tab */}
              {activeTab === "trace" && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                      Agent Trace
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Full activity log from all specialist agents during this analysis run.
                    </p>
                  </div>

                  {/* Per-agent event counts */}
                  {logs.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                      {Object.entries(
                        logs.reduce((acc, log) => {
                          acc[log.agent_name] = (acc[log.agent_name] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([agent, count]) => (
                        <div
                          key={agent}
                          className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-center"
                        >
                          <p className={`text-xs font-bold ${AGENT_COLORS[agent] ?? AGENT_COLORS.System}`}>
                            {agent}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{count} events</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {logs.length === 0 ? (
                    <p className="text-slate-400 text-sm italic">No agent trace available for this analysis.</p>
                  ) : (
                    <AgentLogPanel logs={logs} isLive={false} />
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Failed state ── */}
        {report.status === "failed" && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8">
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-300 mb-2">
              Analysis Failed
            </h2>
            <p className="text-red-700 dark:text-red-400 mb-4">
              The agent pipeline could not complete the analysis. Please try again.
            </p>
            {logs.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Agent trace at time of failure
                </p>
                <AgentLogPanel logs={logs} isLive={false} />
              </div>
            )}
            <Link
              href="/dashboard"
              className="inline-block bg-red-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Back to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
