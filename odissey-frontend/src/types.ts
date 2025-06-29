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
  type: 'user' | 'narrator';
  text: string;
  timestamp?: Date;
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