import { Users, Mail } from "lucide-react";
import { User } from "@/types/admin";

interface AdminUsersProps {
  users: User[];
}

export function AdminUsers({ users }: AdminUsersProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white"><Users className="text-blue-600" /> User Management</h2>
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full text-sm font-medium">
             Total: {users.length}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
             <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-xs font-semibold">
                <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Joined</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                 {users.map(u => (
                 <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                     <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold shrink-0">
                             {u.full_name ? u.full_name[0].toUpperCase() : u.email[0].toUpperCase()}
                         </div>
                         <div>
                             <p className="font-medium text-slate-900 dark:text-white">{u.full_name || 'No Name'}</p>
                             <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                 <Mail className="w-3 h-3" /> {u.email}
                             </div>
                         </div>
                     </div>
                     </td>
                     <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${
                            u.role === 'admin' 
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                        {u.role}
                        </span>
                     </td>
                     <td className="px-6 py-4">
                        {u.is_active ? 
                           <span className="text-green-600 dark:text-green-400 text-xs font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active</span> 
                           : <span className="text-slate-400 text-xs font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactive</span>
                        }
                     </td>
                     <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                     </td>
                     <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-blue-600 text-sm font-medium transition-colors">Manage</button>
                     </td>
                 </tr>
                 ))}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
