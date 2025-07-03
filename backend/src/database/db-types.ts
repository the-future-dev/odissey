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

export interface StoryModel {
  id: number;
  session_id: string;
  plot: string;                    // Plot structure of incidents
  characters: string;              // Character development and tragic hero
  theme_moral_message: string;     // Theme/Moral Message and catharsis
  conflict: string;                // Internal vs external conflict
  setting: string;                 // Unities of Time and Place
  style_genre: string;             // Style and Genre elements
  audience_effect: string;         // Intended audience effect (pity, fear, catharsis)
  created_at: string;
  updated_at: string;
}

export interface StoryStep {
  id: number;
  session_id: string;
  story_step: string;              // The single optimization step
  context_user_input: string;      // User input that triggered this step
  reasoning?: string;              // Optimizer's reasoning
  created_at: string;
}

export interface StoryPrediction {
  id: number;
  session_id: string;
  choice_number: 1 | 2 | 3;         // Which choice this prediction is for
  predicted_model_update: string;   // JSON of predicted StoryModel changes
  created_at: string;
} 