"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Trash2, Edit, Plus, Upload, Play, RefreshCw, Key, FileText, Settings, Database, Server } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";

interface Stats {
  total_users: number;
  total_analyses: number;
  average_score: number;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  details: string | null;
  ip_address: string | null;
  timestamp: string;
}

interface LLMProvider {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  api_key: string;
  models: string[];
  is_active: boolean;
  priority: number;
}

interface RAGDocument {
  id: string;
  filename: string;
  file_type: string;
  upload_date: string;
  status: string;
  chunk_count: number;
}

export default function AdminPage() {
  const { token, loading: authLoading } = useAuth({ requireAuth: true, requireAdmin: true });
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  
  const [tab, setTab] = useState<"overview" | "users" | "logs" | "llm" | "rag">("overview");
  const [loading, setLoading] = useState(true);

  // Form states
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [providerForm, setProviderForm] = useState({
    name: "",
    provider_type: "openai",
    base_url: "",
    api_key: "",
    models: "",
    priority: 10
  });

  const [uploadingDoc, setUploadingDoc] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [s, u, l, p, d] = await Promise.all([
        api("/api/v1/admin/stats", { token }),
        api("/api/v1/admin/users?limit=50", { token }),
        api("/api/v1/admin/audit-logs?limit=50", { token }),
        api("/api/v1/config/llm", { token }),
        api("/api/v1/admin/rag/documents", { token })
      ]);
      setStats(s);
      setUsers(u.users || u);
      setLogs(l.logs || l);
      setProviders(p);
      setDocuments(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading || !token) return;
    loadData();
  }, [authLoading, token, loadData]);

  const handleSaveProvider = async () => {
    try {
      const payload = {
        ...providerForm,
        models: providerForm.models.split(",").map(m => m.trim())
      };
      
      if (editingProvider) {
        await api(`/api/v1/config/llm/${editingProvider.id}`, {
          method: "PUT",
          token: token!,
          body: payload
        });
      } else {
        await api("/api/v1/config/llm", {
          method: "POST",
          token: token!,
          body: payload
        });
      }
      
      setShowProviderForm(false);
      setEditingProvider(null);
      setProviderForm({ name: "", provider_type: "openai", base_url: "", api_key: "", models: "", priority: 10 });
      loadData();
    } catch (e) {
      toast.error("Failed to save provider");
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api(`/api/v1/config/llm/${id}`, { method: "DELETE", token: token! });
      loadData();
    } catch (e) {
      toast.error("Failed to delete provider");
    }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append("file", e.target.files[0]);

    try {
      // Need a custom fetch here because api wrapper assumes JSON
      const res = await fetch("http://localhost:8000/api/v1/admin/rag/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });
      if (!res.ok) throw new Error("Upload failed");
      loadData();
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleIndexDoc = async (id: string) => {
    try {
      await api(`/api/v1/admin/rag/${id}/index`, { method: "POST", token: token! });
      toast.success("Indexing started in background");
      loadData();
    } catch (e) {
      toast.error("Failed to start indexing");
    }
  };

  if (authLoading || (loading && !stats)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white group flex items-center gap-1">
              <span className="group-hover:-translate-x-1 transition-transform">←</span> Dashboard
            </Link>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm">CW</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">Admin Panel</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: "overview", label: "Overview", icon: RefreshCw },
            { id: "users", label: "Users", icon: UserIcon },
            { id: "logs", label: "Audit Logs", icon: FileText },
            { id: "llm", label: "AI Models", icon: Server },
            { id: "rag", label: "Knolwedge Base", icon: Database },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === item.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="space-y-6">
          
          {/* Overview Tab */}
          {tab === "overview" && stats && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-500">
              <StatCard label="Total Users" value={stats.total_users} icon={UserIcon} color="blue" />
              <StatCard label="Total Analyses" value={stats.total_analyses} icon={FileText} color="purple" />
              <StatCard label="Avg. Score" value={stats.average_score?.toFixed(1) || "N/A"} icon={RefreshCw} color="green" />
            </div>
          )}

          {/* LLM Providers Tab */}
          {tab === "llm" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Server className="text-blue-600" size={20} />
                  LLM Providers
                </h3>
                <button 
                  onClick={() => {
                    setEditingProvider(null);
                    setProviderForm({ name: "", provider_type: "openai", base_url: "", api_key: "", models: "", priority: 10 });
                    setShowProviderForm(true);
                  }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors shadow-sm"
                >
                  <Plus size={16} /> Add Provider
                </button>
              </div>
              
              {showProviderForm && (
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  <div className="grid grid-cols-2 gap-4 max-w-2xl">
                    <input 
                      placeholder="Provider Name (e.g. Groq)" 
                      className="border dark:border-slate-700 p-2 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                      value={providerForm.name}
                      onChange={e => setProviderForm({...providerForm, name: e.target.value})}
                    />
                    <select 
                      className="border dark:border-slate-700 p-2 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      value={providerForm.provider_type}
                      onChange={e => setProviderForm({...providerForm, provider_type: e.target.value})}
                    >
                      <option value="openai">OpenAI Compatible</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                    <input 
                      placeholder="Base URL" 
                      className="border dark:border-slate-700 p-2 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                      value={providerForm.base_url}
                      onChange={e => setProviderForm({...providerForm, base_url: e.target.value})}
                    />
                    <input 
                      placeholder="API Key" 
                      type="password"
                      className="border dark:border-slate-700 p-2 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                      value={providerForm.api_key}
                      onChange={e => setProviderForm({...providerForm, api_key: e.target.value})}
                    />
                    <input 
                      placeholder="Models (comma separated)" 
                      className="border dark:border-slate-700 p-2 rounded-lg text-sm col-span-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                      value={providerForm.models}
                      onChange={e => setProviderForm({...providerForm, models: e.target.value})}
                    />
                    <div className="col-span-2 flex gap-2 justify-end mt-2">
                       <button onClick={() => setShowProviderForm(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                       <button onClick={handleSaveProvider} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {providers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">No providers configured yet.</div>
                ) : (
                  providers.map(p => (
                    <div key={p.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex justify-between items-center group">
                      <div className="flex items-start gap-3">
                         <div className={`mt-1 w-2 h-2 rounded-full ${p.is_active ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                         <div>
                           <div className="font-semibold text-slate-900 dark:text-white">{p.name}</div>
                           <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{p.base_url || "Default URL"}</div>
                           <div className="flex gap-1 mt-2">
                              {p.models.map(m => (
                                <span key={m} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[10px] font-medium border border-blue-100 dark:border-blue-800">{m}</span>
                              ))}
                           </div>
                         </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingProvider(p);
                            setProviderForm({ 
                              name: p.name, 
                              provider_type: p.provider_type, 
                              base_url: p.base_url, 
                              api_key: p.api_key, 
                              models: p.models.join(", "), 
                              priority: p.priority 
                            });
                            setShowProviderForm(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProvider(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* RAG Documents Tab */}
          {tab === "rag" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
               <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Database className="text-purple-600" size={20} />
                  Knowledge Base
                </h3>
                <label className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors shadow-sm cursor-pointer">
                  {uploadingDoc ? <RefreshCw className="animate-spin" size={16} /> : <Upload size={16} />}
                  <span>Upload Document</span>
                  <input type="file" className="hidden" onChange={handleUploadDoc} accept=".md,.txt,.pdf,.json" disabled={uploadingDoc} />
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                      <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Filename</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Type</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Status</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Chunks</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {documents.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">No documents uploaded.</td></tr>
                    ) : (
                      documents.map(doc => (
                        <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{doc.filename}</td>
                          <td className="px-6 py-3 text-slate-500 dark:text-slate-400 uppercase text-xs">{doc.file_type}</td>
                          <td className="px-6 py-3">
                            <DocumentStatusBadge status={doc.status} />
                          </td>
                          <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{doc.chunk_count}</td>
                          <td className="px-6 py-3 text-right">
                             {doc.status !== 'indexed' && (
                               <button 
                                 onClick={() => handleIndexDoc(doc.id)}
                                 className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded bg-blue-50 border border-blue-100"
                               >
                                 Index Now
                               </button>
                             )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Default Users & Logs Content (Basic Render) */}
          {tab === "users" && <UsersTable users={users} />}
          {tab === "logs" && <LogsList logs={logs} />}

        </div>
      </div>
    </div>
  );
}

// Components
function StatCard({ label, value, icon: Icon, color }: any) {
  const colors = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm">
      <div>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</div>
        <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color] || colors.blue}`}>
        <Icon size={24} />
      </div>
    </div>
  );
}

function DocumentStatusBadge({ status }: { status: string }) {
  const styles = {
    indexed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    failed: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
    uploaded: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.uploaded}`}>
      {status}
    </span>
  );
}

function UserIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  )
}

function UsersTable({ users }: { users: User[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-left">
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Name</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Email</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Role</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Active</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
             {users.map(u => (
               <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                 <td className="px-6 py-3 text-sm font-medium text-slate-900 dark:text-white">{u.full_name}</td>
                 <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{u.email}</td>
                 <td className="px-6 py-3"><span className={`text-xs px-2 py-1 rounded-md font-medium ${u.role==='admin'?'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{u.role}</span></td>
                 <td className="px-6 py-3"><div className={`w-2.5 h-2.5 rounded-full ${u.is_active?'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]':'bg-red-500'}`} /></td>
                 <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LogsList({ logs }: { logs: AuditLog[] }) {
    if (logs.length === 0) return <div className="bg-white dark:bg-slate-900 p-8 text-center text-slate-500 dark:text-slate-400 rounded-xl border dark:border-slate-800">No logs found.</div>
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {logs.map(l => (
                    <div key={l.id} className="px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                             <FileText size={14} />
                           </div>
                           <div>
                             <p className="text-sm font-medium text-slate-900 dark:text-white">
                               {l.action} <span className="text-slate-400 dark:text-slate-500 font-normal">on</span> {l.resource}
                             </p>
                             {l.details && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{l.details}</p>}
                           </div>
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                            {new Date(l.timestamp).toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}