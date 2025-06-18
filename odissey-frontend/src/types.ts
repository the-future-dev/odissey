export interface DemoWorld {
  id: string;
  title: string;
  description?: string;
  previewContent?: string;
}

export interface Message {
  type: 'user' | 'narrator';
  text: string;
  timestamp?: Date;
}

export interface SessionData {
  sessionId: string;
  worldId: string;
  worldState: string;
  createdAt: string;
  personalitySnapshot?: any;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// Enhanced types for the new functionality
export interface PreferenceResponses {
  adventureStyle: 'magical' | 'technological' | 'natural' | 'mysterious';
  characterType: 'hero' | 'explorer' | 'creator' | 'friend';
  interests: ('magic' | 'technology' | 'animals' | 'space')[];
  visualResponses: string[];
}

export interface PersonalityProfile {
  traitScores: Record<string, number>;
  confidenceLevel: number;
  assessmentMethod: 'quiz' | 'interaction';
  timestamp: Date;
}

export interface WorldSummary {
  id: string;
  title: string;
  description: string;
  genre: string;
  thumbnailUrl?: string;
  previewContent: string;
  createdAt: Date;
  quickPlayReady: boolean;
}

export interface WorldArtifacts {
  characters: Character[];
  settings: Setting[];
  rules: string[];
  events: StoryEvent[];
  storyTemplate: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  personality: string[];
  relationships: Record<string, string>;
}

export interface Setting {
  id: string;
  name: string;
  description: string;
  atmosphere: string;
  connections: string[];
}

export interface StoryEvent {
  id: string;
  trigger: string;
  description: string;
  consequences: string[];
}

export interface CoherenceState {
  worldArtifacts: WorldArtifacts;
  characterMemory: Record<string, any>;
  consistencyScore: number;
}

export type RootStackParamList = {
  // Login: undefined;
  // DemoWorlds: undefined;
  // WorldGallery: undefined;
  // WorldCreation: undefined;
  // CoCreation: { initialConcept?: string };
  WorldSelection: undefined;
  Session: { worldId: string; worldTitle?: string };
  // Profile: undefined;
};