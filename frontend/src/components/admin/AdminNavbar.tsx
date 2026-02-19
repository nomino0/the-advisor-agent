import { 
  LayoutDashboard, Users, Database, Activity, Bot, Settings, LogOut 
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeProvider";

interface AdminNavbarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
}

export function AdminNavbar({ activeTab, setActiveTab, onLogout }: AdminNavbarProps) {
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "agents", label: "Agents & LLMs", icon: Bot },
    { id: "kb", label: "Knowledge Base", icon: Database },
    { id: "monitoring", label: "Monitoring", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 sticky top-0 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-bold text-xl text-blue-600">CloudWise Admin</Link>
            <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
          </div>
          
          {/* Mobile menu button could go here */}
        </div>
        
        <div className="flex items-center gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-medium whitespace-nowrap ${
                activeTab === item.id 
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 shadow-sm" 
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4 border-l border-slate-200 dark:border-slate-800 pl-4">
          <ThemeToggle />
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
