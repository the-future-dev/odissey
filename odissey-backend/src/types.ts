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
  // Story abstraction fields
  genre?: string;
  world_laws?: string; // Hard-coded physics and metaphysics
  perspective?: string; // first-person, third-person, etc.
  beginning_type?: string; // exposition, in-media-res, etc.
}

export interface Session {
  id: string;
  user_id: number;
  world_id: string;
  world_state: string | null;
  coherence_state: string | null;
  created_at: string;
  updated_at: string;
  // Story state tracking
  story_state?: string; // JSON serialized story state
}

export interface Message {
  id: number;
  session_id: string;
  type: 'user' | 'narrator';
  content: string;
  created_at: string;
}

// === STORY ABSTRACTION TYPES ===

export interface Character {
  id: string;
  world_id: string;
  name: string;
  description: string;
  role: string; // protagonist, antagonist, ally, neutral, etc.
  character_traits: string; // personality description
  abilities: string; // skills, powers, etc.
  relationships: string; // JSON serialized relationships map
  history: string;
  goals: string; // what they're trying to achieve
  knowledge_base: string; // JSON serialized - subset of lore they know
  secrets: string; // information only they know
  current_location?: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  world_id: string;
  name: string;
  description: string;
  history: string;
  connections: string; // JSON serialized - connected locations and how
  properties: string; // JSON serialized - special properties, atmosphere
  inhabitants: string; // JSON serialized - list of character IDs
  items: string; // JSON serialized - list of item IDs present
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  world_id: string;
  name: string;
  description: string;
  significance: string; // why this item matters to the story
  properties: string; // JSON serialized - magical properties, uses, etc.
  current_location?: string; // location_id or 'character:{character_id}'
  history: string;
  created_at: string;
  updated_at: string;
}

export interface StoryEvent {
  id: string;
  world_id: string;
  session_id?: string; // if session-specific, null for world events
  name: string;
  description: string;
  event_type: 'major' | 'minor' | 'background' | 'trigger';
  triggers: string; // JSON serialized - conditions that trigger this event
  consequences: string; // JSON serialized - what happens when triggered
  status: 'pending' | 'triggered' | 'completed';
  participants: string; // JSON serialized - character IDs involved
  location_id?: string;
  triggered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Theme {
  id: string;
  world_id: string;
  name: string;
  description: string;
  narrative_hints: string; // how this theme should appear in narration
  symbols: string; // JSON serialized - symbolic elements
  progression: string; // how theme develops through story
  created_at: string;
}

export interface LoreEntry {
  id: string;
  world_id: string;
  title: string;
  content: string;
  category: string; // history, magic, politics, etc.
  access_level: 'public' | 'restricted' | 'secret';
  unlock_triggers: string; // JSON serialized - what unlocks this lore
  connected_entries: string; // JSON serialized - related lore entry IDs
  is_discovered: boolean; // whether players have access
  created_at: string;
  updated_at: string;
}

// === SESSION STORY STATE ===

export interface SessionStoryState {
  protagonist: {
    name?: string;
    description?: string;
    location: string;
    inventory: string[]; // item IDs
    relationships: Record<string, number>; // character_id -> relationship_score
    knowledge: string[]; // lore entry IDs the player has discovered
  };
  activeEvents: string[]; // event IDs currently in progress
  triggeredEvents: string[]; // event IDs that have been completed
  discoveredLore: string[]; // lore entry IDs unlocked
  worldChanges: Record<string, any>; // dynamic changes to world state
  timelinePosition: number; // story progression marker
}

// Character state for session-specific tracking
export interface SessionCharacterState {
  character_id: string;
  current_location: string;
  status: string; // alive, dead, missing, etc.
  memory: string[]; // recent interactions with player
  disposition: number; // -100 to 100, how they feel about player
  goals_progress: Record<string, number>; // goal_id -> progress percentage
  temporary_states: Record<string, any>; // cursed, injured, etc.
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