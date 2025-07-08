import { API_URL } from '../config';
import { SessionData, GetChaptersResponse } from '../types';
import { handleResponse } from './api';

/**
 * Session Management API
 */

/**
 * Creates a new game session for a specific world
 */
export const createSession = async (token: string, worldId: string): Promise<SessionData> => {
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

/**
 * Retrieves session details (for future use)
 */
export const getSessionDetails = async (token: string, sessionId: string): Promise<SessionData> => {
  const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${token}`
    }
  });
  
  return handleResponse(response);
};

/**
 * Retrieves chapters for a session
 */
export const getChapters = async (token: string, sessionId: string): Promise<GetChaptersResponse> => {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/chapters`, {
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${token}`
    }
  });
  
  return handleResponse(response);
};

/**
 * Ends/deletes a session (graceful cleanup)
 */
export const endSession = async (token: string, sessionId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.warn(`Failed to end session ${sessionId} on server, continuing anyway`);
    }
  } catch (error) {
    console.warn('Error ending session on server:', error);
  }
}; 