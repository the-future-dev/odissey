import { API_URL, OAUTH_CONFIG } from '../config';
import { handleResponse, ApiError } from './api';
import { CrossPlatformStorage } from '../utils/storage';

export interface GoogleUser {
  id: number;
  email: string;
  name: string;
  picture_url?: string;
}

export interface GoogleAuthResponse {
  valid: boolean;
  user?: GoogleUser;
}

/**
 * Google Authentication Token Management
 * Handles Google OAuth tokens with validation and user info
 */
export class GoogleTokenManager {
  private static readonly TOKEN_KEY = 'odyssey_google_token';
  private static readonly USER_KEY = 'odyssey_google_user';

  /**
   * Get stored Google authentication token
   */
  static async getStoredToken(): Promise<string | null> {
    try {
      return await CrossPlatformStorage.getItem(this.TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to retrieve stored Google token:', error);
      return null;
    }
  }

  /**
   * Get stored user information
   */
  static async getStoredUser(): Promise<GoogleUser | null> {
    try {
      const userStr = await CrossPlatformStorage.getItem(this.USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.warn('Failed to retrieve stored user info:', error);
      return null;
    }
  }

  /**
   * Store Google authentication token in both browser and mobile storage
   */
  static async storeToken(token: string): Promise<void> {
    try {
      // Store in async storage
      await CrossPlatformStorage.setItem(this.TOKEN_KEY, token);

      // Also store in browser localStorage if available
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.TOKEN_KEY, token);
      }
    } catch (error) {
      console.error('Failed to store Google token:', error);
    }
  }

