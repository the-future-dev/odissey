import { API_URL } from '../config';
import { World } from '../types';
import { handleResponse } from './api';

// ------------------------------------------------------------
// WORLD MANAGEMENT
// ------------------------------------------------------------

// Get all available worlds
export const getAllWorlds = async (token: string): Promise<World[]> => {
  const response = await fetch(`${API_URL}/worlds`, {
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${token}`
    }
  });
  return handleResponse(response);
};

// Get a specific world by ID
export const getWorldById = async (token: string, worldId: string): Promise<World> => {
  const response = await fetch(`${API_URL}/worlds/${worldId}`, {
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${token}`
    }
  });
  return handleResponse(response);
}; 