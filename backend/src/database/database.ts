import { User, World, Session, Message } from './db-types';
import { Logger, createTimer, getElapsed } from '../utils';

export class DatabaseService {
  constructor(private db: D1Database) {
    Logger.info('DatabaseService initialized', {
      component: 'DatabaseService',
      operation: 'INIT'
    });
  }

  // === USER MANAGEMENT ===

  async createAnonymousUser(token: string, expiresAt: Date): Promise<User> {
    const result = await this.db
      .prepare('INSERT INTO users (token, expires_at) VALUES (?, ?) RETURNING *')
      .bind(token, expiresAt.toISOString())
      .first<User>();
    
    if (!result) {
      throw new Error('Failed to create user');
    }
    
    return result;
  }

  async getUserByToken(token: string): Promise<User | null> {
    const user = await this.db
      .prepare('SELECT * FROM users WHERE token = ? AND expires_at > CURRENT_TIMESTAMP')
      .bind(token)
      .first<User>();
    
    if (user) {
      // Update last_seen_at
      await this.db
        .prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(user.id)
        .run();
    }
    
    return user;
  }

  async validateUserToken(token: string): Promise<boolean> {
    const user = await this.getUserByToken(token);
    return user !== null;
  }

  async cleanupExpiredUsers(): Promise<void> {
    await this.db
      .prepare('DELETE FROM users WHERE expires_at < CURRENT_TIMESTAMP')
      .run();
  }

  // === WORLD MANAGEMENT ===

  async getWorldById(worldId: string): Promise<World | null> {
    return await this.db
      .prepare('SELECT * FROM worlds WHERE id = ?')
      .bind(worldId)
      .first<World>();
  }

  async getAllWorlds(): Promise<World[]> {
    const result = await this.db
      .prepare('SELECT * FROM worlds ORDER BY id ASC')
      .all<World>();
    
    return result.results || [];
  }

  async createWorld(id: string, title: string, description?: string): Promise<World> {
    const result = await this.db
      .prepare('INSERT INTO worlds (id, title, description) VALUES (?, ?, ?) RETURNING *')
      .bind(id, title, description || null)
      .first<World>();
    
    if (!result) {
      throw new Error('Failed to create world');
    }
    
    return result;
  }

  // === SESSION MANAGEMENT ===

  async createSession(sessionId: string, userId: number, worldId: string): Promise<Session> {
    const result = await this.db
      .prepare('INSERT INTO sessions (id, user_id, world_id) VALUES (?, ?, ?) RETURNING *')
      .bind(sessionId, userId, worldId)
      .first<Session>();
    
    if (!result) {
      throw new Error('Failed to create session');
    }
    
    return result;
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    return await this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<Session>();
  }

  async getSessionWithUser(sessionId: string, userId: number): Promise<Session | null> {
    return await this.db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .bind(sessionId, userId)
      .first<Session>();
  }

  // === SESSION STORY STATE MANAGEMENT ===

  async saveSessionStoryState(sessionId: string, storyState: any): Promise<void> {
    const storyStateJson = JSON.stringify(storyState);
    
    // Update the sessions table with story state
    await this.db
      .prepare(`
        UPDATE sessions 
        SET story_state = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `)
      .bind(storyStateJson, sessionId)
      .run();
  }

  async getSessionStoryState(sessionId: string): Promise<any | null> {
    const result = await this.db
      .prepare('SELECT story_state FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<{ story_state: string | null }>();
    
    if (!result || !result.story_state) {
      return null;
    }
    
    try {
      return JSON.parse(result.story_state);
    } catch (error) {
      Logger.error('Failed to parse story state JSON', error, {
        component: 'DatabaseService',
        operation: 'GET_SESSION_STORY_STATE',
        sessionId
      });
      return null;
    }
  }

  async deleteSessionStoryState(sessionId: string): Promise<void> {
    await this.db
      .prepare('UPDATE sessions SET story_state = NULL WHERE id = ?')
      .bind(sessionId)
      .run();
  }

  // === MESSAGE MANAGEMENT ===

  async createMessage(sessionId: string, type: 'user' | 'narrator', content: string): Promise<Message> {
    const result = await this.db
      .prepare('INSERT INTO messages (session_id, type, content) VALUES (?, ?, ?) RETURNING *')
      .bind(sessionId, type, content)
      .first<Message>();
    
    if (!result) {
      throw new Error('Failed to create message');
    }
    
    return result;
  }

  async getSessionMessages(sessionId: string, limit: number = 50): Promise<Message[]> {
    const result = await this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?')
      .bind(sessionId, limit)
      .all<Message>();
    
    return result.results || [];
  }

  async getRecentSessionMessages(sessionId: string, count: number = 10): Promise<Message[]> {
    const result = await this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(sessionId, count)
      .all<Message>();
    
    return (result.results || []).reverse(); // Return in chronological order
  }

  // === UTILITY METHODS ===

  async initializeDatabase(): Promise<void> {
    Logger.info('Database initialization completed', {
      component: 'DatabaseService',
      operation: 'INIT_DB'
    });
  }
} 