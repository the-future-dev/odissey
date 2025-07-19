import { SessionData, Message } from '../types';

/**
 * Cross-platform storage utility
 * Automatically detects environment and uses appropriate storage method:
 * - localStorage for web
 * - AsyncStorage for React Native
 */

interface StorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

class WebStorage implements StorageInterface {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('localStorage getItem failed:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('localStorage setItem failed:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('localStorage removeItem failed:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('localStorage clear failed:', error);
      throw error;
    }
  }
}

class ReactNativeStorage implements StorageInterface {
  private asyncStorage: any = null;

  private async getAsyncStorage() {
    if (!this.asyncStorage) {
      const module = await import('@react-native-async-storage/async-storage');
      this.asyncStorage = module.default;
    }
    return this.asyncStorage;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const AsyncStorage = await this.getAsyncStorage();
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn('AsyncStorage getItem failed:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const AsyncStorage = await this.getAsyncStorage();
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('AsyncStorage setItem failed:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const AsyncStorage = await this.getAsyncStorage();
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('AsyncStorage removeItem failed:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const AsyncStorage = await this.getAsyncStorage();
      await AsyncStorage.clear();
    } catch (error) {
      console.error('AsyncStorage clear failed:', error);
      throw error;
    }
  }
}

/**
 * Detects the current platform and returns appropriate storage
 */
function createPlatformStorage(): StorageInterface {
  // Check if we're in a web environment
  const isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  
  if (isWeb) {
    return new WebStorage();
  } else {
    return new ReactNativeStorage();
  }
}

/**
 * Cross-platform storage instance
 * Automatically uses localStorage on web and AsyncStorage on React Native
 */
export const CrossPlatformStorage = createPlatformStorage();

/**
 * Utility functions for common storage patterns
 */
export class StorageHelper {
  /**
   * Store JSON data
   */
  static async setJSON(key: string, data: any): Promise<void> {
    try {
      const jsonString = JSON.stringify(data);
      await CrossPlatformStorage.setItem(key, jsonString);
    } catch (error) {
      console.error(`Failed to store JSON for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve and parse JSON data
   */
  static async getJSON<T>(key: string): Promise<T | null> {
    try {
      const jsonString = await CrossPlatformStorage.getItem(key);
      if (!jsonString) return null;
      
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error(`Failed to retrieve JSON for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove multiple keys in parallel
   */
  static async removeMultiple(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map(key => CrossPlatformStorage.removeItem(key)));
    } catch (error) {
      console.error('Failed to remove multiple keys:', error);
      throw error;
    }
  }

  /**
   * Check if storage is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const testKey = '__storage_test__';
      await CrossPlatformStorage.setItem(testKey, 'test');
      await CrossPlatformStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Session Management for Multiple Worlds
 * Handles persistent storage of multiple concurrent sessions
 */
export class SessionManager {
  private static readonly SESSION_PREFIX = 'odyssey_session_';
  private static readonly MESSAGES_PREFIX = 'odyssey_messages_';
  private static readonly SESSIONS_INDEX_KEY = 'odyssey_sessions_index';

  /**
   * Get session data for a specific world
   */
  static async getSessionByWorld(worldId: string): Promise<{session: SessionData | null, messages: Message[] | null}> {
    try {
      const [sessionData, messagesData] = await Promise.all([
        StorageHelper.getJSON<SessionData>(`${this.SESSION_PREFIX}${worldId}`),
        StorageHelper.getJSON<Message[]>(`${this.MESSAGES_PREFIX}${worldId}`)
      ]);

      return {
        session: sessionData,
        messages: messagesData ? messagesData.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })) : null
      };
    } catch (error) {
      console.error(`Failed to get session for world ${worldId}:`, error);
      return { session: null, messages: null };
    }
  }

  /**
   * Save session data for a specific world
   */
  static async saveSessionByWorld(worldId: string, sessionData: SessionData, messages: Message[]): Promise<void> {
    try {
      await Promise.all([
        StorageHelper.setJSON(`${this.SESSION_PREFIX}${worldId}`, sessionData),
        StorageHelper.setJSON(`${this.MESSAGES_PREFIX}${worldId}`, messages)
      ]);

      // Update sessions index for tracking active sessions
      await this.updateSessionsIndex(worldId, sessionData);
    } catch (error) {
      console.error(`Failed to save session for world ${worldId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a session exists for a specific world
   */
  static async hasSessionForWorld(worldId: string): Promise<boolean> {
    try {
      const sessionData = await StorageHelper.getJSON<SessionData>(`${this.SESSION_PREFIX}${worldId}`);
      return sessionData !== null;
    } catch (error) {
      console.error(`Failed to check session for world ${worldId}:`, error);
      return false;
    }
  }

  /**
   * Remove session data for a specific world
   */
  static async removeSessionByWorld(worldId: string): Promise<void> {
    try {
      await StorageHelper.removeMultiple([
        `${this.SESSION_PREFIX}${worldId}`,
        `${this.MESSAGES_PREFIX}${worldId}`
      ]);

      // Remove from sessions index
      await this.removeFromSessionsIndex(worldId);
    } catch (error) {
      console.error(`Failed to remove session for world ${worldId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active session summaries
   */
  static async getAllActiveSessions(): Promise<Array<{worldId: string, sessionId: string, lastActive: Date}>> {
    try {
      const index = await StorageHelper.getJSON<Record<string, {sessionId: string, lastActive: string}>>
        (this.SESSIONS_INDEX_KEY) || {};

      return Object.entries(index).map(([worldId, data]) => ({
        worldId,
        sessionId: data.sessionId,
        lastActive: new Date(data.lastActive)
      }));
    } catch (error) {
      console.error('Failed to get active sessions:', error);
      return [];
    }
  }

  /**
   * Clean up old sessions (older than specified days)
   */
  static async cleanupOldSessions(daysOld: number = 7): Promise<void> {
    try {
      const activeSessions = await this.getAllActiveSessions();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const sessionsToRemove = activeSessions.filter(session => 
        session.lastActive < cutoffDate
      );

      await Promise.all(
        sessionsToRemove.map(session => this.removeSessionByWorld(session.worldId))
      );
    } catch (error) {
      console.error('Failed to cleanup old sessions:', error);
    }
  }

  /**
   * Update the sessions index with current session info
   */
  private static async updateSessionsIndex(worldId: string, sessionData: SessionData): Promise<void> {
    try {
      const index = await StorageHelper.getJSON<Record<string, {sessionId: string, lastActive: string}>>
        (this.SESSIONS_INDEX_KEY) || {};

      index[worldId] = {
        sessionId: sessionData.sessionId,
        lastActive: new Date().toISOString()
      };

      await StorageHelper.setJSON(this.SESSIONS_INDEX_KEY, index);
    } catch (error) {
      console.error('Failed to update sessions index:', error);
    }
  }

  /**
   * Remove world from sessions index
   */
  private static async removeFromSessionsIndex(worldId: string): Promise<void> {
    try {
      const index = await StorageHelper.getJSON<Record<string, {sessionId: string, lastActive: string}>>
        (this.SESSIONS_INDEX_KEY) || {};

      delete index[worldId];
      await StorageHelper.setJSON(this.SESSIONS_INDEX_KEY, index);
    } catch (error) {
      console.error('Failed to remove from sessions index:', error);
    }
  }
} 