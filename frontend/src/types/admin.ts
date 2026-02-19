export interface Stats {
  total_users: number;
  total_analyses: number;
  average_score: number;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  details: string | null;
  ip_address: string | null;
  timestamp: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  api_key: string;
  models: string[];
  is_active: boolean;
  priority: number;
  agent_capability?: string[];
}

export interface RAGDocument {
  id: string;
  filename: string;
  title?: string;
  collection: string;
  description?: string;
  target_agent?: string;
  file_type?: string;
  upload_date: string;
  status: string;
  chunk_count: number;
}

export interface Agent {
  id: string;
  name: string;
  type: "planner" | "security" | "cloud" | "reporter";
  status: "idle" | "busy" | "offline";
  current_task?: string;
  llm_provider_id: string;
  stats: {
    tasks_completed: number;
    avg_response_time: number;
  };
}

export interface KnowledgeBase {
  id: string;
  name: string;
  category: "technology" | "cloud_provider" | "compliance" | "other";
  description?: string;
  content_url?: string;
  logo_url?: string;
  target_agent: string;
  status: "pending" | "processing" | "indexed" | "failed" | "pending_processing";
  processed_content?: string;
  last_updated?: string;
}

export interface AnalysisLog {
  id: string;
  analysis_id: string;
  agent: string;
  action: string;
  timestamp: string;
  details: string;
  status: "info" | "warning" | "error" | "success";
}
