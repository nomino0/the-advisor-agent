"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { AdminNavbar } from "@/components/admin/AdminNavbar";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminAgents } from "@/components/admin/AdminAgents";
import { AdminKnowledgeBase } from "@/components/admin/AdminKnowledgeBase";
import { AdminMonitoring } from "@/components/admin/AdminMonitoring";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { 
  Stats, User, AuditLog, LLMProvider, RAGDocument, Agent, KnowledgeBase 
} from "@/types/admin";

// --- Mock Data ---

const MOCK_AGENTS: Agent[] = [
  { 
    id: "1", name: "Planner Agent", type: "planner", status: "idle", llm_provider_id: "openai", 
    stats: { tasks_completed: 124, avg_response_time: 1.2 } 
  },
  { 
    id: "2", name: "Security Auditor", type: "security", status: "busy", current_task: "Scanning auth.py for vulnerabilities...", llm_provider_id: "anthropic", 
    stats: { tasks_completed: 89, avg_response_time: 2.5 } 
  },
  { 
    id: "3", name: "Cloud Architect", type: "cloud", status: "idle", llm_provider_id: "gemini", 
    stats: { tasks_completed: 45, avg_response_time: 1.8 } 
  },
  { 
    id: "4", name: "Report Generator", type: "reporter", status: "idle", llm_provider_id: "openai", 
    stats: { tasks_completed: 120, avg_response_time: 0.8 } 
  },
];

export default function AdminPage() {
  const { token, loading: authLoading, logout } = useAuth({ requireAuth: true, requireAdmin: true });
  
  // Data State
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  
  const [tab, setTab] = useState<"overview" | "agents" | "kb" | "monitoring" | "users" | "settings">("overview");
  const [loading, setLoading] = useState(true);

  // --- Data Loading ---
  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      // Fetch core data in parallel
      const [s, u, l, p, d, kb] = await Promise.all([
        api("/api/v1/admin/stats", { token }).catch(() => null),
        api("/api/v1/admin/users?limit=50", { token }).catch(() => ({ users: [] })),
        api("/api/v1/admin/audit-logs?limit=50", { token }).catch(() => ({ logs: [] })),
        api("/api/v1/config/llm", { token }).catch(() => []),
        api("/api/v1/admin/rag/documents", { token }).catch(() => []),
        api("/api/v1/config/kb", { token }).catch(() => []) 
      ]);
      
      setStats(s);
      setUsers(u.users || u || []);
      setAuditLogs(l.logs || l || []);
      setProviders(p || []);
      setDocuments(d || []);
      setKnowledgeBases(Array.isArray(kb) ? kb : []);
      
    } catch (e) {
      console.error("Failed to load admin data", e);
      toast.error("Some data failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (token) loadData();
  }, [authLoading, token, loadData]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <AdminNavbar activeTab={tab} setActiveTab={setTab} onLogout={logout} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === "overview" && (
          <AdminOverview 
            stats={stats} 
            agents={agents} 
            knowledgeBases={knowledgeBases} 
            auditLogs={auditLogs}
            setTab={setTab}
          />
        )}

        {tab === "agents" && (
          <AdminAgents 
            agents={agents} 
            providers={providers} 
            token={token} 
            loadData={loadData}
          />
        )}

        {tab === "kb" && (
          <AdminKnowledgeBase 
            knowledgeBases={knowledgeBases} 
            documents={documents} 
            token={token} 
            loadData={loadData}
          />
        )}

        {tab === "monitoring" && (
          <AdminMonitoring 
            auditLogs={auditLogs} 
            users={users}
          />
        )}
        
        {tab === "users" && (
          <AdminUsers users={users} />
        )}

        {tab === "settings" && (
            <AdminSettings token={token} />
        )}

      </main>
    </div>
  );
}
