import { API_URL } from '../config';
import { SessionData } from '../types';
import { handleResponse, ApiError } from './api';

// Session management
export const createPersonalizedSession = async (token: string, worldId: string): Promise<SessionData> => {
  const response = await fetch(`${API_URL}/sessions/new`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ worldId })
  });
  return handleResponse(response);
};

export const interactWithStory = async (token: string, sessionId: string, message: string): Promise<{ response: string }> => {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/interact`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message })
  });
  
  if (!response.ok) {
    throw new ApiError('Failed to interact with story', response.status);
  }
  
  return handleResponse(response);
};

export const interactWithStoryStream = async (
  token: string, 
  sessionId: string, 
  message: string,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: string) => void
): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/interact-stream`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message })
    });
    
    if (!response.ok) {
      throw new ApiError('Failed to interact with story stream', response.status);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep incomplete line in buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              
              if (data.type === 'chunk') {
                onChunk(data.content);
              } else if (data.type === 'complete') {
                onComplete(data.content);
                return;
              } else if (data.type === 'error') {
                onError(data.content);
                return;
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', line, parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('Streaming error:', error);
    onError(error instanceof Error ? error.message : 'Unknown streaming error');
  }
};

// Token utility class for better organization
export class TokenManager {
  private static TOKEN_KEY = 'odyssey_auth_token';

  static async getStoredToken(): Promise<string | null> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      return await AsyncStorage.getItem(TokenManager.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  static async storeToken(token: string): Promise<void> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(TokenManager.TOKEN_KEY, token);
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  static async clearToken(): Promise<void> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.removeItem(TokenManager.TOKEN_KEY);
    } catch (error) {
      console.error('Failed to clear token:', error);
    }
  }

  static async getValidToken(): Promise<string> {
    // Try to get existing token
    let token = await TokenManager.getStoredToken();
    
    if (token) {
      // Validate existing token
      const isValid = await validateToken(token);
      if (isValid) {
        return token;
      }
      // Clear invalid token
      await TokenManager.clearToken();
    }
    
    // Create new token
    const tokenData = await createAnonymousToken();
    await TokenManager.storeToken(tokenData.token);
    return tokenData.token;
  }
}


// Token management
export const createAnonymousToken = async (): Promise<{ token: string; expiresAt: string }> => {
  try {
    console.log('Creating anonymous token with URL:', `${API_URL}/auth/anonymous`);
    const response = await fetch(`${API_URL}/auth/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.error('Token creation failed:', response.status, response.statusText);
      throw new ApiError(`Failed to create token: ${response.statusText}`, response.status);
    }
    
    return handleResponse(response);
  } catch (error) {
    console.error('Token creation error:', error);
    throw error;
  }
};

export const validateToken = async (token: string): Promise<boolean> => {
  try {
    console.log('Validating token with URL:', `${API_URL}/auth/validate`);
    const response = await fetch(`${API_URL}/auth/validate`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    if (!response.ok) {
      console.log('Token validation failed:', response.status, response.statusText);
    }
    
    return response.ok;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};
