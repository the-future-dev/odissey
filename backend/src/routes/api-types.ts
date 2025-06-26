// === API REQUEST/RESPONSE TYPES ===

export interface CreateAnonymousTokenRequest {
  // No body required
}

export interface CreateAnonymousTokenResponse {
  token: string;
  expiresAt: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  worldId: string;
  createdAt: string;
}

export interface InteractWithStoryRequest {
  message: string;
}

export interface InteractWithStoryResponse {
  response: string;
}

// === ERROR TYPES ===

export interface ApiError {
  error: string;
  message: string;
  status: number;
} 