import { useState } from "react";
import { Database, Plus, XCircle, CheckCircle, Globe, ExternalLink, RefreshCw, Trash2, Upload, FileText, Edit } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { KnowledgeBase, RAGDocument } from "@/types/admin";

interface AdminKnowledgeBaseProps {
  knowledgeBases: KnowledgeBase[];
  documents: RAGDocument[];
  token: string | null;
  loadData: () => Promise<void>;
}

export function AdminKnowledgeBase({ knowledgeBases, documents, token, loadData }: AdminKnowledgeBaseProps) {
  const [showKBModal, setShowKBModal] = useState(false);
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<RAGDocument | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docForm, setDocForm] = useState({
     title: "", collection: "cloud_docs", description: "", target_agent: "general"
  });

  const [kbForm, setKbForm] = useState({
    name: "", category: "technology", content_url: "", logo_url: "", target_agent: "general", description: ""
  });
  const handleSaveKB = async () => {
    try {
      if (!kbForm.name || !kbForm.content_url) {
        toast.error("Name and URL are required");
        return;
      }
      
      const url = editingKB ? `/api/v1/config/kb/${editingKB.id}` : "/api/v1/config/kb";
      const method = editingKB ? "PUT" : "POST";

      await api(url, { 
        method, 
        token: token!,
        body: kbForm
      });
      setShowKBModal(false);
      setEditingKB(null);
      setKbForm({ name: "", category: "technology", content_url: "", logo_url: "", target_agent: "general", description: "" });
      loadData();
      toast.success(editingKB ? "Knowledge Source updated" : "Knowledge Source added");
    } catch (e) {
      toast.error(editingKB ? "Failed to update Knowledge Source" : "Failed to add Knowledge Source");
    }
  };

  const handleDeleteKB = async (id: string) => {
    if (!confirm("Remove this knowledge source?")) return;
    try {
      await api(`/api/v1/config/kb/${id}`, { method: "DELETE", token: token! }); 
      loadData();
      toast.success("Source removed");
    } catch (e) {
      toast.error("Failed to remove source");
    }
  };

  const handleSaveDoc = async () => {
    try {
        if (editingDoc) {
             await api(`/api/v1/admin/rag/${editingDoc.id}`, {
                 method: 'PUT',
                 token: token!,
                 body: {
                     title: docForm.title,
                     collection: docForm.collection,
                     description: docForm.description,
                     target_agent: docForm.target_agent
                 }
             });
             toast.success("Document updated");
        } else {
             if (!docFile) {
                 toast.error("Please select a file");
                 return;
             }
             setUploadingDoc(true);
             const formData = new FormData();
             formData.append("file", docFile);
             formData.append("collection", docForm.collection);
             formData.append("description", docForm.description);
             formData.append("target_agent", docForm.target_agent);

             const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/admin/rag/upload`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
              });
              if (!res.ok) throw new Error("Upload failed");
              toast.success("Document uploaded");
        }
        setShowDocModal(false);
        setEditingDoc(null);
        setDocFile(null);
        setDocForm({ title: "", collection: "cloud_docs", description: "", target_agent: "general" });
        loadData();
    } catch (e) {
        toast.error(editingDoc ? "Failed to update document" : "Failed to upload document");
    } finally {
        setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm("Remove this document?")) return;
    try {
      await api(`/api/v1/admin/rag/${id}`, { method: "DELETE", token: token! });
      loadData();
      toast.success("Document removed");
    } catch (e) {
      toast.error("Failed to remove document");
    }
  };

  const handleIndexDoc = async (id: string) => {
    try {
      await api(`/api/v1/admin/rag/${id}/index`, { method: "POST", token: token! });
      toast.success("Indexing started");
      loadData();
    } catch (e) {
      toast.error("Failed to start indexing");
    }
  };

  const handleProcessKB = async (id: string) => {
    try {
      const toastId = toast.loading("Crawling content...");
      await api(`/api/v1/config/kb/${id}/process`, { method: "POST", token: token! });
      toast.dismiss(toastId);
      toast.success("Content fetched and indexed");
      loadData();
    } catch (e) {
      toast.dismiss();
      toast.error("Failed to process source");
    }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use current form state or defaults
    const collection = docForm.collection || "cloud_docs";
    const description = docForm.description || "";
    const target_agent = docForm.target_agent || "general";

    try {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("collection", collection);
      formData.append("description", description);
      formData.append("target_agent", target_agent);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/admin/rag/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) throw new Error("Upload failed");
      
      toast.success("Document uploaded");
      loadData();
      // Reset input value to allow re-uploading same file if needed
      e.target.value = "";
    } catch (err) {
      toast.error("Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Database className="text-amber-500" /> Knowledge Base Management</h2>
          <p className="text-slate-500 mt-1">Manage external documentation sources for the RAG engine.</p>
        </div>
        <button 
          onClick={() => {
            setEditingKB(null);
            setKbForm({ name: "", category: "technology", content_url: "", logo_url: "", target_agent: "general", description: "" });
            setShowKBModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium w-fit"
        >
          <Plus className="w-4 h-4" /> Add Source
        </button>
      </div>

      {showKBModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg">{editingKB ? "Edit Knowledge Source" : "Add New Knowledge Source"}</h3>
                    <button onClick={() => setShowKBModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XCircle className="w-6 h-6"/>
                    </button>
                </div>

                <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Source Name</label>
                    <input 
                        placeholder="e.g. AWS Documentation" 
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        value={kbForm.name}
                        onChange={e => setKbForm({...kbForm, name: e.target.value})}
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Category</label>
                    <select 
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        value={kbForm.category}
                        onChange={e => setKbForm({...kbForm, category: e.target.value as any})}
                    >
                        <option value="technology">Technology Specification</option>
                        <option value="cloud_provider">Cloud Provider</option>
                        <option value="compliance">Compliance Standard</option>
                        <option value="other">Other</option>
                    </select>
                    </div>
                    <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Description (Optional)</label>
                    <input 
                        placeholder="Brief description of the source" 
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        value={kbForm.description}
                        onChange={e => setKbForm({...kbForm, description: e.target.value})}
                    />
                    </div>
                    <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Logo URL (Optional)</label>
                    <div className="flex gap-3">
                        <input 
                        placeholder="https://... (or leave empty for default)" 
                        className="flex-1 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        value={kbForm.logo_url}
                        onChange={e => setKbForm({...kbForm, logo_url: e.target.value})}
                        />
                        <div className="w-11 h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {kbForm.logo_url ? (
                            <img src={kbForm.logo_url} alt="Preview" className="w-6 h-6 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        ) : (
                            <Globe className="w-5 h-5 text-slate-400" />
                        )}
                        </div>
                    </div>
                    </div>
                    <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Content URL</label>
                    <div className="relative">
                        <input 
                        placeholder="https://docs.aws.amazon.com/..." 
                        className="w-full p-2.5 pl-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        value={kbForm.content_url}
                        onChange={e => setKbForm({...kbForm, content_url: e.target.value})}
                        />
                        <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">The crawler will fetch and index content from this URL.</p>
                    </div>
                    <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Target Agent Access</label>
                    <select 
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        value={kbForm.target_agent}
                        onChange={e => setKbForm({...kbForm, target_agent: e.target.value})}
                    >
                        <option value="general">General (All Agents)</option>
                        <option value="security">Security Agent Only</option>
                        <option value="planner">Planner Agent Only</option>
                    </select>
                    </div>
                </div>
                </div>
                
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                    <button onClick={() => setShowKBModal(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 font-medium transition-colors">Cancel</button>
                    <button onClick={handleSaveKB} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-transform active:scale-95 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> {editingKB ? "Save Changes" : "Add Source"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* KB Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Name</th>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Category</th>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Content Status</th>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Target Agent</th>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {knowledgeBases.length === 0 ? (
               <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Database className="w-10 h-10 text-slate-300 mb-2" />
                    <p>No knowledge sources configured.</p>
                    <p className="text-xs">Add one to enhance agent capabilities.</p>
                  </div>
                </td>
              </tr>
            ) : knowledgeBases.map(kb => (
              <tr key={kb.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900 dark:text-white">{kb.name}</div>
                  <a href={kb.content_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1">
                    {kb.content_url ? new URL(kb.content_url).hostname : 'No URL'} <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium capitalize text-slate-600 dark:text-slate-300">{kb.category.replace('_', ' ')}</span></td>
                <td className="px-6 py-4">
                  {(kb.processed_content || kb.status === 'indexed') ? (
                     <div className="flex items-center gap-2">
                        <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Indexed</span>
                        <button onClick={() => handleProcessKB(kb.id)} className="p-1 text-slate-400 hover:text-blue-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Re-sync">
                           <RefreshCw className="w-3 h-3" />
                        </button>
                     </div>
                  ) : kb.status === 'processing' || kb.status === 'pending_processing' ? (
                     <div className="flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit"><RefreshCw className="w-3 h-3 animate-spin" /> Processing</span>
                     </div>
                  ) : kb.status === 'failed' ? (
                     <div className="flex items-center gap-2">
                        <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Failed</span>
                         <button onClick={() => handleProcessKB(kb.id)} className="p-1 text-slate-400 hover:text-blue-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Retry">
                           <RefreshCw className="w-3 h-3" />
                        </button>
                     </div>
                  ) : (
                     <button onClick={() => handleProcessKB(kb.id)} className="text-amber-600 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit transition-colors group border border-amber-200 dark:border-amber-800">
                       <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform" /> Sync & Index
                     </button>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-500 capitalize">{kb.target_agent}</td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <button 
                    onClick={() => {
                        setEditingKB(kb);
                        setKbForm({
                            name: kb.name,
                            category: kb.category,
                            content_url: kb.content_url || "",
                            logo_url: kb.logo_url || "",
                            target_agent: kb.target_agent,
                            description: kb.description || ""
                        });
                        setShowKBModal(true);
                    }}
                    className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteKB(kb.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Document Upload Section */}
       <div className="mt-12 pt-8">
         <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-5 h-5 text-blue-500" /> Manual RAG Documents</h3>
              <p className="text-sm text-slate-500 mt-1">Upload specific files for direct indexing.</p>
            </div>
             <label className={`cursor-pointer bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploadingDoc ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingDoc ? 'Uploading...' : 'Upload File'}
              <input type="file" className="hidden" onChange={handleUploadDoc} accept=".pdf,.md,.txt,.json" disabled={uploadingDoc} />
            </label>
         </div>
         
         {documents.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500">
               <Upload className="w-8 h-8 mx-auto mb-3 opacity-30" />
               <p className="text-sm">No manual documents uploaded.</p>
            </div>
         ): (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => (
            <div key={doc.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-colors group">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                   <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                   <p className="font-medium text-sm truncate text-slate-900 dark:text-white" title={doc.filename}>{doc.filename}</p>
                   <p className="text-xs text-slate-500">{new Date(doc.upload_date).toLocaleDateString()}</p>
                </div>
              </div>
              {doc.status === 'indexed' ? (
                 <div className="text-green-500 bg-green-50 dark:bg-green-900/20 p-1.5 rounded-md" title="Indexed"><CheckCircle className="w-4 h-4" /></div>
              ) : (
                 <button onClick={() => handleIndexDoc(doc.id)} className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded text-xs font-medium transition-colors">Index</button>
              )}
            </div>
          ))}
         </div>
         )}
      </div>
    </div>
  );
}