  /**
   * Store user information in both browser and mobile storage
   */
  static async storeUser(user: GoogleUser): Promise<void> {
    try {
      const userStr = JSON.stringify(user);
      
      // Store in async storage
      await CrossPlatformStorage.setItem(this.USER_KEY, userStr);

      // Also store in browser localStorage if available
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.USER_KEY, userStr);
      }
    } catch (error) {
      console.error('Failed to store user info:', error);
    }
  }

  /**
   * Clear stored authentication data from both browser and mobile storage
   */
  static async clearAuth(): Promise<void> {
    try {
      // Clear from async storage
      await Promise.all([
        CrossPlatformStorage.removeItem(this.TOKEN_KEY),
        CrossPlatformStorage.removeItem(this.USER_KEY)
      ]);

      // Also clear from browser localStorage if available
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(this.TOKEN_KEY);
        window.localStorage.removeItem(this.USER_KEY);
      }
    } catch (error) {
      console.error('Failed to clear authentication data:', error);
    }
  }

  /**
   * Check for existing authentication
   * Returns authentication status and user info if available
   */
  static async checkExistingAuth(): Promise<{ isAuthenticated: boolean; user?: GoogleUser }> {
    try {
      let token: string | null = null;
      let user: GoogleUser | null = null;

      // Browser: Check localStorage directly first
      if (typeof window !== 'undefined' && window.localStorage) {
        token = window.localStorage.getItem(this.TOKEN_KEY);
        const userStr = window.localStorage.getItem(this.USER_KEY);
        if (userStr) {
          try {
            user = JSON.parse(userStr);
          } catch (e) {
            // Failed to parse user from localStorage, will proceed without it
          }
        }
      }

      // Mobile: Use async storage if no browser localStorage
      if (!token || !user) {
        token = await this.getStoredToken();
        user = await this.getStoredUser();
      }
      
      if (token && user) {
        // Try to validate token with backend
        try {
          const isValid = await this.validateToken(token);
          
          if (isValid) {
            // Ensure token is stored in both systems
            await this.storeToken(token);
            await this.storeUser(user);
            return { isAuthenticated: true, user };
          } else {
            // Clear invalid authentication
            await this.clearAuth();
          }
        } catch (validationError) {
          // Backend validation failed (possibly due to blocking)
          // In development, provide fallback mechanism
          if (OAUTH_CONFIG.fallbackEnabled && token && user) {
            console.warn('🔄 Backend validation failed, using fallback authentication for development');
            console.warn('  This should only happen in development when requests are blocked');
            console.warn('  Please ensure your backend is running and accessible');
            
            // Check if token looks valid (basic JWT structure check)
            if (this.isTokenStructureValid(token)) {
              // Use stored authentication as fallback in development
              return { isAuthenticated: true, user };
            }
          }
          
          // Clear auth if validation failed
          await this.clearAuth();
        }
      }

      return { isAuthenticated: false };
    } catch (error) {
      await this.clearAuth();
      return { isAuthenticated: false };
    }
  }

  /**
   * Validate Google authentication token with backend
   */
  static async validateToken(token: string): Promise<boolean> {
    const maxRetries = OAUTH_CONFIG.retryAttempts;
    const retryDelay = OAUTH_CONFIG.retryDelay;
    const requestTimeout = OAUTH_CONFIG.requestTimeout;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

        const response = await fetch(`${API_URL}/auth/validate-google`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data: GoogleAuthResponse = await response.json();
          
          // Update stored user info if provided
          if (data.user) {
            await this.storeUser(data.user);
          }
          
          return data.valid;
        }
        
        return false;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isTimeoutError = error instanceof Error && error.name === 'AbortError';
        const isNetworkError = error instanceof TypeError && error.message === 'Failed to fetch';

        if (isNetworkError) {
          console.warn(`🚫 Request blocked (attempt ${attempt}/${maxRetries}) - this commonly happens in development due to:`);
          console.warn('  1. Ad blockers blocking localhost requests');
          console.warn('  2. Browser security extensions');
          console.warn('  3. Network security policies');
          
          if (isLastAttempt) {
            console.error('');
            console.error('💡 To fix this:');
            console.error('  - Disable ad blockers for localhost');
            console.error('  - Add localhost:8787 to your allowlist');
            console.error('  - Try a different browser');
            console.error('  - Check if the backend is running on port 8787');
            
            // In development, provide more detailed debugging
            if (API_URL.includes('localhost')) {
              console.error('');
              console.error('🔍 Debugging info:');
              console.error(`  - API URL: ${API_URL}`);
              console.error(`  - Endpoint: ${API_URL}/auth/validate-google`);
              console.error('  - Try manually visiting the endpoint to test connectivity');
            }
          }
        } else if (isTimeoutError) {
          console.warn(`⏱️ Request timeout (attempt ${attempt}/${maxRetries})`);
        } else {
          console.warn(`❌ Request failed (attempt ${attempt}/${maxRetries}):`, error);
        }

        // If this is the last attempt, return false
        if (isLastAttempt) {
          return false;
        }

        // Wait before retrying (except for network errors which likely won't resolve)
        if (!isNetworkError) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    return false;
  }

  /**
   * Get a valid Google authentication token
   * Returns null if not authenticated
   * Automatically attempts to refresh token if needed
   */
  static async getValidToken(): Promise<string | null> {
    try {
      const token = await this.getStoredToken();
      
      if (!token) {
        return null;
      }
      
      const isValid = await this.validateToken(token);
      
      if (isValid) {
        return token;
      } else {
        // Token is invalid, try to refresh it
        const refreshed = await this.refreshTokenIfPossible();
        if (refreshed) {
          return await this.getStoredToken();
        } else {
          await this.clearAuth();
          return null;
        }
      }
    } catch (error) {
      console.error('Failed to get valid token:', error);
      await this.clearAuth();
      return null;
    }
  }

  /**
   * Attempt to refresh the current token using the refresh token stored server-side
   */
  static async refreshTokenIfPossible(): Promise<boolean> {
    try {
      const token = await this.getStoredToken();
      if (!token) return false;

      // Call the backend validation endpoint which will attempt refresh if needed
      const response = await fetch(`${API_URL}/auth/validate-google`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`
        },
      });
      
      if (response.ok) {
        const data: GoogleAuthResponse = await response.json();
        
        if (data.valid && data.user) {
          // Backend may have refreshed the token, but we keep using the same token
          // since the backend manages refresh tokens server-side
          await this.storeUser(data.user);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.warn('Token refresh attempt failed:', error);
      return false;
    }
  }

  /**
   * Logout user - clear tokens and revoke with backend
   */
  static async logout(): Promise<void> {
    try {
      const token = await this.getStoredToken();
      
      if (token) {
        // Try to revoke token with backend
        try {
          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
          });
        } catch (error) {
          console.warn('Failed to revoke token with backend:', error);
        }
      }
      
      // Clear local storage regardless
      await this.clearAuth();
    } catch (error) {
      console.error('Logout failed:', error);
      // Still try to clear local storage
      await this.clearAuth();
    }
  }

  /**
   * Basic check for token structure validity
   * This is a fallback for development when backend validation fails
   */
  private static isTokenStructureValid(token: string): boolean {
    try {
      // Very basic check: should be a non-empty string with reasonable length
      // and not obviously corrupted
      return Boolean(token) && 
             typeof token === 'string' && 
             token.length > 10 && 
             token.length < 2000 &&
             !token.includes('undefined') &&
             !token.includes('null');
    } catch {
      return false;
    }
  }
} 