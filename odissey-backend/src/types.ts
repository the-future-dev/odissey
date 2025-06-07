// Database types
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
  initial_state: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  world_id: string;
  world_state: string | null;
  coherence_state: string | null;
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

// API request/response types
export interface CreateAnonymousTokenRequest {
  // No body required
}

export interface CreateAnonymousTokenResponse {
  token: string;
  expiresAt: string;
}

export interface CreatePersonalizedSessionRequest {
  worldId: string;
}

export interface CreatePersonalizedSessionResponse {
  sessionId: string;
  worldId: string;
  worldState: string;
  coherenceState?: object;
  createdAt: string;
}

export interface InteractWithStoryRequest {
  message: string;
}

export interface InteractWithStoryResponse {
  response: string;
}

// Error types
export interface ApiError {
  error: string;
  message: string;
  status: number;
}

// Environment bindings
export interface Env {
  DB: D1Database;
  HUGGINGFACE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
} 