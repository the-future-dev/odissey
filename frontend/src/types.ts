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

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export type RootStackParamList = {
  WorldSelection: undefined;
  Session: { worldId: string; worldTitle?: string };
};