import { Users, Bot, Database, Activity, Zap, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Agent, AuditLog, KnowledgeBase, Stats } from "@/types/admin";

interface AdminOverviewProps {
  stats: Stats | null;
  agents: Agent[];
  knowledgeBases: KnowledgeBase[];
  auditLogs: AuditLog[];
  setTab: (tab: any) => void;
}

export function AdminOverview({ stats, agents, knowledgeBases, auditLogs, setTab }: AdminOverviewProps) {
  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</h3>
        <div className={`p-2 rounded-lg ${color.bg} ${color.text}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        <div className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {subtext}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Users" 
          value={stats?.total_users || 0} 
          icon={Users} 
          color={{ bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400" }}
          subtext="+12% this week"
        />
        <StatCard 
          title="Active Agents" 
          value={agents.filter(a => a.status !== 'offline').length} 
          icon={Bot} 
          color={{ bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400" }}
          subtext="Running tasks"
        />
        <StatCard 
          title="Knowledge Sources" 
          value={knowledgeBases.length} 
          icon={Database} 
          color={{ bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400" }}
          subtext="Indexed & Ready"
        />
        <StatCard 
          title="System Health" 
          value="98%" 
          icon={Activity} 
          color={{ bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-600 dark:text-green-400" }}
          subtext="All systems go"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              Recent System Activity
            </h3>
            <button onClick={() => setTab("monitoring")} className="text-sm text-blue-600 hover:text-blue-500 font-medium flex items-center gap-1 group">
              View All <ArrowUpRight className="w-3 h-3 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px]">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.slice(0, 10).map(log => (
                <div key={log.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      log.action.includes("Error") || log.action.includes("Failed") ? "bg-red-500" : "bg-blue-500"
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{log.action}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{log.user_id ? 'User Action' : 'System Event'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</p>
                    <p className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="px-6 py-12 text-center text-slate-500 text-sm">No recent activity found</div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions / System Status */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-300" />
              Quick Actions
            </h3>
            <p className="text-blue-100 text-sm mb-6">Common administrative tasks for system maintenance.</p>
            <div className="space-y-3">
              <button onClick={() => setTab("agents")} className="w-full bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors flex items-center justify-between group">
                Configure Agents <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
              <button onClick={() => setTab("kb")} className="w-full bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors flex items-center justify-between group">
                Upload Documents <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
              <button onClick={() => setTab("users")} className="w-full bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors flex items-center justify-between group">
                Manage Users <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
