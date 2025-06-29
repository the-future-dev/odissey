import { API_URL } from '../config';
import { handleResponse, ApiError } from './api';

/**
 * Token Management
 * Handles authentication tokens with automatic refresh
 */
export class TokenManager {
  private static readonly TOKEN_KEY = 'odyssey_auth_token';

  static async getStoredToken(): Promise<string | null> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      return await AsyncStorage.getItem(this.TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to retrieve stored token:', error);
      return null;
    }
  }

  static async storeToken(token: string): Promise<void> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(this.TOKEN_KEY, token);
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  static async clearToken(): Promise<void> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.removeItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Failed to clear token:', error);
    }
  }

  /**
   * Gets a valid token, creating a new one if necessary
   */
  static async getValidToken(): Promise<string> {
    // Check existing token
    const existingToken = await this.getStoredToken();
    
    if (existingToken && await this.validateToken(existingToken)) {
      return existingToken;
    }
    
    // Clear invalid token and create new one
    await this.clearToken();
    const { token } = await this.createAnonymousToken();
    await this.storeToken(token);
    return token;
  }

  /**
   * Creates a new anonymous authentication token
   */
  private static async createAnonymousToken(): Promise<{ token: string; expiresAt: string }> {
    const response = await fetch(`${API_URL}/auth/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new ApiError(`Authentication failed: ${response.statusText}`, response.status);
    }
    
    return handleResponse(response);
  }

  /**
   * Validates if a token is still valid
   */
  private static async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/auth/validate`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`
        },
      });
      
      return response.ok;
    } catch (error) {
      console.warn('Token validation failed:', error);
      return false;
    }
  }
} 