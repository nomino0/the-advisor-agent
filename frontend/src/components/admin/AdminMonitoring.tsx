import { Shield, ExternalLink, Activity, Users } from "lucide-react";
import { AuditLog, User } from "@/types/admin";

interface AdminMonitoringProps {
  auditLogs: AuditLog[];
  users: User[];
}

export function AdminMonitoring({ auditLogs, users }: AdminMonitoringProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Shield className="text-blue-500" /> Security & Audit Logs
            </h2>
            <button 
            onClick={() => {
                const headers = ["ID", "Timestamp", "User", "IP", "Action", "Resource", "Details"];
                const csvContent = [
                    headers.join(","),
                    ...auditLogs.map(log => [
                        log.id,
                        new Date(log.timestamp).toISOString(),
                        log.user_id || "System",
                        log.ip_address || "Unknown",
                        `"${log.action}"`,
                        `"${log.resource}"`,
                        `"${(log.details || '').replace(/"/g, '""')}"`
                    ].join(","))
                ].join("\n");
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
            }}
            className="flex items-center gap-2 text-sm bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 shadow-sm font-medium"
            >
            <ExternalLink size={16} /> Export CSV
            </button>
        </div>
        
        {/* Security Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-xl border border-red-100 dark:border-red-900/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Shield size={60} />
            </div>
            <div className="relative z-10">
                <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Failed Logins (24h)</p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                    {auditLogs.filter(l => l.action.includes('fail') || l.action.includes('unauthorized')).length}
                </h3>
            </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-900/30 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users size={60} />
            </div>
            <div className="relative z-10">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Active Sessions</p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                    {users.filter(u => u.is_active).length}
                </h3>
            </div>
        </div>
            <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-xl border border-green-100 dark:border-green-900/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity size={60} />
            </div>
            <div className="relative z-10">
                <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">System Events</p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                    {auditLogs.length}
                </h3>
            </div>
        </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">User / IP</th>
                    <th className="px-6 py-4">Resource</th>
                    <th className="px-6 py-4">Details</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                {auditLogs.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-sans text-base">
                            <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            No audit logs found. System events will appear here.
                        </td>
                    </tr>
                ) : (
                    auditLogs.map(log => {
                        const isError = log.action.toLowerCase().includes('fail') || log.action.toLowerCase().includes('error') || log.action.toLowerCase().includes('denied');
                        const isAuth = log.action.toLowerCase().includes('login') || log.action.toLowerCase().includes('logout') || log.action.toLowerCase().includes('register');
                        
                        return (
                            <tr key={log.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isError ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                            <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString(undefined, {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                                })}
                            </td>
                            <td className="px-6 py-3 font-medium">
                                <span className={`px-2 py-1 rounded-md border text-[10px] uppercase font-bold tracking-wide ${
                                    isError ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' :
                                    isAuth ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' :
                                    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}>
                                    {log.action}
                                </span>
                            </td>
                            <td className="px-6 py-3">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                        {log.user_id ? (users.find(u => u.id === log.user_id)?.full_name || 'User') : 'System'}
                                    </span>
                                    <span className="text-slate-400 text-[10px]">{log.ip_address || 'Unknown IP'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{log.resource}</td>
                            <td className="px-6 py-3 text-slate-500 truncate max-w-xs" title={log.details || ''}>
                                {log.details || '-'}
                            </td>
                            </tr>
                        );
                    })
                )}
            </tbody>
            </table>
        </div>
        </div>
    </div>
  );
}
