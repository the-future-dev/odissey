// === DATABASE TYPES ===

export interface User {
  id: number;
  token: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
}

export interface World {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  world_id: string;
  story_state: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  session_id: string;
  type: 'user' | 'narrator';
  content: string;
  created_at: string;
} 