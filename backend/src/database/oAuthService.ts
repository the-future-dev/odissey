import { GoogleOAuthSession, User } from './db-types';
import { Logger } from '../utils/logger';
// type D1Database should be provided by your environment (e.g., Cloudflare D1)

export class OAuthService {
  constructor(private db: D1Database) {
    Logger.info('OAuthService initialized', {
      component: 'OAuthService',
      operation: 'INIT'
    });
  }
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
}
