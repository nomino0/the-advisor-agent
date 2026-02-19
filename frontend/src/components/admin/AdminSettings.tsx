import { Settings, Shield } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface AdminSettingsProps {
  token: string | null;
}

export function AdminSettings({ token }: AdminSettingsProps) {
  return (
    <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
        <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white"><Settings className="w-6 h-6 text-slate-500" /> Admin Settings</h2>
        <p className="text-slate-500 mt-1">Manage your administrator account security.</p>
        </div>
        
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">Change Password</h3>
        </div>
        <div className="p-6">
            <form 
                onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const currentInput = form.elements.namedItem('current_password') as HTMLInputElement;
                    const newPassInput = form.elements.namedItem('new_password') as HTMLInputElement;
                    const current = currentInput.value;
                    const newPass = newPassInput.value;
                    
                    if (newPass.length < 8) {
                        toast.error("Password must be at least 8 characters");
                        return;
                    }

                    try {
                        await api("/api/v1/user/password", {
                            method: "PUT",
                            token: token!,
                            body: { current_password: current, new_password: newPass },
                        });
                        toast.success("Password updated successfully");
                        currentInput.value = "";
                        newPassInput.value = "";
                    } catch (e: any) {
                        toast.error(e.message || "Failed to update password");
                    }
                }}
                className="space-y-4 max-w-md"
            >
                <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Current Password</label>
                    <input 
                        name="current_password"
                        type="password" 
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-slate-900 dark:text-white"
                        required 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">New Password</label>
                    <input 
                        name="new_password"
                        type="password" 
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-slate-900 dark:text-white"
                        required
                        minLength={8}
                    />
                    <p className="text-xs text-slate-500 mt-1">Must be at least 8 characters long.</p>
                </div>
                <div className="pt-2">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-transform active:scale-95">
                        <Shield className="w-4 h-4" /> Update Password
                    </button>
                </div>
            </form>
        </div>
        </div>
    </div>
  );
}
