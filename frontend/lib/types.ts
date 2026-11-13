export type DocumentStatus = "UPLOADED" | "PROCESSING" | "INDEXING" | "INDEXED" | "FAILED";

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_type: "pdf" | "txt";
  file_size: number;
  page_count: number;
  chunk_count: number;
  status: DocumentStatus;
  failure_message: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export interface PreviewPage {
  page_number: number;
  text: string;
}

export interface DocumentPreview {
  document_id: string;
  filename: string;
  file_type: "pdf" | "txt";
  page_count: number;
  pages: PreviewPage[];
}

export interface Source {
  chunk_id: string;
  document_id: string;
  filename: string;
  page_number: number;
  excerpt: string;
  similarity: number | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[] | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  document_ids: string[] | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface ChatResponse {
  conversation: Conversation;
  user_message: Message;
  assistant_message: Message;
}

export interface DashboardStats {
  document_count: number;
  indexed_document_count: number;
  processing_document_count: number;
  failed_document_count: number;
  chunk_count: number;
  conversation_count: number;
  question_count: number;
  recent_documents: DocumentItem[];
  status_counts: Record<string, number>;
}

export interface HealthStatus {
  status: string;
  database: string;
  vector_store: string;
  llm_provider: "ollama" | "gemini";
  llm_model: string;
  llm_configured: boolean;
  llm_available: boolean;
  version: string;
  timestamp: string;
}