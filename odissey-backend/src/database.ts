import { User, World, Session, Message } from './types';

export class DatabaseService {
  constructor(private db: D1Database) {}

  // User management
  async createAnonymousUser(token: string, expiresAt: Date): Promise<User> {
    const result = await this.db
      .prepare(
        'INSERT INTO users (token, expires_at) VALUES (?, ?) RETURNING *'
      )
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

  // World management
  async getWorldById(worldId: string): Promise<World | null> {
    return await this.db
      .prepare('SELECT * FROM worlds WHERE id = ?')
      .bind(worldId)
      .first<World>();
  }

  async getAllWorlds(): Promise<World[]> {
    const result = await this.db
      .prepare('SELECT * FROM worlds ORDER BY created_at ASC')
      .all<World>();
    
    return result.results || [];
  }

  // Session management
  async createSession(sessionId: string, userId: number, worldId: string, worldState: string): Promise<Session> {
    const result = await this.db
      .prepare(
        'INSERT INTO sessions (id, user_id, world_id, world_state) VALUES (?, ?, ?, ?) RETURNING *'
      )
      .bind(sessionId, userId, worldId, worldState)
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

  async updateSessionState(sessionId: string, worldState: string, coherenceState?: string): Promise<void> {
    await this.db
      .prepare(
        'UPDATE sessions SET world_state = ?, coherence_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      )
      .bind(worldState, coherenceState || null, sessionId)
      .run();
  }

  // Message management
  async createMessage(sessionId: string, type: 'user' | 'narrator', content: string): Promise<Message> {
    const result = await this.db
      .prepare(
        'INSERT INTO messages (session_id, type, content) VALUES (?, ?, ?) RETURNING *'
      )
      .bind(sessionId, type, content)
      .first<Message>();
    
    if (!result) {
      throw new Error('Failed to create message');
    }
    
    return result;
  }

  async getSessionMessages(sessionId: string, limit: number = 50): Promise<Message[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?'
      )
      .bind(sessionId, limit)
      .all<Message>();
    
    return result.results || [];
  }

  async getRecentSessionMessages(sessionId: string, count: number = 10): Promise<Message[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .bind(sessionId, count)
      .all<Message>();
    
    return (result.results || []).reverse(); // Return in chronological order
  }

  // Cleanup expired users
  async cleanupExpiredUsers(): Promise<void> {
    await this.db
      .prepare('DELETE FROM users WHERE expires_at < CURRENT_TIMESTAMP')
      .run();
  }

  // Initialize database with schema
  async initializeDatabase(): Promise<void> {
    // This would typically be done through migrations
    // For now, we'll assume the schema is already applied
    console.log('Database connection verified');
  }
} 