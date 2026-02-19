import { useState } from "react";
import { Bot, Plus, Layers, Shield, Server, FileText, CheckCircle, Trash2, Edit, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Agent, LLMProvider } from "@/types/admin";

interface AdminAgentsProps {
  agents: Agent[];
  providers: LLMProvider[];
  token: string | null;
  loadData: () => Promise<void>;
}

export function AdminAgents({ agents, providers, token, loadData }: AdminAgentsProps) {
  // Local state for form
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [providerForm, setProviderForm] = useState({
    name: "", provider_type: "openai", base_url: "", api_key: "", models: "", priority: 10, agent_capability: "general"
  });

  const handleSaveProvider = async () => {
    try {
      if (!providers) return; // Guard
      const payload = { 
        ...providerForm, 
        models: typeof providerForm.models === 'string' ? (providerForm.models as string).split(",").map((m: string) => m.trim()) : providerForm.models,
        agent_capability: typeof providerForm.agent_capability === 'string' ? [providerForm.agent_capability] : providerForm.agent_capability
      };
      
      const url = editingProvider ? `/api/v1/config/llm/${editingProvider.id}` : "/api/v1/config/llm";
      const method = editingProvider ? "PUT" : "POST";
      
      await api(url, { method, token: token!, body: payload });
      setShowProviderForm(false);
      setEditingProvider(null);
      setProviderForm({ name: "", provider_type: "openai", base_url: "", api_key: "", models: "", priority: 10, agent_capability: "general" });
      loadData();
      toast.success("Provider saved successfully");
    } catch (e) {
      toast.error("Failed to save provider");
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api(`/api/v1/config/llm/${id}`, { method: "DELETE", token: token! });
      loadData();
      toast.success("Provider deleted");
    } catch (e) {
      toast.error("Failed to delete provider");
    }
  };

  const AGENT_TYPES = [
     { id: 'planner', name: 'Planner Agent', desc: 'Deconstructs user requests, analyzes requirements, and orchestrates the workflow.', icon: Layers, color: 'text-purple-600' },
     { id: 'security', name: 'Security Auditor', desc: 'Scans code for vulnerabilities (SAST) and checks compliance standards.', icon: Shield, color: 'text-red-600' },
     { id: 'cloud', name: 'Cloud Architect', desc: 'Generates infrastructure graphs and provider comparisons.', icon: Server, color: 'text-blue-600' },
     { id: 'reporter', name: 'Report Generator', desc: 'Synthesizes findings into the final markdown report.', icon: FileText, color: 'text-green-600' },
     { id: 'general', name: 'General / Fallback', desc: 'Shared pool of keys for general tasks or fallback usage.', icon: Bot, color: 'text-slate-600' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
            <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white"><Bot className="w-6 h-6 text-blue-600" /> Agent Orchestration</h2>
            <p className="text-slate-500 mt-1">Manage API keys and model assignments for each autonomous agent.</p>
            </div>
            <button 
            onClick={() => {
                setEditingProvider(null);
                setProviderForm({ name: "", provider_type: "openai", base_url: "", api_key: "", models: "", priority: 10, agent_capability: "general" });
                setShowProviderForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-sm font-medium transition-colors w-fit"
            >
            <Plus className="w-4 h-4" /> Add Global Key
            </button>
        </div>

        {/* Modal */}
        {showProviderForm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg">{editingProvider ? "Edit API Configuration" : "New API Configuration"}</h3>
                    <button onClick={() => setShowProviderForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                    <XCircle className="w-6 h-6"/>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[80vh]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Configuration Name</label>
                        <input 
                        placeholder="e.g., Primary GPT-4 Access" 
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        value={providerForm.name}
                        onChange={e => setProviderForm({...providerForm, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Provider Type</label>
                        <div className="relative">
                        <select 
                            className="w-full p-2.5 pl-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow appearance-none"
                            value={providerForm.provider_type}
                            onChange={e => setProviderForm({...providerForm, provider_type: e.target.value})}
                        >
                            <option value="openai">OpenAI</option>
                            <option value="azure">Azure OpenAI</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="ollama">Ollama (Local)</option>
                        </select>
                        <div className="absolute left-3 top-2.5 pointer-events-none">
                            <img src={`/icons/${providerForm.provider_type}.svg`} onError={(e) => (e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/2620/2620470.png')} className="w-5 h-5 opacity-70" alt="" />
                        </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Assigned Agent</label>
                        <select 
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={providerForm.agent_capability}
                        onChange={e => setProviderForm({...providerForm, agent_capability: e.target.value})}
                        >
                        <option value="general">General Pool (Fallback)</option>
                        <option value="planner">Planner Agent</option>
                        <option value="security">Security Auditor</option>
                        <option value="cloud">Cloud Architect</option>
                        <option value="reporter">Report Generator</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">API Key</label>
                        <input 
                            type="password"
                            placeholder="sk-..." 
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={providerForm.api_key}
                            onChange={e => setProviderForm({...providerForm, api_key: e.target.value})}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Base URL (Optional)</label>
                        <input 
                        placeholder="https://api.openai.com/v1" 
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={providerForm.base_url}
                        onChange={e => setProviderForm({...providerForm, base_url: e.target.value})}
                        />
                        <p className="text-xs text-slate-500 mt-1">Required for Azure OpenAI or local models (e.g., Ollama).</p>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Target Model(s)</label>
                        <input 
                        placeholder="gpt-4-turbo, gpt-3.5-turbo" 
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={providerForm.models}
                        onChange={e => setProviderForm({...providerForm, models: e.target.value})}
                        />
                        <p className="text-xs text-slate-500 mt-1">Comma-separated list of model IDs.</p>
                    </div>
                    </div>
                </div>
                
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                    <button onClick={() => setShowProviderForm(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 font-medium transition-colors">Cancel</button>
                    <button onClick={handleSaveProvider} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-transform active:scale-95 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Save Configuration
                    </button>
                </div>
                </div>
            </div>
        )}

        {/* Structured Agent List */}
        <div className="grid gap-6">
            {AGENT_TYPES.map(agentType => {
                // Filter providers for this agent
                const agentProviders = providers.filter(p => p.agent_capability?.includes(agentType.id) || (agentType.id === 'general' && (!p.agent_capability || p.agent_capability[0] === 'general')));
                const runningAgent = agents.find(a => a.type === agentType.id);

                return (
                <div key={agentType.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {/* Agent Header */}
                    <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 ${agentType.color}`}>
                                <agentType.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                                    {agentType.name}
                                    {runningAgent && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider border font-semibold ${
                                        runningAgent.status === 'busy' 
                                        ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' 
                                        : 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                                    }`}>
                                        {runningAgent.status}
                                    </span>
                                    )}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{agentType.desc}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                setProviderForm({ name: "", provider_type: "openai", base_url: "", api_key: "", models: "", priority: 10, agent_capability: agentType.id });
                                setShowProviderForm(true);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30"
                        >
                            <Plus className="w-4 h-4" /> Add Key
                        </button>
                    </div>

                    {/* Configured Keys List */}
                    <div className="p-6">
                        <h4 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider mb-4">API Configurations</h4>
                        {agentProviders.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                                <p className="text-slate-500 text-sm">No API keys explicitly assigned.</p>
                                {agentType.id !== 'general' && <p className="text-xs text-slate-400 mt-1">Agent will fallback to shared 'General' pool.</p>}
                            </div>
                        ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {agentProviders.map(p => (
                                <div key={p.id} className="relative group p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/30 dark:bg-slate-800/10 hover:bg-white dark:hover:bg-slate-800 transition-all">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm z-10">
                                        <button onClick={() => {
                                            setEditingProvider(p);
                                            setProviderForm({ ...p, models: p.models?.join(", ") || "", agent_capability: p.agent_capability?.[0] || agentType.id });
                                            setShowProviderForm(true);
                                        }} className="p-1.5 hover:text-blue-600 text-slate-500 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><Edit className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleDeleteProvider(p.id)} className="p-1.5 hover:text-red-600 text-slate-500 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center border border-slate-100 dark:border-slate-600">
                                            <img src={`/icons/${p.provider_type}.svg`} onError={(e) => (e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/2620/2620470.png')} alt="" className="w-4 h-4 opacity-90" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-semibold text-sm capitalize block truncate text-slate-900 dark:text-white" title={p.name}>{p.name || p.provider_type}</span>
                                        </div>
                                        {p.priority < 5 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded dark:bg-blue-900/50 dark:text-blue-300 font-medium">Primary</span>}
                                    </div>
                                    
                                    <div className="space-y-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between text-xs items-center">
                                            <span className="text-slate-500">Models</span>
                                            <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[120px] bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded" title={p.models?.join(', ')}>{p.models?.[0]?.split('-')[0]}...</span>
                                        </div>
                                        <div className="flex justify-between text-xs items-center">
                                            <span className="text-slate-500">Key</span>
                                            <span className="font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-400">
                                                {p.api_key ? `••••${p.api_key.slice(-4)}` : 'No Key'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        )}
                    </div>
                </div>
                );
            })}
        </div>
    </div>
  );
}
