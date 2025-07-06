export interface World {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

export interface SessionData {
  sessionId: string;
  worldId: string;
  createdAt: string;
}

export interface Message {
  type: 'user' | 'narrator' | 'choice';
  text: string;
  timestamp?: Date;
  choiceNumber?: number; // For choice messages
}

export interface Chapter {
  id: number;
  session_id: string;
  chapter_number: number;
  title: string;
  description: string;
  status: 'history' | 'current' | 'future';
  decomposition?: string;
  created_at: string;
  updated_at: string;
}

export interface GetChaptersResponse {
  history: Chapter[];
  current: Chapter | null;
  future: Chapter[];
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export type RootStackParamList = {
  WorldSelection: undefined;
  Session: { worldId: string; worldTitle?: string };
  Chapters: { sessionId: string; worldTitle?: string };
};