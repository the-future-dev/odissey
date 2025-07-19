import { User, World, Session, Message, StoryModel, Chapter, GoogleOAuthSession } from './db-types';
import { Logger } from '../utils';

export class DatabaseService {
  constructor(private db: D1Database) {
    Logger.info('DatabaseService initialized', {
      component: 'DatabaseService',
      operation: 'INIT'
    });
  }

  // === USER MANAGEMENT ===



  async updateUserLastSeen(userId: number): Promise<void> {
    await this.db
      .prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(userId)
      .run();
  }

  async cleanupExpiredUsers(): Promise<number> {
    const result = await this.db
      .prepare('DELETE FROM users WHERE expires_at <= CURRENT_TIMESTAMP')
      .run();
    
    return result.meta.changes || 0;
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

  // === MESSAGE MANAGEMENT ===

  async createMessage(sessionId: string, type: 'user' | 'narrator', content: string, chapterNumber: number): Promise<Message> {
    const result = await this.db
      .prepare('INSERT INTO messages (session_id, type, content, chapter_number) VALUES (?, ?, ?, ?) RETURNING *')
      .bind(sessionId, type, content, chapterNumber)
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

  async getChapterMessages(sessionId: string, chapterNumber: number): Promise<Message[]> {
    const result = await this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? AND chapter_number = ? ORDER BY created_at ASC')
      .bind(sessionId, chapterNumber)
      .all<Message>();
    
    return result.results || [];
  }

  async getCurrentChapterNumber(sessionId: string): Promise<number> {
    const currentChapter = await this.getCurrentChapter(sessionId);
    return currentChapter?.chapter_number || 1;
  }

  // === STORY MODEL MANAGEMENT ===

  async createStoryModel(
    sessionId: string,
    coreThemeMoralMessage: string,
    genreStyleVoice: string,
    setting: string,
    protagonist: string,
    conflictSources: string,
    intendedImpact: string
  ): Promise<StoryModel> {
    const result = await this.db
      .prepare(`
        INSERT INTO story_models (
          session_id, core_theme_moral_message, genre_style_voice, 
          setting, protagonist, 
          conflict_sources, intended_impact
        ) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *
      `)
      .bind(sessionId, coreThemeMoralMessage, genreStyleVoice, setting, protagonist, conflictSources, intendedImpact)
      .first<StoryModel>();
    
    if (!result) {
      throw new Error('Failed to create story model');
    }
    
    return result;
  }

  async getStoryModelBySessionId(sessionId: string): Promise<StoryModel | null> {
    return await this.db
      .prepare('SELECT * FROM story_models WHERE session_id = ?')
      .bind(sessionId)
      .first<StoryModel>();
  }

  // === CHAPTER MANAGEMENT ===

  async createChapter(
    sessionId: string,
    chapterNumber: number,
    title: string,
    description: string,
    status: 'history' | 'current' | 'future',
    decomposition?: string
  ): Promise<Chapter> {
    const result = await this.db
      .prepare(`
        INSERT INTO chapters (
          session_id, chapter_number, title, description, status, decomposition
        ) VALUES (?, ?, ?, ?, ?, ?) RETURNING *
      `)
      .bind(sessionId, chapterNumber, title, description, status, decomposition || null)
      .first<Chapter>();
    
    if (!result) {
      throw new Error('Failed to create chapter');
    }
    
    return result;
  }

  async getCurrentChapter(sessionId: string): Promise<Chapter | null> {
    return await this.db
      .prepare('SELECT * FROM chapters WHERE session_id = ? AND status = ? LIMIT 1')
      .bind(sessionId, 'current')
      .first<Chapter>();
  }

  async getChaptersByStatus(sessionId: string, status: 'history' | 'current' | 'future'): Promise<Chapter[]> {
    const result = await this.db
      .prepare('SELECT * FROM chapters WHERE session_id = ? AND status = ? ORDER BY chapter_number ASC')
      .bind(sessionId, status)
      .all<Chapter>();
    
    return result.results || [];
  }

  async getAllChapters(sessionId: string): Promise<Chapter[]> {
    const result = await this.db
      .prepare('SELECT * FROM chapters WHERE session_id = ? ORDER BY chapter_number ASC')
      .bind(sessionId)
      .all<Chapter>();
    
    return result.results || [];
  }

  async updateChapterStatus(chapterId: number, status: 'history' | 'current' | 'future'): Promise<Chapter> {
    const result = await this.db
      .prepare(`
        UPDATE chapters 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? 
        RETURNING *
      `)
      .bind(status, chapterId)
      .first<Chapter>();
    
    if (!result) {
      throw new Error('Failed to update chapter status');
    }
    
    return result;
  }

  async updateChapterDecomposition(chapterId: number, decomposition: string): Promise<Chapter> {
    const result = await this.db
      .prepare(`
        UPDATE chapters 
        SET decomposition = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? 
        RETURNING *
      `)
      .bind(decomposition, chapterId)
      .first<Chapter>();
    
    if (!result) {
      throw new Error('Failed to update chapter decomposition');
    }
    
    return result;
  }

  async updateChapterDescription(chapterId: number, description: string): Promise<Chapter> {
    const result = await this.db
      .prepare(`
        UPDATE chapters 
        SET description = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? 
        RETURNING *
      `)
      .bind(description, chapterId)
      .first<Chapter>();
    
    if (!result) {
      throw new Error('Failed to update chapter description');
    }
    
    return result;
  }

  async updateChapterTitleAndDescription(chapterId: number, title: string, description: string): Promise<Chapter> {
    const result = await this.db
      .prepare(`
        UPDATE chapters 
        SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? 
        RETURNING *
      `)
      .bind(title, description, chapterId)
      .first<Chapter>();
    
    if (!result) {
      throw new Error('Failed to update chapter title and description');
    }
    
    return result;
  }

  async completeCurrentChapter(sessionId: string): Promise<void> {
    await this.db
      .prepare(`
        UPDATE chapters 
        SET status = 'history', updated_at = CURRENT_TIMESTAMP 
        WHERE session_id = ? AND status = 'current'
      `)
      .bind(sessionId)
      .run();
  }

  async setNextChapterAsCurrent(sessionId: string): Promise<Chapter | null> {
    const nextChapter = await this.db
      .prepare('SELECT * FROM chapters WHERE session_id = ? AND status = ? ORDER BY chapter_number ASC LIMIT 1')
      .bind(sessionId, 'future')
      .first<Chapter>();
    
    if (nextChapter) {
      return await this.updateChapterStatus(nextChapter.id, 'current');
    }
    
    return null;
  }

  async clearFutureChapters(sessionId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM chapters WHERE session_id = ? AND status = ?')
      .bind(sessionId, 'future')
      .run();
  }

  // === GOOGLE OAUTH USER MANAGEMENT ===

  async getUserByGoogleId(googleId: string): Promise<User | null> {
    return await this.db
      .prepare('SELECT * FROM users WHERE google_id = ?')
      .bind(googleId)
      .first<User>();
  }

  async getUserById(userId: number): Promise<User | null> {
    return await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first<User>();
  }

  async createUser(userData: {
    google_id: string;
    email: string;
    name: string;
    picture_url?: string;
  }): Promise<User> {
    const result = await this.db
      .prepare(`
        INSERT INTO users (google_id, email, name, picture_url, last_login_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) 
        RETURNING *
      `)
      .bind(userData.google_id, userData.email, userData.name, userData.picture_url || null)
      .first<User>();
    
    if (!result) {
      throw new Error('Failed to create user');
    }
    
    return result;
  }

  async updateUser(userId: number, updates: {
    email?: string;
    name?: string;
    picture_url?: string;
    last_login_at?: string;
  }): Promise<User> {
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    const result = await this.db
      .prepare(`
        UPDATE users 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? 
        RETURNING *
      `)
      .bind(...values, userId)
      .first<User>();
    
    if (!result) {
      throw new Error('Failed to update user or user not found');
    }
    
    return result;
  }

  // === GOOGLE OAUTH SESSION MANAGEMENT ===

  async createOAuthSession(sessionData: {
    user_id: number;
    access_token: string;
    refresh_token?: string;
    expires_at: string;
  }): Promise<GoogleOAuthSession> {
    const result = await this.db
      .prepare(`
        INSERT INTO google_oauth_sessions (user_id, access_token, refresh_token, expires_at) 
        VALUES (?, ?, ?, ?) 
        RETURNING *
      `)
      .bind(sessionData.user_id, sessionData.access_token, sessionData.refresh_token || null, sessionData.expires_at)
      .first<GoogleOAuthSession>();
    
    if (!result) {
      throw new Error('Failed to create OAuth session');
    }
    
    return result;
  }

  async getOAuthSessionByToken(accessToken: string): Promise<GoogleOAuthSession | null> {
    return await this.db
      .prepare('SELECT * FROM google_oauth_sessions WHERE access_token = ?')
      .bind(accessToken)
      .first<GoogleOAuthSession>();
  }

  async updateOAuthSession(sessionId: number, updates: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: string;
  }): Promise<void> {
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    await this.db
      .prepare(`
        UPDATE google_oauth_sessions 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `)
      .bind(...values, sessionId)
      .run();
  }

  async deleteOAuthSession(sessionId: number): Promise<void> {
    await this.db
      .prepare('DELETE FROM google_oauth_sessions WHERE id = ?')
      .bind(sessionId)
      .run();
  }

  async deleteOAuthSessionsByUserId(userId: number): Promise<void> {
    await this.db
      .prepare('DELETE FROM google_oauth_sessions WHERE user_id = ?')
      .bind(userId)
      .run();
  }

  async cleanupExpiredOAuthSessions(): Promise<void> {
    await this.db
      .prepare('DELETE FROM google_oauth_sessions WHERE expires_at <= CURRENT_TIMESTAMP')
      .run();
  }

  // === UTILITY METHODS ===

  async initializeDatabase(): Promise<void> {
    Logger.info('Database initialization completed', {
      component: 'DatabaseService',
      operation: 'INIT_DB'
    });
  }
} 