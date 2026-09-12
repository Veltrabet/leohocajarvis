// Hand-written mirrors of backend/models/schemas.py — keep both sides in sync in one edit.

export interface Me {
  authenticated: boolean;
  operator: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  status: "aktif" | "beklemede" | "tamamlandi";
  created_at: string;
}

export type Priority = "kritik" | "yuksek" | "normal" | "dusuk";
export type TaskStatus = "bekliyor" | "devam" | "tamam";

export interface Task {
  id: string;
  title: string;
  project_id: string | null;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  notes: string;
  created_at: string;
}

export interface Activity {
  id: string;
  kind: string;
  message: string;
  status: "ok" | "error" | "pending";
  created_at: string;
}

export interface Memory {
  id: string;
  key: string;
  value: string;
  category: string;
  source: "manuel" | "otomatik";
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface StudioItem {
  id: string;
  prompt: string;
  mime_type: string;
  data_url: string;
  edited: boolean;
  created_at: string;
}

export interface DailyBrief {
  date: string;
  summary: string;
  open_tasks: number;
  critical_tasks: number;
  completed_today: number;
  generated_at: string;
}

export interface Capability {
  capability: string;
  provider: string;
  model: string;
  configured: boolean;
  key_source: string;
}

export interface SpeakResponse {
  audio_base64: string;
  mime_type: string;
  characters: number;
  provider: string;
}

export type LeadStage = "yeni" | "iletisimde" | "teklif" | "kazanildi" | "kaybedildi";

export interface Lead {
  id: string;
  name: string;
  company: string;
  channel: string;
  handle: string;
  email: string;
  phone: string;
  need: string;
  stage: LeadStage;
  notes: string[];
  created_at: string;
}

export interface GeneratedText {
  id: string;
  kind: string;
  topic: string;
  content: string;
  lang: string;
  created_at: string;
}
